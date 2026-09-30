begin;
select no_plan();
insert into auth.users(id,email,raw_app_meta_data) values
 ('11000000-0000-4000-8000-000000000001','issuer@example.test','{}'),
 ('11000000-0000-4000-8000-000000000002','target@example.test','{}'),
 ('11000000-0000-4000-8000-000000000003','employee@example.test','{}');
insert into public.profiles(employee_code,auth_user_id,first_name,last_name,email,role,department,position) values
 ('RESET-ISSUER','11000000-0000-4000-8000-000000000001','Issuer','QA','issuer@example.test','admin','QA','QA'),
 ('RESET-TARGET','11000000-0000-4000-8000-000000000002','Target','QA','target@example.test','security_admin','QA','QA'),
 ('RESET-EMPLOYEE','11000000-0000-4000-8000-000000000003','Employee','QA','employee@example.test','employee','QA','QA');
insert into auth.sessions(id,user_id) values
 ('22000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001'),
 ('22000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000002'),
 ('22000000-0000-4000-8000-000000000003','11000000-0000-4000-8000-000000000002');
select ok(not has_function_privilege('authenticated','public.manage_admin_password_reset(text,uuid,uuid,text,text,uuid)','execute'),'browser cannot create or consume reset grants through the RPC');
select ok(not has_function_privilege('anon','public.manage_admin_password_reset(text,uuid,uuid,text,text,uuid)','execute'),'anonymous clients cannot call the private reset manager');
select ok(not has_table_privilege('authenticated','private.admin_password_resets','SELECT'),'browser cannot read reset token hashes');
select is(public.manage_admin_password_reset('reserve','33000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000002','RESET-TARGET')->>'error','forbidden','Security Admin cannot issue resets');
select is(public.manage_admin_password_reset('reserve','33000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','RESET-EMPLOYEE')->>'error','ineligible','employee cannot be targeted');
update auth.users set raw_app_meta_data='{"must_set_password":true}' where id='11000000-0000-4000-8000-000000000002';
select is(public.manage_admin_password_reset('reserve','33000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','RESET-TARGET')->>'error','ineligible','pending invitation cannot skip setup');
update auth.users set raw_app_meta_data='{}' where id='11000000-0000-4000-8000-000000000002';
select is(public.manage_admin_password_reset('reserve','33000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','RESET-TARGET')->>'email','target@example.test','recipient comes from the verified account');
select is((select expires_at-created_at from private.admin_password_resets where id='33000000-0000-4000-8000-000000000001'),interval '30 minutes','link deadline is 30 minutes');
select is(public.manage_admin_password_reset('reserve','33000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000001','RESET-TARGET')->>'error','rate_limit','repeated sends are rate limited');
select is(public.manage_admin_password_reset('exchange',token_hash=>repeat('a',64))->>'error','invalid','unactivated reset cannot be exchanged');
select is(public.manage_admin_password_reset('sent','33000000-0000-4000-8000-000000000001',token_hash=>repeat('a',64))->>'ok','true','provider acceptance activates link');
update private.admin_password_resets set expires_at=now()-interval '1 second';
select is(public.manage_admin_password_reset('exchange',token_hash=>repeat('a',64))->>'error','expired','expired capability cannot create an Auth session');
update private.admin_password_resets set expires_at=now()+interval '30 minutes';
select is(public.manage_admin_password_reset('exchange',token_hash=>repeat('a',64))->>'ok','true','valid capability can be claimed once');
select is(public.manage_admin_password_reset('exchange',token_hash=>repeat('a',64))->>'error','invalid','concurrent or replayed claims fail');
select is(public.manage_admin_password_reset('bind','33000000-0000-4000-8000-000000000001',sid=>'22000000-0000-4000-8000-000000000001')->>'error','invalid','cannot bind another account session');
select is(public.manage_admin_password_reset('bind','33000000-0000-4000-8000-000000000001',sid=>'22000000-0000-4000-8000-000000000002')->>'ok','true','binds the verified recipient session');
select is(public.manage_admin_password_reset('consume','33000000-0000-4000-8000-000000000001',sid=>'22000000-0000-4000-8000-000000000003')->>'error','invalid','another session of the same account cannot consume it');
select is(public.manage_admin_password_reset('consume','33000000-0000-4000-8000-000000000001',sid=>'22000000-0000-4000-8000-000000000002')->>'ok','true','recipient session consumes grant');
select is(public.manage_admin_password_reset('consume','33000000-0000-4000-8000-000000000001',sid=>'22000000-0000-4000-8000-000000000002')->>'error','invalid','parallel password writes are rejected');
update private.admin_password_resets set expires_at=now()-interval '1 second';
select is(public.manage_admin_password_reset('complete','33000000-0000-4000-8000-000000000001',sid=>'22000000-0000-4000-8000-000000000002')->>'ok','true','completion revokes existing sessions');
select is((select count(*)::int from private.revoked_hrms_sessions where user_id='11000000-0000-4000-8000-000000000002'),2,'all target sessions are revoked');
select ok(exists(select 1 from public.audit_logs where action='Completed administrator password reset' and actor_employee_code='RESET-TARGET'),'completion has an audit record');
select is((select role from public.profiles where employee_code='RESET-TARGET'),'security_admin','reset does not change role');
-- Replacement invalidates even an already-open previous reset form.
update private.admin_password_resets set created_at=now()-interval '2 minutes',state='exchanged' where id='33000000-0000-4000-8000-000000000001';
select public.manage_admin_password_reset('reserve','33000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000001','RESET-TARGET');
select public.manage_admin_password_reset('sent','33000000-0000-4000-8000-000000000002',token_hash=>repeat('b',64));
select is((select state from private.admin_password_resets where id='33000000-0000-4000-8000-000000000001'),'replaced','new reset supersedes the previous request');
update public.profiles set status='Inactive' where employee_code='RESET-TARGET';
select is(public.manage_admin_password_reset('exchange',token_hash=>repeat('b',64))->>'error','expired','deactivated recipient cannot use a previously sent link');
select * from finish();
rollback;
