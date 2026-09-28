begin;
select no_plan();
insert into auth.users(id,email,raw_app_meta_data) values
 ('10000000-0000-4000-8000-000000000001','code-admin@example.test','{}');
insert into auth.sessions(id,user_id) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001');
insert into public.profiles(employee_code,auth_user_id,first_name,last_name,email,role,department,position)
 values('OTP-ADMIN','10000000-0000-4000-8000-000000000001','Email','QA','code-admin@example.test','admin','QA','QA');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","session_id":"20000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
set local role authenticated;
select ok(not private.hrms_access_allowed(),'password alone cannot unlock the workspace');
select is((select count(*)::int from public.profiles),0,'REST/RLS profile data is hidden before email verification');
select throws_ok('select public.assert_hrms_access()','42501',null,'protected operations reject unverified sessions');
select is(public.signin_email_context()->>'verified','false','bootstrap reports email verification pending');
select is(public.signin_email_context()->>'passwordAuthenticated','true','bootstrap recognizes password authentication');
select ok(not has_function_privilege('authenticated','public.manage_signin_email(text,uuid,uuid,text,uuid,boolean)','execute'),'browser cannot grant its own verification');
select ok(not has_table_privilege('authenticated','private.email_signin_sessions','SELECT'),'browser cannot read code digests');
reset role;

select is(public.manage_signin_email('reserve','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',repeat('a',64),'30000000-0000-4000-8000-000000000001')->>'send','true','server reserves a fresh code');
select is(public.manage_signin_email('verify','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',repeat('a',64),'30000000-0000-4000-8000-000000000001')->>'error','expired','code is unusable before provider accepts delivery');
select is(public.manage_signin_email('sent','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',null,'30000000-0000-4000-8000-000000000001')->>'sent','true','provider acceptance activates code');
select is(public.manage_signin_email('reserve','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',repeat('b',64),'30000000-0000-4000-8000-000000000002')->>'challengeId','30000000-0000-4000-8000-000000000001','refresh reuses an existing code without resending');
select is(public.manage_signin_email('reserve','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',repeat('b',64),'30000000-0000-4000-8000-000000000002')->>'error','cooldown','new sessions cannot bypass account-level resend cooldown');
select is(public.manage_signin_email('verify','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',repeat('a',64),'30000000-0000-4000-8000-000000000001')->>'error','expired','a code cannot verify a different session');
select is(public.manage_signin_email('verify','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',repeat('b',64),'30000000-0000-4000-8000-000000000001')->>'attemptsRemaining','4','incorrect code consumes an attempt');
select is((select attempts from private.email_signin_sessions where session_id='20000000-0000-4000-8000-000000000001'),1,'incorrect attempt persists');
update private.email_signin_sessions set expires_at=now()-interval '1 second';
select is(public.manage_signin_email('verify','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',repeat('a',64),'30000000-0000-4000-8000-000000000001')->>'error','expired','correct but expired code is rejected');
update private.email_signin_sessions set expires_at=now()+interval '10 minutes',attempts=5;
select is(public.manage_signin_email('verify','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',repeat('a',64),'30000000-0000-4000-8000-000000000001')->>'error','expired','five wrong attempts lock the code');
update private.email_signin_sessions set attempts=1;
update private.email_signin_limits set attempts=20;
select is(public.manage_signin_email('verify','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',repeat('a',64),'30000000-0000-4000-8000-000000000001')->>'error','rate_limit','hourly verification limit rejects further guesses');
update private.email_signin_limits set attempts=1,last_sent_at=now()-interval '2 minutes',sends=10;
select is(public.manage_signin_email('reserve','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',repeat('b',64),'30000000-0000-4000-8000-000000000002',true)->>'error','rate_limit','hourly email limit is enforced');
update private.email_signin_limits set sends=1;
select is(public.manage_signin_email('reserve','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',repeat('b',64),'30000000-0000-4000-8000-000000000002',true)->>'send','true','resend replaces the challenge');
select is(public.manage_signin_email('sent','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',null,'30000000-0000-4000-8000-000000000001')->>'error','replaced','stale delivery callback cannot activate a replaced code');
select public.manage_signin_email('sent','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',null,'30000000-0000-4000-8000-000000000002');
select is(public.manage_signin_email('verify','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',repeat('a',64),'30000000-0000-4000-8000-000000000001')->>'error','expired','old code is rejected after resend');
select is(public.manage_signin_email('verify','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',repeat('b',64),'30000000-0000-4000-8000-000000000002')->>'verified','true','latest correct code verifies the session');
select ok((select code_digest is null from private.email_signin_sessions where session_id='20000000-0000-4000-8000-000000000001'),'used digest is removed');
set local role authenticated;
select ok(private.hrms_access_allowed(),'verified session unlocks authorized access');
select lives_ok('select public.assert_hrms_access()','protected operation is now available');
reset role;
update auth.users set email='changed@example.test' where id='10000000-0000-4000-8000-000000000001';
select ok(not private.hrms_access_allowed(),'changing account email invalidates the previous verification');
update auth.users set raw_app_meta_data='{"must_change_password":true}' where id='10000000-0000-4000-8000-000000000001';
select is(public.manage_signin_email('reserve','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',repeat('c',64),'30000000-0000-4000-8000-000000000003')->>'error','setup_required','incomplete accounts use their setup flow, not sign-in codes');
select * from finish();
rollback;
