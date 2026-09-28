import { PermissionsAndroid, Platform } from 'react-native';
import type { BleManager, Device, Subscription } from 'react-native-ble-plx';

import { HR_MEASUREMENT, HR_SERVICE, parseHeartRateMeasurement, type HeartRateMonitor, type MonitorHandlers } from './heartRate';

const SCAN_TIMEOUT_MS = 20000;
const NEEDS_DEV_BUILD = 'Bluetooth needs a development build of Ping (it doesn’t work inside Expo Go).';

/** Loaded lazily so the rest of the app still runs in Expo Go. */
function loadManager(): BleManager | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: Expo Go has no BLE native module
    const { BleManager: Manager } = require('react-native-ble-plx') as typeof import('react-native-ble-plx');
    return new Manager();
  } catch {
    return null;
  }
}

async function ensureAndroidPermissions() {
  if (Platform.OS !== 'android') return;
  const perms =
    Number(Platform.Version) >= 31
      ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const result = await PermissionsAndroid.requestMultiple(perms);
  if (Object.values(result).some((r) => r !== PermissionsAndroid.RESULTS.GRANTED)) {
    throw new Error('Ping needs Bluetooth permission to reach your watch.');
  }
}

function waitForPoweredOn(manager: BleManager) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      sub.remove();
      reject(new Error('Turn on Bluetooth on this phone, then try again.'));
    }, 8000);
    const sub = manager.onStateChange((state) => {
      if (state === 'PoweredOn') {
        clearTimeout(timer);
        sub.remove();
        resolve();
      }
    }, true);
  });
}

function scanForHeartRate(manager: BleManager) {
  return new Promise<Device>((resolve, reject) => {
    const timer = setTimeout(() => {
      manager.stopDeviceScan();
      reject(new Error('No heart-rate broadcast found. Turn on Broadcast Heart Rate on the Garmin and keep it close.'));
    }, SCAN_TIMEOUT_MS);
    manager.startDeviceScan([HR_SERVICE], null, (error, device) => {
      if (error) {
        clearTimeout(timer);
        manager.stopDeviceScan();
        reject(error);
      } else if (device) {
        clearTimeout(timer);
        manager.stopDeviceScan();
        resolve(device);
      }
    });
  });
}

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** iOS / Android via react-native-ble-plx. */
export function createMonitor(): HeartRateMonitor {
  let manager: BleManager | null = null;
  let deviceId: string | null = null;
  let handlers: MonitorHandlers | null = null;
  let notifySub: Subscription | null = null;
  let disconnectSub: Subscription | null = null;
  let stopped = true;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;

  const subscribe = async () => {
    const device = await manager!.connectToDevice(deviceId!, { autoConnect: false });
    await device.discoverAllServicesAndCharacteristics();
    notifySub?.remove();
    notifySub = device.monitorCharacteristicForService(HR_SERVICE, HR_MEASUREMENT, (error, ch) => {
      if (error || !ch?.value) return;
      const reading = parseHeartRateMeasurement(decodeBase64(ch.value));
      if (reading && reading.bpm > 0) handlers?.onReading(reading);
    });
    disconnectSub?.remove();
    disconnectSub = manager!.onDeviceDisconnected(deviceId!, () => reconnect());
    attempt = 0;
    handlers?.onStatus('connected', device.name ?? undefined);
    return device;
  };

  // Keep retrying until the user disconnects — the watch drops out of range
  // or pauses broadcasting, and we want Pedro's heart rate back automatically.
  const reconnect = () => {
    notifySub?.remove();
    notifySub = null;
    if (stopped || !manager || !deviceId) return;
    handlers?.onStatus('reconnecting');
    const delay = Math.min(15000, 1000 * 2 ** attempt++);
    retryTimer = setTimeout(() => {
      subscribe().catch(reconnect);
    }, delay);
  };

  return {
    unsupportedReason() {
      if (!manager) manager = loadManager();
      return manager ? null : NEEDS_DEV_BUILD;
    },

    async connect(h) {
      if (!manager) manager = loadManager();
      if (!manager) throw new Error(NEEDS_DEV_BUILD);
      handlers = h;
      h.onStatus('connecting');
      await ensureAndroidPermissions();
      await waitForPoweredOn(manager);
      const found = await scanForHeartRate(manager);
      deviceId = found.id;
      stopped = false;
      try {
        const device = await subscribe();
        return { name: device.name ?? found.name ?? 'Heart-rate sensor' };
      } catch (e) {
        stopped = true;
        throw e;
      }
    },

    disconnect() {
      stopped = true;
      clearTimeout(retryTimer);
      notifySub?.remove();
      disconnectSub?.remove();
      notifySub = disconnectSub = null;
      if (manager && deviceId) manager.cancelDeviceConnection(deviceId).catch(() => {});
      deviceId = null;
      handlers?.onStatus('idle');
    },
  };
}
