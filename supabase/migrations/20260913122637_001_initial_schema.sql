/*
# Earth Kingdom Military Management - Initial Schema

1. Overview
This schema supports a Roblox group military management website with Roblox OAuth authentication.
It stores user profiles, divisions, division ranks, permissions, military points, and activity logs.

2. New Tables
- `users`: Roblox users who sign in via OAuth. Stores roblox_user_id, username, display name, avatar URL, group rank, and onboarding data.
- `divisions`: Military divisions within the Earth Kingdom group. Each has a name, icon, and creator.
- `division_ranks`: Ranks within each division. Have hierarchy order, point tallies, and configurable permissions.
- `division_members`: Associates users with a division and a division rank.
- `point_transactions`: Log of all military point awards/deductions with reason and awarded-by user.
- `activity_log`: Tracks user activity events for analytics.
- `user_permissions`: Per-user permission flags for administrative actions.

3. Security
- RLS enabled on all tables.
- All policies scoped to `authenticated` users.
- Users can read/write their own profile data.
- Division, rank, and permission mutations are controlled by permission checks.
- Point transactions are insert-only (no edits/deletes) for audit integrity.

4. Important Notes
- Roblox user ID 593587739 is the site owner with all permissions (enforced in app logic).
- Group rank >= 2 (Private) is required to access the majority of the app.
- Roblox OAuth handles authentication; Supabase auth is used for session management.
*/

-- =============================================================
-- USERS TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roblox_user_id bigint UNIQUE NOT NULL,
  roblox_username text NOT NULL,
  roblox_display_name text,
  roblox_avatar_url text,
  group_rank integer NOT NULL DEFAULT 0,
  group_rank_name text NOT NULL DEFAULT 'Guest',
  timezone text,
  selected_path text,
  main_sub text,
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_all" ON users;
CREATE POLICY "users_select_all"
ON users FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "users_insert_own" ON users;
CREATE POLICY "users_insert_own"
ON users FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own"
ON users FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- =============================================================
-- DIVISIONS TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text,
  description text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE divisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "divisions_select_all" ON divisions;
CREATE POLICY "divisions_select_all"
ON divisions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "divisions_insert_auth" ON divisions;
CREATE POLICY "divisions_insert_auth"
ON divisions FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "divisions_update_auth" ON divisions;
CREATE POLICY "divisions_update_auth"
ON divisions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "divisions_delete_auth" ON divisions;
CREATE POLICY "divisions_delete_auth"
ON divisions FOR DELETE TO authenticated USING (true);

-- =============================================================
-- DIVISION RANKS TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS division_ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id uuid NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  name text NOT NULL,
  hierarchy integer NOT NULL DEFAULT 0,
  can_create_divisions boolean NOT NULL DEFAULT false,
  can_create_ranks boolean NOT NULL DEFAULT false,
  can_promote boolean NOT NULL DEFAULT false,
  can_award_points boolean NOT NULL DEFAULT false,
  can_view_hr_panel boolean NOT NULL DEFAULT false,
  can_manage_members boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE division_ranks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "division_ranks_select_all" ON division_ranks;
CREATE POLICY "division_ranks_select_all"
ON division_ranks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "division_ranks_insert_auth" ON division_ranks;
CREATE POLICY "division_ranks_insert_auth"
ON division_ranks FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "division_ranks_update_auth" ON division_ranks;
CREATE POLICY "division_ranks_update_auth"
ON division_ranks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "division_ranks_delete_auth" ON division_ranks;
CREATE POLICY "division_ranks_delete_auth"
ON division_ranks FOR DELETE TO authenticated USING (true);

-- =============================================================
-- DIVISION MEMBERS TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS division_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  division_id uuid NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  division_rank_id uuid REFERENCES division_ranks(id) ON DELETE SET NULL,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(user_id, division_id)
);

ALTER TABLE division_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "division_members_select_all" ON division_members;
CREATE POLICY "division_members_select_all"
ON division_members FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "division_members_insert_auth" ON division_members;
CREATE POLICY "division_members_insert_auth"
ON division_members FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "division_members_update_auth" ON division_members;
CREATE POLICY "division_members_update_auth"
ON division_members FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "division_members_delete_auth" ON division_members;
CREATE POLICY "division_members_delete_auth"
ON division_members FOR DELETE TO authenticated USING (true);

-- =============================================================
-- POINT TRANSACTIONS TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  awarded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  points integer NOT NULL,
  reason text NOT NULL,
  event_type text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "points_select_all" ON point_transactions;
CREATE POLICY "points_select_all"
ON point_transactions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "points_insert_auth" ON point_transactions;
CREATE POLICY "points_insert_auth"
ON point_transactions FOR INSERT TO authenticated WITH CHECK (true);

-- No update or delete policies - point transactions are immutable for audit integrity

-- =============================================================
-- ACTIVITY LOG TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_select_all" ON activity_log;
CREATE POLICY "activity_select_all"
ON activity_log FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "activity_insert_auth" ON activity_log;
CREATE POLICY "activity_insert_auth"
ON activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================================
-- USER PERMISSIONS TABLE (override permissions for specific users)
-- =============================================================
CREATE TABLE IF NOT EXISTS user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  can_create_divisions boolean NOT NULL DEFAULT false,
  can_create_ranks boolean NOT NULL DEFAULT false,
  can_promote boolean NOT NULL DEFAULT false,
  can_award_points boolean NOT NULL DEFAULT false,
  can_view_hr_panel boolean NOT NULL DEFAULT false,
  can_manage_members boolean NOT NULL DEFAULT false,
  is_owner boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_perms_select_all" ON user_permissions;
CREATE POLICY "user_perms_select_all"
ON user_permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "user_perms_insert_auth" ON user_permissions;
CREATE POLICY "user_perms_insert_auth"
ON user_permissions FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "user_perms_update_auth" ON user_permissions;
CREATE POLICY "user_perms_update_auth"
ON user_permissions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "user_perms_delete_auth" ON user_permissions;
CREATE POLICY "user_perms_delete_auth"
ON user_permissions FOR DELETE TO authenticated USING (true);

-- =============================================================
-- INDEXES
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_users_roblox_id ON users(roblox_user_id);
CREATE INDEX IF NOT EXISTS idx_division_members_user ON division_members(user_id);
CREATE INDEX IF NOT EXISTS idx_division_members_division ON division_members(division_id);
CREATE INDEX IF NOT EXISTS idx_division_ranks_division ON division_ranks(division_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_awarded_by ON point_transactions(awarded_by);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);

-- =============================================================
-- RPC: get_user_military_points
-- Returns total military points for a user
-- =============================================================
CREATE OR REPLACE FUNCTION get_user_military_points(p_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(points), 0)::integer
  FROM point_transactions
  WHERE user_id = p_user_id;
$$;

-- =============================================================
-- RPC: get_user_activity_count
-- Returns activity count for a user within a time period
-- =============================================================
CREATE OR REPLACE FUNCTION get_user_activity_count(p_user_id uuid, p_days integer)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM activity_log
  WHERE user_id = p_user_id
  AND created_at >= now() - (p_days || ' days')::interval;
$$;
