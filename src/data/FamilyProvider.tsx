import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { HeartRateMonitor, HeartRateReading, MonitorStatus } from '@/devices/heartRate';
import { distanceM, type LocationFix } from '@/devices/location';
import { createMonitor } from '@/devices/monitor';
import { createSimulatedLocationFeed } from '@/devices/simulatedLocation';
import { createSimulatedMonitor } from '@/devices/simulated';
import { createSimulatedEsp32Feed, createWebSocketEsp32Feed, type Esp32Feed } from '@/devices/esp32';
import { emptyZoneCounts, minutesSince, zoneOf, type ZoneCounts } from './format';
import { DEFAULT_ME_ID, initialAlerts, initialMembers, LOADED_AT, NOW_MIN, nicoProfile, pedroProfile, places } from './mock';
import { baseline, overnightHeart, RESTING_ALERT_BPM } from './pedroHistory';
import type { AlertItem, GpsInfo, LiveSource, Member, Place, SentPing, Visit } from './types';

/** Day chart uses 5-minute buckets so a demo shows a real line quickly. */
const LIVE_SLOT_MIN = 5;
/** How much raw signal the live trace keeps. */
const RECENT_MS = 90_000;
/** No reading for this long while "connected" means the sensor lost contact. */
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

/** Build a history array from live buckets. */
function historyFromBuckets(buckets: LiveState['buckets']): { history: (number | null)[]; first: number } {
  const slots = Object.keys(buckets).map(Number);
  const first = slots.length ? Math.min(...slots) : 0;
  const last = slots.length ? Math.max(...slots) : -1;
  const history: (number | null)[] = [];
  for (let s = first; s <= last; s++) {
    const b = buckets[s];
    history.push(b ? Math.round(b.sum / b.count) : null);
  }
  return { history, first };
}

/** Turns Pedro's BLE stream into a Member the screens can render. */
function buildPedro(live: LiveState, now: number): Member {
  const { latest } = live;
  const stale = !latest || now - latest.at > STALE_MS;
  const label = live.source === 'simulated' ? 'Simulated signal' : live.deviceName ?? 'WHOOP';

  let state: Member['state'] = 'offline';
  let activity = 'WHOOP not connected';
  if (live.status === 'connecting') activity = 'Connecting to WHOOP…';
  else if (live.status === 'reconnecting') activity = 'Reconnecting to WHOOP…';
  else if (live.status === 'error') activity = 'WHOOP connection failed';
  else if (live.status === 'connected' && stale) activity = 'Waiting for heart rate…';
  else if (live.status === 'connected' && latest) {
    activity = `Live · ${label}`;
    state = latest.bpm >= 151 ? 'attention' : latest.bpm > 100 ? 'active' : 'ok';
  } else if (latest) activity = 'WHOOP disconnected';

  // When the watch isn't streaming, fall back to the real overnight trend.
  const resting = baseline(overnightHeart, (r) => r.resting);
  if (state === 'offline' && live.status === 'idle' && resting.delta >= RESTING_ALERT_BPM) {
    state = 'attention';
    activity = `Resting heart rate above usual (${resting.value} vs ${resting.usual})`;
  }

  const { history, first } = historyFromBuckets(live.buckets);

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

/** Turns Nico's ESP32 stream into a Member the screens can render. */
function buildNico(live: LiveState, now: number): Member {
  const { latest } = live;
  const stale = !latest || now - latest.at > STALE_MS;
  const label = live.source === 'simulated' ? 'Simulated signal' : live.deviceName ?? 'ESP32';

  let state: Member['state'] = 'offline';
  let activity = 'Sensor not connected';
  if (live.status === 'connecting') activity = 'Connecting to sensor…';
  else if (live.status === 'reconnecting') activity = 'Reconnecting to sensor…';
  else if (live.status === 'error') activity = 'Sensor connection failed';
  else if (live.status === 'connected' && stale) activity = 'Waiting for heart rate…';
  else if (live.status === 'connected' && latest) {
    activity = `Live · ${label}`;
    state = latest.bpm >= 151 ? 'attention' : latest.bpm > 100 ? 'active' : 'ok';
  } else if (latest) activity = 'Sensor disconnected';

  const { history, first } = historyFromBuckets(live.buckets);

  return {
    ...nicoProfile,
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

const ME_KEY = 'ping.meId';

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
  /** Who this phone is signed in as. There are no accounts yet, so it's picked in Settings. */
  meId: string;
  me: Member;
  setMeId: (id: string) => void;
  /** Why real Bluetooth can't work here (e.g. Safari, Expo Go), or null. */
  bleUnsupported: string | null;
  /** Connect Pedro's WHOOP over BLE (or simulated signal). */
  connectBle: (source: 'ble' | 'simulated') => void;
  disconnectBle: () => void;
  /** Connect Nico's ESP32 sensor. No arg = real hardware via bridge; 'simulated' for fake data. */
  connectEsp32: (mode?: 'simulated') => void;
  disconnectEsp32: () => void;
};

const FamilyContext = createContext<FamilyContextValue | null>(null);

export function FamilyProvider({ children }: { children: ReactNode }) {
  const [members] = useState(initialMembers);
  const [alerts] = useState(initialAlerts);
  const [readAlertIds, setReadAlertIds] = useState<Set<string>>(new Set());
  const [pings, setPings] = useState<SentPing[]>([]);
  const [meId, setMeIdState] = useState(DEFAULT_ME_ID);
  const [focusedId, setFocusedId] = useState('nico');

  const [gps, setGps] = useState<Record<string, GpsInfo>>({});
  const [visits, setVisits] = useState<Record<string, Visit[]>>(() =>
    Object.fromEntries(initialMembers.map((m) => [m.id, m.visits])),
  );

  // ── Pedro: BLE heart rate (WHOOP) ──────────────────────────────
  const [pedroLive, setPedroLive] = useState(initialLive);
  const [bleMonitor] = useState(createMonitor);
  const bleRef = useRef<HeartRateMonitor | null>(null);
  const [bleUnsupported] = useState(() => bleMonitor.unsupportedReason());

  // ── Nico: ESP32 over Wi-Fi (HR + GPS) ─────────────────────────
  const [nicoLive, setNicoLive] = useState(initialLive);
  const esp32Ref = useRef<Esp32Feed | null>(null);

  const [now, setNow] = useState(() => Date.now());

  // Re-evaluate "stale" and "x min ago" even when no readings arrive.
  useEffect(() => {
    if (pedroLive.status === 'idle' && nicoLive.status === 'idle') return;
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, [pedroLive.status, nicoLive.status]);

  // Clean up monitors on unmount.
  useEffect(() => () => {
    bleRef.current?.disconnect();
    esp32Ref.current?.disconnect();
  }, []);

  // Simulated GPS for mock members (mom, dad, luke) + fallback for pedro/nico.
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

  // ── Pedro BLE connection ──────────────────────────────────────
  const connectBle = useCallback(
    (source: 'ble' | 'simulated') => {
      bleRef.current?.disconnect();
      const monitor = source === 'ble' ? bleMonitor : createSimulatedMonitor();
      bleRef.current = monitor;
      setPedroLive((prev) => ({ ...prev, source, status: 'connecting', error: undefined }));
      const isCurrent = () => bleRef.current === monitor;
      monitor
        .connect({
          onReading: (r) => {
            if (!isCurrent()) return;
            setNow(r.at);
            setPedroLive((prev) => addReading(prev, r));
          },
          onStatus: (status, detail) => {
            if (!isCurrent()) return;
            setPedroLive((prev) => ({ ...prev, status, deviceName: status === 'connected' && detail ? detail : prev.deviceName }));
          },
        })
        .then(({ name }) => isCurrent() && setPedroLive((prev) => ({ ...prev, deviceName: name })))
        .catch((e: unknown) => {
          if (!isCurrent()) return;
          const err = e as { name?: string; message?: string };
          const cancelled = err?.name === 'NotFoundError';
          setPedroLive((prev) => ({
            ...prev,
            status: cancelled ? 'idle' : 'error',
            error: cancelled ? undefined : err?.message ?? 'Couldn\u2019t connect.',
          }));
        });
    },
    [bleMonitor],
  );

  const disconnectBle = useCallback(() => {
    bleRef.current?.disconnect();
    bleRef.current = null;
    setPedroLive((prev) => ({ ...prev, status: 'idle', error: undefined }));
  }, []);

  // ── Nico ESP32 connection ─────────────────────────────────────
  const connectEsp32 = useCallback((mode?: 'simulated') => {
    esp32Ref.current?.disconnect();
    const feed = mode === 'simulated' ? createSimulatedEsp32Feed() : createWebSocketEsp32Feed();
    esp32Ref.current = feed;
    setNicoLive((prev) => ({ ...prev, source: 'esp32', status: 'connecting', error: undefined }));
    const isCurrent = () => esp32Ref.current === feed;
    feed
      .connect({
        onHr: (r) => {
          if (!isCurrent()) return;
          setNow(r.at);
          setNicoLive((prev) => addReading(prev, r));
        },
        onGps: (fix) => {
          if (!isCurrent()) return;
          setGps((prev) => ({ ...prev, nico: { source: 'gps', fix } }));
          setVisits((prev) => {
            const before = prev.nico ?? [];
            const after = trackVisits(before, fix);
            return after === before ? prev : { ...prev, nico: after };
          });
        },
        onStatus: (status, detail) => {
          if (!isCurrent()) return;
          setNicoLive((prev) => ({ ...prev, status, deviceName: status === 'connected' && detail ? detail : prev.deviceName }));
        },
      })
      .then(({ name }) => isCurrent() && setNicoLive((prev) => ({ ...prev, deviceName: name })))
      .catch((e: unknown) => {
        if (!isCurrent()) return;
        const err = e as { message?: string };
        setNicoLive((prev) => ({
          ...prev,
          status: 'error',
          error: err?.message ?? 'Couldn\u2019t connect to ESP32.',
        }));
      });
  }, []);

  const disconnectEsp32 = useCallback(() => {
    esp32Ref.current?.disconnect();
    esp32Ref.current = null;
    setNicoLive((prev) => ({ ...prev, status: 'idle', error: undefined }));
  }, []);

  // ── Build live members ────────────────────────────────────────
  const pedro = useMemo(() => buildPedro(pedroLive, now), [pedroLive, now]);
  const nico = useMemo(() => buildNico(nicoLive, now), [nicoLive, now]);
  const allMembers = useMemo(
    () => [...members, pedro, nico].map((m) => withGps(m, gps[m.id], visits[m.id])),
    [members, pedro, nico, gps, visits],
  );

  const memberById = useCallback((id: string) => allMembers.find((m) => m.id === id), [allMembers]);
  const placeById = useCallback((id: string) => places.find((p) => p.id === id), []);

  const sendPing = useCallback((to: string[], message: string, withVitals: boolean) => {
    const ping: SentPing = { id: String(Date.now()), to, message, withVitals, sentAt: Date.now() };
    setPings((prev) => [ping, ...prev]);
    return ping;
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(ME_KEY)
      .then((id) => id && setMeIdState(id))
      .catch(() => {});
  }, []);

  const setMeId = useCallback((id: string) => {
    setMeIdState(id);
    AsyncStorage.setItem(ME_KEY, id).catch(() => {});
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
      meId,
      me: allMembers.find((m) => m.id === meId) ?? allMembers[0],
      setMeId,
      bleUnsupported,
      connectBle,
      disconnectBle,
      connectEsp32,
      disconnectEsp32,
    }),
    [
      allMembers, alerts, pings, focusedId, memberById, placeById, sendPing, markAlertsRead, readAlertIds,
      meId, setMeId,
      bleUnsupported, connectBle, disconnectBle, connectEsp32, disconnectEsp32,
    ],
  );

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error('useFamily must be used inside <FamilyProvider>');
  return ctx;
}
