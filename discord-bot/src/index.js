import { MessageFlags } from 'discord.js';
import { client, startClient } from './client.js';
import { createApiServer, setBotReady } from './api.js';
import { handleReactionAdd, handleReactionRemove } from './reactions.js';
import { handleCoHostClaim, handleCoHostUnclaim } from './cohost.js';
import { config } from './config.js';
import { warmMemberCache } from './members.js';
import { startRankSync } from './rankSync.js';
import { ensureVerificationMessage, handleVerificationStart, startVerificationSync } from './verification.js';

// Keep process-level failures visible in Railway logs.
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

const app = createApiServer();
app.listen(config.port, () => {
  console.log(`Bot HTTP API listening on port ${config.port}`);
});

// Register gateway handlers before login so no events are missed during startup.
client.on('messageReactionAdd', (reaction, user) => {
  handleReactionAdd(reaction, user).catch((err) => console.error('handleReactionAdd error:', err));
});

client.on('messageReactionRemove', (reaction, user) => {
  handleReactionRemove(reaction, user).catch((err) => console.error('handleReactionRemove error:', err));
});

client.on('interactionCreate', (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'verification_start') {
    handleVerificationStart(interaction).catch((err) => {
      console.error('handleVerificationStart error:', err);
      if (!interaction.replied && !interaction.deferred) {
        interaction.reply({
          content: 'Something went wrong starting verification. Please try again or contact an administrator.',
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }
    });
    return;
  }

  if (interaction.customId.startsWith('cohost_unclaim:')) {
    handleCoHostUnclaim(interaction).catch((err) => {
      console.error('handleCoHostUnclaim error:', err);
      if (!interaction.replied && !interaction.deferred) {
        interaction.reply({ content: 'Something went wrong.', flags: MessageFlags.Ephemeral }).catch(() => null);
      }
    });
    return;
  }

  if (interaction.customId.startsWith('cohost_claim:')) {
    handleCoHostClaim(interaction).catch((err) => {
      console.error('handleCoHostClaim error:', err);
      if (!interaction.replied && !interaction.deferred) {
        interaction.reply({
          content: 'Something went wrong claiming this slot.',
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }
    });
  }
});

async function connectDiscord() {
  await startClient();
  setBotReady(true);
  console.log('Discord connection ready.');

  await warmMemberCache().catch((err) => {
    console.error('Member cache warm failed (check Server Members Intent):', err.message);
  });

  startRankSync();
  await ensureVerificationMessage().catch((err) => {
    console.error('[Verification] Panel setup failed:', err.message);
  });
  startVerificationSync();
}

connectDiscord().catch((err) => {
  // Keep the HTTP health endpoint available even if Discord cannot connect.
  console.error('Discord connection failed:', err);
});
