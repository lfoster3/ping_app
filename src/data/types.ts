import type { MonitorStatus } from '@/devices/heartRate';
import type { LatLng, LocationFix, LocationSource } from '@/devices/location';

export type MemberRole = 'parent' | 'child';

/** Drives the small dot on the avatar and the tone of the status line. */
export type MemberState = 'ok' | 'active' | 'attention' | 'offline';

export type Place = {
  id: string;
  name: string;
  kind: 'home' | 'school' | 'park' | 'work';
  coords: LatLng;
};

export type Visit = {
  placeId: string;
  /** Minutes since midnight today (negative = yesterday). */
  from: number;
  /** null while they're still there. */
  to: number | null;
};

export type LiveSource = 'garmin' | 'simulated' | 'band';

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

/** Latest position from the GPS feed (real or simulated). */
export type GpsInfo = {
  source: LocationSource;
  fix: LocationFix;
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
  /** When the current activity started (used for "Working out · 38 min"). */
  activitySince?: number;
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
    coords: LatLng;
  } | null;
  visits: Visit[];
  gps?: GpsInfo;
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

/** A voice note recorded on the band's mic (button press) or the phone's. */
export type VoiceNote = {
  kind: 'voice';
  source: 'band' | 'phone';
  durationSec: number;
  /** A file or blob URI on this device, or a path in the voice-notes storage bucket. */
  audio?: { uri: string } | { path: string };
  /** Speech-to-text runs after the audio arrives; 'off' when no transcriber is set up. */
  transcriptStatus: 'pending' | 'done' | 'failed' | 'off';
  transcript?: string;
};

export type MessageBody =
  | { kind: 'text'; text: string }
  /** A ping sent from the Send ping sheet, shown inline in the thread. */
  | { kind: 'ping'; text: string }
  | VoiceNote;

/** Conversations are one-to-one between family members. */
export type Message = {
  id: string;
  /** Member ids. */
  from: string;
  to: string;
  at: number;
  body: MessageBody;
};

export type AlertItem = {
  id: string;
  memberId: string;
  tone: 'info' | 'attention' | 'success';
  title: string;
  body: string;
  at: number;
};
