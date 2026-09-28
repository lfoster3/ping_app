import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { OrbitGraphic } from '@/components/OrbitGraphic';
import { PingGlyph } from '@/components/PingGlyph';
import { Screen, ScreenHeader, SectionHeader } from '@/components/Screen';
import { Sparkline } from '@/components/Sparkline';
import { useFamily } from '@/data/FamilyProvider';
import { stateColor, statusLine, todayLabel } from '@/data/format';
import type { Member } from '@/data/types';
import { colors, fonts, space } from '@/theme';

const NUMBER_WORDS = ['No one', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];

function listNames(names: string[]) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function summary(members: Member[]) {
  const checkedIn = members.filter((m) => m.lastSyncMin <= 60).length;
  const everyone = checkedIn === members.length;
  const count = NUMBER_WORDS[members.length] ?? String(members.length);
  const title = everyone
    ? `All ${count.toLowerCase()} checked in within the hour`
    : `${NUMBER_WORDS[checkedIn] ?? checkedIn} of ${count.toLowerCase()} checked in this hour`;

  const flagged = members.filter((m) => m.state === 'attention');
  const offline = members.filter((m) => m.state === 'offline');
  const detail =
    flagged.length === 1
      ? `Only ${flagged[0].name}'s heart rate needs a look.`
      : flagged.length > 1
        ? `${listNames(flagged.map((m) => m.name))} need a look.`
        : offline.length > 0
          ? `${listNames(offline.map((m) => m.name))} ${offline.length === 1 ? 'isn’t' : 'aren’t'} sharing right now.`
          : 'Everyone looks good right now.';
  return { title, detail, flagged };
}

export default function FamilyScreen() {
  const { members, focus } = useFamily();
  const { title, detail, flagged } = summary(members);

  const openHero = () => {
    if (flagged[0]) {
      focus(flagged[0].id);
      router.navigate('/trends');
    }
  };

  const openMember = (m: Member) => {
    focus(m.id);
    // Members without location sharing (Pedro's Garmin) open on heart rate.
    router.navigate(m.location ? '/map' : '/trends');
  };

  return (
    <Screen>
      <ScreenHeader
        icon={<PingGlyph size={26} color={colors.primary} />}
        title="Ping"
        subtitle={todayLabel()}
      />

      <Pressable onPress={openHero} accessibilityRole="button" accessibilityLabel={`${title}. ${detail}`}>
        <Card dark style={styles.hero}>
          <OrbitGraphic
            dots={members.map((m) =>
              m.state === 'attention' ? colors.amber : m.state === 'offline' ? '#4B5575' : m.avatar.bg,
            )}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>{title}</Text>
            <Text style={styles.heroBody}>{detail}</Text>
          </View>
        </Card>
      </Pressable>

      <SectionHeader title="Family" action="Edit" onAction={() => router.navigate('/settings')} />

      <Card style={styles.list}>
        {members.map((m, i) => (
          <Pressable
            key={m.id}
            onPress={() => openMember(m)}
            accessibilityRole="button"
            accessibilityLabel={`${m.name}, ${m.heartRate ?? 'no'} beats per minute, ${statusLine(m)}`}
            style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && styles.pressed]}>
            <Avatar member={m} />
            <View style={styles.rowText}>
              <Text style={styles.name}>{m.name}</Text>
              <Text
                style={[styles.status, m.state === 'attention' && { color: colors.amberInk }]}
                numberOfLines={1}>
                {statusLine(m)}
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={[styles.bpm, m.heartRate === null && { color: colors.faint }]}>
                {m.heartRate ?? '--'}
                <Text style={styles.bpmUnit}> bpm</Text>
              </Text>
              <Sparkline
                data={m.live ? m.live.recent.slice(-30).map((r) => r.bpm) : m.heartRateHistory.slice(-10)}
                color={m.state === 'ok' ? colors.green : stateColor[m.state]}
              />
            </View>
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    padding: space.lg,
    paddingRight: space.xl,
    borderRadius: 22,
  },
  heroTitle: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22, color: colors.navyInk },
  heroBody: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.navyMuted, marginTop: 6 },
  list: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 14, gap: space.md },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  pressed: { backgroundColor: '#F8F9FC' },
  rowText: { flex: 1 },
  name: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  status: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  metric: { alignItems: 'flex-end', gap: 4 },
  bpm: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.ink },
  bpmUnit: { fontFamily: fonts.body, fontSize: 10.5, color: colors.muted },
});
