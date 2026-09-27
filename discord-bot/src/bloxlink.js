import { config } from './config.js';

/**
 * Resolves a Discord user ID to their linked Roblox user ID via Bloxlink's
 * public lookup API. Returns null if the user isn't linked or the lookup
 * fails - callers should treat that as "no site account", not an error.
 */
export async function resolveRobloxId(discordUserId) {
  try {
    const resp = await fetch(
      `https://api.blox.link/v4/public/guilds/${config.mainServerId}/discord-to-roblox/${discordUserId}`,
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.robloxID || null;
  } catch {
    return null;
  }
}
