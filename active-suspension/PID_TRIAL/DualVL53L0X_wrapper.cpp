
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
Adafruit_VL53L0X lox1;
Adafruit_VL53L0X lox2;

VL53L0X_RangingMeasurementData_t measure1;
VL53L0X_RangingMeasurementData_t measure2;

// -------------------- Shared data (ToF) ------------
static volatile int32_t g_dist1_mm = -1;
static volatile int32_t g_dist2_mm = -1;
static volatile uint32_t g_tof_t_us = 0;     // timestamp of last ToF update (micros)
static volatile bool g_tof_ok = false;

// -------------------- Status flags -----------------
static volatile bool g_mpu_ok = false;
static volatile bool g_lox1_ok = false;
static volatile bool g_lox2_ok = false;

// Critical section for shared variables
static portMUX_TYPE g_mux = portMUX_INITIALIZER_UNLOCKED;

// -------------------- Helpers ----------------------
static inline void i2cWriteByte(uint8_t addr, uint8_t reg, uint8_t val)
{
  Wire.beginTransmission(addr);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission(true);
}

static inline bool i2cReadBytes(uint8_t addr, uint8_t startReg, uint8_t *buf, size_t len)
{
  Wire.beginTransmission(addr);
  Wire.write(startReg);
  // Use repeated-start (no STOP) then read
  if (Wire.endTransmission(false) != 0) return false;
  int got = Wire.requestFrom((int)addr, (int)len, (int)true);
  if (got != (int)len) return false;
  for (size_t i = 0; i < len; i++) buf[i] = Wire.read();
  return true;
}

static inline void wakeUpMPU(uint8_t address)
{
  // PWR_MGMT_1 = 0 -> wake
  i2cWriteByte(address, 0x6B, 0x00);
}

static inline void configMPU6050(uint8_t address)
{
  // Recommended baseline config for control work:
  // - DLPF ~ 42 Hz (good noise reduction, low latency)
  // - Accel range ±4g (more headroom than ±2g)
  // - Gyro range ±500 dps (optional, not used here but stable)
  // - Sample rate = 200 Hz (matches your Simulink Ts=0.005)
  //
  // NOTE: MPU internal sample is 1kHz when DLPF enabled.
  // SampleRate = 1000/(1+SMPLRT_DIV). For 200Hz -> DIV=4.
  wakeUpMPU(address);
  delay(2);

  // CONFIG (0x1A) DLPF_CFG = 3 -> ~42 Hz accel/gyro bandwidth
  i2cWriteByte(address, 0x1A, 0x03);

  // SMPLRT_DIV (0x19) = 4 -> 1000/(1+4)=200 Hz
  i2cWriteByte(address, 0x19, 0x04);

  // ACCEL_CONFIG (0x1C) AFS_SEL=1 -> ±4g
  i2cWriteByte(address, 0x1C, 0x08);

  // GYRO_CONFIG (0x1B) FS_SEL=1 -> ±500 dps (not required if not using gyro)
  i2cWriteByte(address, 0x1B, 0x08);
}

static inline bool readMPUAccelXYZ(uint8_t address, int16_t &ax, int16_t &ay, int16_t &az)
{
  uint8_t buf[6];
  if (!i2cReadBytes(address, 0x3B, buf, 6)) return false;
  ax = (int16_t)((buf[0] << 8) | buf[1]);
  ay = (int16_t)((buf[2] << 8) | buf[3]);
  az = (int16_t)((buf[4] << 8) | buf[5]);
  return true;
}

// ------------- VL53L0X address assignment -----------
static void setVL53IDs()
{
  // Reset both
  digitalWrite(SHT_LOX1, LOW);
  digitalWrite(SHT_LOX2, LOW);
  delay(10);

  // Bring both high
  digitalWrite(SHT_LOX1, HIGH);
  digitalWrite(SHT_LOX2, HIGH);
  delay(10);

  // Keep #1 awake, #2 shut down
  digitalWrite(SHT_LOX1, HIGH);
  digitalWrite(SHT_LOX2, LOW);
  delay(10);

  g_lox1_ok = lox1.begin(LOX1_ADDRESS, false); // false: don't restart Wire
  delay(10);

  // Now wake #2
  digitalWrite(SHT_LOX2, HIGH);
  delay(10);
  g_lox2_ok = lox2.begin(LOX2_ADDRESS, false);
  delay(10);
}

// ------------- ToF background task ------------------
static void ToFTask(void *param)
{
  // Run ToF at a realistic rate (e.g., 50 Hz = 20 ms).
  // You can change this, but don't go crazy.
  const TickType_t period = pdMS_TO_TICKS(20);
  TickType_t lastWake = xTaskGetTickCount();

  for (;;)
  {
    vTaskDelayUntil(&lastWake, period);

    int32_t d1 = -1, d2 = -1;
    bool ok = false;

    if (g_lox1_ok) {
      lox1.rangingTest(&measure1, false);
      if (measure1.RangeStatus != 4) d1 = (int32_t)measure1.RangeMilliMeter;
    }
    if (g_lox2_ok) {
      lox2.rangingTest(&measure2, false);
      if (measure2.RangeStatus != 4) d2 = (int32_t)measure2.RangeMilliMeter;
    }

    ok = (d1 >= 0 && d2 >= 0);

    portENTER_CRITICAL(&g_mux);
    g_dist1_mm = d1;
    g_dist2_mm = d2;
    g_tof_t_us = micros();
    g_tof_ok = ok;
    portEXIT_CRITICAL(&g_mux);
  }
}
#endif
/* %%%-SFUNWIZ_wrapper_includes_Changes_END --- EDIT HERE TO _BEGIN */
#define y_width 1
#define y_1_width 1
#define y_2_width 3
#define y_3_width 3

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
extern "C" void DualVL53L0X_Start_wrapper(void);

void DualVL53L0X_Start_wrapper(void)
{
/* %%%-SFUNWIZ_wrapper_Start_Changes_BEGIN --- EDIT HERE TO _END */
#ifndef MATLAB_MEX_FILE
  pinMode(SHT_LOX1, OUTPUT);
  pinMode(SHT_LOX2, OUTPUT);

  // I2C init once
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(400000);      // VL53L0X is happiest at 400k
  delay(20);

  // Configure MPUs
  configMPU6050(MPU1_ADDRESS);
  delay(5);
  configMPU6050(MPU2_ADDRESS);
  delay(5);

  // Quick comms test (optional)
  int16_t ax, ay, az;
  bool m1 = readMPUAccelXYZ(MPU1_ADDRESS, ax, ay, az);
  bool m2 = readMPUAccelXYZ(MPU2_ADDRESS, ax, ay, az);
  g_mpu_ok = (m1 && m2);

  // Setup ToFs with unique addresses
  setVL53IDs();

  // Start ToF task on core 0 (leave core 1 for WiFi etc. if needed)
  // Stack size: 4096 is usually fine for this task.
  xTaskCreatePinnedToCore(ToFTask, "ToFTask", 4096, NULL, 1, NULL, 0);

  // Initialize shared values
  portENTER_CRITICAL(&g_mux);
  g_dist1_mm = -1;
  g_dist2_mm = -1;
  g_tof_t_us = micros();
  g_tof_ok = false;
  portEXIT_CRITICAL(&g_mux);

#endif
/* %%%-SFUNWIZ_wrapper_Start_Changes_END --- EDIT HERE TO _BEGIN */
}
/*
 * Output function
 *
 */
extern "C" void DualVL53L0X_Outputs_wrapper(int32_T *Dist1,
			int32_T *Dist2,
			int16_T *MPU1,
			int16_T *MPU2);

void DualVL53L0X_Outputs_wrapper(int32_T *Dist1,
			int32_T *Dist2,
			int16_T *MPU1,
			int16_T *MPU2)
{
/* %%%-SFUNWIZ_wrapper_Outputs_Changes_BEGIN --- EDIT HERE TO _END */
#ifndef MATLAB_MEX_FILE
  // ---- 1) Read MPUs at 200 Hz (this is your synchronized tick) ----
  int16_t ax1=0, ay1=0, az1=0;
  int16_t ax2=0, ay2=0, az2=0;

  bool ok1 = readMPUAccelXYZ(MPU1_ADDRESS, ax1, ay1, az1);
  bool ok2 = readMPUAccelXYZ(MPU2_ADDRESS, ax2, ay2, az2);

  if (!ok1) { wakeUpMPU(MPU1_ADDRESS); ax1 = ay1 = az1 = (int16_t)0x8000; }
  if (!ok2) { wakeUpMPU(MPU2_ADDRESS); ax2 = ay2 = az2 = (int16_t)0x8000; }

  MPU1[0] = ax1; MPU1[1] = ay1; MPU1[2] = az1;
  MPU2[0] = ax2; MPU2[1] = ay2; MPU2[2] = az2;

  // ---- 2) Get latest ToF (sample-and-hold) without blocking ----
  int32_t d1, d2;
  portENTER_CRITICAL(&g_mux);
  d1 = g_dist1_mm;
  d2 = g_dist2_mm;
  portEXIT_CRITICAL(&g_mux);

  Dist1[0] = d1;
  Dist2[0] = d2;

#endif
/* %%%-SFUNWIZ_wrapper_Outputs_Changes_END --- EDIT HERE TO _BEGIN */
}


