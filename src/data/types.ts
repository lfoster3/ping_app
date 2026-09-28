import type { MonitorStatus } from '@/devices/heartRate';

export type MemberRole = 'parent' | 'child';

/** Drives the small dot on the avatar and the tone of the status line. */
export type MemberState = 'ok' | 'active' | 'attention' | 'offline';

export type Place = {
  id: string;
  name: string;
  kind: 'home' | 'school' | 'park' | 'work';
  /** Normalised map position (0–1) inside the map viewport. */
  point: { x: number; y: number };
};

export type Visit = {
  placeId: string;
  /** Minutes since midnight. */
  from: number;
  to: number;
};

export type LiveSource = 'garmin' | 'simulated';

/** Present on members whose data streams from a real (or simulated) sensor. */
export type LiveInfo = {
  source: LiveSource | null;
  status: MonitorStatus;
  deviceName?: string;
  error?: string;
  /** Raw readings from the last ~90 seconds, oldest first. */
  recent: { at: number; bpm: number }[];
  /** Seconds of readings seen in each heart-rate zone today. */
  zoneCounts: Record<'resting' | 'light' | 'moderate' | 'high', number>;
};

export type Member = {
  id: string;
  name: string;
  role: MemberRole;
  avatar: { bg: string; ink: string };
  state: MemberState;
  /** Short status line under the name, e.g. "At home" or "Working out". */
  activity: string;
  /** Minutes since the band last synced (Infinity if it never has). */
  lastSyncMin: number;
  /** Minutes the current activity has been going (used for "Working out · 38 min"). */
  activityMin?: number;
  /** null until the first reading arrives. */
  heartRate: number | null;
  /**
   * Today's samples, one per `historySlotMin` starting at slot `historyStartSlot`
   * (slot 0 = midnight). null marks a gap with no data.
   */
  heartRateHistory: (number | null)[];
  historySlotMin: number;
  historyStartSlot: number;
  battery: number | null;
  location: {
    label: string;
    point: { x: number; y: number };
  } | null;
  visits: Visit[];
  live?: LiveInfo;
  /** Has real Garmin/WHOOP history (src/data/pedroHistory.ts). */
  realHistory?: boolean;
};

export type PingMessage = {
  id: string;
  label: string;
  icon: 'navigate' | 'checkmark-circle' | 'home' | 'call' | 'car';
};

export type SentPing = {
  id: string;
  to: string[];
  message: string;
  withVitals: boolean;
  sentAt: number;
};

export type AlertItem = {
  id: string;
  memberId: string;
  tone: 'info' | 'attention' | 'success';
  title: string;
  body: string;
  minutesAgo: number;
};
