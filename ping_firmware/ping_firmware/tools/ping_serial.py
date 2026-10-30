#!/usr/bin/env python3
"""
Reads the Ping wearable's JSON-lines serial stream.

  - prints GPS / heart-rate telemetry
  - appends every telemetry packet to telemetry.jsonl (with PC receive time)
  - reassembles each voice message into voice_<id>.wav
  - forward() is the hook where you send data on to the backend/app

Usage:  pip install pyserial
        python ping_serial.py COM5            (Windows)
        python ping_serial.py /dev/ttyUSB0    (Linux/macOS: /dev/cu.usbserial-*)
"""
import base64, json, sys, time, wave

BAUD = 921600
OUT_DIR = "."
audio = {}          # id -> {"rate": int, "chunks": {seq: bytes}}


def forward(kind, payload):
    """TODO: POST to your backend / push to the app. kind: 'telemetry' | 'voice'."""
    pass


def finish_voice(msg):
    a = audio.pop(msg["id"], None)
    if not a:
        return
    chunks = a["chunks"]
    expected = msg.get("chunks", len(chunks))
    missing = [s for s in range(expected) if s not in chunks]
    # zero-fill lost chunks so timing is preserved
    pcm = b"".join(chunks.get(s, b"\x00" * 512) for s in range(expected))
    path = f"{OUT_DIR}/voice_{msg['id']}.wav"
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(a["rate"])
        w.writeframes(pcm)
    print(f"[voice] saved {path}  {msg.get('dur_ms', 0)/1000:.1f}s  lost chunks: {len(missing)}/{expected}")
    forward("voice", {"id": msg["id"], "path": path, "lost": missing})


def handle_line(line, log=None):
    line = line.strip()
    if not line.startswith("{"):
        return                                   # boot ROM text / stray logs
    try:
        msg = json.loads(line)
    except json.JSONDecodeError:
        return                                   # truncated line; skip it
    t = msg.get("t")
    if t == "telemetry":
        msg["rx_time"] = time.time()
        g, h = msg["gps"], msg["hr"]
        gps = (f"{g['lat']:.5f},{g['lon']:.5f} sats={g['sats']} age={g['age_ms']}ms"
               if g.get("fix") else f"no fix (sats={g.get('sats', 0)})")
        hr = f"{h['bpm']} bpm" if h["valid"] else ("measuring..." if h["finger"] else "no contact")
        print(f"[telemetry] GPS {gps} | HR {hr}")
        if log:
            log.write(json.dumps(msg) + "\n"); log.flush()
        forward("telemetry", msg)
    elif t == "audio_start":
        audio[msg["id"]] = {"rate": msg["rate"], "chunks": {}}
        print(f"[voice] recording #{msg['id']} ...")
    elif t == "audio":
        a = audio.get(msg["id"])
        if a is not None:
            a["chunks"][msg["seq"]] = base64.b64decode(msg["b64"])
    elif t == "audio_end":
        finish_voice(msg)
    elif t in ("boot", "btn", "error"):
        print(f"[{t}] {line}")


def main():
    import serial                                 # pip install pyserial
    port = sys.argv[1]
    with serial.Serial(port, BAUD, timeout=1) as ser, open("telemetry.jsonl", "a") as log:
        while True:
            raw = ser.readline()
            if raw:
                handle_line(raw.decode("utf-8", errors="ignore"), log)


if __name__ == "__main__":
    main()
