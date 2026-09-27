import { config } from './config.js';
import { db } from './supabase.js';

export const VOTE_EMOJI = {
  slot_1: '\ud83e\udea8', // rock
  slot_2: '\u26f0\ufe0f', // mountain
};

const EMOJI_TO_SLOT = Object.fromEntries(Object.entries(VOTE_EMOJI).map(([k, v]) => [v, k]));

const SLOT_ROLE_REQUIREMENT = {
  slot_1: config.roleIds.citizen,
  slot_2: config.roleIds.private,
};

async function findEventByPollMessage(messageId) {
  const rows = await db.select('events', `poll_message_id=eq.${messageId}&status=eq.posted&select=*`);
  return rows[0] || null;
}

/**
 * Called on every reaction add. Enforces the role gate for each voting
 * option by removing reactions from members who lack the required role, and
 * records valid votes to Supabase so the website can show live counts. The
 * poll never auto-decides anything - the host reads these counts and makes
 * the call manually on the website.
 */
export async function handleReactionAdd(reaction, user) {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => null);

  const slotKey = EMOJI_TO_SLOT[reaction.emoji.name];
  if (!slotKey) return; // not a vote emoji we care about

  const event = await findEventByPollMessage(reaction.message.id);
  if (!event) return;

  const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  const requiredRoleId = SLOT_ROLE_REQUIREMENT[slotKey];
  const hasRole = requiredRoleId ? member.roles.cache.has(requiredRoleId) : true;

  if (!hasRole) {
    await reaction.users.remove(user.id).catch(() => null);
    return;
  }

  try {
    await db.insert('event_poll_votes', [{
      event_id: event.id,
      option_key: slotKey,
      voter_discord_id: user.id,
      voter_discord_username: member.user.username,
    }]);
  } catch {
    // Duplicate vote from the same user on the same option - fine to ignore
  }
}

/**
 * Called on every reaction remove, so the vote count stays accurate if
 * someone un-reacts on their own.
 */
export async function handleReactionRemove(reaction, user) {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => null);

  const slotKey = EMOJI_TO_SLOT[reaction.emoji.name];
  if (!slotKey) return;

  const event = await findEventByPollMessage(reaction.message.id);
  if (!event) return;

  await db
    .delete('event_poll_votes', `event_id=eq.${event.id}&option_key=eq.${slotKey}&voter_discord_id=eq.${user.id}`)
    .catch(() => null);
}
