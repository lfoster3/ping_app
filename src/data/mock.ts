import { clock } from './format';
import type { AlertItem, Member, Message, PingMessage, Place } from './types';

const MOCK_HISTORY = { historySlotMin: 30, historyStartSlot: 0 };

// Mock data until the band + backend are wired up. Everything the UI reads
// goes through `FamilyProvider`, so swapping this for API calls is local.

/** When the app opened — the mock story is anchored to the real clock. */
export const LOADED_AT = Date.now();

/** Minutes since midnight when the app opened. */
export const NOW_MIN = new Date(LOADED_AT).getHours() * 60 + new Date(LOADED_AT).getMinutes();

/** The mock story was written as if it were 3:05 PM. */
const STORY_NOW = 15 * 60 + 5;

/**
 * Moves a story time (e.g. 8:14 AM) so it sits the same distance before the
 * real "now". Can go below 0 (yesterday); `clock()` wraps it.
 */
const shift = (storyMin: number) => NOW_MIN - (STORY_NOW - storyMin);

/** Minutes-since-midnight `min` minutes before the app opened. */
const before = (min: number) => NOW_MIN - min;

/** Timestamp `min` minutes before the app opened. */
const minAgo = (min: number) => LOADED_AT - min * 60_000;

export const places: Place[] = [
  // A house on N Lawrence Street, Harters Heights (just south of campus).
  { id: 'home', name: 'Home', kind: 'home', coords: { lat: 41.6924, lng: -86.24432 } },
  // Between DeBartolo, Fitzpatrick, Cushing and Stinson-Remick halls.
  { id: 'school', name: 'School', kind: 'school', coords: { lat: 41.6988, lng: -86.2371 } },
  { id: 'park', name: 'Riverside Park', kind: 'park', coords: { lat: 41.70552, lng: -86.23254 } },
  { id: 'work', name: 'Office', kind: 'work', coords: { lat: 41.69976, lng: -86.23672 } },
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

/** Builds a half-hourly heart-rate day (midnight → now) from story-time activity segments. */
function day(seed: number, segments: Segment[], last?: number): number[] {
  const rand = seeded(seed);
  const out: number[] = [];
  for (let t = 0; t <= NOW_MIN; t += 30) {
    const seg = segments.find((s) => t < shift(s.until)) ?? segments[segments.length - 1];
    out.push(Math.round(seg.base + (rand() - 0.5) * 2 * seg.jitter));
  }
  if (last !== undefined) out[out.length - 1] = last;
  return out;
}

const H = 60;

/** The family shares one Home (and one School, Office…) — always look places up by id. */
const coordsOf = (id: Place['id']) => places.find((p) => p.id === id)!.coords;

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
    location: { label: 'Home', coords: coordsOf('home') },
    visits: [
      { placeId: 'home', from: before(95), to: null },
      { placeId: 'work', from: before(180), to: before(115) },
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
    location: { label: 'Office', coords: coordsOf('work') },
    visits: [{ placeId: 'work', from: before(140), to: null }],
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
    location: { label: 'School', coords: coordsOf('school') },
    visits: [
      { placeId: 'school', from: before(150), to: null },
      { placeId: 'home', from: before(240), to: before(165) },
    ],
  },
];

/**
 * Pedro wears a WHOOP. Everything live (heart rate, status, history) is
 * filled in by FamilyProvider from the Bluetooth stream — nothing here is mock.
 */
export const pedroProfile: Pick<Member, 'id' | 'name' | 'role' | 'avatar'> = {
  id: 'pedro',
  name: 'Pedro',
  role: 'child',
  avatar: { bg: '#E7E1FB', ink: '#1F2937' },
};

/**
 * Nico's sensor data comes from an ESP32 over Wi-Fi. Everything live is
 * filled in by FamilyProvider from the ESP32 feed — nothing here is mock.
 */
export const nicoProfile: Pick<Member, 'id' | 'name' | 'role' | 'avatar'> = {
  id: 'nico',
  name: 'Nico',
  role: 'child',
  avatar: { bg: '#DCF1E3', ink: '#1F2937' },
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
    at: minAgo(6),
  },
  {
    id: 'a2',
    memberId: 'nico',
    tone: 'info',
    title: 'Nico started a workout',
    body: 'Near Riverside Park · heart rate in the moderate zone.',
    at: minAgo(38),
  },
  {
    id: 'a3',
    memberId: 'nico',
    tone: 'success',
    title: 'Nico left Home',
    body: `Left at ${clock(before(45))}.`,
    at: minAgo(45),
  },
  {
    id: 'a4',
    memberId: 'luke',
    tone: 'success',
    title: 'Luke arrived at School',
    body: `Arrived at ${clock(before(150))}.`,
    at: minAgo(150),
  },
];

/** Who the app is signed in as until accounts exist (switchable in Settings for demos). */
export const DEFAULT_ME_ID = 'mom';

const text = (id: string, from: string, to: string, min: number, t: string): Message => ({
  id,
  from,
  to,
  at: minAgo(min),
  body: { kind: 'text', text: t },
});

/** Used when no messaging backend is configured; everything stays on this device. */
export const initialMessages: Message[] = [
  text('m1', 'mom', 'nico', 52, 'Have fun at the park! Back by 5?'),
  text('m2', 'nico', 'mom', 49, 'yep 👍'),
  {
    id: 'm3',
    from: 'nico',
    to: 'mom',
    at: minAgo(9),
    body: {
      kind: 'voice',
      source: 'band',
      durationSec: 7,
      transcriptStatus: 'done',
      transcript: 'Practice is running a little late, I’ll be home by five thirty.',
    },
  },
  text('m4', 'mom', 'pedro', 75, 'How was the exam?'),
  text('m5', 'pedro', 'mom', 14, 'Went well! Heading to the gym now'),
  text('m6', 'mom', 'luke', 190, 'Have a good day at school'),
  text('m7', 'luke', 'mom', 186, 'thanks mom'),
  text('m8', 'dad', 'mom', 130, 'Stuck in a meeting until 4'),
  text('m9', 'mom', 'dad', 128, 'No worries, I’ll grab Luke'),
];

/** Mom's read positions in the mock conversations above. */
export const initialReadAt: Record<string, Record<string, number>> = {
  mom: { nico: minAgo(49), pedro: minAgo(75), luke: minAgo(186), dad: minAgo(128) },
};
