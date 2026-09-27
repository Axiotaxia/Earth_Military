/*
# Host Events System - Core Data Model

## Overview
Backs the new "Host Events" tab: a multi-step flow (create -> post -> claim
co-hosts -> decide/start -> conclude) for exams and trainings. The website is
the source of truth for all state; a separate Discord bot process only posts,
edits, and deletes messages, and reports Discord-side actions (reactions,
button clicks) back via a Supabase edge function.

## New Tables
1. `events` - one row per hosted event (exam or training). Tracks its type,
   lifecycle status, host, scheduled time, and the Discord message IDs it owns
   so the bot knows what to edit or delete at each step.
2. `event_cohost_slots` - co-host slots for an event. Most event types have 0
   or 1 slot; Double Exam has 2 (one per sub-exam). Tracks who claimed each
   slot, both as a Discord ID and (if resolvable via Bloxlink) a linked
   Roblox user.
3. `event_poll_votes` - raw reaction votes on a poll message, one row per
   (event, option, voter). Used to show live vote counts on the website
   without needing to ask Discord live. Not authoritative for anything
   automatic - the host reads these and decides manually.
4. `event_people` - flexible list of Discord users tagged onto an event at
   conclusion time (guards, spectators, passed, or a training-result mention),
   each optionally linked to a Roblox user for point-awarding.
5. `event_training_activities` - only used for Training events: the variable
   list of activities run (FFA, HG, Glad, TDM) and their results, referencing
   `event_people` rows for the mentioned winners.

## Permission
A new `can_host_events` permission column is added to `division_ranks`,
`user_permissions`, and `group_rank_permissions`, following the exact pattern
already used for `can_edit_point_types`.

## Users table addition
`discord_id` / `discord_username` cache the host's own Discord identity once
they self-identify via the Discord member search (Bloxlink only supports
Discord -> Roblox lookups, not the reverse, so this has to be captured once
and stored rather than resolved automatically every time).

## Security
RLS enabled on every new table, following the same anon/authenticated
select-all + write-all pattern used throughout this app (app-layer permission
checks control who can actually reach the UI that writes to them).
*/

-- =============================================================
-- USERS: cache own Discord identity (set on first self-identification)
-- =============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_username text;

-- =============================================================
-- PERMISSION: can_host_events
-- =============================================================
ALTER TABLE division_ranks ADD COLUMN IF NOT EXISTS can_host_events boolean NOT NULL DEFAULT false;
ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS can_host_events boolean NOT NULL DEFAULT false;
ALTER TABLE group_rank_permissions ADD COLUMN IF NOT EXISTS can_host_events boolean NOT NULL DEFAULT false;

-- =============================================================
-- EVENTS
-- =============================================================
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  event_type text NOT NULL CHECK (event_type IN (
    'corporal_exam', 'private_exam', 'soldier_exam', 'double_exam', 'training'
  )),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'posted', 'ready', 'started', 'concluded', 'cancelled'
  )),

  -- Host is always a site user (they must be logged in to use this tab)
  host_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  host_discord_id text,

  scheduled_for timestamptz NOT NULL,

  -- For Double Exam: which sub-exam(s) the host decided to actually run.
  -- Null until the host makes that decision on the "decide" screen.
  -- e.g. {"slot_1": true, "slot_2": false}
  decided_activities jsonb,

  -- Discord message IDs this event owns, so the bot knows what to edit/delete
  poll_channel_id text,
  poll_message_id text,
  cohost_channel_id text,
  cohost_message_id text,
  start_channel_id text,
  start_message_id text,
  conclude_channel_id text,
  conclude_message_id text,

  created_at timestamptz DEFAULT now(),
  posted_at timestamptz,
  started_at timestamptz,
  concluded_at timestamptz,
  cancelled_at timestamptz
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_select_all" ON events;
CREATE POLICY "events_select_all"
ON events FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "events_insert_auth" ON events;
CREATE POLICY "events_insert_auth"
ON events FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "events_update_auth" ON events;
CREATE POLICY "events_update_auth"
ON events FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "events_delete_auth" ON events;
CREATE POLICY "events_delete_auth"
ON events FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_host ON events(host_user_id);

-- =============================================================
-- CO-HOST SLOTS
-- =============================================================
CREATE TABLE IF NOT EXISTS event_cohost_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  slot_index integer NOT NULL DEFAULT 1,
  -- e.g. "Citizen \u2192 Private" for a Double Exam slot; null for single-cohost events
  label text,

  claimed_by_discord_id text,
  claimed_by_discord_username text,
  claimed_by_roblox_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  claimed_at timestamptz,

  UNIQUE (event_id, slot_index)
);

ALTER TABLE event_cohost_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cohost_slots_select_all" ON event_cohost_slots;
CREATE POLICY "cohost_slots_select_all"
ON event_cohost_slots FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "cohost_slots_insert_auth" ON event_cohost_slots;
CREATE POLICY "cohost_slots_insert_auth"
ON event_cohost_slots FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "cohost_slots_update_auth" ON event_cohost_slots;
CREATE POLICY "cohost_slots_update_auth"
ON event_cohost_slots FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cohost_slots_delete_auth" ON event_cohost_slots;
CREATE POLICY "cohost_slots_delete_auth"
ON event_cohost_slots FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_cohost_slots_event ON event_cohost_slots(event_id);

-- =============================================================
-- POLL VOTES (informational only, host decides manually)
-- =============================================================
CREATE TABLE IF NOT EXISTS event_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- Which poll option this vote is for, e.g. "slot_1" / "slot_2"
  option_key text NOT NULL,

  voter_discord_id text NOT NULL,
  voter_discord_username text,

  created_at timestamptz DEFAULT now(),

  UNIQUE (event_id, option_key, voter_discord_id)
);

ALTER TABLE event_poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "poll_votes_select_all" ON event_poll_votes;
CREATE POLICY "poll_votes_select_all"
ON event_poll_votes FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "poll_votes_insert_auth" ON event_poll_votes;
CREATE POLICY "poll_votes_insert_auth"
ON event_poll_votes FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "poll_votes_delete_auth" ON event_poll_votes;
CREATE POLICY "poll_votes_delete_auth"
ON event_poll_votes FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_poll_votes_event ON event_poll_votes(event_id);

-- =============================================================
-- EVENT PEOPLE (guards, spectators, passed, training mentions)
-- =============================================================
CREATE TABLE IF NOT EXISTS event_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  role text NOT NULL CHECK (role IN ('guard', 'spectator', 'passed', 'training_mention')),
  -- For passed/training_mention, which sub-exam or activity this applies to
  -- (e.g. "slot_1" for Double Exam, or an event_training_activities.id as text)
  context_key text,

  discord_id text NOT NULL,
  discord_username text,
  roblox_user_id uuid REFERENCES users(id) ON DELETE SET NULL,

  points_awarded integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE event_people ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_people_select_all" ON event_people;
CREATE POLICY "event_people_select_all"
ON event_people FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "event_people_insert_auth" ON event_people;
CREATE POLICY "event_people_insert_auth"
ON event_people FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "event_people_update_auth" ON event_people;
CREATE POLICY "event_people_update_auth"
ON event_people FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "event_people_delete_auth" ON event_people;
CREATE POLICY "event_people_delete_auth"
ON event_people FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_event_people_event ON event_people(event_id);

-- =============================================================
-- TRAINING ACTIVITIES (Training events only)
-- =============================================================
CREATE TABLE IF NOT EXISTS event_training_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  activity_type text NOT NULL CHECK (activity_type IN ('ffa', 'hg', 'glad', 'tdm')),
  sort_order integer NOT NULL DEFAULT 0,

  created_at timestamptz DEFAULT now()
);

ALTER TABLE event_training_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "training_activities_select_all" ON event_training_activities;
CREATE POLICY "training_activities_select_all"
ON event_training_activities FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "training_activities_insert_auth" ON event_training_activities;
CREATE POLICY "training_activities_insert_auth"
ON event_training_activities FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "training_activities_update_auth" ON event_training_activities;
CREATE POLICY "training_activities_update_auth"
ON event_training_activities FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "training_activities_delete_auth" ON event_training_activities;
CREATE POLICY "training_activities_delete_auth"
ON event_training_activities FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_training_activities_event ON event_training_activities(event_id);
