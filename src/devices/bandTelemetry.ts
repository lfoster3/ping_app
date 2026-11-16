// Live feed from the Ping band. The band's firmware prints GPS + heart-rate
// packets on its serial port; the PC bridge (ping_firmware/tools/ping_bridge.py)
// posts them to the band-telemetry Edge Function, which stores them in
// public.band_telemetry. This module listens to that table in real time.
//
// When the band talks to the cloud over its own Wi-Fi, nothing here changes.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { GPS_TARGET_ACCURACY_M, type LocationFix } from './location';

/** The member who wears the band. Pedro is the family's "live" member. */
export const BAND_MEMBER_ID = 'pedro';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** One row of public.band_telemetry (supabase/migrations). */
export type BandRow = {
  id: number;
  member_id: string;
  recorded_at: string;
  hr_bpm: number | null;
  hr_finger: boolean;
  gps_fix: boolean;
  lat: number | null;
  lng: number | null;
  alt_m: number | null;
  speed_mps: number | null;
  sats: number | null;
  hdop: number | null;
};

export type BandSample = {
  at: number;
  /** null unless the band reported a trustworthy heart rate. */
  bpm: number | null;
  /** Sensor is touching skin. */
  contact: boolean;
  /** null when the band has no GPS fix. */
  fix: LocationFix | null;
};

/** HDOP is a dimensionless quality score; ~3 m per unit is a rough open-sky rule of thumb. */
const METRES_PER_HDOP = 3;

export function parseBandRow(row: BandRow): BandSample {
  const at = Date.parse(row.recorded_at);
  const hasFix = row.gps_fix && row.lat !== null && row.lng !== null;
  return {
    at,
    bpm: row.hr_bpm,
    contact: row.hr_finger,
    fix: hasFix
      ? {
          lat: row.lat!,
          lng: row.lng!,
          accuracyM: row.hdop ? +Math.max(row.hdop * METRES_PER_HDOP, GPS_TARGET_ACCURACY_M / 2).toFixed(1) : GPS_TARGET_ACCURACY_M,
          speedMps: row.speed_mps ?? 0,
          at,
        }
      : null,
  };
}

let client: SupabaseClient | null = null;

/** Null when Supabase isn't configured (demo mode). */
function getClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

export const bandUnavailableReason = () =>
  SUPABASE_URL && SUPABASE_KEY ? null : 'The Ping band needs the cloud connection: set the Supabase keys in .env.local.';

export type BandChannelStatus = 'subscribed' | 'reconnecting' | 'error';

/** Calls onSample for every new packet from the band. Returns an unsubscribe function. */
export function subscribeBand(onSample: (s: BandSample) => void, onStatus?: (s: BandChannelStatus) => void): () => void {
  const supabase = getClient();
  if (!supabase) {
    onStatus?.('error');
    return () => {};
  }
  const channel = supabase
    .channel(`band:${BAND_MEMBER_ID}:${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'band_telemetry', filter: `member_id=eq.${BAND_MEMBER_ID}` },
      (payload) => onSample(parseBandRow(payload.new as BandRow)),
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onStatus?.('subscribed');
      else if (status === 'CHANNEL_ERROR') onStatus?.('error');
      else onStatus?.('reconnecting'); // TIMED_OUT / CLOSED: supabase-js rejoins on its own
    });
  return () => {
    supabase.removeChannel(channel);
  };
}

/** The most recent position the band reported, so the map isn't empty until the next packet. */
export async function latestBandFix(maxAgeMs = 24 * 60 * 60 * 1000): Promise<LocationFix | null> {
  const supabase = getClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('band_telemetry')
    .select('*')
    .eq('member_id', BAND_MEMBER_ID)
    .eq('gps_fix', true)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const fix = parseBandRow(data as BandRow).fix;
  return fix && Date.now() - fix.at <= maxAgeMs ? fix : null;
}
