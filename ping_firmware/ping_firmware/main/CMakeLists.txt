idf_component_register(
    SRCS "main.c" "nmea.c" "hr_algo.c" "max30102.c"
    INCLUDE_DIRS "."
    REQUIRES driver esp_timer mbedtls)
