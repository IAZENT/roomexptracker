-- Room Expense Tracker — initial schema
-- See docs/ARCHITECTURE.md for the full data model rationale.

create extension if not exists "pgcrypto";

-- =========================================================================
-- households
-- =========================================================================
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  cycle_end_day smallint not null check (cycle_end_day between 1 and 31),
  currency text not null default 'NPR',
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

-- =========================================================================
-- household_members
-- =========================================================================
create table household_members (
  household_id uuid not null references households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (household_id, user_id)
);

-- =========================================================================
-- billing_cycles
-- =========================================================================
create table billing_cycles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  cycle_start date not null,
  cycle_end date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  member_count_snapshot smallint,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (household_id, cycle_start)
);

-- =========================================================================
-- fixed_bills
-- =========================================================================
create table fixed_bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  type text not null check (type in ('rent', 'water', 'garbage', 'other')),
  amount numeric(12, 2) not null check (amount >= 0),
  effective_from date not null default current_date,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- expenses
-- =========================================================================
create table expenses (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references billing_cycles (id) on delete cascade,
  household_id uuid not null references households (id) on delete cascade,
  type text not null check (
    type in ('electricity', 'groceries', 'drinking_water', 'other')
  ),
  amount numeric(12, 2) not null check (amount >= 0),
  paid_by uuid not null references auth.users (id),
  description text,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- expense_shares
-- =========================================================================
create table expense_shares (
  expense_id uuid not null references expenses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  share_amount numeric(12, 2) not null check (share_amount >= 0),
  primary key (expense_id, user_id)
);

-- =========================================================================
-- receipts
-- =========================================================================
create table receipts (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references billing_cycles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  itemized_breakdown jsonb not null,
  total_owed numeric(12, 2) not null check (total_owed >= 0),
  generated_at timestamptz not null default now(),
  unique (cycle_id, user_id)
);

-- =========================================================================
-- Indexes
-- =========================================================================
create index idx_household_members_user on household_members (user_id);
create index idx_billing_cycles_household on billing_cycles (household_id, status);
create index idx_fixed_bills_household on fixed_bills (household_id);
create index idx_expenses_cycle on expenses (cycle_id);
create index idx_expense_shares_user on expense_shares (user_id);
create index idx_receipts_user on receipts (user_id);

-- =========================================================================
-- Row Level Security
-- =========================================================================
alter table households enable row level security;
alter table household_members enable row level security;
alter table billing_cycles enable row level security;
alter table fixed_bills enable row level security;
alter table expenses enable row level security;
alter table expense_shares enable row level security;
alter table receipts enable row level security;

-- Helper: is the current user an active member of a household?
create or replace function is_household_member(target_household_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and left_at is null
  );
$$;

-- households: members can read; only the creator can insert; owners can update.
create policy "households_select_members" on households
  for select using (is_household_member(id));

create policy "households_insert_self" on households
  for insert with check (created_by = auth.uid());

create policy "households_update_owner" on households
  for update using (
    exists (
      select 1 from household_members
      where household_id = households.id
        and user_id = auth.uid()
        and role = 'owner'
    )
  );

-- household_members: visible to other members of the same household.
create policy "household_members_select_members" on household_members
  for select using (is_household_member(household_id));

create policy "household_members_insert_self_or_owner" on household_members
  for insert with check (
    user_id = auth.uid() or
    exists (
      select 1 from household_members hm
      where hm.household_id = household_members.household_id
        and hm.user_id = auth.uid()
        and hm.role = 'owner'
    )
  );

-- billing_cycles, fixed_bills, expenses, expense_shares, receipts:
-- readable/writable by any active member of the parent household.
create policy "billing_cycles_all_members" on billing_cycles
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));

create policy "fixed_bills_all_members" on fixed_bills
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));

create policy "expenses_all_members" on expenses
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));

create policy "expense_shares_all_members" on expense_shares
  for all using (
    exists (
      select 1 from expenses
      where expenses.id = expense_shares.expense_id
        and is_household_member(expenses.household_id)
    )
  )
  with check (
    exists (
      select 1 from expenses
      where expenses.id = expense_shares.expense_id
        and is_household_member(expenses.household_id)
    )
  );

-- receipts: a member can only read their own receipt.
create policy "receipts_select_own" on receipts
  for select using (user_id = auth.uid());
