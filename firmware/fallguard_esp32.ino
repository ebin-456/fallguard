/*
 * FallGuard Monitor - ESP32 Firmware
 * 
 * Target: ESP32 Dev Module (DOIT ESP32 DEVKIT V1 or similar)
 * Sensors:
 *   - MPU6050 (3-Axis Accelerometer + Gyroscope) via I2C (0x68)
 *   - MAX30102 (Optical Heart-Rate & Pulse Oximeter) via I2C (0x57)
 * Pinout:
 *   - GPIO 21 : I2C SDA
 *   - GPIO 22 : I2C SCL
 *   - GPIO 4  : Status / Alarm LED
 *   - GPIO 5  : Cancel / Reset Pushbutton (Active-LOW with internal pullup)
 *   - GPIO 18 : Piezo Buzzer (PWM / tone)
 * 
 * Wi-Fi Access Point:
 *   - SSID: FallGuard_Band
 *   - PASS: 12345678
 *   - Default AP IP: 192.168.4.1
 * 
 * Endpoints:
 *   - GET  /data   -> JSON live telemetry with CORS headers
 *   - GET  /cancel -> Aborts pre-alarm / emergency reset with CORS headers
 *   - OPTIONS *   -> CORS Preflight handler
 */

#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <math.h>

// ======================== HARDWARE PINS ========================
#define PIN_SDA         21
#define PIN_SCL         22
#define PIN_LED         4
#define PIN_BTN_CANCEL  5
#define PIN_BUZZER      18

// ===================== I2C SENSOR ADDRESSES =====================
#define MPU6050_ADDR    0x68
#define MAX30102_ADDR   0x57

// MPU6050 Registers
#define MPU_REG_SMPLRT_DIV   0x19
#define MPU_REG_CONFIG       0x1A
#define MPU_REG_ACCEL_CONFIG 0x1C
#define MPU_REG_PWR_MGMT_1   0x6B
#define MPU_REG_ACCEL_XOUT_H 0x3B
#define MPU_REG_WHO_AM_I     0x75

// MAX30102 Registers
#define MAX_REG_INTR_STATUS_1 0x00
#define MAX_REG_INTR_STATUS_2 0x01
#define MAX_REG_INTR_ENABLE_1 0x02
#define MAX_REG_FIFO_WR_PTR   0x04
#define MAX_REG_OVF_COUNTER   0x05
#define MAX_REG_FIFO_RD_PTR   0x06
#define MAX_REG_FIFO_DATA     0x07
#define MAX_REG_FIFO_CONFIG   0x08
#define MAX_REG_MODE_CONFIG   0x09
#define MAX_REG_SPO2_CONFIG   0x0A
#define MAX_REG_LED1_PA       0x0C // RED
#define MAX_REG_LED2_PA       0x0D // IR
#define MAX_REG_PART_ID       0xFF

// ==================== DETECTION THRESHOLDS ====================
// Accelerometer: MPU6050 configured for ±8g range (scale factor: 4096 LSB/g)
#define FREEFALL_G_THRESH    0.60f   // Free-fall threshold (< 0.60g)
#define IMPACT_G_THRESH      3.20f   // Impact threshold (> 3.20g)
#define STILL_G_MIN          0.75f   // Stillness low threshold
#define STILL_G_MAX          1.25f   // Stillness high threshold
#define IMPACT_WINDOW_MS     500     // Impact must follow free-fall within 500ms
#define STILL_WINDOW_MS      2000    // Must verify stillness for 2.0s post-impact
#define PRE_ALARM_WINDOW_MS  10000   // 10-second countdown before Emergency

// MAX30102 Optical threshold
#define SKIN_CONTACT_IR_THRESH 40000 // IR count threshold for skin contact

// ====================== STATE MACHINE ======================
enum FallState {
  STATE_MONITORING = 0,
  STATE_FREEFALL   = 1,
  STATE_WAIT_STILL = 2,
  STATE_PRE_ALARM  = 3,
  STATE_EMERGENCY  = 4
};

const char* STATE_STRINGS[] = {
  "MONITORING (NORMAL)",
  "FREEFALL",
  "WAIT_STILL",
  "PRE_ALARM",
  "EMERGENCY"
};

volatile FallState currentState = STATE_MONITORING;
unsigned long stateEnterTime = 0;
unsigned long freefallStartTime = 0;
unsigned long impactTime = 0;

// Sensor Health Status
bool mpuHealthy = false;
bool maxHealthy = false;

// Current Sensor Readings
float ax = 0.0f;
float ay = 0.0f;
float az = 1.0f;
float gMag = 1.0f;

uint32_t rawIR = 0;
uint32_t rawRed = 0;
bool skinContact = false;
int currentBpm = 0;

// Optical BPM Algorithm State
float dcFilterIR = 0;
float acSignalIR = 0;
unsigned long lastBeatTime = 0;
float bpmHistory[4] = {72.0f, 72.0f, 72.0f, 72.0f};
int bpmHistoryIdx = 0;

// Web Server
WebServer server(80);

// Wi-Fi AP Credentials
const char* AP_SSID = "FallGuard_Band";
const char* AP_PASS = "12345678";

// Buzzer PWM channel (ESP32 LEDC)
#define BUZZER_PWM_CHANNEL 0
#define BUZZER_PWM_RES     8

// ==================== I2C HELPER FUNCTIONS ====================
void writeI2C(uint8_t devAddr, uint8_t regAddr, uint8_t data) {
  Wire.beginTransmission(devAddr);
  Wire.write(regAddr);
  Wire.write(data);
  Wire.endTransmission();
}

uint8_t readI2CByte(uint8_t devAddr, uint8_t regAddr) {
  Wire.beginTransmission(devAddr);
  Wire.write(regAddr);
  Wire.endTransmission(false);
  Wire.requestFrom((uint8_t)devAddr, (uint8_t)1);
  if (Wire.available()) {
    return Wire.read();
  }
  return 0;
}

bool readI2CBytes(uint8_t devAddr, uint8_t regAddr, uint8_t* buffer, uint8_t length) {
  Wire.beginTransmission(devAddr);
  Wire.write(regAddr);
  if (Wire.endTransmission(false) != 0) return false;
  
  uint8_t count = Wire.requestFrom((uint8_t)devAddr, length);
  if (count < length) return false;
  
  for (uint8_t i = 0; i < length; i++) {
    buffer[i] = Wire.read();
  }
  return true;
}

// ==================== SENSOR INITIALIZATION ====================
bool initMPU6050() {
  Wire.beginTransmission(MPU6050_ADDR);
  if (Wire.endTransmission() != 0) {
    Serial.println("[MPU6050] Not found at 0x68");
    return false;
  }
  
  uint8_t whoAmI = readI2CByte(MPU6050_ADDR, MPU_REG_WHO_AM_I);
  if (whoAmI != 0x68 && whoAmI != 0x70 && whoAmI != 0x72) {
    Serial.printf("[MPU6050] Unexpected WHO_AM_I: 0x%02X\n", whoAmI);
  }

  // Wake up device, use PLL with X gyro reference
  writeI2C(MPU6050_ADDR, MPU_REG_PWR_MGMT_1, 0x01);
  delay(10);
  
  // Sample rate divider: 1kHz / (1 + 9) = 100 Hz
  writeI2C(MPU6050_ADDR, MPU_REG_SMPLRT_DIV, 0x09);
  
  // DLPF (Digital Low Pass Filter) = 44 Hz (delay 4.9 ms) -> CONFIG = 0x03
  writeI2C(MPU6050_ADDR, MPU_REG_CONFIG, 0x03);
  
  // Accelerometer Full Scale: ±8g (4096 LSB/g) -> ACCEL_CONFIG = 0x10
  writeI2C(MPU6050_ADDR, MPU_REG_ACCEL_CONFIG, 0x10);

  Serial.println("[MPU6050] Initialized in ±8g range with 44Hz DLPF.");
  return true;
}

bool initMAX30102() {
  Wire.beginTransmission(MAX30102_ADDR);
  if (Wire.endTransmission() != 0) {
    Serial.println("[MAX30102] Not found at 0x57");
    return false;
  }

  uint8_t partId = readI2CByte(MAX30102_ADDR, MAX_REG_PART_ID);
  Serial.printf("[MAX30102] Part ID: 0x%02X\n", partId);

  // Soft Reset
  writeI2C(MAX30102_ADDR, MAX_REG_MODE_CONFIG, 0x40);
  delay(50);

  // Clear FIFO pointers
  writeI2C(MAX30102_ADDR, MAX_REG_FIFO_WR_PTR, 0x00);
  writeI2C(MAX30102_ADDR, MAX_REG_OVF_COUNTER, 0x00);
  writeI2C(MAX30102_ADDR, MAX_REG_FIFO_RD_PTR, 0x00);

  // FIFO config: sample average = 4, FIFO rollover = enabled, FIFO almost full = 17
  writeI2C(MAX30102_ADDR, MAX_REG_FIFO_CONFIG, 0x4F);

  // Mode config: SpO2 mode (0x03: Red & IR channels enabled)
  writeI2C(MAX30102_ADDR, MAX_REG_MODE_CONFIG, 0x03);

  // SpO2 config: ADC range 4096 nA (0x01 << 5), 100 samples/sec (0x01 << 2), 411us pulse width 18-bit (0x03)
  writeI2C(MAX30102_ADDR, MAX_REG_SPO2_CONFIG, 0x27);

  // LED Pulse Amplitude: ~7.2mA for RED and IR
  writeI2C(MAX30102_ADDR, MAX_REG_LED1_PA, 0x24); // Red
  writeI2C(MAX30102_ADDR, MAX_REG_LED2_PA, 0x24); // IR

  Serial.println("[MAX30102] Initialized in SpO2 mode (100 sps, 18-bit).");
  return true;
}

// ==================== SENSOR READING LOOPS ====================
void readMPU6050() {
  uint8_t raw[6];
  if (readI2CBytes(MPU6050_ADDR, MPU_REG_ACCEL_XOUT_H, raw, 6)) {
    int16_t rawX = (int16_t)((raw[0] << 8) | raw[1]);
    int16_t rawY = (int16_t)((raw[2] << 8) | raw[3]);
    int16_t rawZ = (int16_t)((raw[4] << 8) | raw[5]);

    // ±8g range -> 4096 LSB/g
    ax = (float)rawX / 4096.0f;
    ay = (float)rawY / 4096.0f;
    az = (float)rawZ / 4096.0f;
    gMag = sqrtf(ax * ax + ay * ay + az * az);
    mpuHealthy = true;
  } else {
    mpuHealthy = false;
  }
}

void readMAX30102() {
  uint8_t wrPtr = readI2CByte(MAX30102_ADDR, MAX_REG_FIFO_WR_PTR);
  uint8_t rdPtr = readI2CByte(MAX30102_ADDR, MAX_REG_FIFO_RD_PTR);

  int numSamples = (wrPtr - rdPtr) & 0x1F;
  if (numSamples == 0) return;

  uint8_t fifoBuf[6];
  for (int s = 0; s < numSamples; s++) {
    if (!readI2CBytes(MAX30102_ADDR, MAX_REG_FIFO_DATA, fifoBuf, 6)) {
      maxHealthy = false;
      return;
    }

    rawRed = (((uint32_t)fifoBuf[0] << 16) | ((uint32_t)fifoBuf[1] << 8) | (uint32_t)fifoBuf[2]) & 0x03FFFF;
    rawIR  = (((uint32_t)fifoBuf[3] << 16) | ((uint32_t)fifoBuf[4] << 8) | (uint32_t)fifoBuf[5]) & 0x03FFFF;
    maxHealthy = true;

    // Skin contact determination
    skinContact = (rawIR > SKIN_CONTACT_IR_THRESH);

    if (skinContact) {
      // Simple DC filter (IIR high-pass) to extract AC pulsatile component
      dcFilterIR = 0.95f * dcFilterIR + 0.05f * (float)rawIR;
      acSignalIR = (float)rawIR - dcFilterIR;

      // Peak detection for heart rate
      unsigned long now = millis();
      static float prevAc = 0.0f;
      static bool peakArmed = true;

      if (acSignalIR > 150.0f && prevAc <= acSignalIR && peakArmed) {
        unsigned long delta = now - lastBeatTime;
        if (delta >= 350 && delta <= 1500) { // 40 BPM to 171 BPM range
          float instantBpm = 60000.0f / (float)delta;
          bpmHistory[bpmHistoryIdx] = instantBpm;
          bpmHistoryIdx = (bpmHistoryIdx + 1) % 4;
          
          float sum = 0;
          for (int i = 0; i < 4; i++) sum += bpmHistory[i];
          currentBpm = (int)(sum / 4.0f + 0.5f);
          lastBeatTime = now;
          peakArmed = false;
        }
      } else if (acSignalIR < -50.0f) {
        peakArmed = true;
      }
      prevAc = acSignalIR;
    } else {
      currentBpm = 0;
      dcFilterIR = 0;
    }
  }
}

// ==================== BUZZER & LED CONTROL ====================
void setBuzzerTone(uint32_t freq) {
  if (freq == 0) {
    ledcWriteTone(BUZZER_PWM_CHANNEL, 0);
  } else {
    ledcWriteTone(BUZZER_PWM_CHANNEL, freq);
  }
}

void updateAlarmIndicators() {
  unsigned long now = millis();

  switch (currentState) {
    case STATE_MONITORING:
      digitalWrite(PIN_LED, LOW);
      setBuzzerTone(0);
      break;

    case STATE_FREEFALL:
    case STATE_WAIT_STILL:
      // Amber warning: fast blink, no sound yet
      digitalWrite(PIN_LED, (now / 150) % 2 == 0 ? HIGH : LOW);
      setBuzzerTone(0);
      break;

    case STATE_PRE_ALARM: {
      // Pre-alarm: blinking LED, intermittent beeping warning tone
      unsigned long elapsed = now - stateEnterTime;
      int period = (elapsed > 7000) ? 250 : 500; // Beep faster as time runs out
      bool active = (now % period) < 120;
      digitalWrite(PIN_LED, active ? HIGH : LOW);
      setBuzzerTone(active ? 1500 : 0);
      break;
    }

    case STATE_EMERGENCY: {
      // Emergency: High-priority warbling siren + rapid strobe
      digitalWrite(PIN_LED, (now / 80) % 2 == 0 ? HIGH : LOW);
      uint32_t sirenFreq = ((now / 200) % 2 == 0) ? 2400 : 1800;
      setBuzzerTone(sirenFreq);
      break;
    }
  }
}

// ================== FALL DETECTION PIPELINE ==================
void runFallStateMachine() {
  unsigned long now = millis();

  // Check physical cancel button (active-low with debounce)
  static int lastBtnState = HIGH;
  int btnState = digitalRead(PIN_BTN_CANCEL);
  if (btnState == LOW && lastBtnState == HIGH) {
    if (currentState != STATE_MONITORING) {
      Serial.println("[BUTTON] Alert Cancelled by Wearer Pushbutton!");
      currentState = STATE_MONITORING;
      stateEnterTime = now;
      digitalWrite(PIN_LED, LOW);
      setBuzzerTone(0);
    }
  }
  lastBtnState = btnState;

  // Pipeline execution
  switch (currentState) {
    case STATE_MONITORING:
      if (gMag < FREEFALL_G_THRESH) {
        currentState = STATE_FREEFALL;
        freefallStartTime = now;
        stateEnterTime = now;
        Serial.printf("[FALL PIPELINE] Stage 1: Freefall detected (g = %.2f)\n", gMag);
      }
      break;

    case STATE_FREEFALL:
      if (gMag > IMPACT_G_THRESH) {
        currentState = STATE_WAIT_STILL;
        impactTime = now;
        stateEnterTime = now;
        Serial.printf("[FALL PIPELINE] Stage 2: Impact shock detected (g = %.2f)\n", gMag);
      } else if (now - freefallStartTime > IMPACT_WINDOW_MS) {
        // Impact did not occur within window -> false alarm / normal drop
        currentState = STATE_MONITORING;
        Serial.println("[FALL PIPELINE] Freefall without impact -> Rejected (NORMAL)");
      }
      break;

    case STATE_WAIT_STILL:
      if (gMag > 2.0f) {
        // High motion right after impact -> person stood up / walked away
        currentState = STATE_MONITORING;
        Serial.println("[FALL PIPELINE] Post-impact movement detected -> Cancelled (NORMAL)");
      } else if (now - impactTime >= STILL_WINDOW_MS) {
        // Sustained stillness verified for 2.0s -> Fall confirmed! Enter Pre-Alarm
        currentState = STATE_PRE_ALARM;
        stateEnterTime = now;
        Serial.println("[FALL PIPELINE] Stage 3: Stillness verified. Triggering PRE_ALARM!");
      }
      break;

    case STATE_PRE_ALARM:
      if (now - stateEnterTime >= PRE_ALARM_WINDOW_MS) {
        currentState = STATE_EMERGENCY;
        stateEnterTime = now;
        Serial.println("[FALL PIPELINE] Stage 4: 10s Pre-Alarm expired! EMERGENCY ESCALATED!");
      }
      break;

    case STATE_EMERGENCY:
      // Remains in emergency until cancelled via button or /cancel
      break;
  }
}

// ==================== HTTP ENDPOINT HANDLERS ====================
void sendCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With, Authorization");
  server.sendHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
}

void handleOptions() {
  sendCorsHeaders();
  server.send(204);
}

void handleData() {
  sendCorsHeaders();

  // Build exact required JSON contract:
  // {
  //   "g": 1.00,
  //   "ax": 0.02,
  //   "ay": -0.05,
  //   "az": 0.99,
  //   "state": "MONITORING (NORMAL)",
  //   "code": 0,
  //   "skin": true,
  //   "bpm": 74,
  //   "ir": 68420,
  //   "mpu": true,
  //   "max": true
  // }
  char jsonBuffer[320];
  snprintf(jsonBuffer, sizeof(jsonBuffer),
    "{\"g\":%.2f,\"ax\":%.2f,\"ay\":%.2f,\"az\":%.2f,\"state\":\"%s\",\"code\":%d,\"skin\":%s,\"bpm\":%d,\"ir\":%u,\"mpu\":%s,\"max\":%s}",
    gMag,
    ax,
    ay,
    az,
    STATE_STRINGS[currentState],
    (int)currentState,
    skinContact ? "true" : "false",
    currentBpm,
    rawIR,
    mpuHealthy ? "true" : "false",
    maxHealthy ? "true" : "false"
  );

  server.send(200, "application/json", jsonBuffer);
}

void handleCancel() {
  sendCorsHeaders();
  currentState = STATE_MONITORING;
  stateEnterTime = millis();
  digitalWrite(PIN_LED, LOW);
  setBuzzerTone(0);

  Serial.println("[HTTP /cancel] Alert manually reset to MONITORING (NORMAL)");
  server.send(200, "application/json", "{\"status\":\"cancelled\",\"code\":0,\"message\":\"Alert successfully cancelled\"}");
}

void handleRoot() {
  sendCorsHeaders();
  String html = "<!DOCTYPE html><html><head><title>FallGuard ESP32</title>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<style>body{background:#0f172a;color:#f8fafc;font-family:sans-serif;padding:24px;text-align:center;}";
  html += ".card{background:#1e293b;border-radius:12px;padding:20px;max-width:400px;margin:20px auto;border:1px solid #334155;}";
  html += ".btn{background:#3b82f6;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:15px;font-weight:bold;}";
  html += "</style></head><body>";
  html += "<h2>FallGuard ESP32 Wristband</h2>";
  html += "<div class='card'>";
  html += "<p><strong>Wi-Fi AP:</strong> FallGuard_Band</p>";
  html += "<p><strong>Device IP:</strong> 192.168.4.1</p>";
  html += "<p><strong>API Endpoint:</strong> <code>/data</code></p>";
  html += "<p><strong>Cancel Endpoint:</strong> <code>/cancel</code></p>";
  html += "<a class='btn' href='/data'>View Live JSON Data</a>";
  html += "</div>";
  html += "</body></html>";
  server.send(200, "text/html", html);
}

// ======================== ARDUINO SETUP ========================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n======================================");
  Serial.println("  FallGuard ESP32 Wristband Firmware  ");
  Serial.println("======================================");

  // Initialize GPIO Pins
  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, LOW);

  pinMode(PIN_BTN_CANCEL, INPUT_PULLUP);

  // Initialize Buzzer PWM
  ledcSetup(BUZZER_PWM_CHANNEL, 2000, BUZZER_PWM_RES);
  ledcAttachPin(PIN_BUZZER, BUZZER_PWM_CHANNEL);
  setBuzzerTone(0);

  // Quick power-on chime
  setBuzzerTone(2000);
  digitalWrite(PIN_LED, HIGH);
  delay(120);
  setBuzzerTone(0);
  digitalWrite(PIN_LED, LOW);

  // Initialize I2C Bus
  Wire.begin(PIN_SDA, PIN_SCL, 400000); // 400 kHz Fast Mode

  // Initialize MPU6050 and MAX30102
  mpuHealthy = initMPU6050();
  maxHealthy = initMAX30102();

  // Start Wi-Fi Access Point
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);
  IPAddress apIP = WiFi.softAPIP();

  Serial.println("[Wi-Fi] Access Point Started:");
  Serial.printf("        SSID: %s\n", AP_SSID);
  Serial.printf("        PASS: %s\n", AP_PASS);
  Serial.print("        IP Address: ");
  Serial.println(apIP);

  // Configure Web Server
  server.on("/data", HTTP_GET, handleData);
  server.on("/data", HTTP_OPTIONS, handleOptions);
  server.on("/cancel", HTTP_GET, handleCancel);
  server.on("/cancel", HTTP_POST, handleCancel);
  server.on("/cancel", HTTP_OPTIONS, handleOptions);
  server.on("/", HTTP_GET, handleRoot);

  server.begin();
  Serial.println("[HTTP] REST API Server ready on port 80.");
}

// ======================== MAIN LOOP ========================
void loop() {
  // Handle incoming HTTP client requests
  server.handleClient();

  // Periodic sensor sampling (~100 Hz = every 10ms)
  static unsigned long lastSampleTime = 0;
  unsigned long now = millis();

  if (now - lastSampleTime >= 10) {
    lastSampleTime = now;
    readMPU6050();
    readMAX30102();
    runFallStateMachine();
  }

  // Update LED and Buzzer according to state
  updateAlarmIndicators();
}

