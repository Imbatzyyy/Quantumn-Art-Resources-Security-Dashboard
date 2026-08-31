-- Directory readers may see only the current photo of an employee profile
-- already visible through profiles RLS. The bucket and all write policies stay private.
create policy "directory readers can view employee avatars"
on storage.objects for select
to authenticated
using (
  bucket_id = 'profile-avatars'
  and public.has_hrms_role(array['admin', 'hr_admin', 'payroll_admin', 'auditor'])
  and exists (
    select 1 from public.profiles p
    where p.role = 'employee'
      and p.avatar_path = storage.objects.name
      and p.auth_user_id::text = (storage.foldername(storage.objects.name))[1]
  )
);
