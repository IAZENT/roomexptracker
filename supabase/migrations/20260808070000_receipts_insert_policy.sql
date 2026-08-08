-- Allow household members to insert receipts (server actions run as the user)
create policy "receipts_insert_member" on receipts
  for insert
  with check (
    exists (
      select 1 from billing_cycles
      where billing_cycles.id = receipts.cycle_id
        and is_household_member(billing_cycles.household_id)
    )
  );

-- Cycle close requests: a member proposes, others approve
create table cycle_close_requests (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references billing_cycles (id) on delete cascade,
  requested_by uuid not null references auth.users (id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (cycle_id)
);

create table cycle_close_approvals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references cycle_close_requests (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  approved boolean not null,
  created_at timestamptz not null default now(),
  unique (request_id, user_id)
);

alter table cycle_close_requests enable row level security;
alter table cycle_close_approvals enable row level security;

-- All members can read requests for their household
create policy "close_requests_select_member" on cycle_close_requests
  for select using (
    exists (
      select 1 from billing_cycles
      where billing_cycles.id = cycle_close_requests.cycle_id
        and is_household_member(billing_cycles.household_id)
    )
  );

-- Any member can create a close request
create policy "close_requests_insert_member" on cycle_close_requests
  for insert
  with check (
    exists (
      select 1 from billing_cycles
      where billing_cycles.id = cycle_close_requests.cycle_id
        and is_household_member(billing_cycles.household_id)
    )
  );

-- All members can read approvals for their household's requests
create policy "close_approvals_select_member" on cycle_close_approvals
  for select using (
    exists (
      select 1 from cycle_close_requests
      join billing_cycles on billing_cycles.id = cycle_close_requests.cycle_id
      where cycle_close_requests.id = cycle_close_approvals.request_id
        and is_household_member(billing_cycles.household_id)
    )
  );

-- Any member can insert an approval
create policy "close_approvals_insert_member" on cycle_close_approvals
  for insert
  with check (
    exists (
      select 1 from cycle_close_requests
      join billing_cycles on billing_cycles.id = cycle_close_requests.cycle_id
      where cycle_close_requests.id = cycle_close_approvals.request_id
        and is_household_member(billing_cycles.household_id)
    )
  );
