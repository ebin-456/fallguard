import React, { useState } from 'react';
import { simulator } from '../services/simulator';
import type { SimulatorConfig } from '../types';
import { 
  Zap, 
  ShieldAlert, 
  Heart, 
  Fingerprint, 
  Sliders, 
  RotateCcw,
  Sparkles
} from 'lucide-react';

interface SimulatorControlsProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerAction: () => void;
}

export const SimulatorControls: React.FC<SimulatorControlsProps> = ({
  isOpen,
  onClose,
  onTriggerAction,
}) => {
  const [config, setConfig] = useState<SimulatorConfig>(simulator.getConfig());
  const [lastAction, setLastAction] = useState<string | null>(null);

  if (!isOpen) return null;

  const updateConfig = (update: Partial<SimulatorConfig>) => {
    simulator.setConfig(update);
    setConfig(simulator.getConfig());
    onTriggerAction();
  };

  const handleWristShake = () => {
    simulator.triggerWristShake();
    setLastAction('Triggered Wrist Shake (False Alarm Rejection Test: ~3.4g without free-fall)');
    onTriggerAction();
    setTimeout(() => setLastAction(null), 4000);
  };

  const handleRealFall = () => {
    simulator.triggerRealFall();
    setLastAction('Triggered Real Fall Sequence (Stage 1 Free-fall -> Stage 2 Impact -> Stillness -> Pre-Alarm)');
    onTriggerAction();
    setTimeout(() => setLastAction(null), 4000);
  };

  const handleForcePreAlarm = () => {
    simulator.forcePreAlarm();
    setLastAction('Forced Pre-Alarm (10-second countdown active)');
    onTriggerAction();
    setTimeout(() => setLastAction(null), 4000);
  };

  const handleForceEmergency = () => {
    simulator.forceEmergency();
    setLastAction('Forced Emergency Siren Mode');
    onTriggerAction();
    setTimeout(() => setLastAction(null), 4000);
  };

  const handleReset = () => {
    simulator.resetToMonitoring();
    setLastAction('Reset state to MONITORING (NORMAL)');
    onTriggerAction();
    setTimeout(() => setLastAction(null), 3000);
  };

  return (
    <div className="bg-slate-800/95 border border-cyan-800/80 rounded-xl p-4 shadow-xl backdrop-blur-sm animate-fadeIn">
      <div className="flex items-center justify-between pb-3 border-b border-slate-700/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-700/60 text-cyan-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              Hardware Simulator Control Deck
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                100 Hz
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Inject synthetic accelerometer & PPG dynamics to test edge scenarios
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded bg-slate-900 border border-slate-700"
        >
          Close
        </button>
      </div>

      {/* Action Notice feedback */}
      {lastAction && (
        <div className="mt-2.5 p-2 rounded-lg bg-cyan-950/60 border border-cyan-800 text-cyan-300 text-xs flex items-center gap-2 animate-fadeIn">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="font-mono">{lastAction}</span>
        </div>
      )}

      {/* Primary Pipeline Test Triggers */}
      <div className="mt-3">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
          Automated Test Triggers:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Trigger 1: Wrist Shake */}
          <button
            type="button"
            onClick={handleWristShake}
            className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900/90 hover:bg-slate-900 border border-amber-600/50 hover:border-amber-500 text-left transition-all group"
          >
            <div className="p-2 rounded bg-amber-950/80 border border-amber-800/80 text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-100">1. Normal Wrist Shake</span>
                <span className="text-[9px] font-mono text-amber-400 bg-amber-950 px-1 py-0.2 rounded border border-amber-800">
                  REJECTED
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Generates high spike (~3.4g) without free-fall dip. Confirms false-alarm rejection.
              </p>
            </div>
          </button>

          {/* Trigger 2: Real Fall Sequence */}
          <button
            type="button"
            onClick={handleRealFall}
            className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900/90 hover:bg-slate-900 border border-rose-600/50 hover:border-rose-500 text-left transition-all group"
          >
            <div className="p-2 rounded bg-rose-950/80 border border-rose-800/80 text-rose-400 shrink-0 group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-100">2. Real Fall Sequence</span>
                <span className="text-[9px] font-mono text-rose-400 bg-rose-950 px-1 py-0.2 rounded border border-rose-800">
                  4 STAGES
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Executes: &lt;0.60g Drop &rarr; &gt;3.20g Impact &rarr; 2.0s Stillness &rarr; 10s Pre-Alarm.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Manual State Overrides */}
      <div className="mt-3 pt-3 border-t border-slate-700/60">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
          Manual State Overrides:
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleForcePreAlarm}
            className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800 text-rose-300 text-xs font-mono font-medium transition-colors"
          >
            Force Pre-Alarm (Code 3)
          </button>

          <button
            type="button"
            onClick={handleForceEmergency}
            className="px-3 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-700 text-red-200 text-xs font-mono font-medium transition-colors"
          >
            Force Emergency (Code 4)
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-mono font-medium transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset (Code 0)</span>
          </button>
        </div>
      </div>

      {/* Sensor Vitals Customization */}
      <div className="mt-3 pt-3 border-t border-slate-700/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        {/* Skin Contact Toggle */}
        <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Fingerprint className="w-3.5 h-3.5 text-indigo-400" />
              Skin Contact:
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-200">
              {config.skinContact ? 'ON' : 'OFF'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => updateConfig({ skinContact: !config.skinContact })}
            className={`w-full py-1.5 rounded text-xs font-semibold transition-all ${
              config.skinContact
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {config.skinContact ? 'Simulating Finger/Skin Present' : 'Simulating Wristband Removed'}
          </button>
        </div>

        {/* Target BPM Slider */}
        <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-rose-400" />
              Target BPM:
            </span>
            <span className="font-mono text-[11px] font-bold text-rose-300">
              {config.targetBpm} BPM
            </span>
          </div>
          <input
            type="range"
            min={45}
            max={150}
            step={1}
            value={config.targetBpm}
            onChange={(e) => updateConfig({ targetBpm: Number(e.target.value) })}
            className="w-full accent-rose-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
            <span>45 (Rest)</span>
            <span>75 (Normal)</span>
            <span>150 (High)</span>
          </div>
        </div>

        {/* Ambient Motion Mode */}
        <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/50">
          <span className="text-slate-400 font-medium block mb-1.5">
            Background Activity:
          </span>
          <div className="grid grid-cols-3 gap-1">
            {(['idle', 'walking', 'running'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => updateConfig({ motionType: m })}
                className={`py-1 rounded text-[11px] font-mono capitalize transition-all ${
                  config.motionType === m
                    ? 'bg-cyan-600 text-white font-semibold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
