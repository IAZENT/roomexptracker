-- Drop the type CHECK constraint on expenses so custom expense types are allowed.
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_type_check;
