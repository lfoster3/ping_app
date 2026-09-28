import { StyleSheet, Text, View } from 'react-native';

import { stateColor } from '@/data/format';
import type { Member } from '@/data/types';
import { fonts } from '@/theme';

type Props = {
  member: Member;
  size?: number;
  /** Show the coloured status dot in the bottom-right corner. */
  showState?: boolean;
  ring?: string;
};

export function Avatar({ member, size = 44, showState = true, ring }: Props) {
  const dot = Math.max(10, Math.round(size * 0.24));
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: member.avatar.bg,
            borderWidth: ring ? 2 : 0,
            borderColor: ring,
          },
        ]}>
        <Text style={[styles.initial, { color: member.avatar.ink, fontSize: size * 0.36 }]}>
          {member.name[0]}
        </Text>
      </View>
      {showState && (
        <View
          style={[
            styles.dot,
            {
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: stateColor[member.state],
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.displayBold },
  dot: { position: 'absolute', right: -1, bottom: -1, borderWidth: 2, borderColor: '#fff' },
});
