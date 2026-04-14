import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LinkDecorator } from '../src/decorator';
import { DEFAULT_CONFIG } from '../src/config';
import { ParamsSaverConfig } from '../src/types';

describe('LinkDecorator', () => {
  let config: ParamsSaverConfig;
  let decorator: LinkDecorator;

  beforeEach(() => {
    config = { ...DEFAULT_CONFIG, debug: false };
    decorator = new LinkDecorator(config);

    document.body.innerHTML = '';

    Object.defineProperty(window, 'location', {
      value: {
        hostname: 'example.com',
        origin: 'https://example.com',
        href: 'https://example.com/',
      },
      writable: true,
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('decorateLink', () => {
    it('decorates internal link with params', () => {
      const link = document.createElement('a');
      link.href = 'https://example.com/page';
      document.body.appendChild(link);

      const params = { utm_source: 'google', utm_medium: 'cpc' };
      const result = decorator.decorateLink(link, params);

      expect(result).toBe(true);
      expect(link.href).toContain('utm_source=google');
      expect(link.href).toContain('utm_medium=cpc');
    });

    it('skips links with special protocols', () => {
      const protocols = ['mailto:test@example.com', 'tel:1234567890', 'javascript:void(0)', '#anchor'];

      protocols.forEach((href) => {
        const link = document.createElement('a');
        link.href = href;
        document.body.appendChild(link);

        const result = decorator.decorateLink(link, { utm_source: 'test' });
        expect(result).toBe(false);
      });
    });

    it('skips links matching exclude selector (hardcoded)', () => {
      const link1 = document.createElement('a');
      link1.href = 'https://example.com/page';
      link1.className = 'pz-ignore';
      document.body.appendChild(link1);

      const link2 = document.createElement('a');
      link2.href = 'https://example.com/page';
      link2.setAttribute('data-pz-ignore', '');
      document.body.appendChild(link2);

      expect(decorator.decorateLink(link1, { utm_source: 'test' })).toBe(false);
      expect(decorator.decorateLink(link2, { utm_source: 'test' })).toBe(false);
    });

    it('skips links matching exclude patterns', () => {
      config.excludePatterns = ['*.exe', '*.pdf', '*logout*'];
      decorator = new LinkDecorator(config);

      const testCases = [
        { href: 'https://example.com/file.exe', shouldDecorate: false },
        { href: 'https://example.com/document.pdf', shouldDecorate: false },
        { href: 'https://example.com/logout', shouldDecorate: false },
        { href: 'https://example.com/user/logout?redirect=home', shouldDecorate: false },
        { href: 'https://example.com/page', shouldDecorate: true },
      ];

      testCases.forEach(({ href, shouldDecorate }) => {
        const link = document.createElement('a');
        link.href = href;
        document.body.appendChild(link);

        const result = decorator.decorateLink(link, { utm_source: 'test' });
        expect(result).toBe(shouldDecorate);
      });
    });

    it('allows subdomains of root domain by default', () => {
      config.allowedDomains = [];
      decorator = new LinkDecorator(config);

      const testCases = [
        { href: 'https://example.com/page', shouldDecorate: true },
        { href: 'https://sub.example.com/page', shouldDecorate: true },
        { href: 'https://app.example.com/page', shouldDecorate: true },
        { href: 'https://other.com/page', shouldDecorate: false },
        { href: 'https://notexample.com/page', shouldDecorate: false },
      ];

      testCases.forEach(({ href, shouldDecorate }) => {
        decorator.reset();
        const link = document.createElement('a');
        link.href = href;
        document.body.appendChild(link);

        const result = decorator.decorateLink(link, { utm_source: 'test' });
        expect(result).toBe(shouldDecorate);
      });
    });

    it('respects explicit allowedDomains over auto-detection', () => {
      config.allowedDomains = ['example.com', 'partner.com', '*.example.com'];
      decorator = new LinkDecorator(config);

      const testCases = [
        { href: 'https://example.com/page', shouldDecorate: true },
        { href: 'https://partner.com/page', shouldDecorate: true },
        { href: 'https://sub.example.com/page', shouldDecorate: true },
        { href: 'https://other.com/page', shouldDecorate: false },
      ];

      testCases.forEach(({ href, shouldDecorate }) => {
        decorator.reset();
        const link = document.createElement('a');
        link.href = href;
        document.body.appendChild(link);

        const result = decorator.decorateLink(link, { utm_source: 'test' });
        expect(result).toBe(shouldDecorate);
      });
    });

    it('skips existing params (always uses skip behavior)', () => {
      const link = document.createElement('a');
      link.href = 'https://example.com/page?utm_source=existing';
      document.body.appendChild(link);

      decorator.decorateLink(link, { utm_source: 'new', utm_medium: 'test' });

      expect(link.href).toContain('utm_source=existing');
      expect(link.href).toContain('utm_medium=test');
    });

    it('does not decorate same link twice', () => {
      const link = document.createElement('a');
      link.href = 'https://example.com/page';
      document.body.appendChild(link);

      decorator.decorateLink(link, { utm_source: 'first' });
      const firstHref = link.href;

      decorator.decorateLink(link, { utm_source: 'second' });

      expect(link.href).toBe(firstHref);
    });
  });

  describe('decorateAll', () => {
    it('decorates all matching links', () => {
      document.body.innerHTML = `
        <a href="https://example.com/page1">Link 1</a>
        <a href="https://example.com/page2">Link 2</a>
        <a href="https://example.com/page3">Link 3</a>
      `;

      const count = decorator.decorateAll({ utm_source: 'test' });

      expect(count).toBe(3);

      document.querySelectorAll('a').forEach((link) => {
        expect(link.href).toContain('utm_source=test');
      });
    });

    it('returns 0 when no params provided', () => {
      document.body.innerHTML = `<a href="https://example.com/page">Link</a>`;

      const count = decorator.decorateAll({});
      expect(count).toBe(0);
    });
  });

  describe('reset', () => {
    it('allows re-decoration of previously decorated links', () => {
      const link = document.createElement('a');
      link.href = 'https://example.com/page';
      document.body.appendChild(link);

      decorator.decorateLink(link, { utm_source: 'first' });
      expect(link.href).toContain('utm_source=first');

      link.href = 'https://example.com/page';
      decorator.decorateLink(link, { utm_source: 'second' });
      expect(link.href).not.toContain('utm_source=second');

      decorator.reset();
      link.href = 'https://example.com/page';
      decorator.decorateLink(link, { utm_source: 'third' });
      expect(link.href).toContain('utm_source=third');
    });
  });
});
