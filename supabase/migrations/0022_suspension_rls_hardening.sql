-- Enforce account suspension at the RLS layer.
-- Suspended users keep an explicit profile row for support visibility, but
-- current_user_role() returns NULL so role-gated data policies deny access.

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.status = 'suspended' then null::public.user_role
    else p.role
  end
  from public.profiles p
  where p.id = (select auth.uid());
$$;

grant execute on function public.current_user_role() to authenticated;

-- Candidate-only self-service read policies.
drop policy if exists "users read own candidate profile" on public.candidate_profiles;
drop policy if exists "staff read candidate profiles" on public.candidate_profiles;
create policy "staff and candidates read candidate profiles"
on public.candidate_profiles
for select to authenticated
using (
  public.current_user_role() in ('staff', 'founder')
  or (public.current_user_role() = 'candidate' and user_id = (select auth.uid()))
);

drop policy if exists "users read own skills" on public.candidate_skills;
drop policy if exists "staff read candidate skills" on public.candidate_skills;
create policy "staff and candidates read candidate skills"
on public.candidate_skills
for select to authenticated
using (
  public.current_user_role() in ('staff', 'founder')
  or (public.current_user_role() = 'candidate' and user_id = (select auth.uid()))
);

-- Company profile read access must not survive suspension.
drop policy if exists "company owners read company" on public.companies;
drop policy if exists "staff read companies" on public.companies;
create policy "staff and companies read companies"
on public.companies
for select to authenticated
using (
  public.current_user_role() in ('staff', 'founder')
  or (public.current_user_role() = 'company' and owner_id = (select auth.uid()))
);

-- Public jobs are visible only to active candidates; internal staff/founders
-- retain administrative visibility and active companies retain own-job visibility.
drop policy if exists "candidates see open jobs" on public.jobs;
drop policy if exists "staff read jobs" on public.jobs;
create policy "authorized users read jobs"
on public.jobs
for select to authenticated
using (
  public.current_user_role() in ('staff', 'founder')
  or (
    public.current_user_role() = 'candidate'
    and (
      status = 'open'
      or exists (
        select 1
        from public.applications a
        where a.job_id = jobs.id
          and a.candidate_id = (select auth.uid())
      )
    )
  )
  or (
    public.current_user_role() = 'company'
    and exists (
      select 1
      from public.companies c
      where c.id = jobs.company_id
        and c.owner_id = (select auth.uid())
    )
  )
);

-- Candidate application history must also honor active candidate role.
drop policy if exists "candidates read own applications" on public.applications;
create policy "candidates read own active applications"
on public.applications
for select to authenticated
using (
  public.current_user_role() = 'candidate'
  and candidate_id = (select auth.uid())
);

-- Moderation reports cannot be created/read by suspended users.
drop policy if exists "reporters create own reports" on public.moderation_reports;
create policy "active users create own reports"
on public.moderation_reports
for insert to authenticated
with check (
  public.current_user_role() is not null
  and reporter_id = (select auth.uid())
);

drop policy if exists "reporters read own reports" on public.moderation_reports;
create policy "active users read own reports"
on public.moderation_reports
for select to authenticated
using (
  reporter_id = (select auth.uid())
  and public.current_user_role() is not null
  or public.current_user_role() in ('staff', 'founder')
);
