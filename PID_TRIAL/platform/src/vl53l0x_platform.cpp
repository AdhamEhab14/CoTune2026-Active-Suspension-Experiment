#include "vl53l0x_platform.h"
#include <Wire.h>
#include <Arduino.h>

// --------------------------------------------------------------------------
// I2C Helper Functions (The "Missing" Code)
// --------------------------------------------------------------------------

// Write multiple bytes
int VL53L0X_write_multi(uint8_t deviceAddress, uint8_t index, uint8_t *pdata, uint32_t count, TwoWire *i2c)
{
  i2c->beginTransmission(deviceAddress);
  i2c->write(index);
  i2c->write(pdata, count);
  return i2c->endTransmission();
}

// Read multiple bytes
int VL53L0X_read_multi(uint8_t deviceAddress, uint8_t index, uint8_t *pdata, uint32_t count, TwoWire *i2c)
{
  i2c->beginTransmission(deviceAddress);
  i2c->write(index);
  i2c->endTransmission();

  i2c->requestFrom(deviceAddress, (uint8_t)count);
  while (count--)
  {
    *pdata++ = i2c->read();
  }
  return 0; // Success
}

int VL53L0X_write_byte(uint8_t deviceAddress, uint8_t index, uint8_t data, TwoWire *i2c)
{
  return VL53L0X_write_multi(deviceAddress, index, &data, 1, i2c);
}

int VL53L0X_write_word(uint8_t deviceAddress, uint8_t index, uint16_t data, TwoWire *i2c)
{
  uint8_t buff[2];
  buff[0] = (uint8_t)(data >> 8);
  buff[1] = (uint8_t)(data & 0xFF);
  return VL53L0X_write_multi(deviceAddress, index, buff, 2, i2c);
}

int VL53L0X_write_dword(uint8_t deviceAddress, uint8_t index, uint32_t data, TwoWire *i2c)
{
  uint8_t buff[4];
  buff[0] = (uint8_t)(data >> 24);
  buff[1] = (uint8_t)((data >> 16) & 0xFF);
  buff[2] = (uint8_t)((data >> 8) & 0xFF);
  buff[3] = (uint8_t)(data & 0xFF);
  return VL53L0X_write_multi(deviceAddress, index, buff, 4, i2c);
}

int VL53L0X_read_byte(uint8_t deviceAddress, uint8_t index, uint8_t *data, TwoWire *i2c)
{
  return VL53L0X_read_multi(deviceAddress, index, data, 1, i2c);
}

int VL53L0X_read_word(uint8_t deviceAddress, uint8_t index, uint16_t *data, TwoWire *i2c)
{
  uint8_t buff[2];
  int status = VL53L0X_read_multi(deviceAddress, index, buff, 2, i2c);
  *data = ((uint16_t)buff[0] << 8) | (uint16_t)buff[1];
  return status;
}

int VL53L0X_read_dword(uint8_t deviceAddress, uint8_t index, uint32_t *data, TwoWire *i2c)
{
  uint8_t buff[4];
  int status = VL53L0X_read_multi(deviceAddress, index, buff, 4, i2c);
  *data = ((uint32_t)buff[0] << 24) | ((uint32_t)buff[1] << 16) | ((uint32_t)buff[2] << 8) | (uint32_t)buff[3];
  return status;
}

// --------------------------------------------------------------------------
// Standard Driver Functions (Mapping to helpers)
// --------------------------------------------------------------------------

VL53L0X_Error VL53L0X_LockSequenceAccess(VL53L0X_DEV Dev)
{
  return VL53L0X_ERROR_NONE; // Not needed for I2C
}

VL53L0X_Error VL53L0X_UnlockSequenceAccess(VL53L0X_DEV Dev)
{
  return VL53L0X_ERROR_NONE; // Not needed for I2C
}

VL53L0X_Error VL53L0X_WriteMulti(VL53L0X_DEV Dev, uint8_t index, uint8_t *pdata, uint32_t count)
{
  return (VL53L0X_Error)VL53L0X_write_multi(Dev->I2cDevAddr, index, pdata, count, Dev->i2c);
}

VL53L0X_Error VL53L0X_ReadMulti(VL53L0X_DEV Dev, uint8_t index, uint8_t *pdata, uint32_t count)
{
  return (VL53L0X_Error)VL53L0X_read_multi(Dev->I2cDevAddr, index, pdata, count, Dev->i2c);
}

VL53L0X_Error VL53L0X_WrByte(VL53L0X_DEV Dev, uint8_t index, uint8_t data)
{
  return (VL53L0X_Error)VL53L0X_write_byte(Dev->I2cDevAddr, index, data, Dev->i2c);
}

VL53L0X_Error VL53L0X_WrWord(VL53L0X_DEV Dev, uint8_t index, uint16_t data)
{
  return (VL53L0X_Error)VL53L0X_write_word(Dev->I2cDevAddr, index, data, Dev->i2c);
}

VL53L0X_Error VL53L0X_WrDWord(VL53L0X_DEV Dev, uint8_t index, uint32_t data)
{
  return (VL53L0X_Error)VL53L0X_write_dword(Dev->I2cDevAddr, index, data, Dev->i2c);
}

VL53L0X_Error VL53L0X_UpdateByte(VL53L0X_DEV Dev, uint8_t index, uint8_t AndData, uint8_t OrData)
{
  uint8_t data;
  VL53L0X_Error status = VL53L0X_RdByte(Dev, index, &data);
  if (status != VL53L0X_ERROR_NONE)
    return status;
  data = (data & AndData) | OrData;
  return VL53L0X_WrByte(Dev, index, data);
}

VL53L0X_Error VL53L0X_RdByte(VL53L0X_DEV Dev, uint8_t index, uint8_t *data)
{
  return (VL53L0X_Error)VL53L0X_read_byte(Dev->I2cDevAddr, index, data, Dev->i2c);
}

VL53L0X_Error VL53L0X_RdWord(VL53L0X_DEV Dev, uint8_t index, uint16_t *data)
{
  return (VL53L0X_Error)VL53L0X_read_word(Dev->I2cDevAddr, index, data, Dev->i2c);
}

VL53L0X_Error VL53L0X_RdDWord(VL53L0X_DEV Dev, uint8_t index, uint32_t *data)
{
  return (VL53L0X_Error)VL53L0X_read_dword(Dev->I2cDevAddr, index, data, Dev->i2c);
}

VL53L0X_Error VL53L0X_PollingDelay(VL53L0X_DEV Dev)
{
  delay(2);
  return VL53L0X_ERROR_NONE;
}