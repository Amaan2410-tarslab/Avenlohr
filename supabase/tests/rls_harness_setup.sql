-- Minimal local harness for the RLS regression suite.
-- It intentionally models only the auth/storage interfaces referenced by the
-- application migrations; it is not a replacement for a real Supabase project.

create schema if not exists auth;
create schema if not exists storage;

drop table if exists auth.users cascade;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  name text not null,
  owner_id uuid,
  metadata jsonb
);

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select case when name = '' then array[]::text[] else string_to_array(name, '/') end;
$$;

create or replace function storage.filename(name text)
returns text
language sql
immutable
as $$
  select split_part(name, '/', array_length(string_to_array(name, '/'), 1));
$$;

-- Supabase's Data API roles.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

grant usage on schema public, auth, storage to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant select, insert, update, delete on storage.buckets to authenticated;
