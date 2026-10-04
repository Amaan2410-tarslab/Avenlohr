-- Avenlo production hardening.
-- This migration closes privilege-boundary, application-integrity, audit, and storage gaps
-- identified by the independent RLS attack review.

-- -----------------------------------------------------------------------------
-- 1. Role-gate candidate/company self-service tables.
-- -----------------------------------------------------------------------------

drop policy if exists "users manage own candidate profile" on public.candidate_profiles;
create policy "candidates manage own candidate profile"
on public.candidate_profiles
for all to authenticated
using (
  user_id = auth.uid()
  and public.current_user_role() = 'candidate'
)
with check (
  user_id = auth.uid()
  and public.current_user_role() = 'candidate'
);

drop policy if exists "users manage own skills" on public.candidate_skills;
create policy "candidates manage own skills"
on public.candidate_skills
for all to authenticated
using (
  user_id = auth.uid()
  and public.current_user_role() = 'candidate'
)
with check (
  user_id = auth.uid()
  and public.current_user_role() = 'candidate'
);

drop policy if exists "company owners manage company" on public.companies;
create policy "company owners manage company"
on public.companies
for all to authenticated
using (
  owner_id = auth.uid()
  and public.current_user_role() = 'company'
)
with check (
  owner_id = auth.uid()
  and public.current_user_role() = 'company'
);

drop policy if exists "company owners manage jobs" on public.jobs;
create policy "company owners manage jobs"
on public.jobs
for all to authenticated
using (
  (
    public.current_user_role() = 'company'
    and exists (
      select 1
      from public.companies c
      where c.id = jobs.company_id
        and c.owner_id = auth.uid()
    )
  )
  or public.current_user_role() in ('staff', 'founder')
)
with check (
  (
    public.current_user_role() = 'company'
    and exists (
      select 1
      from public.companies c
      where c.id = jobs.company_id
        and c.owner_id = auth.uid()
    )
    and created_by = auth.uid()
  )
  or public.current_user_role() in ('staff', 'founder')
);

-- Candidates need the company name for an open job, but only for companies
-- attached to an open job. This does not expose private company ownership data
-- beyond the normal company profile fields already stored in the table.
drop policy if exists "candidates read open-job companies" on public.companies;
create policy "candidates read open-job companies"
on public.companies
for select to authenticated
using (
  public.current_user_role() = 'candidate'
  and exists (
    select 1
    from public.jobs j
    where j.company_id = companies.id
      and j.status = 'open'
  )
);

-- -----------------------------------------------------------------------------
-- 2. Application integrity.
-- -----------------------------------------------------------------------------

drop policy if exists "candidates delete own applications" on public.applications;

-- Candidates may insert only their own application. Review fields are forced by
-- the trigger below, so a client cannot self-award hired/100%/explanation data.
drop policy if exists "candidates apply to open jobs" on public.applications;
create policy "candidates apply to open jobs"
on public.applications
for insert to authenticated
with check (
  candidate_id = auth.uid()
  and public.current_user_role() = 'candidate'
  and exists (
    select 1
    from public.jobs j
    where j.id = applications.job_id
      and j.status = 'open'
  )
);

create or replace function public.protect_application_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if public.current_user_role() = 'candidate' then
      if new.candidate_id <> auth.uid() then
        raise exception 'candidate_id must match authenticated user';
      end if;
      new.status := 'submitted';
      new.match_score := null;
      new.match_explanation := '{}'::jsonb;
    end if;
  elsif tg_op = 'UPDATE' then
    -- Job and candidate identity are immutable. Staff may review an application,
    -- but may not move it between candidates/jobs through a normal update.
    if new.job_id <> old.job_id or new.candidate_id <> old.candidate_id then
      raise exception 'application identity is immutable';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists applications_protect_integrity on public.applications;
create trigger applications_protect_integrity
before insert or update on public.applications
for each row execute function public.protect_application_integrity();

-- -----------------------------------------------------------------------------
-- 3. Audit log hardening.
-- -----------------------------------------------------------------------------

drop policy if exists "authenticated write audit" on public.audit_logs;

create or replace function public.write_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

grant execute on function public.write_audit_log(text, text, uuid, jsonb) to authenticated;

create or replace function public.audit_application_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (
    new.status is distinct from old.status
    or new.match_score is distinct from old.match_score
    or new.match_explanation is distinct from old.match_explanation
  ) then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      'application.reviewed',
      'application',
      new.id,
      jsonb_build_object(
        'old_status', old.status,
        'new_status', new.status,
        'old_match_score', old.match_score,
        'new_match_score', new.match_score
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists applications_audit_change on public.applications;
create trigger applications_audit_change
after update on public.applications
for each row execute function public.audit_application_change();

create or replace function public.audit_profile_privileged_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role or new.status is distinct from old.status then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      'profile.privileged_fields_changed',
      'profile',
      new.id,
      jsonb_build_object(
        'old_role', old.role,
        'new_role', new.role,
        'old_status', old.status,
        'new_status', new.status
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_audit_privileged_change on public.profiles;
create trigger profiles_audit_privileged_change
after update on public.profiles
for each row execute function public.audit_profile_privileged_change();

-- -----------------------------------------------------------------------------
-- 4. Storage hardening.
-- -----------------------------------------------------------------------------

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
where id = 'candidate-documents';

-- Resume paths are metadata, so enforce that the database value is inside the
-- authenticated candidate's own storage folder before it can be saved.
create or replace function public.protect_resume_path()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_prefix text := new.user_id::text || '/';
begin
  if new.resume_path is not null and position(expected_prefix in new.resume_path) <> 1 then
    raise exception 'resume_path must belong to candidate storage folder';
  end if;
  return new;
end;
$$;

drop trigger if exists candidate_profiles_protect_resume_path on public.candidate_profiles;
create trigger candidate_profiles_protect_resume_path
before insert or update on public.candidate_profiles
for each row execute function public.protect_resume_path();

-- -----------------------------------------------------------------------------
-- 5. Data integrity and uniqueness.
-- -----------------------------------------------------------------------------

alter table public.candidate_profiles
  drop constraint if exists candidate_profiles_experience_years_check;
alter table public.candidate_profiles
  add constraint candidate_profiles_experience_years_check
  check (experience_years is null or experience_years >= 0) not valid;

alter table public.candidate_skills
  drop constraint if exists candidate_skills_years_check;
alter table public.candidate_skills
  add constraint candidate_skills_years_check
  check (years is null or years >= 0) not valid;

alter table public.jobs
  drop constraint if exists jobs_experience_years_check;
alter table public.jobs
  add constraint jobs_experience_years_check
  check (experience_years is null or experience_years >= 0) not valid;

create unique index if not exists companies_owner_id_unique_idx
on public.companies(owner_id);

create index if not exists companies_owner_id_idx
on public.companies(owner_id);

create index if not exists applications_status_idx
on public.applications(status);

create index if not exists jobs_created_by_idx
on public.jobs(created_by);

-- Prevent candidate-facing free-text profile writes from creating a second
-- storage path or invalid values while keeping existing legacy rows intact.

-- -----------------------------------------------------------------------------
-- 6. Prevent self-service deletion of review history.
-- -----------------------------------------------------------------------------

-- No candidate DELETE policy is recreated. Only staff/founder workflows should
-- remove an application, and a dedicated policy can be added later if business
-- requirements explicitly call for it.
