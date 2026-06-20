
/*
 * Include Files
 *
 */
#if defined(MATLAB_MEX_FILE)
#include "tmwtypes.h"
#include "simstruc_types.h"
#else
#define SIMPLIFIED_RTWTYPES_COMPATIBILITY
#include "rtwtypes.h"
#undef SIMPLIFIED_RTWTYPES_COMPATIBILITY
#endif



/* %%%-SFUNWIZ_wrapper_includes_Changes_BEGIN --- EDIT HERE TO _END */
#ifndef MATLAB_MEX_FILE
#include <Arduino.h>
#include <Wire.h>
#include "Adafruit_VL53L0X.h"
 
// -------------------- Addresses --------------------
#define LOX1_ADDRESS 0x30
#define LOX2_ADDRESS 0x31
#define MPU1_ADDRESS 0x68   // AD0=GND
#define MPU2_ADDRESS 0x69   // AD0=3.3V
 
// -------------------- Shutdown Pins ----------------
#define SHT_LOX1 25
#define SHT_LOX2 26
 
// -------------------- I2C pins ---------------------
#define I2C_SDA 21
#define I2C_SCL 22
 
// -------------------- Objects ----------------------
static Adafruit_VL53L0X lox1;
static Adafruit_VL53L0X lox2;
 
// -------------------- Shared data (ToF) ------------
static volatile int32_t  g_dist1_mm    = -1;
static volatile int32_t  g_dist2_mm    = -1;
static volatile uint32_t g_tof_update_us = 0;   
static volatile bool     g_lox1_ok     = false;
static volatile bool     g_lox2_ok     = false;

// -------------------- Dynamic Calibration ----------
static float g_mpu1_z_offset = 0.0f;
static float g_mpu2_z_offset = 0.0f;
 
// Critical section for shared variables
static portMUX_TYPE      g_dataMux     = portMUX_INITIALIZER_UNLOCKED;
static SemaphoreHandle_t g_i2cMutex    = NULL;
 
// -------------------- Helpers ----------------------
static inline bool I2C_Lock(TickType_t timeoutTicks) {
  if (!g_i2cMutex) return true;
  return (xSemaphoreTake(g_i2cMutex, timeoutTicks) == pdTRUE);
}
 
static inline void I2C_Unlock() {
  if (g_i2cMutex) xSemaphoreGive(g_i2cMutex);
}
 
static inline void i2cWriteByte(uint8_t addr, uint8_t reg, uint8_t val) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission(true);
}
 
static inline bool i2cReadBytes(uint8_t addr, uint8_t startReg, uint8_t *buf, size_t len) {
  Wire.beginTransmission(addr);
  Wire.write(startReg);
  if (Wire.endTransmission(false) != 0) return false;
  int got = Wire.requestFrom((int)addr, (int)len, (int)true);
  if (got != (int)len) return false;
  for (size_t i = 0; i < len; i++) buf[i] = Wire.read();
  return true;
}
 
static inline void wakeUpMPU(uint8_t address) {
  i2cWriteByte(address, 0x6B, 0x00);
}
 
static inline void configMPU6050(uint8_t address) {
  wakeUpMPU(address);
  delay(2);
  // DLPF set to 44Hz (0x03) to filter high-frequency mechanical noise
  i2cWriteByte(address, 0x1A, 0x03);
  i2cWriteByte(address, 0x19, 0x04);
  i2cWriteByte(address, 0x1C, 0x00);  // +/- 2g  -> divide by 16384.0 in Simulink
  i2cWriteByte(address, 0x1B, 0x00);
}
 
static inline bool readMPUAccelXYZ(uint8_t address, int16_t &ax, int16_t &ay, int16_t &az) {
  uint8_t buf[6];
  if (!i2cReadBytes(address, 0x3B, buf, 6)) return false;
  ax = (int16_t)((buf[0] << 8) | buf[1]);
  ay = (int16_t)((buf[2] << 8) | buf[3]);
  az = (int16_t)((buf[4] << 8) | buf[5]);
  return true;
}
 
// -------------------- 5-Point Median Filter --------
static inline int32_t getMedian(int32_t newValue, int32_t *buffer, uint8_t &index) {
  buffer[index] = newValue;
  index = (index + 1) % 5;
  int32_t temp[5];
  for (int i = 0; i < 5; i++) temp[i] = buffer[i];
  for (int i = 0; i < 4; i++) {
    for (int j = 0; j < 4 - i; j++) {
      if (temp[j] > temp[j + 1]) {
        int32_t swap = temp[j];
        temp[j]     = temp[j + 1];
        temp[j + 1] = swap;
      }
    }
  }
  return temp[2];
}
 
// ------------- VL53L0X address assignment -----------
static void setVL53IDs() {
  digitalWrite(SHT_LOX1, LOW);
  digitalWrite(SHT_LOX2, LOW);
  delay(20);
 
  digitalWrite(SHT_LOX1, HIGH);
  digitalWrite(SHT_LOX2, HIGH);
  delay(20);
 
  digitalWrite(SHT_LOX1, HIGH);
  digitalWrite(SHT_LOX2, LOW);
  delay(50);
 
  if (I2C_Lock(pdMS_TO_TICKS(50))) {
    g_lox1_ok = lox1.begin(LOX1_ADDRESS, false);
    if (g_lox1_ok) {
      lox1.setMeasurementTimingBudgetMicroSeconds(20000);
      lox1.startRangeContinuous();
    }
    I2C_Unlock();
  } else {
    g_lox1_ok = false;
  }
  delay(20);
 
  digitalWrite(SHT_LOX2, HIGH);
  delay(50);
 
  if (I2C_Lock(pdMS_TO_TICKS(50))) {
    g_lox2_ok = lox2.begin(LOX2_ADDRESS, false);
    if (g_lox2_ok) {
      lox2.setMeasurementTimingBudgetMicroSeconds(20000);
      lox2.startRangeContinuous();
    }
    I2C_Unlock();
  } else {
    g_lox2_ok = false;
  }
  delay(20);
}
 
// ------------- ToF background task ------------------
static void ToFTask(void *param) {
  const TickType_t period = pdMS_TO_TICKS(40);
  TickType_t lastWake = xTaskGetTickCount();
 
  int32_t buffer1[5], buffer2[5];
  uint8_t index1 = 0, index2 = 0;
 
  int32_t seed1 = 200, seed2 = 200;  
  if (I2C_Lock(pdMS_TO_TICKS(100))) {
    if (g_lox1_ok) {
      for (int attempt = 0; attempt < 5; attempt++) {
        if (lox1.isRangeComplete()) {
          int32_t r = lox1.readRange();
          if (r > 0 && r < 8000) { seed1 = r; break; }
        }
        delay(25);
      }
    }
    if (g_lox2_ok) {
      for (int attempt = 0; attempt < 5; attempt++) {
        if (lox2.isRangeComplete()) {
          int32_t r = lox2.readRange();
          if (r > 0 && r < 8000) { seed2 = r; break; }
        }
        delay(25);
      }
    }
    I2C_Unlock();
  }
  for (int i = 0; i < 5; i++) { buffer1[i] = seed1; buffer2[i] = seed2; }
 
  float ema1 = (float)seed1;
  float ema2 = (float)seed2;
  const float alpha = 0.25f;
 
  for (;;) {
    vTaskDelayUntil(&lastWake, period);
 
    if (I2C_Lock(pdMS_TO_TICKS(10))) {
 
      if (g_lox1_ok && lox1.isRangeComplete()) {
        int32_t d1 = lox1.readRange();
        if (d1 > 0 && d1 < 8000) {
          int32_t med1 = getMedian(d1, buffer1, index1);
          ema1 = alpha * (float)med1 + (1.0f - alpha) * ema1;
          portENTER_CRITICAL(&g_dataMux);
          g_dist1_mm      = (int32_t)(ema1 + 0.5f);
          g_tof_update_us = micros();   
          portEXIT_CRITICAL(&g_dataMux);
        }
      }
 
      if (g_lox2_ok && lox2.isRangeComplete()) {
        int32_t d2 = lox2.readRange();
        if (d2 > 0 && d2 < 8000) {
          int32_t med2 = getMedian(d2, buffer2, index2);
          ema2 = alpha * (float)med2 + (1.0f - alpha) * ema2;
          portENTER_CRITICAL(&g_dataMux);
          g_dist2_mm = (int32_t)(ema2 + 0.5f);
          portEXIT_CRITICAL(&g_dataMux);
        }
      }
 
      I2C_Unlock();
    }
  }
}
#endif
/* %%%-SFUNWIZ_wrapper_includes_Changes_END --- EDIT HERE TO _BEGIN */
#define y_width 1
#define y_1_width 1
#define y_2_width 1
#define y_3_width 1

/*
 * Create external references here.  
 *
 */
/* %%%-SFUNWIZ_wrapper_externs_Changes_BEGIN --- EDIT HERE TO _END */
/* extern double func(double a); */
/* %%%-SFUNWIZ_wrapper_externs_Changes_END --- EDIT HERE TO _BEGIN */

/*
 * Start function
 *
 */
extern "C" void Sensors_Start_wrapper(void);

void Sensors_Start_wrapper(void)
{
/* %%%-SFUNWIZ_wrapper_Start_Changes_BEGIN --- EDIT HERE TO _END */
#ifndef MATLAB_MEX_FILE
  pinMode(SHT_LOX1, OUTPUT);
  pinMode(SHT_LOX2, OUTPUT);
 
  g_i2cMutex = xSemaphoreCreateMutex();
 
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(100000);
  delay(20);
 
  if (I2C_Lock(pdMS_TO_TICKS(50))) {
    configMPU6050(MPU1_ADDRESS);
    delay(5);
    configMPU6050(MPU2_ADDRESS);
    I2C_Unlock();
  }
  delay(5);

  // --- DYNAMIC STARTUP CALIBRATION ---
  // Take 500 measurements to find the exact resting bias
  if (I2C_Lock(pdMS_TO_TICKS(2000))) {
    long sum1 = 0, sum2 = 0;
    int valid1 = 0, valid2 = 0;
    int16_t ax, ay, az;
    
    for (int i = 0; i < 500; i++) {
      if (readMPUAccelXYZ(MPU1_ADDRESS, ax, ay, az)) { sum1 += az; valid1++; }
      if (readMPUAccelXYZ(MPU2_ADDRESS, ax, ay, az)) { sum2 += az; valid2++; }
      delay(2); // Wait 2ms between samples
    }
    
    // Calculate the resting state (Captures gravity + module offset)
    // By subtracting this exact value later, the resting acceleration becomes 0.0 m/s^2
    if (valid1 > 0) {
      float avg1 = (float)sum1 / valid1;
      g_mpu1_z_offset = (avg1 / 16384.0f) * 9.81f; 
    }
    if (valid2 > 0) {
      float avg2 = (float)sum2 / valid2;
      g_mpu2_z_offset = (avg2 / 16384.0f) * 9.81f;
    }
    I2C_Unlock();
  }
 
  setVL53IDs();
 
  portENTER_CRITICAL(&g_dataMux);
  g_dist1_mm = -1;
  g_dist2_mm = -1;
  portEXIT_CRITICAL(&g_dataMux);
 
  xTaskCreatePinnedToCore(ToFTask, "ToFTask", 4096, NULL, 1, NULL, 0);
#endif
/* %%%-SFUNWIZ_wrapper_Start_Changes_END --- EDIT HERE TO _BEGIN */
}
/*
 * Output function
 *
 */
extern "C" void Sensors_Outputs_wrapper(real32_T *ToF1_m,
			real32_T *ToF2_m,
			real32_T *Acc_Middle_mps2,
			real32_T *Acc_Top_mps2);

void Sensors_Outputs_wrapper(real32_T *ToF1_m,
			real32_T *ToF2_m,
			real32_T *Acc_Middle_mps2,
			real32_T *Acc_Top_mps2)
{
/* %%%-SFUNWIZ_wrapper_Outputs_Changes_BEGIN --- EDIT HERE TO _END */
#ifndef MATLAB_MEX_FILE
  static int16_t last_ax1=0, last_ay1=0, last_az1=0;
  static int16_t last_ax2=0, last_ay2=0, last_az2=0;
  
  // Hold previous valid values to prevent spikes in Simulink if I2C misses a beat
  static float last_tof1_valid = 0.0f;
  static float last_tof2_valid = 0.0f;

  float bias1 = 9.31f;
  float bias2 = 17.20f;
 
  bool ok1 = false, ok2 = false;
 
  // 1. Read raw data
  if (I2C_Lock(pdMS_TO_TICKS(20))) {
    ok1 = readMPUAccelXYZ(MPU1_ADDRESS, last_ax1, last_ay1, last_az1);
    ok2 = readMPUAccelXYZ(MPU2_ADDRESS, last_ax2, last_ay2, last_az2);
    I2C_Unlock();
  }
 
  // 2. Wake up sensors if they crashed
  if (!ok1) {
    if (I2C_Lock(pdMS_TO_TICKS(1))) { wakeUpMPU(MPU1_ADDRESS); I2C_Unlock(); }
  }
  if (!ok2) {
    if (I2C_Lock(pdMS_TO_TICKS(1))) { wakeUpMPU(MPU2_ADDRESS); I2C_Unlock(); }
  }
 
  // 3. Convert ONLY the Z-axis and apply the DYNAMIC offsets (Zero-Mean)
  Acc_Top_mps2[0]    = ((last_az1 / 16384.0f) * 9.81f) - g_mpu1_z_offset; 
  Acc_Middle_mps2[0] = ((last_az2 / 16384.0f) * 9.81f) - g_mpu2_z_offset; 
 
  // 4. Fetch ToF data safely
  int32_t d1, d2;
  uint32_t lastUpdate;
  portENTER_CRITICAL(&g_dataMux);
  d1         = g_dist1_mm;
  d2         = g_dist2_mm;
  lastUpdate = g_tof_update_us;
  portEXIT_CRITICAL(&g_dataMux);
 
  // 5. Staleness check and Conversion to Meters
  uint32_t age = micros() - lastUpdate;
  if (lastUpdate != 0 && age < 80000 && d1 > 0) {
    last_tof1_valid = (d1 - bias1) / 1000.0f;
  }
  if (lastUpdate != 0 && age < 80000 && d2 > 0) {
    last_tof2_valid = (d2 - bias2) / 1000.0f;
  }

  ToF1_m[0] = last_tof1_valid;
  ToF2_m[0] = last_tof2_valid;
  
#endif
/* %%%-SFUNWIZ_wrapper_Outputs_Changes_END --- EDIT HERE TO _BEGIN */
}


