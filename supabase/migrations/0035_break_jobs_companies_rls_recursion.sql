-- Break the jobs <-> companies RLS recursion.
-- Job ownership policies query companies, while candidate company visibility
-- policies legitimately query jobs/applications. Keep candidate company
-- visibility behind a trusted helper so evaluating companies never re-enters
-- jobs RLS.

create or replace function public.candidate_can_read_company(
  p_company_id uuid,
  p_candidate_id uuid
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
    from public.jobs j
    where j.company_id = p_company_id
      and j.status = 'open'
  )
  or exists (
    select 1
    from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.candidate_id = p_candidate_id
      and j.company_id = p_company_id
  );
$$;

revoke all on function public.candidate_can_read_company(uuid, uuid) from public, anon;
grant execute on function public.candidate_can_read_company(uuid, uuid) to authenticated;

drop policy if exists "candidates read open-job companies" on public.companies;
drop policy if exists "candidates read applied-job companies" on public.companies;

create policy "candidates read accessible companies"
on public.companies
for select to authenticated
using (
  public.current_user_role() = 'candidate'
  and public.candidate_can_read_company(id, (select auth.uid()))
);
