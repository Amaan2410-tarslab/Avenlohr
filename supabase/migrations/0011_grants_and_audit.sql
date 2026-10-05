-- Restore table DML privileges for authenticated users; RLS policies remain the
-- authorization boundary and restrict application writes to staff/founders.
grant select, insert, update, delete on public.applications to authenticated;

-- No direct client writes to audit_logs.
revoke insert, update, delete on public.audit_logs from authenticated;

-- Trusted audit trigger writer.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid;
  action_name text;
  entity_id_value uuid;
begin
  actor := auth.uid();
  entity_id_value := coalesce(new.id, old.id);

  if tg_op = 'INSERT' then
    action_name := lower(tg_table_name) || '.created';
  elsif tg_op = 'UPDATE' then
    action_name := lower(tg_table_name) || '.updated';
  else
    action_name := lower(tg_table_name) || '.deleted';
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    action_name,
    tg_table_name,
    entity_id_value,
    jsonb_build_object('operation', tg_op)
  );

  return coalesce(new, old);
end;
$$;

revoke all on function public.audit_row_change() from public;
revoke all on function public.audit_row_change() from authenticated;

drop trigger if exists companies_audit on public.companies;
create trigger companies_audit
after insert or update or delete on public.companies
for each row execute function public.audit_row_change();

drop trigger if exists jobs_audit on public.jobs;
create trigger jobs_audit
after insert or update or delete on public.jobs
for each row execute function public.audit_row_change();

drop trigger if exists applications_audit on public.applications;
create trigger applications_audit
after insert or update or delete on public.applications
for each row execute function public.audit_row_change();

-- Numeric NaN is not a valid business value even though PostgreSQL numeric accepts it.
alter table public.candidate_profiles
  drop constraint if exists candidate_profiles_experience_years_check;
alter table public.candidate_profiles
  add constraint candidate_profiles_experience_years_check
  check (
    experience_years is null
    or (experience_years <> 'NaN'::numeric and experience_years >= 0 and experience_years <= 80)
  );

alter table public.candidate_skills
  drop constraint if exists candidate_skills_years_check;
alter table public.candidate_skills
  add constraint candidate_skills_years_check
  check (
    years is null
    or (years <> 'NaN'::numeric and years >= 0 and years <= 80)
  );

alter table public.jobs
  drop constraint if exists jobs_experience_years_check;
alter table public.jobs
  add constraint jobs_experience_years_check
  check (
    experience_years is null
    or (experience_years <> 'NaN'::numeric and experience_years >= 0 and experience_years <= 80)
  );
