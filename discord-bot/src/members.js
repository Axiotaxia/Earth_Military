import { client } from './client.js';
import { config } from './config.js';

let loaded = false;

/**
 * Loads the full Main-server member list into discord.js's cache once. After
 * that the gateway (GuildMembers intent) keeps the cache current as people
 * join, leave, or change names, so searches never need to hit Discord.
 */
export async function warmMemberCache() {
  const guild = await client.guilds.fetch(config.mainServerId);
  await guild.members.fetch();
  loaded = true;
  console.log(`Member cache warmed: ${guild.members.cache.size} members`);
}

function score(haystacks, q) {
  let best = 0;
  for (const h of haystacks) {
    if (!h) continue;
    const lower = h.toLowerCase();
    if (lower === q) best = Math.max(best, 3);
    else if (lower.startsWith(q)) best = Math.max(best, 2);
    else if (lower.includes(q)) best = Math.max(best, 1);
  }
  return best;
}

/** Matches display name, global display name, nickname, and username. */
export async function searchMembers(rawQuery, limit = 20) {
  const q = rawQuery.trim().toLowerCase();
  if (q.length < 2) return [];

  const guild = await client.guilds.fetch(config.mainServerId);
  if (!loaded) await warmMemberCache();

  const matches = [];
  for (const m of guild.members.cache.values()) {
    if (m.user.bot) continue;
    const s = score([m.displayName, m.user.globalName, m.nickname, m.user.username], q);
    if (s > 0) matches.push({ m, s });
  }

  matches.sort((a, b) => b.s - a.s || a.m.displayName.localeCompare(b.m.displayName));
  return matches.slice(0, limit).map(({ m }) => ({
    discordId: m.user.id,
    username: m.user.username,
    displayName: m.displayName,
    avatarUrl: m.user.displayAvatarURL({ size: 64 }),
  }));
}
