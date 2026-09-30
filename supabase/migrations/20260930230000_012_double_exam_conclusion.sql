/*
# Double Exam conclusion hardening
Adds a server-side conclusion claim so two browser clicks cannot publish the
same conclusion or award guards/co-hosts points twice.
*/

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS conclusion_claimed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_events_conclusion_claimed
  ON events(conclusion_claimed_at)
  WHERE conclusion_claimed_at IS NOT NULL;
