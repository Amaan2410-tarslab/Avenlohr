-- Job lifecycle hardening: drafts, expiry, and re-review after material edits.

alter table public.jobs
  add column if not exists expires_at timestamptz;

alter table public.jobs
  drop constraint if exists jobs_expires_after_created_check;

alter table public.jobs
  add constraint jobs_expires_after_created_check
  check (expires_at is null or expires_at > created_at);

create index if not exists jobs_status_expires_at_idx
on public.jobs(status, expires_at);

create or replace function public.enforce_company_job_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_user_role() = 'company' then
    if tg_op = 'INSERT' then
      if new.status is distinct from 'draft' then
        new.status := 'pending_review';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.company_id is distinct from old.company_id
         or new.created_by is distinct from old.created_by then
        raise exception 'job ownership cannot be changed';
      end if;

      if new.status = 'open' and old.status <> 'open' then
        raise exception 'company jobs require staff approval before publication';
      end if;

      if old.status = 'open' and (
        new.title is distinct from old.title
        or new.description is distinct from old.description
        or new.skills is distinct from old.skills
        or new.experience_years is distinct from old.experience_years
        or new.seniority is distinct from old.seniority
        or new.location is distinct from old.location
        or new.work_mode is distinct from old.work_mode
        or new.industry is distinct from old.industry
      ) then
        new.status := 'pending_review';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_company_job_moderation() from public, anon, authenticated;
