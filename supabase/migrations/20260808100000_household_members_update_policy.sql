-- household_members had SELECT and INSERT policies only, no UPDATE policy.
-- With RLS enabled, missing a policy for a command means it's silently
-- denied (0 rows match) rather than erroring, so updatePaysFor()'s
-- .update({ pays_for }) call was succeeding with 0 rows affected: no
-- error returned, success toast shown, but nothing actually changed.
--
-- Only the household owner may update member rows (matches the
-- authorization check already done in updatePaysFor() in application
-- code - this makes it enforced at the DB layer too).
create policy "household_members_update_owner"
  on household_members for update
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = household_members.household_id
        and hm.user_id = auth.uid()
        and hm.role = 'owner'
        and hm.left_at is null
    )
  )
  with check (
    exists (
      select 1 from household_members hm
      where hm.household_id = household_members.household_id
        and hm.user_id = auth.uid()
        and hm.role = 'owner'
        and hm.left_at is null
    )
  );
