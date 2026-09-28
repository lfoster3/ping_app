import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { PingGlyph } from '@/components/PingGlyph';
import { Radar } from '@/components/Radar';
import { useFamily } from '@/data/FamilyProvider';
import { pingMessages } from '@/data/mock';
import type { Member } from '@/data/types';
import { colors, fonts, radius, shadow, space } from '@/theme';

function recipientLabel(selected: Member[], everyone: boolean) {
  if (everyone) return 'everyone';
  if (selected.length === 1) return selected[0].name;
  if (selected.length === 2) return `${selected[0].name} & ${selected[1].name}`;
  return `${selected.length} people`;
}

export default function SendPingScreen() {
  const insets = useSafeAreaInsets();
  const { members, focusedId, sendPing } = useFamily();
  // The signed-in parent is the first member; you don't ping yourself.
  const others = members.slice(1);

  const [to, setTo] = useState<string[]>(() => (others.some((m) => m.id === focusedId) ? [focusedId] : [others[0].id]));
  const [messageId, setMessageId] = useState(pingMessages[0].id);
  const [withVitals, setWithVitals] = useState(true);
  const [sent, setSent] = useState(false);

  const selected = others.filter((m) => to.includes(m.id));
  const everyone = selected.length === others.length;
  const label = recipientLabel(selected, everyone);

  const toggle = (id: string) =>
    setTo((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const send = () => {
    const msg = pingMessages.find((m) => m.id === messageId)!;
    sendPing(to, msg.label, withVitals);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSent(true);
  };

  if (sent) {
    return (
      <View style={[styles.root, styles.sentRoot, { paddingTop: insets.top, paddingBottom: insets.bottom + space.xl }]}>
        <View style={styles.sentCenter}>
          <Radar />
          <Text style={styles.sentTitle}>Ping sent</Text>
          <Text style={styles.sentBody}>
            {everyone ? 'Everyone' : label} will feel a buzz on {selected.length > 1 ? 'their bands' : 'their band'}.
            {withVitals ? '\nYou’ll get their location and heart rate as soon as they respond.' : ''}
          </Text>
        </View>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.secondaryBtn}>
          <Text style={styles.secondaryText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <PingGlyph size={26} color={colors.primary} />
              <Text style={styles.title}>Send ping</Text>
            </View>
            <Text style={styles.subtitle}>Ask your family to check in</Text>
          </View>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
            <Ionicons name="close" size={20} color={colors.inkSoft} />
          </Pressable>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.section}>To</Text>
          <Pressable
            hitSlop={10}
            onPress={() => setTo(everyone ? [] : others.map((m) => m.id))}
            accessibilityRole="button">
            <Text style={styles.link}>{everyone ? 'Clear' : 'Select all'}</Text>
          </Pressable>
        </View>
        <View style={styles.people}>
          {others.map((m) => {
            const on = to.includes(m.id);
            return (
              <Pressable
                key={m.id}
                onPress={() => toggle(m.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={m.name}
                style={[styles.person, on && styles.personOn]}>
                <Avatar member={m} size={48} showState={false} ring={on ? colors.primary : undefined} />
                <Text style={[styles.personName, on && { color: colors.ink }]}>{m.name}</Text>
                {on && (
                  <View style={styles.check}>
                    <Ionicons name="checkmark" size={11} color="#fff" />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.section, { marginTop: space.xl }]}>Message</Text>
        <Card style={{ overflow: 'hidden' }}>
          {pingMessages.map((msg, i) => {
            const on = msg.id === messageId;
            return (
              <Pressable
                key={msg.id}
                onPress={() => setMessageId(msg.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[styles.msg, i > 0 && styles.divider, on && { backgroundColor: '#F7F8FE' }]}>
                <View style={[styles.msgIcon, on && { backgroundColor: colors.primary }]}>
                  <Ionicons name={msg.icon} size={16} color={on ? '#fff' : colors.inkSoft} />
                </View>
                <Text style={[styles.msgText, on && { fontFamily: fonts.bodySemi }]}>{msg.label}</Text>
                <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
              </Pressable>
            );
          })}
        </Card>

        <Card style={styles.vitals}>
          <View style={styles.msgIcon}>
            <Ionicons name="pulse" size={16} color={colors.inkSoft} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.msgText}>Request location & heart rate</Text>
            <Text style={styles.vitalsSub}>Their band shares a fresh reading when they reply</Text>
          </View>
          <Switch
            value={withVitals}
            onValueChange={setWithVitals}
            trackColor={{ false: '#E5E7EB', true: colors.primary }}
            thumbColor="#fff"
            ios_backgroundColor="#E5E7EB"
          />
        </Card>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Pressable
          onPress={send}
          disabled={to.length === 0}
          accessibilityRole="button"
          style={({ pressed }) => [styles.sendWrap, pressed && { transform: [{ scale: 0.98 }] }, to.length === 0 && { opacity: 0.4 }]}>
          <LinearGradient colors={['#5B73FF', colors.primaryDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.send}>
            <PingGlyph size={22} />
            <Text style={styles.sendText}>{to.length === 0 ? 'Choose who to ping' : `Send ping to ${label}`}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, letterSpacing: -0.4 },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2, marginLeft: 34 },
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
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm },
  section: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink, marginBottom: space.sm },
  link: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.primary, marginBottom: space.sm },
  people: { flexDirection: 'row', gap: space.sm },
  person: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  personOn: { borderColor: colors.primary, backgroundColor: '#F7F8FE' },
  personName: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.muted },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msg: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 13 },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  msgIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F3F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14.5, color: colors.ink },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  vitals: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, marginTop: space.md },
  vitalsSub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: colors.bg,
  },
  sendWrap: { borderRadius: radius.lg, ...shadow.fab },
  send: {
    height: 56,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  sendText: { fontFamily: fonts.bodySemi, fontSize: 16, color: '#fff' },
  sentRoot: { justifyContent: 'space-between', paddingHorizontal: space.lg },
  sentCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sentTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, marginTop: space.lg },
  sentBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.muted, textAlign: 'center', marginTop: space.sm, maxWidth: 300 },
  secondaryBtn: {
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.ink },
});
