import { FallStateCode, STATE_LABELS } from '../types';
import type { SensorPayload, SimulatorConfig } from '../types';

export class HardwareSimulator {
  private config: SimulatorConfig = {
    skinContact: true,
    targetBpm: 74,
    motionType: 'idle',
    noiseLevel: 0.03,
  };

  private currentState: FallStateCode = FallStateCode.MONITORING;
  private stateStartTime: number = Date.now();
  private preAlarmStartTime: number = 0;

  // Real fall sequence timeline state
  private activeSequence: 'none' | 'fall' | 'wrist_shake' = 'none';
  private sequenceStartTime: number = 0;

  // Optical wave synthesis
  private phase: number = 0;
  private lastTickTime: number = Date.now();

  // Synthetic accelerometer values
  private currentAx: number = 0.02;
  private currentAy: number = -0.04;
  private currentAz: number = 0.99;
  private currentG: number = 1.00;
  private currentIR: number = 68420;
  private currentBpm: number = 74;

  // Notice/rejection banner
  public lastNotice: string | null = null;
  public lastNoticeTime: number = 0;

  constructor() {
    this.resetToMonitoring();
  }

  public getConfig(): SimulatorConfig {
    return { ...this.config };
  }

  public setConfig(update: Partial<SimulatorConfig>) {
    this.config = { ...this.config, ...update };
  }

  public resetToMonitoring() {
    this.currentState = FallStateCode.MONITORING;
    this.activeSequence = 'none';
    this.stateStartTime = Date.now();
    this.preAlarmStartTime = 0;
  }

  public getStateElapsedMs(): number {
    return Date.now() - this.stateStartTime;
  }

  /**
   * Trigger 1: Normal Wrist Shake (False Alarm Rejection)
   * High acceleration spike (~3.4g - 3.8g) with NO preceding freefall dip.
   */
  public triggerWristShake() {
    this.activeSequence = 'wrist_shake';
    this.sequenceStartTime = Date.now();
    this.lastNotice = 'False Alarm Rejected: High-G spike without prior Free-Fall';
    this.lastNoticeTime = Date.now();
  }

  /**
   * Trigger 2: Real Fall Sequence (4-Stage Pipeline)
   * Stage 1: Free-fall drop (< 0.60g)
   * Stage 2: Hard impact shock (> 3.20g)
   * Stage 3: Post-impact stillness for 2.0s
   * Stage 4: 10s Pre-Alarm countdown -> Emergency
   */
  public triggerRealFall() {
    this.activeSequence = 'fall';
    this.sequenceStartTime = Date.now();
    this.currentState = FallStateCode.FREEFALL;
    this.stateStartTime = Date.now();
    this.lastNotice = 'Fall Sequence Started: Stage 1 Free-Fall (< 0.60g)';
    this.lastNoticeTime = Date.now();
  }

  public forceEmergency() {
    this.activeSequence = 'none';
    this.currentState = FallStateCode.EMERGENCY;
    this.stateStartTime = Date.now();
  }

  public forcePreAlarm() {
    this.activeSequence = 'none';
    this.currentState = FallStateCode.PRE_ALARM;
    this.stateStartTime = Date.now();
    this.preAlarmStartTime = Date.now();
  }

  /**
   * Generate next telemetry frame (called at ~10ms - 50ms intervals)
   */
  public tick(): SensorPayload {
    const now = Date.now();
    const dt = Math.max(0.005, (now - this.lastTickTime) / 1000);
    this.lastTickTime = now;

    // 1. Calculate Accelerometer dynamics
    let targetAx = 0.02;
    let targetAy = -0.05;
    let targetAz = 0.99;

    const noise = (Math.random() - 0.5) * this.config.noiseLevel * 2;
    const noiseY = (Math.random() - 0.5) * this.config.noiseLevel * 2;
    const noiseZ = (Math.random() - 0.5) * this.config.noiseLevel * 2;

    if (this.activeSequence === 'wrist_shake') {
      const elapsed = now - this.sequenceStartTime;
      if (elapsed < 600) {
        // High frequency, high-G oscillation (wrist shaking vigorously)
        const shakePhase = (elapsed / 600) * Math.PI * 8;
        const amplitude = 3.4 + Math.sin(shakePhase * 2) * 0.4;
        targetAx = Math.sin(shakePhase) * amplitude * 0.7;
        targetAy = Math.cos(shakePhase) * amplitude * 0.7;
        targetAz = 1.0 + Math.sin(shakePhase * 3) * (amplitude * 0.5);
      } else {
        // Shake done, back to normal
        this.activeSequence = 'none';
        targetAx = 0.02;
        targetAy = -0.05;
        targetAz = 0.99;
      }
    } else if (this.activeSequence === 'fall') {
      const elapsed = now - this.sequenceStartTime;

      if (elapsed < 180) {
        // Stage 1: Freefall drop (< 0.60g, e.g. 0.12g)
        this.currentState = FallStateCode.FREEFALL;
        targetAx = 0.04 + noise;
        targetAy = -0.05 + noiseY;
        targetAz = 0.12 + noiseZ; // Near weightlessness
      } else if (elapsed < 500) {
        // Stage 2: Hard impact shock (> 3.20g, e.g. 3.75g peak)
        this.currentState = FallStateCode.WAIT_STILL;
        const shockDecay = Math.exp(-(elapsed - 180) / 70);
        const shockMagnitude = 3.75 * shockDecay + 1.0 * (1 - shockDecay);
        targetAx = 0.6 * shockMagnitude + noise;
        targetAy = -0.8 * shockMagnitude + noiseY;
        targetAz = 0.9 * shockMagnitude + noiseZ;
      } else if (elapsed < 2500) {
        // Stage 3: Post-impact stillness (2.0s window, ~1.0g with minimal movement)
        this.currentState = FallStateCode.WAIT_STILL;
        targetAx = 0.01 + noise * 0.3; // Person immobilized on floor
        targetAy = -0.02 + noiseY * 0.3;
        targetAz = 0.98 + noiseZ * 0.3;
      } else {
        // Stillness verified! Transition to PRE_ALARM
        if (this.currentState === FallStateCode.WAIT_STILL) {
          this.currentState = FallStateCode.PRE_ALARM;
          this.preAlarmStartTime = now;
          this.stateStartTime = now;
          this.activeSequence = 'none'; // Sequence engine hands off to PreAlarm countdown
        }
      }
    } else {
      // Normal background movement
      if (this.config.motionType === 'walking') {
        const stepFreq = 1.8; // steps per second
        const stepPhase = (now / 1000) * stepFreq * Math.PI * 2;
        targetAx = Math.sin(stepPhase) * 0.25;
        targetAy = Math.cos(stepPhase * 2) * 0.15;
        targetAz = 1.0 + Math.sin(stepPhase * 2) * 0.3;
      } else if (this.config.motionType === 'running') {
        const runFreq = 2.6;
        const runPhase = (now / 1000) * runFreq * Math.PI * 2;
        targetAx = Math.sin(runPhase) * 0.6;
        targetAy = Math.cos(runPhase * 2) * 0.4;
        targetAz = 1.0 + Math.sin(runPhase * 2) * 0.8;
      }
    }

    // Smooth accelerometer dynamics (low-pass filter simulation)
    const filterAlpha = 0.45;
    this.currentAx += (targetAx + noise - this.currentAx) * filterAlpha;
    this.currentAy += (targetAy + noiseY - this.currentAy) * filterAlpha;
    this.currentAz += (targetAz + noiseZ - this.currentAz) * filterAlpha;
    this.currentG = Math.sqrt(
      this.currentAx * this.currentAx +
      this.currentAy * this.currentAy +
      this.currentAz * this.currentAz
    );

    // Pre-Alarm 10-second countdown check
    if (this.currentState === FallStateCode.PRE_ALARM) {
      const preAlarmElapsed = now - this.preAlarmStartTime;
      if (preAlarmElapsed >= 10000) {
        this.currentState = FallStateCode.EMERGENCY;
        this.stateStartTime = now;
      }
    }

    // 2. Optical PPG & Heart Rate calculation
    if (this.config.skinContact) {
      const bps = this.config.targetBpm / 60;
      this.phase = (this.phase + dt * bps * Math.PI * 2) % (Math.PI * 2);

      // Physiological photoplethysmogram (PPG) model:
      // Systolic peak + dicrotic notch + diastolic peak
      const p1 = Math.sin(this.phase);
      const p2 = Math.sin(this.phase * 2 - 0.5) * 0.35;
      const p3 = Math.sin(this.phase * 3 - 1.2) * 0.15;
      const pulseWave = Math.max(0, p1 + p2 + p3);

      const baselineIR = 68000;
      const acModulation = pulseWave * 1400;
      const opticalNoise = (Math.random() - 0.5) * 60;

      this.currentIR = Math.round(baselineIR + acModulation + opticalNoise);
      this.currentBpm = this.config.targetBpm;
    } else {
      // No finger/wrist contact
      this.currentIR = Math.round(1400 + (Math.random() - 0.5) * 200);
      this.currentBpm = 0;
    }

    return {
      g: Number(this.currentG.toFixed(2)),
      ax: Number(this.currentAx.toFixed(2)),
      ay: Number(this.currentAy.toFixed(2)),
      az: Number(this.currentAz.toFixed(2)),
      state: STATE_LABELS[this.currentState] || 'MONITORING (NORMAL)',
      code: this.currentState,
      skin: this.config.skinContact,
      bpm: this.currentBpm,
      ir: this.currentIR,
      mpu: true,
      max: true,
    };
  }

  public getPreAlarmRemainingMs(): number {
    if (this.currentState !== FallStateCode.PRE_ALARM) return 0;
    const elapsed = Date.now() - this.preAlarmStartTime;
    return Math.max(0, 10000 - elapsed);
  }
}

export const simulator = new HardwareSimulator();
