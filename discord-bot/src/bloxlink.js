import { config } from './config.js';

/**
 * Looks up which Roblox account a Discord user has linked in Bloxlink for the
 * Main server. Requires BLOXLINK_API_KEY (Bloxlink's API rejects keyless
 * requests). Returns { robloxId, status } where status is one of:
 * 'ok' | 'not_linked' | 'not_configured' | 'error'.
 */
export async function lookupRobloxId(discordUserId) {
  if (!config.bloxlinkApiKey) return { robloxId: null, status: 'not_configured' };

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
