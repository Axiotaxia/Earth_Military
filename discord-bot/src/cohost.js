import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { client } from './client.js';
import { db } from './supabase.js';
import { resolveRobloxId } from './bloxlink.js';
import { buildDoubleExamPollMessage, IS_COMPONENTS_V2 } from './messages.js';

const NO_PINGS = { parse: [] };
const OPEN_STATUSES = 'draft,posted,ready,started';

/** Co-host request message: one Claim button per slot plus an Unclaim button. */
export function buildCoHostRequestMessage({ eventId, slots }) {
  const claimRow = new ActionRowBuilder();
  for (const slot of slots) {
    claimRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`cohost_claim:${eventId}:${slot.slot_index}`)
        .setLabel(slot.label ? `Claim: ${slot.label}` : 'Claim Co-Host')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!!slot.claimed_by_discord_id),
    );
  }
  const unclaimRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cohost_unclaim:${eventId}`)
      .setLabel('Unclaim my co-host spot')
      .setStyle(ButtonStyle.Secondary),
  );

  const lines = ['**Co-Host Requests**', ''];
  for (const slot of slots) {
    lines.push(`${slot.label || 'Co-Host'}: ${slot.claimed_by_discord_id ? `<@${slot.claimed_by_discord_id}>` : 'Open'}`);
  }
  return { content: lines.join('\n'), components: [claimRow, unclaimRow], allowedMentions: NO_PINGS };
}

async function fetchMessage(channelId, messageId) {
  if (!channelId || !messageId) return null;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  return channel ? channel.messages.fetch(messageId).catch(() => null) : null;
}

/** Re-renders both the co-host request message and the poll from current DB state. */
export async function refreshEventMessages(eventId) {
  const [event] = await db.select('events', `id=eq.${eventId}&select=*`);
  if (!event) return;
  const slots = await db.select('event_cohost_slots', `event_id=eq.${eventId}&select=*&order=slot_index`);

  const cohostMsg = await fetchMessage(event.cohost_channel_id, event.cohost_message_id);
  if (cohostMsg) await cohostMsg.edit(buildCoHostRequestMessage({ eventId, slots })).catch(() => null);

  const pollMsg = await fetchMessage(event.poll_channel_id, event.poll_message_id);
  if (pollMsg) {
    const poll = buildDoubleExamPollMessage({
      scheduledFor: new Date(event.scheduled_for),
      hostDiscordId: event.host_discord_id,
      coHostRoleLabel: 'Corporal Sergeant',
      slots,
    });
    await pollMsg.edit({ ...poll, flags: IS_COMPONENTS_V2, allowedMentions: NO_PINGS }).catch(() => null);
  }
}

async function openEvent(eventId) {
  const [event] = await db.select('events', `id=eq.${eventId}&select=id,status`);
  return event && event.status === 'posted' ? event : null;
}

/** Claim button. First click wins; one open co-host spot per person. */
export async function handleCoHostClaim(interaction) {
  const [, eventId, slotIndexStr] = interaction.customId.split(':');
  const slotIndex = Number(slotIndexStr);

  if (!(await openEvent(eventId))) {
    await interaction.reply({ content: 'This event is no longer taking co-hosts.', ephemeral: true });
    return;
  }

  const slots = await db.select('event_cohost_slots', `event_id=eq.${eventId}&select=*`);
  const targetSlot = slots.find((s) => s.slot_index === slotIndex);
  if (!targetSlot) {
    await interaction.reply({ content: 'This co-host slot no longer exists.', ephemeral: true });
    return;
  }
  if (targetSlot.claimed_by_discord_id) {
    await interaction.reply({ content: 'Someone already claimed this slot.', ephemeral: true });
    return;
  }

  // Only spots on events that are still open count (cancelled/concluded events
  // clear their claims, but this is a second layer of defense in case that
  // cleanup was ever skipped for an older event).
  const claimedSlots = await db.select(
    'event_cohost_slots',
    `claimed_by_discord_id=eq.${interaction.user.id}&select=event_id`,
  );
  let hasOpenClaim = false;
  if (claimedSlots.length > 0) {
    const eventIds = [...new Set(claimedSlots.map((s) => s.event_id))].join(',');
    const claimedEvents = await db.select('events', `id=in.(${eventIds})&status=in.(${OPEN_STATUSES})&select=id`);
    hasOpenClaim = claimedEvents.length > 0;
  }
  if (hasOpenClaim) {
    await interaction.reply({
      content: "You're already co-hosting an event. Unclaim that spot first if you want this one.",
      ephemeral: true,
    });
    return;
  }

  const robloxUserId = await resolveRobloxId(interaction.user.id);
  let linkedUser = null;
  if (robloxUserId) {
    linkedUser = (await db.select('users', `roblox_user_id=eq.${robloxUserId}&select=id`))[0] || null;
  }

  const updated = await db.update(
    'event_cohost_slots',
    `id=eq.${targetSlot.id}&claimed_by_discord_id=is.null`,
    {
      claimed_by_discord_id: interaction.user.id,
      claimed_by_discord_username: interaction.member?.displayName || interaction.user.username,
      claimed_by_roblox_user_id: linkedUser?.id || null,
      claimed_at: new Date().toISOString(),
    },
  );
  if (updated.length === 0) {
    await interaction.reply({ content: 'Someone just claimed this slot before you.', ephemeral: true });
    return;
  }

  await interaction.reply({ content: `You're now co-hosting: ${targetSlot.label || 'this event'}.`, ephemeral: true });
  await refreshEventMessages(eventId);
}

/** Unclaim button: only releases spots the clicker actually holds. */
export async function handleCoHostUnclaim(interaction) {
  const [, eventId] = interaction.customId.split(':');

  if (!(await openEvent(eventId))) {
    await interaction.reply({ content: 'This event has already started or ended.', ephemeral: true });
    return;
  }

  const released = await db.update(
    'event_cohost_slots',
    `event_id=eq.${eventId}&claimed_by_discord_id=eq.${interaction.user.id}`,
    { claimed_by_discord_id: null, claimed_by_discord_username: null, claimed_by_roblox_user_id: null, claimed_at: null },
  );
  if (released.length === 0) {
    await interaction.reply({ content: "You aren't co-hosting this event.", ephemeral: true });
    return;
  }

  await interaction.reply({ content: 'You gave up your co-host spot.', ephemeral: true });
  await refreshEventMessages(eventId);
}
