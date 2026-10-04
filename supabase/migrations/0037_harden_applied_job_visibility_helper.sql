-- Make applied-job visibility independent of applications RLS.
-- This helper is used only with the authenticated candidate's own user id and
-- is safe to evaluate from the jobs RLS policy without re-entering applications.

create or replace function public.candidate_has_job_application(
  p_job_id uuid,
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
    from public.applications a
    where a.job_id = p_job_id
      and a.candidate_id = p_candidate_id
  );
$$;

revoke all on function public.candidate_has_job_application(uuid, uuid) from public, anon;
grant execute on function public.candidate_has_job_application(uuid, uuid) to authenticated;
