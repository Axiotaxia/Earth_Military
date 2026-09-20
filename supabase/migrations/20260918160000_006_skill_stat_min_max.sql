/*
# Damage Calculator: Optional Min/Max for Scaling Stats

## Changes
1. `skill_stats.min_value` and `skill_stats.max_value` - optional clamp bounds for
   scaling stats. When set, the computed value (base + strength * scale) is clamped
   to [min_value, max_value]. Either bound can be left unset (null) to be one-sided
   or fully unbounded. Not used for static stats.
*/

ALTER TABLE skill_stats ADD COLUMN IF NOT EXISTS min_value numeric;
ALTER TABLE skill_stats ADD COLUMN IF NOT EXISTS max_value numeric;
