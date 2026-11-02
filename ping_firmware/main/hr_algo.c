#include "hr_algo.h"
#include <math.h>
#include <string.h>

static void reset_tracking(hr_algo_t *h)
{
    memset(h->ma, 0, sizeof h->ma);
    h->ma_pos = h->ma_n = 0;
    h->s0 = h->s1 = h->s2 = 0;
    h->s_n = 0;
    h->env = 0;
    h->last_peak = -1;
    h->ivl_n = h->ivl_pos = h->rejects = 0;
    h->bpm = 0;
}

void hr_algo_init(hr_algo_t *h)
{
    memset(h, 0, sizeof *h);
    reset_tracking(h);
}

static float median_ivl(const hr_algo_t *h)
{
    uint16_t t[HR_IVL_N];
    memcpy(t, h->ivl, sizeof t);
    int n = h->ivl_n;
    for (int i = 1; i < n; i++) {
        uint16_t v = t[i]; int j = i - 1;
        while (j >= 0 && t[j] > v) { t[j + 1] = t[j]; j--; }
        t[j + 1] = v;
    }
    return (n & 1) ? t[n / 2] : 0.5f * (t[n / 2 - 1] + t[n / 2]);
}

static void on_peak(hr_algo_t *h, int32_t peak_idx)
{
    if (h->last_peak >= 0) {
        int dt = peak_idx - h->last_peak;
        if (dt < HR_MIN_IVL) return;                 /* notch / noise: ignore */
        if (dt > HR_MAX_IVL) {                       /* missed beats: restart */
            h->ivl_n = h->ivl_pos = h->rejects = 0;
        } else {
            bool ok = true;
            if (h->ivl_n >= 3) {
                float med = median_ivl(h);
                if (fabsf((float)dt - med) > 0.35f * med) ok = false;
            }
            if (ok) {
                h->ivl[h->ivl_pos] = (uint16_t)dt;
                h->ivl_pos = (h->ivl_pos + 1) % HR_IVL_N;
                if (h->ivl_n < HR_IVL_N) h->ivl_n++;
                h->rejects = 0;
            } else if (++h->rejects >= 3) {
                h->ivl_n = h->ivl_pos = h->rejects = 0;
            }
            if (h->ivl_n >= 3) {
                float sum = 0;
                for (int i = 0; i < h->ivl_n; i++) sum += h->ivl[i];
                h->bpm = 60.0f * HR_FS_HZ / (sum / h->ivl_n);
                h->last_valid_idx = h->idx;
            }
        }
    }
    h->last_peak = peak_idx;
}

void hr_algo_push(hr_algo_t *h, uint32_t ir)
{
    h->idx++;

    if (ir < HR_FINGER_IR_MIN) {                     /* no skin contact */
        h->finger = false;
        reset_tracking(h);
        return;
    }
    if (!h->finger) {                                /* contact just began */
        h->finger = true;
        reset_tracking(h);
        h->dc = (float)ir;
        h->settle = HR_SETTLE_SAMPLES;
    }

    /* High-pass: subtract slow baseline (~0.16 Hz). Invert so beats are peaks. */
    h->dc += 0.02f * ((float)ir - h->dc);
    float ac = -((float)ir - h->dc);

    /* Light smoothing (5-pt moving average, ~10 Hz corner) */
    h->ma[h->ma_pos] = ac;
    h->ma_pos = (h->ma_pos + 1) % HR_MA_LEN;
    if (h->ma_n < HR_MA_LEN) h->ma_n++;
    float sum = 0;
    for (int i = 0; i < h->ma_n; i++) sum += h->ma[i];
    float sm = sum / h->ma_n;

    h->s0 = h->s1; h->s1 = h->s2; h->s2 = sm;
    if (h->s_n < 3) h->s_n++;

    float a = fabsf(sm);
    h->env = (a > h->env) ? a : h->env * 0.998f;

    if (h->settle > 0) { h->settle--; return; }
    if (h->s_n < 3) return;

    float thr = 0.4f * h->env;
    if (thr < HR_MIN_PEAK_AMP) thr = HR_MIN_PEAK_AMP;
    if (h->s1 > h->s0 && h->s1 >= h->s2 && h->s1 > thr)
        on_peak(h, (int32_t)h->idx - 1);
}

bool hr_algo_get(const hr_algo_t *h, int *bpm)
{
    if (!h->finger || h->ivl_n < 3 || h->bpm < 35.0f || h->bpm > 210.0f) return false;
    if (h->idx - h->last_valid_idx > 5u * HR_FS_HZ) return false;
    if (bpm) *bpm = (int)(h->bpm + 0.5f);
    return true;
}
