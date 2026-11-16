import type { HeartRateMonitor } from './heartRate';
import { bandUnavailableReason, subscribeBand } from './bandTelemetry';

/**
 * Heart rate from the Ping band, read from the cloud feed. Plugs into the same
 * pipeline as the Garmin (connectLive), so the Trends screen, zones and history
 * work unchanged. Readings only arrive while the bridge is running.
 */
export function createBandMonitor(): HeartRateMonitor {
  let unsubscribe: (() => void) | null = null;
  let onIdle: (() => void) | undefined;

  return {
    unsupportedReason: bandUnavailableReason,

    async connect({ onReading, onStatus }) {
      onIdle = () => onStatus('idle');
      onStatus('connecting');
      unsubscribe?.();
      unsubscribe = subscribeBand(
        (s) => {
          if (s.bpm !== null) onReading({ bpm: s.bpm, contact: s.contact, rrMs: [], at: s.at });
        },
        (status) => {
          if (status === 'subscribed') onStatus('connected', 'Ping band');
          else if (status === 'reconnecting') onStatus('reconnecting');
          else onStatus('error', 'Couldn’t reach the live feed.');
        },
      );
      return { name: 'Ping band' };
    },

    disconnect() {
      unsubscribe?.();
      unsubscribe = null;
      onIdle?.();
    },
  };
}
