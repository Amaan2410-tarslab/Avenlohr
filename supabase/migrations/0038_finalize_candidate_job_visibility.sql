-- Finalize candidate job visibility through a trusted helper.
-- Candidate access is limited to open jobs or jobs the candidate has already
-- applied to. The helper bypasses RLS internally so the jobs policy cannot
-- recurse through applications.

create or replace function public.candidate_can_read_job(
  p_job_id uuid,
  p_candidate_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.jobs j
    where j.id = p_job_id
      and (
        j.status = 'open'
        or exists (
          select 1
          from public.applications a
          where a.job_id = j.id
            and a.candidate_id = p_candidate_id
        )
      )
  );
$$;

revoke all on function public.candidate_can_read_job(uuid, uuid) from public, anon;
grant execute on function public.candidate_can_read_job(uuid, uuid) to authenticated;

drop policy if exists "authorized users read jobs" on public.jobs;

create policy "authorized users read jobs"
on public.jobs
for select to authenticated
using (
  public.current_user_role() in ('staff', 'founder')
  or (
    public.current_user_role() = 'candidate'
    and public.candidate_can_read_job(id, (select auth.uid()))
  )
  or (
    public.current_user_role() = 'company'
    and public.company_owns_job(id, (select auth.uid()))
  )
);
