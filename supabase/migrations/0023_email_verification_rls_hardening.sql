-- Enforce email verification for public candidate/company accounts.
-- Internal staff/founder accounts remain usable because they are provisioned
-- through a controlled administrative process.

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.status = 'suspended' then null::public.user_role
    when p.role in ('staff', 'founder') then p.role
    when u.email_confirmed_at is null then null::public.user_role
    else p.role
  end
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = (select auth.uid());
$$;

grant execute on function public.current_user_role() to authenticated;
