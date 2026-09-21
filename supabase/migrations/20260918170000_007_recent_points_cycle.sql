/*
# Recent Points (2-week reset cycle)

## New Function
`get_user_recent_points(p_user_id uuid)` - sums a user's point_transactions since
the start of the current 2-week cycle. Cycles are anchored to Friday, 2026-09-18
(the last reset at the time this was added) and repeat every 14 days from there,
so the boundary always falls on a Friday, 2 weeks after the previous one.

## Notes
- This does not delete or archive old transactions - "recent points" is simply a
  different window over the same point_transactions table used for total points.
  Total points (get_user_military_points) is unaffected and still sums everything.
*/

CREATE OR REPLACE FUNCTION get_current_points_cycle_start()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT '2026-09-18 00:00:00+00'::timestamptz
    + floor(
        extract(epoch FROM (now() - '2026-09-18 00:00:00+00'::timestamptz)) / (14 * 86400)
      ) * interval '14 days';
$$;

CREATE OR REPLACE FUNCTION get_user_recent_points(p_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(points), 0)::integer
  FROM point_transactions
  WHERE user_id = p_user_id
    AND created_at >= get_current_points_cycle_start();
$$;
