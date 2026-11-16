#!/usr/bin/env python3
"""
Ping serial bridge: band (USB serial) -> Supabase -> the app.

  telemetry packets  -> POST /functions/v1/band-telemetry   (GPS + heart rate, ~1/s)
  voice messages     -> POST /functions/v1/voice-note       (WAV, button held on the band)

Setup:   pip install pyserial
Keys:    read from ../../.env.local (the app's EXPO_PUBLIC_SUPABASE_URL and
         EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY), or pass --url / --key.

Run:     python ping_bridge.py COM3 --to mom
         python ping_bridge.py --replay capture.log --dry-run     (no hardware or network)

--member is the child wearing the band (the app treats "pedro" as the live member).
--to is who receives the band's voice messages.
"""
import argparse, base64, json, os, queue, struct, sys, threading, time, urllib.error, urllib.request, uuid

BAUD = 921600
BATCH_MAX = 50          # packets per request (the function accepts 100)
FLUSH_EVERY_S = 1.0
CHUNK_BYTES = 512       # PCM bytes per firmware audio chunk (256 samples)


# ---------------------------------------------------------------- config
def load_env_file(path):
    env = {}
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
    except OSError:
        pass
    return env


def wav_bytes(pcm, rate):
    """Wrap 16-bit mono PCM in a WAV header (the voice-note endpoint accepts audio/wav)."""
    header = b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVEfmt " + struct.pack(
        "<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16) + b"data" + struct.pack("<I", len(pcm))
    return header + pcm


def iso(t):
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t))


# ---------------------------------------------------------------- cloud
class Cloud:
    def __init__(self, url, key, dry_run):
        self.url, self.key, self.dry = (url or "").rstrip("/"), key, dry_run

    def post(self, path, body, content_type, params=None):
        """Returns (status, text). In dry-run mode nothing leaves this machine."""
        query = ("?" + urllib.parse.urlencode(params)) if params else ""
        if self.dry:
            print(f"[dry-run] POST {path}{query}  {content_type}  {len(body)} bytes")
            return 201, ""
        req = urllib.request.Request(f"{self.url}/functions/v1/{path}{query}", data=body, method="POST",
                                     headers={"apikey": self.key, "Content-Type": content_type})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return r.status, r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8", "replace")
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            return 0, str(e)


import urllib.parse  # noqa: E402  (kept next to its only user above for readability)


class Uploader(threading.Thread):
    """Sends telemetry in batches off the serial-reading thread, so slow HTTP never drops serial bytes."""

    def __init__(self, cloud, member):
        super().__init__(daemon=True)
        self.cloud, self.member = cloud, member
        self.q = queue.Queue(maxsize=2000)

    def add(self, packet):
        try:
            self.q.put_nowait(packet)
        except queue.Full:
            pass                      # offline for a long time: drop the oldest-cost-free way (newest lost)

    def run(self):
        pending = []
        while True:
            try:
                pending.append(self.q.get(timeout=FLUSH_EVERY_S))
            except queue.Empty:
                pass
            while len(pending) < BATCH_MAX and not self.q.empty():
                pending.append(self.q.get_nowait())
            if not pending:
                continue
            body = json.dumps({"member": self.member, "packets": pending[:BATCH_MAX]}).encode()
            status, text = self.cloud.post("band-telemetry", body, "application/json")
            if status in (200, 201):
                pending = pending[BATCH_MAX:]
            elif 400 <= status < 500:
                print(f"[telemetry] rejected ({status}): {text[:200]}")
                pending = pending[BATCH_MAX:]          # retrying a bad request would never succeed
            else:
                print(f"[telemetry] network problem, will retry ({status} {text[:80]})")
                time.sleep(2)
            pending = pending[-500:]                   # cap memory while offline


# ---------------------------------------------------------------- stream handling
class Bridge:
    def __init__(self, cloud, uploader, member, to):
        self.cloud, self.up, self.member, self.to = cloud, uploader, member, to
        self.audio = {}           # id -> {"rate": int, "chunks": {seq: bytes}}

    def handle_line(self, line, rx_time=None):
        line = line.strip()
        if not line.startswith("{"):
            return                                    # boot ROM text / stray logs
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            return                                    # truncated line
        t, rx = msg.get("t"), rx_time or time.time()
        if t == "telemetry":
            g, h = msg.get("gps", {}), msg.get("hr", {})
            self.up.add({"recorded_at": iso(rx), "gps": g, "hr": h})
            gps = f"{g['lat']:.5f},{g['lon']:.5f} sats={g.get('sats')}" if g.get("fix") else "no fix"
            hr = f"{h['bpm']} bpm" if h.get("valid") else ("measuring" if h.get("finger") else "no contact")
            print(f"[telemetry] GPS {gps} | HR {hr}")
        elif t == "audio_start":
            self.audio[msg["id"]] = {"rate": msg["rate"], "chunks": {}}
            print(f"[voice] recording #{msg['id']} ...")
        elif t == "audio":
            a = self.audio.get(msg["id"])
            if a is not None:
                try:
                    a["chunks"][msg["seq"]] = base64.b64decode(msg["b64"])
                except (ValueError, KeyError):
                    pass
        elif t == "audio_end":
            self.finish_voice(msg)
        elif t in ("boot", "error"):
            print(f"[{t}] {line}")

    def finish_voice(self, msg):
        a = self.audio.pop(msg["id"], None)
        if not a:
            return
        expected = msg.get("chunks", len(a["chunks"]))
        lost = [s for s in range(expected) if s not in a["chunks"]]
        pcm = b"".join(a["chunks"].get(s, b"\x00" * CHUNK_BYTES) for s in range(expected))
        dur = msg.get("dur_ms", len(pcm) * 1000 // (a["rate"] * 2)) / 1000
        print(f"[voice] #{msg['id']} {dur:.1f}s, lost chunks {len(lost)}/{expected} -> sending to {self.to}")
        threading.Thread(target=self.upload_voice, args=(wav_bytes(pcm, a["rate"]), dur), daemon=True).start()

    def upload_voice(self, wav, dur):
        params = {"id": str(uuid.uuid4()), "from": self.member, "to": self.to, "duration": f"{dur:.2f}"}
        for attempt in range(4):                       # same id each time, so a retry can't double-send
            status, text = self.cloud.post("voice-note", wav, "audio/wav", params)
            if status in (200, 201, 409):
                print("[voice] delivered")
                return
            if 400 <= status < 500:
                print(f"[voice] rejected ({status}): {text[:200]}")
                return
            time.sleep(2 ** attempt)
        print("[voice] gave up after 4 tries (check the network)")


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("port", nargs="?", help="serial port, e.g. COM3 or /dev/ttyUSB0")
    ap.add_argument("--member", default="pedro", help="member id of the child wearing the band")
    ap.add_argument("--to", default="mom", help="member id that receives the band's voice messages")
    ap.add_argument("--url"), ap.add_argument("--key")
    ap.add_argument("--replay", metavar="FILE", help="read lines from a saved capture instead of a serial port")
    ap.add_argument("--dry-run", action="store_true", help="print what would be sent; send nothing")
    a = ap.parse_args()

    env = load_env_file(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env.local"))
    url = a.url or os.environ.get("EXPO_PUBLIC_SUPABASE_URL") or env.get("EXPO_PUBLIC_SUPABASE_URL")
    key = a.key or os.environ.get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY") or env.get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    if not a.dry_run and not (url and key):
        sys.exit("No Supabase URL/key. Fill in .env.local at the repo root, pass --url/--key, or use --dry-run.")
    if not a.port and not a.replay:
        sys.exit("Give a serial port, or --replay FILE.")

    cloud = Cloud(url, key, a.dry_run)
    up = Uploader(cloud, a.member)
    up.start()
    bridge = Bridge(cloud, up, a.member, a.to)

    if a.replay:
        with open(a.replay, encoding="utf-8", errors="ignore") as f:
            for line in f:
                bridge.handle_line(line)
        time.sleep(FLUSH_EVERY_S * 2.5)               # let the uploader flush
        return

    import serial                                     # pip install pyserial
    print(f"Reading {a.port} at {BAUD} baud. Close idf.py monitor first (one program per port). Ctrl+C to stop.")
    while True:                                       # reconnect if the board is unplugged / reset
        try:
            with serial.Serial(a.port, BAUD, timeout=1) as ser:
                while True:
                    raw = ser.readline()
                    if raw:
                        bridge.handle_line(raw.decode("utf-8", errors="ignore"))
        except serial.SerialException as e:
            print(f"[serial] {e}; retrying in 2 s")
            time.sleep(2)
        except KeyboardInterrupt:
            return


if __name__ == "__main__":
    main()
