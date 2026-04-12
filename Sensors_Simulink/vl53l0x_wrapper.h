#ifndef VL53L0X_WRAPPER_H
#define VL53L0X_WRAPPER_H

/*  give the parser the exact size it needs  */
typedef unsigned short uint16_t;

#ifdef __cplusplus
extern "C"
{
#endif

    uint16_t vl53_getDistance(void);

#ifdef __cplusplus
}
#endif

#endif