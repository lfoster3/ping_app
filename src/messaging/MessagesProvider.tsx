import { randomUUID } from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useFamily } from '@/data/FamilyProvider';
import type { Message, VoiceNote } from '@/data/types';
import type { MessagingBackend } from './backend';
import { createLocalBackend } from './local';
import { getPushToken } from './push';
import { createSupabaseBackend } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function createBackend(): MessagingBackend {
  return SUPABASE_URL && SUPABASE_KEY ? createSupabaseBackend(SUPABASE_URL, SUPABASE_KEY) : createLocalBackend();
}

export type Recording = { uri: string; mimeType: string; durationSec: number };

type MessagesContextValue = {
  mode: MessagingBackend['mode'];
  /** 'loading' until the first fetch finishes; 'error' if it failed. */
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  /** Why this phone isn't registered for push, or null when it is (or still trying). */
  pushSkipped: string | null;
  /** A conversation with another member, oldest first. */
  thread: (memberId: string) => Message[];
  /** Messages from that member you haven't opened yet. */
  unreadFrom: (memberId: string) => number;
  unreadMessages: number;
  sendMessage: (to: string, text: string) => void;
  /** Adds the ping to each recipient's conversation. */
  sendPing: (to: string[], text: string) => void;
  sendVoice: (to: string, recording: Recording) => void;
  markThreadRead: (memberId: string) => void;
  audioUrl: (note: VoiceNote) => Promise<string | null>;
};

const MessagesContext = createContext<MessagesContextValue | null>(null);

/** Adds a message, or replaces the copy with the same id (e.g. once its transcript lands). */
function upsert(list: Message[], m: Message): Message[] {
  const i = list.findIndex((x) => x.id === m.id);
  if (i === -1) return [...list, m];
  const next = [...list];
  next[i] = m;
  return next;
}

/** Messages and read positions for one signed-in member. */
type Inbox = { me: string; messages: Message[]; readAt: Record<string, number>; loaded: boolean };
const emptyInbox = (me: string): Inbox => ({ me, messages: [], readAt: {}, loaded: false });

const errorText = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e));

export function MessagesProvider({ children }: { children: ReactNode }) {
  const { meId } = useFamily();
  const [backend] = useState(createBackend);
  const [inbox, setInbox] = useState(() => emptyInbox(meId));
  const [loadError, setLoadError] = useState<{ me: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Switching who's signed in starts from an empty inbox until theirs loads.
  const current = inbox.me === meId ? inbox : emptyInbox(meId);
  const { messages, readAt } = current;
  const failed = loadError?.me === meId ? loadError.message : null;
  const status: MessagesContextValue['status'] = failed ? 'error' : current.loaded ? 'ready' : 'loading';

  /** Applies `fn` to `me`'s inbox, ignoring updates for someone no longer signed in. */
  const update = useCallback((me: string, fn: (inbox: Inbox) => Inbox) => {
    setInbox((prev) => fn(prev.me === me ? prev : emptyInbox(me)));
  }, []);
  const setMessages = useCallback(
    (me: string, fn: (list: Message[]) => Message[]) => update(me, (b) => ({ ...b, messages: fn(b.messages) })),
    [update],
  );
  const [pushSkipped, setPushSkipped] = useState<string | null>(null);

  // Reload whenever the signed-in member changes, and stay subscribed for live updates.
  useEffect(() => {
    let cancelled = false;
    const unsubscribe = backend.subscribe(meId, (m) => !cancelled && setMessages(meId, (prev) => upsert(prev, m)));
    backend
      .load(meId)
      .then((loaded) => {
        if (cancelled) return;
        // Keep anything realtime delivered while the load was in flight.
        update(meId, (b) => ({ ...b, messages: b.messages.reduce(upsert, loaded.messages), readAt: loaded.readAt, loaded: true }));
        setLoadError(null);
      })
      .catch((e: unknown) => !cancelled && setLoadError({ me: meId, message: errorText(e) }));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [backend, meId, update, setMessages]);

  // Register this phone so the `notify` function can reach whoever is signed in.
  useEffect(() => {
    if (backend.mode !== 'cloud') return;
    let cancelled = false;
    getPushToken()
      .then(async (result) => {
        if (cancelled) return;
        if ('skipped' in result) return setPushSkipped(result.skipped);
        await backend.registerPushToken(meId, result.token);
        setPushSkipped(null);
      })
      .catch((e: unknown) => !cancelled && setPushSkipped(errorText(e)));
    return () => {
      cancelled = true;
    };
  }, [backend, meId]);

  const report = useCallback((e: unknown) => setError(errorText(e)), []);

  const thread = useCallback(
    (memberId: string) =>
      messages
        .filter((m) => (m.from === meId && m.to === memberId) || (m.from === memberId && m.to === meId))
        .sort((a, b) => a.at - b.at),
    [messages, meId],
  );

  const unreadByMember = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of messages) {
      if (m.to === meId && m.at > (readAt[m.from] ?? 0)) counts[m.from] = (counts[m.from] ?? 0) + 1;
    }
    return counts;
  }, [messages, readAt, meId]);

  const unreadFrom = useCallback((memberId: string) => unreadByMember[memberId] ?? 0, [unreadByMember]);

  const post = useCallback(
    (m: Message) => {
      setMessages(m.from, (prev) => upsert(prev, m));
      backend.send(m).catch(report);
    },
    [backend, report, setMessages],
  );

  const sendMessage = useCallback(
    (to: string, text: string) => post({ id: randomUUID(), from: meId, to, at: Date.now(), body: { kind: 'text', text } }),
    [post, meId],
  );

  const sendPing = useCallback(
    (to: string[], text: string) => {
      const at = Date.now();
      for (const id of to) post({ id: randomUUID(), from: meId, to: id, at, body: { kind: 'ping', text } });
    },
    [post, meId],
  );

  const sendVoice = useCallback(
    (to: string, rec: Recording) => {
      const draft = { id: randomUUID(), from: meId, to, at: Date.now(), ...rec };
      // Show it straight away from the local file while it uploads.
      setMessages(meId, (prev) =>
        upsert(prev, {
          id: draft.id,
          from: meId,
          to,
          at: draft.at,
          body: {
            kind: 'voice',
            source: 'phone',
            durationSec: rec.durationSec,
            audio: { uri: rec.uri },
            transcriptStatus: backend.mode === 'cloud' ? 'pending' : 'off',
          },
        }),
      );
      backend
        .sendVoice(draft)
        .then((saved) => setMessages(draft.from, (prev) => upsert(prev, saved)))
        .catch(report);
    },
    [backend, meId, report, setMessages],
  );

  const markThreadRead = useCallback(
    (memberId: string) => {
      // Use the newest message's own timestamp so phone clock drift can't hide new ones.
      const last = thread(memberId).filter((m) => m.from === memberId).at(-1);
      if (!last || last.at <= (readAt[memberId] ?? 0)) return;
      update(meId, (b) => ({ ...b, readAt: { ...b.readAt, [memberId]: last.at } }));
      backend.markRead(meId, memberId, last.at).catch(report);
    },
    [backend, meId, readAt, thread, report, update],
  );

  const value = useMemo<MessagesContextValue>(
    () => ({
      mode: backend.mode,
      status,
      error: failed ?? error,
      pushSkipped,
      thread,
      unreadFrom,
      unreadMessages: Object.values(unreadByMember).reduce((a, b) => a + b, 0),
      sendMessage,
      sendPing,
      sendVoice,
      markThreadRead,
      audioUrl: backend.audioUrl,
    }),
    [backend, status, failed, error, pushSkipped, thread, unreadFrom, unreadByMember, sendMessage, sendPing, sendVoice, markThreadRead],
  );

  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>;
}

export function useMessages() {
  const ctx = useContext(MessagesContext);
  if (!ctx) throw new Error('useMessages must be used inside <MessagesProvider>');
  return ctx;
}
