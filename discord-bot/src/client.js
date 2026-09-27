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

export async function startClient() {
  await client.login(config.discordToken);
  await new Promise((resolve) => client.once('ready', resolve));
  console.log(`Discord bot logged in as ${client.user.tag}`);
}
