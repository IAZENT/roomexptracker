-- Adds invite codes so roommates can join an existing household, plus
-- atomic create/join RPCs (avoids exposing a broad "select any household"
-- RLS policy just for code lookup).

alter table households add column invite_code text unique;

create or replace function generate_invite_code()
returns text
language sql
volatile
as $$
  select upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
$$;

create or replace function set_invite_code()
returns trigger
language plpgsql
as $$
begin
  if new.invite_code is null then
    new.invite_code := generate_invite_code();
  end if;
  return new;
end;
$$;

create trigger households_set_invite_code
  before insert on households
  for each row
  execute function set_invite_code();

-- Atomically creates a household and adds the caller as its owner.
create or replace function create_household(
  p_name text,
  p_cycle_end_day smallint,
  p_currency text default 'NPR'
)
returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  h households;
begin
  insert into households (name, created_by, cycle_end_day, currency)
  values (p_name, auth.uid(), p_cycle_end_day, p_currency)
  returning * into h;

  insert into household_members (household_id, user_id, role)
  values (h.id, auth.uid(), 'owner');

  return h;
end;
$$;

grant execute on function create_household(text, smallint, text) to authenticated;

-- Looks up a household by invite code and adds the caller as a member.
-- SECURITY DEFINER so the caller doesn't need read access to households
-- they aren't a member of yet just to look up the code.
create or replace function join_household_by_code(p_code text)
returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  h households;
begin
  select * into h from households
  where invite_code = upper(p_code) and archived_at is null;

  if h.id is null then
    raise exception 'Invalid or expired invite code';
  end if;

  insert into household_members (household_id, user_id, role)
  values (h.id, auth.uid(), 'member')
  on conflict (household_id, user_id) do update set left_at = null;

  return h;
end;
$$;

grant execute on function join_household_by_code(text) to authenticated;
