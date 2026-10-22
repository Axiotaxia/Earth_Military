import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config.js';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
  ],
  // Reactions on older poll messages must continue working after restarts.
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const READY_TIMEOUT_MS = 30_000;

export async function startClient() {
  let readyTimeout;
  let readyHandler;

  // Attach the listener BEFORE login. Waiting for the event only after login
  // can miss the ready event if the gateway connects quickly.
  const readyPromise = new Promise((resolve, reject) => {
    readyHandler = () => {
      clearTimeout(readyTimeout);
      resolve();
    };

    client.once(Events.ClientReady, readyHandler);
    readyTimeout = setTimeout(() => {
      client.off(Events.ClientReady, readyHandler);
      reject(new Error(
        "Discord clientReady event never fired within 30s. Check that the bot token is valid "
        + "and Server Members Intent is enabled in Discord Developer Portal > Bot > Privileged Gateway Intents.",
      ));
    }, READY_TIMEOUT_MS);
  });

  try {
    await client.login(config.discordToken);
    await readyPromise;
  } catch (error) {
    clearTimeout(readyTimeout);
    if (readyHandler) client.off(Events.ClientReady, readyHandler);
    throw error;
  }

  console.log(`Discord bot logged in as ${client.user.tag}`);
}
