#pragma once
#include <stdbool.h>
#include <stdint.h>

/* Portable PPG heart-rate estimator. Feed IR samples at HR_FS_HZ.
 * No ESP-IDF dependencies. */

#define HR_FS_HZ            50        /* 200 sps ADC / 4x averaging in max30102.c */
#define HR_FINGER_IR_MIN    20000     /* below this: no skin contact */
#define HR_MA_LEN           5
#define HR_IVL_N            5
#define HR_SETTLE_SAMPLES   (2 * HR_FS_HZ)
#define HR_MIN_IVL          15        /* 200 BPM */
#define HR_MAX_IVL          80        /* 37.5 BPM */
#define HR_MIN_PEAK_AMP     15.0f     /* ADC counts */

typedef struct {
    float    dc;
    float    ma[HR_MA_LEN];
    int      ma_pos, ma_n;
    float    s0, s1, s2;
    int      s_n;
    float    env;
    uint32_t idx;
    int32_t  last_peak;
    uint16_t ivl[HR_IVL_N];
    int      ivl_n, ivl_pos, rejects;
    int      settle;
    bool     finger;
    uint32_t last_valid_idx;
    float    bpm;
} hr_algo_t;

void hr_algo_init(hr_algo_t *h);
void hr_algo_push(hr_algo_t *h, uint32_t ir);
/* Returns true if a trustworthy BPM exists; *bpm is rounded. */
bool hr_algo_get(const hr_algo_t *h, int *bpm);
static inline bool hr_algo_finger(const hr_algo_t *h) { return h->finger; }
