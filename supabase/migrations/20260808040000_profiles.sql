create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can view all profiles"
  on profiles for select
  using (true);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = user_id);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = user_id);
