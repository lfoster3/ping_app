import { admin, type MessageRow } from './supabase.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function preview(m: MessageRow): string {
  if (m.kind === 'ping') return `Ping · ${m.text}`;
  if (m.kind === 'text') return clip(m.text ?? '');
  if (m.transcript) return `🎤 “${clip(m.transcript, 120)}”`;
  const sec = Math.round(m.duration_sec ?? 0);
  return sec ? `🎤 Voice note (${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')})` : '🎤 Voice note';
}

/**
 * Sends a notification to every phone signed in as the recipient. Tapping it
 * opens the conversation (the app reads `data.url`).
 */
export async function notifyRecipient(m: MessageRow): Promise<void> {
  const [{ data: tokens }, { data: sender }] = await Promise.all([
    admin.from('push_tokens').select('token').eq('member_id', m.recipient),
    admin.from('members').select('name').eq('id', m.sender).single(),
  ]);
  if (!tokens?.length) return;

  const pushes = tokens.map(({ token }) => ({
    to: token,
    title: sender?.name ?? m.sender,
    body: preview(m),
    sound: 'default',
    // Matches the channel the app creates (src/messaging/push.ts).
    channelId: 'messages',
    data: { url: `/chat/${m.sender}`, messageId: m.id },
  }));

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(pushes),
  });
  if (!res.ok) {
    console.error('Expo push failed', res.status, await res.text());
    return;
  }

  // Forget phones that uninstalled the app or revoked permission.
  const { data: tickets } = (await res.json()) as {
    data: { status: 'ok' | 'error'; details?: { error?: string } }[];
  };
  const dead = tickets
    .map((t, i) => (t.details?.error === 'DeviceNotRegistered' ? pushes[i].to : null))
    .filter((t): t is string => t !== null);
  if (dead.length) await admin.from('push_tokens').delete().in('token', dead);
}
