-- Executed as part of CI against a throwaway PostgreSQL instance.
-- Every assertion corresponds to a previously reported RLS attack path.

\set ON_ERROR_STOP on

insert into auth.users(id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'candidate-a@example.test', '{"full_name":"Candidate A"}'),
  ('00000000-0000-0000-0000-000000000002', 'candidate-b@example.test', '{"full_name":"Candidate B"}'),
  ('00000000-0000-0000-0000-000000000003', 'company-a@example.test', '{"full_name":"Company A","account_type":"company"}'),
  ('00000000-0000-0000-0000-000000000004', 'staff@example.test', '{"full_name":"Staff"}'),
  ('00000000-0000-0000-0000-000000000005', 'founder@example.test', '{"full_name":"Founder"}')
on conflict (id) do nothing;

update public.profiles set role = 'staff' where id = '00000000-0000-0000-0000-000000000004';
update public.profiles set role = 'founder' where id = '00000000-0000-0000-0000-000000000005';

insert into public.companies(owner_id, name)
values ('00000000-0000-0000-0000-000000000003', 'Avenlo Test Co')
on conflict do nothing;

insert into public.jobs(company_id, created_by, title, description, status)
select id, '00000000-0000-0000-0000-000000000005', 'Security Test Job', 'Open fixture', 'open'
from public.companies where owner_id = '00000000-0000-0000-0000-000000000003'
and not exists (select 1 from public.jobs where title = 'Security Test Job');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);

-- B1: forged hiring state/match data must be neutralized.
insert into public.applications(job_id, candidate_id, status, match_score, match_explanation)
select id, '00000000-0000-0000-0000-000000000001', 'hired', 100, '{"forged":true}'::jsonb
from public.jobs where title = 'Security Test Job'
on conflict (job_id, candidate_id) do nothing;

do $$
declare r public.applications;
begin
  select a.* into r from public.applications a join public.jobs j on j.id = a.job_id
  where j.title = 'Security Test Job' and a.candidate_id = '00000000-0000-0000-0000-000000000001';
  if r.status <> 'submitted' or r.match_score is not null or r.match_explanation <> '{}'::jsonb then
    raise exception 'B1 failed: candidate-controlled review fields survived';
  end if;
end $$;

-- B1: RLS may silently filter DELETE, so assert the row remains.
do $$
declare before_count integer; after_count integer;
begin
  select count(*) into before_count from public.applications a join public.jobs j on j.id = a.job_id
  where j.title = 'Security Test Job' and a.candidate_id = '00000000-0000-0000-0000-000000000001';
  delete from public.applications a using public.jobs j
  where a.job_id = j.id and a.candidate_id = '00000000-0000-0000-0000-000000000001' and j.title = 'Security Test Job';
  select count(*) into after_count from public.applications a join public.jobs j on j.id = a.job_id
  where j.title = 'Security Test Job' and a.candidate_id = '00000000-0000-0000-0000-000000000001';
  if before_count <> 1 or after_count <> 1 then raise exception 'B1 failed: candidate application deletion succeeded'; end if;
end $$;

-- Role escalation.
update public.profiles set role = 'founder', status = 'active' where id = '00000000-0000-0000-0000-000000000001';
do $$
declare r public.profiles;
begin
  select * into r from public.profiles where id = '00000000-0000-0000-0000-000000000001';
  if r.role <> 'candidate' then raise exception 'role escalation succeeded'; end if;
end $$;

-- B3: arbitrary audit insertion.
do $$
begin
  begin
    insert into public.audit_logs(actor_id, action, entity_type, metadata)
    values ('00000000-0000-0000-0000-000000000001', 'role.granted', 'profile', '{"granted":"founder"}'::jsonb);
    raise exception 'B3 failed: candidate inserted audit row';
  exception when insufficient_privilege then null;
  end;
end $$;

-- B4: candidate cannot create a company.
do $$
begin
  begin
    insert into public.companies(owner_id, name) values ('00000000-0000-0000-0000-000000000001', 'Candidate Attack Co');
    raise exception 'B4 failed: candidate created company';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Company identity cannot create another candidate profile.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
do $$
begin
  begin
    insert into public.candidate_profiles(user_id, experience_years)
    values ('00000000-0000-0000-0000-000000000002', 1);
    raise exception 'B4 failed: company created candidate profile';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Company job creation cannot spoof created_by.
do $$
begin
  begin
    insert into public.jobs(company_id, created_by, title, description, status)
    select c.id, '00000000-0000-0000-0000-000000000002', 'Spoofed Job', 'Attack', 'open'
    from public.companies c where c.owner_id = '00000000-0000-0000-0000-000000000003';
    raise exception 'created_by spoof succeeded';
  exception when others then
    if sqlerrm like 'created_by spoof succeeded' then raise; end if;
  end;
end $$;

insert into public.jobs(company_id, created_by, title, description, status)
select c.id, '00000000-0000-0000-0000-000000000003', 'Moderation Test Job', 'Company-created job', 'open'
from public.companies c where c.owner_id = '00000000-0000-0000-0000-000000000003';

do $$
declare s public.job_status;
begin
  select status into s from public.jobs where title = 'Moderation Test Job';
  if s <> 'pending_review' then raise exception 'company published a job without moderation'; end if;
end $$;

-- Duplicate company name for same owner.
do $$
begin
  begin
    insert into public.companies(owner_id, name) values ('00000000-0000-0000-0000-000000000003', 'Avenlo Test Co');
    raise exception 'duplicate company owner/name succeeded';
  exception when unique_violation then null;
  end;
end $$;

-- Negative experience.
do $$
begin
  begin
    insert into public.candidate_profiles(user_id, experience_years)
    values ('00000000-0000-0000-0000-000000000002', -50);
    raise exception 'negative experience accepted';
  exception when check_violation then null;
  end;
end $$;

-- Cross-user resume path.
do $$
begin
  begin
    update public.candidate_profiles set resume_path = '00000000-0000-0000-0000-000000000002/resume.pdf'
    where user_id = '00000000-0000-0000-0000-000000000001';
    raise exception 'cross-user resume path accepted';
  exception when others then
    if sqlerrm like 'cross-user resume path accepted' then raise; end if;
  end;
end $$;

-- Storage writes to another user's folder and root.
do $$
begin
  begin
    insert into storage.objects(bucket_id, name) values ('candidate-documents', '00000000-0000-0000-0000-000000000002/resume.pdf');
    raise exception 'cross-user storage write succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects(bucket_id, name) values ('candidate-documents', 'resume.pdf');
    raise exception 'root storage write succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;

insert into storage.objects(bucket_id, name)
values ('candidate-documents', '00000000-0000-0000-0000-000000000001/resume.pdf');

-- Staff privilege boundaries.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false);
do $$
declare app_id uuid; job_id uuid;
begin
  select a.id into app_id from public.applications a join public.jobs j on j.id=a.job_id
  where j.title='Security Test Job' and a.candidate_id='00000000-0000-0000-0000-000000000001';
  begin
    update public.applications set candidate_id='00000000-0000-0000-0000-000000000002' where id=app_id;
    raise exception 'staff changed application candidate_id';
  exception when others then
    if sqlerrm like 'staff changed application candidate_id' then raise; end if;
  end;
  select id into job_id from public.jobs where title='Moderation Test Job';
  begin
    delete from public.jobs where id=job_id;
    raise exception 'staff deleted company job';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Cross-user CV read.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
do $$
declare n integer;
begin
  select count(*) into n from storage.objects
  where bucket_id='candidate-documents' and name = '00000000-0000-0000-0000-000000000002/resume.pdf';
  if n <> 0 then raise exception 'cross-user CV read succeeded'; end if;
end $$;

do $$
declare b storage.buckets;
begin
  select * into b from storage.buckets where id='candidate-documents';
  if b.public is not false then raise exception 'CV bucket is public'; end if;
  if b.file_size_limit <> 10485760 then raise exception 'CV bucket size limit is wrong'; end if;
  if not ('application/pdf' = any(b.allowed_mime_types)) then raise exception 'PDF MIME type missing'; end if;
  if not ('application/msword' = any(b.allowed_mime_types)) then raise exception 'DOC MIME type missing'; end if;
  if not ('application/vnd.openxmlformats-officedocument.wordprocessingml.document' = any(b.allowed_mime_types)) then raise exception 'DOCX MIME type missing'; end if;
end $$;

select 'RLS ATTACK SUITE PASSED' as result;
