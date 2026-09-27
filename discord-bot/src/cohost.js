import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { db } from './supabase.js';
import { resolveRobloxId } from './bloxlink.js';

/**
 * Builds the co-host request message posted in the Military server, with one
 * "Claim" button per open slot. Button custom IDs encode the event and slot
 * so the interaction handler can look them up without extra state.
 */
export function buildCoHostRequestMessage({ eventId, slots }) {
  const row = new ActionRowBuilder();

  for (const slot of slots) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`cohost_claim:${eventId}:${slot.slot_index}`)
        .setLabel(slot.label ? `Claim: ${slot.label}` : 'Claim Co-Host')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!!slot.claimed_by_discord_id),
    );
  }

  const lines = ['**Co-Host Requests**', ''];
  for (const slot of slots) {
    const status = slot.claimed_by_discord_id
      ? `Claimed by <@${slot.claimed_by_discord_id}>`
      : 'Open';
    lines.push(`${slot.label || 'Co-Host'}: ${status}`);
  }

  return {
    content: lines.join('\n'),
    components: [row],
  };
}

/**
 * Handles a "Claim" button click. Enforces: one person can't co-host
 * multiple events at once, and two people can't claim the same event's
 * slots. First click wins; if the slot's already taken by the time this
 * resolves, the clicker gets an ephemeral "too late" reply.
 */
export async function handleCoHostClaim(interaction) {
  const [, eventId, slotIndexStr] = interaction.customId.split(':');
  const slotIndex = Number(slotIndexStr);

  const slots = await db.select(
    'event_cohost_slots',
    `event_id=eq.${eventId}&select=*`,
  );
  const targetSlot = slots.find((s) => s.slot_index === slotIndex);

  if (!targetSlot) {
    await interaction.reply({ content: 'This co-host slot no longer exists.', ephemeral: true });
    return;
  }
  if (targetSlot.claimed_by_discord_id) {
    await interaction.reply({ content: 'Someone already claimed this slot.', ephemeral: true });
    return;
  }

  // One person can't co-host multiple events, or both slots of the same event
  const alreadyClaimedElsewhere = await db.select(
    'event_cohost_slots',
    `claimed_by_discord_id=eq.${interaction.user.id}&select=id`,
  );
  if (alreadyClaimedElsewhere.length > 0) {
    await interaction.reply({
      content: "You're already co-hosting another event, so you can't claim this one too.",
      ephemeral: true,
    });
    return;
  }

  const robloxUserId = await resolveRobloxId(interaction.user.id);
  let linkedUser = null;
  if (robloxUserId) {
    const matches = await db.select('users', `roblox_user_id=eq.${robloxUserId}&select=id`);
    linkedUser = matches[0] || null;
  }

  const updated = await db.update(
    'event_cohost_slots',
    `id=eq.${targetSlot.id}&claimed_by_discord_id=is.null`,
    {
      claimed_by_discord_id: interaction.user.id,
      claimed_by_discord_username: interaction.user.username,
      claimed_by_roblox_user_id: linkedUser?.id || null,
      claimed_at: new Date().toISOString(),
    },
  );

  if (updated.length === 0) {
    // Someone else claimed it in the split second between our checks
    await interaction.reply({ content: 'Someone just claimed this slot before you.', ephemeral: true });
    return;
  }

  await interaction.reply({
    content: `You're now co-hosting: ${targetSlot.label || 'this event'}.`,
    ephemeral: true,
  });

  // Refresh the whole request message to reflect the new claim + disable that button
  const refreshedSlots = await db.select('event_cohost_slots', `event_id=eq.${eventId}&select=*&order=slot_index`);
  const message = buildCoHostRequestMessage({ eventId, slots: refreshedSlots });
  await interaction.message.edit(message).catch(() => null);
}
