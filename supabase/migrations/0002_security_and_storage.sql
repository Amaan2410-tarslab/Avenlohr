-- Protect privileged profile fields from self-service role/status escalation.
create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id then
    new.role := old.role;
    new.status := old.status;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_privileged_fields
before update on public.profiles
for each row execute function public.protect_profile_privileged_fields();

-- Private CV/document bucket. Files are stored under <user-id>/... .
insert into storage.buckets (id, name, public)
values ('candidate-documents', 'candidate-documents', false)
on conflict (id) do nothing;

create policy "candidates upload own documents"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'candidate-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "candidates read own documents"
on storage.objects
for select to authenticated
using (
  bucket_id = 'candidate-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.current_user_role() in ('staff', 'founder')
  )
);

create policy "candidates update own documents"
on storage.objects
for update to authenticated
using (
  bucket_id = 'candidate-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'candidate-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "candidates delete own documents"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'candidate-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Staff and founders can manage application workflow; candidates cannot alter review decisions.
create policy "staff update applications"
on public.applications
for update to authenticated
using (public.current_user_role() in ('staff', 'founder'))
with check (public.current_user_role() in ('staff', 'founder'));
