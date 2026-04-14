import { describe, it, expect } from 'vitest';
import { matchPattern, matchesAnyPattern, matchDomain, parseUrl, getQueryParams, debounce, getRootDomain } from '../src/utils';

describe('matchPattern', () => {
  it('matches exact strings', () => {
    expect(matchPattern('hello', 'hello')).toBe(true);
    expect(matchPattern('hello', 'world')).toBe(false);
  });

  it('matches wildcard patterns with *', () => {
    expect(matchPattern('*.exe', 'file.exe')).toBe(true);
    expect(matchPattern('*.exe', 'file.pdf')).toBe(false);
    expect(matchPattern('*logout*', '/user/logout?redirect=home')).toBe(true);
    expect(matchPattern('*logout*', '/user/login')).toBe(false);
    expect(matchPattern('hello*', 'hello world')).toBe(true);
    expect(matchPattern('*world', 'hello world')).toBe(true);
  });

  it('matches single character wildcard with ?', () => {
    expect(matchPattern('file?.txt', 'file1.txt')).toBe(true);
    expect(matchPattern('file?.txt', 'file12.txt')).toBe(false);
  });

  it('is case insensitive', () => {
    expect(matchPattern('*.EXE', 'file.exe')).toBe(true);
    expect(matchPattern('*.exe', 'FILE.EXE')).toBe(true);
  });

  it('escapes regex special characters', () => {
    expect(matchPattern('file.txt', 'file.txt')).toBe(true);
    expect(matchPattern('file.txt', 'filextxt')).toBe(false);
  });
});

describe('matchesAnyPattern', () => {
  it('returns true if any pattern matches', () => {
    const patterns = ['*.exe', '*.pdf', '*logout*'];
    expect(matchesAnyPattern('file.exe', patterns)).toBe(true);
    expect(matchesAnyPattern('document.pdf', patterns)).toBe(true);
    expect(matchesAnyPattern('/user/logout', patterns)).toBe(true);
    expect(matchesAnyPattern('/user/login', patterns)).toBe(false);
  });

  it('returns false for empty patterns array', () => {
    expect(matchesAnyPattern('anything', [])).toBe(false);
  });
});

describe('matchDomain', () => {
  it('matches exact domains', () => {
    expect(matchDomain('example.com', 'example.com')).toBe(true);
    expect(matchDomain('example.com', 'other.com')).toBe(false);
  });

  it('matches wildcard subdomains', () => {
    expect(matchDomain('*.example.com', 'sub.example.com')).toBe(true);
    expect(matchDomain('*.example.com', 'deep.sub.example.com')).toBe(true);
    expect(matchDomain('*.example.com', 'example.com')).toBe(true);
    expect(matchDomain('*.example.com', 'other.com')).toBe(false);
  });

  it('is case insensitive', () => {
    expect(matchDomain('Example.COM', 'example.com')).toBe(true);
    expect(matchDomain('*.EXAMPLE.com', 'Sub.Example.COM')).toBe(true);
  });
});

describe('parseUrl', () => {
  it('parses valid URLs', () => {
    const url = parseUrl('https://example.com/path?query=1');
    expect(url).not.toBeNull();
    expect(url?.hostname).toBe('example.com');
    expect(url?.pathname).toBe('/path');
  });

  it('parses relative URLs with base', () => {
    const url = parseUrl('/path?query=1', 'https://example.com');
    expect(url).not.toBeNull();
    expect(url?.hostname).toBe('example.com');
    expect(url?.pathname).toBe('/path');
  });

  it('returns null for invalid URLs', () => {
    const url = parseUrl('not a valid url', 'also-not-valid');
    expect(url).toBeNull();
  });
});

describe('getQueryParams', () => {
  it('parses query string into object', () => {
    const params = getQueryParams('?utm_source=google&utm_medium=cpc');
    expect(params).toEqual({
      utm_source: 'google',
      utm_medium: 'cpc',
    });
  });

  it('handles empty query string', () => {
    expect(getQueryParams('')).toEqual({});
    expect(getQueryParams('?')).toEqual({});
  });

  it('handles encoded values', () => {
    const params = getQueryParams('?name=hello%20world&special=%26%3D');
    expect(params.name).toBe('hello world');
    expect(params.special).toBe('&=');
  });
});

describe('debounce', () => {
  it('delays function execution', async () => {
    let callCount = 0;
    const fn = debounce(() => callCount++, 50);

    fn();
    fn();
    fn();

    expect(callCount).toBe(0);

    await new Promise((r) => setTimeout(r, 100));
    expect(callCount).toBe(1);
  });

  it('resets timer on each call', async () => {
    let callCount = 0;
    const fn = debounce(() => callCount++, 50);

    fn();
    await new Promise((r) => setTimeout(r, 30));
    fn();
    await new Promise((r) => setTimeout(r, 30));
    fn();

    expect(callCount).toBe(0);

    await new Promise((r) => setTimeout(r, 100));
    expect(callCount).toBe(1);
  });
});

describe('getRootDomain', () => {
  it('extracts root from subdomains', () => {
    expect(getRootDomain('app.aicw.io')).toBe('aicw.io');
    expect(getRootDomain('sub.example.com')).toBe('example.com');
    expect(getRootDomain('deep.sub.example.com')).toBe('example.com');
  });

  it('returns root domain as-is', () => {
    expect(getRootDomain('aicw.io')).toBe('aicw.io');
    expect(getRootDomain('example.com')).toBe('example.com');
  });

  it('handles localhost', () => {
    expect(getRootDomain('localhost')).toBe('localhost');
  });

  it('handles IP addresses', () => {
    expect(getRootDomain('127.0.0.1')).toBe('127.0.0.1');
    expect(getRootDomain('192.168.1.1')).toBe('192.168.1.1');
  });

  it('handles 2-part TLDs (co.uk, com.au)', () => {
    expect(getRootDomain('sub.example.co.uk')).toBe('example.co.uk');
    expect(getRootDomain('app.company.com.au')).toBe('company.com.au');
    expect(getRootDomain('example.co.uk')).toBe('example.co.uk');
  });

  it('handles single-part hostnames', () => {
    expect(getRootDomain('intranet')).toBe('intranet');
  });
});
