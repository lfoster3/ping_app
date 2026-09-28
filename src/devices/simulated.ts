import type { HeartRateMonitor } from './heartRate';

/**
 * Development-only fake sensor: a 1 Hz random walk around a resting rate.
 * Lets the team test the live pipeline without a watch. Shown as "Simulated"
 * everywhere in the UI so it's never mistaken for real data.
 */
export function createSimulatedMonitor(): HeartRateMonitor {
  let timer: ReturnType<typeof setInterval> | undefined;
  let onIdle: (() => void) | undefined;

  return {
    unsupportedReason: () => null,
    async connect({ onReading, onStatus }) {
      onIdle = () => onStatus('idle');
      onStatus('connecting');
      let bpm = 72;
      let target = 72;
      timer = setInterval(() => {
        if (Math.random() < 0.03) target = 62 + Math.random() * 60;
        bpm += (target - bpm) * 0.08 + (Math.random() - 0.5) * 2;
        onReading({ bpm: Math.round(bpm), contact: true, rrMs: [], at: Date.now() });
      }, 1000);
      onStatus('connected', 'Simulated signal');
      return { name: 'Simulated signal' };
    },
    disconnect() {
      clearInterval(timer);
      onIdle?.();
    },
  };
}
