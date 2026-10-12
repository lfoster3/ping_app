-- Ping messaging: 1:1 conversations between family members, voice notes from
-- the band (over its own Wi-Fi) or the phone, read positions and push tokens.
--
-- DEMO SECURITY: there are no accounts yet, so the policies below let anyone
-- holding the publishable key read and write. Replace them with per-family
-- policies (auth.uid() → member) before real families use this.

create table public.members (
  id text primary key,
  name text not null
);

insert into public.members (id, name) values
  ('mom', 'Mom'),
  ('dad', 'Dad'),
  ('nico', 'Nico'),
  ('luke', 'Luke'),
  ('pedro', 'Pedro');

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender text not null references public.members (id),
  recipient text not null references public.members (id),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('text', 'ping', 'voice')),
  -- text and ping
  text text,
  -- voice notes
  audio_path text,
  audio_source text check (audio_source in ('band', 'phone')),
  duration_sec real,
  transcript text,
  transcript_status text check (transcript_status in ('pending', 'done', 'failed', 'off')),
  constraint text_has_text check (kind = 'voice' or text is not null),
  constraint voice_has_audio check (kind <> 'voice' or audio_path is not null)
);

create index messages_sender_idx on public.messages (sender, created_at);
create index messages_recipient_idx on public.messages (recipient, created_at);

-- When `reader` last read their conversation with `other`.
create table public.thread_reads (
  reader text not null references public.members (id),
  other text not null references public.members (id),
  read_at timestamptz not null,
  primary key (reader, other)
);

-- Expo push tokens; one member can have several phones.
create table public.push_tokens (
  token text primary key,
  member_id text not null references public.members (id),
  updated_at timestamptz not null default now()
);

-- Live updates for new messages and arriving transcripts.
alter publication supabase_realtime add table public.messages;

alter table public.members enable row level security;
alter table public.messages enable row level security;
alter table public.thread_reads enable row level security;
alter table public.push_tokens enable row level security;

create policy "demo: read members" on public.members for select to anon, authenticated using (true);
create policy "demo: read messages" on public.messages for select to anon, authenticated using (true);
create policy "demo: send text and pings" on public.messages for insert to anon, authenticated
  with check (kind in ('text', 'ping'));
create policy "demo: read positions" on public.thread_reads for all to anon, authenticated using (true) with check (true);
create policy "demo: register push tokens" on public.push_tokens for all to anon, authenticated using (true) with check (true);

grant select on public.members to anon, authenticated;
grant select, insert on public.messages to anon, authenticated;
grant select, insert, update on public.thread_reads to anon, authenticated;
grant select, insert, update on public.push_tokens to anon, authenticated;

-- Voice note audio. Private; the app plays notes through short-lived signed URLs.
-- Only the voice-note function (service role) uploads.
insert into storage.buckets (id, name, public, file_size_limit)
values ('voice-notes', 'voice-notes', false, 10485760);

create policy "demo: play voice notes" on storage.objects for select to anon, authenticated
  using (bucket_id = 'voice-notes');
