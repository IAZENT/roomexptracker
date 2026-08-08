-- Add pays_for column: array of user_ids this member pays for (including self)
-- e.g. B1 pays for B2: pays_for = [B1_id, B2_id]
-- NULL or empty means member only pays for themselves
ALTER TABLE household_members ADD COLUMN IF NOT EXISTS pays_for uuid[];

COMMENT ON COLUMN household_members.pays_for IS 'Array of user IDs this member covers in expense splits. NULL = only self.';
