import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

/** Heart icon that beats at the given bpm while `active`. */
export function BeatingHeart({ bpm, active, size = 18 }: { bpm: number | null; active: boolean; size?: number }) {
  const [scale] = useState(() => new Animated.Value(1));
  // Re-time the loop only when the rate moves noticeably, not on every reading.
  const rate = bpm ? Math.round(bpm / 5) * 5 : null;

  useEffect(() => {
    if (!active || !rate) return;
    const period = 60000 / rate;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.22, duration: period * 0.15, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: period * 0.25, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(period * 0.6),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      scale.setValue(1);
    };
  }, [active, rate, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name="heart" size={size} color="#fff" />
    </Animated.View>
  );
}
