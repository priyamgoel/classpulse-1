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
