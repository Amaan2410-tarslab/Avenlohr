-- Candidate + storage RLS regression suite against a throwaway PostgreSQL instance.
\set ON_ERROR_STOP on

insert into auth.users(id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'candidate-a@example.test', '{"full_name":"Candidate A"}'),
  ('00000000-0000-0000-0000-000000000002', 'candidate-b@example.test', '{"full_name":"Candidate B"}'),
  ('00000000-0000-0000-0000-000000000003', 'company-a@example.test', '{"full_name":"Company A","account_type":"company"}'),
  ('00000000-0000-0000-0000-000000000004', 'staff@example.test', '{"full_name":"Staff"}'),
  ('00000000-0000-0000-0000-000000000005', 'founder@example.test', '{"full_name":"Founder"}'),
  ('00000000-0000-0000-0000-000000000006', 'company-b@example.test', '{"full_name":"Company B","account_type":"company"}')
on conflict (id) do nothing;

insert into public.profiles(id, email, full_name, role, status)
values
  ('00000000-0000-0000-0000-000000000001','candidate-a@example.test','Candidate A','candidate','active'),
  ('00000000-0000-0000-0000-000000000002','candidate-b@example.test','Candidate B','candidate','active'),
  ('00000000-0000-0000-0000-000000000003','company-a@example.test','Company A','company','active'),
  ('00000000-0000-0000-0000-000000000004','staff@example.test','Staff','staff','active'),
  ('00000000-0000-0000-0000-000000000005','founder@example.test','Founder','founder','active'),
  ('00000000-0000-0000-0000-000000000006','company-b@example.test','Company B','company','active')
on conflict (id) do update
set email=excluded.email,
    full_name=excluded.full_name,
    role=excluded.role,
    status=excluded.status;

update public.profiles set role = 'staff' where id = '00000000-0000-0000-0000-000000000004';
update public.profiles set role = 'founder' where id = '00000000-0000-0000-0000-000000000005';

insert into public.companies(owner_id, name)
values
  ('00000000-0000-0000-0000-000000000003', 'Avenlo Test Co'),
  ('00000000-0000-0000-0000-000000000006', 'Avenlo Other Co')
on conflict do nothing;

insert into public.jobs(company_id, created_by, title, description, status)
select id, '00000000-0000-0000-0000-000000000005', 'Security Test Job', 'Open fixture', 'open'
from public.companies where owner_id = '00000000-0000-0000-0000-000000000003'
and not exists (select 1 from public.jobs where title = 'Security Test Job');

insert into public.jobs(company_id, created_by, title, description, status)
select id, '00000000-0000-0000-0000-000000000005', 'Other Company Job', 'Other-company fixture', 'open'
from public.companies where owner_id = '00000000-0000-0000-0000-000000000006'
and not exists (select 1 from public.jobs where title = 'Other Company Job');

insert into public.candidate_profiles(user_id, experience_years)
values
  ('00000000-0000-0000-0000-000000000001', 2),
  ('00000000-0000-0000-0000-000000000002', 3)
on conflict (user_id) do nothing;

select id as security_test_job_id
from public.jobs
where title = 'Security Test Job'
\gset

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);

insert into public.applications(job_id, candidate_id, status, match_score, match_explanation)
values (:'security_test_job_id', '00000000-0000-0000-0000-000000000001', 'hired', 100, '{"forged":true}'::jsonb)
on conflict (job_id, candidate_id) do nothing;

do $$
declare r public.applications;
begin
  select a.* into r from public.applications a join public.jobs j on j.id=a.job_id
  where j.title='Security Test Job' and a.candidate_id='00000000-0000-0000-0000-000000000001';
  if r.status <> 'submitted' or r.match_score is not null or r.match_explanation <> '{}'::jsonb then
    raise exception 'B1 failed: forged review fields survived';
  end if;
end $$;

do $$
declare before_count integer; after_count integer;
begin
  select count(*) into before_count from public.applications a join public.jobs j on j.id=a.job_id
  where j.title='Security Test Job' and a.candidate_id='00000000-0000-0000-0000-000000000001';
  delete from public.applications a using public.jobs j
  where a.job_id=j.id and a.candidate_id='00000000-0000-0000-0000-000000000001' and j.title='Security Test Job';
  select count(*) into after_count from public.applications a join public.jobs j on j.id=a.job_id
  where j.title='Security Test Job' and a.candidate_id='00000000-0000-0000-0000-000000000001';
  if before_count <> 1 or after_count <> 1 then raise exception 'B1 failed: application deletion succeeded'; end if;
end $$;

update public.profiles set role='founder', status='active' where id='00000000-0000-0000-0000-000000000001';
do $$
declare r public.profiles;
begin
  select * into r from public.profiles where id='00000000-0000-0000-0000-000000000001';
  if r.role <> 'candidate' then raise exception 'role escalation succeeded'; end if;
end $$;

do $$
begin
  begin
    insert into public.audit_logs(actor_id, action, entity_type, metadata)
    values ('00000000-0000-0000-0000-000000000001','role.granted','profile','{"granted":"founder"}'::jsonb);
    raise exception 'B3 failed: audit injection succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    insert into public.companies(owner_id,name) values ('00000000-0000-0000-0000-000000000001','Candidate Attack Co');
    raise exception 'B4 failed: candidate created company';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$
begin
  begin
    insert into public.candidate_profiles(user_id,experience_years) values ('00000000-0000-0000-0000-000000000002',1);
    raise exception 'B4 failed: company created candidate profile';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    insert into public.jobs(company_id,created_by,title,description,status)
    select c.id,'00000000-0000-0000-0000-000000000002','Spoofed Job','Attack','open'
    from public.companies c where c.owner_id='00000000-0000-0000-0000-000000000003';
    raise exception 'created_by spoof succeeded';
  exception when others then
    if sqlerrm like 'created_by spoof succeeded' then raise; end if;
  end;
end $$;

insert into public.jobs(company_id,created_by,title,description,status)
select c.id,'00000000-0000-0000-0000-000000000003','Moderation Test Job','Company-created job','open'
from public.companies c where c.owner_id='00000000-0000-0000-0000-000000000003';

insert into public.jobs(company_id,created_by,title,description,status)
select c.id,'00000000-0000-0000-0000-000000000003','Draft Test Job','Company draft fixture','draft'
from public.companies c where c.owner_id='00000000-0000-0000-0000-000000000003';

do $$
declare s public.job_status;
begin
  select status into s from public.jobs where title='Draft Test Job';
  if s <> 'draft' then raise exception 'B8 failed: company draft was auto-published to review'; end if;
end $$;
do $$
declare s public.job_status;
begin
  select status into s from public.jobs where title='Moderation Test Job';
  if s <> 'pending_review' then raise exception 'company published a job without moderation'; end if;
end $$;

update public.jobs
set title='Edited Security Test Job',
    description='Edited company-created job'
where title='Security Test Job';

do $$
declare s public.job_status;
begin
  select status into s from public.jobs where title='Edited Security Test Job';
  if s <> 'pending_review' then raise exception 'B8 failed: material edit bypassed re-review'; end if;
end $$;


select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$
begin
  begin
    update public.candidate_profiles set experience_years=-50 where user_id='00000000-0000-0000-0000-000000000002';
    raise exception 'negative experience accepted';
  exception when check_violation then null;
  end;
end $$;

-- Cross-user resume path: the rejection is expected. Catch the trigger/RLS
-- exception so the suite can continue, then verify the forbidden value did not persist.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$
declare before_count integer; after_count integer;
begin
  select count(*) into before_count from public.candidate_profiles where user_id='00000000-0000-0000-0000-000000000001';
  if before_count <> 1 then raise exception 'resume-path fixture missing'; end if;

  begin
    update public.candidate_profiles set resume_path='00000000-0000-0000-0000-000000000002/resume.pdf'
    where user_id='00000000-0000-0000-0000-000000000001';
  exception when others then
    null;
  end;

  select count(*) into after_count from public.candidate_profiles
  where user_id='00000000-0000-0000-0000-000000000001'
    and resume_path='00000000-0000-0000-0000-000000000002/resume.pdf';
  if after_count <> 0 then raise exception 'cross-user resume path accepted'; end if;
end $$;

do $$
begin
  begin
    insert into storage.objects(bucket_id,name) values ('candidate-documents','00000000-0000-0000-0000-000000000002/resume.pdf');
    raise exception 'cross-user storage write succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects(bucket_id,name) values ('candidate-documents','resume.pdf');
    raise exception 'root storage write succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;

insert into storage.objects(bucket_id,name)
values ('candidate-documents','00000000-0000-0000-0000-000000000001/resume.pdf');

do $$
declare n integer;
begin
  select count(*) into n from storage.objects
  where bucket_id='candidate-documents' and name='00000000-0000-0000-0000-000000000002/resume.pdf';
  if n <> 0 then raise exception 'cross-user CV read succeeded'; end if;
end $$;

do $$
declare b storage.buckets;
begin
  select * into b from storage.buckets where id='candidate-documents';
  if b.public is not false then raise exception 'CV bucket is public'; end if;
  if b.file_size_limit <> 10485760 then raise exception 'CV bucket size limit is wrong'; end if;
  if not ('application/pdf'=any(b.allowed_mime_types)) then raise exception 'PDF MIME type missing'; end if;
  if not ('application/msword'=any(b.allowed_mime_types)) then raise exception 'DOC MIME type missing'; end if;
  if not ('application/vnd.openxmlformats-officedocument.wordprocessingml.document'=any(b.allowed_mime_types)) then raise exception 'DOCX MIME type missing'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Recruiter boundary regression.
-- Company A may read/update Candidate A because Candidate A applied to A's job,
-- but may not read Candidate B or manipulate Candidate B's application.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);

insert into public.applications(job_id, candidate_id)
select id, '00000000-0000-0000-0000-000000000002'
from public.jobs
where title='Other Company Job'
on conflict (job_id, candidate_id) do nothing;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);

do $$
declare n integer;
begin
  select count(*) into n from public.profiles where id='00000000-0000-0000-0000-000000000001';
  if n <> 1 then raise exception 'B5 failed: company cannot read its own applicant'; end if;

  select count(*) into n from public.profiles where id='00000000-0000-0000-0000-000000000002';
  if n <> 0 then raise exception 'B5 failed: company read cross-company candidate'; end if;

  select count(*) into n from public.candidate_profiles where user_id='00000000-0000-0000-0000-000000000001';
  if n <> 1 then raise exception 'B5 failed: company cannot read applicant profile'; end if;

  select count(*) into n from public.candidate_profiles where user_id='00000000-0000-0000-0000-000000000002';
  if n <> 0 then raise exception 'B5 failed: company read cross-company candidate profile'; end if;
end $$;

update public.applications
set status='shortlisted',
    match_score=100,
    match_explanation='{"forged":true}'::jsonb
where candidate_id='00000000-0000-0000-0000-000000000001'
  and job_id=(select id from public.jobs where title='Security Test Job');

do $$
declare r public.applications;
begin
  select a.* into r
  from public.applications a
  join public.jobs j on j.id=a.job_id
  where a.candidate_id='00000000-0000-0000-0000-000000000001'
    and j.title='Security Test Job';

  if r.status <> 'shortlisted' then raise exception 'B5 failed: company status update was rejected'; end if;
  if r.match_score is not null or r.match_explanation <> '{}'::jsonb then
    raise exception 'B5 failed: company forged match fields';
  end if;
end $$;

update public.applications
set status='hired'
where candidate_id='00000000-0000-0000-0000-000000000002'
  and job_id=(select id from public.jobs where title='Other Company Job');

do $$
declare n integer;
begin
  select count(*) into n
  from public.applications
  where candidate_id='00000000-0000-0000-0000-000000000002'
    and job_id=(select id from public.jobs where title='Other Company Job')
    and status='submitted';

  if n <> 1 then raise exception 'B5 failed: company modified cross-company application'; end if;
end $$;

-- Candidate A retains access to an application-linked job after it closes.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',false);
update public.jobs
set status='closed'
where title='Security Test Job';

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);

do $$
declare n integer;
begin
  select count(*) into n
  from public.jobs
  where id=(select id from public.jobs where title='Security Test Job');
  if n <> 1 then raise exception 'B6 failed: candidate cannot track closed applied job'; end if;

  select count(*) into n
  from public.companies c
  where c.id=(select company_id from public.jobs where title='Security Test Job');
  if n <> 1 then raise exception 'B6 failed: candidate cannot see applied company'; end if;
end $$;

-- Structured education ownership.
insert into public.candidate_education(user_id, institution, degree)
values ('00000000-0000-0000-0000-000000000001','Avenlo University','B.Sc.');

do $$
declare n integer;
begin
  select count(*) into n from public.candidate_education where user_id='00000000-0000-0000-0000-000000000001';
  if n <> 1 then raise exception 'B7 failed: candidate cannot read own education'; end if;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$
declare n integer;
begin
  select count(*) into n from public.candidate_education where user_id='00000000-0000-0000-0000-000000000001';
  if n <> 0 then raise exception 'B7 failed: cross-user education read succeeded'; end if;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$
declare n integer;
begin
  select count(*) into n from public.candidate_education where user_id='00000000-0000-0000-0000-000000000001';
  if n <> 1 then raise exception 'B7 failed: company cannot read applicant education'; end if;

  begin
    update public.candidate_education
    set degree='Forged'
    where user_id='00000000-0000-0000-0000-000000000001';
    raise exception 'B7 failed: company modified candidate education';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Moderation report isolation and staff-only resolution.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);

insert into public.moderation_reports(reporter_id,target_type,target_id,reason)
values (
  '00000000-0000-0000-0000-000000000001',
  'job',
  (select id from public.jobs where title='Other Company Job'),
  'The role contains suspicious or inaccurate information.'
);

do $$
declare n integer;
begin
  select count(*) into n from public.moderation_reports where reporter_id='00000000-0000-0000-0000-000000000001';
  if n <> 1 then raise exception 'B9 failed: reporter cannot read own report'; end if;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);

do $$
declare n integer;
begin
  select count(*) into n
  from public.moderation_reports
  where target_type='job'
    and target_id=(select id from public.jobs where title='Other Company Job');
  if n <> 0 then raise exception 'B9 failed: another candidate read private report'; end if;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);

do $$
declare n integer;
begin
  select count(*) into n from public.moderation_reports;
  if n <> 1 then raise exception 'B9 failed: staff cannot review report'; end if;
end $$;

update public.moderation_reports
set status='resolved'
where target_type='job'
  and target_id=(select id from public.jobs where title='Other Company Job');

do $$
declare s text;
begin
  select status into s
  from public.moderation_reports
  where target_type='job'
    and target_id=(select id from public.jobs where title='Other Company Job');
  if s <> 'resolved' then raise exception 'B9 failed: staff cannot resolve report'; end if;
end $$;

-- Suspension must revoke role-gated data access at the database boundary.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',false);

update public.profiles
set status='suspended'
where id='00000000-0000-0000-0000-000000000001';

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);

do $$
declare n integer;
begin
  select count(*) into n from public.jobs where status='open';
  if n <> 0 then raise exception 'B10 failed: suspended candidate still reads open jobs'; end if;

  select count(*) into n from public.applications;
  if n <> 0 then raise exception 'B10 failed: suspended candidate still reads applications'; end if;

  select count(*) into n from public.candidate_profiles;
  if n <> 0 then raise exception 'B10 failed: suspended candidate still reads candidate profile'; end if;

  select count(*) into n from public.moderation_reports;
  if n <> 0 then raise exception 'B10 failed: suspended candidate still reads moderation reports'; end if;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',false);
update public.profiles
set status='active'
where id='00000000-0000-0000-0000-000000000001';

select 'RLS ATTACK SUITE PASSED' as result;
