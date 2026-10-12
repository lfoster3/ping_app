// Receives a voice note from the band (over its own Wi-Fi) or the phone app.
//
//   POST /functions/v1/voice-note?from=nico&to=mom&duration=7.2
//   apikey: <project publishable key>
//   Content-Type: audio/wav            (or audio/mp4, audio/webm, audio/ogg, audio/mpeg)
//   <raw audio bytes>
//
// Optional query params: id (a UUID, so a retry doesn't send twice) and
// source=phone (defaults to band). Responds 201 with { message } right away;
// the transcript and the push notification follow in the background.

import { notifyRecipient } from '../_shared/push.ts';
import { admin, corsHeaders, hasAppKey, json, type MessageRow } from '../_shared/supabase.ts';
import { transcribe, transcriberConfigured } from '../_shared/transcribe.ts';

/** Provided by the Supabase Edge Runtime: keeps working after the response is sent. */
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const MAX_BYTES = 10 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Audio types we accept, and the extension the file is stored (and transcribed) under. */
const EXTENSIONS: Record<string, string> = {
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/opus': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/mpeg': 'mp3',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST the audio file' }, 405);
  if (!hasAppKey(req)) return json({ error: 'Missing or unknown apikey header' }, 401);

  const q = new URL(req.url).searchParams;
  const from = q.get('from');
  const to = q.get('to');
  const id = q.get('id') ?? crypto.randomUUID();
  const duration = Number(q.get('duration'));
  if (!from || !to || from === to) return json({ error: 'Need different `from` and `to` member ids' }, 400);
  if (!UUID.test(id)) return json({ error: '`id` must be a UUID' }, 400);

  const contentType = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const ext = EXTENSIONS[contentType];
  if (!ext) return json({ error: `Unsupported Content-Type "${contentType}"`, accepted: Object.keys(EXTENSIONS) }, 415);

  const audio = new Uint8Array(await req.arrayBuffer());
  if (audio.length === 0) return json({ error: 'Empty body' }, 400);
  if (audio.length > MAX_BYTES) return json({ error: 'Voice notes are capped at 10 MB' }, 413);

  // Check both people exist before storing anything.
  const { data: members, error: membersError } = await admin.from('members').select('id').in('id', [from, to]);
  if (membersError) return json({ error: membersError.message }, 500);
  if (members.length !== 2) return json({ error: 'Unknown `from` or `to` member' }, 400);

  const path = `${to}/${id}.${ext}`;
  const upload = await admin.storage.from('voice-notes').upload(path, audio, { contentType, upsert: false });
  if (upload.error) {
    const duplicate = /exists/i.test(upload.error.message);
    return json({ error: duplicate ? 'This voice note was already sent' : upload.error.message }, duplicate ? 409 : 500);
  }

  const { data: message, error } = await admin
    .from('messages')
    .insert({
      id,
      sender: from,
      recipient: to,
      kind: 'voice',
      audio_path: path,
      audio_source: q.get('source') === 'phone' ? 'phone' : 'band',
      duration_sec: Number.isFinite(duration) && duration > 0 ? duration : null,
      transcript_status: transcriberConfigured() ? 'pending' : 'off',
    })
    .select()
    .single<MessageRow>();
  if (error) {
    await admin.storage.from('voice-notes').remove([path]);
    return json({ error: error.message }, 500);
  }

  // Transcribe, then notify with the transcript so the lock screen shows what was said.
  EdgeRuntime.waitUntil(finish(message, audio, contentType, ext));
  return json({ message }, 201);
});

async function finish(message: MessageRow, audio: Uint8Array<ArrayBuffer>, contentType: string, ext: string) {
  let latest = message;
  if (message.transcript_status === 'pending') {
    let update: Partial<MessageRow>;
    try {
      update = { transcript: await transcribe(audio, contentType, ext), transcript_status: 'done' };
    } catch (e) {
      console.error(e);
      update = { transcript_status: 'failed' };
    }
    const { data } = await admin.from('messages').update(update).eq('id', message.id).select().single<MessageRow>();
    if (data) latest = data;
  }
  try {
    await notifyRecipient(latest);
  } catch (e) {
    console.error('Push failed', e);
  }
}
