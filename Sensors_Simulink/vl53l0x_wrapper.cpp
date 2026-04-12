#include "Arduino.h"
#include "Adafruit_VL53L0X.h"

static Adafruit_VL53L0X lox;   // single global instance

/*  one-time start-up  */
void vl53_init(void)
{
  if (!lox.begin()) {          // blocks until sensor answers
    while(1) { delay(10); }    // simple deadlock – you can
  }                             // replace with error code if you wish
  lox.startRangeContinuous();   // 10 Hz continuous mode
}

/*  call every step – returns distance in mm, 8190 if no new data  */
extern "C" uint16_t vl53_getDistance(void)
{
  if (lox.isRangeComplete()) {
    return lox.readRange();     // mm 0 … 8190
  }
  return 8190;                  // sentinel “not ready”
}