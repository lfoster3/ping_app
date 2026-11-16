-- Live readings from the Ping band: GPS position + heart rate, one row per
-- packet the band sends (about 1 per second while a bridge is running).
--
-- Written only by the band-telemetry Edge Function (service role), so there is
-- no insert policy here. DEMO SECURITY: like the messaging tables, anyone with
-- the publishable key can read it. Tighten before real families use this.

create table public.band_telemetry (
  id bigint generated always as identity primary key,
  member_id text not null references public.members (id),
  -- When the band took the reading (the bridge's clock minus the fix age).
  recorded_at timestamptz not null,
  received_at timestamptz not null default now(),
  -- Heart rate: null unless the band reported a trustworthy value.
  hr_bpm smallint check (hr_bpm between 30 and 220),
  hr_finger boolean not null default false,
  -- GPS: lat/lng are null when there is no fix.
  gps_fix boolean not null default false,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  alt_m real,
  speed_mps real,
  sats smallint,
  hdop real
);

create index band_telemetry_member_time_idx on public.band_telemetry (member_id, recorded_at desc);

alter publication supabase_realtime add table public.band_telemetry;

alter table public.band_telemetry enable row level security;
create policy "demo: read band telemetry" on public.band_telemetry for select to anon, authenticated using (true);
grant select on public.band_telemetry to anon, authenticated;

-- Housekeeping for demos: at 1 row/second this grows ~86k rows a day. Run
-- manually (or schedule with pg_cron) to keep a week:
--   delete from public.band_telemetry where recorded_at < now() - interval '7 days';
