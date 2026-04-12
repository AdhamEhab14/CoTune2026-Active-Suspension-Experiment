
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
#define MPU1_ADDRESS 0x68   
#define MPU2_ADDRESS 0x69   
 
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
  i2cWriteByte(address, 0x1A, 0x03);
  i2cWriteByte(address, 0x19, 0x04);
  i2cWriteByte(address, 0x1C, 0x00);  
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
  } else { g_lox1_ok = false; }
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
  } else { g_lox2_ok = false; }
  delay(20);
}
 
// ------------- ToF background task (RAW DATA FOR KALMAN) ------------------
static void ToFTask(void *param) {
  const TickType_t period = pdMS_TO_TICKS(40);
  TickType_t lastWake = xTaskGetTickCount();
 
  if (I2C_Lock(pdMS_TO_TICKS(100))) { delay(100); I2C_Unlock(); }
 
  for (;;) {
    vTaskDelayUntil(&lastWake, period);
    if (I2C_Lock(pdMS_TO_TICKS(10))) {
      // Sensor 1 (RAW)
      if (g_lox1_ok && lox1.isRangeComplete()) {
        int32_t d1 = lox1.readRange();
        if (d1 > 0 && d1 < 8000) {
          portENTER_CRITICAL(&g_dataMux);
          g_dist1_mm      = d1;         
          g_tof_update_us = micros();   
          portEXIT_CRITICAL(&g_dataMux);
        }
      }
      // Sensor 2 (RAW)
      if (g_lox2_ok && lox2.isRangeComplete()) {
        int32_t d2 = lox2.readRange();
        if (d2 > 0 && d2 < 8000) {
          portENTER_CRITICAL(&g_dataMux);
          g_dist2_mm = d2;              
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
  if (I2C_Lock(pdMS_TO_TICKS(2000))) {
    long sum1 = 0, sum2 = 0;
    int valid1 = 0, valid2 = 0;
    int16_t ax, ay, az;
    
    for (int i = 0; i < 500; i++) {
      if (readMPUAccelXYZ(MPU1_ADDRESS, ax, ay, az)) { sum1 += az; valid1++; }
      if (readMPUAccelXYZ(MPU2_ADDRESS, ax, ay, az)) { sum2 += az; valid2++; }
      delay(2); 
    }
    
    // Calculate the exact resting Z-vector (Gravity fixed)
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
extern "C" void Sensors_Outputs_wrapper(real32_T *Pos1,
			real32_T *Vel1,
			real32_T *Pos2,
			real32_T *Vel2);

void Sensors_Outputs_wrapper(real32_T *Pos1,
			real32_T *Vel1,
			real32_T *Pos2,
			real32_T *Vel2)
{
/* %%%-SFUNWIZ_wrapper_Outputs_Changes_BEGIN --- EDIT HERE TO _END */
#ifndef MATLAB_MEX_FILE
  // --- KALMAN FILTER MEMORY ---
  static float x1_pos = 0.135f, x1_vel = 0.0f;
  static float P1_00 = 1.0f, P1_01 = 0.0f, P1_10 = 0.0f, P1_11 = 1.0f;
  
  static float x2_pos = 0.135f, x2_vel = 0.0f;
  static float P2_00 = 1.0f, P2_01 = 0.0f, P2_10 = 0.0f, P2_11 = 1.0f;

  // --- TUNED FINGERPRINT ---
  // Side 1 (Left)
  float Q1_accel = 0.0001f;   // Trust the MPU physics
  float R1_meas  = 0.01f;     // Distrust the laser noise
  float bias1    = 9.31f;     // Your Side 1 Bias (mm)

  // Side 2 (Right)
  float Q2_accel = 0.0001f; 
  float R2_meas  = 0.01f; 
  float bias2    = 17.20f;    // Your Side 2 Bias (mm)

  float dt = 0.04f;             

  static int16_t last_ax1=0, last_ay1=0, last_az1=0;
  static int16_t last_ax2=0, last_ay2=0, last_az2=0;
  bool ok1 = false, ok2 = false;
 
  if (I2C_Lock(pdMS_TO_TICKS(20))) {
    ok1 = readMPUAccelXYZ(MPU1_ADDRESS, last_ax1, last_ay1, last_az1);
    ok2 = readMPUAccelXYZ(MPU2_ADDRESS, last_ax2, last_ay2, last_az2);
    I2C_Unlock();
  }
 
  if (!ok1) { if (I2C_Lock(pdMS_TO_TICKS(1))) { wakeUpMPU(MPU1_ADDRESS); I2C_Unlock(); } }
  if (!ok2) { if (I2C_Lock(pdMS_TO_TICKS(1))) { wakeUpMPU(MPU2_ADDRESS); I2C_Unlock(); } }
 
  // Calculate Dynamic Acceleration
  float acc_dyn1 = ((last_az1 / 16384.0f) * 9.81f) - g_mpu1_z_offset; 
  float acc_dyn2 = ((last_az2 / 16384.0f) * 9.81f) - g_mpu2_z_offset; 
 
  int32_t d1, d2;
  uint32_t lastUpdate;
  portENTER_CRITICAL(&g_dataMux);
  d1         = g_dist1_mm;
  d2         = g_dist2_mm;
  lastUpdate = g_tof_update_us;
  portEXIT_CRITICAL(&g_dataMux);
  
  uint32_t age = micros() - lastUpdate;
 
  // ==========================================
  // KALMAN FILTER 1 (SIDE 1)
  // ==========================================
  x1_pos += (x1_vel * dt) + (0.5f * acc_dyn1 * dt * dt);
  x1_vel += (acc_dyn1 * dt);
  
  P1_00 += dt * (P1_10 + P1_01 + P1_11 * dt) + (Q1_accel * dt * dt);
  P1_01 += dt * P1_11;
  P1_10 += dt * P1_11;
  P1_11 += Q1_accel;

  if (lastUpdate != 0 && age < 80000 && d1 > 0 && d1 < 8000) {
      float z_meas = (d1 - bias1) / 1000.0f; // Subtract bias and convert to meters
      float y = z_meas - x1_pos;
      
      float S = P1_00 + R1_meas;
      float K0 = P1_00 / S;
      float K1 = P1_10 / S;

      x1_pos += K0 * y;
      x1_vel += K1 * y;

      float P00_temp = P1_00;
      float P01_temp = P1_01;
      P1_00 -= K0 * P00_temp;
      P1_01 -= K0 * P01_temp;
      P1_10 -= K1 * P00_temp;
      P1_11 -= K1 * P01_temp;
  }

  // ==========================================
  // KALMAN FILTER 2 (SIDE 2)
  // ==========================================
  x2_pos += (x2_vel * dt) + (0.5f * acc_dyn2 * dt * dt);
  x2_vel += (acc_dyn2 * dt);
  
  P2_00 += dt * (P2_10 + P2_01 + P2_11 * dt) + (Q2_accel * dt * dt);
  P2_01 += dt * P2_11;
  P2_10 += dt * P2_11;
  P2_11 += Q2_accel;

  if (lastUpdate != 0 && age < 80000 && d2 > 0 && d2 < 8000) {
      float z_meas = (d2 - bias2) / 1000.0f; // Subtract bias and convert to meters
      float y = z_meas - x2_pos;
      
      float S = P2_00 + R2_meas;
      float K0 = P2_00 / S;
      float K1 = P2_10 / S;

      x2_pos += K0 * y;
      x2_vel += K1 * y;

      float P00_temp = P2_00;
      float P01_temp = P2_01;
      P2_00 -= K0 * P00_temp;
      P2_01 -= K0 * P01_temp;
      P2_10 -= K1 * P00_temp;
      P2_11 -= K1 * P01_temp;
  }

  // ==========================================
  // EXPORT TO SIMULINK
  // ==========================================
  Pos1[0] = x1_pos;
  Vel1[0] = x1_vel;
  Pos2[0] = x2_pos;
  Vel2[0] = x2_vel;
#endif
/* %%%-SFUNWIZ_wrapper_Outputs_Changes_END --- EDIT HERE TO _BEGIN */
}


