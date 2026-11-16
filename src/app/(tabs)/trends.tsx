import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BeatingHeart } from '@/components/BeatingHeart';
import { Card } from '@/components/Card';
import { SensorConnectCard } from '@/components/SensorConnectCard';
import { HeartChart } from '@/components/HeartChart';
import { HeartHistory } from '@/components/HeartHistory';
import { HeartWave } from '@/components/HeartWave';
import { LiveTrace } from '@/components/LiveTrace';
import { MemberPicker } from '@/components/MemberPicker';
import { Screen, ScreenHeader, SectionHeader } from '@/components/Screen';
import { useFamily } from '@/data/FamilyProvider';
import { ago, clock, heartBadge, statusLine, zoneBreakdown, zonePercents, zones } from '@/data/format';
import type { Member } from '@/data/types';
import { colors, fonts, space } from '@/theme';

const DAY_LABELS = ['12 AM', '6 AM', '12 PM', '6 PM', '12 AM'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Mock 7-day averages derived from today's samples until the API provides them. */
function weekAverages(m: Member): number[] {
  const known = m.heartRateHistory.filter((v): v is number => v !== null);
  const avg = known.reduce((a, b) => a + b, 0) / Math.max(1, known.length);
  return [-4, 3, -2, 5, -6, 2, 0].map((d) => Math.round(avg + d));
}

function weekLabels(): string[] {
  const today = new Date().getDay();
  return Array.from({ length: 7 }, (_, i) => WEEKDAYS[(today - 6 + i + 7) % 7]);
}

export default function TrendsScreen() {
  const { focused } = useFamily();
  const [picking, setPicking] = useState(false);
  const [range, setRange] = useState<'day' | 'week'>('day');

  const live = focused.live;
  const streaming = live?.status === 'connected' && focused.heartRate !== null;
  const breakdown = useMemo(
    () => (focused.live ? zonePercents(focused.live.zoneCounts) : zoneBreakdown(focused.heartRateHistory)),
    [focused],
  );
  const badge = heartBadge(focused);
  const week = useMemo(() => weekAverages(focused), [focused]);
  // Live members only have what the watch has streamed today — no week view yet.
  const showWeek = range === 'week' && !live;
  const hasHistory = focused.heartRateHistory.some((v) => v !== null);

  return (
    <Screen>
      <ScreenHeader
        icon={<Ionicons name="heart" size={26} color={colors.primary} />}
        title="Heart Rate"
        subtitle="Live & historical"
      />

      <Pressable
        onPress={() => setPicking(true)}
        accessibilityRole="button"
        accessibilityLabel={`${focused.name}'s heart rate, ${focused.heartRate} bpm, ${badge.label}. Tap to switch family member`}>
        <Card dark style={styles.live}>
          <View style={styles.liveHead}>
            <View style={styles.heartBubble}>
              <BeatingHeart bpm={focused.heartRate} active={streaming} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.liveNameRow}>
                <Text style={styles.liveName}>{focused.name}&apos;s heart rate</Text>
                <Ionicons name="chevron-down" size={14} color={colors.navyMuted} />
              </View>
              <Text style={styles.liveSub}>
                {live
                  ? statusLine(focused)
                  : `${focused.lastSyncMin <= 5 ? 'Live' : 'Updated'} · ${ago(focused.lastSyncMin)}`}
              </Text>
            </View>
          </View>
          <View style={styles.liveBody}>
            <View>
              <Text style={[styles.bigBpm, focused.heartRate === null && { color: colors.navyMuted }]}>
                {focused.heartRate ?? '--'}
                <Text style={styles.bigUnit}> bpm</Text>
              </Text>
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
              </View>
            </View>
            {live ? <LiveTrace samples={live.recent} /> : <HeartWave bpm={focused.heartRate ?? 70} />}
          </View>
        </Card>
      </Pressable>

      {live && live.status !== 'connected' && (
        <View style={{ marginTop: space.md }}>
          <SensorConnectCard member={focused} />
        </View>
      )}

      <SectionHeader
        title={showWeek ? '7 Day Average' : '24 Hour History'}
        action={live ? undefined : showWeek ? 'View today' : 'View week'}
        onAction={() => setRange((r) => (r === 'day' ? 'week' : 'day'))}
      />
      <Card style={styles.chartCard}>
        {showWeek ? (
          <HeartChart values={week} slots={7} xLabels={weekLabels()} />
        ) : hasHistory ? (
          <HeartChart
            values={focused.heartRateHistory}
            slots={(24 * 60) / focused.historySlotMin + 1}
            startSlot={focused.historyStartSlot}
            xLabels={DAY_LABELS}
          />
        ) : (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyText}>
              Today&apos;s history fills in here as {focused.name}&apos;s watch streams.
            </Text>
          </View>
        )}
        {live && hasHistory && (
          <Text style={styles.chartNote}>
            Streaming since {clock(focused.historyStartSlot * focused.historySlotMin)} · 5-minute averages
          </Text>
        )}
      </Card>

      {/* A live member with no readings yet has nothing to break down. */}
      {!(live && Object.values(live.zoneCounts).every((c) => c === 0)) && (
        <Card style={styles.zones}>
          <Text style={styles.zonesTitle}>Heart Rate Zones</Text>
          {zones.map((z) => (
            <View key={z.id} style={styles.zoneRow} accessible accessibilityLabel={`${z.label} ${z.range}: ${breakdown[z.id]} percent`}>
              <View style={[styles.zoneDot, { backgroundColor: z.color }]} />
              <Text style={styles.zoneLabel}>
                {z.label} ({z.range})
              </Text>
              <Text style={styles.zonePct}>{breakdown[z.id]}%</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${breakdown[z.id] > 0 ? Math.max(breakdown[z.id], 2) : 0}%`, backgroundColor: z.color }]} />
              </View>
            </View>
          ))}
        </Card>
      )}

      {focused.realHistory && <HeartHistory name={focused.name} />}

      <MemberPicker visible={picking} onClose={() => setPicking(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  live: { padding: space.lg, borderRadius: 22 },
  liveHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  heartBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveName: { fontFamily: fonts.bodySemi, fontSize: 14.5, color: '#fff' },
  liveSub: { fontFamily: fonts.body, fontSize: 12, color: colors.navyMuted, marginTop: 2 },
  liveBody: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: space.md },
  bigBpm: { fontFamily: fonts.displayBold, fontSize: 44, color: '#fff', letterSpacing: -1 },
  bigUnit: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.navyMuted, letterSpacing: 0 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginTop: 2 },
  badgeText: { fontFamily: fonts.bodySemi, fontSize: 11 },
  chartCard: { paddingTop: space.lg, paddingBottom: space.md, paddingLeft: space.md, paddingRight: space.xl },
  emptyChart: { height: 150, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  emptyText: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, textAlign: 'center' },
  chartNote: { fontFamily: fonts.body, fontSize: 11, color: colors.faint, marginTop: space.sm, marginLeft: 6 },
  zones: { marginTop: space.md, padding: space.lg, gap: 12 },
  zonesTitle: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink, marginBottom: 2 },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zoneDot: { width: 10, height: 10, borderRadius: 5 },
  zoneLabel: { width: 120, fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  zonePct: { width: 34, textAlign: 'right', fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkSoft },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#EEF0F5', overflow: 'hidden', marginLeft: 6 },
  fill: { height: 6, borderRadius: 3 },
});
