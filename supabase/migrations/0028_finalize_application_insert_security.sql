-- Finalize application insert security without cross-table RLS recursion.
-- RLS proves candidate ownership; the trusted trigger enforces job availability.

drop policy if exists "candidates create own applications" on public.applications;
drop policy if exists "candidates apply to open jobs" on public.applications;
drop policy if exists "candidates manage own applications" on public.applications;

create policy "candidates create own applications"
on public.applications
for insert to authenticated
with check (
  candidate_id = (select auth.uid())
  and public.current_user_role() = 'candidate'
  and status = 'submitted'
  and match_score is null
  and match_explanation = '{}'::jsonb
);

create or replace function public.protect_application_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  if tg_op = 'INSERT' then
    if public.current_user_role() = 'candidate' then
      if new.candidate_id <> auth.uid() then
        raise exception 'candidate_id must match authenticated user';
      end if;

      if not exists (
        select 1
        from public.jobs j
        where j.id = new.job_id
          and j.status = 'open'
      ) then
        raise exception 'job is not open for applications';
      end if;

      new.status := 'submitted';
      new.match_score := null;
      new.match_explanation := '{}'::jsonb;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.job_id <> old.job_id or new.candidate_id <> old.candidate_id then
      raise exception 'application identity is immutable';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.protect_application_integrity() from public, anon, authenticated;
