import React, { useState } from 'react';
import type { ConnectionState } from '../types';
import { 
  Wifi, 
  WifiOff, 
  Cpu, 
  Activity, 
  Volume2, 
  VolumeX, 
  Info, 
  SlidersHorizontal,
  RefreshCw,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { soundManager } from '../utils/audio';

interface HeaderProps {
  isSimulator: boolean;
  onToggleSimulator: (enabled: boolean) => void;
  connectionState: ConnectionState;
  latencyMs: number;
  ipAddress: string;
  onIpChange: (ip: string) => void;
  mpuHealthy: boolean;
  maxHealthy: boolean;
  onOpenInfo: () => void;
  onToggleSimDrawer: () => void;
  isSimDrawerOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  isSimulator,
  onToggleSimulator,
  connectionState,
  latencyMs,
  ipAddress,
  onIpChange,
  mpuHealthy,
  maxHealthy,
  onOpenInfo,
  onToggleSimDrawer,
  isSimDrawerOpen,
}) => {
  const [isEditingIp, setIsEditingIp] = useState(false);
  const [tempIp, setTempIp] = useState(ipAddress);
  const [isMuted, setIsMuted] = useState(soundManager.getMuted());

  const handleSaveIp = () => {
    onIpChange(tempIp);
    setIsEditingIp(false);
  };

  const handleToggleMute = () => {
    const nextMuted = soundManager.toggleMute();
    setIsMuted(nextMuted);
    if (!nextMuted) {
      soundManager.playResetPing();
    }
  };

  const getConnectionBadge = () => {
    if (isSimulator) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 shadow-sm shadow-cyan-950">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>SIMULATOR</span>
        </div>
      );
    }

    switch (connectionState) {
      case 'connected':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 shadow-sm shadow-emerald-950">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>CONNECTED</span>
            <span className="text-[10px] text-emerald-500 font-tabular font-normal ml-0.5">
              {latencyMs > 0 ? `${latencyMs}ms` : ''}
            </span>
          </div>
        );
      case 'reconnecting':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-400 border border-amber-800/60 shadow-sm shadow-amber-950">
            <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
            <span>RECONNECTING</span>
          </div>
        );
      case 'offline':
      default:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-800/60 shadow-sm shadow-rose-950">
            <WifiOff className="w-3 h-3 text-rose-400" />
            <span>OFFLINE</span>
          </div>
        );
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-3 sm:px-4 py-2.5">
      <div className="max-w-5xl mx-auto flex flex-col gap-2">
        {/* Top Row: App Branding + Mode Toggle + Audio/Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md shadow-blue-900/40 border border-blue-500/30">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-sm sm:text-base tracking-tight text-white">FallGuard</h1>
                <span className="text-[10px] tracking-wider uppercase font-semibold text-blue-400 bg-blue-950/70 border border-blue-800/50 px-1.5 py-0.2 rounded">
                  PWA
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono -mt-0.5 hidden xs:block">
                ESP32 Wearable Monitor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live / Simulator Switch */}
            <div className="flex items-center bg-slate-800/90 p-0.5 rounded-lg border border-slate-700/80 text-xs">
              <button
                type="button"
                onClick={() => onToggleSimulator(false)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
                  !isSimulator
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Connect to physical ESP32 wristband Wi-Fi"
              >
                <Wifi className="w-3 h-3" />
                <span className="hidden sm:inline">Live ESP32</span>
                <span className="sm:hidden">Live</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleSimulator(true)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
                  isSimulator
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Use realistic synthetic sensor generator"
              >
                <Cpu className="w-3 h-3" />
                <span>Sim</span>
              </button>
            </div>

            {/* Sim Drawer Toggle (when in simulator mode) */}
            {isSimulator && (
              <button
                type="button"
                onClick={onToggleSimDrawer}
                className={`p-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors ${
                  isSimDrawerOpen
                    ? 'bg-cyan-950 border-cyan-700 text-cyan-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
                title="Simulator Controls & Triggers"
              >
                <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
                <span className="text-[11px] hidden sm:inline">Triggers</span>
              </button>
            )}

            {/* Sound Mute Toggle */}
            <button
              type="button"
              onClick={handleToggleMute}
              className={`p-1.5 rounded-lg border transition-colors ${
                isMuted
                  ? 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                  : 'bg-blue-950/60 border-blue-800/80 text-blue-400 hover:bg-blue-900/60'
              }`}
              title={isMuted ? 'Unmute Audio Chime' : 'Mute Audio Chime'}
              aria-label="Audio Alert Toggle"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Help / Info Modal Button */}
            <button
              type="button"
              onClick={onOpenInfo}
              className="p-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors"
              title="Connection Instructions & Hardware Setup"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom Row: Connection Badge + IP Address + Sensor Status Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60 text-xs">
          <div className="flex items-center gap-2">
            {getConnectionBadge()}

            {/* IP Address Editor */}
            {!isSimulator ? (
              <div className="flex items-center text-slate-400 font-mono text-[11px]">
                {isEditingIp ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={tempIp}
                      onChange={(e) => setTempIp(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveIp()}
                      placeholder="192.168.4.1"
                      className="bg-slate-950 border border-blue-500 rounded px-1.5 py-0.5 text-slate-100 w-28 text-center text-xs focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveIp}
                      className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[10px] font-sans hover:bg-blue-500"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setTempIp(ipAddress);
                      setIsEditingIp(true);
                    }}
                    className="flex items-center gap-1 hover:text-slate-200 transition-colors bg-slate-800/50 hover:bg-slate-800 px-2 py-0.5 rounded border border-slate-700/60"
                    title="Click to edit ESP32 IP address"
                  >
                    <span className="text-slate-500">IP:</span>
                    <span className="text-slate-300 font-semibold">{ipAddress}</span>
                  </button>
                )}
              </div>
            ) : (
              <span className="text-[11px] font-mono text-cyan-400/80 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-900/50">
                100 Hz Synthetic Bus
              </span>
            )}
          </div>

          {/* Sensor Health Pills */}
          <div className="flex items-center gap-1.5">
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${
                mpuHealthy
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                  : 'bg-rose-950/50 text-rose-400 border-rose-800/50'
              }`}
              title="MPU6050 3-Axis Accelerometer (0x68)"
            >
              {mpuHealthy ? (
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
              )}
              <span>MPU6050</span>
            </div>

            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${
                maxHealthy
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                  : 'bg-rose-950/50 text-rose-400 border-rose-800/50'
              }`}
              title="MAX30102 Optical PPG Heart Rate (0x57)"
            >
              {maxHealthy ? (
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
              )}
              <span>MAX30102</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
