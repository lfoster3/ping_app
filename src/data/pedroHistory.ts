// Pedro's real heart-rate history — a snapshot pulled from his WHOOP
// and Garmin (Forerunner 970) through AthleteData on 2026-09-28.
// Nothing here is generated. Live readings still come over Bluetooth;
// this file only covers the past. To refresh, pull a new snapshot and
// replace the arrays (see README › "Pedro's history").

export const HISTORY_SNAPSHOT = {
  pulledAt: '2026-09-28',
  device: 'WHOOP + Garmin Forerunner 970',
  /** Pedro's timezone (EDT) — used to label workout start times. */
  utcOffsetMin: -240,
};

/** Garmin all-day heart rate, one row per calendar day, oldest first. */
export type DailyHeartRate = {
  date: string;
  resting: number;
  avg: number;
  min: number;
  max: number;
  /** Today's row only covers part of the day (last Garmin sync). */
  partialUntil?: string;
};

export const dailyHeartRate: DailyHeartRate[] = [
  { date: '2026-08-30', resting: 41, avg: 65, min: 39, max: 146 },
  { date: '2026-08-31', resting: 41, avg: 58, min: 38, max: 162 },
  { date: '2026-09-01', resting: 40, avg: 57, min: 38, max: 153 },
  { date: '2026-09-02', resting: 38, avg: 52, min: 36, max: 130 },
  { date: '2026-09-03', resting: 37, avg: 58, min: 34, max: 159 },
  { date: '2026-09-04', resting: 38, avg: 60, min: 36, max: 172 },
  { date: '2026-09-05', resting: 48, avg: 61, min: 40, max: 106 },
  { date: '2026-09-06', resting: 36, avg: 55, min: 36, max: 158 },
  { date: '2026-09-07', resting: 37, avg: 59, min: 35, max: 143 },
  { date: '2026-09-08', resting: 40, avg: 62, min: 38, max: 154 },
  { date: '2026-09-09', resting: 38, avg: 63, min: 37, max: 167 },
  { date: '2026-09-10', resting: 41, avg: 57, min: 39, max: 144 },
  { date: '2026-09-11', resting: 37, avg: 62, min: 36, max: 167 },
  { date: '2026-09-12', resting: 51, avg: 63, min: 43, max: 106 },
  { date: '2026-09-13', resting: 38, avg: 54, min: 36, max: 135 },
  { date: '2026-09-14', resting: 37, avg: 54, min: 36, max: 136 },
  { date: '2026-09-15', resting: 38, avg: 55, min: 36, max: 139 },
  { date: '2026-09-16', resting: 38, avg: 54, min: 37, max: 106 },
  { date: '2026-09-17', resting: 37, avg: 57, min: 35, max: 96 },
  { date: '2026-09-18', resting: 44, avg: 61, min: 46, max: 95 },
  { date: '2026-09-19', resting: 43, avg: 67, min: 41, max: 119 },
  { date: '2026-09-20', resting: 42, avg: 54, min: 39, max: 95 },
  { date: '2026-09-21', resting: 38, avg: 59, min: 37, max: 146 },
  { date: '2026-09-22', resting: 42, avg: 59, min: 39, max: 132 },
  { date: '2026-09-23', resting: 41, avg: 60, min: 39, max: 163 },
  { date: '2026-09-24', resting: 41, avg: 60, min: 38, max: 129 },
  { date: '2026-09-25', resting: 39, avg: 57, min: 37, max: 147 },
  { date: '2026-09-26', resting: 39, avg: 53, min: 38, max: 86 },
  { date: '2026-09-27', resting: 40, avg: 68, min: 38, max: 164 },
  { date: '2026-09-28', resting: 44, avg: 47, min: 40, max: 91, partialUntil: '8:55 AM' },
];

/**
 * WHOOP overnight readings, keyed by the day they were scored, oldest first.
 * WHOOP wasn't worn Sep 20–22, so those days are missing.
 */
export type OvernightHeart = { date: string; resting: number; hrvMs: number };

export const overnightHeart: OvernightHeart[] = [
  { date: '2026-08-30', resting: 43, hrvMs: 88.0 },
  { date: '2026-08-31', resting: 42, hrvMs: 97.5 },
  { date: '2026-09-01', resting: 41, hrvMs: 103.0 },
  { date: '2026-09-02', resting: 39, hrvMs: 113.2 },
  { date: '2026-09-03', resting: 37, hrvMs: 115.6 },
  { date: '2026-09-04', resting: 39, hrvMs: 112.7 },
  { date: '2026-09-05', resting: 56, hrvMs: 42.8 },
  { date: '2026-09-06', resting: 39, hrvMs: 83.7 },
  { date: '2026-09-07', resting: 40, hrvMs: 112.4 },
  { date: '2026-09-08', resting: 40, hrvMs: 102.6 },
  { date: '2026-09-09', resting: 40, hrvMs: 75.5 },
  { date: '2026-09-10', resting: 42, hrvMs: 81.9 },
  { date: '2026-09-11', resting: 40, hrvMs: 87.3 },
  { date: '2026-09-12', resting: 60, hrvMs: 30.6 },
  { date: '2026-09-13', resting: 41, hrvMs: 43.4 },
  { date: '2026-09-14', resting: 37, hrvMs: 115.8 },
  { date: '2026-09-15', resting: 40, hrvMs: 74.5 },
  { date: '2026-09-16', resting: 41, hrvMs: 45.8 },
  { date: '2026-09-17', resting: 39, hrvMs: 49.0 },
  { date: '2026-09-18', resting: 55, hrvMs: 38.1 },
  { date: '2026-09-19', resting: 46, hrvMs: 76.9 },
  { date: '2026-09-23', resting: 44, hrvMs: 74.3 },
  { date: '2026-09-24', resting: 42, hrvMs: 111.4 },
  { date: '2026-09-25', resting: 41, hrvMs: 120.6 },
  { date: '2026-09-26', resting: 42, hrvMs: 84.5 },
  { date: '2026-09-27', resting: 43, hrvMs: 77.5 },
  { date: '2026-09-28', resting: 45, hrvMs: 90.8 },
];

export type WorkoutSport = 'run' | 'ride' | 'swim' | 'strength';

/** Sessions recorded on the Garmin, newest first. */
export type Workout = {
  date: string;
  /** Local start time, e.g. "9:16 AM". */
  start: string;
  name: string;
  sport: WorkoutSport;
  durationMin: number;
  avgHr: number;
  maxHr: number;
};

export const workouts: Workout[] = [
  { date: '2026-09-28', start: '9:16 AM', name: 'technique', sport: 'swim', durationMin: 43, avgHr: 104, maxHr: 130 },
  { date: '2026-09-27', start: '12:33 PM', name: 'South Bend Running', sport: 'run', durationMin: 41, avgHr: 157, maxHr: 169 },
  { date: '2026-09-27', start: '8:59 AM', name: 'South Bend Road Cycling', sport: 'ride', durationMin: 158, avgHr: 115, maxHr: 170 },
  { date: '2026-09-25', start: '8:21 PM', name: 'Strength', sport: 'strength', durationMin: 62, avgHr: 80, maxHr: 133 },
  { date: '2026-09-25', start: '11:22 AM', name: 'Pool Swim', sport: 'swim', durationMin: 53, avgHr: 113, maxHr: 154 },
  { date: '2026-09-24', start: '7:26 AM', name: 'South Bend Road Cycling', sport: 'ride', durationMin: 112, avgHr: 97, maxHr: 139 },
  { date: '2026-09-23', start: '9:38 AM', name: 'South Bend - Triple Piramide en cuesta', sport: 'run', durationMin: 61, avgHr: 143, maxHr: 167 },
  { date: '2026-09-22', start: '9:13 AM', name: '+ Densidad (Doble Bloque) EX', sport: 'ride', durationMin: 53, avgHr: 114, maxHr: 138 },
  { date: '2026-09-21', start: '7:06 PM', name: 'Strength', sport: 'strength', durationMin: 50, avgHr: 104, maxHr: 157 },
  { date: '2026-09-21', start: '11:07 AM', name: 'Entreno 09/02', sport: 'swim', durationMin: 56, avgHr: 113, maxHr: 142 },
  { date: '2026-09-19', start: '12:41 PM', name: 'Strength', sport: 'strength', durationMin: 48, avgHr: 100, maxHr: 148 },
  { date: '2026-09-15', start: '9:11 AM', name: 'Strength', sport: 'strength', durationMin: 48, avgHr: 83, maxHr: 126 },
  { date: '2026-09-14', start: '7:07 PM', name: 'Strength', sport: 'strength', durationMin: 43, avgHr: 86, maxHr: 147 },
  { date: '2026-09-14', start: '9:05 AM', name: '09/14', sport: 'swim', durationMin: 44, avgHr: 116, maxHr: 143 },
  { date: '2026-09-13', start: '4:33 PM', name: '+ Densidad (Doble Bloque)', sport: 'ride', durationMin: 104, avgHr: 111, maxHr: 149 },
  { date: '2026-09-11', start: '7:20 AM', name: 'South Bend Running', sport: 'run', durationMin: 88, avgHr: 147, maxHr: 169 },
  { date: '2026-09-10', start: '4:06 PM', name: 'South Bend Road Cycling', sport: 'ride', durationMin: 77, avgHr: 122, maxHr: 153 },
  { date: '2026-09-09', start: '7:29 PM', name: 'Treadmill Running', sport: 'run', durationMin: 66, avgHr: 140, maxHr: 150 },
  { date: '2026-09-09', start: '11:45 AM', name: 'Progresiones + final fuerte VI', sport: 'swim', durationMin: 48, avgHr: 130, maxHr: 170 },
  { date: '2026-09-08', start: '5:30 PM', name: 'South Bend Road Cycling', sport: 'ride', durationMin: 47, avgHr: 128, maxHr: 167 },
  { date: '2026-09-08', start: '9:06 AM', name: 'Strength', sport: 'strength', durationMin: 48, avgHr: 86, maxHr: 126 },
  { date: '2026-09-07', start: '7:07 PM', name: 'Strength', sport: 'strength', durationMin: 50, avgHr: 90, maxHr: 154 },
  { date: '2026-09-07', start: '11:44 AM', name: 'Entreno 09/02', sport: 'swim', durationMin: 56, avgHr: 120, maxHr: 150 },
  { date: '2026-09-06', start: '6:20 PM', name: 'South Bend Running', sport: 'run', durationMin: 56, avgHr: 144, maxHr: 166 },
  { date: '2026-09-04', start: '6:57 PM', name: 'South Bend - 2x 8x 75/30"', sport: 'run', durationMin: 47, avgHr: 157, maxHr: 175 },
  { date: '2026-09-03', start: '6:12 PM', name: 'St Joseph County Road Cycling', sport: 'ride', durationMin: 28, avgHr: 142, maxHr: 163 },
  { date: '2026-09-03', start: '8:59 AM', name: 'Strength', sport: 'strength', durationMin: 55, avgHr: 89, maxHr: 142 },
  { date: '2026-09-02', start: '12:26 PM', name: 'Strength', sport: 'strength', durationMin: 51, avgHr: 87, maxHr: 141 },
  { date: '2026-08-31', start: '7:04 PM', name: 'Treadmill Running', sport: 'run', durationMin: 58, avgHr: 141, maxHr: 164 },
  { date: '2026-08-31', start: '8:33 AM', name: 'Strength', sport: 'strength', durationMin: 50, avgHr: 83, maxHr: 139 },
  { date: '2026-08-30', start: '4:14 PM', name: '4x1 Resto Cómodo', sport: 'ride', durationMin: 120, avgHr: 128, maxHr: 150 },
];

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * "Usual" = median of the previous days (excluding the latest), so one bad
 * night doesn't move the baseline. Drives the "above usual" flag.
 */
export function baseline<T>(rows: T[], pick: (r: T) => number) {
  const latest = rows[rows.length - 1];
  const usual = median(rows.slice(0, -1).map(pick));
  return { latest, value: pick(latest), usual, delta: pick(latest) - usual };
}

/** Resting HR this many bpm over usual earns an "above usual" flag. */
export const RESTING_ALERT_BPM = 5;
