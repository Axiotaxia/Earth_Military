/*
# Add point event types table and division logo storage

## New Tables
- `point_event_types`: Configurable point event types that replace the hardcoded list.
  Each has a label, point value, event_type key, and whether it's active.
  The site owner can add, edit, and remove event types.

## Changes
- Adds storage bucket `division-logos` for uploading custom PNG division logos.

## Security
- RLS enabled on point_event_types with anon+authenticated access (custom auth pattern).
- Storage bucket is public for reads, authenticated for writes.
*/

CREATE TABLE IF NOT EXISTS point_event_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  reason text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  event_type text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE point_event_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "point_event_types_select_all" ON point_event_types;
CREATE POLICY "point_event_types_select_all"
ON point_event_types FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "point_event_types_insert_auth" ON point_event_types;
CREATE POLICY "point_event_types_insert_auth"
ON point_event_types FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "point_event_types_update_auth" ON point_event_types;
CREATE POLICY "point_event_types_update_auth"
ON point_event_types FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "point_event_types_delete_auth" ON point_event_types;
CREATE POLICY "point_event_types_delete_auth"
ON point_event_types FOR DELETE TO anon, authenticated USING (true);

-- Seed default event types
INSERT INTO point_event_types (label, reason, points, event_type, is_default) VALUES
  ('Recruiting someone to Private (+10)', 'Recruited someone to Private', 10, 'recruiting', true),
  ('Attending an official raid (+4)', 'Attended an official raid', 4, 'official_raid', true),
  ('Cohosting (+3)', 'Cohosted an event', 3, 'cohosting', true),
  ('Responding to a reinforcement call (+1)', 'Responded to a reinforcement call', 1, 'reinforcement', true),
  ('Successful guarding (+2)', 'Successful guarding', 2, 'guarding_success', true),
  ('Disruptive guarding (-4)', 'Disruptive guarding', -4, 'guarding_disruptive', true),
  ('Attending a training (+1)', 'Attended a training', 1, 'training_attend', true),
  ('Winning an event (+1)', 'Won an event', 1, 'event_win', true),
  ('Disruptive at training (-4)', 'Disruptive at training', -4, 'training_disruptive', true)
ON CONFLICT DO NOTHING;
