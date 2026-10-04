-- Resolve the profile RLS recursion and preserve application visibility after jobs close.
-- Self-service profile writes are protected by the BEFORE UPDATE trigger
-- protect_profile_privileged_fields(), which prevents users from changing role/status.
-- The RLS policy therefore only needs to enforce row ownership and must not
-- query public.profiles recursively.

drop policy if exists "users update own safe profile" on public.profiles;
drop policy if exists "users update own profile details" on public.profiles;

create policy "users update own profile details"
on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Candidates should continue to see roles they already applied to, even after
-- the role is closed or paused. This is required for application tracking.
drop policy if exists "candidates read applied jobs" on public.jobs;
create policy "candidates read applied jobs"
on public.jobs
for select to authenticated
using (
  public.current_user_role() = 'candidate'
  and exists (
    select 1
    from public.applications a
    where a.job_id = jobs.id
      and a.candidate_id = (select auth.uid())
  )
);

-- Once a candidate has applied, they may continue to see the relevant company
-- identity alongside their application without gaining broad company access.
drop policy if exists "candidates read applied-job companies" on public.companies;
create policy "candidates read applied-job companies"
on public.companies
for select to authenticated
using (
  public.current_user_role() = 'candidate'
  and exists (
    select 1
    from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.candidate_id = (select auth.uid())
      and j.company_id = companies.id
  )
);

-- Avoid UUID casting failures in storage policy evaluation for malformed object
-- names by comparing the candidate id in text form.
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
    where a.candidate_id::text = (storage.foldername(name))[1]
      and c.owner_id = auth.uid()
  )
);
