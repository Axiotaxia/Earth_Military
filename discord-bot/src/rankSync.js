import { client } from './client.js';
import { config } from './config.js';
import { db } from './supabase.js';

const GROUP_ID = 592750791;
const MIN_MEMBER_RANK = 2; // Private; Citizen and Guest are removed.
const SYNC_INTERVAL_MS = 15 * 60 * 1000;

async function getRobloxGroupRole(robloxUserId) {
  const response = await fetch(
    `https://groups.roblox.com/v2/users/${robloxUserId}/groups/${GROUP_ID}/roles`,
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (!response.ok) {
    const fallback = await fetch(
      `https://groups.roblox.com/v1/users/${robloxUserId}/groups/roles`,
      { headers: { 'Content-Type': 'application/json' } },
    );

    if (!fallback.ok) throw new Error(`Roblox group lookup failed (${response.status}/${fallback.status})`);

    const data = await fallback.json();
    const group = data.data?.find((entry) => entry.group?.id === GROUP_ID);
    return group?.role
      ? { rank: group.role.rank || 0, name: group.role.name || 'Guest' }
      : { rank: 0, name: 'Guest' };
  }

  const role = await response.json();
  return { rank: role.rank || 0, name: role.name || 'Guest' };
}

async function kickFromMilitaryServer(discordId, reason) {
  if (!discordId) return { found: false, kicked: false, error: null };

  const guild = await client.guilds.fetch(config.militaryServerId);
  const member = await guild.members.fetch(discordId).catch(() => null);
  if (!member) return { found: false, kicked: false, error: null };

  try {
    await member.kick(reason);
    return { found: true, kicked: true, error: null };
  } catch (error) {
    return {
      found: true,
      kicked: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function removeMember(user, role) {
  const reason = role.rank === 1 ? 'Roblox group rank dropped to Citizen' : 'Left the Roblox group';
  let discordKick = { found: false, kicked: false, error: null };

  if (user.discord_id) {
    discordKick = await kickFromMilitaryServer(
      user.discord_id,
      `Military profile removed: ${reason}`,
    );
  }

  await db.insert('member_removal_log', {
    roblox_user_id: user.roblox_user_id,
    roblox_username: user.roblox_username,
    roblox_display_name: user.roblox_display_name,
    previous_rank: user.group_rank,
    previous_rank_name: user.group_rank_name,
    discord_id: user.discord_id,
    discord_username: user.discord_username,
    reason,
    discord_kicked: discordKick.kicked,
    discord_kick_error: discordKick.error,
  });

  await db.insert('activity_log', {
    user_id: user.id,
    event_type: 'member_removed',
    event_data: {
      reason,
      roblox_user_id: user.roblox_user_id,
      roblox_username: user.roblox_username,
      previous_rank: user.group_rank,
      previous_rank_name: user.group_rank_name,
      discord_id: user.discord_id,
      discord_kicked: discordKick.kicked,
      discord_member_found: discordKick.found,
      discord_kick_error: discordKick.error,
    },
  });

  await db.delete('users', `id=eq.${user.id}`);

  console.log(
    `[RankSync] Removed ${user.roblox_username} (${user.group_rank_name}) - ${reason}; `
      + `Discord member found=${discordKick.found}, kicked=${discordKick.kicked}`
      + (discordKick.error ? `, error=${discordKick.error}` : ''),
  );
}

export async function syncRobloxRanks() {
  const users = await db.select(
    'users',
    'select=id,roblox_user_id,roblox_username,roblox_display_name,group_rank,group_rank_name,discord_id,discord_username&order=roblox_user_id',
  );

  let checked = 0;
  let updated = 0;
  let removed = 0;

  for (let i = 0; i < users.length; i += 10) {
    const batch = users.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(async (user) => ({
        user,
        role: await getRobloxGroupRole(Number(user.roblox_user_id)),
      })),
    );

    for (const { user, role } of results) {
      checked++;

      if (role.rank < MIN_MEMBER_RANK) {
        await removeMember(user, role);
        removed++;
        continue;
      }

      if (role.rank !== user.group_rank || role.name !== user.group_rank_name) {
        await db.update('users', `id=eq.${user.id}`, {
          group_rank: role.rank,
          group_rank_name: role.name,
          updated_at: new Date().toISOString(),
        });
        updated++;
        console.log(`[RankSync] Updated ${user.roblox_username}: ${user.group_rank_name} -> ${role.name}`);
      }
    }
  }

  console.log(`[RankSync] Complete: checked=${checked}, updated=${updated}, removed=${removed}`);
  return { checked, updated, removed };
}

export function startRankSync() {
  const run = () => syncRobloxRanks().catch((error) => {
    console.error('[RankSync] Sync failed:', error);
  });

  // Run immediately after the bot is connected, then every 15 minutes.
  run();
  setInterval(run, SYNC_INTERVAL_MS);
}
