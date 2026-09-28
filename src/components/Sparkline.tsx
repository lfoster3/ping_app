import Svg, { Path } from 'react-native-svg';

import { smoothPath } from './smoothPath';

type Props = { data: (number | null)[]; color: string; width?: number; height?: number };

/** Tiny trend line used next to each family member's bpm. */
export function Sparkline({ data: raw, color, width = 52, height = 14 }: Props) {
  const data = raw.filter((v): v is number => v !== null);
  if (data.length < 2) return <Svg width={width} height={height} />;
  const min = Math.min(...data);
  const span = Math.max(...data) - min || 1;
  const pts = data.map((v, i) => ({
    x: 1 + (i / (data.length - 1)) * (width - 2),
    y: 2 + (1 - (v - min) / span) * (height - 4),
  }));
  return (
    <Svg width={width} height={height}>
      <Path d={smoothPath(pts)} stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
