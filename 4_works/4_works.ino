#include <Wire.h>
#include "Adafruit_VL53L0X.h"

// --- ToF Sensor Addresses & Pins ---
#define LOX1_ADDRESS 0x30
#define LOX2_ADDRESS 0x31
#define SHT_LOX1 25
#define SHT_LOX2 26

Adafruit_VL53L0X lox1 = Adafruit_VL53L0X();
Adafruit_VL53L0X lox2 = Adafruit_VL53L0X();

// --- MPU6050 Addresses ---
const int MPU1_ADDR = 0x68; // Requires AD0 connected to GND
const int MPU2_ADDR = 0x69; // Requires AD0 connected to 3.3V

// --- Median Filter Variables ---
const int WINDOW_SIZE = 5;
int buffer1[WINDOW_SIZE] = {0};
int buffer2[WINDOW_SIZE] = {0};
int index1 = 0;
int index2 = 0;

// --- Median Filter Function ---
int getMedian(int newValue, int *buffer, int &index) {
  buffer[index] = newValue;
  index = (index + 1) % WINDOW_SIZE;

  int temp[WINDOW_SIZE];
  for (int i = 0; i < WINDOW_SIZE; i++) {
    temp[i] = buffer[i];
  }

  // Bubble Sort
  for (int i = 0; i < WINDOW_SIZE - 1; i++) {
    for (int j = 0; j < WINDOW_SIZE - i - 1; j++) {
      if (temp[j] > temp[j + 1]) {
        int swap = temp[j];
        temp[j] = temp[j + 1];
        temp[j + 1] = swap;
      }
    }
  }
  return temp[WINDOW_SIZE / 2];
}

// --- MPU Wakeup & Config Function ---
void wakeUpMPU(int address) {
  // 1. Wake it up
  Wire.beginTransmission(address);
  Wire.write(0x6B);  // PWR_MGMT_1 register
  Wire.write(0);     // Set to 0 to wake up
  Wire.endTransmission(true);

  // 2. Turn on the Digital Low Pass Filter (DLPF)
  Wire.beginTransmission(address);
  Wire.write(0x1A);  // CONFIG register
  Wire.write(0x03);  // Set DLPF to 44Hz (Smooths out the jagged spikes)
  byte error = Wire.endTransmission(true);
  
  if (error != 0) {
    while(1); // Freeze if an MPU fails to prevent bad data
  }
}

// --- MPU Read Z-Axis Function ---
float readMPU_Z(int address) {
  Wire.beginTransmission(address);
  Wire.write(0x3B);  
  Wire.endTransmission(false); 
  Wire.requestFrom(address, 6, true);  
  
  // We have to read X and Y to clear the buffer
  int16_t rawX = Wire.read() << 8 | Wire.read();      
  int16_t rawY = Wire.read() << 8 | Wire.read();  
  int16_t rawZ = Wire.read() << 8 | Wire.read();  
  
  // Convert to m/s^2 and return
  return (rawZ / 16384.0) * 9.81;
}

void setup() {
  Serial.begin(115200);
  delay(2000); 

  Wire.begin();

  // --- 1. Wake up the MPUs ---
  wakeUpMPU(MPU1_ADDR);
  wakeUpMPU(MPU2_ADDR);

  // --- 2. Initialize ToF Sensors ---
  pinMode(SHT_LOX1, OUTPUT);
  pinMode(SHT_LOX2, OUTPUT);

  // Reset both ToFs
  digitalWrite(SHT_LOX1, LOW);
  digitalWrite(SHT_LOX2, LOW);
  delay(10);
  
  digitalWrite(SHT_LOX1, HIGH);
  digitalWrite(SHT_LOX2, HIGH);
  delay(10);

  // Isolate ToF 1
  digitalWrite(SHT_LOX1, HIGH);
  digitalWrite(SHT_LOX2, LOW);
  delay(10);

  if (!lox1.begin(LOX1_ADDRESS)) {
    while (1); 
  }

  // Wake ToF 2
  digitalWrite(SHT_LOX2, HIGH);
  delay(10);

  if (!lox2.begin(LOX2_ADDRESS)) {
    while (1); 
  }
  
  delay(1000); 
}

void loop() {
  // --- 1. Read ToF Sensors ---
  VL53L0X_RangingMeasurementData_t measure1;
  VL53L0X_RangingMeasurementData_t measure2;

  lox1.rangingTest(&measure1, false);
  lox2.rangingTest(&measure2, false);

  int filtered1 = 0;
  if (measure1.RangeStatus != 4) {
    filtered1 = getMedian(measure1.RangeMilliMeter, buffer1, index1);
  }

  int filtered2 = 0;
  if (measure2.RangeStatus != 4) {
    filtered2 = getMedian(measure2.RangeMilliMeter, buffer2, index2);
  }

  // --- 2. Read MPU Sensors ---
  float raw_mpu1_Z = readMPU_Z(MPU1_ADDR);
  float raw_mpu2_Z = readMPU_Z(MPU2_ADDR);

  // Apply calibration offsets (Tweak these if the baseline ever shifts from 9.81)
  float mpu1_Z = raw_mpu1_Z - 1.49; 
  float mpu2_Z = raw_mpu2_Z - 0.79; 

  // --- 3. Plotter Formatting ---
  static bool labelsPrinted = false;
  if (!labelsPrinted) {
    // This tells the plotter what to name the lines
    Serial.println(F("ToF_1,ToF_2,MPU_1_Z,MPU_2_Z"));
    labelsPrinted = true;
  }

  // Print comma-separated values
  Serial.print(filtered1);
  Serial.print(",");
  Serial.print(filtered2);
  Serial.print(",");
  Serial.print(mpu1_Z);
  Serial.print(",");
  Serial.println(mpu2_Z); // The last one must be println!
  
  delay(40); // Matches the 25Hz rate from our Simulink test
}