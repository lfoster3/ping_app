import { initialMessages, initialReadAt } from '@/data/mock';
import type { Message } from '@/data/types';
import type { MessagingBackend } from './backend';

/**
 * Keeps messages in memory on this device, seeded with the mock conversations.
 * Lets the app run (and demo voice notes) before Supabase is set up.
 */
export function createLocalBackend(): MessagingBackend {
  let messages = [...initialMessages];
  const readAt: Record<string, Record<string, number>> = Object.fromEntries(
    Object.entries(initialReadAt).map(([me, reads]) => [me, { ...reads }]),
  );

  return {
    mode: 'local',
    load: async (me) => ({
      messages: messages.filter((m) => m.from === me || m.to === me),
      readAt: { ...readAt[me] },
    }),
    subscribe: () => () => {},
    send: async (m) => {
      messages = [...messages, m];
    },
    sendVoice: async (draft) => {
      const m: Message = {
        id: draft.id,
        from: draft.from,
        to: draft.to,
        at: draft.at,
        // No transcriber on-device; that happens in the cloud.
        body: { kind: 'voice', source: 'phone', durationSec: draft.durationSec, audio: { uri: draft.uri }, transcriptStatus: 'off' },
      };
      messages = [...messages, m];
      return m;
    },
    markRead: async (me, other, at) => {
      readAt[me] = { ...readAt[me], [other]: at };
    },
    audioUrl: async (note) => (note.audio && 'uri' in note.audio ? note.audio.uri : null),
    registerPushToken: async () => {},
  };
}
