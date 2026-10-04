-- Final RLS hardening for the independent security audit.
-- This migration deliberately narrows privileged mutation paths and applies
-- server-side Storage restrictions.

-- -----------------------------------------------------------------------------
-- 1. Staff may review jobs but may not delete company jobs. Founders retain
--    administrative delete capability.
-- -----------------------------------------------------------------------------
drop policy if exists "staff manage jobs" on public.jobs;
create policy "staff review jobs" on public.jobs
for update to authenticated
using (public.current_user_role() = 'staff')
with check (public.current_user_role() = 'staff');

create policy "staff read jobs" on public.jobs
for select to authenticated
using (public.current_user_role() = 'staff');

create policy "founders manage jobs" on public.jobs
for all to authenticated
using (public.current_user_role() = 'founder')
with check (public.current_user_role() = 'founder');

-- -----------------------------------------------------------------------------
-- 2. Staff may administer application workflow, but application identity is
--    immutable for everyone through the trigger created in 0009.
-- -----------------------------------------------------------------------------
-- No additional permissive candidate policy is introduced here.

-- -----------------------------------------------------------------------------
-- 3. Storage: enforce server-side file size and MIME restrictions on the
--    private candidate-document bucket. Existing policies still enforce folder
--    ownership and staff/founder read access.
-- -----------------------------------------------------------------------------
update storage.buckets
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
where id = 'candidate-documents';

-- Candidates may only upload canonical resume filenames. This prevents an
-- authenticated candidate from filling their namespace with arbitrary files.
drop policy if exists "candidates upload own documents" on storage.objects;
create policy "candidates upload own resumes" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'candidate-documents'
  and public.current_user_role() = 'candidate'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower((storage.filename(name))) in ('resume.pdf', 'resume.doc', 'resume.docx')
);

-- Keep updates in the same candidate namespace and canonical filename set.
drop policy if exists "candidates update own documents" on storage.objects;
create policy "candidates update own resumes" on storage.objects
for update to authenticated
using (
  bucket_id = 'candidate-documents'
  and public.current_user_role() = 'candidate'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower((storage.filename(name))) in ('resume.pdf', 'resume.doc', 'resume.docx')
)
with check (
  bucket_id = 'candidate-documents'
  and public.current_user_role() = 'candidate'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower((storage.filename(name))) in ('resume.pdf', 'resume.doc', 'resume.docx')
);

-- -----------------------------------------------------------------------------
-- 4. Prevent duplicate candidate skills differing only by case/whitespace.
-- -----------------------------------------------------------------------------
create unique index if not exists candidate_skills_user_skill_normalized_unique
on public.candidate_skills(user_id, lower(btrim(skill)));

-- -----------------------------------------------------------------------------
-- 5. Prevent malformed critical text values at the database boundary.
-- -----------------------------------------------------------------------------
alter table public.candidate_skills
  drop constraint if exists candidate_skills_skill_nonempty_check;
alter table public.candidate_skills
  add constraint candidate_skills_skill_nonempty_check
  check (length(btrim(skill)) between 1 and 100);

alter table public.jobs
  drop constraint if exists jobs_title_nonempty_check;
alter table public.jobs
  add constraint jobs_title_nonempty_check
  check (length(btrim(title)) between 1 and 200);

alter table public.jobs
  drop constraint if exists jobs_description_nonempty_check;
alter table public.jobs
  add constraint jobs_description_nonempty_check
  check (length(btrim(description)) between 1 and 20000);

alter table public.companies
  drop constraint if exists companies_name_nonempty_check;
alter table public.companies
  add constraint companies_name_nonempty_check
  check (length(btrim(name)) between 1 and 200);

-- -----------------------------------------------------------------------------
-- 6. Ensure application rows can never exist for non-candidate profiles,
--    including privileged accounts accidentally supplied as candidate_id.
-- -----------------------------------------------------------------------------
create or replace function public.validate_application_candidate_role()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.candidate_id
      and p.role = 'candidate'
  ) then
    raise exception 'application candidate must have candidate role';
  end if;
  return new;
end;
$$;

drop trigger if exists applications_validate_candidate_role on public.applications;
create trigger applications_validate_candidate_role
before insert or update on public.applications
for each row execute function public.validate_application_candidate_role();
