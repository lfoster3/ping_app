import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { useFamily } from '@/data/FamilyProvider';
import { ago, minutesSince } from '@/data/format';
import type { AlertItem } from '@/data/types';
import { colors, fonts, space } from '@/theme';

const TONE: Record<AlertItem['tone'], { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  attention: { icon: 'heart', color: colors.amberInk, bg: '#FEF3E2' },
  info: { icon: 'pulse', color: colors.primary, bg: colors.primarySoft },
  success: { icon: 'location', color: colors.green, bg: colors.greenSoft },
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { alerts, pings, memberById, markAlertsRead, focus } = useFamily();

  useEffect(() => {
    markAlertsRead();
  }, [markAlertsRead]);

  const open = (a: AlertItem) => {
    focus(a.memberId);
    router.back();
    router.navigate(a.tone === 'success' ? '/map' : '/trends');
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Ionicons name="notifications" size={24} color={colors.primary} />
            <Text style={styles.title}>Alerts</Text>
          </View>
          <Text style={styles.subtitle}>What changed in your family today</Text>
        </View>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
          <Ionicons name="close" size={20} color={colors.inkSoft} />
        </Pressable>
      </View>

      {pings.length > 0 && (
        <>
          <Text style={styles.section}>Pings you sent</Text>
          <Card style={{ overflow: 'hidden', marginBottom: space.xl }}>
            {pings.map((p, i) => (
              <View key={p.id} style={[styles.row, i > 0 && styles.divider]}>
                <View style={[styles.toneIcon, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name="paper-plane" size={15} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>“{p.message}”</Text>
                  <Text style={styles.rowBody}>
                    To {p.to.map((id) => memberById(id)?.name).join(', ')} · waiting for reply
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </>
      )}

      <Text style={styles.section}>Today</Text>
      <Card style={{ overflow: 'hidden' }}>
        {alerts.map((a, i) => {
          const m = memberById(a.memberId);
          const tone = TONE[a.tone];
          return (
            <Pressable
              key={a.id}
              onPress={() => open(a)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && { backgroundColor: '#F8F9FC' }]}>
              <View>
                {m && <Avatar member={m} size={40} showState={false} />}
                <View style={[styles.toneBadge, { backgroundColor: tone.bg }]}>
                  <Ionicons name={tone.icon} size={10} color={tone.color} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{a.title}</Text>
                <Text style={styles.rowBody}>{a.body}</Text>
              </View>
              <Text style={styles.time}>{ago(minutesSince(a.at))}</Text>
            </Pressable>
          );
        })}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, letterSpacing: -0.4 },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2, marginLeft: 32 },
  close: {
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
  section: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink, marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.lg },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  toneIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  toneBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  rowBody: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.muted, marginTop: 2 },
  time: { fontFamily: fonts.body, fontSize: 11.5, color: colors.faint },
});
