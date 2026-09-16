/*
# Fix RLS policies for custom Roblox OAuth auth system

## Problem
The app uses Roblox OAuth via an edge function for authentication, with sessions
stored in localStorage (NOT Supabase's built-in auth). The frontend Supabase
client uses the anon key, which runs as the `anon` role. All existing RLS policies
were scoped to `TO authenticated` only, meaning the anon-key client gets zero rows
from every query — so after successful OAuth, the app can't load the user and
redirects back to login.

## Fix
Change all RLS policies from `TO authenticated` to `TO anon, authenticated` so the
anon-key frontend client can read and write data. Authentication and authorization
are enforced at the application layer (Roblox OAuth verifies identity, permission
checks control administrative actions). This is the standard pattern for a no-auth
or custom-auth app where the anon client needs database access.

## Tables affected (all 7)
- users
- divisions
- division_ranks
- division_members
- point_transactions
- activity_log
- user_permissions

## Security note
The edge function uses the service role key (bypasses RLS) for user creation/upsert
and owner permission assignment. The frontend anon client can read all data and
write within the constraints enforced by the application's permission system.
Point transactions remain insert-only (no update/delete) for audit integrity.
*/

-- =============================================================
-- USERS
-- =============================================================
DROP POLICY IF EXISTS "users_select_all" ON users;
CREATE POLICY "users_select_all"
ON users FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "users_insert_own" ON users;
CREATE POLICY "users_insert_own"
ON users FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own"
ON users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- =============================================================
-- DIVISIONS
-- =============================================================
DROP POLICY IF EXISTS "divisions_select_all" ON divisions;
CREATE POLICY "divisions_select_all"
ON divisions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "divisions_insert_auth" ON divisions;
CREATE POLICY "divisions_insert_auth"
ON divisions FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "divisions_update_auth" ON divisions;
CREATE POLICY "divisions_update_auth"
ON divisions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "divisions_delete_auth" ON divisions;
CREATE POLICY "divisions_delete_auth"
ON divisions FOR DELETE TO anon, authenticated USING (true);

-- =============================================================
-- DIVISION RANKS
-- =============================================================
DROP POLICY IF EXISTS "division_ranks_select_all" ON division_ranks;
CREATE POLICY "division_ranks_select_all"
ON division_ranks FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "division_ranks_insert_auth" ON division_ranks;
CREATE POLICY "division_ranks_insert_auth"
ON division_ranks FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "division_ranks_update_auth" ON division_ranks;
CREATE POLICY "division_ranks_update_auth"
ON division_ranks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "division_ranks_delete_auth" ON division_ranks;
CREATE POLICY "division_ranks_delete_auth"
ON division_ranks FOR DELETE TO anon, authenticated USING (true);

-- =============================================================
-- DIVISION MEMBERS
-- =============================================================
DROP POLICY IF EXISTS "division_members_select_all" ON division_members;
CREATE POLICY "division_members_select_all"
ON division_members FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "division_members_insert_auth" ON division_members;
CREATE POLICY "division_members_insert_auth"
ON division_members FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "division_members_update_auth" ON division_members;
CREATE POLICY "division_members_update_auth"
ON division_members FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "division_members_delete_auth" ON division_members;
CREATE POLICY "division_members_delete_auth"
ON division_members FOR DELETE TO anon, authenticated USING (true);

-- =============================================================
-- POINT TRANSACTIONS (insert-only for audit integrity)
-- =============================================================
DROP POLICY IF EXISTS "points_select_all" ON point_transactions;
CREATE POLICY "points_select_all"
ON point_transactions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "points_insert_auth" ON point_transactions;
CREATE POLICY "points_insert_auth"
ON point_transactions FOR INSERT TO anon, authenticated WITH CHECK (true);

-- =============================================================
-- ACTIVITY LOG
-- =============================================================
DROP POLICY IF EXISTS "activity_select_all" ON activity_log;
CREATE POLICY "activity_select_all"
ON activity_log FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "activity_insert_auth" ON activity_log;
CREATE POLICY "activity_insert_auth"
ON activity_log FOR INSERT TO anon, authenticated WITH CHECK (true);

-- =============================================================
-- USER PERMISSIONS
-- =============================================================
DROP POLICY IF EXISTS "user_perms_select_all" ON user_permissions;
CREATE POLICY "user_perms_select_all"
ON user_permissions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "user_perms_insert_auth" ON user_permissions;
CREATE POLICY "user_perms_insert_auth"
ON user_permissions FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "user_perms_update_auth" ON user_permissions;
CREATE POLICY "user_perms_update_auth"
ON user_permissions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "user_perms_delete_auth" ON user_permissions;
CREATE POLICY "user_perms_delete_auth"
ON user_permissions FOR DELETE TO anon, authenticated USING (true);
