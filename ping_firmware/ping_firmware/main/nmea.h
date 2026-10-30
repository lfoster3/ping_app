#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

/* Portable NMEA 0183 parser (RMC + GGA). No ESP-IDF dependencies. */

typedef struct {
    bool     have_fix;
    double   lat, lon;          /* decimal degrees, +N/+E */
    float    alt_m;
    float    speed_kmh;
    int      sats;
    float    hdop;
    bool     have_time;         /* date+time from RMC look sane */
    int      year, month, day, hour, minute, second;
    uint32_t sentences_ok;
    uint32_t sentences_bad;     /* failed checksum / malformed */
} nmea_data_t;

typedef enum { NMEA_BAD, NMEA_OTHER, NMEA_RMC, NMEA_GGA } nmea_result_t;

/* line: one sentence, '$' first, no CR/LF. Updates *out on success. */
nmea_result_t nmea_parse_line(const char *line, nmea_data_t *out);

/* Wrap payload (no '$' or '*') into "$payload*CS\r\n". Returns length. */
size_t nmea_build(char *dst, size_t cap, const char *payload);
