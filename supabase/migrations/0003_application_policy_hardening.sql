-- Candidates may apply only to currently open jobs and must not be able to set review decisions.
drop policy if exists "candidates manage own applications" on public.applications;

create policy "candidates read own applications"
on public.applications
for select to authenticated
using (candidate_id = auth.uid());

create policy "candidates apply to open jobs"
on public.applications
for insert to authenticated
with check (
  candidate_id = auth.uid()
  and exists (
    select 1
    from public.jobs j
    where j.id = applications.job_id
      and j.status = 'open'
  )
);

create policy "candidates delete own applications"
on public.applications
for delete to authenticated
using (candidate_id = auth.uid());
