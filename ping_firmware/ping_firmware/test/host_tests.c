/* Host-side checks for the portable modules.  gcc -I../main host_tests.c ../main/nmea.c ../main/hr_algo.c -lm */
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "nmea.h"
#include "hr_algo.h"

static int fails;
#define CHECK(c, ...) do { if (!(c)) { fails++; printf("FAIL: " __VA_ARGS__); printf("\n"); } } while (0)

static void test_nmea(void)
{
    nmea_data_t d; memset(&d, 0, sizeof d);
    /* canonical NMEA examples */
    CHECK(nmea_parse_line("$GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A", &d) == NMEA_RMC, "rmc");
    CHECK(fabs(d.lat - 48.1173) < 1e-4 && fabs(d.lon - 11.51667) < 1e-4, "rmc coords %f %f", d.lat, d.lon);
    CHECK(fabs(d.speed_kmh - 41.5) < 0.1, "speed %f", d.speed_kmh);
    CHECK(!d.have_time, "1994 date must be rejected");
    CHECK(nmea_parse_line("$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47", &d) == NMEA_GGA, "gga");
    CHECK(d.sats == 8 && fabs(d.alt_m - 545.4) < 0.1 && d.have_fix, "gga fields");
    CHECK(nmea_parse_line("$GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6B", &d) == NMEA_BAD, "bad checksum");
    CHECK(d.sentences_bad == 1, "bad count");

    /* South Bend, southern/western hemisphere signs, GN talker, built with our own checksum */
    char buf[128], line[128]; memset(&d, 0, sizeof d);
    nmea_build(buf, sizeof buf, "GNRMC,140305.000,A,4140.5840,N,08615.1200,W,0.30,10.0,261026,,,A");
    strcpy(line, buf); line[strcspn(line, "\r\n")] = 0;
    CHECK(nmea_parse_line(line, &d) == NMEA_RMC, "gn rmc");
    CHECK(fabs(d.lat - 41.67640) < 1e-4 && fabs(d.lon + 86.25200) < 1e-4, "sb coords %f %f", d.lat, d.lon);
    CHECK(d.have_time && d.year == 2026 && d.month == 10 && d.day == 26 && d.hour == 14 && d.second == 5, "time");

    /* no-fix sentences */
    nmea_build(buf, sizeof buf, "GNRMC,140306.000,V,,,,,,,261026,,,N");
    strcpy(line, buf); line[strcspn(line, "\r\n")] = 0;
    nmea_parse_line(line, &d);
    CHECK(!d.have_fix, "V clears fix");
    nmea_build(buf, sizeof buf, "GNGGA,140306.000,,,,,0,00,99.99,,,,,,");
    strcpy(line, buf); line[strcspn(line, "\r\n")] = 0;
    CHECK(nmea_parse_line(line, &d) == NMEA_GGA && !d.have_fix && d.sats == 0, "gga no fix");
    CHECK(nmea_parse_line("garbage", &d) == NMEA_BAD, "garbage");

    /* PMTK config sentence is 19 fields after the id */
    nmea_build(buf, sizeof buf, "PMTK314,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0");
    int commas = 0; for (char *p = buf; *p && *p != '*'; p++) commas += (*p == ',');
    CHECK(commas == 19, "PMTK314 has %d fields", commas);
}

/* synthetic PPG: DC + pulse (fundamental + 2nd harmonic) + noise */
static int run_hr(double bpm, int seconds, double amp, double noise, int *valid)
{
    hr_algo_t h; hr_algo_init(&h);
    srand(1);
    int out = 0; *valid = 0;
    for (int i = 0; i < seconds * HR_FS_HZ; i++) {
        double t = (double)i / HR_FS_HZ, f = bpm / 60.0;
        double v = 100000 + amp * (sin(2*M_PI*f*t) + 0.3*sin(4*M_PI*f*t))
                 + noise * ((rand() / (double)RAND_MAX) - 0.5) * 2;
        hr_algo_push(&h, (uint32_t)v);
    }
    *valid = hr_algo_get(&h, &out);
    return out;
}

static void test_hr(void)
{
    int v, b;
    double rates[] = { 55, 72, 100, 140, 170 };
    for (int i = 0; i < 5; i++) {
        b = run_hr(rates[i], 30, 800, 60, &v);
        CHECK(v && fabs(b - rates[i]) <= 3, "bpm %.0f -> %d (valid %d)", rates[i], b, v);
    }
    b = run_hr(72, 30, 800, 400, &v);                 /* noisy: SNR ~2 */
    printf("noisy 72 -> %d (valid %d)\n", b, v);
    CHECK(v && abs(b - 72) <= 8, "noisy within +-8 BPM");

    hr_algo_t h; hr_algo_init(&h);                    /* finger off */
    for (int i = 0; i < 200; i++) hr_algo_push(&h, 3000);
    CHECK(!hr_algo_get(&h, &b) && !hr_algo_finger(&h), "no finger -> invalid");

    b = run_hr(72, 4, 800, 60, &v);                   /* not enough data yet */
    CHECK(!v, "invalid during settle/warm-up");
}

int main(void)
{
    test_nmea();
    test_hr();
    printf(fails ? "%d FAILED\n" : "all host tests passed\n", fails);
    return fails != 0;
}
