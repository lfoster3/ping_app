import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { HeartRateMonitor, HeartRateReading, MonitorStatus } from '@/devices/heartRate';
import { distanceM, type LocationFix } from '@/devices/location';
import { createMonitor } from '@/devices/monitor';
import { createSimulatedLocationFeed } from '@/devices/simulatedLocation';
import { createSimulatedMonitor } from '@/devices/simulated';
import { emptyZoneCounts, minutesSince, zoneOf, type ZoneCounts } from './format';
import { initialAlerts, initialMembers, LOADED_AT, NOW_MIN, pedroProfile, places } from './mock';
import { baseline, overnightHeart, RESTING_ALERT_BPM } from './pedroHistory';
import type { AlertItem, GpsInfo, LiveSource, Member, Place, SentPing, Visit } from './types';

/** Pedro's day chart uses 5-minute buckets so a demo shows a real line quickly. */
const LIVE_SLOT_MIN = 5;
/** How much raw signal the live trace keeps. */
const RECENT_MS = 90_000;
/** No reading for this long while "connected" means the watch lost contact. */
const STALE_MS = 15_000;

type LiveState = {
  source: LiveSource | null;
  status: MonitorStatus;
  deviceName?: string;
  error?: string;
  latest: HeartRateReading | null;
  recent: { at: number; bpm: number }[];
  /** Today's readings per LIVE_SLOT_MIN bucket. */
  buckets: Record<number, { sum: number; count: number }>;
  zoneCounts: ZoneCounts;
  day: string;
};

const dayKey = (t = Date.now()) => new Date(t).toDateString();
const slotOf = (t: number) => {
  const d = new Date(t);
  return Math.floor((d.getHours() * 60 + d.getMinutes()) / LIVE_SLOT_MIN);
};

const initialLive = (): LiveState => ({
  source: null,
  status: 'idle',
  latest: null,
  recent: [],
  buckets: {},
  zoneCounts: emptyZoneCounts(),
  day: dayKey(),
});

function addReading(prev: LiveState, r: HeartRateReading): LiveState {
  // Start a fresh day of history at midnight.
  const base = prev.day === dayKey(r.at) ? prev : { ...prev, buckets: {}, zoneCounts: emptyZoneCounts(), day: dayKey(r.at) };
  const slot = slotOf(r.at);
  const b = base.buckets[slot] ?? { sum: 0, count: 0 };
  const zone = zoneOf(r.bpm).id;
  return {
    ...base,
    latest: r,
    recent: [...base.recent.filter((s) => r.at - s.at <= RECENT_MS), { at: r.at, bpm: r.bpm }],
    buckets: { ...base.buckets, [slot]: { sum: b.sum + r.bpm, count: b.count + 1 } },
    zoneCounts: { ...base.zoneCounts, [zone]: base.zoneCounts[zone] + 1 },
  };
}

/** Turns the live stream into a regular family member the screens can render. */
function buildPedro(live: LiveState, now: number): Member {
  const { latest } = live;
  const stale = !latest || now - latest.at > STALE_MS;
  const label = live.source === 'simulated' ? 'Simulated signal' : live.deviceName ?? 'Garmin';

  let state: Member['state'] = 'offline';
  let activity = 'Garmin not connected';
  if (live.status === 'connecting') activity = 'Connecting to Garmin…';
  else if (live.status === 'reconnecting') activity = 'Reconnecting to Garmin…';
  else if (live.status === 'error') activity = 'Garmin connection failed';
  else if (live.status === 'connected' && stale) activity = 'Waiting for heart rate…';
  else if (live.status === 'connected' && latest) {
    activity = `Live · ${label}`;
    state = latest.bpm >= 151 ? 'attention' : latest.bpm > 100 ? 'active' : 'ok';
  } else if (latest) activity = 'Garmin disconnected';

  // When the watch isn't streaming, fall back to the real overnight trend.
  const resting = baseline(overnightHeart, (r) => r.resting);
  if (state === 'offline' && live.status === 'idle' && resting.delta >= RESTING_ALERT_BPM) {
    state = 'attention';
    activity = `Resting heart rate above usual (${resting.value} vs ${resting.usual})`;
  }

  const slots = Object.keys(live.buckets).map(Number);
  const first = slots.length ? Math.min(...slots) : 0;
  const last = slots.length ? Math.max(...slots) : -1;
  const history: (number | null)[] = [];
  for (let s = first; s <= last; s++) {
    const b = live.buckets[s];
    history.push(b ? Math.round(b.sum / b.count) : null);
  }

  return {
    ...pedroProfile,
    state,
    activity,
    lastSyncMin: latest ? Math.floor((now - latest.at) / 60000) : Number.POSITIVE_INFINITY,
    heartRate: latest?.bpm ?? null,
    heartRateHistory: history,
    historySlotMin: LIVE_SLOT_MIN,
    historyStartSlot: first,
    battery: null,
    location: null,
    visits: [],
    realHistory: true,
    live: {
      source: live.source,
      status: live.status,
      deviceName: live.deviceName,
      error: live.error,
      recent: live.recent,
      zoneCounts: live.zoneCounts,
    },
  };
}

/** Within this distance of a saved place counts as being there. */
const AT_PLACE_M = 75;

function nearestPlace(fix: LocationFix) {
  let nearest: { place: Place; d: number } | null = null;
  for (const place of places) {
    const d = distanceM(fix, place.coords);
    if (!nearest || d < nearest.d) nearest = { place, d };
  }
  return nearest;
}

/** "At home", "Near Riverside Park" or "On the move" from the nearest saved place. */
function placeLabel(fix: LocationFix): string {
  const nearest = nearestPlace(fix);
  if (nearest && nearest.d <= AT_PLACE_M) return nearest.place.name === 'Home' ? 'At home' : `At ${nearest.place.name}`;
  if (nearest && nearest.d <= 250) return `Near ${nearest.place.name}`;
  return fix.speedMps > 0.5 ? 'On the move' : 'Out';
}

/** Same timeline as the mock visits: minutes since midnight of the day the app opened. */
const minuteOf = (at: number) => NOW_MIN + Math.floor((at - LOADED_AT) / 60_000);

/** Closes the open visit when they leave, and opens one when they arrive somewhere. */
function trackVisits(visits: Visit[], fix: LocationFix): Visit[] {
  const nearest = nearestPlace(fix);
  const placeId = nearest && nearest.d <= AT_PLACE_M ? nearest.place.id : null;
  const open = visits.find((v) => v.to === null);
  if (open?.placeId === placeId) return visits;
  const min = minuteOf(fix.at);
  let next = open ? visits.map((v) => (v === open ? { ...v, to: min } : v)) : visits;
  if (placeId) next = [...next, { placeId, from: min, to: null }];
  return next;
}

function withGps(m: Member, gps: GpsInfo | undefined, visits: Visit[] | undefined): Member {
  if (!gps) return m;
  return {
    ...m,
    gps,
    visits: visits ?? m.visits,
    // Each fix is the band checking in.
    lastSyncMin: Math.min(m.lastSyncMin, minutesSince(gps.fix.at)),
    location: { label: placeLabel(gps.fix), coords: { lat: gps.fix.lat, lng: gps.fix.lng } },
  };
}

type FamilyContextValue = {
  members: Member[];
  places: Place[];
  alerts: AlertItem[];
  pings: SentPing[];
  /** The member the Map and Trends tabs are focused on. */
  focusedId: string;
  focused: Member;
  focus: (id: string) => void;
  memberById: (id: string) => Member | undefined;
  placeById: (id: string) => Place | undefined;
  sendPing: (to: string[], message: string, withVitals: boolean) => SentPing;
  markAlertsRead: () => void;
  unreadAlerts: number;
  /** Why real Bluetooth can't work here (e.g. Safari, Expo Go), or null. */
  garminUnsupported: string | null;
  /** Call directly from a button press. */
  connectLive: (source: LiveSource) => void;
  disconnectLive: () => void;
};

const FamilyContext = createContext<FamilyContextValue | null>(null);

export function FamilyProvider({ children }: { children: ReactNode }) {
  const [members] = useState(initialMembers);
  const [alerts] = useState(initialAlerts);
  const [readAlertIds, setReadAlertIds] = useState<Set<string>>(new Set());
  const [pings, setPings] = useState<SentPing[]>([]);
  const [focusedId, setFocusedId] = useState('nico');

  const [gps, setGps] = useState<Record<string, GpsInfo>>({});
  const [visits, setVisits] = useState<Record<string, Visit[]>>(() =>
    Object.fromEntries(initialMembers.map((m) => [m.id, m.visits])),
  );
  const [live, setLive] = useState(initialLive);
  const [now, setNow] = useState(() => Date.now());
  const [garmin] = useState(createMonitor);
  const monitorRef = useRef<HeartRateMonitor | null>(null);
  const [garminUnsupported] = useState(() => garmin.unsupportedReason());

  // Re-evaluate "stale" and "x min ago" even when no readings arrive.
  useEffect(() => {
    if (live.status === 'idle') return;
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, [live.status]);

  useEffect(() => () => monitorRef.current?.disconnect(), []);

  // Positions for everyone, every GPS_INTERVAL_MS. Swap in the real feed here.
  useEffect(() => {
    const feed = createSimulatedLocationFeed();
    feed.start((memberId, fix) => {
      setGps((prev) => ({ ...prev, [memberId]: { source: feed.source, fix } }));
      setVisits((prev) => {
        const before = prev[memberId] ?? [];
        const after = trackVisits(before, fix);
        return after === before ? prev : { ...prev, [memberId]: after };
      });
    });
    return () => feed.stop();
  }, []);

  const connectLive = useCallback(
    (source: LiveSource) => {
      monitorRef.current?.disconnect();
      const monitor = source === 'garmin' ? garmin : createSimulatedMonitor();
      monitorRef.current = monitor;
      setLive((prev) => ({ ...prev, source, status: 'connecting', error: undefined }));
      // Ignore late events from a monitor the user has since replaced.
      const isCurrent = () => monitorRef.current === monitor;
      // No awaits before connect(): Web Bluetooth needs the original tap.
      monitor
        .connect({
          onReading: (r) => {
            if (!isCurrent()) return;
            setNow(r.at);
            setLive((prev) => addReading(prev, r));
          },
          onStatus: (status, detail) => {
            if (!isCurrent()) return;
            setLive((prev) => ({ ...prev, status, deviceName: status === 'connected' && detail ? detail : prev.deviceName }));
          },
        })
        .then(({ name }) => isCurrent() && setLive((prev) => ({ ...prev, deviceName: name })))
        .catch((e: unknown) => {
          if (!isCurrent()) return;
          const err = e as { name?: string; message?: string };
          // Closing the browser's device chooser isn't an error worth showing.
          const cancelled = err?.name === 'NotFoundError';
          setLive((prev) => ({
            ...prev,
            status: cancelled ? 'idle' : 'error',
            error: cancelled ? undefined : err?.message ?? 'Couldn’t connect.',
          }));
        });
    },
    [garmin],
  );

  const disconnectLive = useCallback(() => {
    monitorRef.current?.disconnect();
    monitorRef.current = null;
    setLive((prev) => ({ ...prev, status: 'idle', error: undefined }));
  }, []);

  const pedro = useMemo(() => buildPedro(live, now), [live, now]);
  const allMembers = useMemo(
    () => [...members, pedro].map((m) => withGps(m, gps[m.id], visits[m.id])),
    [members, pedro, gps, visits],
  );

  const memberById = useCallback((id: string) => allMembers.find((m) => m.id === id), [allMembers]);
  const placeById = useCallback((id: string) => places.find((p) => p.id === id), []);

  const sendPing = useCallback((to: string[], message: string, withVitals: boolean) => {
    // TODO: POST to the ping service once the backend exists.
    const ping: SentPing = { id: String(Date.now()), to, message, withVitals, sentAt: Date.now() };
    setPings((prev) => [ping, ...prev]);
    return ping;
  }, []);

  const markAlertsRead = useCallback(() => {
    setReadAlertIds(new Set(alerts.map((a) => a.id)));
  }, [alerts]);

  const value = useMemo<FamilyContextValue>(
    () => ({
      members: allMembers,
      places,
      alerts,
      pings,
      focusedId,
      focused: allMembers.find((m) => m.id === focusedId) ?? allMembers[0],
      focus: setFocusedId,
      memberById,
      placeById,
      sendPing,
      markAlertsRead,
      unreadAlerts: alerts.filter((a) => !readAlertIds.has(a.id)).length,
      garminUnsupported,
      connectLive,
      disconnectLive,
    }),
    [allMembers, alerts, pings, focusedId, memberById, placeById, sendPing, markAlertsRead, readAlertIds, garminUnsupported, connectLive, disconnectLive],
  );

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error('useFamily must be used inside <FamilyProvider>');
  return ctx;
}
