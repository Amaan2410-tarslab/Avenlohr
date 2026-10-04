-- Prevent application candidate-role validation from re-entering profile
-- applicant-visibility policies, which themselves reference applications.

create or replace function public.validate_application_candidate_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = new.candidate_id
      and p.role = 'candidate'
      and p.status <> 'suspended'
  ) then
    raise exception 'application candidate must have an active candidate role';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_application_candidate_role() from public, anon, authenticated;
