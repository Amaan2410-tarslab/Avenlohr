-- Final storage and application hardening.

-- Storage bucket limits are enforced by Supabase Storage, not only by the browser.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
where id = 'candidate-documents';

-- Restrict candidates to CV filenames and their own folder. Staff/founders retain read access.
drop policy if exists "candidates upload own documents" on storage.objects;
create policy "candidates upload own documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'candidate-documents'
  and public.current_user_role() = 'candidate'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.filename(name)) in ('resume.pdf','resume.doc','resume.docx')
);

drop policy if exists "candidates update own documents" on storage.objects;
create policy "candidates update own documents"
on storage.objects for update to authenticated
using (
  bucket_id = 'candidate-documents'
  and public.current_user_role() = 'candidate'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'candidate-documents'
  and public.current_user_role() = 'candidate'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.filename(name)) in ('resume.pdf','resume.doc','resume.docx')
);

-- Candidates may not delete submitted applications; staff/founders control lifecycle.
drop policy if exists "candidates read own applications" on public.applications;
create policy "candidates read own applications"
on public.applications for select to authenticated
using (candidate_id = auth.uid() and public.current_user_role() = 'candidate');

-- Company applicants can read only applications belonging to their own jobs.
drop policy if exists "company read applications" on public.applications;
create policy "company read applications"
on public.applications for select to authenticated
using (
  public.current_user_role() = 'company'
  and exists (
    select 1 from public.jobs j
    join public.companies c on c.id = j.company_id
    where j.id = applications.job_id and c.owner_id = auth.uid()
  )
);

-- Candidates must not be able to update application decisions or scoring.
revoke update, delete on public.applications from authenticated;

-- Only trusted staff/founder database paths may update applications. RLS still
-- permits the staff policy; the application identity trigger prevents swapping
-- candidate/job identities.
