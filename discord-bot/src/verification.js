import { randomBytes, createHash } from 'node:crypto';
import { client } from './client.js';
import { config } from './config.js';
import { db } from './supabase.js';

const TOKEN_TTL_MS = 10 * 60 * 1000;
const SYNC_INTERVAL_MS = 60 * 1000;

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
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
      '- After successful verification, your Military role and nickname will be updated automatically.',
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
    await interaction.reply({ content: 'Verification is only available in the Military server.', ephemeral: true });
    return;
  }

  if (!config.verificationSiteUrl) {
    await interaction.reply({
      content: 'Verification is not configured yet. Please contact an administrator.',
      ephemeral: true,
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
  const url = siteUrl + '/verify?token=' + encodeURIComponent(token);

  await interaction.reply({
    content: 'Your personal verification link is ready. It expires in 10 minutes and can only be used once.',
    components: [{
      type: 1,
      components: [{
        type: 2,
        style: 5,
        label: 'Continue to Verification',
        url,
      }],
    }],
    ephemeral: true,
  });
}

export async function ensureVerificationMessage() {
  if (!config.militaryVerifyChannelId) {
    console.log('[Verification] MILITARY_VERIFY_CHANNEL_ID is not configured; skipping verification panel.');
    return;
  }

  const guild = await client.guilds.fetch(config.militaryServerId);
  const channel = await guild.channels.fetch(config.militaryVerifyChannelId);
  if (!channel?.isTextBased()) throw new Error('Military verification channel is not a text channel.');

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

export async function syncVerifiedMembers() {
  if (!config.verifiedRoleId) {
    return;
  }

  const users = await db.select(
    'users',
    'select=id,roblox_username,roblox_display_name,timezone,group_rank,discord_id&group_rank=gte.2&discord_id=not.is.null&order=roblox_user_id',
  );

  const guild = await client.guilds.fetch(config.militaryServerId);
  const role = await guild.roles.fetch(config.verifiedRoleId);
  if (!role) throw new Error('Configured VERIFIED_ROLE_ID does not exist in the Military server.');

  for (const user of users) {
    const member = await guild.members.fetch(user.discord_id).catch(() => null);
    if (!member) continue;

    if (!member.roles.cache.has(role.id)) {
      await member.roles.add(role, 'Military account verification');
    }

    const fullUser = user.roblox_display_name || user.roblox_username;
    const timezone = user.timezone || 'Timezone not set';
    const nickname = (fullUser + ' | ' + timezone).slice(0, 32);

    if (member.nickname !== nickname) {
      await member.setNickname(nickname, 'Military account verification').catch((error) => {
        console.error(
          '[Verification] Failed to rename ' + user.roblox_username + ': ' +
          (error instanceof Error ? error.message : String(error)),
        );
      });
    }
  }
}

export function startVerificationSync() {
  const run = () => syncVerifiedMembers().catch((error) => {
    console.error('[Verification] Sync failed:', error);
  });

  run();
  setInterval(run, SYNC_INTERVAL_MS);
}
