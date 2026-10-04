-- Final application RLS cleanup.
-- Remove legacy FOR ALL policy behavior and make company applicant reads use
-- a trusted ownership helper so INSERT/ON CONFLICT never re-enters applications.

drop policy if exists "candidates manage own applications" on public.applications;
drop policy if exists "company staff read applications" on public.applications;

create or replace function public.company_owns_application(
  p_application_id uuid,
  p_owner_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.applications a
    join public.jobs j on j.id = a.job_id
    join public.companies c on c.id = j.company_id
    where a.id = p_application_id
      and c.owner_id = p_owner_id
  );
$$;

revoke all on function public.company_owns_application(uuid, uuid) from public, anon, authenticated;
grant execute on function public.company_owns_application(uuid, uuid) to authenticated;

create policy "companies read own applicant applications"
on public.applications
for select to authenticated
using (
  public.current_user_role() in ('staff', 'founder')
  or (
    public.current_user_role() = 'company'
    and public.company_owns_application(id, (select auth.uid()))
  )
);

drop policy if exists "companies update own applicant status" on public.applications;

create policy "companies update own applicant status"
on public.applications
for update to authenticated
using (
  public.current_user_role() = 'company'
  and public.company_owns_application(id, (select auth.uid()))
)
with check (
  public.current_user_role() = 'company'
  and public.company_owns_application(id, (select auth.uid()))
);
