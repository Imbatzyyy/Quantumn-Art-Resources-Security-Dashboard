begin;
select no_plan();
insert into auth.users(id,email,raw_app_meta_data) values
 ('11000000-0000-4000-8000-000000000001','handoff@example.test','{}');
insert into auth.sessions(id,user_id) values
 ('21000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001');
insert into public.profiles(employee_code,auth_user_id,first_name,last_name,email,role,department,position)
 values('HANDOFF-QA','11000000-0000-4000-8000-000000000001','Handoff','QA','handoff@example.test','employee','QA','QA');
select set_config('request.jwt.claims','{"sub":"11000000-0000-4000-8000-000000000001","session_id":"21000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
set local role authenticated;
select ok(not has_function_privilege('anon','public.finish_hrms_signin(text,text,text)','execute'),'anonymous cannot call handoff');
select is(public.get_hrms_identity()->>'email_verified','false','identity carries fresh email state');
select ok(not (public.get_hrms_identity() ? 'department'),'pre-verification identity omits HR details');
select throws_ok($$select public.finish_hrms_signin('employee','QA','QA')$$,'42501',null,'handoff cannot bypass email verification');
reset role;
insert into private.email_signin_sessions(session_id,user_id,email,state,verified_at)
 values('21000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','handoff@example.test','verified',now());
set local role authenticated;
select throws_ok($$select public.finish_hrms_signin('admin','QA','QA')$$,'42501',null,'handoff rejects wrong portal');
select throws_ok($$select public.finish_hrms_signin(null,'QA','QA')$$,'42501',null,'handoff rejects missing portal');
select is(public.finish_hrms_signin('employee','QA','QA')->'profile'->>'employee_code','HANDOFF-QA','verified handoff returns own identity');
select is(public.finish_hrms_signin('employee','QA','QA')->>'sessionCode','SES-21000000000040008000000000000001','handoff records the real Auth session');
select is((select count(*)::int from public.account_sessions where employee_code='HANDOFF-QA'),1,'repeated handoff does not duplicate sessions');
reset role;
select set_config('request.jwt.claims','{"sub":"11000000-0000-4000-8000-000000000001","session_id":"21000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","amr":[{"method":"otp"}]}',true);
set local role authenticated;
select throws_ok($$select public.finish_hrms_signin('employee','QA','QA')$$,'42501',null,'recovery/OTP-only session cannot use password sign-in handoff');
reset role;
select set_config('request.jwt.claims','{"sub":"11000000-0000-4000-8000-000000000001","session_id":"21000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
update auth.users set raw_app_meta_data='{"must_change_password":true}' where id='11000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.finish_hrms_signin('employee','QA','QA')$$,'42501',null,'setup requirements are checked from fresh server metadata');
reset role;
update auth.users set raw_app_meta_data='{}' where id='11000000-0000-4000-8000-000000000001';
insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)
 values('31000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','totp','verified',now(),now());
set local role authenticated;
select is(public.get_hrms_identity()->>'mfa_required','true','identity carries fresh MFA state');
select is(public.finish_hrms_signin('employee','QA','QA')->>'mfaRequired','true','email alone cannot bypass an enrolled authenticator');
select ok(not (public.finish_hrms_signin('employee','QA','QA') ? 'profile'),'pending MFA does not return the full HR profile');
reset role;
select set_config('request.jwt.claims','{"sub":"11000000-0000-4000-8000-000000000001","session_id":"21000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","amr":[{"method":"password"},{"method":"totp"}]}',true);
set local role authenticated;
select is(public.finish_hrms_signin('employee','QA','QA')->'profile'->>'employee_code','HANDOFF-QA','verified MFA unlocks the handoff');
reset role;
update public.profiles set status='Inactive' where employee_code='HANDOFF-QA';
set local role authenticated;
select throws_ok($$select public.finish_hrms_signin('employee','QA','QA')$$,'42501',null,'inactive account denied');
reset role;
update public.profiles set status='Active' where employee_code='HANDOFF-QA';
insert into private.revoked_hrms_sessions(session_id,user_id) values('21000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok($$select public.finish_hrms_signin('employee','QA','QA')$$,'42501',null,'revoked session denied');
reset role;
select * from finish();
rollback;
