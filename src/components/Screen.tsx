import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFamily } from '@/data/FamilyProvider';
import { colors, fonts, space, type } from '@/theme';

/** Height reserved at the bottom of scroll views for the floating tab bar. */
export const TAB_BAR_SPACE = 110;

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  /** False for stack screens pushed over the tabs, which have no tab bar to clear. */
  tabBar?: boolean;
};

export function Screen({ children, scroll = true, tabBar = true }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: insets.top + space.md, paddingHorizontal: space.lg };
  if (!scroll) return <View style={[styles.root, pad]}>{children}</View>;
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[pad, { paddingBottom: (tabBar ? TAB_BAR_SPACE : space.xxl) + insets.bottom }]}
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

type HeaderProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  /** Swap the icon for a back button and drop the settings shortcut (for Settings itself). */
  back?: boolean;
};

export function ScreenHeader({ icon, title, subtitle, back }: HeaderProps) {
  const { unreadAlerts } = useFamily();
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          {back ? (
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={26} color={colors.ink} />
            </Pressable>
          ) : (
            icon
          )}
          <Text style={type.screenTitle} accessibilityRole="header">
            {title}
          </Text>
        </View>
        <Text style={[type.subtitle, styles.subtitle]}>{subtitle}</Text>
      </View>
      {!back && (
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={({ pressed }) => [styles.bell, styles.gear, pressed && { opacity: 0.6 }]}>
          <Ionicons name="settings-outline" size={19} color={colors.inkSoft} />
        </Pressable>
      )}
      <Pressable
        onPress={() => router.push('/notifications')}
        accessibilityRole="button"
        accessibilityLabel={unreadAlerts ? `Notifications, ${unreadAlerts} unread` : 'Notifications'}
        style={({ pressed }) => [styles.bell, pressed && { opacity: 0.6 }]}>
        <Ionicons name="notifications-outline" size={19} color={colors.inkSoft} />
        {unreadAlerts > 0 && <View style={styles.bellDot} />}
      </Pressable>
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.section}>
      <Text style={type.section}>{title}</Text>
      {action && (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subtitle: { marginTop: 2, marginLeft: 34 },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  gear: { marginRight: space.sm },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  section: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  sectionAction: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.primary },
});
