idf_component_register(
    SRCS "main.c" "nmea.c" "hr_algo.c" "max30102.c"
    INCLUDE_DIRS "."
    REQUIRES esp_driver_gpio esp_driver_i2c esp_driver_i2s esp_driver_uart esp_timer)
