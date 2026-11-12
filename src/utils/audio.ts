// Web Audio API Synthesizer for FallGuard Alerts (No external audio files required)

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private activeAlarmTimer: number | null = null;
  private currentMode: 'none' | 'pre_alarm' | 'emergency' = 'none';

  constructor() {
    // Read persisted mute state
    const saved = localStorage.getItem('fallguard_audio_muted');
    if (saved !== null) {
      this.isMuted = saved === 'true';
    }
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    localStorage.setItem('fallguard_audio_muted', String(muted));
    if (muted) {
      this.stopAlarm();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  /** Soft confirmation click / reset chime */
  public playResetPing() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    } catch {
      // AudioContext might be blocked until gesture
    }
  }

  /** Start Pre-Alarm alert sequence (T-10s countdown beeps) */
  public startPreAlarm() {
    if (this.currentMode === 'pre_alarm') return;
    this.stopAlarm();
    this.currentMode = 'pre_alarm';
    this.initContext();

    const beep = () => {
      if (this.isMuted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1500, this.ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);

        // Haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate(80);
        }
      } catch {
        // Suppress audio failure
      }
    };

    beep();
    this.activeAlarmTimer = window.setInterval(beep, 450);
  }

  /** Start Emergency Siren (Loud alternating distress tone) */
  public startEmergencySiren() {
    if (this.currentMode === 'emergency') return;
    this.stopAlarm();
    this.currentMode = 'emergency';
    this.initContext();

    let toggle = false;
    const siren = () => {
      if (this.isMuted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        const freq = toggle ? 2200 : 1600;
        toggle = !toggle;

        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.05, this.ctx.currentTime + 0.22);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.23);

        // Urgent haptic pulse
        if ('vibrate' in navigator) {
          navigator.vibrate([200, 80, 200]);
        }
      } catch {
        // Suppress audio failure
      }
    };

    siren();
    this.activeAlarmTimer = window.setInterval(siren, 250);
  }

  /** Stop all alarms */
  public stopAlarm() {
    if (this.activeAlarmTimer !== null) {
      clearInterval(this.activeAlarmTimer);
      this.activeAlarmTimer = null;
    }
    this.currentMode = 'none';
  }
}

export const soundManager = new SoundManager();
