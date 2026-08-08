-- Previously only the payer could update/delete an expense (even the
-- household owner couldn't touch someone else's). Per user request,
-- the owner should also be able to edit/delete any expense in their
-- household - in addition to the payer, not instead of.
drop policy if exists "expenses_update_payer_only" on expenses;
drop policy if exists "expenses_delete_payer_only" on expenses;

create policy "expenses_update_payer_or_owner"
  on expenses for update
  using (
    is_household_member(household_id)
    and (
      paid_by = auth.uid()
      or exists (
        select 1 from household_members hm
        where hm.household_id = expenses.household_id
          and hm.user_id = auth.uid()
          and hm.role = 'owner'
          and hm.left_at is null
      )
    )
  )
  with check (is_household_member(household_id));

create policy "expenses_delete_payer_or_owner"
  on expenses for delete
  using (
    is_household_member(household_id)
    and (
      paid_by = auth.uid()
      or exists (
        select 1 from household_members hm
        where hm.household_id = expenses.household_id
          and hm.user_id = auth.uid()
          and hm.role = 'owner'
          and hm.left_at is null
      )
    )
  );
