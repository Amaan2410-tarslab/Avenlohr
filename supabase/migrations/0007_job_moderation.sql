-- Company-created jobs require human review before candidates can see them.
alter type public.job_status add value if not exists 'pending_review';

create or replace function public.enforce_company_job_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() = 'company' then
    if tg_op = 'INSERT' then
      new.status := 'pending_review';
    elsif tg_op = 'UPDATE' and new.status = 'open' and old.status <> 'open' then
      new.status := old.status;
      raise exception 'company jobs require staff approval before publication';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_enforce_company_moderation on public.jobs;
create trigger jobs_enforce_company_moderation
before insert or update on public.jobs
for each row execute function public.enforce_company_job_moderation();
