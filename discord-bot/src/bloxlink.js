import { config } from './config.js';

/**
 * Looks up which Roblox account a Discord user has linked in Bloxlink for the
 * Main server. Requires BLOXLINK_API_KEY (Bloxlink's API rejects keyless
 * requests). Returns { robloxId, status } where status is one of:
 * 'ok' | 'not_linked' | 'not_configured' | 'error'.
 */
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map(); // discordId -> { at, result }

export async function lookupRobloxId(discordUserId) {
  if (!config.bloxlinkApiKey) return { robloxId: null, status: 'not_configured' };
  const hit = cache.get(discordUserId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.result;
  const result = await lookupUncached(discordUserId);
  // Only remember definite answers, never transient errors
  if (result.status === 'ok' || result.status === 'not_linked') cache.set(discordUserId, { at: Date.now(), result });
  return result;
}

async function lookupUncached(discordUserId) {

  try {
    const resp = await fetch(
      `https://api.blox.link/v4/public/guilds/${config.mainServerId}/discord-to-roblox/${discordUserId}`,
      { headers: { Authorization: config.bloxlinkApiKey } },
    );
    if (resp.status === 404) return { robloxId: null, status: 'not_linked' };
    if (!resp.ok) return { robloxId: null, status: 'error' };

    const data = await resp.json();
    const id = data.robloxID ?? data.robloxId ?? data.user?.robloxId ?? null;
    return id ? { robloxId: String(id), status: 'ok' } : { robloxId: null, status: 'not_linked' };
  } catch {
    return { robloxId: null, status: 'error' };
  }
}

/** Convenience wrapper: just the Roblox ID (or null). */
export async function resolveRobloxId(discordUserId) {
  return (await lookupRobloxId(discordUserId)).robloxId;
}
