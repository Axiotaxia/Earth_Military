import { client, startClient } from './client.js';
import { createApiServer, setBotReady } from './api.js';
import { handleReactionAdd, handleReactionRemove } from './reactions.js';
import { handleCoHostClaim, handleCoHostUnclaim } from './cohost.js';
import { config } from './config.js';
import { warmMemberCache } from './members.js';
import { startRankSync } from './rankSync.js';

// Surface anything that would otherwise kill the process silently (which is
// exactly what an empty Railway log with no error message looks like).
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

// Start the HTTP server immediately, before Discord login. Railway (and any
// platform health check) expects a service to bind its port right away; if
// that's gated behind Discord login succeeding, a slow or stuck login looks
// identical to a crashed deploy from the outside (Bad Gateway, empty logs).
const app = createApiServer();
app.listen(config.port, () => {
  console.log(`Bot HTTP API listening on port ${config.port}`);
});

async function connectDiscord() {
  await startClient();
  setBotReady(true);
  console.log('Discord connection ready.');

  await warmMemberCache().catch((err) => console.error('Member cache warm failed (is the Server Members intent enabled?):', err.message));
  startRankSync();

  client.on('messageReactionAdd', (reaction, user) => {
    handleReactionAdd(reaction, user).catch((err) => console.error('handleReactionAdd error:', err));
  });

  client.on('messageReactionRemove', (reaction, user) => {
    handleReactionRemove(reaction, user).catch((err) => console.error('handleReactionRemove error:', err));
  });

  client.on('interactionCreate', (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId.startsWith('cohost_unclaim:')) {
      handleCoHostUnclaim(interaction).catch((err) => {
        console.error('handleCoHostUnclaim error:', err);
        interaction.reply({ content: 'Something went wrong.', ephemeral: true }).catch(() => null);
      });
    } else if (interaction.customId.startsWith('cohost_claim:')) {
      handleCoHostClaim(interaction).catch((err) => {
        console.error('handleCoHostClaim error:', err);
        interaction.reply({ content: 'Something went wrong claiming this slot.', ephemeral: true }).catch(() => null);
      });
    }
  });
}

connectDiscord().catch((err) => {
  // Log but do not exit: the HTTP API (and /health) should stay reachable
  // even if Discord login is failing, so the failure is diagnosable instead
  // of presenting as a generic dead deployment.
  console.error('Discord connection failed:', err);
});
