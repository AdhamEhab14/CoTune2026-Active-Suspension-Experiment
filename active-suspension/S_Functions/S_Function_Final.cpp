/* Includes_BEGIN */
#ifndef MATLAB_MEX_FILE
#include <Arduino.h>
#include <Wire.h>
#include <math.h>
#include "Adafruit_VL53L0X.h"

#define LOX1_ADDRESS 0x30
#define LOX2_ADDRESS 0x31
#define MPU1_ADDRESS 0x68
#define MPU2_ADDRESS 0x69

#define SHT_LOX1 25
#define SHT_LOX2 26

#define I2C_SDA 21
#define I2C_SCL 22

static Adafruit_VL53L0X lox1;
static Adafruit_VL53L0X lox2;

static volatile int32_t g_dist1_mm = -1;
static volatile int32_t g_dist2_mm = -1;
static volatile int16_t g_az1 = 0;
static volatile int16_t g_az2 = 0;
static volatile uint32_t g_tof_update_us = 0;
static volatile bool g_lox1_ok = false;
static volatile bool g_lox2_ok = false;

static float g_mpu1_z_offset = 0.0f;
static float g_mpu2_z_offset = 0.0f;

static portMUX_TYPE g_dataMux = portMUX_INITIALIZER_UNLOCKED;

static SemaphoreHandle_t g_i2cMutex = NULL;

/* ====================== MULTI-RATE KALMAN FILTER ====================== */

#define KF_N 4
#define KF_DT 0.002f

static const float KF_Ad[4][4] = {
    { 0.99761590f, 0.00234440f, 0.00184453f, -0.00181533f},
    { 0.00168796f, 0.99761766f, 0.00011007f, 0.00186025f},
    {-0.67758326f, -0.05616000f, 0.95557716f, 0.04372328f},
    { 1.63379252f, -2.32531627f, 0.10712204f, 0.86310153f}
};

static const float KF_Bd[4] = {
    0.00000265f, -0.00000188f, 0.00075287f, -0.00181533f
};


static const float KF_C[4][4] = {
    { 1.000000f, 0.000000f, 0.000000f, 0.000000f},
    { 0.000000f, 1.000000f, 0.000000f, 0.000000f},
    {-367.346939f, 0.000000f, -23.706122f, 23.706122f},
    { 900.000000f, -1250.000000f, 58.080000f, -72.806000f}
};

static const float KF_D[4] = {
    0.000000f, 0.000000f, 0.408163f, -1.000000f
};

static float KF_Q[4][4] = {
    {1e-6f, 0, 0, 0},
    { 0, 1e-4f, 0, 0},
    { 0, 0, 1e-4f, 0},
    { 0, 0, 0, 1e-3f}
};

static float KF_R_tof[2][2] = { {1e-3f, 0}, {0, 1e-3f} };
static float KF_R_mpu[2][2] = { {0.01f, 0}, {0, 0.01f} };

static float g_kf_x[4] = {0.0f, 0.0f, 0.0f, 0.0f};
static float g_kf_P[4][4];
static volatile float g_control_force_N = 0.0f;
static portMUX_TYPE g_kfMux = portMUX_INITIALIZER_UNLOCKED;

static int32_t g_prev_dist1_mm = -1;
static int32_t g_prev_dist2_mm = -1;

/* ====================== I2C HELPERS ====================== */

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
    }

}





static volatile int32_t g_consecutive_errors = 0;

static void recoverI2CBus() {
    Wire.end();
    pinMode(I2C_SCL, OUTPUT);
    pinMode(I2C_SDA, INPUT_PULLUP);

    for (int i = 0; i < 9; i++) {
        digitalWrite(I2C_SCL, LOW);
        delayMicroseconds(5);
        digitalWrite(I2C_SCL, HIGH);
        delayMicroseconds(5);
    }
    Wire.begin(I2C_SDA, I2C_SCL);
    Wire.setTimeout(150);
    Wire.setClock(400000);
}

/* ====================== KALMAN FILTER MATH ====================== */

static void kf_matmul_A_P_At(float out[4][4], const float A[4][4], const float P[4][4]) {
    float AP[4][4] = {0};
    int i, j;

    for (i=0; i<4; i++) for (j=0; j<4; j++) {
        AP[i][j] = A[i][0]*P[0][j] + A[i][1]*P[1][j] + A[i][2]*P[2][j] + A[i][3]*P[3][j];
    }

    for (i=0; i<4; i++) for (j=0; j<4; j++) {
        out[i][j] = AP[i][0]*A[j][0] + AP[i][1]*A[j][1] + AP[i][2]*A[j][2] + AP[i][3]*A[j][3];
    }
}

static void kf_update_2meas(float x[4], float P[4][4],
                            const float y[2], const float H[2][4],
                            const float R[2][2], float u, const float Dloc[2]) {
    float r[2];
    int m, n, i, j;

    for (m=0; m<2; m++) {
        r[m] = y[m] - Dloc[m]*u;
        for (j=0; j<4; j++) r[m] -= H[m][j]*x[j];
    }
    float HP[2][4];
    for (m=0; m<2; m++) for (j=0; j<4; j++) {
        HP[m][j] = H[m][0]*P[0][j] + H[m][1]*P[1][j] + H[m][2]*P[2][j] + H[m][3]*P[3][j];
    }
    float S[2][2];
    for (m=0; m<2; m++) for (n=0; n<2; n++) {
        S[m][n] = HP[m][0]*H[n][0] + HP[m][1]*H[n][1] + HP[m][2]*H[n][2] + HP[m][3]*H[n][3];
        if (m==n) S[m][n] += R[m][n];
    }
    float det = S[0][0]*S[1][1] - S[0][1]*S[1][0];
    if (fabsf(det) < 1e-12f) return;
    float Si[2][2] = {
        { S[1][1]/det, -S[0][1]/det},
        {-S[1][0]/det,  S[0][0]/det}
    };
    float PHt[4][2];
    for (i=0; i<4; i++) for (m=0; m<2; m++) {
        PHt[i][m] = P[i][0]*H[m][0] + P[i][1]*H[m][1] + P[i][2]*H[m][2] + P[i][3]*H[m][3];
    }
    float K[4][2];
    for (i=0; i<4; i++) for (m=0; m<2; m++) {
        K[i][m] = PHt[i][0]*Si[0][m] + PHt[i][1]*Si[1][m];
    }
    for (i=0; i<4; i++) x[i] += K[i][0]*r[0] + K[i][1]*r[1];
    float KH[4][4] = {0};
    for (i=0; i<4; i++) for (j=0; j<4; j++) {
        KH[i][j] = K[i][0]*H[0][j] + K[i][1]*H[1][j];
    }
    for (i=0; i<4; i++) for (j=0; j<4; j++) {
        if (i==j) KH[i][j] = 1.0f - KH[i][j];
        else KH[i][j] = -KH[i][j];
    }
    float Pnew[4][4] = {0};
    for (i=0; i<4; i++) for (j=0; j<4; j++) {
        Pnew[i][j] = KH[i][0]*P[0][j] + KH[i][1]*P[1][j] + KH[i][2]*P[2][j] + KH[i][3]*P[3][j];
    }
    for (i=0; i<4; i++) for (j=0; j<4; j++) P[i][j] = Pnew[i][j];
    for (i=0; i<4; i++) for (j=i+1; j<4; j++) {
        float avg = 0.5f*(P[i][j] + P[j][i]);
        P[i][j] = avg; P[j][i] = avg;
    }
}

static void kf_predict(float x[4], float P[4][4], float u) {
    float xn[4];
    int i;

    for (i=0; i<4; i++) {
        xn[i] = KF_Ad[i][0]*x[0] + KF_Ad[i][1]*x[1] + KF_Ad[i][2]*x[2] + KF_Ad[i][3]*x[3] + KF_Bd[i]*u;
    }

    for (i=0; i<4; i++) x[i] = xn[i];

    float Pn[4][4];
    kf_matmul_A_P_At(Pn, KF_Ad, P);
    int j;
    for (i=0; i<4; i++) for (j=0; j<4; j++) P[i][j] = Pn[i][j] + KF_Q[i][j];

    for (i=0; i<4; i++) for (j=i+1; j<4; j++) {
        float avg = 0.5f*(P[i][j] + P[j][i]);
        P[i][j] = avg; P[j][i] = avg;
    }
}

/* ====================== FREERTOS TASKS ====================== */

static void KfMpuTask(void *param) {
    const TickType_t period = pdMS_TO_TICKS(2);
    TickType_t lastWake = xTaskGetTickCount();

    for (;;) {
        vTaskDelayUntil(&lastWake, period);

        if (xSemaphoreTake(g_i2cMutex, 0) != pdTRUE) continue;

        int16_t ax1, ay1, az1, ax2, ay2, az2;
        bool ok1 = readMPUAccelXYZ(MPU1_ADDRESS, ax1, ay1, az1);
        bool ok2 = readMPUAccelXYZ(MPU2_ADDRESS, ax2, ay2, az2);

        xSemaphoreGive(g_i2cMutex);

        if (!ok1 && !ok2) continue;
        float as = ok1 ? ((float)az1 / 16384.0f * 9.81f) - g_mpu1_z_offset : 0.0f;
        float aus = ok2 ? ((float)az2 / 16384.0f * 9.81f) - g_mpu2_z_offset : 0.0f;

        portENTER_CRITICAL(&g_dataMux);

        if (ok1) g_az1 = az1;
        if (ok2) g_az2 = az2;

        portEXIT_CRITICAL(&g_dataMux);
       
        float u = 0.0f;

        portENTER_CRITICAL(&g_kfMux);

        u = g_control_force_N;

        portEXIT_CRITICAL(&g_kfMux);
        portENTER_CRITICAL(&g_kfMux);

        kf_predict(g_kf_x, g_kf_P, u);

        if (ok1 && ok2) {
            float y_mpu[2] = {as, aus};
            const float H_mpu[2][4] = {
                {KF_C[2][0], KF_C[2][1], KF_C[2][2], KF_C[2][3]},
                {KF_C[3][0], KF_C[3][1], KF_C[3][2], KF_C[3][3]}
            };
            const float D_mpu[2] = {KF_D[2], KF_D[3]};
            kf_update_2meas(g_kf_x, g_kf_P, y_mpu, H_mpu, KF_R_mpu, u, D_mpu);
        }
        portEXIT_CRITICAL(&g_kfMux);
    }
}

static void KfTofTask(void *param) {
    const TickType_t period = pdMS_TO_TICKS(20);
    TickType_t lastWake = xTaskGetTickCount();
    for (;;) {
        vTaskDelayUntil(&lastWake, period);
        if (xSemaphoreTake(g_i2cMutex, pdMS_TO_TICKS(50)) != pdTRUE) continue;

        bool read_ok = false;
        int32_t d1_mm = -1, d2_mm = -1;

        if (g_lox1_ok && lox1.isRangeComplete()) {
            int32_t d = lox1.readRange();
            if (d > 0 && d < 8000) d1_mm = d;
        }
        if (g_lox2_ok && lox2.isRangeComplete()) {
            int32_t d = lox2.readRange();
            if (d > 0 && d < 8000) d2_mm = d;
        }
        xSemaphoreGive(g_i2cMutex);

        if (d1_mm > 0) { g_prev_dist1_mm = d1_mm; g_dist1_mm = d1_mm; }
        if (d2_mm > 0) { g_prev_dist2_mm = d2_mm; g_dist2_mm = d2_mm; }

        if (d1_mm > 0 && d2_mm > 0) read_ok = true;

        if (read_ok) {
            float d1_m = (float)d1_mm / 1000.0f;
            float d2_m = (float)d2_mm / 1000.0f;

            float u = 0.0f;
            portENTER_CRITICAL(&g_kfMux);
            u = g_control_force_N;
            portEXIT_CRITICAL(&g_kfMux);

            float resting_d1 = 0.198f; 
            float resting_d2 = 0.182f; 

            float y_tof[2] = {d1_m - resting_d1, d2_m - resting_d2};

            const float H_tof[2][4] = {
                {1.0f, 0.0f, 0.0f, 0.0f},
                {0.0f, 1.0f, 0.0f, 0.0f}
            };
            const float D_tof[2] = {0.0f, 0.0f};

            portENTER_CRITICAL(&g_kfMux);
            kf_update_2meas(g_kf_x, g_kf_P, y_tof, H_tof, KF_R_tof, u, D_tof);
            portEXIT_CRITICAL(&g_kfMux);
        }
    }
}

#endif
/* Includes_END */

/* Externs_BEGIN */
/* extern double func(double a); */
/* Externs_END */

void Sensors_Start_wrapper(void)
{
/* Start_BEGIN */
#ifndef MATLAB_MEX_FILE
  pinMode(SHT_LOX1, OUTPUT);
  pinMode(SHT_LOX2, OUTPUT);

  g_i2cMutex = xSemaphoreCreateMutex();

  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setTimeout(150);
  Wire.setClock(100000);
  delay(20);

  if (I2C_Lock(pdMS_TO_TICKS(50))) {
    configMPU6050(MPU1_ADDRESS);
    configMPU6050(MPU2_ADDRESS);
    I2C_Unlock();
  }
  
  delay(250); 

  if (I2C_Lock(pdMS_TO_TICKS(2000))) {
    long sum1 = 0, sum2 = 0;
    int valid1 = 0, valid2 = 0;
    int16_t ax, ay, az;
    int i;
    for (i = 0; i < 500; i++) {
      if (readMPUAccelXYZ(MPU1_ADDRESS, ax, ay, az)) { sum1 += az; valid1++; }
      if (readMPUAccelXYZ(MPU2_ADDRESS, ax, ay, az)) { sum2 += az; valid2++; }
      delay(2); 
    }
    if (valid1 > 0) g_mpu1_z_offset = ((float)sum1 / valid1 / 16384.0f) * 9.81f;
    if (valid2 > 0) g_mpu2_z_offset = ((float)sum2 / valid2 / 16384.0f) * 9.81f;
    I2C_Unlock();
  }

  setVL53IDs();

  int i, j;
  for (i=0; i<4; i++) for (j=0; j<4; j++) g_kf_P[i][j] = (i==j) ? 0.01f : 0.0f;

  xTaskCreatePinnedToCore(KfMpuTask, "KfMpuTask", 4096, NULL, 2, NULL, 0);
  xTaskCreatePinnedToCore(KfTofTask,  "KfTofTask",  4096, NULL, 1, NULL, 0);
#endif
/* Start_END */
}

void Sensors_Outputs_wrapper(const real32_T *u_N,
                             real32_T *d1_m,
                             real32_T *d2_m,
                             real32_T *vs_mps,
                             real32_T *vus_mps)
{
/* Output_BEGIN */
#ifndef MATLAB_MEX_FILE
  portENTER_CRITICAL(&g_kfMux);
  g_control_force_N = (float)u_N[0];
  float x0 = g_kf_x[0];
  float x1 = g_kf_x[1];
  float x2 = g_kf_x[2];
  float x3 = g_kf_x[3];
  portEXIT_CRITICAL(&g_kfMux);

  static float p1_filtered = 0.0f;
  static float p2_filtered = 0.0f;
  static bool first_run = true;
  
  if (first_run) {
      p1_filtered = x0; 
      p2_filtered = x1;
      first_run = false;
  }

  const float alpha_p = 0.6f; 
  p1_filtered += alpha_p * (x0 - p1_filtered);
  p2_filtered += alpha_p * (x1 - p2_filtered);

  static float v1_hp = 0.0f, v2_hp = 0.0f;
  static float v1_prev_raw = 0.0f, v2_prev_raw = 0.0f;
  static float v1_filtered = 0.0f, v2_filtered = 0.0f;

  const float alpha_hp = 0.95f;
  const float alpha_lp = 0.15f;

  v1_hp = alpha_hp * (v1_hp + x2 - v1_prev_raw);
  v2_hp = alpha_hp * (v2_hp + x3 - v2_prev_raw);
  v1_prev_raw = x2;
  v2_prev_raw = x3;

  v1_filtered += alpha_lp * (v1_hp - v1_filtered);
  v2_filtered += alpha_lp * (v2_hp - v2_filtered);

  d1_m[0]    = p1_filtered;
  d2_m[0]    = p2_filtered;
  vs_mps[0]  = v1_filtered;
  vus_mps[0] = v2_filtered;

#endif
/* Output_END */
}

void Sensors_Terminate_wrapper(void)
{
/* Terminate_BEGIN */
/*
 * Custom Terminate code goes here.
 */
    return;
/* Terminate_END */
}