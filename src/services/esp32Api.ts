import type { SensorPayload } from '../types';

export interface PollResult {
  data: SensorPayload | null;
  latencyMs: number;
  error?: string;
  isMixedContent?: boolean;
}

export class Esp32ApiService {
  private abortController: AbortController | null = null;

  public isHttpsMixedContent(): boolean {
    return window.location.protocol === 'https:';
  }

  public cleanIp(ipInput: string): string {
    let ip = ipInput.trim();
    if (!ip) return '192.168.4.1';
    // Remove leading http:// or https:// if user pasted a full URL
    ip = ip.replace(/^https?:\/\//i, '');
    // Remove trailing slash
    ip = ip.replace(/\/+$/, '');
    return ip;
  }

  public async fetchData(ipAddress: string, timeoutMs: number = 700): Promise<PollResult> {
    const ip = this.cleanIp(ipAddress);
    const url = `http://${ip}/data`;
    const startTime = performance.now();

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    const timeoutId = window.setTimeout(() => {
      this.abortController?.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        mode: 'cors',
        signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const json = await response.json() as SensorPayload;
      const latencyMs = Math.round(performance.now() - startTime);

      return {
        data: json,
        latencyMs,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = (err as { name?: string })?.name === 'AbortError';
      const latencyMs = Math.round(performance.now() - startTime);
      const isMixed = this.isHttpsMixedContent();

      return {
        data: null,
        latencyMs,
        error: isAbort ? 'Connection timed out' : (err instanceof Error ? err.message : 'Network fetch failed'),
        isMixedContent: isMixed,
      };
    }
  }

  public async cancelAlert(ipAddress: string): Promise<boolean> {
    const ip = this.cleanIp(ipAddress);
    const url = `http://${ip}/cancel`;

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 1200);

      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (err) {
      console.warn('[ESP32 API] /cancel request failed:', err);
      return false;
    }
  }
}

export const esp32Api = new Esp32ApiService();
