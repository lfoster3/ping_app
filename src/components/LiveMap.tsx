'use dom';

// Real, zoomable street map (Leaflet + OpenStreetMap tiles).
// A DOM component: on web it renders like any other component, on iOS/Android
// Expo runs it inside a WebView. Props must be JSON; callbacks are async.

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

export type MapPin = {
  id: string;
  initial: string;
  name: string;
  /** Short place line, e.g. "Near Home". */
  label: string;
  bg: string;
  ink: string;
  lat: number;
  lng: number;
};

export type MapPlace = { id: string; name: string; lat: number; lng: number };

type Props = {
  /** Everyone to draw; the focused member is always included. */
  pins: MapPin[];
  focusedId: string;
  places: MapPlace[];
  highlightPlaceId?: string;
  /** Bump to fly back to the focused member and resume following them. */
  recenterKey: number;
  /** Fit everyone in view when this turns on. */
  showAll: boolean;
  height: number;
  /** Pushes the zoom buttons below a notch / overlay on full screen. */
  insetTop?: number;
  onSelect?: (id: string) => Promise<void>;
  dom?: import('expo/dom').DOMProps;
};

// OSM's free tiles are fine for development and demos; production traffic
// needs a tile provider (https://operations.osmfoundation.org/policies/tiles/).
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const PRIMARY = '#4F63F0';
const FOLLOW_ZOOM = 17;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** People within this distance share a spot (e.g. everyone at Home). */
const SAME_SPOT_M = 25;
/** Horizontal gap between pins that share a spot. */
const SPREAD_PX = 30;

/** Pixel offset per pin so people in the same place sit side by side instead of stacking. */
function spreadOffsets(pins: MapPin[]): Map<string, number> {
  const groups: MapPin[][] = [];
  for (const p of pins) {
    const group = groups.find((g) => L.latLng(g[0].lat, g[0].lng).distanceTo([p.lat, p.lng]) <= SAME_SPOT_M);
    if (group) group.push(p);
    else groups.push([p]);
  }
  const offsets = new Map<string, number>();
  for (const g of groups) g.forEach((p, i) => offsets.set(p.id, (i - (g.length - 1) / 2) * SPREAD_PX));
  return offsets;
}

function pinHtml(p: MapPin, focused: boolean, offsetPx: number) {
  const avatar = `<div class="ping-avatar${focused ? ' is-focused' : ''}" style="background:${p.bg};color:${p.ink}">${esc(p.initial)}</div>`;
  const body = focused
    ? `<div class="ping-pulse"></div>${avatar}<div class="ping-callout"><b>${esc(p.name)}</b><span>${esc(p.label)}</span></div>`
    : avatar;
  return offsetPx ? `<div class="ping-spread" style="transform:translateX(${offsetPx}px)">${body}</div>` : body;
}

export default function LiveMap({ pins, focusedId, places, highlightPlaceId, recenterKey, showAll, height, insetTop = 0, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, { marker: L.Marker; html: string }>());
  const placeMarkers = useRef(new Map<string, L.Marker>());
  /** Keep the focused member centred until the user drags the map. */
  const following = useRef(true);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const focused = pins.find((p) => p.id === focusedId);

  // Create the map once.
  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: false, zoomSnap: 0.5 });
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(m);
    L.control.zoom({ position: 'topright' }).addTo(m);
    L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(m);
    m.on('dragstart', () => {
      following.current = false;
    });
    // Pins glide between GPS fixes, but must not glide while the map re-zooms.
    m.on('zoomstart', () => el.current?.classList.add('no-glide'));
    m.on('zoomend', () => requestAnimationFrame(() => requestAnimationFrame(() => el.current?.classList.remove('no-glide'))));
    map.current = m;
    const all = markers.current;
    const placesAll = placeMarkers.current;
    return () => {
      m.remove();
      map.current = null;
      all.clear();
      placesAll.clear();
    };
  }, []);

  useEffect(() => {
    map.current?.invalidateSize();
  }, [height]);

  // Member pins.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const seen = new Set<string>();
    const offsets = spreadOffsets(pins);
    for (const p of pins) {
      seen.add(p.id);
      const isFocused = p.id === focusedId;
      const html = pinHtml(p, isFocused, offsets.get(p.id) ?? 0);
      const icon = () =>
        L.divIcon({ html, className: `ping-glide${isFocused ? ' ping-top' : ''}`, iconSize: [0, 0] });
      const existing = markers.current.get(p.id);
      if (!existing) {
        const marker = L.marker([p.lat, p.lng], { icon: icon(), zIndexOffset: isFocused ? 1000 : 0 }).addTo(m);
        marker.on('click', () => onSelectRef.current?.(p.id));
        markers.current.set(p.id, { marker, html });
      } else {
        existing.marker.setLatLng([p.lat, p.lng]);
        if (existing.html !== html) {
          existing.marker.setIcon(icon());
          existing.marker.setZIndexOffset(isFocused ? 1000 : 0);
          existing.html = html;
        }
      }
    }
    for (const [id, { marker }] of markers.current) {
      if (!seen.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }
  }, [pins, focusedId]);

  // Saved places.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    for (const pl of places) {
      const html = `<div class="ping-place${pl.id === highlightPlaceId ? ' is-highlight' : ''}">${esc(pl.name)}</div>`;
      const icon = L.divIcon({ html, className: '', iconSize: [0, 0] });
      const existing = placeMarkers.current.get(pl.id);
      if (existing) existing.setIcon(icon);
      else placeMarkers.current.set(pl.id, L.marker([pl.lat, pl.lng], { icon, interactive: false, zIndexOffset: -500 }).addTo(m));
    }
  }, [places, highlightPlaceId]);

  // Camera: jump to a newly focused member, then follow them.
  useEffect(() => {
    if (!map.current || !focused) return;
    following.current = true;
    map.current.setView([focused.lat, focused.lng], FOLLOW_ZOOM, { animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on focus change
  }, [focusedId]);

  useEffect(() => {
    if (!map.current || !focused || !following.current || showAll) return;
    map.current.panTo([focused.lat, focused.lng], { animate: true, duration: 1.2 });
  }, [focused?.lat, focused?.lng, showAll]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!map.current || !focused || recenterKey === 0) return;
    following.current = true;
    map.current.flyTo([focused.lat, focused.lng], Math.max(map.current.getZoom(), FOLLOW_ZOOM - 1), { duration: 0.8 });
  }, [recenterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!map.current || !showAll || pins.length < 2) return;
    following.current = false;
    map.current.flyToBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng])), { padding: [48, 48], duration: 0.8 });
  }, [showAll]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const place = places.find((p) => p.id === highlightPlaceId);
    if (!map.current || !place) return;
    following.current = false;
    map.current.flyTo([place.lat, place.lng], FOLLOW_ZOOM, { duration: 0.8 });
  }, [highlightPlaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style>{`${CSS} .leaflet-top { top: ${insetTop}px; }`}</style>
      <div ref={el} style={{ width: '100%', height, background: '#EEF1EA' }} />
    </>
  );
}

const CSS = `
html, body { margin: 0; padding: 0; }
.leaflet-container { font-family: Inter, -apple-system, system-ui, sans-serif; }
.ping-glide { transition: transform 1.2s ease-in-out; }
.ping-spread { position: absolute; transition: transform .3s ease-out; }
.no-glide .ping-glide, .leaflet-zoom-anim .ping-glide { transition: none; }
.ping-avatar {
  position: absolute; left: -15px; top: -15px; width: 30px; height: 30px; border-radius: 15px;
  border: 2px solid #fff; box-sizing: border-box; box-shadow: 0 2px 6px rgba(17,24,39,.25);
  display: flex; align-items: center; justify-content: center; font: 600 12px Inter, system-ui, sans-serif; cursor: pointer;
}
.ping-avatar.is-focused { left: -18px; top: -18px; width: 36px; height: 36px; border-radius: 18px; border: 3px solid ${PRIMARY}; font-size: 14px; }
.ping-pulse {
  position: absolute; left: -30px; top: -30px; width: 60px; height: 60px; border-radius: 30px;
  background: rgba(79,99,240,.3); animation: ping-pulse 2.2s ease-out infinite; pointer-events: none;
}
@keyframes ping-pulse { from { transform: scale(.5); opacity: .6; } to { transform: scale(1.2); opacity: 0; } }
.ping-callout {
  position: absolute; left: -12px; top: 24px; background: #fff; border-radius: 10px; padding: 6px 10px;
  box-shadow: 0 4px 12px rgba(17,24,39,.15); white-space: nowrap; display: flex; flex-direction: column;
  font: 400 11px Inter, system-ui, sans-serif; color: #6B7280; pointer-events: none;
}
.ping-callout b { font-weight: 600; color: #111827; }
.ping-place {
  position: absolute; transform: translate(-50%, -50%); background: rgba(255,255,255,.92); color: #374151;
  border-radius: 999px; padding: 3px 8px; font: 600 10.5px Inter, system-ui, sans-serif; white-space: nowrap;
  box-shadow: 0 1px 4px rgba(17,24,39,.15);
}
.ping-place.is-highlight { background: #111827; color: #fff; }
.leaflet-bar { border: none !important; box-shadow: 0 2px 8px rgba(17,24,39,.15) !important; border-radius: 12px !important; overflow: hidden; }
.leaflet-bar a { width: 36px !important; height: 36px !important; line-height: 36px !important; color: #111827 !important; font-size: 20px !important; }
.leaflet-control-attribution { font-size: 9px; background: rgba(255,255,255,.75) !important; }
`;
