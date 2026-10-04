-- Avenlo production hardening: close the RLS attack paths identified by the independent audit.

-- -----------------------------------------------------------------------------
-- 1. Profiles: users may edit their professional fields, but never their role or
--    lifecycle status. Role/status changes are staff-controlled only.
-- -----------------------------------------------------------------------------
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own safe profile" on public.profiles
for update to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and role = (select p.role from public.profiles p where p.id = auth.uid())
  and status = (select p.status from public.profiles p where p.id = auth.uid())
);

-- -----------------------------------------------------------------------------
-- 2. Companies are company-only. Candidates must never be able to create or
--    own companies; staff/founders can administer them.
-- -----------------------------------------------------------------------------
drop policy if exists "company owners manage company" on public.companies;
create policy "company owners manage company" on public.companies
for all to authenticated
using (
  owner_id = auth.uid()
  and public.current_user_role() = 'company'
)
with check (
  owner_id = auth.uid()
  and public.current_user_role() = 'company'
);

create policy "staff manage companies" on public.companies
for all to authenticated
using (public.current_user_role() in ('staff','founder'))
with check (public.current_user_role() in ('staff','founder'));

-- -----------------------------------------------------------------------------
-- 3. Candidate profiles/skills are candidate-only. Company accounts cannot
--    manufacture candidate records.
-- -----------------------------------------------------------------------------
drop policy if exists "users manage own candidate profile" on public.candidate_profiles;
create policy "candidates manage own candidate profile" on public.candidate_profiles
for all to authenticated
using (user_id = auth.uid() and public.current_user_role() = 'candidate')
with check (user_id = auth.uid() and public.current_user_role() = 'candidate');

drop policy if exists "users manage own skills" on public.candidate_skills;
create policy "candidates manage own skills" on public.candidate_skills
for all to authenticated
using (user_id = auth.uid() and public.current_user_role() = 'candidate')
with check (user_id = auth.uid() and public.current_user_role() = 'candidate');

-- -----------------------------------------------------------------------------
-- 4. Jobs: company users may create/update only their own jobs, and can never
--    spoof created_by. Staff/founders can administer jobs.
-- -----------------------------------------------------------------------------
drop policy if exists "company owners manage jobs" on public.jobs;
create policy "company owners manage jobs" on public.jobs
for all to authenticated
using (
  exists (
    select 1 from public.companies c
    where c.id = jobs.company_id
      and c.owner_id = auth.uid()
      and public.current_user_role() = 'company'
  )
)
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.companies c
    where c.id = jobs.company_id
      and c.owner_id = auth.uid()
      and public.current_user_role() = 'company'
  )
);

create policy "staff manage jobs" on public.jobs
for all to authenticated
using (public.current_user_role() in ('staff','founder'))
with check (public.current_user_role() in ('staff','founder'));

-- Prevent changing ownership/author fields after creation.
create or replace function public.protect_job_identity()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.company_id is distinct from old.company_id then
      raise exception 'job company cannot be changed';
    end if;
    if new.created_by is distinct from old.created_by then
      raise exception 'job creator cannot be changed';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_protect_identity on public.jobs;
create trigger jobs_protect_identity
before update on public.jobs
for each row execute function public.protect_job_identity();

-- -----------------------------------------------------------------------------
-- 5. Applications: candidates may insert only a clean submitted application.
--    They cannot set hiring/review state, match score, explanation, or identity.
--    Candidates also cannot delete applications.
-- -----------------------------------------------------------------------------
drop policy if exists "candidates manage own applications" on public.applications;
create policy "candidates create own applications" on public.applications
for insert to authenticated
with check (
  candidate_id = auth.uid()
  and public.current_user_role() = 'candidate'
  and status = 'submitted'
  and match_score is null
  and match_explanation = '{}'::jsonb
  and exists (select 1 from public.jobs j where j.id = job_id and j.status = 'open')
);

create policy "candidates read own applications" on public.applications
for select to authenticated
using (candidate_id = auth.uid());

create policy "staff manage applications" on public.applications
for all to authenticated
using (public.current_user_role() in ('staff','founder'))
with check (public.current_user_role() in ('staff','founder'));

create policy "company read applications" on public.applications
for select to authenticated
using (
  public.current_user_role() = 'company'
  and exists (
    select 1 from public.jobs j
    join public.companies c on c.id = j.company_id
    where j.id = applications.job_id and c.owner_id = auth.uid()
  )
);

create or replace function public.protect_application_identity()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.candidate_id is distinct from old.candidate_id or new.job_id is distinct from old.job_id then
    raise exception 'application identity cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists applications_protect_identity on public.applications;
create trigger applications_protect_identity
before update on public.applications
for each row execute function public.protect_application_identity();

-- -----------------------------------------------------------------------------
-- 6. Audit logs: no authenticated client may insert arbitrary audit events.
--    Audit rows are inserted only by trusted SECURITY DEFINER trigger functions.
-- -----------------------------------------------------------------------------
drop policy if exists "authenticated write audit" on public.audit_logs;

revoke insert, update, delete on public.audit_logs from authenticated;

create or replace function public.write_audit_log(
  p_actor_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (p_actor_id, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on function public.write_audit_log(uuid,text,text,uuid,jsonb) from public;
revoke all on function public.write_audit_log(uuid,text,text,uuid,jsonb) from authenticated;

-- -----------------------------------------------------------------------------
-- 7. Validate important numeric/string inputs at the database boundary.
-- -----------------------------------------------------------------------------
alter table public.candidate_profiles
  drop constraint if exists candidate_profiles_experience_years_check;
alter table public.candidate_profiles
  add constraint candidate_profiles_experience_years_check
  check (experience_years is null or (experience_years >= 0 and experience_years <= 80));

alter table public.candidate_skills
  drop constraint if exists candidate_skills_years_check;
alter table public.candidate_skills
  add constraint candidate_skills_years_check
  check (years is null or (years >= 0 and years <= 80));

alter table public.jobs
  drop constraint if exists jobs_experience_years_check;
alter table public.jobs
  add constraint jobs_experience_years_check
  check (experience_years is null or (experience_years >= 0 and experience_years <= 80));

-- Keep resume references inside the owner's storage namespace.
create or replace function public.validate_resume_path()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.resume_path is not null and new.resume_path not like new.user_id::text || '/%' then
    raise exception 'resume_path must remain inside the candidate user folder';
  end if;
  return new;
end;
$$;

drop trigger if exists candidate_profiles_validate_resume_path on public.candidate_profiles;
create trigger candidate_profiles_validate_resume_path
before insert or update on public.candidate_profiles
for each row execute function public.validate_resume_path();

-- -----------------------------------------------------------------------------
-- 8. Staff/founder-only profile administration. Ordinary users cannot grant
--    themselves privileged lifecycle states.
-- -----------------------------------------------------------------------------
create policy "staff manage profiles" on public.profiles
for update to authenticated
using (public.current_user_role() in ('staff','founder'))
with check (public.current_user_role() in ('staff','founder'));

-- -----------------------------------------------------------------------------
-- 9. Prevent duplicate companies for a single owner.
-- -----------------------------------------------------------------------------
create unique index if not exists companies_owner_name_unique
on public.companies(owner_id, lower(name));

-- -----------------------------------------------------------------------------
-- 10. Make account deletion possible by cascading company ownership. Jobs and
--     applications already cascade from their parent entities.
-- -----------------------------------------------------------------------------
alter table public.companies
  drop constraint if exists companies_owner_id_fkey;
alter table public.companies
  add constraint companies_owner_id_fkey
  foreign key (owner_id) references public.profiles(id) on delete cascade;
