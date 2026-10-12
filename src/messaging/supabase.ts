import { createClient } from '@supabase/supabase-js';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import type { Message } from '@/data/types';
import type { MessagingBackend, VoiceDraft } from './backend';

/** One row of public.messages (supabase/migrations). */
export type MessageRow = {
  id: string;
  sender: string;
  recipient: string;
  created_at: string;
  kind: 'text' | 'ping' | 'voice';
  text: string | null;
  audio_path: string | null;
  audio_source: 'band' | 'phone' | null;
  duration_sec: number | null;
  transcript: string | null;
  transcript_status: 'pending' | 'done' | 'failed' | 'off' | null;
};

export function fromRow(r: MessageRow): Message {
  const base = { id: r.id, from: r.sender, to: r.recipient, at: Date.parse(r.created_at) };
  if (r.kind === 'voice') {
    return {
      ...base,
      body: {
        kind: 'voice',
        source: r.audio_source ?? 'band',
        durationSec: r.duration_sec ?? 0,
        audio: r.audio_path ? { path: r.audio_path } : undefined,
        transcriptStatus: r.transcript_status ?? 'pending',
        transcript: r.transcript ?? undefined,
      },
    };
  }
  return { ...base, body: { kind: r.kind, text: r.text ?? '' } };
}

function toRow(m: Message): Partial<MessageRow> {
  if (m.body.kind === 'voice') throw new Error('Voice notes go through sendVoice');
  return {
    id: m.id,
    sender: m.from,
    recipient: m.to,
    // created_at is left to the database so every phone shares one clock.
    kind: m.body.kind,
    text: m.body.text,
  };
}

async function readAudio(uri: string): Promise<ArrayBuffer> {
  // Web recordings are blob: URLs; native ones are files on disk.
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  return new File(uri).arrayBuffer();
}

export function createSupabaseBackend(url: string, publishableKey: string): MessagingBackend {
  // No accounts yet, so no session to persist.
  const supabase = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return {
    mode: 'cloud',

    load: async (me) => {
      const [messages, reads] = await Promise.all([
        supabase
          .from('messages')
          .select('*')
          .or(`sender.eq.${me},recipient.eq.${me}`)
          .order('created_at', { ascending: true })
          .limit(1000),
        supabase.from('thread_reads').select('other, read_at').eq('reader', me),
      ]);
      if (messages.error) throw messages.error;
      if (reads.error) throw reads.error;
      return {
        messages: (messages.data as MessageRow[]).map(fromRow),
        readAt: Object.fromEntries(reads.data.map((r) => [r.other, Date.parse(r.read_at)])),
      };
    },

    subscribe: (me, onMessage) => {
      const onChange = (payload: { new: unknown }) => {
        // Deletes arrive with an empty `new`.
        const row = payload.new as Partial<MessageRow>;
        if (row.id) onMessage(fromRow(row as MessageRow));
      };
      // Realtime filters take one column at a time, so listen both ways.
      const channel = supabase
        .channel(`messages:${me}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `recipient=eq.${me}` }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `sender=eq.${me}` }, onChange)
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    },

    send: async (m) => {
      const { error } = await supabase.from('messages').insert(toRow(m));
      if (error) throw error;
      // Push is best-effort; the message is already saved.
      supabase.functions.invoke('notify', { body: { messageId: m.id } }).catch(() => {});
    },

    // Same request the band makes over Wi-Fi: raw audio in the body, details in the query.
    sendVoice: async (draft: VoiceDraft) => {
      const query = new URLSearchParams({
        id: draft.id,
        from: draft.from,
        to: draft.to,
        duration: String(draft.durationSec),
        source: 'phone',
      });
      const res = await fetch(`${url}/functions/v1/voice-note?${query}`, {
        method: 'POST',
        headers: { apikey: publishableKey, 'Content-Type': draft.mimeType },
        body: await readAudio(draft.uri),
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await res.text()}`);
      const { message } = (await res.json()) as { message: MessageRow };
      return fromRow(message);
    },

    markRead: async (me, other, at) => {
      const { error } = await supabase
        .from('thread_reads')
        .upsert({ reader: me, other, read_at: new Date(at).toISOString() });
      if (error) throw error;
    },

    audioUrl: async (note) => {
      if (!note.audio) return null;
      if ('uri' in note.audio) return note.audio.uri;
      const { data, error } = await supabase.storage.from('voice-notes').createSignedUrl(note.audio.path, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },

    registerPushToken: async (me, token) => {
      const { error } = await supabase
        .from('push_tokens')
        .upsert({ token, member_id: me, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
  };
}
