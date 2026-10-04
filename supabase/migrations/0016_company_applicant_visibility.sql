-- Company applicant visibility for the human-led review workflow.
-- Companies may see private candidate information only when the candidate
-- has applied to one of that company's jobs. They never gain broad candidate access.

create index if not exists applications_candidate_job_idx
on public.applications(candidate_id, job_id);

drop policy if exists "companies read applicant profiles" on public.profiles;
create policy "companies read applicant profiles"
on public.profiles
for select to authenticated
using (
  public.current_user_role() = 'company'
  and exists (
    select 1
    from public.applications a
    join public.jobs j on j.id = a.job_id
    join public.companies c on c.id = j.company_id
    where a.candidate_id = profiles.id
      and c.owner_id = auth.uid()
  )
);

drop policy if exists "companies read applicant candidate profiles" on public.candidate_profiles;
create policy "companies read applicant candidate profiles"
on public.candidate_profiles
for select to authenticated
using (
  public.current_user_role() = 'company'
  and exists (
    select 1
    from public.applications a
    join public.jobs j on j.id = a.job_id
    join public.companies c on c.id = j.company_id
    where a.candidate_id = candidate_profiles.user_id
      and c.owner_id = auth.uid()
  )
);

drop policy if exists "companies read applicant skills" on public.candidate_skills;
create policy "companies read applicant skills"
on public.candidate_skills
for select to authenticated
using (
  public.current_user_role() = 'company'
  and exists (
    select 1
    from public.applications a
    join public.jobs j on j.id = a.job_id
    join public.companies c on c.id = j.company_id
    where a.candidate_id = candidate_skills.user_id
      and c.owner_id = auth.uid()
  )
);

drop policy if exists "companies read applicant resumes" on storage.objects;
create policy "companies read applicant resumes"
on storage.objects
for select to authenticated
using (
  bucket_id = 'candidate-documents'
  and public.current_user_role() = 'company'
  and (storage.foldername(name))[1] is not null
  and exists (
    select 1
    from public.applications a
    join public.jobs j on j.id = a.job_id
    join public.companies c on c.id = j.company_id
    where a.candidate_id = (storage.foldername(name))[1]::uuid
      and c.owner_id = auth.uid()
  )
);
