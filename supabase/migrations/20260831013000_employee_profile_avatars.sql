-- Employee-owned profile photos stored in a private Supabase Storage bucket.
-- The database stores only the object path; short-lived signed URLs are created
-- by the authenticated client when the profile is loaded.

alter table public.profiles
  add column if not exists avatar_path text;

alter table public.profiles
  drop constraint if exists profiles_avatar_path_format;

alter table public.profiles
  add constraint profiles_avatar_path_format
  check (
    avatar_path is null
    or avatar_path ~ '^[0-9a-fA-F-]{36}/avatar\.webp$'
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  false,
  2097152,
  array['image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile avatar owners can read" on storage.objects;
create policy "profile avatar owners can read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "profile avatar owners can insert" on storage.objects;
create policy "profile avatar owners can insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name = (select auth.uid())::text || '/avatar.webp'
);

drop policy if exists "profile avatar owners can update" on storage.objects;
create policy "profile avatar owners can update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name = (select auth.uid())::text || '/avatar.webp'
);

drop policy if exists "profile avatar owners can delete" on storage.objects;
create policy "profile avatar owners can delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create or replace function public.update_own_avatar_path(new_avatar_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := (select auth.uid());
  expected_path text;
begin
  if account_id is null then
    raise exception 'Authentication required';
  end if;

  expected_path := account_id::text || '/avatar.webp';
  if new_avatar_path is distinct from expected_path then
    raise exception 'Invalid profile photo path';
  end if;

  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'profile-avatars'
      and name = expected_path
      and owner_id = account_id::text
  ) then
    raise exception 'Uploaded profile photo was not found';
  end if;

  update public.profiles
  set avatar_path = expected_path,
      updated_at = now()
  where auth_user_id = account_id;

  if not found then
    raise exception 'HRMS profile not found';
  end if;
end;
$$;

revoke all on function public.update_own_avatar_path(text) from public, anon;
grant execute on function public.update_own_avatar_path(text) to authenticated;

comment on column public.profiles.avatar_path is
  'Private Supabase Storage object path for the employee-owned profile photo.';
