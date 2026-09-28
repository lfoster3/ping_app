import type { AlertItem, Member, PingMessage, Place } from './types';

const MOCK_HISTORY = { historySlotMin: 30, historyStartSlot: 0 };

// Mock data until the band + backend are wired up. Everything the UI reads
// goes through `FamilyProvider`, so swapping this for API calls is local.

/** "Now" for the mock day: 3:05 PM. */
export const NOW_MIN = 15 * 60 + 5;

export const places: Place[] = [
  { id: 'home', name: 'Home', kind: 'home', point: { x: 0.2, y: 0.72 } },
  { id: 'school', name: 'School', kind: 'school', point: { x: 0.3, y: 0.18 } },
  { id: 'park', name: 'Riverside Park', kind: 'park', point: { x: 0.84, y: 0.22 } },
  { id: 'work', name: 'Office', kind: 'work', point: { x: 0.62, y: 0.86 } },
];

/** Small deterministic PRNG so the charts look the same on every reload. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

type Segment = { until: number; base: number; jitter: number };

/** Builds a half-hourly heart-rate day from a list of activity segments. */
function day(seed: number, segments: Segment[], last?: number): number[] {
  const rand = seeded(seed);
  const out: number[] = [];
  for (let t = 0; t <= NOW_MIN; t += 30) {
    const seg = segments.find((s) => t < s.until) ?? segments[segments.length - 1];
    out.push(Math.round(seg.base + (rand() - 0.5) * 2 * seg.jitter));
  }
  if (last !== undefined) out[out.length - 1] = last;
  return out;
}

const H = 60;

export const initialMembers: Member[] = [
  {
    id: 'mom',
    name: 'Mom',
    role: 'parent',
    avatar: { bg: '#F9DCE3', ink: '#1F2937' },
    state: 'ok',
    activity: 'At home',
    lastSyncMin: 4,
    heartRate: 68,
    heartRateHistory: day(11, [
      { until: 6.5 * H, base: 60, jitter: 4 },
      { until: 9 * H, base: 74, jitter: 7 },
      { until: 24 * H, base: 69, jitter: 6 },
    ], 68),
    ...MOCK_HISTORY,
    battery: 64,
    location: { label: 'Home', point: places[0].point },
    visits: [
      { placeId: 'home', from: 12 * H + 30, to: NOW_MIN },
      { placeId: 'work', from: 8 * H + 40, to: 12 * H + 10 },
    ],
  },
  {
    id: 'dad',
    name: 'Dad',
    role: 'parent',
    avatar: { bg: '#DCE5FB', ink: '#1F2937' },
    state: 'attention',
    activity: 'Heart rate above usual',
    lastSyncMin: 6,
    heartRate: 74,
    heartRateHistory: day(23, [
      { until: 6 * H, base: 58, jitter: 3 },
      { until: 12 * H, base: 66, jitter: 5 },
      { until: 24 * H, base: 76, jitter: 6 },
    ], 74),
    ...MOCK_HISTORY,
    battery: 41,
    location: { label: 'Office', point: places[3].point },
    visits: [{ placeId: 'work', from: 8 * H + 15, to: NOW_MIN }],
  },
  {
    id: 'nico',
    name: 'Nico',
    role: 'child',
    avatar: { bg: '#DCF1E3', ink: '#1F2937' },
    state: 'active',
    activity: 'Working out',
    lastSyncMin: 3,
    activityMin: 38,
    heartRate: 141,
    heartRateHistory: day(37, [
      { until: 7 * H, base: 62, jitter: 5 },
      { until: 8 * H, base: 84, jitter: 8 },
      { until: 12.5 * H, base: 76, jitter: 7 },
      { until: 14.5 * H, base: 82, jitter: 8 },
      { until: 24 * H, base: 128, jitter: 10 },
    ], 141),
    ...MOCK_HISTORY,
    battery: 72,
    location: { label: 'Near Riverside Park', point: { x: 0.49, y: 0.46 } },
    visits: [
      { placeId: 'home', from: 12 * H + 48, to: 14 * H + 20 },
      { placeId: 'school', from: 8 * H + 14, to: 12 * H + 42 },
    ],
  },
  {
    id: 'luke',
    name: 'Luke',
    role: 'child',
    avatar: { bg: '#FBE9C4', ink: '#1F2937' },
    state: 'ok',
    activity: 'At school',
    lastSyncMin: 22,
    heartRate: 61,
    heartRateHistory: day(41, [
      { until: 7 * H, base: 64, jitter: 4 },
      { until: 24 * H, base: 72, jitter: 7 },
    ], 61),
    ...MOCK_HISTORY,
    battery: 88,
    location: { label: 'School', point: places[1].point },
    visits: [
      { placeId: 'school', from: 8 * H + 5, to: NOW_MIN },
      { placeId: 'home', from: 0, to: 7 * H + 45 },
    ],
  },
];

/**
 * Pedro wears a real Garmin. Everything live (heart rate, status, history) is
 * filled in by FamilyProvider from the Bluetooth stream — nothing here is mock.
 */
export const pedroProfile: Pick<Member, 'id' | 'name' | 'role' | 'avatar'> = {
  id: 'pedro',
  name: 'Pedro',
  role: 'child',
  avatar: { bg: '#E7E1FB', ink: '#1F2937' },
};

export const pingMessages: PingMessage[] = [
  { id: 'where', label: 'Where are you?', icon: 'navigate' },
  { id: 'checkin', label: 'Check in please', icon: 'checkmark-circle' },
  { id: 'home', label: 'Time to come home', icon: 'home' },
  { id: 'call', label: 'Call me when you can', icon: 'call' },
  { id: 'pickup', label: "I'm on my way", icon: 'car' },
];

export const initialAlerts: AlertItem[] = [
  {
    id: 'a1',
    memberId: 'dad',
    tone: 'attention',
    title: "Dad's heart rate is above usual",
    body: 'Resting average is 12 bpm higher than his 30-day baseline.',
    minutesAgo: 6,
  },
  {
    id: 'a2',
    memberId: 'nico',
    tone: 'info',
    title: 'Nico started a workout',
    body: 'Near Riverside Park · heart rate in the moderate zone.',
    minutesAgo: 38,
  },
  {
    id: 'a3',
    memberId: 'nico',
    tone: 'success',
    title: 'Nico left Home',
    body: 'Left at 2:20 PM.',
    minutesAgo: 45,
  },
  {
    id: 'a4',
    memberId: 'luke',
    tone: 'success',
    title: 'Luke arrived at School',
    body: 'Arrived at 8:05 AM.',
    minutesAgo: 420,
  },
];
