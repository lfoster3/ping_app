import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import { zoneOf } from '@/data/format';
import {
  baseline,
  dailyHeartRate,
  HISTORY_SNAPSHOT,
  overnightHeart,
  RESTING_ALERT_BPM,
  workouts,
  type WorkoutSport,
} from '@/data/pedroHistory';
import { colors, fonts, radius, space } from '@/theme';
import { Card } from './Card';
import { SectionHeader } from './Screen';
import { smoothPath } from './smoothPath';

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function useWidth() {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    if (next > 0) setW(next);
  };
  return [w, onLayout] as const;
}

/** Line over days with a dashed "usual" line; dates on the x axis. */
function TrendLine({ values, dates, usual, color, height = 110 }: { values: number[]; dates: string[]; usual: number; color: string; height?: number }) {
  const [w, onLayout] = useWidth();
  const lo = Math.min(...values, usual);
  const hi = Math.max(...values, usual);
  const pad = (hi - lo) * 0.15 || 5;
  const first = new Date(`${dates[0]}T12:00:00`).getTime();
  const span = new Date(`${dates[dates.length - 1]}T12:00:00`).getTime() - first || 1;
  // Position by real date so missing days (WHOOP not worn) show as gaps in spacing.
  const x = (d: string) => 4 + ((new Date(`${d}T12:00:00`).getTime() - first) / span) * (w - 8);
  const y = (v: number) => 6 + (1 - (v - (lo - pad)) / (hi - lo + pad * 2)) * (height - 12);
  const pts = values.map((v, i) => ({ x: x(dates[i]), y: y(v) }));
  const last = pts[pts.length - 1];

  return (
    <View>
      <View style={{ height }} onLayout={onLayout}>
        {w > 0 && (
          <Svg width={w} height={height}>
            <Line x1={0} x2={w} y1={y(usual)} y2={y(usual)} stroke={colors.faint} strokeWidth={1} strokeDasharray="4 4" />
            <Path d={smoothPath(pts, 0.12)} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
            {pts.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={2} fill={color} opacity={0.5} />
            ))}
            <Circle cx={last.x} cy={last.y} r={6} fill="#fff" />
            <Circle cx={last.x} cy={last.y} r={4} fill={color} />
          </Svg>
        )}
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>{shortDate(dates[0])}</Text>
        <Text style={styles.axisText}>usual {Math.round(usual * 10) / 10}</Text>
        <Text style={styles.axisText}>{shortDate(dates[dates.length - 1])}</Text>
      </View>
    </View>
  );
}

/** One bar per day from lowest to highest bpm, with the day's average as a dot. */
function RangeBars({ height = 140 }: { height?: number }) {
  const [w, onLayout] = useWidth();
  const max = 180;
  const y = (v: number) => 4 + (1 - v / max) * (height - 8);
  const n = dailyHeartRate.length;
  const LABEL_W = 24;
  const slot = (w - LABEL_W) / n;
  const barW = Math.max(3, slot * 0.45);

  return (
    <View>
      <View style={{ height }} onLayout={onLayout}>
        {w > 0 && (
          <Svg width={w} height={height}>
            {[60, 120, 180].map((t) => (
              <Line key={t} x1={LABEL_W} x2={w} y1={y(t)} y2={y(t)} stroke={colors.divider} strokeWidth={1} />
            ))}
            {dailyHeartRate.map((d, i) => {
              const cx = LABEL_W + slot * i + slot / 2;
              const partial = !!d.partialUntil;
              return (
                <G key={d.date}>
                  <Rect
                    x={cx - barW / 2}
                    y={y(d.max)}
                    width={barW}
                    height={Math.max(2, y(d.min) - y(d.max))}
                    rx={barW / 2}
                    fill={zoneOf(d.max).color}
                    opacity={partial ? 0.35 : 0.8}
                  />
                  <Circle cx={cx} cy={y(d.avg)} r={barW / 2 + 0.5} fill="#fff" stroke={colors.ink} strokeWidth={1} />
                </G>
              );
            })}
          </Svg>
        )}
        {[180, 120, 60].map((t) => (
          <Text key={t} style={[styles.gridLabel, { top: y(t) - 7 }]}>
            {t}
          </Text>
        ))}
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>{shortDate(dailyHeartRate[0].date)}</Text>
        <Text style={styles.axisText}>bar = low → high · dot = average</Text>
        <Text style={styles.axisText}>Today</Text>
      </View>
    </View>
  );
}

const SPORT_ICON: Record<WorkoutSport, keyof typeof Ionicons.glyphMap> = {
  run: 'walk',
  ride: 'bicycle',
  swim: 'water',
  strength: 'barbell',
};

function DeltaChip({ delta, unit, higherIsBad }: { delta: number; unit: string; higherIsBad: boolean }) {
  const rounded = Math.round(delta * 10) / 10;
  const bad = higherIsBad ? rounded >= RESTING_ALERT_BPM : false;
  const sign = rounded > 0 ? '+' : '';
  return (
    <View style={[styles.chip, bad && { backgroundColor: '#FEF3E2' }]}>
      <Text style={[styles.chipText, bad && { color: colors.amberInk }]}>
        {sign}
        {rounded} {unit} vs usual
      </Text>
    </View>
  );
}

/** Pedro's real history from Garmin + WHOOP (a snapshot; live data is separate). */
export function HeartHistory({ name }: { name: string }) {
  const [metric, setMetric] = useState<'resting' | 'hrv'>('resting');
  const [allWorkouts, setAllWorkouts] = useState(false);

  const resting = baseline(overnightHeart, (r) => r.resting);
  const hrv = baseline(overnightHeart, (r) => r.hrvMs);
  const shown = metric === 'resting' ? resting : hrv;
  const list = allWorkouts ? workouts : workouts.slice(0, 5);

  return (
    <View>
      <SectionHeader title="Last 30 days" />
      <Text style={styles.source}>
        From {name}&apos;s {HISTORY_SNAPSHOT.device} · synced {shortDate(HISTORY_SNAPSHOT.pulledAt)}
      </Text>

      <Card style={styles.card}>
        <View style={styles.segment}>
          {(['resting', 'hrv'] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMetric(m)}
              accessibilityRole="tab"
              accessibilityState={{ selected: metric === m }}
              style={[styles.segBtn, metric === m && styles.segOn]}>
              <Text style={[styles.segText, metric === m && styles.segTextOn]}>
                {m === 'resting' ? 'Resting heart rate' : 'HRV'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.headline}>
          <Text style={styles.big}>
            {Math.round(shown.value * 10) / 10}
            <Text style={styles.unit}> {metric === 'resting' ? 'bpm' : 'ms'}</Text>
          </Text>
          <DeltaChip delta={shown.delta} unit={metric === 'resting' ? 'bpm' : 'ms'} higherIsBad={metric === 'resting'} />
        </View>
        <Text style={styles.caption}>
          {metric === 'resting'
            ? `WHOOP, measured overnight · ${shortDate(resting.latest.date)}`
            : `WHOOP overnight HRV (rMSSD) · higher is usually better`}
        </Text>

        <TrendLine
          values={overnightHeart.map((r) => (metric === 'resting' ? r.resting : r.hrvMs))}
          dates={overnightHeart.map((r) => r.date)}
          usual={shown.usual}
          color={metric === 'resting' ? colors.primary : colors.green}
        />
      </Card>

      <Card style={[styles.card, { marginTop: space.md }]}>
        <Text style={styles.cardTitle}>Daily heart rate range</Text>
        <Text style={styles.caption}>
          Garmin, all day · today so far (until {dailyHeartRate[dailyHeartRate.length - 1].partialUntil})
        </Text>
        <RangeBars />
      </Card>

      <Card style={[styles.card, { marginTop: space.md, paddingBottom: space.sm }]}>
        <Text style={styles.cardTitle}>Workouts</Text>
        <Text style={styles.caption}>Heart rate per session, recorded on the Garmin</Text>
        {list.map((wk, i) => (
          <View key={`${wk.date}-${wk.start}`} style={[styles.workout, i > 0 && styles.divider]}>
            <View style={styles.wIcon}>
              <Ionicons name={SPORT_ICON[wk.sport]} size={16} color={colors.inkSoft} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.wName} numberOfLines={1}>
                {wk.name}
              </Text>
              <Text style={styles.wMeta}>
                {shortDate(wk.date)} · {wk.start} · {wk.durationMin} min
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={styles.wHr}>
                <View style={[styles.zoneDot, { backgroundColor: zoneOf(wk.avgHr).color }]} />
                <Text style={styles.wAvg}>{wk.avgHr}</Text>
                <Text style={styles.wUnit}>avg</Text>
              </View>
              <Text style={styles.wMax}>max {wk.maxHr}</Text>
            </View>
          </View>
        ))}
        {workouts.length > 5 && (
          <Pressable onPress={() => setAllWorkouts((v) => !v)} accessibilityRole="button" style={styles.more}>
            <Text style={styles.moreText}>{allWorkouts ? 'Show fewer' : `Show all ${workouts.length}`}</Text>
          </Pressable>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  source: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: -4, marginBottom: space.sm },
  card: { padding: space.lg },
  cardTitle: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  caption: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted, marginTop: 2, marginBottom: space.md },
  segment: { flexDirection: 'row', backgroundColor: '#F1F3F8', borderRadius: radius.sm, padding: 3, marginBottom: space.md },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  segOn: { backgroundColor: '#fff' },
  segText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.muted },
  segTextOn: { color: colors.ink, fontFamily: fonts.bodySemi },
  headline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  big: { fontFamily: fonts.displayBold, fontSize: 30, color: colors.ink },
  unit: { fontFamily: fonts.displayMedium, fontSize: 14, color: colors.muted },
  chip: { backgroundColor: '#F1F3F8', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 11.5, color: colors.inkSoft },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisText: { fontFamily: fonts.body, fontSize: 10.5, color: colors.faint },
  gridLabel: { position: 'absolute', left: 0, fontFamily: fonts.body, fontSize: 9.5, color: colors.faint },
  workout: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  wIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F1F3F8', alignItems: 'center', justifyContent: 'center' },
  wName: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.ink },
  wMeta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted, marginTop: 1 },
  wHr: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  zoneDot: { width: 7, height: 7, borderRadius: 4 },
  wAvg: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.ink },
  wUnit: { fontFamily: fonts.body, fontSize: 10.5, color: colors.muted },
  wMax: { fontFamily: fonts.body, fontSize: 11, color: colors.muted, marginTop: 1 },
  more: { alignItems: 'center', paddingVertical: 10 },
  moreText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.primary },
});
