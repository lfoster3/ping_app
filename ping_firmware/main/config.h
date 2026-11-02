#pragma once
/* Ping firmware configuration. Pins match the Interconnect Guide. */

#define FW_VERSION              "ping-0.1.0"

/* ---- Pins ---- */
#define PIN_I2C_SDA             21   /* MAX30102 */
#define PIN_I2C_SCL             22
#define PIN_GPS_RX              16   /* ESP32 RX2  <- GPS TX */
#define PIN_GPS_TX              17   /* ESP32 TX2  -> GPS RX (config cmds) */
#define PIN_MIC_WS              25   /* INMP441, I2S0 */
#define PIN_MIC_BCLK            26
#define PIN_MIC_SD              33
#define PIN_AMP_WS              27   /* MAX98357A, I2S1 */
#define PIN_AMP_BCLK            14
#define PIN_AMP_DIN             32
#define PIN_BUTTON              4    /* to GND, internal pull-up */

/* ---- Serial output to the PC (UART0 / USB) ---- */
#define SERIAL_UART             UART_NUM_0
#define SERIAL_BAUD             921600   /* monitor must use the same baud */

/* ---- Telemetry ---- */
#define TELEMETRY_PERIOD_MS     1000     /* combined GPS+HR packet period */
#define GPS_STALE_MS            5000     /* fix reported as lost after this */
#define STREAM_RAW_PPG          0        /* 1 = also emit raw IR/red samples */

/* ---- GPS ---- */
#define GPS_UART                UART_NUM_2
#define GPS_BAUD                9600
#define GPS_CONFIGURE_SENTENCES 1        /* ask module for only RMC + GGA */

/* ---- MAX30102 ---- */
#define MAX30102_I2C_ADDR       0x57
#define HR_LED_CURRENT          0x3C     /* 0.2 mA/LSB -> ~12 mA. Raise for wrist, lower to save power */
#define HR_POLL_MS              40

/* ---- Audio / voice message ---- */
#define AUDIO_RATE_HZ           16000
#define AUDIO_CHUNK_SAMPLES     256      /* 512 bytes PCM -> ~688 chars base64 */
#define AUDIO_SHIFT             14       /* INMP441 24-bit-in-32 -> 16-bit. Lower = louder */
#define MIC_SLOT_INDEX          0        /* 0 = left (L/R pin on GND). Try 1 if you get silence */
#define MIC_SETTLE_MS           100      /* discard mic start-up transient */
#define MAX_RECORD_MS           30000    /* hard cap on one voice message */
#define BEEP_AMPLITUDE          6000     /* of 32767; keep modest for kids' ears */
