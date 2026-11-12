import React from 'react';
import { 
  X, 
  Wifi, 
  AlertTriangle, 
  Cpu, 
  Download, 
  Shield, 
  Layers 
} from 'lucide-react';

interface OfflineInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMixedContent: boolean;
}

export const OfflineInfoModal: React.FC<OfflineInfoModalProps> = ({
  isOpen,
  onClose,
  isMixedContent,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">FallGuard Setup & Guide</h2>
              <p className="text-xs text-slate-400">Hardware instructions & offline PWA guide</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 text-xs sm:text-sm text-slate-300">
          {/* Mixed Content Warning Alert (if applicable) */}
          {isMixedContent && (
            <div className="p-3 rounded-xl bg-amber-950/70 border border-amber-600/70 text-amber-200">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wide text-amber-300">
                    Browser Mixed Content Notice (HTTPS)
                  </h4>
                  <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
                    You are viewing FallGuard over <strong>HTTPS</strong>. Web browsers block insecure HTTP requests (`http://192.168.4.1`) from secure HTTPS pages by security policy.
                  </p>
                  <p className="text-xs text-amber-200/90 mt-1.5">
                    <strong>Solution:</strong> Use <strong>Simulator Mode</strong> for testing, or host/open the app over plain <strong>HTTP</strong> on your local network (e.g. `http://localhost:3000` or `http://&lt;your-pc-ip&gt;:3000`).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Section 1: ESP32 Wi-Fi Setup */}
          <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-3.5 space-y-2">
            <h3 className="font-bold text-slate-100 flex items-center gap-2 text-xs uppercase tracking-wider text-blue-400">
              <Wifi className="w-4 h-4 text-blue-400" />
              1. Connecting Smartphone to ESP32 Wristband
            </h3>
            <div className="grid grid-cols-2 gap-2 font-mono text-xs bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
              <div>
                <span className="text-slate-500 block text-[10px]">Wi-Fi AP SSID</span>
                <span className="text-emerald-400 font-bold">FallGuard_Band</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Wi-Fi Password</span>
                <span className="text-emerald-400 font-bold">12345678</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Default IP Address</span>
                <span className="text-cyan-400 font-bold">192.168.4.1</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">HTTP Endpoints</span>
                <span className="text-cyan-400 font-bold">/data &amp; /cancel</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              <strong>Crucial Mobile Tip:</strong> When connecting to the wristband Wi-Fi, your phone will prompt <em>&quot;No Internet access available. Stay connected?&quot;</em>. You must select <strong>&quot;Yes / Keep Connected&quot;</strong>, otherwise the phone switches back to cellular data.
            </p>
          </div>

          {/* Section 2: PWA Offline Architecture */}
          <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-3.5 space-y-2">
            <h3 className="font-bold text-slate-100 flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-400">
              <Download className="w-4 h-4 text-indigo-400" />
              2. Offline PWA Installation
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              FallGuard includes a full <strong>Service Worker (`sw.js`)</strong> and Web App Manifest. Once loaded once, all JavaScript, CSS, icons, and sounds are cached on your smartphone.
            </p>
            <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
              <li>
                <strong>Android (Chrome):</strong> Tap the 3 dots menu &rarr; <em>&quot;Add to Home screen&quot;</em> or <em>&quot;Install App&quot;</em>.
              </li>
              <li>
                <strong>iOS (Safari):</strong> Tap the Share button &rarr; <em>&quot;Add to Home Screen&quot;</em>.
              </li>
              <li>
                Once installed, the PWA launches like a native app even when the phone has zero cellular internet!
              </li>
            </ul>
          </div>

          {/* Section 3: ESP32 Hardware Pinout */}
          <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-3.5 space-y-2">
            <h3 className="font-bold text-slate-100 flex items-center gap-2 text-xs uppercase tracking-wider text-emerald-400">
              <Cpu className="w-4 h-4 text-emerald-400" />
              3. Hardware Pinout &amp; I2C Wiring
            </h3>
            <p className="text-xs text-slate-400">
              Arduino sketch is located at <code className="text-cyan-300">firmware/fallguard_esp32.ino</code>:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-xs">
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px]">MPU6050 + MAX30102</span>
                <span className="text-white font-bold">GPIO 21 (SDA)</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px]">MPU6050 + MAX30102</span>
                <span className="text-white font-bold">GPIO 22 (SCL)</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Status / Alarm LED</span>
                <span className="text-white font-bold">GPIO 4</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Cancel Pushbutton</span>
                <span className="text-white font-bold">GPIO 5 (Pull-Up)</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Piezo Buzzer (PWM)</span>
                <span className="text-white font-bold">GPIO 18</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px]">I2C Addresses</span>
                <span className="text-white font-bold">0x68 &amp; 0x57</span>
              </div>
            </div>
          </div>

          {/* Section 4: 4-Stage Fall Detection Architecture */}
          <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-3.5 space-y-2">
            <h3 className="font-bold text-slate-100 flex items-center gap-2 text-xs uppercase tracking-wider text-rose-400">
              <Layers className="w-4 h-4 text-rose-400" />
              4. Fall Detection Algorithm State Machine
            </h3>
            <ol className="list-decimal list-inside text-xs text-slate-300 space-y-1.5 leading-relaxed">
              <li>
                <strong>Stage 1 (Free-Fall):</strong> Acceleration drops below <code className="text-cyan-300">0.60g</code> (near weightlessness during descent).
              </li>
              <li>
                <strong>Stage 2 (Impact):</strong> High impact shock exceeding <code className="text-rose-300">3.20g</code> detected within 500ms of free-fall.
              </li>
              <li>
                <strong>Stage 3 (Stillness Verification):</strong> Accelerometer checks for 2.0s of post-impact immobility (<code className="text-emerald-300">~1.0g</code> with low variance). If wearer walks away, alert aborts.
              </li>
              <li>
                <strong>Stage 4 (Pre-Alarm Countdown):</strong> 10-second countdown with blinking LED &amp; warning beeps. Can be cancelled by physical button (GPIO 5) or the PWA button. If uncancelled, emergency distress siren sounds!
              </li>
            </ol>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/95 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs tracking-wide shadow-md"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
