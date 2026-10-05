-- Break the jobs <-> applications RLS recursion.
-- This helper intentionally runs as the trusted database owner so a jobs policy
-- can ask whether the current candidate has an application without re-entering
-- application RLS policies.

create or replace function public.candidate_has_job_application(
  p_job_id uuid,
  p_candidate_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.applications a
    where a.job_id = p_job_id
      and a.candidate_id = p_candidate_id
  );
$$;

revoke all on function public.candidate_has_job_application(uuid, uuid) from public, anon;
grant execute on function public.candidate_has_job_application(uuid, uuid) to authenticated;

drop policy if exists "candidates read applied jobs" on public.jobs;
drop policy if exists "authorized users read jobs" on public.jobs;

create policy "authorized users read jobs"
on public.jobs
for select to authenticated
using (
  public.current_user_role() in ('staff', 'founder')
  or (
    public.current_user_role() = 'candidate'
    and (
      status = 'open'
      or public.candidate_has_job_application(id, (select auth.uid()))
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
