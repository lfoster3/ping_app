import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useFamily } from '@/data/FamilyProvider';
import type { Member } from '@/data/types';
import { colors, fonts, radius, space } from '@/theme';
import { Card } from './Card';

const BLE_STEPS = [
  'On the WHOOP, make sure Bluetooth Heart Rate Broadcast is turned on (Device Settings in the WHOOP app).',
  'Keep the band close, then tap Connect and choose it from the list.',
];

const ESP32_STEPS = [
  'Plug the ESP32 into your computer and run: node tools/serial-bridge.js',
  'Put your finger on the sensor, then tap Connect.',
];

/** Shown for a live member whenever their sensor isn't streaming. */
export function SensorConnectCard({ member }: { member: Member }) {
  const { connectBle, bleUnsupported, connectEsp32 } = useFamily();
  const live = member.live;
  if (!live) return null;

  const isEsp32 = member.id === 'nico';
  const busy = live.status === 'connecting' || live.status === 'reconnecting';
  const steps = isEsp32 ? ESP32_STEPS : BLE_STEPS;
  const unsupported = isEsp32 ? null : bleUnsupported;
  const onConnect = isEsp32 ? () => connectEsp32() : () => connectBle('ble');
  const connectLabel = isEsp32 ? 'Connect Sensor' : 'Connect WHOOP';
  const icon: keyof typeof Ionicons.glyphMap = isEsp32 ? 'wifi' : 'bluetooth';

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Ionicons name={isEsp32 ? 'hardware-chip-outline' : 'watch-outline'} size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Connect {member.name}&apos;s {isEsp32 ? 'sensor' : 'WHOOP'}</Text>
          <Text style={styles.sub}>
            {isEsp32
              ? 'Heart rate and GPS over Wi-Fi, updated every second'
              : 'Live heart rate over Bluetooth, updated every second'}
          </Text>
        </View>
      </View>

      {steps.map((step, i) => (
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
      {unsupported && (
        <View style={styles.error}>
          <Ionicons name="information-circle" size={16} color={colors.amberInk} />
          <Text style={[styles.errorText, { color: colors.amberInk }]}>{unsupported}</Text>
        </View>
      )}

      <Pressable
        onPress={onConnect}
        disabled={busy || !!unsupported}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.primary,
          (busy || unsupported) && { opacity: 0.5 },
          pressed && { opacity: 0.85 },
        ]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name={icon} size={17} color="#fff" />}
        <Text style={styles.primaryText}>
          {live.status === 'reconnecting' ? 'Reconnecting\u2026' : busy ? 'Connecting\u2026' : connectLabel}
        </Text>
      </Pressable>

      {__DEV__ && (
        <Pressable
          onPress={() => { if (isEsp32) connectEsp32('simulated'); else connectBle('simulated'); }}
          accessibilityRole="button"
          style={styles.secondary}>
          <Text style={styles.secondaryText}>
            {isEsp32 ? 'No board nearby? Use a simulated signal (dev only)' : 'No watch nearby? Use a simulated signal (dev only)'}
          </Text>
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
