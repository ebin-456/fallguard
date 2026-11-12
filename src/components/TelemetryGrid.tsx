import React from 'react';
import type { SensorPayload } from '../types';
import { Heart, Fingerprint, Compass } from 'lucide-react';

interface TelemetryGridProps {
  data: SensorPayload;
}

export const TelemetryGrid: React.FC<TelemetryGridProps> = ({ data }) => {
  const { g, ax, ay, az, skin, bpm, ir } = data;

  // Determine G-force status color
  const isFreefall = g < 0.60;
  const isImpact = g > 3.20;
  let gColorClass = 'text-slate-100';
  let gBadgeText = '1.0g Normal';
  let gBadgeColor = 'bg-slate-800 text-slate-300 border-slate-700';

  if (isFreefall) {
    gColorClass = 'text-cyan-400';
    gBadgeText = 'Free-Fall (<0.60g)';
    gBadgeColor = 'bg-cyan-950 text-cyan-300 border-cyan-800';
  } else if (isImpact) {
    gColorClass = 'text-rose-400';
    gBadgeText = 'Impact Shock (>3.20g)';
    gBadgeColor = 'bg-rose-950 text-rose-300 border-rose-800 animate-pulse';
  } else if (Math.abs(g - 1.0) <= 0.15) {
    gBadgeText = 'Static Gravity (1G)';
    gBadgeColor = 'bg-emerald-950 text-emerald-400 border-emerald-800/60';
  }

  // IR Level gauge calculation (threshold at 40,000 counts, max typical 120,000)
  const irPercent = Math.min(100, Math.max(0, (ir / 100000) * 100));
  const thresholdPercent = (40000 / 100000) * 100; // 40%

  // Heartbeat animation duration based on BPM (e.g. 60 BPM -> 1.0s, 120 BPM -> 0.5s)
  const heartBeatDuration = bpm > 30 ? (60 / bpm).toFixed(2) : '1.0';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* 1. Total Acceleration Card */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-950/80 border border-blue-800/60 text-blue-400">
              <Compass className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Acceleration
            </span>
          </div>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${gBadgeColor}`}>
            {gBadgeText}
          </span>
        </div>

        {/* Big G Readout */}
        <div className="my-2 flex items-baseline gap-1.5">
          <span className={`text-3xl sm:text-4xl font-black font-tabular tracking-tight transition-colors ${gColorClass}`}>
            {g.toFixed(2)}
          </span>
          <span className="text-sm font-semibold text-slate-400 uppercase">g-force</span>
        </div>

        {/* 3-Axis Sub-values */}
        <div className="pt-2 border-t border-slate-700/60 grid grid-cols-3 gap-2 font-mono text-xs">
          <div className="bg-slate-900/60 p-1.5 rounded border border-slate-700/40">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span className="font-semibold text-rose-400">AX</span>
              <span>{ax > 0 ? `+${ax.toFixed(2)}` : ax.toFixed(2)}g</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1 mt-1 overflow-hidden">
              <div
                className="bg-rose-500 h-1 rounded-full transition-all duration-75"
                style={{ width: `${Math.min(100, Math.abs(ax) * 50)}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-900/60 p-1.5 rounded border border-slate-700/40">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span className="font-semibold text-emerald-400">AY</span>
              <span>{ay > 0 ? `+${ay.toFixed(2)}` : ay.toFixed(2)}g</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1 mt-1 overflow-hidden">
              <div
                className="bg-emerald-500 h-1 rounded-full transition-all duration-75"
                style={{ width: `${Math.min(100, Math.abs(ay) * 50)}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-900/60 p-1.5 rounded border border-slate-700/40">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span className="font-semibold text-blue-400">AZ</span>
              <span>{az > 0 ? `+${az.toFixed(2)}` : az.toFixed(2)}g</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1 mt-1 overflow-hidden">
              <div
                className="bg-blue-500 h-1 rounded-full transition-all duration-75"
                style={{ width: `${Math.min(100, Math.abs(az) * 50)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Heart Rate Card */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-950/80 border border-rose-800/60 text-rose-400">
              <Heart
                className={`w-4 h-4 ${skin && bpm > 0 ? 'text-rose-400 fill-rose-500/20' : 'text-slate-500'}`}
                style={
                  skin && bpm > 0
                    ? { animation: `heartbeat ${heartBeatDuration}s ease-in-out infinite` }
                    : undefined
                }
              />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Heart Rate
            </span>
          </div>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              skin && bpm > 0
                ? bpm > 100
                  ? 'bg-rose-950 text-rose-300 border-rose-800'
                  : 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {skin && bpm > 0 ? (bpm > 100 ? 'Tachycardia' : 'Normal Sinus') : 'No Pulse'}
          </span>
        </div>

        {/* Big BPM Readout */}
        <div className="my-2 flex items-baseline gap-1.5">
          {skin && bpm > 0 ? (
            <>
              <span className="text-3xl sm:text-4xl font-black font-tabular tracking-tight text-white">
                {bpm}
              </span>
              <span className="text-sm font-semibold text-rose-400 uppercase">BPM</span>
            </>
          ) : (
            <>
              <span className="text-3xl sm:text-4xl font-black font-tabular tracking-tight text-slate-500">
                --
              </span>
              <span className="text-sm font-semibold text-slate-500 uppercase">BPM</span>
            </>
          )}
        </div>

        {/* Status subtext */}
        <div className="pt-2 border-t border-slate-700/60 text-xs text-slate-400 flex items-center justify-between">
          <span>Optical Vitals:</span>
          <span className="font-medium text-slate-300">
            {skin && bpm > 0 ? 'R-R Interval Synced' : 'No finger/wrist contact'}
          </span>
        </div>
      </div>

      {/* 3. Skin Contact & IR Signal Card */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-950/80 border border-indigo-800/60 text-indigo-400">
              <Fingerprint className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Skin Contact & IR
            </span>
          </div>

          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold border ${
              skin
                ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
                : 'bg-amber-950 text-amber-300 border-amber-800/60'
            }`}
          >
            {skin ? 'DETECTED' : 'NOT DETECTED'}
          </span>
        </div>

        {/* Big IR Raw Readout */}
        <div className="my-2 flex items-baseline justify-between">
          <div>
            <span className="text-2xl sm:text-3xl font-black font-tabular tracking-tight text-white">
              {ir.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 font-mono ml-1.5">raw counts</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Threshold: 40k
          </span>
        </div>

        {/* Visual Level Meter for IR */}
        <div className="pt-2 border-t border-slate-700/60">
          <div className="relative w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700/60">
            {/* 40,000 threshold marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
              style={{ left: `${thresholdPercent}%` }}
              title="40,000 Skin Contact Threshold"
            />
            {/* Fill bar */}
            <div
              className={`h-full rounded-full transition-all duration-100 ${
                skin ? 'bg-gradient-to-r from-blue-500 to-emerald-400' : 'bg-slate-600'
              }`}
              style={{ width: `${irPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
            <span>0</span>
            <span className="text-amber-400 font-medium">40k</span>
            <span>100k+</span>
          </div>
        </div>
      </div>
    </div>
  );
};
