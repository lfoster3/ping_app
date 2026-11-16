// NMEA 0183 parser for the ESP32 sensor feed.
// Handles standard GPS sentences ($GPRMC, $GPGGA) and the custom
// heart-rate line format: "bpm;valid;finger" (e.g. "75;1;1").

import type { LocationFix } from './location';

/** Parsed heart-rate reading from the ESP32's ";"-delimited line. */
export type Esp32HrLine = {
  bpm: number;
  valid: boolean;
  finger: boolean;
};

/** Parse a "bpm;valid;finger" line. Returns null on bad input. */
export function parseHrLine(raw: string): Esp32HrLine | null {
  const parts = raw.split(';');
  if (parts.length < 3) return null;
  const bpm = Number(parts[0]);
  if (!Number.isFinite(bpm) || bpm <= 0) return null;
  return {
    bpm: Math.round(bpm),
    valid: parts[1] === '1',
    finger: parts[2] === '1',
  };
}

// ── NMEA helpers ──────────────────────────────────────────────────

function nmeaDM(raw: string, dir: string): number | null {
  if (!raw) return null;
  // Format: DDMM.MMMM or DDDMM.MMMM
  const dot = raw.indexOf('.');
  if (dot < 3) return null;
  const degLen = dot - 2;
  const deg = Number(raw.slice(0, degLen));
  const min = Number(raw.slice(degLen));
  if (!Number.isFinite(deg) || !Number.isFinite(min)) return null;
  const sign = dir === 'S' || dir === 'W' ? -1 : 1;
  return sign * (deg + min / 60);
}

/**
 * Parse a $GPRMC sentence into a LocationFix.
 * Example: $GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A
 */
export function parseGPRMC(fields: string[]): LocationFix | null {
  if (fields.length < 10) return null;
  const status = fields[2];
  if (status !== 'A') return null; // V = void / no fix
  const lat = nmeaDM(fields[3], fields[4]);
  const lng = nmeaDM(fields[5], fields[6]);
  if (lat === null || lng === null) return null;
  const speedKnots = Number(fields[7]) || 0;
  return {
    lat,
    lng,
    accuracyM: 5, // RMC doesn't carry HDOP; use a conservative default
    speedMps: +(speedKnots * 0.514444).toFixed(2),
    at: Date.now(),
  };
}

/**
 * Parse a $GPGGA sentence into a LocationFix.
 * Example: $GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,47.0,M,,*47
 */
export function parseGPGGA(fields: string[]): LocationFix | null {
  if (fields.length < 10) return null;
  const quality = Number(fields[6]);
  if (!quality) return null; // 0 = invalid
  const lat = nmeaDM(fields[2], fields[3]);
  const lng = nmeaDM(fields[4], fields[5]);
  if (lat === null || lng === null) return null;
  const hdop = Number(fields[8]) || 1;
  return {
    lat,
    lng,
    accuracyM: +(hdop * 2.5).toFixed(1), // rough CEP from HDOP
    speedMps: 0, // GGA doesn't carry speed
    at: Date.now(),
  };
}

/**
 * Process one line from the ESP32 TCP stream.
 * Returns `{ hr }` for a heart-rate line, `{ gps }` for an NMEA fix,
 * or `null` for lines we can't parse (sentinels, empty, etc.).
 */
export function parseLine(raw: string): { hr: Esp32HrLine } | { gps: LocationFix } | null {
  const line = raw.trim();
  if (!line) return null;

  // NMEA sentence
  if (line.startsWith('$')) {
    // Strip optional checksum (*XX)
    const body = line.replace(/\*[0-9A-Fa-f]{1,2}$/, '');
    const fields = body.split(',');
    const type = fields[0];
    if (type === '$GPRMC' || type === '$GNRMC') {
      const fix = parseGPRMC(fields);
      return fix ? { gps: fix } : null;
    }
    if (type === '$GPGGA' || type === '$GNGGA') {
      const fix = parseGPGGA(fields);
      return fix ? { gps: fix } : null;
    }
    return null; // other NMEA sentences we don't need
  }

  // Heart-rate line: "bpm;valid;finger"
  if (line.includes(';')) {
    const hr = parseHrLine(line);
    return hr ? { hr } : null;
  }

  return null;
}
