import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Screen, ScreenHeader } from '@/components/Screen';
import { useFamily } from '@/data/FamilyProvider';
import { messagePreview, messageTime } from '@/data/format';
import { useMessages } from '@/messaging/MessagesProvider';
import { colors, fonts, space } from '@/theme';

export default function MessagesScreen() {
  const { members, meId } = useFamily();
  const { mode, status, error, thread, unreadFrom, unreadMessages } = useMessages();

  // Most recent conversation first; people you haven't messaged yet go last.
  const conversations = members
    .filter((m) => m.id !== meId)
    .map((member) => ({ member, last: thread(member.id).at(-1), unread: unreadFrom(member.id) }))
    .sort((a, b) => (b.last?.at ?? 0) - (a.last?.at ?? 0));

  return (
    <Screen>
      <ScreenHeader
        icon={<Ionicons name="chatbubbles" size={24} color={colors.primary} />}
        title="Messages"
        subtitle={unreadMessages ? `${unreadMessages} unread` : 'Texts and voice notes'}
      />

      {error && (
        <Card style={styles.notice}>
          <Ionicons name="cloud-offline-outline" size={18} color={colors.amberInk} />
          <Text style={styles.noticeText}>
            {status === 'error' ? 'Couldn’t load messages. ' : 'Something didn’t send. '}
            {error}
          </Text>
        </Card>
      )}

      <Card style={styles.list}>
        {conversations.map(({ member, last, unread }, i) => (
          <Pressable
            key={member.id}
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: member.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${member.name}${unread ? `, ${unread} unread` : ''}`}
            style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && styles.pressed]}>
            <Avatar member={member} />
            <View style={styles.rowText}>
              <View style={styles.topLine}>
                <Text style={styles.name}>{member.name}</Text>
                {last && <Text style={[styles.time, unread > 0 && styles.timeUnread]}>{messageTime(last.at)}</Text>}
              </View>
              <View style={styles.bottomLine}>
                {last?.body.kind === 'voice' && (
                  <Ionicons name="mic" size={13} color={unread ? colors.primary : colors.faint} />
                )}
                <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
                  {last ? messagePreview(last, meId) : `Say hi to ${member.name}`}
                </Text>
                {unread > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unread}</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        ))}
      </Card>

      <Text style={styles.footnote}>
        {mode === 'cloud'
          ? status === 'loading'
            ? 'Loading…'
            : 'Synced with your family’s phones and bands'
          : 'Demo mode: messages stay on this phone until Supabase is set up'}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 14, gap: space.md },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  pressed: { backgroundColor: '#F8F9FC' },
  rowText: { flex: 1, gap: 3 },
  topLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm },
  bottomLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  time: { fontFamily: fonts.body, fontSize: 11.5, color: colors.faint },
  timeUnread: { fontFamily: fonts.bodySemi, color: colors.primary },
  preview: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  previewUnread: { fontFamily: fonts.bodyMedium, color: colors.ink },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 11, color: '#fff' },
  notice: { flexDirection: 'row', gap: space.sm, padding: space.md, marginBottom: space.md, alignItems: 'flex-start' },
  noticeText: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.inkSoft },
  footnote: { fontFamily: fonts.body, fontSize: 12, color: colors.faint, textAlign: 'center', marginTop: space.lg },
});
