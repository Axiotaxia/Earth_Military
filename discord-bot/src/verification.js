import { createHash, randomBytes } from 'node:crypto';
import { MessageFlags, PermissionsBitField } from 'discord.js';
import { client } from './client.js';
import { config } from './config.js';
import { db } from './supabase.js';

const TOKEN_TTL_MS = 10 * 60 * 1000;
const SYNC_INTERVAL_MS = 60 * 1000;
const EXCLUDED_ROBLOX_USER_IDS = new Set(['593587739']); // Beachec; immutable Roblox user ID.

let syncInFlight = false;

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function isUnknownGuildMember(error) {
  return Number(error?.code ?? error?.rawError?.code) === 10007;
}

export function buildVerificationMessage() {
  return {
    content: [
      '## Earth Kingdom Military Verification',
      '',
      'Verify your Roblox account to receive access to the Military server.',
      '',
      '**Requirements:**',
      '- You must be **Private or above** in the Earth Kingdom Roblox group.',
      '- Your Roblox account will be linked to your Discord account.',
      '- After successful verification, your Enlisted role and nickname will be updated automatically.',
    ].join('\n'),
    components: [{
      type: 1,
      components: [{
        type: 2,
        style: 1,
        label: 'Verify',
        custom_id: 'verification_start',
      }],
    }],
  };
}

export async function handleVerificationStart(interaction) {
  if (interaction.guildId !== config.militaryServerId) {
    await interaction.reply({
      content: 'Verification is only available in the Military server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!config.verificationSiteUrl || !config.verificationSiteUrl.startsWith('https://')) {
    await interaction.reply({
      content: 'Verification is not configured correctly. Please contact an administrator.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const token = randomBytes(32).toString('hex');
  await db.insert('discord_verification_tokens', {
    token_hash: hashToken(token),
    discord_id: interaction.user.id,
    discord_username: interaction.user.username,
    expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
  });

  const siteUrl = config.verificationSiteUrl.replace(/\/$/, '');
  const url = new URL('/verify', siteUrl);
  url.searchParams.set('token', token);

  await interaction.reply({
    content: 'Your personal verification link is ready. It expires in 10 minutes and can only be used once.',
    components: [{
      type: 1,
      components: [{
        type: 2,
        style: 5,
        label: 'Continue to Verification',
        url: url.toString(),
      }],
    }],
    flags: MessageFlags.Ephemeral,
  });
}

export async function ensureVerificationMessage() {
  if (!config.militaryVerifyChannelId) {
    console.log('[Verification] MILITARY_VERIFY_CHANNEL_ID is not configured; skipping verification panel.');
    return;
  }

  const guild = await client.guilds.fetch(config.militaryServerId);
  const channel = await guild.channels.fetch(config.militaryVerifyChannelId);
  if (!channel?.isTextBased() || !channel.messages) {
    throw new Error('Configured Military verification channel is not a message-capable text channel.');
  }

  const recent = await channel.messages.fetch({ limit: 50 });
  const existing = recent.find((message) =>
    message.author.id === client.user.id &&
    message.content.includes('Earth Kingdom Military Verification')
  );

  const payload = buildVerificationMessage();
  if (existing) {
    await existing.edit(payload);
    console.log('[Verification] Verification panel refreshed.');
  } else {
    await channel.send(payload);
    console.log('[Verification] Verification panel posted.');
  }
}

async function syncVerifiedMembersOnce() {
  if (!config.verificationRoleId || !config.enlistedRoleId) {
    console.warn('[Verification] Sync disabled: VERIFICATION_ROLE_ID or ENLISTED_ROLE_ID is missing.');
    return;
  }

  const allLinkedEligible = await db.select(
    'users',
    'select=id,roblox_user_id,roblox_username,roblox_display_name,timezone,group_rank,discord_id&group_rank=gte.2&discord_id=not.is.null&order=roblox_user_id',
  );

  const users = allLinkedEligible.filter(
    (user) => !EXCLUDED_ROBLOX_USER_IDS.has(String(user.roblox_user_id)),
  );
  const excluded = allLinkedEligible.length - users.length;

  const discordIdCounts = new Map();
  for (const user of users) {
    discordIdCounts.set(user.discord_id, (discordIdCounts.get(user.discord_id) || 0) + 1);
  }
  const duplicateDiscordIds = new Set(
    [...discordIdCounts].filter(([, count]) => count > 1).map(([discordId]) => discordId),
  );

  const guild = await client.guilds.fetch(config.militaryServerId);
  const botMember = guild.members.me || await guild.members.fetch(client.user.id);
  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    throw new Error('Bot is missing Manage Roles permission in the Military server.');
  }

  const verificationRole = await guild.roles.fetch(config.verificationRoleId);
  const enlistedRole = await guild.roles.fetch(config.enlistedRoleId);

  if (!verificationRole) {
    throw new Error('Configured VERIFICATION_ROLE_ID does not exist in the Military server.');
  }
  if (!enlistedRole) {
    throw new Error('Configured ENLISTED_ROLE_ID does not exist in the Military server.');
  }
  if (!verificationRole.editable) {
    throw new Error('Bot cannot manage the Verify role. Move the bot role above Verify in Server Settings > Roles.');
  }
  if (!enlistedRole.editable) {
    throw new Error('Bot cannot manage the Enlisted role. Move the bot role above Enlisted in Server Settings > Roles.');
  }
  if (verificationRole.id === enlistedRole.id) {
    throw new Error('VERIFICATION_ROLE_ID and ENLISTED_ROLE_ID must refer to different Discord roles.');
  }

  let processed = 0;
  let skipped = 0;
  let lookupFailures = 0;
  let roleFailures = 0;
  let nicknameFailures = 0;

  for (const user of users) {
    if (duplicateDiscordIds.has(user.discord_id)) {
      skipped++;
      console.error(
        '[Verification] Skipping Roblox user ' + user.roblox_username +
        ': Discord account ' + user.discord_id +
        ' is linked to multiple database profiles. Resolve the duplicate link before syncing roles.',
      );
      continue;
    }

    let member;
    try {
      member = await guild.members.fetch(user.discord_id);
    } catch (error) {
      if (isUnknownGuildMember(error)) {
        skipped++;
        console.warn(
          '[Verification] Roblox user ' + user.roblox_username +
          ' is linked to Discord ' + user.discord_id +
          ', but that account is not in the Military server.',
        );
      } else {
        lookupFailures++;
        console.error(
          '[Verification] Could not fetch Discord member for ' + user.roblox_username +
          ' (' + user.discord_id + '): ' + errorMessage(error),
        );
      }
      continue;
    }

    processed++;

    // Do not gate role assignment on member.manageable: that property also
    // checks whether the bot can moderate the member. Role changes instead
    // require Manage Roles and the bot's highest role to be above each target role.
    let hasEnlisted = member.roles.cache.has(enlistedRole.id);
    if (!hasEnlisted) {
      try {
        await member.roles.add(enlistedRole, 'Roblox account verified for Earth Kingdom Military');
        hasEnlisted = true;
        console.log('[Verification] Added Enlisted role to ' + user.roblox_username + '.');
      } catch (error) {
        roleFailures++;
        console.error(
          '[Verification] Failed to add Enlisted to ' + user.roblox_username +
          ' (' + user.discord_id + '): ' + errorMessage(error),
        );
      }
    }

    // Only remove Verify once Enlisted is present or was successfully added.
    // This avoids accidentally removing the member's access role if adding Enlisted fails.
    if (hasEnlisted && member.roles.cache.has(verificationRole.id)) {
      try {
        await member.roles.remove(verificationRole, 'Roblox account verified for Earth Kingdom Military');
        console.log('[Verification] Removed Verify role from ' + user.roblox_username + '.');
      } catch (error) {
        roleFailures++;
        console.error(
          '[Verification] Failed to remove Verify from ' + user.roblox_username +
          ' (' + user.discord_id + '): ' + errorMessage(error),
        );
      }
    }

    const displayName = user.roblox_display_name || user.roblox_username || 'Military Member';
    const timezone = user.timezone || 'Timezone not set';
    const nickname = (displayName + ' | ' + timezone).slice(0, 32);

    if (member.nickname !== nickname) {
      if (!member.manageable) {
        nicknameFailures++;
        console.warn(
          '[Verification] Roles processed for ' + user.roblox_username +
          ', but nickname cannot be changed because the bot is not above the member\'s highest role.',
        );
      } else {
        try {
          await member.setNickname(nickname, 'Roblox account verified for Earth Kingdom Military');
        } catch (error) {
          nicknameFailures++;
          console.error(
            '[Verification] Failed to set nickname for ' + user.roblox_username +
            ' (' + user.discord_id + '): ' + errorMessage(error),
          );
        }
      }
    }
  }

  console.log(
    '[Verification] Sync complete: linkedEligible=' + allLinkedEligible.length +
    ', excluded=' + excluded +
    ', eligible=' + users.length +
    ', processed=' + processed +
    ', skipped=' + skipped +
    ', lookupFailures=' + lookupFailures +
    ', roleFailures=' + roleFailures +
    ', nicknameFailures=' + nicknameFailures,
  );
}

export async function syncVerifiedMembers() {
  if (syncInFlight) {
    console.warn('[Verification] Previous sync is still running; skipping overlapping run.');
    return;
  }

  syncInFlight = true;
  try {
    await syncVerifiedMembersOnce();
  } finally {
    syncInFlight = false;
  }
}

export function startVerificationSync() {
  const run = () => syncVerifiedMembers().catch((error) => {
    console.error('[Verification] Sync failed:', errorMessage(error));
  });

  run();
  setInterval(run, SYNC_INTERVAL_MS);
}
