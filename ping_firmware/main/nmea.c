#include "nmea.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int split(char *s, char **f, int max)
{
    int n = 0;
    f[n++] = s;
    for (; *s && n < max; s++) {
        if (*s == ',') { *s = '\0'; f[n++] = s + 1; }
    }
    return n;
}

/* ddmm.mmmm / dddmm.mmmm + hemisphere -> signed decimal degrees */
static bool parse_coord(const char *v, const char *hemi, double *out)
{
    if (!v[0] || !hemi[0]) return false;
    double raw = strtod(v, NULL);
    int deg = (int)(raw / 100.0);
    double d = deg + (raw - deg * 100.0) / 60.0;
    if (hemi[0] == 'S' || hemi[0] == 'W') d = -d;
    else if (hemi[0] != 'N' && hemi[0] != 'E') return false;
    *out = d;
    return true;
}

static int two(const char *s) { return (s[0] - '0') * 10 + (s[1] - '0'); }

static void parse_datetime(const char *t, const char *d, nmea_data_t *o)
{
    if (strlen(t) < 6 || strlen(d) < 6) return;
    int yr = 2000 + two(d + 4);
    if (yr < 2024 || yr > 2060) return;  /* module default/unset date (e.g. 1980, 1994) */
    o->hour = two(t); o->minute = two(t + 2); o->second = two(t + 4);
    o->day = two(d);  o->month = two(d + 2); o->year = yr;
    o->have_time = true;
}

nmea_result_t nmea_parse_line(const char *line, nmea_data_t *o)
{
    if (!line || line[0] != '$') { o->sentences_bad++; return NMEA_BAD; }
    const char *star = strchr(line, '*');
    if (!star || strlen(star) < 3) { o->sentences_bad++; return NMEA_BAD; }

    uint8_t cs = 0;
    for (const char *p = line + 1; p < star; p++) cs ^= (uint8_t)*p;
    unsigned want;
    if (sscanf(star + 1, "%2x", &want) != 1 || want != cs) {
        o->sentences_bad++;
        return NMEA_BAD;
    }

    char buf[100];
    size_t plen = (size_t)(star - line - 1);
    if (plen >= sizeof buf) return NMEA_OTHER;
    memcpy(buf, line + 1, plen);
    buf[plen] = '\0';

    char *f[24];
    int n = split(buf, f, 24);
    if (strlen(f[0]) != 5) return NMEA_OTHER;      /* e.g. PMTK acks */
    o->sentences_ok++;

    if (!strcmp(f[0] + 2, "RMC") && n >= 10) {
        double lat, lon;
        if (f[2][0] == 'A' && parse_coord(f[3], f[4], &lat) && parse_coord(f[5], f[6], &lon)) {
            o->lat = lat; o->lon = lon;
            o->speed_kmh = (float)(strtod(f[7], NULL) * 1.852);
            o->have_fix = true;
        } else {
            o->have_fix = false;
        }
        parse_datetime(f[1], f[9], o);
        return NMEA_RMC;
    }

    if (!strcmp(f[0] + 2, "GGA") && n >= 10) {
        int quality = atoi(f[6]);
        o->sats = atoi(f[7]);
        o->hdop = (float)strtod(f[8], NULL);
        double lat, lon;
        if (quality > 0 && parse_coord(f[2], f[3], &lat) && parse_coord(f[4], f[5], &lon)) {
            o->lat = lat; o->lon = lon;
            o->alt_m = (float)strtod(f[9], NULL);
            o->have_fix = true;
        } else {
            o->have_fix = false;
        }
        return NMEA_GGA;
    }
    return NMEA_OTHER;
}

size_t nmea_build(char *dst, size_t cap, const char *payload)
{
    uint8_t cs = 0;
    for (const char *p = payload; *p; p++) cs ^= (uint8_t)*p;
    int n = snprintf(dst, cap, "$%s*%02X\r\n", payload, cs);
    return n < 0 ? 0 : (size_t)n;
}
