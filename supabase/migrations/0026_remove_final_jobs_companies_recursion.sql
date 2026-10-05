-- Remove the final jobs -> companies -> jobs RLS recursion path.

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
    and public.company_owns_job(id, (select auth.uid()))
  )
);
