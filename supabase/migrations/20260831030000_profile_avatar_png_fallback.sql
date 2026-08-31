-- Canvas export can legitimately fall back from WebP to PNG in some browsers.
-- Preserve existing WebP photos and allow the real PNG crop with the same ownership boundary.
alter table public.profiles drop constraint if exists profiles_avatar_path_format;
alter table public.profiles add constraint profiles_avatar_path_format
  check (avatar_path is null or avatar_path ~ '^[0-9a-fA-F-]{36}/avatar\.(webp|png)$');

update storage.buckets
set allowed_mime_types = array['image/webp', 'image/png'],
    file_size_limit = 2097152,
    public = false
where id = 'profile-avatars';

alter policy "profile avatar owners can insert" on storage.objects
with check (
  bucket_id = 'profile-avatars'
  and name in ((select auth.uid())::text || '/avatar.webp', (select auth.uid())::text || '/avatar.png')
);

alter policy "profile avatar owners can update" on storage.objects
using (
  bucket_id = 'profile-avatars'
  and name in ((select auth.uid())::text || '/avatar.webp', (select auth.uid())::text || '/avatar.png')
)
with check (
  bucket_id = 'profile-avatars'
  and name in ((select auth.uid())::text || '/avatar.webp', (select auth.uid())::text || '/avatar.png')
);

create or replace function public.update_own_avatar_path(new_avatar_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := (select auth.uid());
begin
  if account_id is null then
    raise exception 'Authentication required';
  end if;

  if new_avatar_path is null or new_avatar_path not in (
    account_id::text || '/avatar.webp', account_id::text || '/avatar.png'
  ) then
    raise exception 'Invalid profile photo path';
  end if;

  if not exists (
    select 1 from storage.objects
    where bucket_id = 'profile-avatars'
      and name = new_avatar_path
      and owner_id = account_id::text
      and metadata->>'mimetype' = case when new_avatar_path like '%.png' then 'image/png' else 'image/webp' end
  ) then
    raise exception 'Uploaded profile photo was not found or its format does not match';
  end if;

  update public.profiles
  set avatar_path = new_avatar_path, updated_at = now()
  where auth_user_id = account_id;

  if not found then
    raise exception 'HRMS profile not found';
  end if;
end;
$$;

revoke all on function public.update_own_avatar_path(text) from public, anon;
grant execute on function public.update_own_avatar_path(text) to authenticated;
