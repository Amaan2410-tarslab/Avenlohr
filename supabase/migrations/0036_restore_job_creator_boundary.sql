-- Restore the job creator ownership check after splitting company job
-- policies. A company may create jobs only as the authenticated creator.

drop policy if exists "companies create own jobs" on public.jobs;

create policy "companies create own jobs"
on public.jobs
for insert to authenticated
with check (
  public.current_user_role() = 'company'
  and created_by = (select auth.uid())
  and exists (
    select 1
    from public.companies c
    where c.id = company_id
      and c.owner_id = (select auth.uid())
  )
);
