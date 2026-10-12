import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

export { corsHeaders };

/** Keys arrive as a JSON object of named keys; local CLI runs set a single key instead. */
function keys(jsonVar: string, singleVar: string): string[] {
  const json = Deno.env.get(jsonVar);
  if (json) {
    try {
      return Object.values(JSON.parse(json)).filter((k): k is string => typeof k === 'string');
    } catch {
      // Fall through to the single-key variable.
    }
  }
  const single = Deno.env.get(singleVar);
  return single ? [single] : [];
}

const secretKey = keys('SUPABASE_SECRET_KEYS', 'SUPABASE_SECRET_KEY')[0] ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!secretKey) throw new Error('No secret key in the function environment');

/** Bypasses row level security — only for work the function has already checked. */
export const admin = createClient(Deno.env.get('SUPABASE_URL')!, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const appKeys = [
  ...keys('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_PUBLISHABLE_KEY'),
  Deno.env.get('SUPABASE_ANON_KEY'),
].filter(Boolean);

/** The app and the band send the project's publishable key in the `apikey` header. */
export const hasAppKey = (req: Request) => appKeys.includes(req.headers.get('apikey') ?? '');

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** One row of public.messages (see supabase/migrations). */
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
