-- Close every previously-defined candidate_profiles policy before recreating
-- the candidate boundary. PostgreSQL RLS policies are permissive by default,
-- so an older permissive policy can otherwise bypass a newer WITH CHECK.
drop policy if exists "candidates manage own candidate profile" on public.candidate_profiles;
drop policy if exists "users manage own candidate profile" on public.candidate_profiles;
drop policy if exists "candidates read own candidate profile" on public.candidate_profiles;

create policy "candidates read own candidate profile"
on public.candidate_profiles
for select to authenticated
using (
  user_id = (select auth.uid())
  and public.current_user_role() = 'candidate'
);

create policy "candidates insert own candidate profile"
on public.candidate_profiles
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.current_user_role() = 'candidate'
  and (
    resume_path is null
    or pg_catalog.position(((select auth.uid())::text || '/'), resume_path) = 1
  )
);

create policy "candidates update own candidate profile"
on public.candidate_profiles
for update to authenticated
using (
  user_id = (select auth.uid())
  and public.current_user_role() = 'candidate'
)
with check (
  user_id = (select auth.uid())
  and public.current_user_role() = 'candidate'
  and (
    resume_path is null
    or pg_catalog.position(((select auth.uid())::text || '/'), resume_path) = 1
  )
);

create policy "candidates delete own candidate profile"
on public.candidate_profiles
for delete to authenticated
using (
  user_id = (select auth.uid())
  and public.current_user_role() = 'candidate'
);

-- Keep the trigger as a second, database-level invariant.
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
