-- settled_debts: tracks which debts have been settled in a cycle
CREATE TABLE IF NOT EXISTS settled_debts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cycle_id UUID NOT NULL REFERENCES billing_cycles(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  settled_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cycle_id, from_user_id, to_user_id)
);

ALTER TABLE settled_debts ENABLE ROW LEVEL SECURITY;

-- Members of the household can view settled debts
CREATE POLICY "Members can view settled debts"
  ON settled_debts FOR SELECT
  USING (
    cycle_id IN (
      SELECT bc.id FROM billing_cycles bc
      JOIN households h ON h.id = bc.household_id
      JOIN household_members hm ON hm.household_id = h.id
      WHERE hm.user_id = auth.uid()
      AND hm.left_at IS NULL
    )
  );

-- Members can insert settled debts (validates from/to are active members)
CREATE POLICY "Members can settle debts"
  ON settled_debts FOR INSERT
  WITH CHECK (
    cycle_id IN (
      SELECT bc.id FROM billing_cycles bc
      JOIN households h ON h.id = bc.household_id
      JOIN household_members hm ON hm.household_id = h.id
      WHERE hm.user_id = auth.uid()
      AND hm.left_at IS NULL
    )
    AND from_user_id IN (
      SELECT hm2.user_id FROM household_members hm2
      JOIN billing_cycles bc2 ON bc2.household_id = hm2.household_id
      WHERE bc2.id = cycle_id AND hm2.left_at IS NULL
    )
    AND to_user_id IN (
      SELECT hm3.user_id FROM household_members hm3
      JOIN billing_cycles bc3 ON bc3.household_id = hm3.household_id
      WHERE bc3.id = cycle_id AND hm3.left_at IS NULL
    )
    AND from_user_id <> to_user_id
  );
