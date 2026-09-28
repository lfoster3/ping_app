import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

/** Decorative ECG trace for the live heart-rate card. Faster bpm → tighter beats. */
export function HeartWave({ bpm, width = 128, height = 52 }: { bpm: number; width?: number; height?: number }) {
  const beats = bpm > 120 ? 4 : 3;
  const seg = width / beats;
  const mid = height * 0.58;
  let d = `M0,${mid}`;
  for (let i = 0; i < beats; i++) {
    const x = i * seg;
    const jitter = ((i * 7) % 3) * 2;
    d +=
      ` L${x + seg * 0.18},${mid}` +
      ` L${x + seg * 0.26},${mid - 5}` + // P
      ` L${x + seg * 0.34},${mid}` +
      ` L${x + seg * 0.42},${mid + 6}` + // Q
      ` L${x + seg * 0.5},${4 + jitter}` + // R
      ` L${x + seg * 0.58},${height - 3}` + // S
      ` L${x + seg * 0.66},${mid - 2}` +
      ` L${x + seg * 0.76},${mid - 9}` + // T
      ` L${x + seg * 0.86},${mid}` +
      ` L${x + seg},${mid}`;
  }
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#7C8BFF" stopOpacity={0.15} />
          <Stop offset="0.35" stopColor="#7C8BFF" stopOpacity={1} />
          <Stop offset="1" stopColor="#9AA6FF" stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Path d={d} stroke="url(#fade)" strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
