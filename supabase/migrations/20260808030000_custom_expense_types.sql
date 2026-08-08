-- Custom expense types: user-defined categories beyond the defaults.
-- Each household can have its own set of custom types.

create table custom_expense_types (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (household_id, name)
);

create index idx_custom_expense_types_household on custom_expense_types (household_id);

alter table custom_expense_types enable row level security;

create policy "custom_expense_types_all_members" on custom_expense_types
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));
