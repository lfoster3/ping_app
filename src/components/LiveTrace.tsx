import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { smoothPath } from './smoothPath';

type Props = { samples: { at: number; bpm: number }[]; windowMs?: number; width?: number; height?: number };

/** The real signal: the last minute of readings from the watch, newest on the right. */
export function LiveTrace({ samples, windowMs = 60_000, width = 128, height = 52 }: Props) {
  if (samples.length < 2) return <Svg width={width} height={height} />;
  const end = samples[samples.length - 1].at;
  const shown = samples.filter((s) => end - s.at <= windowMs);
  // Right after connecting, stretch what we have instead of hugging the right edge.
  const spanMs = Math.max(10_000, Math.min(windowMs, end - shown[0].at));
  const bpms = shown.map((s) => s.bpm);
  // Pad the range so a steady resting rate doesn't look like a seismograph.
  const lo = Math.min(...bpms) - 4;
  const hi = Math.max(...bpms) + 4;
  const span = Math.max(hi - lo, 16);
  const mid = (hi + lo) / 2;
  const pts = shown.map((s) => ({
    x: 4 + (1 - (end - s.at) / spanMs) * (width - 10),
    y: height / 2 - ((s.bpm - mid) / span) * (height - 12),
  }));
  const last = pts[pts.length - 1];

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="live" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#7C8BFF" stopOpacity={0.1} />
          <Stop offset="0.5" stopColor="#7C8BFF" stopOpacity={1} />
          <Stop offset="1" stopColor="#9AA6FF" stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Path d={smoothPath(pts)} stroke="url(#live)" strokeWidth={2} fill="none" strokeLinecap="round" />
      <Circle cx={last.x} cy={last.y} r={5} fill="#9AA6FF" opacity={0.3} />
      <Circle cx={last.x} cy={last.y} r={3} fill="#fff" />
    </Svg>
  );
}
