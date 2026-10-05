create extension if not exists pgcrypto;

create type public.user_role as enum ('candidate', 'company', 'staff', 'founder');
create type public.profile_status as enum ('draft', 'active', 'archived');
create type public.job_status as enum ('draft', 'open', 'paused', 'closed');
create type public.application_status as enum ('submitted', 'reviewing', 'shortlisted', 'rejected', 'hired');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'candidate',
  full_name text,
  email text,
  phone text,
  headline text,
  location text,
  bio text,
  avatar_path text,
  status public.profile_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.candidate_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  experience_years numeric(5,2),
  seniority text,
  work_mode text,
  industry text,
  resume_path text,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.candidate_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.candidate_profiles(user_id) on delete cascade,
  skill text not null,
  years numeric(5,2),
  created_at timestamptz not null default now(),
  unique(user_id, skill)
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  website text,
  industry text,
  location text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  description text not null,
  skills text[] not null default '{}',
  experience_years numeric(5,2),
  seniority text,
  location text,
  work_mode text,
  industry text,
  status public.job_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  status public.application_status not null default 'submitted',
  match_score integer check (match_score between 0 and 100),
  match_explanation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id, candidate_id)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index candidate_skills_user_id_idx on public.candidate_skills(user_id);
create index jobs_company_id_idx on public.jobs(company_id);
create index jobs_status_idx on public.jobs(status);
create index applications_candidate_id_idx on public.applications(candidate_id);
create index applications_job_id_idx on public.applications(job_id);
create index audit_logs_actor_id_idx on public.audit_logs(actor_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger candidate_profiles_updated_at before update on public.candidate_profiles for each row execute function public.set_updated_at();
create trigger companies_updated_at before update on public.companies for each row execute function public.set_updated_at();
create trigger jobs_updated_at before update on public.jobs for each row execute function public.set_updated_at();
create trigger applications_updated_at before update on public.applications for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

grant execute on function public.current_user_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.candidate_profiles enable row level security;
alter table public.candidate_skills enable row level security;
alter table public.companies enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.audit_logs enable row level security;

create policy "users read own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "users read own candidate profile" on public.candidate_profiles for select to authenticated using (user_id = auth.uid());
create policy "users manage own candidate profile" on public.candidate_profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users read own skills" on public.candidate_skills for select to authenticated using (user_id = auth.uid());
create policy "users manage own skills" on public.candidate_skills for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "company owners read company" on public.companies for select to authenticated using (owner_id = auth.uid() or public.current_user_role() in ('staff','founder'));
create policy "company owners manage company" on public.companies for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "company owners manage jobs" on public.jobs for all to authenticated using (
  exists (select 1 from public.companies c where c.id = jobs.company_id and c.owner_id = auth.uid())
  or public.current_user_role() in ('staff','founder')
) with check (
  exists (select 1 from public.companies c where c.id = jobs.company_id and c.owner_id = auth.uid())
  or public.current_user_role() in ('staff','founder')
);
create policy "candidates see open jobs" on public.jobs for select to authenticated using (status = 'open' or public.current_user_role() in ('staff','founder'));

create policy "candidates manage own applications" on public.applications for all to authenticated using (candidate_id = auth.uid()) with check (candidate_id = auth.uid());
create policy "company staff read applications" on public.applications for select to authenticated using (
  public.current_user_role() in ('staff','founder')
  or exists (select 1 from public.jobs j join public.companies c on c.id = j.company_id where j.id = applications.job_id and c.owner_id = auth.uid())
);
create policy "staff read audit" on public.audit_logs for select to authenticated using (public.current_user_role() in ('staff','founder'));
create policy "authenticated write audit" on public.audit_logs for insert to authenticated with check (actor_id = auth.uid());
