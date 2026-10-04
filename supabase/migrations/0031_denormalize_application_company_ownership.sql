-- Eliminate applications self-recursion by storing the owning company on each application.
-- The value is derived exclusively from the selected job in a trusted trigger.

alter table public.applications
  add column if not exists company_id uuid;

update public.applications a
set company_id = j.company_id
from public.jobs j
where j.id = a.job_id
  and a.company_id is null;

alter table public.applications
  alter column company_id set not null;

alter table public.applications
  drop constraint if exists applications_company_id_fkey;

alter table public.applications
  add constraint applications_company_id_fkey
  foreign key (company_id)
  references public.companies(id)
  on delete restrict;

create index if not exists applications_company_id_idx
on public.applications(company_id);

create or replace function public.set_application_company_id()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  target_company_id uuid;
begin
  select j.company_id
  into target_company_id
  from public.jobs j
  where j.id = new.job_id;

  if target_company_id is null then
    raise exception 'application job does not exist';
  end if;

  if tg_op = 'UPDATE' and new.job_id <> old.job_id then
    raise exception 'application job is immutable';
  end if;

  new.company_id := target_company_id;
  return new;
end;
$$;

drop trigger if exists applications_set_company_id on public.applications;
create trigger applications_set_company_id
before insert or update on public.applications
for each row execute function public.set_application_company_id();

revoke all on function public.set_application_company_id() from public, anon, authenticated;

drop policy if exists "companies read own applicant applications" on public.applications;
drop policy if exists "companies update own applicant status" on public.applications;
drop policy if exists "company staff read applications" on public.applications;

create policy "companies read own applicant applications"
on public.applications
for select to authenticated
using (
  public.current_user_role() in ('staff', 'founder')
  or (
    public.current_user_role() = 'company'
    and exists (
      select 1
      from public.companies c
      where c.id = applications.company_id
        and c.owner_id = (select auth.uid())
    )
  )
);

create policy "companies update own applicant status"
on public.applications
for update to authenticated
using (
  public.current_user_role() = 'company'
  and exists (
    select 1
    from public.companies c
    where c.id = applications.company_id
      and c.owner_id = (select auth.uid())
  )
)
with check (
  public.current_user_role() = 'company'
  and exists (
    select 1
    from public.companies c
    where c.id = applications.company_id
      and c.owner_id = (select auth.uid())
  )
);

drop function if exists public.company_owns_application(uuid, uuid);
