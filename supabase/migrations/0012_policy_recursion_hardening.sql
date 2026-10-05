-- Break the jobs <-> companies RLS recursion discovered by the security suite.
-- Candidate company visibility is evaluated through a security-definer helper so
-- the companies policy does not re-enter jobs RLS while jobs RLS is evaluating.

create or replace function public.candidate_can_read_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.jobs j
    where j.company_id = p_company_id
      and j.status = 'open'
  );
$$;

revoke all on function public.candidate_can_read_company(uuid) from public;
grant execute on function public.candidate_can_read_company(uuid) to authenticated;

drop policy if exists "candidates read open-job companies" on public.companies;
create policy "candidates read open-job companies"
on public.companies
for select to authenticated
using (
  public.current_user_role() = 'candidate'
  and public.candidate_can_read_company(id)
);
