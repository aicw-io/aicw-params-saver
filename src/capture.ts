import { ParamsSaverConfig, ParamData } from './types';
import { getQueryParams } from './utils';

export class ParamCapture {
  private config: ParamsSaverConfig;

  constructor(config: ParamsSaverConfig) {
    this.config = config;
  }

  private log(msg: string, ...args: unknown[]): void {
    if (this.config.debug) console.log(`[ParamsSaver:Capture] ${msg}`, ...args);
  }

  /**
   * Check if a param name should be captured (startsWith matching)
   */
  shouldCapture(name: string): boolean {
    return this.config.params.some((pattern) => name.startsWith(pattern));
  }

  /**
   * Capture params from current URL
   */
  capture(): ParamData | null {
    const allParams = getQueryParams(window.location.search);
    const captured: Record<string, string> = {};

    Object.entries(allParams).forEach(([key, value]) => {
      // Only capture non-empty values
      if (value && this.shouldCapture(key)) {
        captured[key] = value;
      }
    });

    if (Object.keys(captured).length === 0) {
      this.log('No matching params in URL');
      return null;
    }

    const data: ParamData = {
      params: captured,
      timestamp: Date.now(),
    };

    this.log('Captured:', captured);
    return data;
  }

  /**
   * Check if current URL has any capturable params
   */
  hasParams(): boolean {
    const allParams = getQueryParams(window.location.search);
    return Object.keys(allParams).some((k) => this.shouldCapture(k));
  }
}
