-- Production bucket configuration for candidate resumes.
-- Keep this in migrations so the security boundary is reproducible across environments.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'candidate-documents',
  'candidate-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

-- Reassert the object policies so uploads remain limited to the canonical
-- resume filename and the authenticated candidate's own storage folder.
drop policy if exists "candidates upload own documents" on storage.objects;
create policy "candidates upload own documents"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'candidate-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and storage.filename(name) ~ '^resume\\.(pdf|doc|docx)$'
);

drop policy if exists "candidates update own documents" on storage.objects;
create policy "candidates update own documents"
on storage.objects
for update to authenticated
using (
  bucket_id = 'candidate-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and storage.filename(name) ~ '^resume\\.(pdf|doc|docx)$'
)
with check (
  bucket_id = 'candidate-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and storage.filename(name) ~ '^resume\\.(pdf|doc|docx)$'
);
