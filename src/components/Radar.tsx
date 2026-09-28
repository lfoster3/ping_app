import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { colors, shadow } from '@/theme';
import { PingGlyph } from './PingGlyph';

/** Expanding rings behind the Ping mark — the "ping sent" moment. */
export function Radar({ size = 220 }: { size?: number }) {
  const [rings] = useState(() => [0, 1, 2].map(() => new Animated.Value(0)));

  useEffect(() => {
    const anims = rings.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 700),
          Animated.timing(v, { toValue: 1, duration: 2100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [rings]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {rings.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
              transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
            },
          ]}
        />
      ))}
      <View style={styles.coreWrap}>
        <LinearGradient colors={['#5B73FF', colors.primaryDeep]} style={styles.core}>
          <PingGlyph size={40} />
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', backgroundColor: 'rgba(79,99,240,0.22)' },
  coreWrap: { borderRadius: 44, ...shadow.fab },
  core: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
});
