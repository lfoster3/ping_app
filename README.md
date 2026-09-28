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
    (tabs)/index.tsx   # Family — hero summary + member list
    (tabs)/map.tsx     # Location — live map + today's timeline
    (tabs)/trends.tsx  # Heart Rate — live card, 24h/7d chart, zones
    (tabs)/settings.tsx
    send-ping.tsx      # modal: choose people + message, "Ping sent" state
    notifications.tsx  # modal: alerts + pings you sent
  components/          # shared UI (tab bar, avatar, charts, map, ...)
  data/                # types, mock data, FamilyProvider (app state)
  theme/               # colours, type, spacing — tokens from the mockups
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
