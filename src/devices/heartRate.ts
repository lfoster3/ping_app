// Bluetooth LE Heart Rate Profile — the standard every chest strap, WHOOP,
// and Garmin watch speaks when heart rate broadcasting is turned on.

export const HR_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
export const HR_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';

export type HeartRateReading = {
  bpm: number;
  /** null when the sensor doesn't report skin contact. */
  contact: boolean | null;
  /** Beat-to-beat intervals in ms, if the sensor sends them. */
  rrMs: number[];
  at: number;
};

export type MonitorStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export type MonitorHandlers = {
  onReading: (r: HeartRateReading) => void;
  onStatus: (status: MonitorStatus, detail?: string) => void;
};

export interface HeartRateMonitor {
  /** Why this platform can't connect, or null if it can. */
  unsupportedReason(): string | null;
  /** Must be called straight from a tap — browsers require a user gesture. */
  connect(handlers: MonitorHandlers): Promise<{ name: string }>;
  disconnect(): void;
}

/** Parses a Heart Rate Measurement (0x2A37) notification. */
export function parseHeartRateMeasurement(data: Uint8Array, at = Date.now()): HeartRateReading | null {
  if (data.length < 2) return null;
  const flags = data[0];
  const wide = (flags & 0x01) !== 0;
  const contactSupported = (flags & 0x04) !== 0;
  const contactDetected = (flags & 0x02) !== 0;
  const hasEnergy = (flags & 0x08) !== 0;
  const hasRR = (flags & 0x10) !== 0;

  if (wide && data.length < 3) return null;
  const bpm = wide ? data[1] | (data[2] << 8) : data[1];

  let offset = wide ? 3 : 2;
  if (hasEnergy) offset += 2;
  const rrMs: number[] = [];
  if (hasRR) {
    for (; offset + 1 < data.length; offset += 2) {
      rrMs.push(Math.round(((data[offset] | (data[offset + 1] << 8)) / 1024) * 1000));
    }
  }
  return { bpm, contact: contactSupported ? contactDetected : null, rrMs, at };
}
