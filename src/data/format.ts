import { colors } from '@/theme';
import type { Member, Message } from './types';

/** Whole minutes since a timestamp. */
export const minutesSince = (at: number, now = Date.now()) => Math.max(0, Math.floor((now - at) / 60_000));

export function ago(min: number): string {
  if (!Number.isFinite(min)) return 'never';
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  return h === 1 ? '1 hr ago' : `${h} hr ago`;
}

/** Minutes since midnight → "12:48 PM". Wraps values outside 0–24 h. */
export function clock(min: number): string {
  const day = ((Math.floor(min) % 1440) + 1440) % 1440;
  const h24 = Math.floor(day / 60);
  const m = day % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** Status line under a member's name, matching the mockups. */
export function statusLine(m: Member): string {
  if (m.live || m.state === 'attention' || m.state === 'offline') return m.activity;
  if (m.activitySince !== undefined) return `${m.activity} · ${minutesSince(m.activitySince)} min`;
  return `${m.activity} · ${ago(m.lastSyncMin)}`;
}

export const stateColor: Record<Member['state'], string> = {
  ok: colors.green,
  active: colors.primary,
  attention: colors.amber,
  offline: colors.faint,
};

export type Zone = {
  id: 'resting' | 'light' | 'moderate' | 'high';
  label: string;
  range: string;
  min: number;
  color: string;
};

export const zones: Zone[] = [
  { id: 'resting', label: 'Resting', range: '60–90', min: 0, color: colors.green },
  { id: 'light', label: 'Light', range: '91–120', min: 91, color: colors.yellow },
  { id: 'moderate', label: 'Moderate', range: '121–150', min: 121, color: colors.orange },
  { id: 'high', label: 'High', range: '151+', min: 151, color: colors.red },
];

export function zoneOf(bpm: number): Zone {
  return [...zones].reverse().find((z) => bpm >= z.min) ?? zones[0];
}

export type ZoneCounts = Record<Zone['id'], number>;

export function emptyZoneCounts(): ZoneCounts {
  return { resting: 0, light: 0, moderate: 0, high: 0 };
}

/** Share of samples spent in each zone, as whole percentages summing to 100. */
export function zoneBreakdown(samples: (number | null)[]): ZoneCounts {
  const counts = emptyZoneCounts();
  for (const s of samples) if (s !== null) counts[zoneOf(s).id] += 1;
  return zonePercents(counts);
}

export function zonePercents(counts: ZoneCounts): ZoneCounts {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return emptyZoneCounts();
  const pct = Object.fromEntries(
    Object.entries(counts).map(([k, v]) => [k, Math.round((v / total) * 100)]),
  ) as ZoneCounts;
  // Push rounding drift into the largest bucket so the column adds up.
  const drift = 100 - Object.values(pct).reduce((a, b) => a + b, 0);
  const largest = (Object.keys(pct) as Zone['id'][]).sort((a, b) => pct[b] - pct[a])[0];
  pct[largest] += drift;
  return pct;
}

const ZONE_BADGE: Record<Zone['id'], { label: string; bg: string; fg: string }> = {
  resting: { label: 'Normal', bg: '#1F8A4C', fg: '#fff' },
  light: { label: 'Light', bg: colors.yellow, fg: '#1F2937' },
  moderate: { label: 'Moderate', bg: colors.orange, fg: '#1F2937' },
  high: { label: 'High', bg: colors.red, fg: '#fff' },
};

/** Pill shown under the big bpm number. */
export function heartBadge(m: Member): { label: string; bg: string; fg: string } {
  if (m.live) {
    if (m.heartRate === null || m.live.status !== 'connected') {
      return { label: 'Not live', bg: colors.navyRaised, fg: colors.navyMuted };
    }
    return ZONE_BADGE[zoneOf(m.heartRate).id];
  }
  if (m.state === 'active') return { label: m.activity, bg: colors.primary, fg: '#fff' };
  if (m.state === 'attention') return { label: 'Above usual', bg: colors.amber, fg: '#1F2937' };
  return { label: 'Normal', bg: '#1F8A4C', fg: '#fff' };
}

export function todayLabel(d = new Date()): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/** "3:05 PM" today, "Yesterday", or "Mon" for older messages. */
export function messageTime(at: number, now = Date.now()): string {
  const d = new Date(at);
  const days = Math.round((new Date(now).setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return clock(d.getHours() * 60 + d.getMinutes());
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

/** "0:07" */
export const duration = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

/** One-line summary for conversation lists, e.g. "You: On my way" or "Voice note · “Be home soon”". */
export function messagePreview(m: Message, meId: string): string {
  const who = m.from === meId ? 'You: ' : '';
  switch (m.body.kind) {
    case 'text':
      return who + m.body.text;
    case 'ping':
      return `${who}Ping · ${m.body.text}`;
    case 'voice':
      return `${who}Voice note · ${m.body.transcript ? `“${m.body.transcript}”` : duration(m.body.durationSec)}`;
  }
}
