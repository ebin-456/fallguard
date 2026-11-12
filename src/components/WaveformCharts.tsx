import React, { useEffect, useRef } from 'react';
import { FloatRingBuffer } from '../utils/ringBuffer';
import { Activity, Waves } from 'lucide-react';

interface WaveformChartsProps {
  gBuffer: FloatRingBuffer;
  irBuffer: FloatRingBuffer;
  currentG: number;
  currentIR: number;
}

export const WaveformCharts: React.FC<WaveformChartsProps> = ({
  gBuffer,
  irBuffer,
  currentG,
  currentIR,
}) => {
  const gCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const irCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Reusable scratch Float32Arrays for zero-allocation rendering
  const gScratch = useRef(new Float32Array(300));
  const irScratch = useRef(new Float32Array(300));

  useEffect(() => {
    let animId: number;

    const render = () => {
      // 1. Render G-Force Trace
      if (gCanvasRef.current) {
        const canvas = gCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          const rect = canvas.getBoundingClientRect();

          // Set internal dimensions if changed
          if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
            canvas.width = Math.round(rect.width * dpr);
            canvas.height = Math.round(rect.height * dpr);
          }

          ctx.save();
          ctx.scale(dpr, dpr);
          const w = rect.width;
          const h = rect.height;

          // Background
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, w, h);

          // Grid lines (horizontal)
          // Scale range: 0.0g to 4.5g
          const minG = 0.0;
          const maxG = 4.5;
          const gToY = (val: number) => {
            const clamped = Math.max(minG, Math.min(maxG, val));
            return h - ((clamped - minG) / (maxG - minG)) * (h - 16) - 8;
          };

          // Draw subtle background grid
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1;
          [1.0, 2.0, 3.0, 4.0].forEach((gridG) => {
            const y = gToY(gridG);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          });

          // Dashed threshold lines:
          // 3.20g Impact threshold (red)
          const impactY = gToY(3.20);
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, impactY);
          ctx.lineTo(w, impactY);
          ctx.stroke();

          // 0.60g Free-Fall threshold (cyan)
          const freefallY = gToY(0.60);
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, freefallY);
          ctx.lineTo(w, freefallY);
          ctx.stroke();

          // 1.00g Normal Baseline (emerald subtle)
          const baselineY = gToY(1.00);
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(0, baselineY);
          ctx.lineTo(w, baselineY);
          ctx.stroke();

          // Labels for threshold lines
          ctx.font = '10px monospace';
          ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
          ctx.fillText('3.20g IMPACT', 6, impactY - 4);

          ctx.fillStyle = 'rgba(6, 182, 212, 0.9)';
          ctx.fillText('0.60g FREE-FALL', 6, freefallY + 12);

          ctx.fillStyle = 'rgba(16, 185, 129, 0.6)';
          ctx.fillText('1.00g 1G', w - 48, baselineY - 4);

          // Copy points from ring buffer
          const count = gBuffer.copyTo(gScratch.current);
          if (count > 1) {
            // Gradient fill under waveform
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, 'rgba(59, 130, 246, 0.25)');
            grad.addColorStop(0.5, 'rgba(59, 130, 246, 0.08)');
            grad.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

            ctx.beginPath();
            for (let i = 0; i < count; i++) {
              const x = (i / (count - 1)) * w;
              const y = gToY(gScratch.current[i]);
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }

            // Fill area under line
            ctx.lineTo(w, h);
            ctx.lineTo(0, h);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();

            // Trace stroke line
            ctx.beginPath();
            for (let i = 0; i < count; i++) {
              const x = (i / (count - 1)) * w;
              const y = gToY(gScratch.current[i]);
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }

            // Line color depends on latest value
            const latest = gScratch.current[count - 1];
            if (latest > 3.20) {
              ctx.strokeStyle = '#ef4444'; // Red impact
              ctx.lineWidth = 2.5;
            } else if (latest < 0.60) {
              ctx.strokeStyle = '#06b6d4'; // Cyan free-fall
              ctx.lineWidth = 2.5;
            } else {
              ctx.strokeStyle = '#3b82f6'; // Blue normal
              ctx.lineWidth = 2;
            }
            ctx.stroke();

            // Glowing dot on newest data point
            const lastX = w;
            const lastY = gToY(latest);
            ctx.beginPath();
            ctx.arc(lastX - 2, lastY, 4, 0, Math.PI * 2);
            ctx.fillStyle = ctx.strokeStyle;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
          }

          ctx.restore();
        }
      }

      // 2. Render Optical PPG Waveform
      if (irCanvasRef.current) {
        const canvas = irCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          const rect = canvas.getBoundingClientRect();

          if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
            canvas.width = Math.round(rect.width * dpr);
            canvas.height = Math.round(rect.height * dpr);
          }

          ctx.save();
          ctx.scale(dpr, dpr);
          const w = rect.width;
          const h = rect.height;

          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, w, h);

          // Grid lines
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1;
          for (let gy = h * 0.25; gy < h; gy += h * 0.25) {
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(w, gy);
            ctx.stroke();
          }

          const count = irBuffer.copyTo(irScratch.current);
          if (count > 2) {
            // Find min/max for dynamic AC-coupling
            let minVal = Infinity;
            let maxVal = -Infinity;
            for (let i = 0; i < count; i++) {
              const v = irScratch.current[i];
              if (v < minVal) minVal = v;
              if (v > maxVal) maxVal = v;
            }

            // Ensure a minimal span so flatline doesn't explode
            const span = Math.max(800, maxVal - minVal);
            const mid = (maxVal + minVal) / 2;
            const yMin = mid - span * 0.65;
            const yMax = mid + span * 0.65;

            const irToY = (val: number) => {
              return h - ((val - yMin) / (yMax - yMin)) * (h - 16) - 8;
            };

            // Gradient fill
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, 'rgba(244, 63, 94, 0.3)');
            grad.addColorStop(0.5, 'rgba(244, 63, 94, 0.08)');
            grad.addColorStop(1, 'rgba(244, 63, 94, 0.0)');

            ctx.beginPath();
            for (let i = 0; i < count; i++) {
              const x = (i / (count - 1)) * w;
              const y = irToY(irScratch.current[i]);
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }

            ctx.lineTo(w, h);
            ctx.lineTo(0, h);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();

            // PPG Waveform Line
            ctx.beginPath();
            for (let i = 0; i < count; i++) {
              const x = (i / (count - 1)) * w;
              const y = irToY(irScratch.current[i]);
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }

            ctx.strokeStyle = '#f43f5e'; // Rose / crimson optical trace
            ctx.lineWidth = 2;
            ctx.stroke();

            // Glowing dot on latest optical sample
            const latest = irScratch.current[count - 1];
            const lastX = w;
            const lastY = irToY(latest);
            ctx.beginPath();
            ctx.arc(lastX - 2, lastY, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#f43f5e';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
          }

          // Center watermark label
          ctx.font = '10px monospace';
          ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
          ctx.fillText('MAX30102 AC-COUPLED PPG', 6, 14);

          ctx.restore();
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [gBuffer, irBuffer]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Chart 1: G-Force Magnitude Trace */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3 sm:p-4 shadow-md flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-blue-950/80 border border-blue-800/60 text-blue-400">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                G-Force Magnitude Trace
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                Thresholds: &lt;0.60g Free-Fall | &gt;3.20g Impact
              </p>
            </div>
          </div>
          <div className="text-right font-mono">
            <span className="text-sm font-bold text-slate-100 font-tabular">{currentG.toFixed(2)}</span>
            <span className="text-[10px] text-slate-400 ml-1">g</span>
          </div>
        </div>

        <div className="relative w-full h-36 sm:h-40 rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
          <canvas ref={gCanvasRef} className="w-full h-full block" />
        </div>
      </div>

      {/* Chart 2: Optical PPG / IR Trace */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3 sm:p-4 shadow-md flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-rose-950/80 border border-rose-800/60 text-rose-400">
              <Waves className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Optical PPG / IR Pulse Wave
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                AC-Coupled Dicrotic Pulse Waveform
              </p>
            </div>
          </div>
          <div className="text-right font-mono">
            <span className="text-sm font-bold text-rose-300 font-tabular">{currentIR.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 ml-1">cts</span>
          </div>
        </div>

        <div className="relative w-full h-36 sm:h-40 rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
          <canvas ref={irCanvasRef} className="w-full h-full block" />
        </div>
      </div>
    </div>
  );
};
