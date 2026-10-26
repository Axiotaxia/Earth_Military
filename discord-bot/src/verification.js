import { createHash, randomBytes } from 'node:crypto';
import { MessageFlags, PermissionsBitField } from 'discord.js';
import { client } from './client.js';
import { config } from './config.js';
import { db } from './supabase.js';

const TOKEN_TTL_MS = 10 * 60 * 1000;
const SYNC_INTERVAL_MS = 60 * 1000;
const EXCLUDED_ROBLOX_USER_IDS = new Set(['593587739']); // Beachec: intentionally excluded from automatic role sync.
let syncInFlight = false;

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function discordErrorCode(error) {
  return String(error?.code ?? error?.rawError?.code ?? error?.status ?? 'UNKNOWN');
}

function logDiscordFailure(stage, user, error) {
  const code = discordErrorCode(error);
  const reason = code === '50013' ? 'MISSING_PERMISSIONS'
    : code === '50001' ? 'MISSING_ACCESS'
    : code === '10007' ? 'MEMBER_NOT_IN_GUILD'
    : code === '10011' ? 'ROLE_NOT_FOUND'
    : code === '50035' ? 'INVALID_FORM_BODY'
    : 'DISCORD_API_ERROR';

  console.error(
    '[Verification][' + stage + '][' + reason + '] ' +
    'roblox=' + (user?.roblox_username || 'n/a') +
    ' discord=' + (user?.discord_id || 'n/a') +
    ' discordCode=' + code +
    ' message=' + (error instanceof Error ? error.message : String(error)),
  );
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
      '- After successful verification, Enlisted will be added, Verify will be removed, and your nickname will be updated automatically.',
    ].join('\n'),
    components: [{
      type: 1,
      components: [{ type: 2, style: 1, label: 'Verify', custom_id: 'verification_start' }],
    }],
  };
}

export async function handleVerificationStart(interaction) {
  const actor = 'discord=' + interaction.user.id + ' username=' + interaction.user.username;

  if (!interaction.inGuild() || interaction.guildId !== config.militaryServerId) {
    console.warn('[Verification][START_WRONG_GUILD] ' + actor + ' guild=' + (interaction.guildId || 'none'));
    await interaction.reply({
      content: 'Verification is only available in the Military server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!config.verificationSiteUrl) {
    console.error('[Verification][START_CONFIG_MISSING] VERIFICATION_SITE_URL is empty.');
    await interaction.reply({
      content: 'Verification is temporarily unavailable (missing site URL). Please contact an administrator.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  let siteUrl;
  try {
    siteUrl = new URL(config.verificationSiteUrl);
    if (siteUrl.protocol !== 'https:') throw new Error('URL must use HTTPS');
  } catch (error) {
    console.error('[Verification][START_CONFIG_INVALID] VERIFICATION_SITE_URL=' + config.verificationSiteUrl + ' error=' + String(error));
    await interaction.reply({
      content: 'Verification is temporarily unavailable (invalid site URL). Please contact an administrator.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const token = randomBytes(32).toString('hex');
  try {
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
    const insertedRows = await db.insert('discord_verification_tokens', {
      token_hash: hashToken(token),
      discord_id: interaction.user.id,
      discord_username: interaction.user.username,
      expires_at: expiresAt,
    });
    const tokenRowId = insertedRows?.[0]?.id;
    if (!tokenRowId) throw new Error('Supabase inserted the token without returning its row ID.');
    console.info('[Verification][TOKEN_CREATED] ' + actor + ' tokenRowId=' + tokenRowId + ' expiresAt=' + expiresAt + ' site=' + siteUrl.origin);
  } catch (error) {
    console.error('[Verification][TOKEN_CREATE_DB_FAILED] ' + actor + ' error=' + String(error));
    await interaction.reply({
      content: 'We could not create a verification link because the database request failed. Please try again shortly.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const verifyUrl = new URL('/verify', siteUrl.origin);
  verifyUrl.searchParams.set('token', token);

  try {
    await interaction.reply({
      content: 'Your personal verification link is ready. It expires in 10 minutes and can only be used once. Click below, then press **Continue with Roblox**.',
      components: [{
        type: 1,
        components: [{ type: 2, style: 5, label: 'Continue to Verification', url: verifyUrl.toString() }],
      }],
      flags: MessageFlags.Ephemeral,
    });
    console.info('[Verification][LINK_DELIVERED] ' + actor + ' path=/verify');
  } catch (error) {
    console.error('[Verification][LINK_DELIVERY_FAILED] ' + actor + ' error=' + String(error));
    throw error;
  }
}

export async function ensureVerificationMessage() {
  if (!config.militaryVerifyChannelId) {
    console.error('[Verification][PANEL_CONFIG_MISSING] MILITARY_VERIFY_CHANNEL_ID is empty.');
    return;
  }

  try {
    const guild = await client.guilds.fetch(config.militaryServerId);
    const channel = await guild.channels.fetch(config.militaryVerifyChannelId);
    if (!channel?.isTextBased() || !channel.messages) {
      console.error('[Verification][PANEL_CHANNEL_INVALID] channelId=' + config.militaryVerifyChannelId);
      throw new Error('Configured verification channel is not a message-capable text channel.');
    }

    const recent = await channel.messages.fetch({ limit: 50 });
    const existing = recent.find((message) =>
      message.author.id === client.user.id &&
      message.content.includes('Earth Kingdom Military Verification')
    );
    const payload = buildVerificationMessage();

    if (existing) {
      await existing.edit(payload);
      console.info('[Verification][PANEL_REFRESHED] channelId=' + channel.id + ' messageId=' + existing.id);
    } else {
      const posted = await channel.send(payload);
      console.info('[Verification][PANEL_POSTED] channelId=' + channel.id + ' messageId=' + posted.id);
    }
  } catch (error) {
    console.error('[Verification][PANEL_SETUP_FAILED] ' + String(error));
    throw error;
  }
}

async function syncVerifiedMembersOnce() {
  const counters = {
    linkedEligible: 0,
    excluded: 0,
    eligible: 0,
    processed: 0,
    alreadyCorrect: 0,
    missingGuildMember: 0,
    duplicateLinks: 0,
    lookupFailures: 0,
    enlistedAddFailures: 0,
    verifyRemoveFailures: 0,
    roleStateFailures: 0,
    nicknameFailures: 0,
  };

  if (!config.militaryServerId) {
    console.error('[Verification][SYNC_CONFIG_MISSING] MILITARY_SERVER_ID is empty.');
    return;
  }
  if (!config.verificationRoleId) {
    console.error('[Verification][SYNC_CONFIG_MISSING] VERIFICATION_ROLE_ID is empty.');
    return;
  }
  if (!config.enlistedRoleId) {
    console.error('[Verification][SYNC_CONFIG_MISSING] ENLISTED_ROLE_ID is empty.');
    return;
  }
  if (config.verificationRoleId === config.enlistedRoleId) {
    console.error('[Verification][SYNC_CONFIG_INVALID] Verify and Enlisted role IDs are identical.');
    return;
  }

  let linkedUsers;
  try {
    linkedUsers = await db.select(
      'users',
      'select=id,roblox_user_id,roblox_username,roblox_display_name,timezone,group_rank,discord_id&group_rank=gte.2&discord_id=not.is.null&order=roblox_user_id',
    );
  } catch (error) {
    console.error('[Verification][SYNC_DB_SELECT_FAILED] table=users stage=load_eligible_profiles error=' + String(error));
    return;
  }

  counters.linkedEligible = linkedUsers.length;
  const users = linkedUsers.filter((user) => !EXCLUDED_ROBLOX_USER_IDS.has(String(user.roblox_user_id)));
  counters.excluded = linkedUsers.length - users.length;
  counters.eligible = users.length;

  let guild;
  let botMember;
  let verificationRole;
  let enlistedRole;
  try {
    guild = await client.guilds.fetch(config.militaryServerId);
  } catch (error) {
    console.error('[Verification][SYNC_GUILD_FETCH_FAILED] guildId=' + config.militaryServerId + ' error=' + String(error));
    return;
  }

  try {
    botMember = guild.members.me || await guild.members.fetch(client.user.id);
  } catch (error) {
    console.error('[Verification][SYNC_BOT_MEMBER_FETCH_FAILED] botId=' + client.user.id + ' error=' + String(error));
    return;
  }

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    console.error('[Verification][SYNC_MISSING_MANAGE_ROLES] Bot member lacks Manage Roles permission in guild=' + guild.id);
    return;
  }

  try {
    verificationRole = await guild.roles.fetch(config.verificationRoleId);
  } catch (error) {
    console.error('[Verification][VERIFY_ROLE_FETCH_FAILED] roleId=' + config.verificationRoleId + ' error=' + String(error));
    return;
  }
  try {
    enlistedRole = await guild.roles.fetch(config.enlistedRoleId);
  } catch (error) {
    console.error('[Verification][ENLISTED_ROLE_FETCH_FAILED] roleId=' + config.enlistedRoleId + ' error=' + String(error));
    return;
  }

  if (!verificationRole) {
    console.error('[Verification][VERIFY_ROLE_NOT_FOUND] roleId=' + config.verificationRoleId + ' guild=' + guild.id);
    return;
  }
  if (!enlistedRole) {
    console.error('[Verification][ENLISTED_ROLE_NOT_FOUND] roleId=' + config.enlistedRoleId + ' guild=' + guild.id);
    return;
  }
  if (!verificationRole.editable) {
    console.error(
      '[Verification][VERIFY_ROLE_NOT_MANAGEABLE] botHighestRole=' + botMember.roles.highest.name +
      '(' + botMember.roles.highest.position + ') targetRole=' + verificationRole.name +
      '(' + verificationRole.position + ') managed=' + verificationRole.managed,
    );
    return;
  }
  if (!enlistedRole.editable) {
    console.error(
      '[Verification][ENLISTED_ROLE_NOT_MANAGEABLE] botHighestRole=' + botMember.roles.highest.name +
      '(' + botMember.roles.highest.position + ') targetRole=' + enlistedRole.name +
      '(' + enlistedRole.position + ') managed=' + enlistedRole.managed,
    );
    return;
  }

  const discordIdCounts = new Map();
  for (const user of users) {
    discordIdCounts.set(user.discord_id, (discordIdCounts.get(user.discord_id) || 0) + 1);
  }
  const duplicateDiscordIds = new Set(
    [...discordIdCounts].filter(([, count]) => count > 1).map(([id]) => id),
  );

  for (const user of users) {
    if (duplicateDiscordIds.has(user.discord_id)) {
      counters.duplicateLinks++;
      console.error(
        '[Verification][DUPLICATE_DISCORD_LINK] roblox=' + user.roblox_username +
        ' robloxId=' + user.roblox_user_id + ' discordId=' + user.discord_id +
        ' action=skip_profile_and_require_manual_database_repair',
      );
      continue;
    }

    let member;
    try {
      member = await guild.members.fetch({ user: user.discord_id, force: true });
    } catch (error) {
      if (discordErrorCode(error) === '10007') {
        counters.missingGuildMember++;
        console.warn(
          '[Verification][DISCORD_MEMBER_NOT_IN_GUILD] roblox=' + user.roblox_username +
          ' robloxId=' + user.roblox_user_id + ' discordId=' + user.discord_id +
          ' action=join_military_server_then_retry',
        );
      } else {
        counters.lookupFailures++;
        logDiscordFailure('MEMBER_LOOKUP_FAILED', user, error);
      }
      continue;
    }

    counters.processed++;
    let memberHasEnlisted = member.roles.cache.has(enlistedRole.id);
    let memberHasVerify = member.roles.cache.has(verificationRole.id);
    if (memberHasEnlisted && !memberHasVerify) counters.alreadyCorrect++;

    if (!memberHasEnlisted) {
      try {
        await member.roles.add(enlistedRole, 'Roblox account verified for Earth Kingdom Military');
        console.info('[Verification][ENLISTED_ADD_REQUEST_SUCCEEDED] roblox=' + user.roblox_username + ' discordId=' + user.discord_id);
      } catch (error) {
        counters.enlistedAddFailures++;
        logDiscordFailure('ENLISTED_ADD_FAILED', user, error);
        continue; // Never remove Verify if Enlisted could not be assigned.
      }

      try {
        member = await guild.members.fetch({ user: user.discord_id, force: true });
      } catch (error) {
        counters.roleStateFailures++;
        logDiscordFailure('ENLISTED_CONFIRM_FETCH_FAILED', user, error);
        continue; // The role request succeeded, but do not remove Verify until state can be confirmed.
      }

      memberHasEnlisted = member.roles.cache.has(enlistedRole.id);
      if (memberHasEnlisted) {
        console.info('[Verification][ENLISTED_ADD_CONFIRMED] roblox=' + user.roblox_username + ' discordId=' + user.discord_id);
      } else {
        counters.enlistedAddFailures++;
        counters.roleStateFailures++;
        console.error('[Verification][ENLISTED_ADD_NOT_CONFIRMED] roblox=' + user.roblox_username + ' discordId=' + user.discord_id + ' action=keep_verify_role');
        continue;
      }
    }

    if (memberHasEnlisted && memberHasVerify) {
      let removeRequestSucceeded = false;
      try {
        await member.roles.remove(verificationRole, 'Roblox account verified for Earth Kingdom Military');
        removeRequestSucceeded = true;
        console.info('[Verification][VERIFY_REMOVE_REQUEST_SUCCEEDED] roblox=' + user.roblox_username + ' discordId=' + user.discord_id);
      } catch (error) {
        counters.verifyRemoveFailures++;
        logDiscordFailure('VERIFY_REMOVE_FAILED', user, error);
      }

      if (removeRequestSucceeded) {
        try {
          member = await guild.members.fetch({ user: user.discord_id, force: true });
          memberHasVerify = member.roles.cache.has(verificationRole.id);
          if (!memberHasVerify) {
            console.info('[Verification][VERIFY_REMOVE_CONFIRMED] roblox=' + user.roblox_username + ' discordId=' + user.discord_id);
          } else {
            counters.verifyRemoveFailures++;
            counters.roleStateFailures++;
            console.error('[Verification][VERIFY_REMOVE_NOT_CONFIRMED] roblox=' + user.roblox_username + ' discordId=' + user.discord_id);
          }
        } catch (error) {
          counters.roleStateFailures++;
          logDiscordFailure('VERIFY_CONFIRM_FETCH_FAILED', user, error);
        }
      }
    }

    const displayName = user.roblox_display_name || user.roblox_username || 'Military Member';
    const nickname = (displayName + ' | ' + (user.timezone || 'Timezone not set')).slice(0, 32);
    if (member.nickname !== nickname) {
      if (!member.manageable) {
        counters.nicknameFailures++;
        console.warn(
          '[Verification][NICKNAME_HIERARCHY_BLOCKED] roblox=' + user.roblox_username +
          ' discordId=' + user.discord_id +
          ' botHighestRole=' + botMember.roles.highest.name + '(' + botMember.roles.highest.position + ')' +
          ' memberHighestRole=' + member.roles.highest.name + '(' + member.roles.highest.position + ')',
        );
      } else {
        try {
          await member.setNickname(nickname, 'Roblox account verified for Earth Kingdom Military');
          console.info('[Verification][NICKNAME_SET] roblox=' + user.roblox_username + ' discordId=' + user.discord_id);
        } catch (error) {
          counters.nicknameFailures++;
          logDiscordFailure('NICKNAME_SET_FAILED', user, error);
        }
      }
    }
  }

  // Only log when something went wrong or changed; otherwise this prints every minute.
  const quietKeys = new Set(['linkedEligible', 'excluded', 'eligible', 'processed', 'alreadyCorrect']);
  const hasNews = Object.entries(counters).some(([key, value]) => !quietKeys.has(key) && value > 0);
  if (hasNews) {
    console.info(
      '[Verification][SYNC_FINISHED] ' + Object.entries(counters).map(([key, value]) => key + '=' + value).join(' '),
    );
  }
}

export async function syncVerifiedMembers() {
  if (syncInFlight) {
    console.warn('[Verification][SYNC_OVERLAP] Previous sync is still running; this run was skipped.');
    return;
  }

  syncInFlight = true;
  try {
    await syncVerifiedMembersOnce();
  } catch (error) {
    console.error('[Verification][SYNC_UNEXPECTED_FAILURE] ' + (error instanceof Error ? error.stack || error.message : String(error)));
  } finally {
    syncInFlight = false;
  }
}

export function startVerificationSync() {
  console.info('[Verification][SYNC_SCHEDULER_STARTED] intervalSeconds=' + (SYNC_INTERVAL_MS / 1000));
  syncVerifiedMembers();
  setInterval(syncVerifiedMembers, SYNC_INTERVAL_MS);
}
