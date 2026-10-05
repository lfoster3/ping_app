// GPS feed contract. The simulated feed implements it today; the real band /
// backend feed will implement the same interface, so only FamilyProvider
// needs to change when it lands.

/** How often each member's position is refreshed. */
export const GPS_INTERVAL_MS = 10_000;

/** Accuracy we're aiming for from the band's GPS, in metres. Worse fixes are flagged in the UI. */
export const GPS_TARGET_ACCURACY_M = 3;

export type LatLng = { lat: number; lng: number };

export type LocationFix = {
  lat: number;
  lng: number;
  /** Radius of uncertainty in metres. */
  accuracyM: number;
  /** Metres per second; 0 when stationary. */
  speedMps: number;
  at: number;
};

export type LocationSource = 'gps' | 'simulated';

export interface LocationFeed {
  readonly source: LocationSource;
  /** Calls onFix once per member every GPS_INTERVAL_MS until stop(). */
  start(onFix: (memberId: string, fix: LocationFix) => void): void;
  stop(): void;
}

/** Great-circle distance in metres. */
export function distanceM(a: LatLng, b: LatLng) {
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
