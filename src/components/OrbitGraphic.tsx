import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { colors } from '@/theme';

type Props = { dots: string[]; size?: number };

/** Family "orbit": one dot per member circling the Ping core. */
export function OrbitGraphic({ dots, size = 88 }: Props) {
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 60000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const c = size / 2;
  const outer = size * 0.46;
  const inner = size * 0.32;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // Alternate members between the two rings so the dots never overlap.
  const placed = dots.map((color, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / dots.length) * Math.PI * 2 + Math.PI * 0.85;
    return { color, x: c + Math.cos(a) * r, y: c + Math.sin(a) * r };
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="core" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#6F86FF" />
            <Stop offset="1" stopColor={colors.primaryDeep} />
          </RadialGradient>
        </Defs>
        <Circle cx={c} cy={c} r={outer} stroke="rgba(255,255,255,0.14)" strokeWidth={1} fill="none" />
        <Circle cx={c} cy={c} r={inner} stroke="rgba(255,255,255,0.14)" strokeWidth={1} fill="none" />
        <Circle cx={c} cy={c} r={size * 0.19} fill={colors.primary} opacity={0.25} />
        <Circle cx={c} cy={c} r={size * 0.15} fill="url(#core)" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
        <Svg width={size} height={size}>
          {placed.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={size * 0.045} fill={p.color} />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}
