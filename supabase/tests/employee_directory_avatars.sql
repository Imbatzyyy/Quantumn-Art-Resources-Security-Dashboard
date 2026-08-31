begin;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000a001', 'avatar-admin@example.test'),
  ('00000000-0000-4000-8000-00000000a002', 'avatar-employee@example.test'),
  ('00000000-0000-4000-8000-00000000a003', 'avatar-peer@example.test');
insert into public.profiles (employee_code, auth_user_id, first_name, last_name, email, role, department, position, avatar_path) values
  ('AVATAR-ADMIN', '00000000-0000-4000-8000-00000000a001', 'Test', 'Admin', 'avatar-admin@example.test', 'admin', 'QA', 'Admin', null),
  ('AVATAR-EMPLOYEE', '00000000-0000-4000-8000-00000000a002', 'Test', 'Employee', 'avatar-employee@example.test', 'employee', 'QA', 'Employee', '00000000-0000-4000-8000-00000000a002/avatar.png'),
  ('AVATAR-PEER', '00000000-0000-4000-8000-00000000a003', 'Test', 'Peer', 'avatar-peer@example.test', 'employee', 'QA', 'Employee', null);
insert into storage.objects (bucket_id, name) values
  ('profile-avatars', '00000000-0000-4000-8000-00000000a002/avatar.png'),
  ('profile-avatars', '00000000-0000-4000-8000-00000000a002/avatar.webp');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a001', true);
select is((select count(*)::int from storage.objects where name = '00000000-0000-4000-8000-00000000a002/avatar.png'), 1, 'administrator can read the current employee photo');
select is((select count(*)::int from storage.objects where name = '00000000-0000-4000-8000-00000000a002/avatar.webp'), 0, 'administrator cannot read obsolete employee photos');
with changed as (update storage.objects set metadata = '{}'::jsonb where name = '00000000-0000-4000-8000-00000000a002/avatar.png' returning id)
select is((select count(*)::int from changed), 0, 'directory access does not permit editing employee photos');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a002', true);
select is((select count(*)::int from storage.objects where name = '00000000-0000-4000-8000-00000000a002/avatar.png'), 1, 'employee can still read their own photo');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a003', true);
select is((select count(*)::int from storage.objects where name = '00000000-0000-4000-8000-00000000a002/avatar.png'), 0, 'another employee cannot read the photo');
reset role;
update public.profiles set role = 'hr_admin' where employee_code = 'AVATAR-ADMIN';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a001', true);
select is((select count(*)::int from storage.objects where name = '00000000-0000-4000-8000-00000000a002/avatar.png'), 1, 'HR administrator can read the current employee photo');
reset role;
update public.profiles set role = 'security_admin' where employee_code = 'AVATAR-ADMIN';
set local role authenticated;
select is((select count(*)::int from storage.objects where name = '00000000-0000-4000-8000-00000000a002/avatar.png'), 0, 'security-only role cannot read directory photos');
reset role;
update public.profiles set role = 'admin', status = 'Inactive' where employee_code = 'AVATAR-ADMIN';
set local role authenticated;
select is((select count(*)::int from storage.objects where name = '00000000-0000-4000-8000-00000000a002/avatar.png'), 0, 'inactive administrator cannot read employee photos');
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is((select count(*)::int from storage.objects where name = '00000000-0000-4000-8000-00000000a002/avatar.png'), 0, 'anonymous visitors cannot read employee photos');
reset role;
select * from finish();
rollback;
