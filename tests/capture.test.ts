import { describe, it, expect, beforeEach } from 'vitest';
import { ParamCapture } from '../src/capture';
import { DEFAULT_CONFIG } from '../src/config';
import { ParamsSaverConfig } from '../src/types';

describe('ParamCapture', () => {
  let config: ParamsSaverConfig;

  beforeEach(() => {
    config = { ...DEFAULT_CONFIG };
    Object.defineProperty(window, 'location', {
      value: {
        search: '',
        href: 'http://localhost/',
        origin: 'http://localhost',
        hostname: 'localhost',
      },
      writable: true,
    });
  });

  describe('shouldCapture (startsWith matching)', () => {
    it('captures params matching patterns', () => {
      config.params = ['utm_', 'pk_'];
      const capture = new ParamCapture(config);

      expect(capture.shouldCapture('utm_source')).toBe(true);
      expect(capture.shouldCapture('utm_medium')).toBe(true);
      expect(capture.shouldCapture('pk_campaign')).toBe(true);
      expect(capture.shouldCapture('other_param')).toBe(false);
    });

    it('captures exact matches via startsWith', () => {
      config.params = ['gclid', 'fbclid'];
      const capture = new ParamCapture(config);

      expect(capture.shouldCapture('gclid')).toBe(true);
      expect(capture.shouldCapture('fbclid')).toBe(true);
      expect(capture.shouldCapture('other')).toBe(false);
    });

    it('captures mixed prefixes and exact names', () => {
      config.params = ['utm_', 'gclid'];
      const capture = new ParamCapture(config);

      expect(capture.shouldCapture('utm_source')).toBe(true);
      expect(capture.shouldCapture('utm_medium')).toBe(true);
      expect(capture.shouldCapture('gclid')).toBe(true);
      expect(capture.shouldCapture('other')).toBe(false);
    });
  });

  describe('capture', () => {
    it('captures params from URL', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?utm_source=google&utm_medium=cpc&gclid=abc123',
          href: 'http://localhost/?utm_source=google&utm_medium=cpc&gclid=abc123',
          origin: 'http://localhost',
          hostname: 'localhost',
        },
        writable: true,
      });

      config.params = ['utm_', 'gclid'];
      const capture = new ParamCapture(config);

      const result = capture.capture();

      expect(result).not.toBeNull();
      expect(result!.params).toEqual({
        utm_source: 'google',
        utm_medium: 'cpc',
        gclid: 'abc123',
      });
      expect(result!.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('returns null when no matching params', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?other=value',
          href: 'http://localhost/?other=value',
          origin: 'http://localhost',
          hostname: 'localhost',
        },
        writable: true,
      });

      config.params = ['utm_'];
      const capture = new ParamCapture(config);

      expect(capture.capture()).toBeNull();
    });

    it('ignores empty param values', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?utm_source=&utm_medium=cpc',
          href: 'http://localhost/?utm_source=&utm_medium=cpc',
          origin: 'http://localhost',
          hostname: 'localhost',
        },
        writable: true,
      });

      config.params = ['utm_'];
      const capture = new ParamCapture(config);

      const result = capture.capture();

      expect(result).not.toBeNull();
      expect(result!.params).toEqual({
        utm_medium: 'cpc',
      });
      expect(result!.params.utm_source).toBeUndefined();
    });
  });

  describe('hasParams', () => {
    it('returns true when URL has capturable params', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?utm_source=google',
          href: 'http://localhost/?utm_source=google',
          origin: 'http://localhost',
          hostname: 'localhost',
        },
        writable: true,
      });

      config.params = ['utm_'];
      const capture = new ParamCapture(config);

      expect(capture.hasParams()).toBe(true);
    });

    it('returns false when URL has no capturable params', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?other=value',
          href: 'http://localhost/?other=value',
          origin: 'http://localhost',
          hostname: 'localhost',
        },
        writable: true,
      });

      config.params = ['utm_'];
      const capture = new ParamCapture(config);

      expect(capture.hasParams()).toBe(false);
    });
  });
});
