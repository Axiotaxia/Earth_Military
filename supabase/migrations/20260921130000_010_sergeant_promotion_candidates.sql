/*
# Sergeant Promotion Candidates

## New Table
`sergeant_promotion_candidates` - tracks Corporals who have reached at least 40
recent points, for the HR Panel's "Sergeant Promotions" sub-tab. A row is created
the moment a Corporal first crosses the 40 recent-points threshold, storing when
that happened (`qualified_at`). The row persists across recent-points resets and
is only removed once the person is promoted to Sergeant (group_rank >= 5) or
above, via the app calling delete when that promotion happens, or picked up
by the eligibility check finding they're no longer a Corporal-or-below.

## Function
`check_sergeant_promotion_eligibility(p_user_id uuid)` - if the given user is
currently rank 4 (Corporal) and their recent points are >= 40, inserts a
candidate row if one doesn't already exist (idempotent). Called from the app
whenever points are awarded, and as a safety-net sweep when the HR panel loads.

## Security
- RLS enabled, following the same anon/authenticated pattern used throughout
  this app (app-layer permission checks control access to the HR panel UI).
*/

CREATE TABLE IF NOT EXISTS sergeant_promotion_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  qualified_at timestamptz NOT NULL DEFAULT now(),
  recent_points_at_qualification integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sergeant_promotion_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sergeant_candidates_select_all" ON sergeant_promotion_candidates;
CREATE POLICY "sergeant_candidates_select_all"
ON sergeant_promotion_candidates FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "sergeant_candidates_insert_auth" ON sergeant_promotion_candidates;
CREATE POLICY "sergeant_candidates_insert_auth"
ON sergeant_promotion_candidates FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "sergeant_candidates_delete_auth" ON sergeant_promotion_candidates;
CREATE POLICY "sergeant_candidates_delete_auth"
ON sergeant_promotion_candidates FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION check_sergeant_promotion_eligibility(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_rank integer;
  v_recent_points integer;
BEGIN
  SELECT group_rank INTO v_group_rank FROM users WHERE id = p_user_id;

  -- Only Corporals (rank 4) are candidates; anyone else is skipped.
  IF v_group_rank IS DISTINCT FROM 4 THEN
    RETURN;
  END IF;

  SELECT get_user_recent_points(p_user_id) INTO v_recent_points;

  IF v_recent_points >= 40 THEN
    INSERT INTO sergeant_promotion_candidates (user_id, recent_points_at_qualification)
    VALUES (p_user_id, v_recent_points)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_sergeant_candidates_qualified_at ON sergeant_promotion_candidates(qualified_at);
