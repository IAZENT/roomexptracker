-- Update join_household_by_code to accept pays_for parameter
CREATE OR REPLACE FUNCTION join_household_by_code(p_code text, p_pays_for uuid[] DEFAULT NULL)
RETURNS households
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  h households;
begin
  select * into h from households
  where invite_code = upper(p_code) and archived_at is null;

  if h.id is null then
    raise exception 'Invalid or expired invite code';
  end if;

  insert into household_members (household_id, user_id, role, pays_for)
  values (h.id, auth.uid(), 'member', p_pays_for)
  on conflict (household_id, user_id) do update set left_at = null, pays_for = p_pays_for;

  return h;
end;
$$;
