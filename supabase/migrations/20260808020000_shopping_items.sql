-- Shopping mode: locally-queued items that sync to the DB when online.
-- Each row represents one item a user added while out shopping.

create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  cycle_id uuid references billing_cycles (id) on delete set null,
  name text not null,
  cost numeric(12, 2) not null check (cost >= 0),
  synced boolean not null default false,
  local_id text,
  created_at timestamptz not null default now(),
  synced_at timestamptz
);

create index idx_shopping_items_household on shopping_items (household_id);
create index idx_shopping_items_user on shopping_items (user_id);
create index idx_shopping_items_unsynced on shopping_items (synced) where not synced;

alter table shopping_items enable row level security;

create policy "shopping_items_all_members" on shopping_items
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));
