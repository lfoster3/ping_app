# Ping

A family "Whoop": parents see where their kids are and how they're doing (heart rate, activity), and can ping anyone in the family circle to check in.

Built with Expo (React Native + TypeScript) and Expo Router.

## Run it

```bash
npm install
npm start          # then press i (iOS), a (Android) or w (web)
```

## Structure

```
src/
  app/                 # screens (Expo Router — every file is a route)
    (tabs)/index.tsx   # Family — hero summary + member list (with unread messages)
    (tabs)/messages.tsx# Messages — one conversation per family member
    (tabs)/map.tsx     # Location — live map + today's timeline
    (tabs)/trends.tsx  # Heart Rate — live card, 24h/7d chart, zones
    chat/[id].tsx      # a conversation: texts, pings, voice notes, mic
    settings.tsx       # opened from the gear; also "This phone is…"
    send-ping.tsx      # modal: choose people + message, "Ping sent" state
    notifications.tsx  # modal: alerts + pings you sent
  components/          # shared UI (tab bar, avatar, charts, map, ...)
  data/                # types, mock data, FamilyProvider (app state)
  messaging/           # MessagesProvider, Supabase/local backends, recorder, player, push
  theme/               # colours, type, spacing — tokens from the mockups
supabase/
  migrations/          # tables, demo policies, voice-notes storage bucket
  functions/           # voice-note (band + phone upload), notify (push for texts)
```

All screens read from `useFamily()` (`src/data/FamilyProvider.tsx`). The data is mocked in
`src/data/mock.ts`; replacing it with the real band/backend feed only touches the provider.

The map is a stylised SVG (`src/components/FamilyMap.tsx`) so it runs without API keys.
Swap it for `react-native-maps` when real GPS coordinates are available.

## Live heart rate from a Garmin (Pedro)

Until the Ping sensors exist, **Pedro** streams real heart rate from a Garmin watch using the
standard Bluetooth Heart Rate profile (no Garmin developer account needed).

1. On the watch, turn on **Broadcast Heart Rate**
   (Settings › Sensors & Accessories › Wrist Heart Rate › Broadcast Heart Rate, or add the
   "Broadcast HR" control). Older models that only broadcast over ANT+ won't work.
2. Connect from **Trends** (pick Pedro) or **Settings › Devices › Pedro's Garmin**.

Where it works:

| Where | How | Notes |
| --- | --- | --- |
| Chrome / Edge on the Mac | `npm run web`, open http://localhost:8081 | Web Bluetooth. Give Chrome Bluetooth access in System Settings › Privacy & Security › Bluetooth. Safari/Firefox can't. |
| iPhone / Android | `npx expo run:ios --device` (or `run:android`) | Needs a development build — Expo Go has no Bluetooth module. Simulators have no Bluetooth. |

The app reconnects automatically if the watch drops out, until you tap Disconnect.
In development there's also a clearly labelled **simulated signal** for demos without the watch.

Code: `src/devices/` (packet parser, Web Bluetooth + react-native-ble-plx monitors, simulator),
wired into `FamilyProvider` which turns the stream into Pedro's member data.
Live data isn't stored yet — reloading the app starts Pedro's history fresh.

## Pedro's history (Garmin + WHOOP snapshot)

`src/data/pedroHistory.ts` holds 30 days of Pedro's real heart-rate data, pulled through the
AthleteData connector (not called by the app itself — those APIs only update after the watch
syncs, so they can't give live readings):

- **Resting heart rate & HRV** — WHOOP, measured overnight. "Usual" = median of the previous days.
  A resting HR 5+ bpm over usual flags Pedro as "above usual" when the watch isn't streaming.
- **Daily range** — Garmin all-day low / average / high.
- **Workouts** — sessions recorded on the Garmin with average and max HR.

Sleep and recovery scores are intentionally left out. To refresh, ask Claude to pull a new
snapshot and replace the arrays in that file.

## Messaging and voice notes

Every family member has a one-to-one conversation with everyone else: texts, pings, and voice
notes. Voice notes are stored as audio and get a transcript added a few seconds later. The
band will record when its button is pressed and upload over its own Wi-Fi. Until the band
exists, the phone's mic button in a conversation sends exactly the same request.

```
band / phone ──POST audio──▶ voice-note function ──▶ storage (voice-notes bucket)
                                   │                 └─▶ messages table ──realtime──▶ phones
                                   └─(background)─▶ transcribe ─▶ update row ─▶ push to recipient
```

**Without Supabase**, the app runs in demo mode: mock conversations, recording and playback
work, but everything stays on that phone and there are no transcripts.

### Set up the backend (once)

1. Create a project at [supabase.com](https://supabase.com).
2. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key
   (Project Settings › API Keys), then restart `npm start`.
3. Create the tables and deploy the functions:

   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   npx supabase functions deploy voice-note notify --use-api
   ```

   (Or paste `supabase/migrations/*.sql` into the dashboard's SQL editor.)
4. Turn on transcripts (optional): `npx supabase secrets set OPENAI_API_KEY=sk-...`.
   Without it voice notes still send; they just have no text. To use another
   speech-to-text provider, edit `supabase/functions/_shared/transcribe.ts`.

To message between two phones, set **Settings › This phone is** to a different person on each.

> **Demo security:** there are no accounts yet, so the database policies let anyone with the
> publishable key read and send messages. Fine for a class demo with mock family members; add
> Supabase Auth and per-family policies before real families use it.

### Push notifications

Phones register for push automatically when Supabase is configured, which needs:

- an EAS project id: `npx eas-cli@latest init` (adds it to `app.json`)
- a development build on a real device (`npx expo run:ios --device`), not a simulator or Expo Go
- push credentials: an APNs key (iOS) or FCM (Android) uploaded with `npx eas-cli@latest credentials`.
  See [Expo's push setup guide](https://docs.expo.dev/push-notifications/push-notifications-setup/).

**Settings › Messaging** shows whether this phone is registered and, if not, why. Tapping a
notification opens the conversation.

### What the band sends

The band uploads one HTTPS request per voice note:

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/voice-note?from=nico&to=mom&duration=6.8" \
  -H "apikey: <publishable key>" \
  -H "Content-Type: audio/wav" \
  --data-binary @note.wav
```

- `from` / `to`: member ids (`mom`, `dad`, `nico`, `luke`, `pedro`).
- `duration`: seconds (optional). Optional `id`: a UUID, so a retried upload isn't sent twice.
- Body: the raw audio, up to 10 MB. Accepted types: `audio/wav`, `audio/ogg` (Opus),
  `audio/mpeg`, `audio/mp4`, `audio/webm`. Compressed Opus keeps a 10-second note around 20 KB.
- Responses: `201 { message }` once it's stored. `400` for bad parameters, `401` for a wrong
  key, `409` if that `id` was already sent, `415` for an unsupported type.
