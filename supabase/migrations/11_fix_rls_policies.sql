-- Fix expenses RLS: users can only edit/delete their own expenses
-- Drop the overly permissive ALL policy
DROP POLICY IF EXISTS expenses_all_members ON expenses;

-- SELECT: any household member can view expenses
CREATE POLICY "expenses_select_member"
  ON expenses FOR SELECT
  USING (is_household_member(household_id));

-- INSERT: any household member can add expenses
CREATE POLICY "expenses_insert_member"
  ON expenses FOR INSERT
  WITH CHECK (is_household_member(household_id));

-- UPDATE: only the expense creator (paid_by) can edit, or household owner
CREATE POLICY "expenses_update_owner"
  ON expenses FOR UPDATE
  USING (
    is_household_member(household_id)
    AND (
      paid_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM household_members hm
        WHERE hm.household_id = expenses.household_id
        AND hm.user_id = auth.uid()
        AND hm.role = 'owner'
        AND hm.left_at IS NULL
      )
    )
  )
  WITH CHECK (is_household_member(household_id));

-- DELETE: only the expense creator (paid_by) can delete, or household owner
CREATE POLICY "expenses_delete_owner"
  ON expenses FOR DELETE
  USING (
    is_household_member(household_id)
    AND (
      paid_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM household_members hm
        WHERE hm.household_id = expenses.household_id
        AND hm.user_id = auth.uid()
        AND hm.role = 'owner'
        AND hm.left_at IS NULL
      )
    )
  );

-- Fix cycle_close_requests: add UPDATE policy (for approve/reject)
CREATE POLICY "close_requests_update_member"
  ON cycle_close_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM billing_cycles
      WHERE billing_cycles.id = cycle_close_requests.cycle_id
      AND is_household_member(billing_cycles.household_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM billing_cycles
      WHERE billing_cycles.id = cycle_close_requests.cycle_id
      AND is_household_member(billing_cycles.household_id)
    )
  );

-- Fix cycle_close_approvals: add UPDATE policy (for toggling vote)
CREATE POLICY "close_approvals_update_member"
  ON cycle_close_approvals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM cycle_close_requests
      JOIN billing_cycles ON billing_cycles.id = cycle_close_requests.cycle_id
      WHERE cycle_close_requests.id = cycle_close_approvals.request_id
      AND is_household_member(billing_cycles.household_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cycle_close_requests
      JOIN billing_cycles ON billing_cycles.id = cycle_close_requests.cycle_id
      WHERE cycle_close_requests.id = cycle_close_approvals.request_id
      AND is_household_member(billing_cycles.household_id)
    )
  );
