import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { FamilyMap, hasLocation } from '@/components/FamilyMap';
import { MemberPicker } from '@/components/MemberPicker';
import { Screen, ScreenHeader } from '@/components/Screen';
import { useFamily } from '@/data/FamilyProvider';
import { GPS_INTERVAL_MS, GPS_TARGET_ACCURACY_M } from '@/devices/location';
import { ago, clock, statusLine } from '@/data/format';
import type { GpsInfo, Member, Place } from '@/data/types';
import { colors, fonts, space } from '@/theme';

const PLACE_ICON: Record<Place['kind'], keyof typeof Ionicons.glyphMap> = {
  home: 'home',
  school: 'business',
  park: 'leaf',
  work: 'briefcase',
};

export default function MapScreen() {
  const { focused, members, places, placeById, focus } = useFamily();
  const [picking, setPicking] = useState(false);
  const [showOthers, setShowOthers] = useState(false);
  const [highlightId, setHighlightId] = useState<string>();

  const visits = [...focused.visits].sort((a, b) => b.from - a.from);

  return (
    <Screen>
      <ScreenHeader
        icon={<Ionicons name="location" size={26} color={colors.primary} />}
        title="Location"
        subtitle="Live location & movement"
      />

      <Card style={styles.mapCard}>
        <MemberRow member={focused} onPress={() => setPicking(true)} />
        {hasLocation(focused) ? (
          <FamilyMap
            focused={focused}
            others={members.filter((m) => m.id !== focused.id)}
            places={places}
            showOthers={showOthers}
            highlight={highlightId ? placeById(highlightId) : undefined}
            height={300}
            onRecenter={() => setHighlightId(undefined)}
            onToggleLayers={() => setShowOthers((v) => !v)}
            onSelect={focus}
            onExpand={() => router.push('/map-full')}
          />
        ) : (
          <View style={styles.noLocation}>
            <Ionicons name="location-outline" size={28} color={colors.faint} />
            <Text style={styles.noLocTitle}>{focused.name} isn&apos;t sharing location yet</Text>
            <Text style={styles.noLocBody}>
              {focused.live ? 'Their Garmin only streams heart rate for now.' : 'Location will appear once their band syncs.'}
            </Text>
            {focused.live && (
              <Pressable onPress={() => router.navigate('/trends')} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.noLocLink}>See live heart rate</Text>
              </Pressable>
            )}
          </View>
        )}
      </Card>

      {focused.gps && <GpsCard gps={focused.gps} />}

      {focused.location && (
        <Card style={styles.timeline}>
          <TimelineRow
            icon="location"
            iconBg={colors.greenSoft}
            iconColor={colors.green}
            title="Last seen"
            subtitle={focused.location.label}
            trailing={focused.gps ? timeOfDay(focused.gps.fix.at) : ago(focused.lastSyncMin)}
            first
          />
          {visits.map((v) => {
            const place = placeById(v.placeId);
            if (!place) return null;
            const selected = highlightId === place.id;
            return (
              <TimelineRow
                key={`${v.placeId}-${v.from}`}
                icon={PLACE_ICON[place.kind]}
                iconBg={selected ? colors.primarySoft : '#F1F3F8'}
                iconColor={selected ? colors.primary : colors.inkSoft}
                title={place.name}
                subtitle={v.to === null ? `Since ${clock(v.from)}` : `${clock(v.from)} – ${clock(v.to)}`}
                onPress={() => setHighlightId(selected ? undefined : place.id)}
                selected={selected}
              />
            );
          })}
        </Card>
      )}

      <MemberPicker visible={picking} onClose={() => setPicking(false)} />
    </Screen>
  );
}

/** Wall-clock time with seconds, e.g. "4:12:30 PM". */
const timeOfDay = (at: number) =>
  new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });

/** Seconds since the last fix, re-rendered every second. */
function useSecondsSince(at: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return Math.max(0, Math.floor((now - at) / 1000));
}

function GpsCard({ gps }: { gps: GpsInfo }) {
  const { fix } = gps;
  const age = useSecondsSince(fix.at);
  const interval = GPS_INTERVAL_MS / 1000;
  // Three missed fixes in a row means the feed has stalled.
  const stale = age > interval * 3;
  const kmh = Math.round(fix.speedMps * 3.6);
  return (
    <Card style={styles.gps}>
      <View style={styles.gpsHead}>
        <View style={[styles.tlIcon, { backgroundColor: stale ? '#F1F3F8' : colors.primarySoft }]}>
          <Ionicons name="navigate" size={15} color={stale ? colors.faint : colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tlTitle}>{gps.source === 'simulated' ? 'Simulated GPS' : 'Live GPS'}</Text>
          <Text style={styles.tlSub}>Updates every {interval} s</Text>
        </View>
        <Text style={[styles.gpsAge, stale && { color: colors.amberInk }]}>
          {age < 2 ? 'Just now' : stale ? `No fix for ${age} s` : `${age} s ago`}
        </Text>
      </View>
      <View style={styles.gpsBar}>
        <View style={[styles.gpsBarFill, { width: `${Math.min(1, age / interval) * 100}%` }]} />
      </View>
      <View style={styles.gpsStats}>
        <GpsStat label="Speed" value={kmh > 0 ? `${kmh} km/h` : 'Still'} />
        <GpsStat
          label="Accuracy"
          value={`±${fix.accuracyM} m`}
          warn={fix.accuracyM > GPS_TARGET_ACCURACY_M}
        />
        <GpsStat label="Position" value={`${fix.lat.toFixed(4)}, ${fix.lng.toFixed(4)}`} wide />
      </View>
    </Card>
  );
}

function GpsStat({ label, value, wide, warn }: { label: string; value: string; wide?: boolean; warn?: boolean }) {
  return (
    <View style={[styles.gpsStat, wide && { flex: 2 }]}>
      <Text style={styles.gpsStatLabel}>{label}</Text>
      <Text style={[styles.gpsStatValue, warn && { color: colors.amberInk }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function MemberRow({ member, onPress }: { member: Member; onPress: () => void }) {
  const live = member.live ? member.live.status === 'connected' && member.heartRate !== null : member.lastSyncMin <= 5;
  const lowBattery = member.battery !== null && member.battery < 20;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Showing ${member.name}. Tap to switch family member`}
      style={({ pressed }) => [styles.memberRow, pressed && { opacity: 0.7 }]}>
      <Avatar member={member} size={40} />
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <Text style={styles.memberName}>{member.name}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.faint} />
        </View>
        <View style={styles.liveRow}>
          <View style={[styles.liveDot, { backgroundColor: live ? colors.green : colors.faint }]} />
          <Text style={styles.liveText}>
            {member.live ? statusLine(member) : `${live ? 'Live' : 'Updated'} · ${ago(member.lastSyncMin)}`}
          </Text>
        </View>
      </View>
      {member.battery !== null && (
        <View style={styles.battery}>
          <Ionicons
            name={lowBattery ? 'battery-dead-outline' : member.battery > 60 ? 'battery-full-outline' : 'battery-half-outline'}
            size={18}
            color={lowBattery ? colors.red : colors.green}
          />
          <Text style={styles.batteryText}>{member.battery}%</Text>
        </View>
      )}
    </Pressable>
  );
}

type RowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  trailing?: string;
  first?: boolean;
  selected?: boolean;
  onPress?: () => void;
};

function TimelineRow({ icon, iconBg, iconColor, title, subtitle, trailing, first, selected, onPress }: RowProps) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected } : undefined}
      style={({ pressed }) => [styles.tlRow, pressed && { opacity: 0.6 }]}>
      <View style={styles.tlRail}>
        {!first && <View style={[styles.tlLine, { top: 0, height: 10 }]} />}
        <View style={[styles.tlIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={15} color={iconColor} />
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.tlTitle}>{title}</Text>
        <Text style={styles.tlSub}>{subtitle}</Text>
      </View>
      {trailing ? (
        <Text style={styles.tlTrailing}>{trailing}</Text>
      ) : (
        <Ionicons name={selected ? 'eye' : 'chevron-forward'} size={16} color={selected ? colors.primary : colors.faint} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mapCard: { overflow: 'hidden' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  memberName: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
  battery: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  batteryText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted },
  noLocation: { height: 220, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: space.xl, backgroundColor: '#F8F9FC' },
  noLocTitle: { fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.ink, marginTop: 4, textAlign: 'center' },
  noLocBody: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, textAlign: 'center' },
  noLocLink: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.primary, marginTop: 6 },
  gps: { marginTop: space.md, padding: space.lg },
  gpsHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  gpsAge: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted },
  gpsBar: { height: 3, borderRadius: 2, backgroundColor: '#F1F3F8', marginTop: space.md, overflow: 'hidden' },
  gpsBarFill: { height: 3, backgroundColor: colors.primary },
  gpsStats: { flexDirection: 'row', marginTop: space.md, gap: space.md },
  gpsStat: { flex: 1 },
  gpsStatLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  gpsStatValue: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.ink, marginTop: 2 },
  timeline: { marginTop: space.md, paddingVertical: space.sm, paddingHorizontal: space.lg },
  tlRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
  tlRail: { width: 30, alignItems: 'center' },
  tlLine: { position: 'absolute', width: 1.5, backgroundColor: colors.border, marginTop: -14 },
  tlIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tlTitle: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.ink },
  tlSub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 1 },
  tlTrailing: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
});
