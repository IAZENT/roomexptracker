-- Restrict expense UPDATE/DELETE to only the payer (even owner can't edit others')
DROP POLICY IF EXISTS expenses_update_owner ON expenses;
DROP POLICY IF EXISTS expenses_delete_owner ON expenses;

-- UPDATE: only the expense creator (paid_by) can edit
CREATE POLICY "expenses_update_payer_only"
  ON expenses FOR UPDATE
  USING (
    is_household_member(household_id)
    AND paid_by = auth.uid()
  )
  WITH CHECK (is_household_member(household_id));

-- DELETE: only the expense creator (paid_by) can delete
CREATE POLICY "expenses_delete_payer_only"
  ON expenses FOR DELETE
  USING (
    is_household_member(household_id)
    AND paid_by = auth.uid()
  );
