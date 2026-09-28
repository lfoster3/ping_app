import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { FamilyMap, hasLocation } from '@/components/FamilyMap';
import { MemberPicker } from '@/components/MemberPicker';
import { Screen, ScreenHeader } from '@/components/Screen';
import { useFamily } from '@/data/FamilyProvider';
import { ago, clock, statusLine } from '@/data/format';
import { NOW_MIN } from '@/data/mock';
import type { Member, Place } from '@/data/types';
import { colors, fonts, space } from '@/theme';

const PLACE_ICON: Record<Place['kind'], keyof typeof Ionicons.glyphMap> = {
  home: 'home',
  school: 'business',
  park: 'leaf',
  work: 'briefcase',
};

export default function MapScreen() {
  const { focused, members, placeById } = useFamily();
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
            showOthers={showOthers}
            highlight={highlightId ? placeById(highlightId) : undefined}
            onRecenter={() => setHighlightId(undefined)}
            onToggleLayers={() => setShowOthers((v) => !v)}
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

      {focused.location && (
        <Card style={styles.timeline}>
          <TimelineRow
            icon="location"
            iconBg={colors.greenSoft}
            iconColor={colors.green}
            title="Last seen"
            subtitle={focused.location.label}
            trailing={ago(focused.lastSyncMin)}
            first
          />
          {visits.map((v) => {
            const place = placeById(v.placeId);
            if (!place) return null;
            const ongoing = v.to >= NOW_MIN;
            const selected = highlightId === place.id;
            return (
              <TimelineRow
                key={`${v.placeId}-${v.from}`}
                icon={PLACE_ICON[place.kind]}
                iconBg={selected ? colors.primarySoft : '#F1F3F8'}
                iconColor={selected ? colors.primary : colors.inkSoft}
                title={place.name}
                subtitle={ongoing ? `Since ${clock(v.from)}` : `${clock(v.from)} – ${clock(v.to)}`}
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
  timeline: { marginTop: space.md, paddingVertical: space.sm, paddingHorizontal: space.lg },
  tlRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
  tlRail: { width: 30, alignItems: 'center' },
  tlLine: { position: 'absolute', width: 1.5, backgroundColor: colors.border, marginTop: -14 },
  tlIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tlTitle: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.ink },
  tlSub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 1 },
  tlTrailing: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
});
