/*
# Recent Points: Change Cycle Length to 4 Weeks

## Changes
1. `get_current_points_cycle_start()` now uses a 28-day (4-week) cycle instead of
   14 days (2 weeks). Still anchored to Friday 2026-09-18, so every boundary
   continues to land on a Friday.
*/

CREATE OR REPLACE FUNCTION get_current_points_cycle_start()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT '2026-09-18 00:00:00+00'::timestamptz
    + floor(
        extract(epoch FROM (now() - '2026-09-18 00:00:00+00'::timestamptz)) / (28 * 86400)
      ) * interval '28 days';
$$;
