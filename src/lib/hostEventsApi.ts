import { getSessionToken } from '@/lib/session';

export class HostEventsError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * Calls the host-events edge function. The anon key satisfies Supabase's
 * gateway; the real authentication is the signed session token, which the
 * function verifies server-side along with the can_host_events permission.
 */
export async function callHostEvents<T = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const token = getSessionToken();
  if (!token) {
    throw new HostEventsError('Please sign out and sign back in to enable hosting.', 401);
  }

  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/host-events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'X-Session-Token': token,
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.error) {
    throw new HostEventsError(data.error || `Request failed (${resp.status})`, resp.status);
  }
  return data as T;
}
