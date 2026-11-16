// ESP32 sensor feed — receives heart rate + GPS from the board.
//
// The ESP32 streams newline-delimited JSON over USB serial. A tiny
// Node bridge (tools/serial-bridge.js) relays it over WebSocket so the
// React Native app can connect from any platform.
//
// Two implementations:
//   createWebSocketEsp32Feed(url)   – real data via the serial bridge
//   createSimulatedEsp32Feed()      – dev-only fake data

import type { HeartRateReading } from './heartRate';
import type { LocationFix } from './location';

export type Esp32Handlers = {
  onHr: (r: HeartRateReading) => void;
  onGps: (fix: LocationFix) => void;
  onStatus: (status: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error', detail?: string) => void;
};

export interface Esp32Feed {
  connect(handlers: Esp32Handlers): Promise<{ name: string }>;
  disconnect(): void;
}

// ── WebSocket feed (real hardware) ──────────────────────────────

/** Default URL for the serial bridge running on the dev machine. */
export const DEFAULT_BRIDGE_URL = 'ws://localhost:8089';

/**
 * Connects to the serial-bridge WebSocket and translates the ESP32's
 * JSON telemetry into the same callbacks the simulated feed uses.
 */
export function createWebSocketEsp32Feed(url = DEFAULT_BRIDGE_URL): Esp32Feed {
  let ws: WebSocket | null = null;
  let stopped = true;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let handlers: Esp32Handlers | null = null;

  function open() {
    if (stopped) return;
    ws = new WebSocket(url);

    ws.onopen = () => {
      handlers?.onStatus('connected', 'ESP32');
    };

    ws.onmessage = (ev) => {
      if (!handlers) return;
      try {
        const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
        if (msg.t !== 'telemetry') return;

        // Heart rate
        const hr = msg.hr;
        if (hr && typeof hr.bpm === 'number' && hr.bpm > 0 && hr.valid) {
          handlers.onHr({
            bpm: hr.bpm,
            contact: !!hr.finger,
            rrMs: [],
            at: Date.now(),
          });
        }

        // GPS
        const gps = msg.gps;
        if (gps && gps.fix === 1 && typeof gps.lat === 'number') {
          const hdop = typeof gps.hdop === 'number' ? gps.hdop : 1;
          handlers.onGps({
            lat: gps.lat,
            lng: gps.lon,
            accuracyM: +(hdop * 2.5).toFixed(1),
            speedMps: typeof gps.spd_kmh === 'number' ? +(gps.spd_kmh / 3.6).toFixed(2) : 0,
            at: Date.now(),
          });
        }
      } catch {
        // ignore malformed lines
      }
    };

    ws.onerror = () => {
      // onclose fires right after, so reconnect logic lives there
    };

    ws.onclose = () => {
      if (stopped) return;
      handlers?.onStatus('reconnecting');
      retryTimer = setTimeout(open, 2000);
    };
  }

  return {
    async connect(h) {
      handlers = h;
      stopped = false;
      h.onStatus('connecting');
      open();
      // Resolve immediately — status updates arrive via onStatus
      return { name: 'ESP32' };
    },

    disconnect() {
      stopped = true;
      clearTimeout(retryTimer);
      handlers?.onStatus('idle');
      handlers = null;
      if (ws) {
        ws.onclose = null; // prevent reconnect
        ws.close();
        ws = null;
      }
    },
  };
}

// ── Simulated feed ──────────────────────────────────────────────

/** Starting point: near Riverside Park (Nico's usual spot). */
const START = { lat: 41.70336, lng: -86.23919 };

/** Route waypoints — a jogging loop near the park. */
const ROUTE = [
  START,
  { lat: 41.70426, lng: -86.2371 },
  { lat: 41.7039, lng: -86.23444 },
  { lat: 41.703, lng: -86.23216 },
  { lat: 41.70228, lng: -86.23444 },
  { lat: 41.70246, lng: -86.23748 },
];

function distM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function lerp(a: { lat: number; lng: number }, b: { lat: number; lng: number }, t: number) {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/**
 * Dev-only simulated ESP32: 1 Hz heart rate + ~1 Hz GPS on a jogging route.
 * Labelled "ESP32 (simulated)" so it's never mistaken for real data.
 */
export function createSimulatedEsp32Feed(): Esp32Feed {
  let hrTimer: ReturnType<typeof setInterval> | undefined;
  let gpsTimer: ReturnType<typeof setInterval> | undefined;
  let onIdle: (() => void) | undefined;

  return {
    async connect(handlers) {
      onIdle = () => handlers.onStatus('idle');
      handlers.onStatus('connecting');

      // ── Heart rate: random walk around a jogging pace ──
      let bpm = 110;
      let target = 120;
      hrTimer = setInterval(() => {
        if (Math.random() < 0.04) target = 80 + Math.random() * 70;
        bpm += (target - bpm) * 0.1 + (Math.random() - 0.5) * 3;
        bpm = Math.max(50, Math.min(200, bpm));
        handlers.onHr({
          bpm: Math.round(bpm),
          contact: true,
          rrMs: [],
          at: Date.now(),
        });
      }, 1000);

      // ── GPS: jog along the route ──
      const speedMps = 3.0;
      const stepM = speedMps * 2;
      let seg = 0;
      let along = 0;

      gpsTimer = setInterval(() => {
        let left = stepM;
        while (left > 0) {
          const a = ROUTE[seg];
          const b = ROUTE[(seg + 1) % ROUTE.length];
          const len = distM(a, b);
          if (along + left < len) {
            along += left;
            left = 0;
          } else {
            left -= len - along;
            seg = (seg + 1) % ROUTE.length;
            along = 0;
          }
        }
        const a = ROUTE[seg];
        const b = ROUTE[(seg + 1) % ROUTE.length];
        const len = distM(a, b);
        const here = lerp(a, b, len ? along / len : 0);
        const jLat = (Math.random() - 0.5) * (6 / 111_320);
        const jLng = (Math.random() - 0.5) * (6 / (111_320 * Math.cos((here.lat * Math.PI) / 180)));
        handlers.onGps({
          lat: here.lat + jLat,
          lng: here.lng + jLng,
          accuracyM: +(1.5 + Math.random() * 3).toFixed(1),
          speedMps: +(speedMps * (0.85 + Math.random() * 0.3)).toFixed(1),
          at: Date.now(),
        });
      }, 2000);

      handlers.onStatus('connected', 'ESP32 (simulated)');
      return { name: 'ESP32 (simulated)' };
    },

    disconnect() {
      clearInterval(hrTimer);
      clearInterval(gpsTimer);
      onIdle?.();
    },
  };
}
