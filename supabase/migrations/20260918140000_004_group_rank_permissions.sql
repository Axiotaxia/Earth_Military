/*
# Roblox Group Rank Permissions

## Changes
1. New `group_rank_permissions` table - lets the site owner grant the same permission
   set (can_promote, can_award_points, etc.) to everyone holding a specific Roblox
   group rank, independent of division membership. One row per rank number.

## Notes
- Only the owner manages this (enforced at the app layer via the Admin Panel, same
  pattern as other tables in this app).
- Effective permissions for a user are the union (OR) of: their individual
  user_permissions row, their group rank's permissions (if any), and their division
  rank's permissions (if any). Any one of the three granting a permission is enough.
*/

CREATE TABLE IF NOT EXISTS group_rank_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_rank integer NOT NULL UNIQUE,
  can_create_divisions boolean NOT NULL DEFAULT false,
  can_create_ranks boolean NOT NULL DEFAULT false,
  can_promote boolean NOT NULL DEFAULT false,
  can_award_points boolean NOT NULL DEFAULT false,
  can_view_hr_panel boolean NOT NULL DEFAULT false,
  can_manage_members boolean NOT NULL DEFAULT false,
  can_edit_point_types boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE group_rank_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_rank_permissions_select_all" ON group_rank_permissions;
CREATE POLICY "group_rank_permissions_select_all"
ON group_rank_permissions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "group_rank_permissions_insert_auth" ON group_rank_permissions;
CREATE POLICY "group_rank_permissions_insert_auth"
ON group_rank_permissions FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "group_rank_permissions_update_auth" ON group_rank_permissions;
CREATE POLICY "group_rank_permissions_update_auth"
ON group_rank_permissions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "group_rank_permissions_delete_auth" ON group_rank_permissions;
CREATE POLICY "group_rank_permissions_delete_auth"
ON group_rank_permissions FOR DELETE TO anon, authenticated USING (true);
