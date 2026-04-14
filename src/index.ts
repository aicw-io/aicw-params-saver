import { ParamsSaverConfig, ParamsSaverAPI, ParamData } from './types';
import { DEFAULT_CONFIG, STORAGE_PREFIX } from './config';
import { Storage } from './storage';
import { ParamCapture } from './capture';
import { LinkDecorator } from './decorator';
import { DynamicObserver } from './observer';

const STORAGE_KEY = 'params';

class ParamsSaver implements ParamsSaverAPI {
  private config: ParamsSaverConfig = { ...DEFAULT_CONFIG };
  private storage: Storage | null = null;
  private paramCapture: ParamCapture | null = null;
  private decorator: LinkDecorator | null = null;
  private observer: DynamicObserver | null = null;

  private log(msg: string, ...args: unknown[]): void {
    if (this.config.debug) console.log(`[ParamsSaver] ${msg}`, ...args);
  }

  init(userConfig?: Partial<ParamsSaverConfig>): void {
    try {
      this.config = { ...DEFAULT_CONFIG, ...userConfig };
      this.log('Initializing with config:', this.config);

      // Initialize components
      this.storage = new Storage(
        this.config.storage,
        STORAGE_PREFIX,
        this.config.allowedDomains,
        this.config.debug
      );
      this.paramCapture = new ParamCapture(this.config);
      this.decorator = new LinkDecorator(this.config);
      this.observer = new DynamicObserver(this.config, this.decorator, () => this.getParams());

      // Process current page
      this.processPage();

      // Start dynamic observation
      this.observer.start();

      this.log('Initialized');
    } catch (e) {
      this.log('Error in init:', e);
    }
  }

  private processPage(): void {
    // 1. Capture params from URL
    this.captureInternal();

    // 2. Decorate links with stored params
    this.decorator?.decorateAll(this.getParams());
  }

  private captureInternal(): ParamData | null {
    if (!this.paramCapture || !this.storage) return null;

    const newData = this.paramCapture.capture();
    if (!newData) return null;

    const existing = this.storage.get(STORAGE_KEY);
    let isFirstTouch = !existing;
    let finalData: ParamData;

    if (!existing) {
      // First visit - store new params
      finalData = newData;
    } else if (this.config.mergeParams) {
      // Merge mode - append unique values
      finalData = {
        params: this.mergeParamValues(existing.params, newData.params),
        timestamp: existing.timestamp, // Keep original timestamp
      };
    } else {
      // Pure first-touch - ignore new params
      this.log('First-touch mode: keeping original params');
      return null;
    }

    this.storage.set(STORAGE_KEY, finalData, this.config.ttl);

    // Call onCapture callback
    this.config.onCapture?.(finalData.params, isFirstTouch);

    return finalData;
  }

  /**
   * Merge new param values into existing, maintaining unique values in original order
   * Example: existing="google|facebook", new="medium" -> "google|facebook|medium"
   */
  private mergeParamValues(
    existing: Record<string, string>,
    newParams: Record<string, string>
  ): Record<string, string> {
    const result = { ...existing };

    for (const [key, newValue] of Object.entries(newParams)) {
      const existingValue = result[key];
      if (!existingValue) {
        result[key] = newValue;
      } else {
        // Split existing into array, add new value if not present
        const values = existingValue.split('|');
        if (!values.includes(newValue)) {
          values.push(newValue);
          result[key] = values.join('|');
        }
      }
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════

  getParams(): Record<string, string> {
    const data = this.storage?.get(STORAGE_KEY);
    return data?.params ?? {};
  }

  getParam(name: string): string | null {
    return this.getParams()[name] ?? null;
  }

  clear(): void {
    this.storage?.clearAll();
    this.decorator?.reset();
    this.log('Cleared all data');
  }
}

// Singleton instance
const paramsSaver = new ParamsSaver();

// Auto-init from script tag attributes (always runs)
if (typeof document !== 'undefined') {
  const autoInit = () => {
    const script = document.currentScript as HTMLScriptElement | null;
    let config: Partial<ParamsSaverConfig> = {};

    if (script) {
      // 1. Parse JSON config first (lowest priority)
      const configAttr = script.getAttribute('data-config');
      if (configAttr) {
        try {
          config = JSON.parse(configAttr);
        } catch {
          // Ignore parse errors
        }
      }

      // 2. Parse individual data-* attributes (override JSON config)

      // Boolean: debug
      if (script.dataset.debug === 'true') {
        config.debug = true;
      }

      // Boolean: mergeParams
      if (script.dataset.mergeParams === 'true') {
        config.mergeParams = true;
      }

      // String: storage
      if (script.dataset.storage) {
        config.storage = script.dataset.storage;
      }

      // Array: params (comma-separated, uses startsWith matching)
      if (script.dataset.params) {
        config.params = script.dataset.params
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      }

      // Array: allowed-domains (comma-separated domains)
      if (script.dataset.allowedDomains) {
        config.allowedDomains = script.dataset.allowedDomains
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      }

      // Array: exclude-patterns (comma-separated URL patterns)
      if (script.dataset.excludePatterns) {
        config.excludePatterns = script.dataset.excludePatterns
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      }
    }

    paramsSaver.init(config);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
}

// Expose globally
if (typeof window !== 'undefined') {
  (window as unknown as { ParamsSaver: ParamsSaver }).ParamsSaver = paramsSaver;
}

export default paramsSaver;
export { ParamsSaver, ParamsSaverConfig, ParamsSaverAPI, ParamData };
