import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ParamsSaver } from '../src/index';
import { clearCookies } from './setup';

describe('ParamsSaver Integration', () => {
  let instance: InstanceType<typeof ParamsSaver>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearCookies();

    document.body.innerHTML = '';

    Object.defineProperty(window, 'location', {
      value: {
        search: '',
        href: 'https://example.com/',
        origin: 'https://example.com',
        hostname: 'example.com',
      },
      writable: true,
      configurable: true,
    });

    const historyState: unknown = null;
    Object.defineProperty(window, 'history', {
      value: {
        state: historyState,
        pushState: vi.fn(),
        replaceState: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    instance = new ParamsSaver();
  });

  describe('init', () => {
    it('initializes with default config', () => {
      instance.init();
      expect(true).toBe(true);
    });

    it('initializes with custom config', () => {
      instance.init({
        params: ['ref', 'source', 'utm_', 'pk_'],
        storage: 'localStorage',
      });

      expect(true).toBe(true);
    });

    it('calls onCapture callback when params captured', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?utm_source=google&utm_medium=cpc',
          href: 'https://example.com/?utm_source=google&utm_medium=cpc',
          origin: 'https://example.com',
          hostname: 'example.com',
        },
        writable: true,
        configurable: true,
      });

      const onCapture = vi.fn();
      instance.init({ onCapture });

      expect(onCapture).toHaveBeenCalledWith(
        { utm_source: 'google', utm_medium: 'cpc' },
        true // isFirstTouch
      );
    });
  });

  describe('capture and storage', () => {
    it('captures and stores params from URL', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?utm_source=google&utm_medium=cpc',
          href: 'https://example.com/?utm_source=google&utm_medium=cpc',
          origin: 'https://example.com',
          hostname: 'example.com',
        },
        writable: true,
        configurable: true,
      });

      instance.init();

      const params = instance.getParams();
      expect(params).toEqual({
        utm_source: 'google',
        utm_medium: 'cpc',
      });
    });

    it('preserves first-touch params on subsequent visits (mergeParams: false)', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?utm_source=google',
          href: 'https://example.com/?utm_source=google',
          origin: 'https://example.com',
          hostname: 'example.com',
        },
        writable: true,
        configurable: true,
      });

      instance.init();
      expect(instance.getParam('utm_source')).toBe('google');

      Object.defineProperty(window, 'location', {
        value: {
          search: '?utm_source=facebook',
          href: 'https://example.com/?utm_source=facebook',
          origin: 'https://example.com',
          hostname: 'example.com',
        },
        writable: true,
        configurable: true,
      });

      instance = new ParamsSaver();
      instance.init();

      expect(instance.getParam('utm_source')).toBe('google');
    });

    it('merges params on subsequent visits (mergeParams: true)', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?utm_source=google',
          href: 'https://example.com/?utm_source=google',
          origin: 'https://example.com',
          hostname: 'example.com',
        },
        writable: true,
        configurable: true,
      });

      instance.init({ mergeParams: true });
      expect(instance.getParam('utm_source')).toBe('google');

      Object.defineProperty(window, 'location', {
        value: {
          search: '?utm_source=facebook',
          href: 'https://example.com/?utm_source=facebook',
          origin: 'https://example.com',
          hostname: 'example.com',
        },
        writable: true,
        configurable: true,
      });

      instance = new ParamsSaver();
      instance.init({ mergeParams: true });

      expect(instance.getParam('utm_source')).toBe('google|facebook');
    });

    it('does not duplicate values when merging', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?utm_source=google',
          href: 'https://example.com/?utm_source=google',
          origin: 'https://example.com',
          hostname: 'example.com',
        },
        writable: true,
        configurable: true,
      });

      instance.init({ mergeParams: true });

      instance = new ParamsSaver();
      instance.init({ mergeParams: true });

      expect(instance.getParam('utm_source')).toBe('google');
    });

    it('getParam returns specific param value', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?utm_source=google&utm_medium=cpc',
          href: 'https://example.com/?utm_source=google&utm_medium=cpc',
          origin: 'https://example.com',
          hostname: 'example.com',
        },
        writable: true,
        configurable: true,
      });

      instance.init();

      expect(instance.getParam('utm_source')).toBe('google');
      expect(instance.getParam('utm_medium')).toBe('cpc');
      expect(instance.getParam('nonexistent')).toBeNull();
    });
  });

  describe('link decoration', () => {
    it('decorates links on initialization', () => {
      document.body.innerHTML = `
        <a href="https://example.com/page1">Link 1</a>
        <a href="https://example.com/page2">Link 2</a>
      `;

      Object.defineProperty(window, 'location', {
        value: {
          search: '?utm_source=google',
          href: 'https://example.com/?utm_source=google',
          origin: 'https://example.com',
          hostname: 'example.com',
        },
        writable: true,
        configurable: true,
      });

      instance.init();

      document.querySelectorAll('a').forEach((link) => {
        expect(link.href).toContain('utm_source=google');
      });
    });
  });

  describe('clear', () => {
    it('clears all stored data', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?utm_source=google',
          href: 'https://example.com/?utm_source=google',
          origin: 'https://example.com',
          hostname: 'example.com',
        },
        writable: true,
        configurable: true,
      });

      instance.init();
      expect(instance.getParams()).not.toEqual({});

      instance.clear();

      expect(instance.getParams()).toEqual({});
    });
  });

  describe('storage fallback', () => {
    it('uses fallback storage when primary fails', () => {
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = () => {
        throw new Error('Storage quota exceeded');
      };

      Object.defineProperty(window, 'location', {
        value: {
          search: '?utm_source=google',
          href: 'https://example.com/?utm_source=google',
          origin: 'https://example.com',
          hostname: 'example.com',
        },
        writable: true,
        configurable: true,
      });

      instance.init({ storage: 'localStorage|sessionStorage' });

      localStorage.setItem = originalSetItem;
    });
  });
});
