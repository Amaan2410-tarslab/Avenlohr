-- Moderation reports for jobs, candidates, companies, and applications.
-- Reporters can create and view their own reports. Staff/founders review and resolve them.

create table if not exists public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('job', 'candidate', 'company', 'application')),
  target_id uuid not null,
  reason text not null check (length(btrim(reason)) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists moderation_reports_status_created_at_idx
on public.moderation_reports(status, created_at desc);

create index if not exists moderation_reports_target_idx
on public.moderation_reports(target_type, target_id);

create unique index if not exists moderation_reports_one_open_per_target_idx
on public.moderation_reports(reporter_id, target_type, target_id)
where status = 'open';

alter table public.moderation_reports enable row level security;

create policy "reporters create own reports"
on public.moderation_reports
for insert to authenticated
with check (reporter_id = (select auth.uid()));

create policy "reporters read own reports"
on public.moderation_reports
for select to authenticated
using (
  reporter_id = (select auth.uid())
  or public.current_user_role() in ('staff', 'founder')
);

create policy "staff manage moderation reports"
on public.moderation_reports
for update to authenticated
using (public.current_user_role() in ('staff', 'founder'))
with check (public.current_user_role() in ('staff', 'founder'));

drop trigger if exists moderation_reports_updated_at on public.moderation_reports;
create trigger moderation_reports_updated_at
before update on public.moderation_reports
for each row execute function public.set_updated_at();

drop trigger if exists moderation_reports_audit on public.moderation_reports;
create trigger moderation_reports_audit
after insert or update on public.moderation_reports
for each row execute function public.audit_row_change();
