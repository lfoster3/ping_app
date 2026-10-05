import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { FamilyMap, hasLocation } from '@/components/FamilyMap';
import { useFamily } from '@/data/FamilyProvider';
import { colors, fonts, shadow, space } from '@/theme';

/** Full-screen map: pan and zoom anywhere, tap a pin to follow that person. */
export default function FullMapScreen() {
  const insets = useSafeAreaInsets();
  const { focused, members, places, focus } = useFamily();
  const [showOthers, setShowOthers] = useState(true);

  return (
    <View style={styles.root}>
      {hasLocation(focused) ? (
        <FamilyMap
          focused={focused}
          others={members.filter((m) => m.id !== focused.id)}
          places={places}
          showOthers={showOthers}
          onRecenter={() => {}}
          onToggleLayers={() => setShowOthers((v) => !v)}
          onSelect={focus}
          insetTop={insets.top}
        />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{focused.name} isn&apos;t sharing location yet</Text>
        </View>
      )}

      <View style={[styles.top, { top: insets.top + space.md }]} pointerEvents="box-none">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close full map"
          style={({ pressed }) => [styles.close, pressed && { opacity: 0.7 }]}>
          <Ionicons name="close" size={20} color={colors.ink} />
        </Pressable>
        <View style={styles.chip}>
          <Avatar member={focused} size={28} showState={false} />
          <View>
            <Text style={styles.chipName}>{focused.name}</Text>
            <Text style={styles.chipSub} numberOfLines={1}>
              {focused.location?.label ?? 'No location'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mapLand },
  top: { position: 'absolute', left: space.lg, right: 64, flexDirection: 'row', alignItems: 'center', gap: space.sm, zIndex: 1000 },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
    shadowOpacity: 0.15,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 5,
    paddingLeft: 6,
    paddingRight: 14,
    flexShrink: 1,
    ...shadow.card,
    shadowOpacity: 0.15,
  },
  chipName: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.ink },
  chipSub: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.muted },
});
