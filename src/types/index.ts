export const FallStateCode = {
  MONITORING: 0,
  FREEFALL: 1,
  WAIT_STILL: 2,
  PRE_ALARM: 3,
  EMERGENCY: 4,
} as const;

export type FallStateCode = (typeof FallStateCode)[keyof typeof FallStateCode];

export const STATE_LABELS: Record<FallStateCode, string> = {
  [FallStateCode.MONITORING]: 'MONITORING (NORMAL)',
  [FallStateCode.FREEFALL]: 'FREEFALL DETECTED',
  [FallStateCode.WAIT_STILL]: 'VERIFYING POST-IMPACT STILLNESS',
  [FallStateCode.PRE_ALARM]: 'PRE-ALARM: IMMOBILITY CONFIRMED!',
  [FallStateCode.EMERGENCY]: 'EMERGENCY: DISTRESS ALERT DISPATCHED',
};

export interface SensorPayload {
  g: number;
  ax: number;
  ay: number;
  az: number;
  state: string;
  code: number;
  skin: boolean;
  bpm: number;
  ir: number;
  mpu: boolean;
  max: boolean;
}

export type ConnectionState = 'connected' | 'reconnecting' | 'simulator' | 'offline';

export interface RecordedSample {
  timestamp_ms: number;
  ax: number;
  ay: number;
  az: number;
  g: number;
  ir: number;
  bpm: number;
  label: string;
}

export interface SimulatorConfig {
  skinContact: boolean;
  targetBpm: number;
  motionType: 'idle' | 'walking' | 'running';
  noiseLevel: number;
}
