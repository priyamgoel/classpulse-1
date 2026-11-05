import { clearAuthStorage, getAuthToken, isTokenExpired } from '@/lib/authStorage';
import { isAuthPage, loginPathForPath } from '@/lib/authRouting';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/** Redirects to the login page once per session-expiry event. */
function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  const { pathname, search } = window.location;
  if (isAuthPage(pathname)) return;
  const reason = 'reason=session_expired';
  // Avoid stacking duplicate history entries if a page fires several requests.
  if (search.includes(reason)) return;
  window.location.assign(`${loginPathForPath(pathname)}?${reason}`);
}

/**
 * Fetch wrapper that targets the API, attaches the stored bearer token, and
 * clears auth + redirects to /login when the session is no longer valid.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = /^https?:\/\//i.test(path)
    ? path
    : `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;

  const response = await fetch(url, { ...init, headers });

  if (response.status === 401 || (response.status === 403 && isTokenExpired(token))) {
    clearAuthStorage();
    redirectToLogin();
  }

  return response;
}

/** Safely parses a JSON response body, returning null on empty/invalid JSON. */
export async function readJson<T = any>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/** Convenience helper that returns both the response and parsed JSON. */
export async function apiJson<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<{ res: Response; data: T | null }> {
  const res = await apiFetch(path, init);
  const data = await readJson<T>(res);
  return { res, data };
}
