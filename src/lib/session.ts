const TOKEN_KEY = 'ek_session_token';

/** Signed session token issued at login; only the Host Events backend checks it. */
export function getSessionToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSessionToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/** True if a token exists and its (unverified, client-side) expiry hasn't passed. */
export function hasUsableSessionToken(): boolean {
  const token = getSessionToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}
