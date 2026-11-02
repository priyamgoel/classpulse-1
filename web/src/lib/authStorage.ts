export const AUTH_TOKEN_KEY = 'classpulse_token';
export const AUTH_USER_KEY = 'classpulse_user';

function getStorages(): Storage[] {
  if (typeof window === 'undefined') return [];
  return [window.localStorage, window.sessionStorage];
}

/** Reads the JWT from localStorage first, then sessionStorage. */
export function getAuthToken(): string | null {
  for (const storage of getStorages()) {
    try {
      const value = storage.getItem(AUTH_TOKEN_KEY);
      if (value && value !== 'null' && value !== 'undefined') return value;
    } catch {
      // Ignore storage access errors (privacy mode, quota, etc.)
    }
  }
  return null;
}

/** Reads and parses the stored user, tolerating malformed JSON. */
export function getStoredUser<T = unknown>(): T | null {
  for (const storage of getStorages()) {
    try {
      const raw = storage.getItem(AUTH_USER_KEY);
      if (!raw) continue;
      return JSON.parse(raw) as T;
    } catch {
      // Try the next storage
    }
  }
  return null;
}

/** Writes auth to exactly one store based on "remember me". */
export function persistAuth(token: string, user: unknown, rememberMe: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    const primary = rememberMe ? window.localStorage : window.sessionStorage;
    const secondary = rememberMe ? window.sessionStorage : window.localStorage;
    primary.setItem(AUTH_TOKEN_KEY, token);
    primary.setItem(AUTH_USER_KEY, JSON.stringify(user));
    secondary.removeItem(AUTH_TOKEN_KEY);
    secondary.removeItem(AUTH_USER_KEY);
  } catch {
    // Ignore storage access errors
  }
}

/** Clears auth from both stores. */
export function clearAuthStorage(): void {
  for (const storage of getStorages()) {
    try {
      storage.removeItem(AUTH_TOKEN_KEY);
      storage.removeItem(AUTH_USER_KEY);
    } catch {
      // Ignore storage access errors
    }
  }
}

/** Returns an Authorization header only when a real token exists. */
export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Decodes a base64url-encoded JWT segment into a UTF-8 string. */
function decodeBase64Url(segment: string): string {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padding);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Returns true when a JWT is missing, malformed, has no numeric `exp`, or has
 * already expired. A small skew (default 30s) guards against clock drift.
 */
export function isTokenExpired(token: string | null, skewSeconds: number = 30): boolean {
  if (!token) return true;
  const parts = token.split('.');
  if (parts.length !== 3) return true;

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { exp?: unknown };
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return true;
    const expiresAtMs = payload.exp * 1000;
    return expiresAtMs <= Date.now() + skewSeconds * 1000;
  } catch {
    // Malformed tokens are treated as expired so callers clear them.
    return true;
  }
}
