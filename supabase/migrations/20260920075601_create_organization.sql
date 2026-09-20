-- Trusted organization create: created_by always comes from auth.uid(), not
-- from client-supplied identity. Local-only; do not apply to production from
-- this milestone.

create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'organization name is required';
  end if;

  insert into public.organizations (name, created_by)
  values (trim(p_name), uid)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated, service_role;
