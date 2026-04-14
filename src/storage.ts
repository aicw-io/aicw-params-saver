import { StorageConfig, StorageType, ParamData } from './types';

interface StoredItem {
  data: ParamData;
  expiresAt: number; // 0 = never
}

/**
 * Unified storage adapter with fallback support
 */
export class Storage {
  private backends: StorageType[];
  private prefix: string;
  private cookieDomain: string;
  private debugEnabled: boolean;

  constructor(config: StorageConfig, prefix: string, allowedDomains: string[], debug: boolean) {
    this.backends = this.parseStorageConfig(config);
    this.prefix = prefix;
    // Use first allowedDomain as cookie domain (for cross-subdomain cookies)
    this.cookieDomain = allowedDomains[0] || '';
    this.debugEnabled = debug;

    this.log(`Initialized with backends: ${this.backends.join(' -> ')}`);
  }

  /**
   * Parse storage config into ordered array of backends
   * Supports: 'localStorage', 'cookie|localStorage', ['cookie', 'localStorage']
   */
  private parseStorageConfig(config: StorageConfig): StorageType[] {
    if (Array.isArray(config)) {
      return config;
    }
    if (typeof config === 'string' && config.includes('|')) {
      return config.split('|').map((s) => s.trim() as StorageType);
    }
    return [config as StorageType];
  }

  private log(msg: string, ...args: unknown[]): void {
    if (this.debugEnabled) console.log(`[ParamsSaver:Storage] ${msg}`, ...args);
  }

  private key(name: string): string {
    return `${this.prefix}${name}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // BACKEND-SPECIFIC OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  private isBackendAvailable(backend: StorageType): boolean {
    try {
      switch (backend) {
        case 'localStorage':
          localStorage.setItem('__pz_test__', '1');
          localStorage.removeItem('__pz_test__');
          return true;
        case 'sessionStorage':
          sessionStorage.setItem('__pz_test__', '1');
          sessionStorage.removeItem('__pz_test__');
          return true;
        case 'cookie':
          document.cookie = '__pz_test__=1';
          const hasCookie = document.cookie.includes('__pz_test__');
          document.cookie = '__pz_test__=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          return hasCookie;
      }
    } catch {
      return false;
    }
    return false;
  }

  private setToBackend(backend: StorageType, key: string, item: StoredItem): boolean {
    const value = JSON.stringify(item);

    try {
      switch (backend) {
        case 'localStorage':
          localStorage.setItem(key, value);
          return true;
        case 'sessionStorage':
          sessionStorage.setItem(key, value);
          return true;
        case 'cookie':
          if (value.length > 4000) {
            this.log('Data too large for cookie');
            return false;
          }
          let cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
          if (item.expiresAt > 0) {
            cookie += `; expires=${new Date(item.expiresAt).toUTCString()}`;
          }
          if (this.cookieDomain) {
            cookie += `; domain=${this.cookieDomain}`;
          }
          document.cookie = cookie;
          return true;
      }
    } catch (e) {
      this.log(`Failed to write to ${backend}:`, e);
      return false;
    }
    return false;
  }

  private getFromBackend(backend: StorageType, key: string): StoredItem | null {
    try {
      let raw: string | null = null;

      switch (backend) {
        case 'localStorage':
          raw = localStorage.getItem(key);
          break;
        case 'sessionStorage':
          raw = sessionStorage.getItem(key);
          break;
        case 'cookie':
          const match = document.cookie.match(new RegExp(`(?:^|; )${encodeURIComponent(key)}=([^;]*)`));
          raw = match ? decodeURIComponent(match[1]) : null;
          break;
      }

      if (!raw) return null;

      const item: StoredItem = JSON.parse(raw);

      // Check expiration
      if (item.expiresAt > 0 && Date.now() > item.expiresAt) {
        this.log(`Data expired in ${backend}`);
        this.removeFromBackend(backend, key);
        return null;
      }

      return item;
    } catch (e) {
      this.log(`Failed to read from ${backend}:`, e);
      return null;
    }
  }

  private removeFromBackend(backend: StorageType, key: string): void {
    try {
      switch (backend) {
        case 'localStorage':
          localStorage.removeItem(key);
          break;
        case 'sessionStorage':
          sessionStorage.removeItem(key);
          break;
        case 'cookie':
          let cookie = `${encodeURIComponent(key)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
          if (this.cookieDomain) {
            cookie += `; domain=${this.cookieDomain}`;
          }
          document.cookie = cookie;
          break;
      }
    } catch (e) {
      this.log(`Failed to remove from ${backend}:`, e);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════

  /**
   * Store data - writes to FIRST available backend
   */
  set(name: string, data: ParamData, ttlDays: number): boolean {
    const key = this.key(name);
    const item: StoredItem = {
      data,
      expiresAt: ttlDays > 0 ? Date.now() + ttlDays * 86400000 : 0,
    };

    for (const backend of this.backends) {
      if (this.isBackendAvailable(backend)) {
        if (this.setToBackend(backend, key, item)) {
          this.log(`Stored '${name}' in ${backend}`);
          return true;
        }
      }
    }

    this.log(`Failed to store '${name}' - no available backend`);
    return false;
  }

  /**
   * Retrieve data - returns from FIRST backend that has it
   */
  get(name: string): ParamData | null {
    const key = this.key(name);

    for (const backend of this.backends) {
      if (!this.isBackendAvailable(backend)) continue;

      const item = this.getFromBackend(backend, key);
      if (item) {
        this.log(`Retrieved '${name}' from ${backend}`);
        return item.data;
      }
    }

    return null;
  }

  /**
   * Remove data from ALL backends
   */
  remove(name: string): void {
    const key = this.key(name);

    for (const backend of this.backends) {
      this.removeFromBackend(backend, key);
    }

    this.log(`Removed '${name}' from all backends`);
  }

  /**
   * Clear all stored data from ALL backends
   */
  clearAll(): void {
    // localStorage
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // Ignore errors
    }

    // sessionStorage
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(this.prefix)) {
          sessionStorage.removeItem(key);
        }
      }
    } catch {
      // Ignore errors
    }

    // cookies
    try {
      document.cookie.split(';').forEach((c) => {
        const name = c.split('=')[0].trim();
        if (decodeURIComponent(name).startsWith(this.prefix)) {
          this.removeFromBackend('cookie', decodeURIComponent(name));
        }
      });
    } catch {
      // Ignore errors
    }

    this.log('Cleared all data');
  }
}
