import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { Member, Place } from '@/data/types';
import { colors, fonts, shadow } from '@/theme';
import { Avatar } from './Avatar';

export type LocatedMember = Member & { location: NonNullable<Member['location']> };

export const hasLocation = (m: Member): m is LocatedMember => m.location !== null;

type Props = {
  focused: LocatedMember;
  others: Member[];
  showOthers: boolean;
  highlight?: Place;
  height?: number;
  onRecenter: () => void;
  onToggleLayers: () => void;
};

const PLACE_ICON: Record<Place['kind'], keyof typeof Ionicons.glyphMap> = {
  home: 'home',
  school: 'school',
  park: 'leaf',
  work: 'briefcase',
};

/**
 * Stylised neighbourhood map. It's a static illustration for now; swap the
 * <Svg> for react-native-maps once real coordinates come from the band.
 */
export function FamilyMap({ focused, others, showOthers, highlight, height = 250, onRecenter, onToggleLayers }: Props) {
  const [w, setW] = useState(0);
  // Hidden screens (e.g. behind a modal on web) report 0 — keep the last real width.
  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    if (next > 0) setW(next);
  };
  const h = height;
  const at = (p: { x: number; y: number }) => ({ left: p.x * w, top: p.y * h });

  return (
    <View style={{ height, overflow: 'hidden', backgroundColor: colors.mapLand }} onLayout={onLayout}>
      {w > 0 && (
        <>
          <MapArt w={w} h={h} />
          {showOthers &&
            others.filter(hasLocation).map((m) => (
              <View key={m.id} style={[styles.otherPin, at(m.location.point)]} pointerEvents="none">
                <Avatar member={m} size={30} showState={false} ring="#fff" />
              </View>
            ))}
          {highlight && (
            <View style={[styles.placePin, at(highlight.point)]} pointerEvents="none">
              <Ionicons name={PLACE_ICON[highlight.kind]} size={14} color="#fff" />
            </View>
          )}
          <FocusedPin member={focused} pos={at(focused.location.point)} mapWidth={w} />
        </>
      )}
      <View style={styles.controls}>
        <MapButton icon="navigate-outline" label="Recenter" onPress={onRecenter} />
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

function FocusedPin({ member, pos, mapWidth }: { member: LocatedMember; pos: { left: number; top: number }; mapWidth: number }) {
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.15] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  // Flip the callout to the left when the member is near the right edge.
  const calloutLeft = pos.left > mapWidth * 0.6;

  return (
    <View style={[styles.anchor, pos]} pointerEvents="none">
      <View style={styles.accuracy} />
      <Animated.View style={[styles.pulse, { opacity, transform: [{ scale }] }]} />
      <View style={styles.dot} />
      <View style={styles.pinHead}>
        <Text style={styles.pinText}>{member.name[0]}</Text>
      </View>
      <View style={[styles.callout, calloutLeft ? { right: 18 } : { left: -10 }]}>
        <View style={styles.calloutIcon}>
          <Ionicons name="navigate" size={11} color={colors.primary} />
        </View>
        <View>
          <Text style={styles.calloutName}>{member.name}</Text>
          <Text style={styles.calloutPlace} numberOfLines={1}>
            {member.location.label}
          </Text>
        </View>
      </View>
    </View>
  );
}

function MapArt({ w, h }: { w: number; h: number }) {
  const blocks: { x: number; y: number; bw: number; bh: number }[] = [];
  const cell = 46;
  for (let gx = -6; gx < 10; gx++) {
    for (let gy = -6; gy < 10; gy++) {
      // Irregular block sizes read as a real street grid rather than graph paper.
      const bw = cell - 10 - ((gx * 7 + gy * 3) % 3) * 4;
      const bh = cell - 10 - ((gx * 5 + gy * 11) % 4) * 3;
      blocks.push({ x: gx * cell, y: gy * cell, bw, bh });
    }
  }
  const cx = w / 2;
  const cy = h / 2;

  const river = `M${w * 0.44},${h + 10} C${w * 0.6},${h * 0.8} ${w * 0.72},${h * 0.72} ${w * 0.84},${h * 0.52} S${w * 0.98},${h * 0.3} ${w + 20},${h * 0.26}`;
  const park = `M${w * 0.68},${-10} L${w + 10},${-10} L${w + 10},${h * 0.4} C${w * 0.92},${h * 0.44} ${w * 0.82},${h * 0.42} ${w * 0.74},${h * 0.34} C${w * 0.66},${h * 0.26} ${w * 0.64},${h * 0.1} ${w * 0.68},${-10} Z`;

  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={w} height={h} fill="#F5F7F3" />
      <G transform={`rotate(-32 ${cx} ${cy})`}>
        <G transform={`translate(${cx - cell * 2} ${cy - cell * 2})`}>
          {blocks.map((b, i) => (
            <Rect key={i} x={b.x} y={b.y} width={b.bw} height={b.bh} rx={4} fill="#E3E9E0" />
          ))}
        </G>
        {/* Main avenue */}
        <Rect x={cx - w} y={cy + 16} width={w * 2} height={12} fill="#FFFFFF" />
        <SvgText
          x={cx - w * 0.28}
          y={cy + 25}
          fontSize={9}
          fill="#8C958A"
          fontFamily={fonts.bodyMedium}>
          Maple Ave
        </SvgText>
      </G>
      <Path d={park} fill={colors.mapPark} />
      <G transform={`translate(${w * 0.86} ${h * 0.13})`}>
        <Path d="M0,-11 L7,0 L3,0 L8,7 L-8,7 L-3,0 L-7,0 Z" fill="#4E9A5C" />
        <Rect x={-1.2} y={7} width={2.4} height={4} fill="#4E9A5C" />
      </G>
      <SvgText x={w * 0.86} y={h * 0.13 + 26} fontSize={10} fill="#4E7F57" textAnchor="middle" fontFamily={fonts.bodyMedium}>
        Riverside
      </SvgText>
      <SvgText x={w * 0.86} y={h * 0.13 + 38} fontSize={10} fill="#4E7F57" textAnchor="middle" fontFamily={fonts.bodyMedium}>
        Park
      </SvgText>
      <Path d={river} stroke="#D5EAFA" strokeWidth={34} fill="none" strokeLinecap="round" />
      <Path d={river} stroke={colors.mapWater} strokeWidth={26} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  controls: { position: 'absolute', right: 12, bottom: 12, gap: 10 },
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
  anchor: { position: 'absolute', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  accuracy: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(79,99,240,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(79,99,240,0.25)',
  },
  pulse: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(79,99,240,0.35)',
  },
  dot: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: '#fff',
  },
  pinHead: {
    position: 'absolute',
    top: -46,
    left: -13,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinText: { fontFamily: fonts.bodyBold, fontSize: 11, color: '#fff' },
  callout: {
    position: 'absolute',
    top: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#fff',
    paddingVertical: 6,
    paddingLeft: 7,
    paddingRight: 12,
    borderRadius: 10,
    minWidth: 120,
    ...shadow.card,
    shadowOpacity: 0.12,
  },
  calloutIcon: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutName: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.ink },
  calloutPlace: { fontFamily: fonts.body, fontSize: 10, color: colors.muted },
  otherPin: { position: 'absolute', marginLeft: -15, marginTop: -15 },
  placePin: {
    position: 'absolute',
    marginLeft: -14,
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.ink,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
