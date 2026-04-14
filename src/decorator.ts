import { ParamsSaverConfig } from './types';
import { EXCLUDE_SELECTOR } from './config';
import { parseUrl, matchDomain, matchesAnyPattern, getRootDomain } from './utils';

export class LinkDecorator {
  private config: ParamsSaverConfig;
  private decorated: WeakSet<HTMLAnchorElement> = new WeakSet();

  constructor(config: ParamsSaverConfig) {
    this.config = config;
  }

  private log(msg: string, ...args: unknown[]): void {
    if (this.config.debug) console.log(`[ParamsSaver:Decorator] ${msg}`, ...args);
  }

  /**
   * Decorate all links on page
   * @returns Number of links decorated
   */
  decorateAll(params: Record<string, string>): number {
    if (Object.keys(params).length === 0) return 0;

    const links = document.querySelectorAll<HTMLAnchorElement>('a[href]');
    let count = 0;

    links.forEach((link) => {
      if (this.decorateLink(link, params)) count++;
    });

    this.log(`Decorated ${count} links`);
    return count;
  }

  /**
   * Decorate a single link
   */
  decorateLink(link: HTMLAnchorElement, params: Record<string, string>): boolean {
    // Skip if already processed
    if (this.decorated.has(link)) return false;

    const href = link.getAttribute('href');
    if (!href) return false;

    // Skip special protocols (non-http links that shouldn't have params appended)
    if (/^(mailto:|tel:|javascript:|data:|blob:|file:|ftp:|sms:|whatsapp:|skype:|facetime:|#)/.test(href)) {
      return false;
    }

    // Check exclusion selector
    if (link.matches(EXCLUDE_SELECTOR)) {
      this.log('Link excluded by selector:', href);
      return false;
    }

    // Check exclusion patterns
    if (matchesAnyPattern(href, this.config.excludePatterns)) {
      this.log('Link excluded by pattern:', href);
      return false;
    }

    // Parse URL
    const url = parseUrl(href);
    if (!url) return false;

    // Check domain allowlist
    if (!this.isDomainAllowed(url.hostname)) {
      this.log('Domain not allowed:', url.hostname);
      return false;
    }

    // Add params to URL (skip if param already exists)
    const newHref = this.addParamsToUrl(url, params);

    if (newHref !== href) {
      link.setAttribute('href', newHref);
      this.decorated.add(link);
      this.log('Decorated:', href, '->', newHref);
      return true;
    }

    return false;
  }

  /**
   * Check if domain is in allowlist
   */
  private isDomainAllowed(hostname: string): boolean {
    const patterns = this.config.allowedDomains;

    // If no patterns, allow current domain + all subdomains of root domain
    if (patterns.length === 0) {
      const currentHost = window.location.hostname;
      const rootDomain = getRootDomain(currentHost);
      const targetLower = hostname.toLowerCase();
      const rootLower = rootDomain.toLowerCase();

      // Allow: exact match, root domain, or any subdomain of root
      return (
        targetLower === currentHost.toLowerCase() ||
        targetLower === rootLower ||
        targetLower.endsWith('.' + rootLower)
      );
    }

    return patterns.some((p) => matchDomain(p, hostname));
  }

  /**
   * Add params to URL - skip if param already exists
   */
  private addParamsToUrl(url: URL, params: Record<string, string>): string {
    Object.entries(params).forEach(([key, value]) => {
      // Only add if doesn't exist
      if (url.searchParams.get(key) === null) {
        url.searchParams.set(key, value);
      }
    });

    return url.toString();
  }

  /**
   * Reset decorated links tracking
   */
  reset(): void {
    this.decorated = new WeakSet();
  }
}
