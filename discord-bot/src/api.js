import express from 'express';
import { config } from './config.js';
import { client } from './client.js';
import { db } from './supabase.js';
import { buildDoubleExamPollMessage, buildStartMessage, buildDoubleExamConclusionMessage, IS_COMPONENTS_V2 } from './messages.js';
import { buildCoHostRequestMessage, refreshEventMessages } from './cohost.js';
import { VOTE_EMOJI } from './reactions.js';
import { searchMembers } from './members.js';
import { lookupRobloxId } from './bloxlink.js';

let botReady = false;
export function setBotReady(value) {
  botReady = value;
}

export function createApiServer() {
  const app = express();
  app.use(express.json());

  // No auth on /health: it must be checkable from a plain browser to tell
  // "the process is up but Discord hasn't connected yet" apart from "this
  // deploy is completely dead", without needing to craft an authenticated
  // request first.
  app.get('/health', (req, res) => {
    const routes = app._router.stack
      .filter((layer) => layer.route)
      .map((layer) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
    res.json({
      ok: true,
      discordConnected: botReady,
      botTag: client.user?.tag || null,
      routes,
    });
  });

  app.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${config.apiSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  });

  // Every route below this point needs a live Discord connection. Fail with
  // a clear message rather than a confusing Discord.js error if a request
  // arrives during the brief window after startup before login completes.
  app.use((req, res, next) => {
    if (!botReady) {
      return res.status(503).json({ error: 'Bot is still connecting to Discord - try again in a few seconds.' });
    }
    next();
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
        slots: cohostSlots,
      });

      const sentPoll = await eventsChannel.send({ ...pollMessage, flags: IS_COMPONENTS_V2, allowedMentions: { parse: [] } });

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

  // POST /events/:id/refresh - re-render poll + co-host message from DB state
  app.post('/events/:id/refresh', async (req, res) => {
    try {
      await refreshEventMessages(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /events/:id/start-double-exam {activities:{slot_1,slot_2}}
  // Claims the posted -> started transition atomically (so a double click can't
  // post twice), announces the start, then removes the poll + co-host messages.
  app.post('/events/:id/start-double-exam', async (req, res) => {
    const { id: eventId } = req.params;
    let claimed = false;
    try {
      const activities = { slot_1: !!req.body?.activities?.slot_1, slot_2: !!req.body?.activities?.slot_2 };
      if (!activities.slot_1 && !activities.slot_2) return res.status(400).json({ error: 'Pick at least one exam' });

      const moved = await db.update('events', `id=eq.${eventId}&status=eq.posted`, {
        status: 'started',
        started_at: new Date().toISOString(),
        decided_activities: activities,
      });
      if (moved.length === 0) return res.status(409).json({ error: 'Event is not in a state that can be started' });
      claimed = true;
      const event = moved[0];

      const mainGuild = await client.guilds.fetch(config.mainServerId);
      const channel = await mainGuild.channels.fetch(config.mainEventsChannelId);
      const sent = await channel.send({
        content: buildStartMessage({ hostDiscordId: event.host_discord_id, activities }),
        allowedMentions: { parse: [] },
      });

      await db.update('events', `id=eq.${eventId}`, { start_channel_id: config.mainEventsChannelId, start_message_id: sent.id });

      for (const [chId, msgId] of [[event.poll_channel_id, event.poll_message_id], [event.cohost_channel_id, event.cohost_message_id]]) {
        if (!chId || !msgId) continue;
        const ch = await client.channels.fetch(chId).catch(() => null);
        const msg = ch ? await ch.messages.fetch(msgId).catch(() => null) : null;
        if (msg) await msg.delete().catch(() => null);
      }
      res.json({ ok: true });
    } catch (err) {
      console.error('start-double-exam failed:', err);
      // If we claimed the transition but couldn't announce, let the host retry
      if (claimed) await db.update('events', `id=eq.${eventId}`, { status: 'posted', started_at: null, decided_activities: null }).catch(() => null);
      res.status(500).json({ error: err.message });
    }
  });


  app.post('/events/:id/conclude-double-exam', async (req, res) => {
    const { id: eventId } = req.params;
    try {
      const events = await db.select('events', 'id=eq.' + eventId + '&select=*');
      const event = events[0];
      if (!event) return res.status(404).json({ error: 'Event not found' });
      if (event.status !== 'started') return res.status(409).json({ error: 'Event is not in progress' });

      const activities = event.decided_activities || {};
      const people = await db.select('event_people', 'event_id=eq.' + eventId + '&select=*&order=sort_order');
      const slots = await db.select('event_cohost_slots', 'event_id=eq.' + eventId + '&select=*&order=slot_index');
      const passed1 = people.filter((p) => p.role === 'passed' && p.context_key === 'slot_1').map((p) => p.discord_id);
      const passed2 = people.filter((p) => p.role === 'passed' && p.context_key === 'slot_2').map((p) => p.discord_id);
      const guards = people.filter((p) => p.role === 'guard').map((p) => p.discord_id);
      const spectators = people.filter((p) => p.role === 'spectator').map((p) => p.discord_id);
      const slot1 = slots.find((s) => s.slot_index === 1);
      const slot2 = slots.find((s) => s.slot_index === 2);

      const mainGuild = await client.guilds.fetch(config.mainServerId);
      const channel = await mainGuild.channels.fetch(config.mainEventsChannelId);
      const message = buildDoubleExamConclusionMessage({
        hostDiscordId: event.host_discord_id,
        slot1Enabled: !!activities.slot_1,
        slot2Enabled: !!activities.slot_2,
        slot1Passed: passed1,
        slot2Passed: passed2,
        slot1Cohost: slot1?.claimed_by_discord_id || null,
        slot2Cohost: slot2?.claimed_by_discord_id || null,
        guards,
        spectators,
      });
      const sent = await channel.send({ ...message, flags: IS_COMPONENTS_V2, allowedMentions: { parse: ['users'] } });
      await db.update('events', 'id=eq.' + eventId, {
        conclude_channel_id: config.mainEventsChannelId,
        conclude_message_id: sent.id,
      });
      res.json({ ok: true, messageId: sent.id });
    } catch (err) {
      console.error('conclude-double-exam failed:', err);
      res.status(500).json({ error: err.message });
    }
  });


  // GET /members/search-linked?q=  - members plus their Bloxlink-linked Roblox ID
  app.get('/members/search-linked', async (req, res) => {
    try {
      const found = await searchMembers((req.query.q || '').toString(), 8);
      const members = await Promise.all(found.map(async (m) => ({ ...m, robloxId: (await lookupRobloxId(m.discordId)).robloxId })));
      res.json({ members });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /members/search?q=...  - display name / username / nickname search
  app.get('/members/search', async (req, res) => {
    try {
      const members = await searchMembers((req.query.q || '').toString());
      res.json({ members });
    } catch (err) {
      console.error('members/search failed:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /identity/verify {discordId, robloxUserId}
  // Confirms Bloxlink links that Discord account to that Roblox account.
  app.post('/identity/verify', async (req, res) => {
    try {
      const { discordId, robloxUserId } = req.body || {};
      if (!discordId || !robloxUserId) {
        return res.status(400).json({ error: 'discordId and robloxUserId are required' });
      }
      const { robloxId, status } = await lookupRobloxId(String(discordId));
      if (status !== 'ok') return res.json({ verified: false, reason: status });
      res.json({ verified: robloxId === String(robloxUserId), reason: robloxId === String(robloxUserId) ? 'ok' : 'mismatch' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}
