-- Resume metadata must be owned by the authenticated candidate.
-- Enforce this in both RLS and the trigger so the invariant does not depend
-- on trigger execution alone.

drop policy if exists "candidates manage own candidate profile" on public.candidate_profiles;
create policy "candidates manage own candidate profile"
on public.candidate_profiles
for all to authenticated
using (
  user_id = (select auth.uid())
  and public.current_user_role() = 'candidate'
)
with check (
  user_id = (select auth.uid())
  and public.current_user_role() = 'candidate'
  and (
    resume_path is null
    or pg_catalog.position(
      ((select auth.uid())::text || '/'),
      resume_path
    ) = 1
  )
);

create or replace function public.protect_resume_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_prefix text;
begin
  expected_prefix := new.user_id::text || '/';
  if new.resume_path is not null
     and pg_catalog.position(expected_prefix, new.resume_path) <> 1 then
    raise exception 'resume_path must belong to candidate storage folder';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_resume_path() from public, anon, authenticated;
