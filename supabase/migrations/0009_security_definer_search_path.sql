-- Pin every SECURITY DEFINER helper to an empty search_path and fully qualify
-- referenced application/auth objects. This follows Supabase's current guidance.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role public.user_role := 'candidate';
begin
  if coalesce(new.raw_user_meta_data ->> 'account_type', '') = 'company' then
    requested_role := 'company';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    requested_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = (select auth.uid());
$$;

grant execute on function public.current_user_role() to authenticated;

create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() = old.id then
    new.role := old.role;
    new.status := old.status;
  end if;
  return new;
end;
$$;

create or replace function public.protect_application_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if public.current_user_role() = 'candidate' then
      if new.candidate_id <> auth.uid() then
        raise exception 'candidate_id must match authenticated user';
      end if;
      new.status := 'submitted';
      new.match_score := null;
      new.match_explanation := '{}'::jsonb;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.job_id <> old.job_id or new.candidate_id <> old.candidate_id then
      raise exception 'application identity is immutable';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.audit_application_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
    new.status is distinct from old.status
    or new.match_score is distinct from old.match_score
    or new.match_explanation is distinct from old.match_explanation
  ) then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      'application.reviewed',
      'application',
      new.id,
      jsonb_build_object(
        'old_status', old.status,
        'new_status', new.status,
        'old_match_score', old.match_score,
        'new_match_score', new.match_score
      )
    );
  end if;
  return new;
end;
$$;

create or replace function public.audit_profile_privileged_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role or new.status is distinct from old.status then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      'profile.privileged_fields_changed',
      'profile',
      new.id,
      jsonb_build_object(
        'old_role', old.role,
        'new_role', new.role,
        'old_status', old.status,
        'new_status', new.status
      )
    );
  end if;
  return new;
end;
$$;

create or replace function public.protect_resume_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_prefix text := new.user_id::text || '/';
begin
  if new.resume_path is not null and position(expected_prefix in new.resume_path) <> 1 then
    raise exception 'resume_path must belong to candidate storage folder';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_company_job_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_user_role() = 'company' then
    if tg_op = 'INSERT' then
      new.status := 'pending_review';
    elsif tg_op = 'UPDATE' and new.status = 'open' and old.status <> 'open' then
      new.status := old.status;
      raise exception 'company jobs require staff approval before publication';
    end if;
  end if;
  return new;
end;
$$;
