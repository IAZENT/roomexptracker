-- Add metadata column to expenses for storing shopping item breakdown
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS metadata jsonb;

COMMENT ON COLUMN expenses.metadata IS 'Optional metadata, e.g. shopping items breakdown: [{name, cost}]';
