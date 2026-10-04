-- Limit each candidate to one canonical resume object per supported extension.
-- This closes the easy multi-GB/many-file abuse path while keeping replacement
-- possible through Storage's update/upsert flow.

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
