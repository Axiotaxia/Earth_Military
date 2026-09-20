/*
# Damage Calculator: Skills + Stats

## New Tables
1. `skills` - a named ability/skill with a title, description, and sub element
   (Base, Lava, Metal, Sand). Managed by the site owner only (enforced at the
   app layer, consistent with the rest of this project).
2. `skill_stats` - one or more stats belonging to a skill. Each stat is either:
   - a scaling stat: value = base_value + strength * scale_value
   - a static stat: value = static_value (fixed, ignores strength)

## Security
- RLS enabled, following the same anon/authenticated read+write pattern used
  throughout this app (app-layer permission checks control writes).
*/

CREATE TABLE IF NOT EXISTS skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  sub_element text NOT NULL CHECK (sub_element IN ('Base', 'Lava', 'Metal', 'Sand')),
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skills_select_all" ON skills;
CREATE POLICY "skills_select_all"
ON skills FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "skills_insert_auth" ON skills;
CREATE POLICY "skills_insert_auth"
ON skills FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "skills_update_auth" ON skills;
CREATE POLICY "skills_update_auth"
ON skills FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "skills_delete_auth" ON skills;
CREATE POLICY "skills_delete_auth"
ON skills FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS skill_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_scaling boolean NOT NULL DEFAULT true,
  base_value numeric NOT NULL DEFAULT 0,
  scale_value numeric NOT NULL DEFAULT 0,
  static_value numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE skill_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skill_stats_select_all" ON skill_stats;
CREATE POLICY "skill_stats_select_all"
ON skill_stats FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "skill_stats_insert_auth" ON skill_stats;
CREATE POLICY "skill_stats_insert_auth"
ON skill_stats FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "skill_stats_update_auth" ON skill_stats;
CREATE POLICY "skill_stats_update_auth"
ON skill_stats FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "skill_stats_delete_auth" ON skill_stats;
CREATE POLICY "skill_stats_delete_auth"
ON skill_stats FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_skills_sort ON skills(sort_order);
CREATE INDEX IF NOT EXISTS idx_skill_stats_skill_id ON skill_stats(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_stats_sort ON skill_stats(sort_order);
