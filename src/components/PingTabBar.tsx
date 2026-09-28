import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, shadow } from '@/theme';
import { PingGlyph } from './PingGlyph';

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: Record<string, { label: string; icon: IconName; iconActive: IconName }> = {
  index: { label: 'Family', icon: 'people-outline', iconActive: 'people' },
  map: { label: 'Map', icon: 'map-outline', iconActive: 'map' },
  trends: { label: 'Trends', icon: 'pulse-outline', iconActive: 'pulse' },
  settings: { label: 'Settings', icon: 'settings-outline', iconActive: 'settings' },
};

/** Four tabs with the raised "Send ping" button in the middle. */
export function PingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => r.name in TABS);
  const half = Math.ceil(routes.length / 2);

  const renderTab = (route: (typeof routes)[number]) => {
    const meta = TABS[route.name];
    const focused = state.routes[state.index]?.key === route.key;
    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
    };
    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
        style={styles.tab}>
        <View style={[styles.tabInner, focused && styles.tabActive]}>
          <Ionicons
            name={focused ? meta.iconActive : meta.icon}
            size={20}
            color={focused ? colors.ink : colors.faint}
          />
          <Text style={[styles.label, focused && styles.labelActive]}>{meta.label}</Text>
        </View>
      </Pressable>
    );
  };

  const sendPing = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/send-ping');
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {routes.slice(0, half).map(renderTab)}
      <View style={styles.center}>
        <Pressable
          onPress={sendPing}
          accessibilityRole="button"
          accessibilityLabel="Send ping"
          style={({ pressed }) => [styles.fabWrap, pressed && { transform: [{ scale: 0.94 }] }]}>
          <LinearGradient
            colors={['#5B73FF', colors.primaryDeep]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={styles.fab}>
            <PingGlyph size={26} />
          </LinearGradient>
        </Pressable>
        <Text style={styles.label}>Send ping</Text>
      </View>
      {routes.slice(half).map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  tab: { flex: 1, alignItems: 'center' },
  tabInner: {
    alignItems: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    minWidth: 58,
  },
  tabActive: { backgroundColor: colors.primarySoft },
  label: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.faint },
  labelActive: { color: colors.ink, fontFamily: fonts.bodySemi },
  center: { flex: 1, alignItems: 'center', gap: 4, paddingBottom: 6 },
  fabWrap: { marginTop: -30, borderRadius: 32, borderWidth: 4, borderColor: colors.surface, ...shadow.fab },
  fab: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
