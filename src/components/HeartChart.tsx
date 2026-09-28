import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors, fonts } from '@/theme';
import { smoothPath } from './smoothPath';

type Props = {
  /** One value per slot starting at `startSlot`; null = no data (line breaks). */
  values: (number | null)[];
  /** Total number of x slots on the axis. */
  slots: number;
  startSlot?: number;
  xLabels: string[];
  height?: number;
  max?: number;
};

const Y_TICKS = [180, 120, 60, 0];
const Y_AXIS_W = 30;
const X_AXIS_H = 20;

export function HeartChart({ values, slots, startSlot = 0, xLabels, height = 150, max = 180 }: Props) {
  const [w, setW] = useState(0);
  // Hidden screens (e.g. behind a modal on web) report 0 — keep the last real width.
  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    if (next > 0) setW(next);
  };

  const plotW = Math.max(0, w - Y_AXIS_W - 6);
  const plotH = height - X_AXIS_H;
  const x = (i: number) => Y_AXIS_W + (i / Math.max(1, slots - 1)) * plotW;
  const y = (v: number) => 6 + (1 - Math.min(v, max) / max) * (plotH - 12);

  // Split into contiguous runs so gaps (sensor off) show as breaks, not fake lines.
  const runs: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length) runs.push(current);
      current = [];
    } else current.push({ x: x(startSlot + i), y: y(v) });
  });
  if (current.length) runs.push(current);

  const line = runs.map((r) => smoothPath(r)).join(' ');
  const area = runs
    .filter((r) => r.length > 1)
    .map((r) => `${smoothPath(r)} L${r[r.length - 1].x},${y(0)} L${r[0].x},${y(0)} Z`)
    .join(' ');
  const lastRun = runs[runs.length - 1];
  const last = lastRun?.[lastRun.length - 1];
  const lastValue = [...values].reverse().find((v) => v !== null);
  // Keep the tooltip bubble inside the card.
  const tipLeft = last ? Math.min(Math.max(last.x - 30, Y_AXIS_W), w - 64) : 0;

  return (
    <View style={{ height }} onLayout={onLayout}>
      {w > 0 && (
        <Svg width={w} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.primary} stopOpacity={0.22} />
              <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {Y_TICKS.map((t) => (
            <Line key={t} x1={Y_AXIS_W} x2={w} y1={y(t)} y2={y(t)} stroke={colors.divider} strokeWidth={1} />
          ))}
          {xLabels.map((_, i) => {
            const gx = Y_AXIS_W + (i / (xLabels.length - 1)) * plotW;
            return <Line key={i} x1={gx} x2={gx} y1={y(max)} y2={y(0)} stroke={colors.divider} strokeWidth={1} />;
          })}
          <Path d={area} fill="url(#area)" />
          <Path d={line} stroke={colors.primary} strokeWidth={1.8} fill="none" strokeLinejoin="round" />
          {last && (
            <>
              <Circle cx={last.x} cy={last.y} r={6} fill="#fff" />
              <Circle cx={last.x} cy={last.y} r={4} fill={colors.primary} />
            </>
          )}
        </Svg>
      )}
      {Y_TICKS.map((t) => (
        <Text key={t} style={[styles.yLabel, { top: y(t) - 7 }]}>
          {t}
        </Text>
      ))}
      <View style={[styles.xRow, { left: Y_AXIS_W - 18, right: -12 }]}>
        {xLabels.map((l, i) => (
          <Text key={i} style={styles.xLabel}>
            {l}
          </Text>
        ))}
      </View>
      {last && (
        <View style={[styles.tip, { left: tipLeft, top: Math.max(0, last.y - 34) }]}>
          <Text style={styles.tipText}>{lastValue} bpm</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  yLabel: { position: 'absolute', left: 0, fontFamily: fonts.body, fontSize: 10.5, color: colors.muted },
  xRow: { position: 'absolute', bottom: 0, flexDirection: 'row', justifyContent: 'space-between' },
  xLabel: { width: 36, textAlign: 'center', fontFamily: fonts.body, fontSize: 10, color: colors.muted },
  tip: {
    position: 'absolute',
    backgroundColor: colors.primary,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  tipText: { fontFamily: fonts.bodySemi, fontSize: 10.5, color: '#fff' },
});
