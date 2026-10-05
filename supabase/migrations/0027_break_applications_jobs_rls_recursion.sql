-- Break the applications -> jobs RLS recursion for candidate application inserts.

create or replace function public.job_is_open(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.jobs j
    where j.id = p_job_id
      and j.status = 'open'
  );
$$;

revoke all on function public.job_is_open(uuid) from public, anon;
grant execute on function public.job_is_open(uuid) to authenticated;

drop policy if exists "candidates apply to open jobs" on public.applications;
drop policy if exists "candidates create own applications" on public.applications;
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
  and public.job_is_open(job_id)
);
