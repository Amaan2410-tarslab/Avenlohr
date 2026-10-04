-- Replace the legacy jobs FOR ALL ownership policy with separate policies
-- so candidate reads never evaluate company ownership through RLS.

create or replace function public.company_owns_job(
  p_job_id uuid,
  p_owner_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.jobs j
    join public.companies c on c.id = j.company_id
    where j.id = p_job_id
      and c.owner_id = p_owner_id
  );
$$;

revoke all on function public.company_owns_job(uuid, uuid) from public, anon;
grant execute on function public.company_owns_job(uuid, uuid) to authenticated;

drop policy if exists "company owners manage jobs" on public.jobs;

create policy "companies create own jobs"
on public.jobs
for insert to authenticated
with check (
  public.current_user_role() = 'company'
  and exists (
    select 1
    from public.companies c
    where c.id = company_id
      and c.owner_id = (select auth.uid())
  )
);

create policy "companies update own jobs"
on public.jobs
for update to authenticated
using (
  public.current_user_role() = 'company'
  and public.company_owns_job(id, (select auth.uid()))
)
with check (
  public.current_user_role() = 'company'
  and public.company_owns_job(id, (select auth.uid()))
);

create policy "companies delete own jobs"
on public.jobs
for delete to authenticated
using (
  public.current_user_role() = 'company'
  and public.company_owns_job(id, (select auth.uid()))
);
