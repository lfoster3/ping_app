// Fallback for platforms without Bluetooth. Metro picks monitor.web.ts or
// monitor.native.ts instead when bundling for those platforms.
import type { HeartRateMonitor } from './heartRate';

export function createMonitor(): HeartRateMonitor {
  return {
    unsupportedReason: () => 'Bluetooth isn’t available on this platform.',
    connect: () => Promise.reject(new Error('Bluetooth isn’t available on this platform.')),
    disconnect: () => {},
  };
}
