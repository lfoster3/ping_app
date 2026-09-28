import { HR_MEASUREMENT, HR_SERVICE, parseHeartRateMeasurement, type HeartRateMonitor, type MonitorHandlers } from './heartRate';

// Minimal Web Bluetooth types — they aren't in TypeScript's DOM lib yet.
type BtCharacteristic = EventTarget & {
  value?: DataView;
  startNotifications(): Promise<BtCharacteristic>;
  stopNotifications(): Promise<BtCharacteristic>;
};
type BtServer = {
  connected: boolean;
  connect(): Promise<BtServer>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<{ getCharacteristic(uuid: string): Promise<BtCharacteristic> }>;
};
type BtDevice = EventTarget & { name?: string; gatt?: BtServer };
type Bluetooth = {
  getAvailability?: () => Promise<boolean>;
  requestDevice(options: { filters: { services: string[] }[] }): Promise<BtDevice>;
};

const bluetooth = (): Bluetooth | undefined =>
  typeof navigator !== 'undefined' ? (navigator as Navigator & { bluetooth?: Bluetooth }).bluetooth : undefined;

/** Web Bluetooth (Chrome / Edge on macOS, Windows, Android). */
export function createMonitor(): HeartRateMonitor {
  let device: BtDevice | null = null;
  let characteristic: BtCharacteristic | null = null;
  let handlers: MonitorHandlers | null = null;
  let stopped = true;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;

  const onValue = (e: Event) => {
    const view = (e.target as BtCharacteristic).value;
    if (!view) return;
    const reading = parseHeartRateMeasurement(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
    if (reading && reading.bpm > 0) handlers?.onReading(reading);
  };

  const subscribe = async () => {
    const server = await device!.gatt!.connect();
    const service = await server.getPrimaryService(HR_SERVICE);
    characteristic = await service.getCharacteristic(HR_MEASUREMENT);
    characteristic.addEventListener('characteristicvaluechanged', onValue);
    await characteristic.startNotifications();
    attempt = 0;
    handlers?.onStatus('connected', device?.name);
  };

  // Keep trying for as long as the user hasn't disconnected: watches drop the
  // link when they go out of range or broadcast is paused.
  const reconnect = () => {
    if (stopped || !device) return;
    handlers?.onStatus('reconnecting');
    const delay = Math.min(15000, 1000 * 2 ** attempt++);
    retryTimer = setTimeout(() => {
      subscribe().catch(reconnect);
    }, delay);
  };

  const onDisconnected = () => {
    characteristic?.removeEventListener('characteristicvaluechanged', onValue);
    characteristic = null;
    reconnect();
  };

  return {
    unsupportedReason() {
      if (!bluetooth()) return 'This browser can’t use Bluetooth. Open Ping in Chrome or Edge.';
      if (typeof window !== 'undefined' && !window.isSecureContext) return 'Bluetooth needs https:// or localhost.';
      return null;
    },

    async connect(h) {
      const bt = bluetooth();
      if (!bt) throw new Error('This browser can’t use Bluetooth. Open Ping in Chrome or Edge.');
      handlers = h;
      // requestDevice must be the first await so it still counts as the user's tap.
      const picked = await bt.requestDevice({ filters: [{ services: [HR_SERVICE] }] });
      device?.removeEventListener('gattserverdisconnected', onDisconnected);
      device = picked;
      stopped = false;
      h.onStatus('connecting');
      device.addEventListener('gattserverdisconnected', onDisconnected);
      try {
        await subscribe();
      } catch (e) {
        stopped = true;
        device.removeEventListener('gattserverdisconnected', onDisconnected);
        throw e;
      }
      return { name: device.name ?? 'Heart-rate sensor' };
    },

    disconnect() {
      stopped = true;
      clearTimeout(retryTimer);
      characteristic?.removeEventListener('characteristicvaluechanged', onValue);
      characteristic?.stopNotifications().catch(() => {});
      device?.removeEventListener('gattserverdisconnected', onDisconnected);
      if (device?.gatt?.connected) device.gatt.disconnect();
      characteristic = null;
      device = null;
      handlers?.onStatus('idle');
    },
  };
}
