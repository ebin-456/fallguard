import React, { useEffect, useState } from 'react';
import { FallStateCode } from '../types';
import { 
  ShieldCheck, 
  AlertOctagon, 
  Clock, 
  AlertTriangle, 
  RotateCcw,
  ShieldAlert
} from 'lucide-react';
import { soundManager } from '../utils/audio';

interface FallStateBannerProps {
  code: number;
  stateText: string;
  onCancelAlert: () => void;
  isCancelling: boolean;
  simulatorNotice?: string | null;
}

export const FallStateBanner: React.FC<FallStateBannerProps> = ({
  code,
  stateText,
  onCancelAlert,
  isCancelling,
  simulatorNotice,
}) => {
  // Pre-Alarm 10s countdown tracking
  const [countdownSec, setCountdownSec] = useState<number>(10);
  const isPreAlarm = code === FallStateCode.PRE_ALARM;
  const isEmergency = code === FallStateCode.EMERGENCY;
  const isFreefall = code === FallStateCode.FREEFALL;
  const isWaitStill = code === FallStateCode.WAIT_STILL;
  const isNormal = code === FallStateCode.MONITORING;

  // Manage Web Audio trigger when state transitions
  useEffect(() => {
    if (isPreAlarm) {
      soundManager.startPreAlarm();
      setCountdownSec(10);
      const start = Date.now();
      const interval = window.setInterval(() => {
        const remaining = Math.max(0, 10 - Math.floor((Date.now() - start) / 1000));
        setCountdownSec(remaining);
      }, 200);

      return () => {
        clearInterval(interval);
      };
    } else if (isEmergency) {
      soundManager.startEmergencySiren();
    } else {
      soundManager.stopAlarm();
    }
  }, [code, isPreAlarm, isEmergency]);

  const handleCancel = () => {
    soundManager.stopAlarm();
    soundManager.playResetPing();
    onCancelAlert();
  };

  // Determine banner styling
  let containerStyles = 'bg-slate-800/90 border-slate-700/80 text-slate-100';
  let badgeStyles = 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60';
  let iconComponent = <ShieldCheck className="w-6 h-6 text-emerald-400" />;
  let bannerTitle = 'MONITORING (NORMAL)';
  let bannerSubtitle = 'Sensors active. Zero fall indicators detected.';

  if (isNormal) {
    containerStyles = 'bg-slate-800/80 border-slate-700/70 text-slate-200';
    badgeStyles = 'bg-emerald-950/80 text-emerald-400 border-emerald-800/50';
    iconComponent = <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />;
    bannerTitle = 'MONITORING (NORMAL)';
    bannerSubtitle = 'MPU6050 3-axis motion & MAX30102 PPG vitals stable.';
  } else if (isFreefall) {
    containerStyles = 'bg-amber-950/40 border-amber-500/70 text-amber-200 glow-amber';
    badgeStyles = 'bg-amber-950/90 text-amber-300 border-amber-600/60';
    iconComponent = <AlertTriangle className="w-6 h-6 text-amber-400 animate-bounce shrink-0" />;
    bannerTitle = 'STAGE 1: FREEFALL DETECTED';
    bannerSubtitle = 'Rapid gravity drop (< 0.60g) sensed. Awaiting impact shock...';
  } else if (isWaitStill) {
    containerStyles = 'bg-orange-950/40 border-orange-500/70 text-orange-200 glow-amber';
    badgeStyles = 'bg-orange-950/90 text-orange-300 border-orange-600/60';
    iconComponent = <Clock className="w-6 h-6 text-orange-400 animate-pulse shrink-0" />;
    bannerTitle = 'STAGE 2 & 3: IMPACT CONFIRMED';
    bannerSubtitle = 'Impact shock (> 3.20g) logged. Verifying 2.0s post-fall immobility...';
  } else if (isPreAlarm) {
    containerStyles = 'bg-rose-950/70 border-rose-500 text-rose-100 glow-crimson animate-urgent';
    badgeStyles = 'bg-rose-900 text-white border-rose-400';
    iconComponent = <AlertOctagon className="w-7 h-7 text-rose-300 animate-spin shrink-0" />;
    bannerTitle = 'STAGE 4: PRE-ALARM (FALL CONFIRMED)';
    bannerSubtitle = 'User motionless! Escalating to Emergency unless cancelled.';
  } else if (isEmergency) {
    containerStyles = 'bg-red-950/90 border-red-500 text-red-50 glow-crimson ring-2 ring-red-500/50';
    badgeStyles = 'bg-red-900 text-red-100 border-red-400 animate-pulse';
    iconComponent = <ShieldAlert className="w-7 h-7 text-red-300 animate-bounce shrink-0" />;
    bannerTitle = 'CRITICAL: EMERGENCY ALARM ACTIVE';
    bannerSubtitle = 'Buzzer siren sounding. Help request dispatched to caregivers!';
  }

  return (
    <div className="w-full">
      {/* False alarm rejection or simulator notice bar */}
      {simulatorNotice && (
        <div className="mb-2 px-3 py-1.5 rounded-lg bg-cyan-950/70 border border-cyan-800/80 text-cyan-300 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="font-semibold">Notice:</span>
            <span>{simulatorNotice}</span>
          </div>
          <span className="text-[10px] text-cyan-400/70 font-mono">Sim Engine</span>
        </div>
      )}

      {/* Main Color-Coded State Banner */}
      <div className={`rounded-xl border p-3.5 sm:p-4 shadow-lg transition-all duration-300 ${containerStyles}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left: State Icon + Title + Description */}
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-900/60 border border-white/10 shadow-inner">
              {iconComponent}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-base sm:text-lg tracking-tight">
                  {bannerTitle}
                </span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${badgeStyles}`}>
                  CODE {code}
                </span>
                <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                  [{stateText}]
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300/90 mt-0.5">
                {bannerSubtitle}
              </p>
            </div>
          </div>

          {/* Right: Remote Cancel Alert Button & Pre-Alarm Countdown */}
          <div className="flex items-center gap-2 sm:self-center w-full sm:w-auto">
            {isPreAlarm && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-900/80 border border-rose-500 font-mono text-center">
                <Clock className="w-4 h-4 text-rose-300 animate-pulse" />
                <span className="text-lg font-bold text-white font-tabular">
                  T-{countdownSec}s
                </span>
              </div>
            )}

            {/* Cancel Button */}
            <button
              type="button"
              onClick={handleCancel}
              disabled={isCancelling}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-xl font-bold text-sm tracking-wide transition-all shadow-md active:scale-95 touch-manipulation ${
                isPreAlarm || isEmergency
                  ? 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white border border-rose-400 shadow-rose-950/60'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 hover:text-white'
              }`}
            >
              <RotateCcw className={`w-4 h-4 ${isCancelling ? 'animate-spin' : ''}`} />
              <span>
                {isCancelling ? 'Cancelling...' : (isPreAlarm || isEmergency ? 'CANCEL / RESET ALERT' : 'Reset Alert')}
              </span>
            </button>
          </div>
        </div>

        {/* Pre-Alarm Progress Bar */}
        {isPreAlarm && (
          <div className="mt-3 pt-3 border-t border-rose-800/60">
            <div className="flex justify-between text-[11px] font-mono text-rose-200 mb-1">
              <span>Automatic Emergency Siren In:</span>
              <span className="font-bold">{countdownSec} seconds</span>
            </div>
            <div className="w-full bg-rose-950 rounded-full h-2.5 overflow-hidden border border-rose-800">
              <div
                className="bg-gradient-to-r from-amber-400 to-rose-500 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${(countdownSec / 10) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
