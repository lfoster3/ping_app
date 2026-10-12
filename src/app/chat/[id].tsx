import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { PingGlyph } from '@/components/PingGlyph';
import { useFamily } from '@/data/FamilyProvider';
import { duration, messageTime, statusLine } from '@/data/format';
import type { Message, VoiceNote } from '@/data/types';
import { useMessages } from '@/messaging/MessagesProvider';
import { useVoicePlayer } from '@/messaging/useVoicePlayer';
import { useVoiceRecorder } from '@/messaging/useVoiceRecorder';
import { colors, fonts, radius, space } from '@/theme';

/** Show a time label above a message when this much time passed since the previous one. */
const TIME_GAP_MS = 30 * 60_000;

type VoiceMessage = Message & { body: VoiceNote };
const isVoice = (m: Message): m is VoiceMessage => m.body.kind === 'voice';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { memberById, meId } = useFamily();
  const { thread, sendMessage, sendVoice, markThreadRead } = useMessages();
  const member = memberById(id);
  const messages = thread(id);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const recorder = useVoiceRecorder();
  const player = useVoicePlayer();

  // Opening the conversation (or a new message arriving while it's open) reads it.
  useEffect(() => {
    markThreadRead(id);
  }, [id, messages.length, markThreadRead]);

  if (!member) {
    return (
      <View style={[styles.root, styles.missing, { paddingTop: insets.top }]}>
        <Text style={styles.missingText}>Conversation not found</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.missingLink}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    sendMessage(member.id, text);
    setDraft('');
  };

  const sendRecording = async () => {
    const recording = await recorder.stop();
    if (recording) sendVoice(member.id, recording);
  };

  const problem = recorder.error ?? player.error;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </Pressable>
        <Avatar member={member} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName}>{member.name}</Text>
          <Text style={styles.headerStatus} numberOfLines={1}>
            {statusLine(member)}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.thread}
        keyboardDismissMode="interactive"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
        {messages.length === 0 && (
          <Text style={styles.empty}>No messages yet. Voice notes from {member.name}’s band will show up here too.</Text>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          return (
            <View key={m.id}>
              {(!prev || m.at - prev.at > TIME_GAP_MS) && <Text style={styles.timeLabel}>{messageTime(m.at)}</Text>}
              {isVoice(m) ? (
                <VoiceBubble
                  message={m}
                  mine={m.from === meId}
                  senderName={member.name}
                  playing={player.isPlaying(m.id)}
                  progress={player.progress(m)}
                  onToggle={() => player.toggle(m)}
                />
              ) : (
                <Bubble message={m} mine={m.from === meId} />
              )}
            </View>
          );
        })}
      </ScrollView>

      {problem && <Text style={styles.problem}>{problem}</Text>}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        {recorder.recording ? (
          <>
            <Pressable
              onPress={() => recorder.cancel()}
              accessibilityRole="button"
              accessibilityLabel="Discard recording"
              style={({ pressed }) => [styles.roundBtn, styles.cancelBtn, pressed && { opacity: 0.7 }]}>
              <Ionicons name="trash-outline" size={19} color={colors.red} />
            </Pressable>
            <View style={styles.recordingBar} accessibilityLiveRegion="polite">
              <View style={styles.recDot} />
              <Text style={styles.recText}>Recording · {duration(recorder.durationSec)}</Text>
            </View>
            <Pressable
              onPress={sendRecording}
              accessibilityRole="button"
              accessibilityLabel="Send voice note"
              style={({ pressed }) => [styles.roundBtn, pressed && { opacity: 0.7 }]}>
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </Pressable>
          </>
        ) : (
          <>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={`Message ${member.name}`}
              placeholderTextColor={colors.faint}
              style={styles.input}
              multiline
              onSubmitEditing={send}
              submitBehavior="submit"
              returnKeyType="send"
            />
            {draft.trim() ? (
              <Pressable
                onPress={send}
                accessibilityRole="button"
                accessibilityLabel="Send"
                style={({ pressed }) => [styles.roundBtn, pressed && { opacity: 0.7 }]}>
                <Ionicons name="arrow-up" size={20} color="#fff" />
              </Pressable>
            ) : (
              <Pressable
                onPress={recorder.start}
                accessibilityRole="button"
                accessibilityLabel="Record a voice note"
                style={({ pressed }) => [styles.roundBtn, pressed && { opacity: 0.7 }]}>
                <Ionicons name="mic" size={20} color="#fff" />
              </Pressable>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ message, mine }: { message: Message; mine: boolean }) {
  const { body } = message;
  const align = mine ? styles.mineRow : styles.theirsRow;

  if (body.kind === 'ping') {
    return (
      <View style={align}>
        <View style={[styles.bubble, styles.ping]}>
          <PingGlyph size={16} color={colors.primary} />
          <Text style={styles.pingText}>Ping · {body.text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={align}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        <Text style={[styles.text, mine && { color: '#fff' }]}>{body.kind === 'text' ? body.text : ''}</Text>
      </View>
    </View>
  );
}

const TRANSCRIPT: Record<VoiceNote['transcriptStatus'], string | null> = {
  pending: 'Transcribing…',
  failed: 'Couldn’t transcribe this one',
  off: null,
  done: null,
};

type VoiceBubbleProps = {
  message: VoiceMessage;
  mine: boolean;
  senderName: string;
  playing: boolean;
  progress: number;
  onToggle: () => void;
};

function VoiceBubble({ message, mine, senderName, playing, progress, onToggle }: VoiceBubbleProps) {
  const note = message.body;
  const ink = mine ? '#fff' : colors.primary;
  const bars = waveform(message.id);
  const played = Math.round(progress * bars.length);
  const transcript = note.transcriptStatus === 'done' && note.transcript ? `“${note.transcript}”` : TRANSCRIPT[note.transcriptStatus];

  return (
    <View style={mine ? styles.mineRow : styles.theirsRow}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs, styles.voice]}>
        <View style={styles.voiceRow}>
          <Pressable
            onPress={onToggle}
            disabled={!note.audio}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={!note.audio ? 'Voice note' : playing ? 'Pause voice note' : 'Play voice note'}
            style={[styles.play, { backgroundColor: mine ? 'rgba(255,255,255,0.2)' : colors.primarySoft }]}>
            <Ionicons name={!note.audio ? 'mic' : playing ? 'pause' : 'play'} size={15} color={ink} />
          </Pressable>
          <View style={styles.wave}>
            {bars.map((b, i) => (
              <View key={i} style={[styles.bar, { height: b, backgroundColor: ink, opacity: i < played ? 1 : 0.45 }]} />
            ))}
          </View>
          <Text style={[styles.voiceLen, { color: mine ? '#fff' : colors.inkSoft }]}>{duration(note.durationSec)}</Text>
        </View>
        {transcript && (
          <Text style={[styles.transcript, mine && { color: '#DDE2FF' }, note.transcriptStatus !== 'done' && styles.transcriptPending]}>
            {transcript}
          </Text>
        )}
        <Text style={[styles.voiceSource, mine && { color: '#C7CEFF' }]}>
          {note.source === 'band' ? `From ${mine ? 'your' : `${senderName}’s`} band` : 'From phone'}
        </Text>
      </View>
    </View>
  );
}

/** Placeholder bar heights (4–20px), the same every render for a given message. */
function waveform(seed: string, count = 24): number[] {
  let h = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    bars.push(4 + ((h >>> 16) % 17));
  }
  return bars;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerName: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  headerStatus: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 1 },
  thread: { padding: space.lg, gap: 6 },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: space.xxl },
  timeLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11.5,
    color: colors.faint,
    textAlign: 'center',
    marginTop: space.md,
    marginBottom: space.sm,
  },
  mineRow: { alignItems: 'flex-end' },
  theirsRow: { alignItems: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 6 },
  text: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink },
  ping: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    borderBottomRightRadius: 6,
  },
  pingText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.primaryDeep },
  voice: { width: 260, gap: 6 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  play: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  wave: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 22 },
  bar: { flex: 1, borderRadius: 1 },
  voiceLen: { fontFamily: fonts.bodySemi, fontSize: 12 },
  transcript: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft, fontStyle: 'italic' },
  transcriptPending: { fontStyle: 'normal', opacity: 0.8 },
  voiceSource: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.faint },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: { backgroundColor: '#FDECEC' },
  recordingBar: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
  },
  recDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.red },
  recText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'] },
  problem: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.amberInk,
    textAlign: 'center',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  missing: { alignItems: 'center', justifyContent: 'center', gap: space.md },
  missingText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  missingLink: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.primary },
});
