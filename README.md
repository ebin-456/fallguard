# FallGuard Monitor 🛡️
### Offline-First Mobile PWA & ESP32 Wearable Fall Detection System

**FallGuard Monitor** is an offline-first, mobile-first Progressive Web App (PWA) paired with an Arduino C++ ESP32 firmware sketch (`firmware/fallguard_esp32.ino`) designed for real-time fall detection, optical heart rate monitoring (PPG), and edge-AI training dataset collection using an **MPU6050** (3-axis accelerometer) and **MAX30102** (optical pulse & SpO2 sensor).

---

## ⚡ Key Highlights

- **Zero-Server Offline PWA Architecture:** Engineered to run inside a smartphone browser when connected to an internet-less ESP32 Wi-Fi Access Point (`192.168.4.1`). Static assets are precached by a custom Service Worker (`sw.js`) and registered via `manifest.json`.
- **Direct Wire.h I2C Hardware Communication:** Zero conflicting third-party sensor libraries. Uses direct I2C register configuration (`0x68` for MPU6050 configured to $\pm 8g$ range with 44 Hz DLPF, and `0x57` for MAX30102 optical PPG).
- **CORS-Enabled REST Endpoints:** ESP32 web server returns `Access-Control-Allow-Origin: *` on both `/data` and `/cancel` endpoints.
- **Built-In Hardware Simulator Mode:** 100 Hz synthetic telemetry generator with one-tap triggers for **False Alarm Rejection** (Wrist Shake ~3.4g without free-fall) and the complete **4-Stage Real Fall Pipeline**.
- **Real-Time 60fps Canvas Waveforms:** Zero-allocation Float32Array ring buffers render smooth acceleration and optical PPG traces with threshold markers without memory leaks or frame stutter.
- **Neural Network Dataset Collector:** Labeled time-series recorder with live timer, sample counter, and instant one-tap CSV export (`timestamp_ms,ax,ay,az,g,ir,bpm,label`).
- **Web Audio Alert Synthesizer:** Pure Web Audio API chimes, countdown beeps, and emergency sirens with mobile haptic feedback (`navigator.vibrate`).

---

## 📐 System Architecture & 4-Stage Detection Pipeline

```
           +-----------------------------------------+
           |       MPU6050 3-Axis Accelerometer      |
           |   (Continuous 100 Hz Sampling, ±8g)     |
           +--------------------+--------------------+
                                |
                                v
                   [Stage 1: Free-Fall Drop]
                     g < 0.60g for >= 60ms?
                     /                  \
                  YES                    NO ---> Normal Walk / Rest
                  /
                 v
            [Stage 2: Impact Shock]
             g > 3.20g within 500ms?
             /                  \
          YES                    NO ---> False Alarm (e.g., bed drop)
          /
         v
    [Stage 3: Stillness Verification]
     |g - 1.0g| < 0.25g for 2.0s?
     /                  \
  YES                    NO ---> Movement detected (person walked away)
  /
 v
[Stage 4: Pre-Alarm Countdown (10s)]
  - LED fast blink + warning beeps
  - Wearer can cancel via GPIO 5 button or PWA button
  - If NOT cancelled within 10s:
         |
         v
  [EMERGENCY SIREN (Code 4)]
  - Continuous emergency siren
  - Notification sent to caregivers
```

---

## 🔌 Hardware Pinout & Wiring

| Component | ESP32 Pin | Interface | Description |
|---|---|---|---|
| **MPU6050 SDA** | `GPIO 21` | I2C Data | 3-Axis Accelerometer (`0x68`) |
| **MPU6050 SCL** | `GPIO 22` | I2C Clock | 400 kHz Fast I2C Bus |
| **MAX30102 SDA** | `GPIO 21` | I2C Data | Optical Pulse & IR Sensor (`0x57`) |
| **MAX30102 SCL** | `GPIO 22` | I2C Clock | Shared I2C Bus |
| **Status / Alarm LED**| `GPIO 4` | Digital Output | Pre-Alarm blink & Emergency strobe |
| **Cancel Button** | `GPIO 5` | Input (Pull-Up)| Active-LOW reset pushbutton |
| **Piezo Buzzer** | `GPIO 18` | LEDC PWM (CH 0)| Warning beeps & emergency siren |
| **Power (VCC)** | `3.3V` | Power | Connect 3.3V to sensors |
| **Ground (GND)** | `GND` | Ground | Common system ground |

---

## 📡 ESP32 Wi-Fi & REST API Contract

### Wi-Fi Access Point Configuration
- **SSID:** `FallGuard_Band`
- **Password:** `12345678`
- **Default IP:** `192.168.4.1`

### 1. Telemetry Endpoint: `GET http://192.168.4.1/data`
Polled every `100ms–200ms` by the PWA.

**Response (JSON):**
```json
{
  "g": 1.00,
  "ax": 0.02,
  "ay": -0.05,
  "az": 0.99,
  "state": "MONITORING (NORMAL)",
  "code": 0,
  "skin": true,
  "bpm": 74,
  "ir": 68420,
  "mpu": true,
  "max": true
}
```

#### State Codes:
- `0 = MONITORING (NORMAL)`: Baseline motion monitoring.
- `1 = FREEFALL`: Free-fall drop below $0.60g$ detected.
- `2 = WAIT_STILL`: Post-impact immobility verification.
- `3 = PRE_ALARM`: Fall confirmed; 10-second warning countdown before emergency.
- `4 = EMERGENCY`: Escalated distress state; sirens active.

### 2. Cancel Endpoint: `GET http://192.168.4.1/cancel`
Sent when the wearer taps **Cancel / Reset Alert** in the PWA or presses the physical button on `GPIO 5`. Resets the system back to `MONITORING` (Code 0).

---

## 🚀 Quick Start Guide

### 1. Flash the ESP32 Wristband Firmware
1. Open Arduino IDE or PlatformIO.
2. Ensure you have the **ESP32 Arduino core** installed (`Tools` -> `Board` -> `ESP32 Arduino` -> `ESP32 Dev Module`).
3. Open `firmware/fallguard_esp32.ino`.
4. Connect your ESP32 board via USB.
5. Upload the sketch (no external sensor libraries required).

### 2. Run the PWA Web Dashboard
```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Or build static production distribution for zero-server deployment
npm run build
npm run preview
```

### 3. Connect from Smartphone
1. Connect phone Wi-Fi to **`FallGuard_Band`** (password: `12345678`).
2. If Android or iOS displays *"Wi-Fi has no Internet access. Stay connected?"*, tap **"Keep connected / Stay connected"**.
3. Open mobile browser to `http://192.168.4.1` or open your locally hosted PWA URL.
4. Tap the browser menu and select **"Add to Home Screen"** to install FallGuard as a standalone offline PWA!

---

## 🧪 Hardware Simulator Mode

For development, testing, and demonstrations without the wristband powered on:
1. Tap the **Sim** toggle in the top header.
2. The app switches to the internal **100 Hz synthetic sensor engine**.
3. Click **Triggers** in the header to open the simulator control deck:
   - **Normal Wrist Shake:** Generates a rapid $\sim 3.4g$ oscillation without a prior freefall dip. Verifies that the state machine rejects false alarms and remains in `MONITORING (NORMAL)`.
   - **Real Fall Sequence:** Triggers the 4-stage pipeline ($<0.60g$ drop $\rightarrow$ $>3.20g$ impact shock $\rightarrow$ 2.0s post-fall stillness $\rightarrow$ 10-second Pre-Alarm $\rightarrow$ Emergency siren).
   - **Skin Contact & BPM Adjusters:** Toggle finger/wrist detection and adjust target heart rate in real time.

---

## 📊 Dataset Collection Schema

Recorded CSV files exported via the **Neural Network Dataset Recorder** follow this schema:

| Column | Unit | Description |
|---|---|---|
| `timestamp_ms` | ms | Unix epoch time in milliseconds |
| `ax` | g | Accelerometer X-axis ($g$) |
| `ay` | g | Accelerometer Y-axis ($g$) |
| `az` | g | Accelerometer Z-axis ($g$) |
| `g` | g | Vector magnitude $\sqrt{a_x^2 + a_y^2 + a_z^2}$ |
| `ir` | counts | MAX30102 raw optical IR count |
| `bpm` | BPM | Computed heart rate (0 if no skin contact) |
| `label` | string | Class label (e.g., `Normal_Walk`, `Hard_Fall`, `Wrist_Shake`) |

Export filename format: `fallguard_<label>_<ISO_timestamp>.csv`.

---

## 🛡️ License
MIT License. Open-source IoT & Healthcare Edge-AI Project.
