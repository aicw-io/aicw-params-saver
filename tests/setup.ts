// Setup file for vitest - mock localStorage, sessionStorage, and document.cookie

class MockStorage implements Storage {
  private store: Map<string, string> = new Map();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

// Replace global localStorage and sessionStorage
Object.defineProperty(globalThis, 'localStorage', {
  value: new MockStorage(),
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, 'sessionStorage', {
  value: new MockStorage(),
  writable: true,
  configurable: true,
});

// Mock document.cookie
let cookies: Record<string, string> = {};

Object.defineProperty(document, 'cookie', {
  get: function () {
    return Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  },
  set: function (value: string) {
    const [pair] = value.split(';');
    const [key, val] = pair.split('=').map((s) => s.trim());
    if (val === '' || value.includes('expires=Thu, 01 Jan 1970')) {
      delete cookies[decodeURIComponent(key)];
    } else {
      cookies[decodeURIComponent(key)] = decodeURIComponent(val || '');
    }
  },
  configurable: true,
});

// Helper to clear cookies between tests
export function clearCookies() {
  cookies = {};
}

// Make clearCookies available globally for tests
(globalThis as unknown as { clearCookies: typeof clearCookies }).clearCookies = clearCookies;
