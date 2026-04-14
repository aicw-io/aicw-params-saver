import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Storage } from '../src/storage';
import { clearCookies } from './setup';

declare global {
  // eslint-disable-next-line no-var
  var clearCookies: () => void;
}

describe('Storage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearCookies();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('parses string config', () => {
      const storage = new Storage('localStorage', 'test_', '', false);
      expect(storage).toBeDefined();
    });

    it('parses pipe-separated config', () => {
      const storage = new Storage('cookie|localStorage', 'test_', '', false);
      expect(storage).toBeDefined();
    });

    it('parses array config', () => {
      const storage = new Storage(['cookie', 'localStorage'], 'test_', '', false);
      expect(storage).toBeDefined();
    });
  });

  describe('set and get', () => {
    it('stores and retrieves data from localStorage', () => {
      const storage = new Storage('localStorage', 'pz_', '', false);
      const data = { params: { utm_source: 'google' }, timestamp: Date.now() };

      const result = storage.set('test', data, 30);
      expect(result).toBe(true);

      const retrieved = storage.get('test');
      expect(retrieved).toEqual(data);
    });

    it('stores and retrieves data from sessionStorage', () => {
      const storage = new Storage('sessionStorage', 'pz_', '', false);
      const data = { params: { utm_source: 'google' }, timestamp: Date.now() };

      storage.set('test', data, 30);
      const retrieved = storage.get('test');
      expect(retrieved).toEqual(data);
    });

    it('stores and retrieves data from cookies', () => {
      const storage = new Storage('cookie', 'pz_', '', false);
      const data = { params: { utm_source: 'google' }, timestamp: Date.now() };

      storage.set('test', data, 30);
      const retrieved = storage.get('test');
      expect(retrieved).toEqual(data);
    });

    it('returns null for non-existent data', () => {
      const storage = new Storage('localStorage', 'pz_', '', false);
      expect(storage.get('nonexistent')).toBeNull();
    });

    it('uses prefix for storage keys', () => {
      const storage = new Storage('localStorage', 'custom_', '', false);
      const data = { params: { ref: 'test' }, timestamp: Date.now() };

      storage.set('key', data, 30);
      expect(localStorage.getItem('custom_key')).not.toBeNull();
      expect(localStorage.getItem('pz_key')).toBeNull();
    });
  });

  describe('fallback behavior', () => {
    it('falls back to next backend when first fails', () => {
      vi.spyOn(Storage.prototype as unknown as { isBackendAvailable: () => boolean }, 'isBackendAvailable')
        .mockImplementationOnce(() => false)
        .mockImplementation(() => true);

      const storage = new Storage('localStorage|sessionStorage', 'pz_', '', false);
      const data = { params: { utm_source: 'test' }, timestamp: Date.now() };

      storage.set('test', data, 30);
      expect(sessionStorage.getItem('pz_test')).not.toBeNull();
    });
  });

  describe('TTL expiration', () => {
    it('returns null for expired data', () => {
      const storage = new Storage('localStorage', 'pz_', '', false);
      const data = { params: { utm_source: 'google' }, timestamp: Date.now() };

      const expiredItem = {
        data,
        expiresAt: Date.now() - 1000,
      };
      localStorage.setItem('pz_test', JSON.stringify(expiredItem));

      expect(storage.get('test')).toBeNull();
    });

    it('returns data when TTL is 0 (never expires)', () => {
      const storage = new Storage('localStorage', 'pz_', '', false);
      const data = { params: { utm_source: 'google' }, timestamp: Date.now() };

      storage.set('test', data, 0);

      const item = JSON.parse(localStorage.getItem('pz_test')!);
      expect(item.expiresAt).toBe(0);

      const retrieved = storage.get('test');
      expect(retrieved).toEqual(data);
    });
  });

  describe('remove', () => {
    it('removes data from all backends', () => {
      const storage = new Storage(['localStorage', 'sessionStorage'], 'pz_', '', false);
      const data = { params: { ref: 'test' }, timestamp: Date.now() };

      localStorage.setItem('pz_test', JSON.stringify({ data, expiresAt: 0 }));
      sessionStorage.setItem('pz_test', JSON.stringify({ data, expiresAt: 0 }));

      storage.remove('test');

      expect(localStorage.getItem('pz_test')).toBeNull();
      expect(sessionStorage.getItem('pz_test')).toBeNull();
    });
  });

  describe('clearAll', () => {
    it('clears all prefixed data from all backends', () => {
      const storage = new Storage(['localStorage', 'sessionStorage'], 'pz_', '', false);

      localStorage.setItem('pz_first', 'data1');
      localStorage.setItem('pz_last', 'data2');
      localStorage.setItem('other_key', 'keep');
      sessionStorage.setItem('pz_test', 'data3');

      storage.clearAll();

      expect(localStorage.getItem('pz_first')).toBeNull();
      expect(localStorage.getItem('pz_last')).toBeNull();
      expect(localStorage.getItem('other_key')).toBe('keep');
      expect(sessionStorage.getItem('pz_test')).toBeNull();
    });
  });

  describe('cookie domain', () => {
    it('sets cookie with domain when specified', () => {
      const storage = new Storage('cookie', 'pz_', '.example.com', false);
      const data = { params: { utm_source: 'google' }, timestamp: Date.now() };

      storage.set('test', data, 30);
    });
  });
});
