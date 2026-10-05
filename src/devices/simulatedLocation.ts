import { places } from '@/data/mock';
import { distanceM, GPS_INTERVAL_MS, GPS_TARGET_ACCURACY_M, type LatLng, type LocationFeed, type LocationFix } from './location';

/**
 * Dummy GPS until the bands report real positions. Every GPS_INTERVAL_MS each
 * member gets a fix: some stay put with realistic GPS jitter, others move along
 * a route. Shown as "Simulated GPS" in the UI so it's never mistaken for real.
 */


type Script =
  | { kind: 'stay'; at: LatLng }
  /** Loops through the waypoints; `stops` are waypoint indexes to pause at. */
  | { kind: 'route'; waypoints: LatLng[]; speedMps: number; stops?: number[]; pauseTicks?: number };

const at = (id: string) => places.find((p) => p.id === id)!.coords;
const HOME = at('home');
const SCHOOL = at('school');
const PARK = at('park');
const WORK = at('work');

const SCRIPTS: Record<string, Script> = {
  mom: { kind: 'stay', at: HOME },
  dad: { kind: 'stay', at: WORK },
  luke: { kind: 'stay', at: SCHOOL },
  // Jogging laps beside Riverside Park.
  nico: {
    kind: 'route',
    speedMps: 3.2,
    waypoints: [
      { lat: 41.70336, lng: -86.23919 },
      { lat: 41.70426, lng: -86.2371 },
      { lat: 41.7039, lng: -86.23444 },
      { lat: 41.703, lng: -86.23216 },
      { lat: 41.70228, lng: -86.23444 },
      { lat: 41.70246, lng: -86.23748 },
    ],
  },
  // Cycling Home → School → Park → Home, stopping a minute at each.
  pedro: {
    kind: 'route',
    speedMps: 5,
    waypoints: [
      HOME,
      { lat: 41.69786, lng: -86.24395 },
      SCHOOL,
      { lat: 41.7048, lng: -86.23805 },
      PARK,
      { lat: 41.70255, lng: -86.23672 },
    ],
    stops: [0, 2, 4],
    pauseTicks: 6,
  },
};

/** A fix within the target accuracy (1.5 m up to the target), to one decimal. */
function fakeAccuracy() {
  return +(1.5 + Math.random() * (GPS_TARGET_ACCURACY_M - 1.5)).toFixed(1);
}

/** Offsets a position by up to `metres` in a random direction. */
function jitter(p: LatLng, metres: number): LatLng {
  const angle = Math.random() * 2 * Math.PI;
  const r = Math.random() * metres;
  return {
    lat: p.lat + (r * Math.cos(angle)) / 111_320,
    lng: p.lng + (r * Math.sin(angle)) / (111_320 * Math.cos((p.lat * Math.PI) / 180)),
  };
}

function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/** Returns a function that produces the next fix for one member. */
function walker(script: Script): (at: number) => LocationFix {
  if (script.kind === 'stay') {
    const home = script.at;
    return (at) => {
      const accuracyM = fakeAccuracy();
      return { ...jitter(home, accuracyM), accuracyM, speedMps: 0, at };
    };
  }

  const pts = script.waypoints;
  const stops = new Set(script.stops ?? []);
  const step = script.speedMps * (GPS_INTERVAL_MS / 1000);
  let seg = 0; // moving from pts[seg] to pts[seg + 1]
  let along = 0; // metres travelled on that segment
  let pause = stops.has(0) ? (script.pauseTicks ?? 0) : 0;
  let first = true;

  return (at) => {
    if (first) {
      first = false;
    } else if (pause > 0) {
      pause -= 1;
    } else {
      let left = step;
      while (left > 0) {
        const a = pts[seg];
        const b = pts[(seg + 1) % pts.length];
        const len = distanceM(a, b);
        if (along + left < len) {
          along += left;
          left = 0;
        } else {
          left -= len - along;
          seg = (seg + 1) % pts.length;
          along = 0;
          if (stops.has(seg)) {
            pause = script.pauseTicks ?? 0;
            break;
          }
        }
      }
    }
    const a = pts[seg];
    const b = pts[(seg + 1) % pts.length];
    const len = distanceM(a, b);
    const here = lerp(a, b, len ? along / len : 0);
    const moving = pause === 0;
    const accuracyM = fakeAccuracy();
    return {
      ...jitter(here, accuracyM),
      accuracyM,
      speedMps: moving ? +(script.speedMps * (0.85 + Math.random() * 0.3)).toFixed(1) : 0,
      at,
    };
  };
}

export function createSimulatedLocationFeed(): LocationFeed {
  let timer: ReturnType<typeof setInterval> | undefined;

  return {
    source: 'simulated',
    start(onFix) {
      clearInterval(timer);
      const walkers = Object.entries(SCRIPTS).map(([id, script]) => [id, walker(script)] as const);
      const tick = () => {
        const at = Date.now();
        for (const [id, next] of walkers) onFix(id, next(at));
      };
      tick();
      timer = setInterval(tick, GPS_INTERVAL_MS);
    },
    stop() {
      clearInterval(timer);
    },
  };
}
