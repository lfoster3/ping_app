import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import type { Member, Place } from '@/data/types';
import { colors, shadow } from '@/theme';
import LiveMap, { type MapPin, type MapPlace } from './LiveMap';

export type LocatedMember = Member & { location: NonNullable<Member['location']> };

export const hasLocation = (m: Member): m is LocatedMember => m.location !== null;

type Props = {
  focused: LocatedMember;
  others: Member[];
  places: Place[];
  showOthers: boolean;
  highlight?: Place;
  /** Fixed height, or omit to fill the parent (full-screen map). */
  height?: number;
  onRecenter: () => void;
  onToggleLayers: () => void;
  onSelect?: (id: string) => void;
  /** Shows an expand button when set. */
  onExpand?: () => void;
  insetTop?: number;
};

function toPin(m: LocatedMember): MapPin {
  const pos = m.gps?.fix ?? m.location.coords;
  return {
    id: m.id,
    initial: m.name[0],
    name: m.name,
    label: m.location.label,
    bg: m.avatar.bg,
    ink: m.avatar.ink,
    lat: pos.lat,
    lng: pos.lng,
  };
}

/** Real street map you can pan and zoom freely; pins follow the GPS feed. */
export function FamilyMap({ focused, others, places, showOthers, highlight, height, onRecenter, onToggleLayers, onSelect, onExpand, insetTop }: Props) {
  const [measured, setMeasured] = useState(0);
  const [recenterKey, setRecenterKey] = useState(0);
  // Hidden screens (e.g. behind a modal on web) report 0 — keep the last real size.
  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.height;
    if (next > 0) setMeasured(next);
  };
  const h = height ?? measured;

  const pins = useMemo(
    () => [toPin(focused), ...(showOthers ? others.filter(hasLocation).map(toPin) : [])],
    [focused, others, showOthers],
  );
  const mapPlaces = useMemo<MapPlace[]>(
    () => places.map((p) => ({ id: p.id, name: p.name, ...p.coords })),
    [places],
  );

  return (
    <View style={[styles.root, height ? { height } : styles.fill]} onLayout={onLayout}>
      {h > 0 && (
        <LiveMap
          pins={pins}
          focusedId={focused.id}
          places={mapPlaces}
          highlightPlaceId={highlight?.id}
          recenterKey={recenterKey}
          showAll={showOthers}
          height={h}
          insetTop={insetTop}
          onSelect={onSelect ? async (id) => onSelect(id) : undefined}
          dom={{ style: { height: h, width: '100%' }, scrollEnabled: false }}
        />
      )}
      <View style={styles.controls}>
        {onExpand && <MapButton icon="expand-outline" label="Open full map" onPress={onExpand} />}
        <MapButton
          icon="navigate-outline"
          label="Recenter"
          onPress={() => {
            setRecenterKey((k) => k + 1);
            onRecenter();
          }}
        />
        <MapButton
          icon={showOthers ? 'layers' : 'layers-outline'}
          label={showOthers ? 'Hide other family members' : 'Show whole family'}
          onPress={onToggleLayers}
        />
      </View>
    </View>
  );
}

function MapButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.mapBtn, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={18} color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden', backgroundColor: colors.mapLand },
  fill: { flex: 1 },
  // Leaflet's panes use z-index 400+, so overlays need to sit above them.
  controls: { position: 'absolute', right: 12, bottom: 24, gap: 10, zIndex: 1000 },
  mapBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
    shadowOpacity: 0.12,
  },
});
