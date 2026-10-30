# Ping firmware (ESP32-WROOM-32, ESP-IDF, C)

## Build / flash / run
Requires ESP-IDF v5.2 or newer.

    idf.py set-target esp32
    idf.py build flash
    idf.py monitor -b 921600        # or: python tools/ping_serial.py <port>

Close the IDF monitor before running ping_serial.py (only one program can own the port).

## Serial protocol (921600 8N1, one JSON object per line)
| line | when |
|---|---|
| `{"t":"boot",...}` | startup; shows which sensors answered |
| `{"t":"telemetry","gps":{...},"hr":{...}}` | every 1 s (TELEMETRY_PERIOD_MS) |
| `{"t":"btn","state":"down"/"up"}` | button edges |
| `audio_start` / `audio` / `audio_end` | voice message: PCM s16le mono 16 kHz, base64, 512 B per chunk |
| `{"t":"ppg",...}` | raw IR/red, only if STREAM_RAW_PPG=1 in config.h |
| `{"t":"error",...}` | sensor problems |

GPS block when locked: `fix,lat,lon,alt,spd_kmh,sats,hdop,utc,age_ms`; otherwise `fix:0`.
HR block: `bpm,valid,finger` (bpm=0 while `valid` is 0).

## Host-side tests (no hardware)
    cd test && gcc -I../main host_tests.c ../main/nmea.c ../main/hr_algo.c -lm -o t && ./t

## Tuning knobs (main/config.h)
HR_LED_CURRENT (wrist usually needs more than a fingertip), AUDIO_SHIFT (mic gain),
MIC_SLOT_INDEX (flip to 1 if the mic is silent), TELEMETRY_PERIOD_MS.
