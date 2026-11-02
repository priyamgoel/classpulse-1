import { beforeEach, describe, expect, it } from 'vitest';
import {
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  clearAuthStorage,
  getAuthToken,
  getStoredUser,
  isTokenExpired,
  persistAuth,
} from './authStorage';

function base64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function makeJwt(payload: Record<string, unknown>): string {
  return `${base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64Url(
    JSON.stringify(payload)
  )}.signature`;
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('isTokenExpired', () => {
  it('accepts a token whose exp is in the future', () => {
    const token = makeJwt({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(isTokenExpired(token, 0)).toBe(false);
  });

  it('rejects a token whose exp is in the past', () => {
    const token = makeJwt({ sub: 'u1', exp: Math.floor(Date.now() / 1000) - 60 });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('rejects malformed, empty, and exp-less tokens', () => {
    expect(isTokenExpired(null)).toBe(true);
    expect(isTokenExpired('')).toBe(true);
    expect(isTokenExpired('not-a-jwt')).toBe(true);
    expect(isTokenExpired(makeJwt({ sub: 'u1' }))).toBe(true);
    expect(isTokenExpired(makeJwt({ exp: 'tomorrow' }))).toBe(true);
  });

  it('honours the clock-skew margin', () => {
    const exp = Math.floor(Date.now() / 1000) + 10;
    const token = makeJwt({ exp });
    expect(isTokenExpired(token, 0)).toBe(false);
    expect(isTokenExpired(token, 30)).toBe(true);
  });
});

describe('auth storage', () => {
  it('persists remember-me sessions in localStorage only', () => {
    persistAuth('token-local', { id: 'u1' }, true);

    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBe('token-local');
    expect(JSON.parse(window.localStorage.getItem(AUTH_USER_KEY) || '{}')).toEqual({ id: 'u1' });
    expect(window.sessionStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
  });

  it('persists non-remembered sessions in sessionStorage only', () => {
    window.localStorage.setItem(AUTH_TOKEN_KEY, 'stale');
    persistAuth('token-session', { id: 'u2' }, false);

    expect(window.sessionStorage.getItem(AUTH_TOKEN_KEY)).toBe('token-session');
    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(getAuthToken()).toBe('token-session');
  });

  it('clears both storages', () => {
    persistAuth('token-local', { id: 'u1' }, true);
    window.sessionStorage.setItem(AUTH_TOKEN_KEY, 'token-session');

    clearAuthStorage();

    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(AUTH_USER_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(getAuthToken()).toBeNull();
  });

  it('tolerates malformed stored user JSON', () => {
    window.localStorage.setItem(AUTH_USER_KEY, '{not json');
    expect(getStoredUser()).toBeNull();
  });
});
