/*
# Divisions Enhancements + Configurable Point Event Types

## Changes
1. `divisions.logo_url` - optional URL to a custom PNG/image logo for a division.
2. `can_edit_point_types` permission added to `division_ranks` and `user_permissions`,
   controlling who may add/edit/remove default military point event types.
3. New `point_event_types` table - replaces the hardcoded list of point award reasons
   with a database-backed, editable list (label, points, event_type key, reason text).
   Seeded with the existing default reasons so behavior is unchanged until edited.

## Security
- RLS enabled on `point_event_types`, following the same anon/authenticated pattern
  as other tables in this app (app-layer permission checks control writes).
*/

-- =============================================================
-- DIVISIONS: custom logo URL
-- =============================================================
ALTER TABLE divisions ADD COLUMN IF NOT EXISTS logo_url text;

-- =============================================================
-- PERMISSION: can_edit_point_types
-- =============================================================
ALTER TABLE division_ranks ADD COLUMN IF NOT EXISTS can_edit_point_types boolean NOT NULL DEFAULT false;
ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS can_edit_point_types boolean NOT NULL DEFAULT false;

-- =============================================================
-- POINT EVENT TYPES TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS point_event_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  reason text NOT NULL,
  points integer NOT NULL,
  event_type text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
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

-- Seed with the existing hardcoded defaults (idempotent on event_type)
INSERT INTO point_event_types (label, reason, points, event_type, sort_order) VALUES
  ('Recruiting someone to Private (+10)', 'Recruited someone to Private', 10, 'recruiting', 1),
  ('Attending an official raid (+4)', 'Attended an official raid', 4, 'official_raid', 2),
  ('Cohosting (+3)', 'Cohosted an event', 3, 'cohosting', 3),
  ('Responding to a reinforcement call (+1)', 'Responded to a reinforcement call', 1, 'reinforcement', 4),
  ('Successful guarding (+2)', 'Successful guarding', 2, 'guarding_success', 5),
  ('Disruptive guarding (-4)', 'Disruptive guarding', -4, 'guarding_disruptive', 6),
  ('Attending a training (+1)', 'Attended a training', 1, 'training_attend', 7),
  ('Winning an event (+1)', 'Won an event', 1, 'event_win', 8),
  ('Disruptive at training (-4)', 'Disruptive at training', -4, 'training_disruptive', 9)
ON CONFLICT (event_type) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_point_event_types_sort ON point_event_types(sort_order);
