#include "max30102.h"
#include "config.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#define REG_INT_STATUS1   0x00
#define REG_FIFO_WR_PTR   0x04
#define REG_FIFO_OVF      0x05
#define REG_FIFO_RD_PTR   0x06
#define REG_FIFO_DATA     0x07
#define REG_FIFO_CFG      0x08
#define REG_MODE_CFG      0x09
#define REG_SPO2_CFG      0x0A
#define REG_LED1_PA       0x0C   /* red */
#define REG_LED2_PA       0x0D   /* IR  */
#define REG_PART_ID       0xFF
#define PART_ID_EXPECTED  0x15

static esp_err_t wr(max30102_t *m, uint8_t reg, uint8_t val)
{
    uint8_t b[2] = { reg, val };
    return i2c_master_transmit(m->dev, b, 2, 100);
}

static esp_err_t rd(max30102_t *m, uint8_t reg, uint8_t *dst, size_t n)
{
    return i2c_master_transmit_receive(m->dev, &reg, 1, dst, n, 100);
}

esp_err_t max30102_init(i2c_master_bus_handle_t bus, max30102_t *m)
{
    i2c_device_config_t dc = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address  = MAX30102_I2C_ADDR,
        .scl_speed_hz    = 400000,
    };
    esp_err_t e = i2c_master_bus_add_device(bus, &dc, &m->dev);
    if (e != ESP_OK) return e;

    uint8_t id = 0;
    e = rd(m, REG_PART_ID, &id, 1);
    if (e != ESP_OK) return e;
    if (id != PART_ID_EXPECTED) return ESP_ERR_NOT_FOUND;

    wr(m, REG_MODE_CFG, 0x40);                       /* soft reset */
    for (int i = 0; i < 10; i++) {
        vTaskDelay(pdMS_TO_TICKS(5));
        uint8_t mode = 0x40;
        if (rd(m, REG_MODE_CFG, &mode, 1) == ESP_OK && !(mode & 0x40)) break;
    }

    uint8_t clr;
    rd(m, REG_INT_STATUS1, &clr, 1);                 /* clear pending interrupts */

    if ((e = wr(m, REG_FIFO_CFG, 0x50)) != ESP_OK) return e;   /* avg=4, rollover on */
    if ((e = wr(m, REG_SPO2_CFG, 0x2B)) != ESP_OK) return e;   /* 4096 nA, 200 sps, 411 us */
    wr(m, REG_LED1_PA, HR_LED_CURRENT);
    wr(m, REG_LED2_PA, HR_LED_CURRENT);
    wr(m, REG_FIFO_WR_PTR, 0);
    wr(m, REG_FIFO_OVF, 0);
    wr(m, REG_FIFO_RD_PTR, 0);
    return wr(m, REG_MODE_CFG, 0x03);                /* SpO2 mode: red + IR */
}

esp_err_t max30102_read_fifo(max30102_t *m, uint32_t *red, uint32_t *ir, int max, int *count)
{
    *count = 0;
    uint8_t p[3];
    esp_err_t e = rd(m, REG_FIFO_WR_PTR, p, 3);      /* wr, ovf, rd */
    if (e != ESP_OK) return e;

    int n = (p[0] - p[2]) & 0x1F;
    if (n == 0 && p[1] > 0) n = 32;                  /* overflowed: FIFO full */
    if (n > max) n = max;
    if (n > 32) n = 32;
    if (n == 0) return ESP_OK;

    uint8_t buf[32 * 6];
    e = rd(m, REG_FIFO_DATA, buf, (size_t)n * 6);
    if (e != ESP_OK) return e;

    for (int i = 0; i < n; i++) {
        const uint8_t *b = &buf[i * 6];
        red[i] = (((uint32_t)b[0] << 16) | ((uint32_t)b[1] << 8) | b[2]) & 0x3FFFF;
        ir[i]  = (((uint32_t)b[3] << 16) | ((uint32_t)b[4] << 8) | b[5]) & 0x3FFFF;
    }
    *count = n;
    return ESP_OK;
}
