import Svg, { Circle, Path } from 'react-native-svg';

/** The Ping mark: a dot with two broadcast arcs — "(•)". */
export function PingGlyph({ size = 22, color = '#fff' }: { size?: number; color?: string }) {
  const sw = size * 0.11;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={3.2} fill={color} />
      <Path d="M7 6.5a8 8 0 0 0 0 11" stroke={color} strokeWidth={sw * 1.1} strokeLinecap="round" fill="none" />
      <Path d="M17 6.5a8 8 0 0 1 0 11" stroke={color} strokeWidth={sw * 1.1} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
