// Sends the push notification for a text or ping the app just saved.
//   POST /functions/v1/notify   { "messageId": "<uuid>" }
// Voice notes notify from the voice-note function once their transcript is in.

import { notifyRecipient } from '../_shared/push.ts';
import { admin, corsHeaders, hasAppKey, json, type MessageRow } from '../_shared/supabase.ts';

/** Only fresh messages, so the endpoint can't be used to replay old notifications. */
const MAX_AGE_MS = 5 * 60_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST { messageId }' }, 405);
  if (!hasAppKey(req)) return json({ error: 'Missing or unknown apikey header' }, 401);

  const { messageId } = (await req.json().catch(() => ({}))) as { messageId?: string };
  if (!messageId) return json({ error: 'Need messageId' }, 400);

  const { data: message } = await admin.from('messages').select().eq('id', messageId).maybeSingle<MessageRow>();
  if (!message) return json({ error: 'No such message' }, 404);
  if (message.kind === 'voice') return json({ skipped: 'Voice notes notify themselves' });
  if (Date.now() - Date.parse(message.created_at) > MAX_AGE_MS) return json({ skipped: 'Message is too old' });

  await notifyRecipient(message);
  return json({ ok: true });
});
