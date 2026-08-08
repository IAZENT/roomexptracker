-- cycle_close_requests.cycle_id has a UNIQUE constraint (one row per
-- cycle, ever), so once a request was rejected, requesting a close
-- again for that same cycle hit "duplicate key value violates unique
-- constraint" - it was permanently impossible after a single decline.
--
-- Fix: track when a request was decided, so the app can reuse the
-- existing row (reset it to pending) after a cooldown period instead
-- of trying to insert a second row for the same cycle.
alter table cycle_close_requests add column if not exists decided_at timestamptz;
