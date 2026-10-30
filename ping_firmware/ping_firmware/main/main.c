/*
 * Ping wearable firmware (ESP32, ESP-IDF, C)
 *
 * Streams newline-delimited JSON over USB serial (UART0 @ SERIAL_BAUD):
 *   {"t":"boot", ...}                      once at startup
 *   {"t":"telemetry", "gps":{..}, "hr":{..}}   every TELEMETRY_PERIOD_MS
 *   {"t":"btn","state":"down"|"up"}        button events
 *   {"t":"audio_start"|"audio"|"audio_end"} voice message (PCM16 mono, base64)
 *   {"t":"ppg", ...}                       raw samples, only if STREAM_RAW_PPG
 * Every line starts with '{' so a host can ignore any stray log text.
 */
#include <math.h>
#include <stdarg.h>
#include <stdio.h>
#include <string.h>

#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"

#include "driver/gpio.h"
#include "driver/i2c_master.h"
#include "driver/i2s_std.h"
#include "driver/uart.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "mbedtls/base64.h"

#include "config.h"
#include "hr_algo.h"
#include "max30102.h"
#include "nmea.h"

static const char *TAG = "ping";

/* ===================== serial output ===================== */

static SemaphoreHandle_t s_tx_lock;     /* keeps JSON lines from interleaving */
static SemaphoreHandle_t s_data_lock;   /* guards s_gps / s_hr */

static uint32_t now_ms(void) { return (uint32_t)(esp_timer_get_time() / 1000); }

static void out_write(const char *buf, size_t len)
{
    xSemaphoreTake(s_tx_lock, portMAX_DELAY);
    uart_write_bytes(SERIAL_UART, buf, len);
    xSemaphoreGive(s_tx_lock);
}

static void out_printf(const char *fmt, ...)
{
    char line[512];
    va_list ap;
    va_start(ap, fmt);
    int n = vsnprintf(line, sizeof line - 1, fmt, ap);
    va_end(ap);
    if (n < 0) return;
    if (n > (int)sizeof line - 2) n = sizeof line - 2;
    line[n++] = '\n';
    out_write(line, (size_t)n);
}

/* ===================== shared sensor state ===================== */

static nmea_data_t s_gps;
static uint32_t    s_gps_fix_ms;        /* when position was last refreshed */

static struct { int bpm; bool valid; bool finger; } s_hr;

static bool s_hr_ok, s_mic_ok, s_amp_ok;

/* ===================== GPS ===================== */

static void gps_send(const char *payload)
{
    char buf[96];
    size_t n = nmea_build(buf, sizeof buf, payload);
    uart_write_bytes(GPS_UART, buf, n);
}

static void gps_task(void *arg)
{
    const uart_config_t cfg = {
        .baud_rate  = GPS_BAUD,
        .data_bits  = UART_DATA_8_BITS,
        .parity     = UART_PARITY_DISABLE,
        .stop_bits  = UART_STOP_BITS_1,
        .flow_ctrl  = UART_HW_FLOWCTRL_DISABLE,
        .source_clk = UART_SCLK_DEFAULT,
    };
    uart_driver_install(GPS_UART, 1024, 0, 0, NULL, 0);
    uart_param_config(GPS_UART, &cfg);
    uart_set_pin(GPS_UART, PIN_GPS_TX, PIN_GPS_RX, UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE);

#if GPS_CONFIGURE_SENTENCES
    /* Only RMC + GGA (all we parse); 1 Hz fix rate. Harmless if TX isn't wired. */
    vTaskDelay(pdMS_TO_TICKS(500));
    gps_send("PMTK314,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0");
    gps_send("PMTK220,1000");
#endif

    char line[128];
    size_t len = 0;
    uint8_t rx[128];
    for (;;) {
        int n = uart_read_bytes(GPS_UART, rx, sizeof rx, pdMS_TO_TICKS(100));
        for (int i = 0; i < n; i++) {
            char c = (char)rx[i];
            if (c == '\n' || c == '\r') {
                if (len > 0) {
                    line[len] = '\0';
                    xSemaphoreTake(s_data_lock, portMAX_DELAY);
                    nmea_result_t r = nmea_parse_line(line, &s_gps);
                    if ((r == NMEA_RMC || r == NMEA_GGA) && s_gps.have_fix)
                        s_gps_fix_ms = now_ms();
                    xSemaphoreGive(s_data_lock);
                    len = 0;
                }
            } else if (len < sizeof line - 1) {
                line[len++] = c;
            } else {
                len = 0;                         /* overlong garbage: resync */
            }
        }
    }
}

/* ===================== heart rate ===================== */

static i2c_master_bus_handle_t s_i2c;
static max30102_t s_max;

static void hr_task(void *arg)
{
    hr_algo_t algo;
    hr_algo_init(&algo);
    uint32_t red[32], ir[32];

    for (;;) {
        int n = 0;
        if (max30102_read_fifo(&s_max, red, ir, 32, &n) == ESP_OK && n > 0) {
            for (int i = 0; i < n; i++) {
                hr_algo_push(&algo, ir[i]);
#if STREAM_RAW_PPG
                out_printf("{\"t\":\"ppg\",\"ts\":%lu,\"ir\":%lu,\"red\":%lu}",
                           (unsigned long)now_ms(), (unsigned long)ir[i], (unsigned long)red[i]);
#endif
            }
            int bpm = 0;
            bool valid = hr_algo_get(&algo, &bpm);
            xSemaphoreTake(s_data_lock, portMAX_DELAY);
            s_hr.bpm = valid ? bpm : 0;
            s_hr.valid = valid;
            s_hr.finger = hr_algo_finger(&algo);
            xSemaphoreGive(s_data_lock);
        }
        vTaskDelay(pdMS_TO_TICKS(HR_POLL_MS));
    }
}

/* ===================== telemetry ===================== */

static void telemetry_task(void *arg)
{
    TickType_t wake = xTaskGetTickCount();
    for (;;) {
        vTaskDelayUntil(&wake, pdMS_TO_TICKS(TELEMETRY_PERIOD_MS));

        nmea_data_t g;
        uint32_t fix_ms;
        int bpm, finger, valid;
        xSemaphoreTake(s_data_lock, portMAX_DELAY);
        g = s_gps; fix_ms = s_gps_fix_ms;
        bpm = s_hr.bpm; finger = s_hr.finger; valid = s_hr.valid;
        xSemaphoreGive(s_data_lock);

        uint32_t t = now_ms();
        uint32_t age = t - fix_ms;
        bool fix = g.have_fix && fix_ms != 0 && age < GPS_STALE_MS;

        char utc[24] = "";
        if (g.have_time)
            snprintf(utc, sizeof utc, "%04d-%02d-%02dT%02d:%02d:%02dZ",
                     g.year, g.month, g.day, g.hour, g.minute, g.second);

        char gps[256];
        if (fix)
            snprintf(gps, sizeof gps,
                     "{\"fix\":1,\"lat\":%.6f,\"lon\":%.6f,\"alt\":%.1f,\"spd_kmh\":%.1f,"
                     "\"sats\":%d,\"hdop\":%.1f,\"utc\":\"%s\",\"age_ms\":%lu}",
                     g.lat, g.lon, g.alt_m, g.speed_kmh, g.sats, g.hdop, utc, (unsigned long)age);
        else
            snprintf(gps, sizeof gps, "{\"fix\":0,\"sats\":%d,\"utc\":\"%s\"}", g.sats, utc);

        out_printf("{\"t\":\"telemetry\",\"ts\":%lu,\"gps\":%s,"
                   "\"hr\":{\"bpm\":%d,\"valid\":%d,\"finger\":%d}}",
                   (unsigned long)t, gps, bpm, valid, finger);
    }
}

/* ===================== audio (mic in, speaker beeps) ===================== */

static i2s_chan_handle_t s_mic, s_spk;

static esp_err_t audio_init(void)
{
    esp_err_t e;

    /* Mic: I2S0 RX. 32-bit stereo frames; we pick one slot (INMP441 sends 24-bit MSB-first). */
    i2s_chan_config_t mc = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_0, I2S_ROLE_MASTER);
    mc.dma_desc_num = 6;
    mc.dma_frame_num = 256;
    if ((e = i2s_new_channel(&mc, NULL, &s_mic)) != ESP_OK) return e;
    i2s_std_config_t mic = {
        .clk_cfg  = I2S_STD_CLK_DEFAULT_CONFIG(AUDIO_RATE_HZ),
        .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_STEREO),
        .gpio_cfg = { .mclk = I2S_GPIO_UNUSED, .bclk = PIN_MIC_BCLK, .ws = PIN_MIC_WS,
                      .dout = I2S_GPIO_UNUSED, .din = PIN_MIC_SD },
    };
    if ((e = i2s_channel_init_std_mode(s_mic, &mic)) != ESP_OK) return e;
    s_mic_ok = true;

    /* Speaker amp: I2S1 TX, 16-bit stereo (same sample on both slots -> full level on mono amp). */
    i2s_chan_config_t sc = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_1, I2S_ROLE_MASTER);
    if ((e = i2s_new_channel(&sc, &s_spk, NULL)) != ESP_OK) return e;
    i2s_std_config_t spk = {
        .clk_cfg  = I2S_STD_CLK_DEFAULT_CONFIG(AUDIO_RATE_HZ),
        .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_STEREO),
        .gpio_cfg = { .mclk = I2S_GPIO_UNUSED, .bclk = PIN_AMP_BCLK, .ws = PIN_AMP_WS,
                      .dout = PIN_AMP_DIN, .din = I2S_GPIO_UNUSED },
    };
    if ((e = i2s_channel_init_std_mode(s_spk, &spk)) != ESP_OK) return e;
    s_amp_ok = true;
    return ESP_OK;
}

static void play_beep(int freq_hz, int ms)
{
    if (!s_amp_ok) return;
    static int16_t buf[256 * 2];
    const int total = AUDIO_RATE_HZ * ms / 1000;
    const int fade = AUDIO_RATE_HZ / 200;            /* 5 ms ramps avoid clicks */
    size_t bw;

    i2s_channel_enable(s_spk);
    for (int done = 0; done < total;) {
        int chunk = total - done > 256 ? 256 : total - done;
        for (int i = 0; i < chunk; i++) {
            int k = done + i;
            int edge = k < total - 1 - k ? k : total - 1 - k;
            float g = edge >= fade ? 1.0f : (float)edge / fade;
            int16_t s = (int16_t)(BEEP_AMPLITUDE * g * sinf(2.0f * (float)M_PI * freq_hz * k / AUDIO_RATE_HZ));
            buf[2 * i] = buf[2 * i + 1] = s;
        }
        i2s_channel_write(s_spk, buf, (size_t)chunk * 4, &bw, 1000);
        done += chunk;
    }
    memset(buf, 0, sizeof buf);
    i2s_channel_write(s_spk, buf, sizeof buf, &bw, 1000);   /* ~16 ms of silence flushes the tail */
    i2s_channel_disable(s_spk);
}

#define AUDIO_LINE_MAX 800

static void emit_audio_chunk(uint32_t id, uint32_t seq, const int16_t *pcm, size_t nsamples)
{
    static char line[AUDIO_LINE_MAX];
    int h = snprintf(line, sizeof line, "{\"t\":\"audio\",\"id\":%lu,\"seq\":%lu,\"b64\":\"",
                     (unsigned long)id, (unsigned long)seq);
    size_t olen = 0;
    if (mbedtls_base64_encode((unsigned char *)line + h, sizeof line - h - 4, &olen,
                              (const unsigned char *)pcm, nsamples * 2) != 0) return;
    size_t pos = (size_t)h + olen;
    line[pos++] = '"'; line[pos++] = '}'; line[pos++] = '\n';
    out_write(line, pos);
}

static bool button_down(void) { return gpio_get_level(PIN_BUTTON) == 0; }

static void record_message(uint32_t id)
{
    static int32_t rx[AUDIO_CHUNK_SAMPLES * 2];
    static int16_t pcm[AUDIO_CHUNK_SAMPLES];

    out_printf("{\"t\":\"btn\",\"ts\":%lu,\"state\":\"down\"}", (unsigned long)now_ms());
    if (!s_mic_ok) {
        while (button_down()) vTaskDelay(pdMS_TO_TICKS(10));
        return;
    }

    play_beep(880, 80);                              /* "start talking" cue, before mic opens */
    i2s_channel_enable(s_mic);

    uint32_t t0 = now_ms();
    out_printf("{\"t\":\"audio_start\",\"id\":%lu,\"ts\":%lu,\"rate\":%d,\"bits\":16,\"ch\":1,"
               "\"fmt\":\"pcm_s16le_b64\"}", (unsigned long)id, (unsigned long)t0, AUDIO_RATE_HZ);

    int skip = AUDIO_RATE_HZ * MIC_SETTLE_MS / 1000;
    size_t fill = 0, total = 0;
    uint32_t seq = 0;
    int released = 0;

    for (;;) {
        size_t br = 0;
        if (i2s_channel_read(s_mic, rx, sizeof rx, &br, 1000) != ESP_OK) {
            out_printf("{\"t\":\"error\",\"msg\":\"mic read failed\"}");
            break;
        }
        for (size_t f = 0; f < br / 8; f++) {
            int32_t v = rx[f * 2 + MIC_SLOT_INDEX] >> AUDIO_SHIFT;
            if (v > 32767) v = 32767; else if (v < -32768) v = -32768;
            if (skip > 0) { skip--; continue; }
            pcm[fill++] = (int16_t)v;
            total++;
            if (fill == AUDIO_CHUNK_SAMPLES) {
                emit_audio_chunk(id, seq++, pcm, fill);
                fill = 0;
            }
        }
        released = button_down() ? 0 : released + 1;
        if (released >= 3) break;                    /* ~50 ms of release = debounced */
        if (now_ms() - t0 > MAX_RECORD_MS) break;
    }

    if (fill > 0) emit_audio_chunk(id, seq++, pcm, fill);
    i2s_channel_disable(s_mic);

    uint32_t t1 = now_ms();
    out_printf("{\"t\":\"btn\",\"ts\":%lu,\"state\":\"up\"}", (unsigned long)t1);
    out_printf("{\"t\":\"audio_end\",\"id\":%lu,\"ts\":%lu,\"chunks\":%lu,\"samples\":%lu,\"dur_ms\":%lu}",
               (unsigned long)id, (unsigned long)t1, (unsigned long)seq,
               (unsigned long)total, (unsigned long)(total * 1000 / AUDIO_RATE_HZ));

    play_beep(440, 80);                              /* "sent" cue */
    while (button_down()) vTaskDelay(pdMS_TO_TICKS(10));   /* if cut off by the time cap */
}

static void voice_task(void *arg)
{
    gpio_config_t io = {
        .pin_bit_mask = 1ULL << PIN_BUTTON,
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
    };
    gpio_config(&io);

    uint32_t id = 0;
    int low = 0;
    for (;;) {
        low = button_down() ? low + 1 : 0;
        if (low >= 3) {                              /* ~30 ms debounce */
            low = 0;
            record_message(++id);
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

/* ===================== startup ===================== */

void app_main(void)
{
    s_tx_lock = xSemaphoreCreateMutex();
    s_data_lock = xSemaphoreCreateMutex();

    /* Serial link to the PC: interrupt-driven TX so audio doesn't stall tasks */
    const uart_config_t sc = {
        .baud_rate  = SERIAL_BAUD,
        .data_bits  = UART_DATA_8_BITS,
        .parity     = UART_PARITY_DISABLE,
        .stop_bits  = UART_STOP_BITS_1,
        .flow_ctrl  = UART_HW_FLOWCTRL_DISABLE,
        .source_clk = UART_SCLK_DEFAULT,
    };
    uart_driver_install(SERIAL_UART, 256, 16384, 0, NULL, 0);
    uart_param_config(SERIAL_UART, &sc);

    /* Heart-rate sensor */
    i2c_master_bus_config_t bc = {
        .i2c_port = I2C_NUM_0,
        .sda_io_num = PIN_I2C_SDA,
        .scl_io_num = PIN_I2C_SCL,
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .glitch_ignore_cnt = 7,
        .flags.enable_internal_pullup = true,        /* breakout has its own; harmless */
    };
    if (i2c_new_master_bus(&bc, &s_i2c) == ESP_OK)
        s_hr_ok = (max30102_init(s_i2c, &s_max) == ESP_OK);

    /* Audio */
    if (audio_init() != ESP_OK) ESP_LOGE(TAG, "audio init failed");

    out_printf("{\"t\":\"boot\",\"fw\":\"%s\",\"baud\":%d,\"hr_sensor\":%d,\"mic\":%d,\"amp\":%d,"
               "\"audio_rate\":%d,\"telemetry_ms\":%d}",
               FW_VERSION, SERIAL_BAUD, s_hr_ok, s_mic_ok, s_amp_ok, AUDIO_RATE_HZ, TELEMETRY_PERIOD_MS);

    xTaskCreatePinnedToCore(gps_task,       "gps",   4096, NULL, 3, NULL, 0);
    if (s_hr_ok)
        xTaskCreatePinnedToCore(hr_task,    "hr",    4096, NULL, 4, NULL, 0);
    else
        out_printf("{\"t\":\"error\",\"msg\":\"MAX30102 not found at 0x57 (check wiring / pull-ups)\"}");
    xTaskCreatePinnedToCore(telemetry_task, "telem", 4096, NULL, 2, NULL, 0);
    xTaskCreatePinnedToCore(voice_task,     "voice", 6144, NULL, 5, NULL, 1);
}
