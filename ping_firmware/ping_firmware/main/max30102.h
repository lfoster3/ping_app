#pragma once
#include <stdint.h>
#include "driver/i2c_master.h"
#include "esp_err.h"

typedef struct { i2c_master_dev_handle_t dev; } max30102_t;

/* Configures: SpO2 mode (red+IR), 200 sps, 4x averaging (=50 Hz out), 411 us / 18-bit. */
esp_err_t max30102_init(i2c_master_bus_handle_t bus, max30102_t *m);

/* Reads up to `max` queued samples (max <= 32). */
esp_err_t max30102_read_fifo(max30102_t *m, uint32_t *red, uint32_t *ir, int max, int *count);
