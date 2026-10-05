-- Structured candidate education records.
-- Candidates own their education entries; staff/founders can review them.
-- Companies may read education only for candidates who applied to their jobs.

create table if not exists public.candidate_education (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.candidate_profiles(user_id) on delete cascade,
  institution text not null,
  degree text,
  field_of_study text,
  start_year integer,
  end_year integer,
  currently_studying boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists candidate_education_user_id_idx
on public.candidate_education(user_id);

alter table public.candidate_education enable row level security;

create policy "candidates read own education"
on public.candidate_education
for select to authenticated
using (
  user_id = (select auth.uid())
  and public.current_user_role() = 'candidate'
);

create policy "candidates insert own education"
on public.candidate_education
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.current_user_role() = 'candidate'
);

create policy "candidates update own education"
on public.candidate_education
for update to authenticated
using (
  user_id = (select auth.uid())
  and public.current_user_role() = 'candidate'
)
with check (
  user_id = (select auth.uid())
  and public.current_user_role() = 'candidate'
);

create policy "candidates delete own education"
on public.candidate_education
for delete to authenticated
using (
  user_id = (select auth.uid())
  and public.current_user_role() = 'candidate'
);

create policy "staff read candidate education"
on public.candidate_education
for select to authenticated
using (public.current_user_role() in ('staff', 'founder'));

create policy "companies read applicant education"
on public.candidate_education
for select to authenticated
using (
  public.current_user_role() = 'company'
  and exists (
    select 1
    from public.applications a
    join public.jobs j on j.id = a.job_id
    join public.companies c on c.id = j.company_id
    where a.candidate_id = candidate_education.user_id
      and c.owner_id = auth.uid()
  )
);

drop trigger if exists candidate_education_updated_at on public.candidate_education;
create trigger candidate_education_updated_at
before update on public.candidate_education
for each row execute function public.set_updated_at();

alter table public.candidate_education
  drop constraint if exists candidate_education_year_check;

alter table public.candidate_education
  add constraint candidate_education_year_check
  check (
    (start_year is null or start_year between 1900 and 2100)
    and (end_year is null or end_year between 1900 and 2100)
    and (start_year is null or end_year is null or end_year >= start_year)
  );
