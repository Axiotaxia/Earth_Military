import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config.js';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
  ],
  // Needed so reaction events fire even for messages not in the client's
  // cache (e.g. after a restart) - reactions on poll messages must always be
  // caught, even hours after the bot last touched that message.
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const READY_TIMEOUT_MS = 30_000;

export async function startClient() {
  await client.login(config.discordToken);

  // If GuildMembers (a privileged intent) is requested above but not actually
  // enabled for the bot in the Discord Developer Portal, Discord silently
  // refuses the gateway connection and 'ready' never fires - with no error
  // anywhere. A timeout turns that into a clear, loud failure instead of a
  // deploy that hangs forever with empty logs.
  await Promise.race([
    new Promise((resolve) => client.once('ready', resolve)),
    new Promise((_, reject) => setTimeout(
      () => reject(new Error(
        "Discord 'ready' event never fired within 30s. Check: (1) the bot token is correct and was not reset since, "
        + '(2) Server Members Intent is enabled in the Discord Developer Portal under Bot > Privileged Gateway Intents.',
      )),
      READY_TIMEOUT_MS,
    )),
  ]);

  console.log(`Discord bot logged in as ${client.user.tag}`);
}
