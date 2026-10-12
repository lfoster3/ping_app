import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { OrbitGraphic } from '@/components/OrbitGraphic';
import { PingGlyph } from '@/components/PingGlyph';
import { Screen, ScreenHeader, SectionHeader } from '@/components/Screen';
import { Sparkline } from '@/components/Sparkline';
import { useFamily } from '@/data/FamilyProvider';
import { messagePreview, stateColor, statusLine, todayLabel } from '@/data/format';
import { useMessages } from '@/messaging/MessagesProvider';
import type { Member, Message } from '@/data/types';
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
  const { members, focus, meId } = useFamily();
  const { thread, unreadFrom } = useMessages();
  const { title, detail, flagged } = summary(members);

  const openHero = () => {
    if (flagged[0]) {
      focus(flagged[0].id);
      router.navigate('/trends');
    }
  };

  const openMember = (m: Member) => {
    focus(m.id);
    // Members without a location yet open on heart rate.
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
          <View key={m.id} style={i > 0 && styles.rowDivider}>
            <Pressable
              onPress={() => openMember(m)}
              accessibilityRole="button"
              accessibilityLabel={`${m.name}, ${m.heartRate ?? 'no'} beats per minute, ${statusLine(m)}`}
              style={({ pressed }) => [styles.row, m.id !== meId && styles.rowWithMessages, pressed && styles.pressed]}>
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
            {m.id !== meId && <MessageLine member={m} unread={unreadFrom(m.id)} last={thread(m.id).at(-1)} meId={meId} />}
          </View>
        ))}
      </Card>
    </Screen>
  );
}

/** "2 new messages · Practice is running…" under a member; opens the conversation. */
function MessageLine({ member, unread, last, meId }: { member: Member; unread: number; last?: Message; meId: string }) {
  const preview = last ? messagePreview(last, meId) : `Message ${member.name}`;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: member.id } })}
      accessibilityRole="button"
      accessibilityLabel={unread ? `${unread} new ${unread === 1 ? 'message' : 'messages'} from ${member.name}` : `Message ${member.name}`}
      style={({ pressed }) => [styles.messages, pressed && styles.pressed]}>
      <Ionicons
        name={unread ? 'chatbubble' : 'chatbubble-outline'}
        size={13}
        color={unread ? colors.primary : colors.faint}
      />
      <Text style={styles.messagesText} numberOfLines={1}>
        {unread > 0 && (
          <Text style={styles.messagesNew}>
            {unread} new {unread === 1 ? 'message' : 'messages'}
            {last ? ' · ' : ''}
          </Text>
        )}
        {preview}
      </Text>
      <Ionicons name="chevron-forward" size={14} color={colors.faint} />
    </Pressable>
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
  rowWithMessages: { paddingBottom: 8 },
  // Lines up with the name, past the 44px avatar.
  messages: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: space.lg + 44 + space.md,
    paddingRight: space.lg,
    paddingTop: 2,
    paddingBottom: 12,
  },
  messagesText: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
  messagesNew: { fontFamily: fonts.bodySemi, color: colors.primary },
  pressed: { backgroundColor: '#F8F9FC' },
  rowText: { flex: 1 },
  name: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  status: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  metric: { alignItems: 'flex-end', gap: 4 },
  bpm: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.ink },
  bpmUnit: { fontFamily: fonts.body, fontSize: 10.5, color: colors.muted },
});
