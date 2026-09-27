import { client, startClient } from './client.js';
import { createApiServer } from './api.js';
import { handleReactionAdd, handleReactionRemove } from './reactions.js';
import { handleCoHostClaim } from './cohost.js';
import { config } from './config.js';

async function main() {
  await startClient();

  client.on('messageReactionAdd', (reaction, user) => {
    handleReactionAdd(reaction, user).catch((err) => console.error('handleReactionAdd error:', err));
  });

  client.on('messageReactionRemove', (reaction, user) => {
    handleReactionRemove(reaction, user).catch((err) => console.error('handleReactionRemove error:', err));
  });

  client.on('interactionCreate', (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId.startsWith('cohost_claim:')) {
      handleCoHostClaim(interaction).catch((err) => {
        console.error('handleCoHostClaim error:', err);
        interaction.reply({ content: 'Something went wrong claiming this slot.', ephemeral: true }).catch(() => null);
      });
    }
  });

  const app = createApiServer();
  app.listen(config.port, () => {
    console.log(`Bot HTTP API listening on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error('Fatal error starting bot:', err);
  process.exit(1);
});
