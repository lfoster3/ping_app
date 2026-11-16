// Receives GPS + heart-rate packets from the band (via the PC serial bridge
// today, over its own Wi-Fi later).
//
//   POST /functions/v1/band-telemetry
//   apikey: <project publishable key>
//   Content-Type: application/json
//   { "member": "pedro",
//     "packets": [ { "recorded_at": "2026-11-09T14:03:05Z",
//                    "gps": { "fix": 1, "lat": 41.6764, "lon": -86.252, "alt": 215.3,
//                             "spd_kmh": 0.4, "sats": 8, "hdop": 1.1 },
//                    "hr":  { "bpm": 72, "valid": 1, "finger": 1 } } ] }
//
// The gps/hr objects are exactly what the firmware prints on the serial line,
// so the bridge can forward them untouched. Responds 201 with { stored }.

import { admin, corsHeaders, hasAppKey, json } from '../_shared/supabase.ts';

const MAX_PACKETS = 100;
/** A reading timestamp more than this far from now is treated as a bad clock. */
const MAX_SKEW_MS = 24 * 60 * 60 * 1000;

type Packet = {
  recorded_at?: unknown;
  gps?: { fix?: unknown; lat?: unknown; lon?: unknown; alt?: unknown; spd_kmh?: unknown; sats?: unknown; hdop?: unknown };
  hr?: { bpm?: unknown; valid?: unknown; finger?: unknown };
};

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const inRange = (v: number | null, lo: number, hi: number) => (v !== null && v >= lo && v <= hi ? v : null);

function toRow(member: string, p: Packet, now: number) {
  let at = typeof p.recorded_at === 'string' ? Date.parse(p.recorded_at) : NaN;
  if (!Number.isFinite(at) || Math.abs(at - now) > MAX_SKEW_MS) at = now;

  const g = p.gps ?? {};
  const lat = inRange(num(g.lat), -90, 90);
  const lng = inRange(num(g.lon), -180, 180);
  // A fix needs real coordinates; (0, 0) is what an unset module reports.
  const fix = Boolean(g.fix) && lat !== null && lng !== null && !(lat === 0 && lng === 0);

  const h = p.hr ?? {};
  const bpm = inRange(num(h.bpm), 30, 220);
  const hrValid = Boolean(h.valid) && bpm !== null;

  const spdKmh = num(g.spd_kmh);
  return {
    member_id: member,
    recorded_at: new Date(at).toISOString(),
    hr_bpm: hrValid ? Math.round(bpm) : null,
    hr_finger: Boolean(h.finger),
    gps_fix: fix,
    lat: fix ? lat : null,
    lng: fix ? lng : null,
    alt_m: fix ? num(g.alt) : null,
    speed_mps: fix && spdKmh !== null ? spdKmh / 3.6 : null,
    sats: num(g.sats),
    hdop: num(g.hdop),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST a JSON body' }, 405);
  if (!hasAppKey(req)) return json({ error: 'Missing or unknown apikey header' }, 401);

  let body: { member?: unknown; packets?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body must be JSON' }, 400);
  }
  if (typeof body.member !== 'string') return json({ error: 'Need a `member` id' }, 400);
  if (!Array.isArray(body.packets) || body.packets.length === 0) return json({ error: 'Need a non-empty `packets` array' }, 400);
  if (body.packets.length > MAX_PACKETS) return json({ error: `At most ${MAX_PACKETS} packets per request` }, 413);

  const { data: member, error: memberError } = await admin.from('members').select('id').eq('id', body.member).maybeSingle();
  if (memberError) return json({ error: memberError.message }, 500);
  if (!member) return json({ error: 'Unknown `member`' }, 400);

  const now = Date.now();
  const rows = (body.packets as Packet[]).map((p) => toRow(body.member as string, p ?? {}, now));
  const { error } = await admin.from('band_telemetry').insert(rows);
  if (error) return json({ error: error.message }, 500);
  return json({ stored: rows.length }, 201);
});
