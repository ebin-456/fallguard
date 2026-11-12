import { useState, useEffect, useRef, useCallback } from 'react';
import { FallStateCode } from './types';
import type { SensorPayload, ConnectionState } from './types';
import { FloatRingBuffer } from './utils/ringBuffer';
import { simulator } from './services/simulator';
import { esp32Api } from './services/esp32Api';
import { Header } from './components/Header';
import { FallStateBanner } from './components/FallStateBanner';
import { TelemetryGrid } from './components/TelemetryGrid';
import { WaveformCharts } from './components/WaveformCharts';
import { DatasetRecorder } from './components/DatasetRecorder';
import { SimulatorControls } from './components/SimulatorControls';
import { OfflineInfoModal } from './components/OfflineInfoModal';

const DEFAULT_IP = '192.168.4.1';

export function App() {
  // IP Address state
  const [ipAddress, setIpAddress] = useState<string>(() => {
    return localStorage.getItem('fallguard_esp32_ip') || DEFAULT_IP;
  });

  // Simulator toggle state (default to true on HTTPS or if specified, or if user was on sim)
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const [isSimulator, setIsSimulator] = useState<boolean>(() => {
    const saved = localStorage.getItem('fallguard_mode_sim');
    if (saved !== null) return saved === 'true';
    return isHttps; // Default to simulator if loaded on HTTPS to prevent immediate mixed content errors
  });

  const [connectionState, setConnectionState] = useState<ConnectionState>(
    isSimulator ? 'simulator' : 'offline'
  );
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [isSimDrawerOpen, setIsSimDrawerOpen] = useState<boolean>(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState<boolean>(false);
  const [simulatorNotice, setSimulatorNotice] = useState<string | null>(null);

  // Latest Telemetry Payload
  const [payload, setPayload] = useState<SensorPayload>({
    g: 1.00,
    ax: 0.02,
    ay: -0.05,
    az: 0.99,
    state: 'MONITORING (NORMAL)',
    code: FallStateCode.MONITORING,
    skin: true,
    bpm: 74,
    ir: 68420,
    mpu: true,
    max: true,
  });

  // Ring buffers for 60fps waveform charts (capacity = 300 points)
  const gBuffer = useRef<FloatRingBuffer>(new FloatRingBuffer(300));
  const irBuffer = useRef<FloatRingBuffer>(new FloatRingBuffer(300));

  // Consecutive error counter for live polling
  const consecutiveErrors = useRef<number>(0);

  // Save IP change
  const handleIpChange = (newIp: string) => {
    const cleaned = esp32Api.cleanIp(newIp);
    setIpAddress(cleaned);
    localStorage.setItem('fallguard_esp32_ip', cleaned);
    consecutiveErrors.current = 0;
  };

  // Toggle Live vs Simulator
  const handleToggleSimulator = (enabled: boolean) => {
    setIsSimulator(enabled);
    localStorage.setItem('fallguard_mode_sim', String(enabled));
    consecutiveErrors.current = 0;

    if (enabled) {
      setConnectionState('simulator');
      setIsSimDrawerOpen(true);
    } else {
      setConnectionState('reconnecting');
      setIsSimDrawerOpen(false);
    }
  };

  // Cancel / Reset Alert action
  const handleCancelAlert = useCallback(async () => {
    setIsCancelling(true);

    if (isSimulator) {
      simulator.resetToMonitoring();
      setPayload((prev) => ({
        ...prev,
        code: FallStateCode.MONITORING,
        state: 'MONITORING (NORMAL)',
      }));
      setSimulatorNotice('Alert Cancelled & Reset to Monitoring');
      setTimeout(() => setSimulatorNotice(null), 3000);
      setIsCancelling(false);
    } else {
      // Optimistic update
      setPayload((prev) => ({
        ...prev,
        code: FallStateCode.MONITORING,
        state: 'MONITORING (NORMAL)',
      }));
      const success = await esp32Api.cancelAlert(ipAddress);
      setIsCancelling(false);
      if (!success) {
        console.warn('Cancel alert failed to reach ESP32 endpoint');
      }
    }
  }, [isSimulator, ipAddress]);

  // Telemetry ingestion loop
  useEffect(() => {
    let timer: number | null = null;
    let isMounted = true;

    if (isSimulator) {
      setConnectionState('simulator');

      // Tick simulator at ~25ms (~40 Hz render update)
      const simInterval = window.setInterval(() => {
        if (!isMounted) return;
        const simData = simulator.tick();
        gBuffer.current.push(simData.g);
        irBuffer.current.push(simData.ir);
        setPayload(simData);
        setLatencyMs(4);

        if (simulator.lastNotice && Date.now() - simulator.lastNoticeTime < 3500) {
          setSimulatorNotice(simulator.lastNotice);
        } else {
          setSimulatorNotice(null);
        }
      }, 25);

      return () => {
        isMounted = false;
        clearInterval(simInterval);
      };
    } else {
      // LIVE ESP32 POLLING (every 120ms)
      const pollLoop = async () => {
        if (!isMounted) return;

        const result = await esp32Api.fetchData(ipAddress, 700);

        if (!isMounted) return;

        if (result.data) {
          consecutiveErrors.current = 0;
          setConnectionState('connected');
          setLatencyMs(result.latencyMs);

          gBuffer.current.push(result.data.g);
          irBuffer.current.push(result.data.ir);
          setPayload(result.data);
        } else {
          consecutiveErrors.current++;
          if (consecutiveErrors.current >= 2) {
            setConnectionState('reconnecting');
          }
          if (consecutiveErrors.current >= 8) {
            setConnectionState('offline');
          }
        }

        // Schedule next poll
        if (isMounted) {
          timer = window.setTimeout(pollLoop, 120);
        }
      };

      pollLoop();

      return () => {
        isMounted = false;
        if (timer) clearTimeout(timer);
      };
    }
  }, [isSimulator, ipAddress]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Status Bar */}
      <Header
        isSimulator={isSimulator}
        onToggleSimulator={handleToggleSimulator}
        connectionState={connectionState}
        latencyMs={latencyMs}
        ipAddress={ipAddress}
        onIpChange={handleIpChange}
        mpuHealthy={payload.mpu}
        maxHealthy={payload.max}
        onOpenInfo={() => setIsInfoModalOpen(true)}
        onToggleSimDrawer={() => setIsSimDrawerOpen((prev) => !prev)}
        isSimDrawerOpen={isSimDrawerOpen}
      />

      {/* Main Dashboard Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-3 sm:p-4 space-y-3.5">
        {/* Simulator Control Drawer (when open) */}
        {isSimulator && (
          <SimulatorControls
            isOpen={isSimDrawerOpen}
            onClose={() => setIsSimDrawerOpen(false)}
            onTriggerAction={() => { }}
          />
        )}

        {/* Fall State Banner & Remote Alert Control */}
        <FallStateBanner
          code={payload.code}
          stateText={payload.state}
          onCancelAlert={handleCancelAlert}
          isCancelling={isCancelling}
          simulatorNotice={simulatorNotice}
        />

        {/* Live Telemetry Grid (Total G, BPM, Skin Contact & IR) */}
        <TelemetryGrid data={payload} />

        {/* Real-Time 60fps Scrolling Waveforms */}
        <WaveformCharts
          gBuffer={gBuffer.current}
          irBuffer={irBuffer.current}
          currentG={payload.g}
          currentIR={payload.ir}
        />

        {/* Neural Network Dataset Recorder & CSV Export */}
        <DatasetRecorder currentPayload={payload} />
      </main>

      {/* Footer / Offline status pill */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-3 px-4 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>PWA Ready &bull; Offline Precached Shell &bull; Direct I2C Wire.h</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
            <span>ESP32 AP: FallGuard_Band</span>
            <span>&bull;</span>
            <button
              type="button"
              onClick={() => setIsInfoModalOpen(true)}
              className="text-blue-400 hover:underline"
            >
              Hardware Guide
            </button>
          </div>
        </div>
      </footer>

      {/* Setup / Instructions Modal */}
      <OfflineInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        isMixedContent={isHttps}
      />
    </div>
  );
}

export default App;
