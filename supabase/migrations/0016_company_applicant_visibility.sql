-- Scope recruiter review to applicants who applied to jobs owned by the company.
-- Company users can review candidate information for their own applicants and
-- advance application workflow status, but cannot forge match scores/explanations
-- or move an application to another candidate/job.

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
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  and exists (
    select 1
    from public.applications a
    join public.jobs j on j.id = a.job_id
    join public.companies c on c.id = j.company_id
    where a.candidate_id = ((storage.foldername(name))[1])::uuid
      and c.owner_id = auth.uid()
  )
);

drop policy if exists "companies update own applicant status" on public.applications;
create policy "companies update own applicant status"
on public.applications
for update to authenticated
using (
  public.current_user_role() = 'company'
  and exists (
    select 1
    from public.jobs j
    join public.companies c on c.id = j.company_id
    where j.id = applications.job_id
      and c.owner_id = auth.uid()
  )
)
with check (
  public.current_user_role() = 'company'
  and exists (
    select 1
    from public.jobs j
    join public.companies c on c.id = j.company_id
    where j.id = applications.job_id
      and c.owner_id = auth.uid()
  )
);

create or replace function public.protect_company_application_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_user_role() = 'company' then
    new.candidate_id := old.candidate_id;
    new.job_id := old.job_id;
    new.match_score := old.match_score;
    new.match_explanation := old.match_explanation;
    new.updated_at := pg_catalog.now();
  end if;
  return new;
end;
$$;

drop trigger if exists applications_protect_company_review on public.applications;
create trigger applications_protect_company_review
before update on public.applications
for each row execute function public.protect_company_application_review();

revoke all on function public.protect_company_application_review() from public, anon, authenticated;
