-- New public accounts may self-select candidate or company. Staff/founder remain admin-controlled.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.user_role := 'candidate';
begin
  if coalesce(new.raw_user_meta_data ->> 'account_type', '') = 'company' then
    requested_role := 'company';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    requested_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
