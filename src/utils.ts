/**
 * Simple glob pattern matching
 * Supports: * (any chars), ? (single char)
 * @example matchPattern('*.exe', 'file.exe') => true
 * @example matchPattern('*logout*', '/user/logout?redirect=home') => true
 */
export function matchPattern(pattern: string, value: string): boolean {
  // Convert glob to regex
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
    .replace(/\*/g, '.*') // * -> .*
    .replace(/\?/g, '.'); // ? -> .

  const regex = new RegExp(`^${escaped}$`, 'i');
  return regex.test(value);
}

/**
 * Check if URL matches any exclusion pattern
 */
export function matchesAnyPattern(url: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchPattern(pattern, url));
}

/**
 * Check if hostname matches domain pattern
 * @example matchDomain('example.com', 'example.com') => true
 * @example matchDomain('*.example.com', 'sub.example.com') => true
 * @example matchDomain('*.example.com', 'example.com') => false
 */
export function matchDomain(pattern: string, hostname: string): boolean {
  const p = pattern.toLowerCase();
  const h = hostname.toLowerCase();

  if (p.startsWith('*.')) {
    const base = p.slice(2);
    return h === base || h.endsWith('.' + base);
  }

  return h === p;
}

/**
 * Parse URL safely
 */
export function parseUrl(url: string, base?: string): URL | null {
  try {
    return new URL(url, base || (typeof window !== 'undefined' ? window.location.origin : undefined));
  } catch {
    return null;
  }
}

/**
 * Get query params as object
 */
export function getQueryParams(search: string): Record<string, string> {
  const params: Record<string, string> = {};
  new URLSearchParams(search).forEach((v, k) => {
    params[k] = v;
  });
  return params;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

/**
 * Extract root domain from hostname
 * @example getRootDomain('app.aicw.io') => 'aicw.io'
 * @example getRootDomain('sub.example.co.uk') => 'example.co.uk'
 */
export function getRootDomain(hostname: string): string {
  // Handle localhost and IP addresses
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return hostname;
  }

  const parts = hostname.split('.');

  // Single part (e.g., 'localhost') - return as-is
  if (parts.length <= 1) {
    return hostname;
  }

  // Handle known 2-part TLDs (e.g., .co.uk, .com.au)
  const knownDoubleTlds = ['co.uk', 'com.au', 'co.nz', 'com.br', 'co.jp', 'org.uk', 'net.au'];
  const lastTwo = parts.slice(-2).join('.');

  if (knownDoubleTlds.includes(lastTwo) && parts.length > 2) {
    return parts.slice(-3).join('.');
  }

  // Standard: last 2 parts (e.g., aicw.io, example.com)
  return parts.slice(-2).join('.');
}
