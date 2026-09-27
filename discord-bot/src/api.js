import express from 'express';
import { config } from './config.js';
import { client } from './client.js';
import { db } from './supabase.js';
import { buildDoubleExamPollMessage } from './messages.js';
import { buildCoHostRequestMessage } from './cohost.js';
import { VOTE_EMOJI } from './reactions.js';

export function createApiServer() {
  const app = express();
  app.use(express.json());

  // Every route requires the shared secret, so only the website's Supabase
  // edge functions (which hold this secret server-side) can call this API.
  app.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${config.apiSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  });

  app.get('/health', (req, res) => {
    res.json({ ok: true, botTag: client.user?.tag || null });
  });

  app.post('/events/:id/post-double-exam', async (req, res) => {
    try {
      const { id: eventId } = req.params;

      const events = await db.select('events', `id=eq.${eventId}&select=*`);
      const event = events[0];
      if (!event) return res.status(404).json({ error: 'Event not found' });

      const cohostSlots = await db.select(
        'event_cohost_slots',
        `event_id=eq.${eventId}&select=*&order=slot_index`,
      );

      const mainGuild = await client.guilds.fetch(config.mainServerId);
      const eventsChannel = await mainGuild.channels.fetch(config.mainEventsChannelId);

      const pollMessage = buildDoubleExamPollMessage({
        scheduledFor: new Date(event.scheduled_for),
        hostDiscordId: event.host_discord_id,
        coHostRoleLabel: 'Corporal Sergeant',
      });

      const IS_COMPONENTS_V2 = 1 << 15;
      const sentPoll = await eventsChannel.send({ ...pollMessage, flags: IS_COMPONENTS_V2 });

      await sentPoll.react(VOTE_EMOJI.slot_1);
      await sentPoll.react(VOTE_EMOJI.slot_2);

      const militaryGuild = await client.guilds.fetch(config.militaryServerId);
      const cohostChannel = await militaryGuild.channels.fetch(config.militaryCohostChannelId);

      const cohostMessage = buildCoHostRequestMessage({ eventId, slots: cohostSlots });
      const sentCohost = await cohostChannel.send(cohostMessage);

      await db.update('events', `id=eq.${eventId}`, {
        status: 'posted',
        poll_channel_id: config.mainEventsChannelId,
        poll_message_id: sentPoll.id,
        cohost_channel_id: config.militaryCohostChannelId,
        cohost_message_id: sentCohost.id,
        posted_at: new Date().toISOString(),
      });

      res.json({ ok: true, pollMessageId: sentPoll.id, cohostMessageId: sentCohost.id });
    } catch (err) {
      console.error('post-double-exam failed:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/events/:id/vote-counts', async (req, res) => {
    try {
      const { id: eventId } = req.params;
      const votes = await db.select('event_poll_votes', `event_id=eq.${eventId}&select=option_key`);
      const counts = { slot_1: 0, slot_2: 0 };
      for (const v of votes) {
        if (counts[v.option_key] !== undefined) counts[v.option_key] += 1;
      }
      res.json(counts);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/events/:id/poll', async (req, res) => {
    try {
      const { id: eventId } = req.params;
      const events = await db.select('events', `id=eq.${eventId}&select=*`);
      const event = events[0];
      if (!event) return res.status(404).json({ error: 'Event not found' });

      if (event.poll_channel_id && event.poll_message_id) {
        const channel = await client.channels.fetch(event.poll_channel_id).catch(() => null);
        const message = channel ? await channel.messages.fetch(event.poll_message_id).catch(() => null) : null;
        if (message) await message.delete().catch(() => null);
      }
      if (event.cohost_channel_id && event.cohost_message_id) {
        const channel = await client.channels.fetch(event.cohost_channel_id).catch(() => null);
        const message = channel ? await channel.messages.fetch(event.cohost_message_id).catch(() => null) : null;
        if (message) await message.delete().catch(() => null);
      }

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /members/search?q=name
   * Searches the Main server's member list by username/display name, for the
   * website's "pick a Discord member" pickers (host self-identification,
   * guards, spectators, passed, training mentions). Returns up to 20 matches.
   */
  app.get('/members/search', async (req, res) => {
    try {
      const query = (req.query.q || '').toString().trim().toLowerCase();
      if (query.length < 2) {
        return res.json({ members: [] });
      }

      const guild = await client.guilds.fetch(config.mainServerId);
      // Discord's search API matches on username/nickname prefix server-side,
      // which is far more reliable than trying to filter a locally cached list.
      const results = await guild.members.search({ query, limit: 20 });

      const members = results.map((m) => ({
        discordId: m.user.id,
        username: m.user.username,
        displayName: m.displayName,
        avatarUrl: m.user.displayAvatarURL({ size: 64 }),
      }));

      res.json({ members });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}
