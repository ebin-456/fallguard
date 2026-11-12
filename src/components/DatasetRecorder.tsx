import React, { useState, useEffect } from 'react';
import type { RecordedSample, SensorPayload } from '../types';
import { 
  Database, 
  Play, 
  Square, 
  Download, 
  Trash2, 
  Tag, 
  CheckCircle
} from 'lucide-react';

interface DatasetRecorderProps {
  currentPayload: SensorPayload;
  onRecordSample?: (sample: RecordedSample) => void;
}

const PRESET_LABELS = [
  'Normal_Walk',
  'Wrist_Shake',
  'Sit_Down',
  'Hard_Fall',
  'Bed_Drop',
  'Ascending_Stairs',
  'Descending_Stairs',
];

export const DatasetRecorder: React.FC<DatasetRecorderProps> = ({ currentPayload }) => {
  const [selectedLabel, setSelectedLabel] = useState<string>('Normal_Walk');
  const [customLabel, setCustomLabel] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [samples, setSamples] = useState<RecordedSample[]>([]);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const activeLabel = customLabel.trim() ? customLabel.trim() : selectedLabel;

  // Append sample when recording is active
  useEffect(() => {
    if (!isRecording) return;

    const sample: RecordedSample = {
      timestamp_ms: Date.now(),
      ax: currentPayload.ax,
      ay: currentPayload.ay,
      az: currentPayload.az,
      g: currentPayload.g,
      ir: currentPayload.ir,
      bpm: currentPayload.bpm,
      label: activeLabel,
    };

    setSamples((prev) => [...prev, sample]);
  }, [currentPayload, isRecording, activeLabel]);

  // Elapsed timer when recording
  useEffect(() => {
    if (!isRecording) return;
    const start = Date.now() - elapsedMs;
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 100);

    return () => clearInterval(timer);
  }, [isRecording]);

  const handleToggleRecord = () => {
    if (isRecording) {
      setIsRecording(false);
    } else {
      setIsRecording(true);
    }
  };

  const handleClearBuffer = () => {
    setIsRecording(false);
    setSamples([]);
    setElapsedMs(0);
    setExportNotice(null);
  };

  const handleExportCSV = () => {
    if (samples.length === 0) return;

    // Header matching prompt contract:
    // timestamp_ms,ax,ay,az,g,ir,bpm,label
    const headers = 'timestamp_ms,ax,ay,az,g,ir,bpm,label';
    const rows = samples.map(
      (s) => `${s.timestamp_ms},${s.ax},${s.ay},${s.az},${s.g},${s.ir},${s.bpm},${s.label}`
    );
    const csvContent = [headers, ...rows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `fallguard_${activeLabel}_${dateStr}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportNotice(`Exported ${samples.length} rows to ${filename}`);
    setTimeout(() => setExportNotice(null), 4000);
  };

  // Format elapsed time (MM:SS.s)
  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const tenths = Math.floor((ms % 1000) / 100);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
  };

  return (
    <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-950/80 border border-indigo-800/60 text-indigo-400">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              Neural Network Dataset Recorder
              {isRecording && (
                <span className="flex items-center gap-1 text-[10px] bg-red-950/80 border border-red-600/80 text-red-400 px-2 py-0.5 rounded-full font-mono animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  REC ACTIVE
                </span>
              )}
            </h2>
            <p className="text-[11px] text-slate-400">
              Collect and export labeled CSV time-series for Edge-AI & ML fall detection models
            </p>
          </div>
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="bg-slate-900/80 px-2.5 py-1 rounded border border-slate-700/60 flex items-center gap-1.5">
            <span className="text-slate-500 text-[10px] uppercase">Samples:</span>
            <span className="font-bold text-slate-200 font-tabular">{samples.length.toLocaleString()}</span>
          </div>

          <div className="bg-slate-900/80 px-2.5 py-1 rounded border border-slate-700/60 flex items-center gap-1.5">
            <span className="text-slate-500 text-[10px] uppercase">Duration:</span>
            <span className="font-bold text-cyan-400 font-tabular">{formatTime(elapsedMs)}</span>
          </div>
        </div>
      </div>

      {/* Activity Label Selector */}
      <div className="my-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <Tag className="w-3 h-3 text-slate-400" />
            Activity Class Label:
          </span>
          <span className="font-mono text-[11px] text-indigo-400 font-semibold bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-900/50">
            Current: {activeLabel}
          </span>
        </div>

        {/* Preset Chips */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {PRESET_LABELS.map((label) => (
            <button
              key={label}
              type="button"
              disabled={isRecording}
              onClick={() => {
                setSelectedLabel(label);
                setCustomLabel('');
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all ${
                activeLabel === label && !customLabel
                  ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                  : 'bg-slate-900/70 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-700/50'
              } ${isRecording ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Custom Label Input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            disabled={isRecording}
            placeholder="Or type custom label (e.g., Trip_Over_Obstacle, Sitting_Fast)..."
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value.replace(/\s+/g, '_'))}
            className={`w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 ${
              isRecording ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          />
        </div>
      </div>

      {/* Control Buttons: Record / Stop / Export / Clear */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-700/60">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleRecord}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 ${
              isRecording
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-950'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950'
            }`}
          >
            {isRecording ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Recording</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Recording</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={samples.length === 0}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all ${
              samples.length > 0
                ? 'bg-blue-600/90 hover:bg-blue-600 text-white border-blue-500 shadow-sm'
                : 'bg-slate-800/40 text-slate-600 border-slate-700 cursor-not-allowed'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleClearBuffer}
          disabled={samples.length === 0 && elapsedMs === 0}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors ${
            samples.length === 0 ? 'opacity-40 cursor-not-allowed' : ''
          }`}
          title="Clear recorded sample memory buffer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Buffer</span>
        </button>
      </div>

      {/* Export notification */}
      {exportNotice && (
        <div className="mt-2 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 rounded-lg p-2 flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-mono">{exportNotice}</span>
        </div>
      )}
    </div>
  );
};
