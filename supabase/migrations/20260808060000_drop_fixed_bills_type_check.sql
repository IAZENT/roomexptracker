-- Drop the type CHECK constraint on fixed_bills so custom bill types are allowed.
ALTER TABLE fixed_bills DROP CONSTRAINT IF EXISTS fixed_bills_type_check;
