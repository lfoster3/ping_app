import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useFamily } from '@/data/FamilyProvider';
import { bandUnavailableReason } from '@/devices/bandTelemetry';
import type { Member } from '@/data/types';
import { colors, fonts, radius, space } from '@/theme';
import { Card } from './Card';

const STEPS = [
  'On the Garmin, turn on Broadcast Heart Rate (Settings › Sensors & Accessories › Wrist Heart Rate, or the “Broadcast HR” control).',
  'Keep the watch close, then tap Connect and choose it from the list.',
];

/** Shown for a live member (Pedro) whenever their watch isn't streaming. */
export function GarminConnectCard({ member }: { member: Member }) {
  const { connectLive, garminUnsupported } = useFamily();
  const live = member.live;
  if (!live) return null;
  const bandUnsupported = bandUnavailableReason();
  const busy = live.status === 'connecting' || live.status === 'reconnecting';

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Ionicons name="watch-outline" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Connect {member.name}&apos;s Garmin</Text>
          <Text style={styles.sub}>Live heart rate over Bluetooth, updated every second</Text>
        </View>
      </View>

      {STEPS.map((step, i) => (
        <View key={i} style={styles.step}>
          <Text style={styles.stepNum}>{i + 1}</Text>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}

      {live.status === 'error' && live.error && (
        <View style={styles.error}>
          <Ionicons name="alert-circle" size={16} color={colors.red} />
          <Text style={styles.errorText}>{live.error}</Text>
        </View>
      )}
      {garminUnsupported && (
        <View style={styles.error}>
          <Ionicons name="information-circle" size={16} color={colors.amberInk} />
          <Text style={[styles.errorText, { color: colors.amberInk }]}>{garminUnsupported}</Text>
        </View>
      )}

      <Pressable
        onPress={() => connectLive('garmin')}
        disabled={busy || !!garminUnsupported}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.primary,
          (busy || garminUnsupported) && { opacity: 0.5 },
          pressed && { opacity: 0.85 },
        ]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="bluetooth" size={17} color="#fff" />}
        <Text style={styles.primaryText}>
          {live.status === 'reconnecting' ? 'Reconnecting…' : busy ? 'Connecting…' : 'Connect Garmin'}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => connectLive('band')}
        disabled={busy || !!bandUnsupported}
        accessibilityRole="button"
        style={[styles.secondary, (busy || bandUnsupported) && { opacity: 0.5 }]}>
        <Text style={styles.secondaryText}>{bandUnsupported ?? 'Use the Ping band instead (live feed)'}</Text>
      </Pressable>

      {__DEV__ && (
        <Pressable onPress={() => connectLive('simulated')} accessibilityRole="button" style={styles.secondary}>
          <Text style={styles.secondaryText}>No watch nearby? Use a simulated signal (dev only)</Text>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  sub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  step: { flexDirection: 'row', gap: 10 },
  stepNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F1F3F8',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    color: colors.inkSoft,
    overflow: 'hidden',
  },
  stepText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.inkSoft },
  error: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#FDF4F4',
    borderRadius: radius.sm,
    padding: 10,
  },
  errorText: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.red },
  primary: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { fontFamily: fonts.bodySemi, fontSize: 15, color: '#fff' },
  secondary: { alignItems: 'center', paddingVertical: 4 },
  secondaryText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.primary },
});
