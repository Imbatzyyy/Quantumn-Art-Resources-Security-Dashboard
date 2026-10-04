begin;
select no_plan();

insert into auth.users(id,email,raw_app_meta_data) values
 ('41000000-0000-4000-8000-000000000001','wf-admin@example.test','{}'),
 ('41000000-0000-4000-8000-000000000002','wf-hr@example.test','{}'),
 ('41000000-0000-4000-8000-000000000003','wf-payroll@example.test','{}'),
 ('41000000-0000-4000-8000-000000000004','wf-employee@example.test','{}'),
 ('41000000-0000-4000-8000-000000000005','wf-other@example.test','{}'),
 ('41000000-0000-4000-8000-000000000006','wf-security@example.test','{"role":"security_admin"}');
insert into auth.sessions(id,user_id) values
 ('42000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001'),
 ('42000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000002'),
 ('42000000-0000-4000-8000-000000000003','41000000-0000-4000-8000-000000000003'),
 ('42000000-0000-4000-8000-000000000004','41000000-0000-4000-8000-000000000004'),
 ('42000000-0000-4000-8000-000000000005','41000000-0000-4000-8000-000000000005'),
 ('42000000-0000-4000-8000-000000000006','41000000-0000-4000-8000-000000000006');
insert into private.email_signin_sessions(session_id,user_id,email,state,verified_at)
select s.id, s.user_id, u.email, 'verified', now()
from auth.sessions s join auth.users u on u.id = s.user_id
where s.user_id::text like '41000000-%';
insert into public.profiles(employee_code,auth_user_id,first_name,last_name,email,role,department,position,salary) values
 ('WF-ADMIN','41000000-0000-4000-8000-000000000001','Admin','QA','wf-admin@example.test','admin','QA','QA',0),
 ('WF-HR','41000000-0000-4000-8000-000000000002','Hr','QA','wf-hr@example.test','hr_admin','QA','QA',0),
 ('WF-PAY','41000000-0000-4000-8000-000000000003','Payroll','QA','wf-payroll@example.test','payroll_admin','QA','QA',0),
 ('WF-EMP','41000000-0000-4000-8000-000000000004','Employee','QA','wf-employee@example.test','employee','QA','QA',35000),
 ('WF-OTHER','41000000-0000-4000-8000-000000000005','Other','QA','wf-other@example.test','employee','QA','QA',20000),
 ('WF-SEC','41000000-0000-4000-8000-000000000006','Security','QA','wf-security@example.test','security_admin','QA','QA',0);

create function pg_temp.act_as(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', '41000000-0000-4000-8000-00000000000' || n,
    'session_id', '42000000-0000-4000-8000-00000000000' || n,
    'role', 'authenticated', 'aal', 'aal1')::text, true);
$$;
grant execute on function pg_temp.act_as(int) to authenticated;

-- ---------------------------------------------------------------- leave ---
select ok(not has_function_privilege('anon','public.cancel_leave_request(bigint)','execute'),'anonymous cannot cancel leave');
select ok(not has_function_privilege('anon','public.review_leave_request(bigint,text,text)','execute'),'anonymous cannot review leave');

select pg_temp.act_as(4);
set local role authenticated;
select lives_ok($$select public.submit_leave_request('Vacation', (now() at time zone 'Asia/Manila')::date + 10, (now() at time zone 'Asia/Manila')::date + 11, 'Family trip')$$,'employee files leave');
select lives_ok($$select public.submit_leave_request('Sick', (now() at time zone 'Asia/Manila')::date + 20, (now() at time zone 'Asia/Manila')::date + 20, 'Medical check')$$,'employee files second leave');
select lives_ok($$select public.submit_leave_request('Vacation', (now() at time zone 'Asia/Manila')::date + 30, (now() at time zone 'Asia/Manila')::date + 30, 'Errands')$$,'employee files third leave');
reset role;

select pg_temp.act_as(2);
set local role authenticated;
select lives_ok($$select public.review_leave_request((select id from public.leave_requests where employee_code='WF-EMP' and reason='Family trip'),'Rejected','Peak season. Please choose another week.')$$,'HR rejects with a note');
select lives_ok($$select public.review_leave_request(request_id=>(select id from public.leave_requests where employee_code='WF-EMP' and reason='Medical check'),decision=>'Approved')$$,'two-argument named call still works');
reset role;

select is((select decision_note from public.leave_requests where reason='Family trip' and employee_code='WF-EMP'),'Peak season. Please choose another week.','decision note is stored');
select is((select decision_note from public.leave_requests where reason='Medical check' and employee_code='WF-EMP'),null,'approval without a note stores none');
select ok(exists(select 1 from public.notifications where employee_code='WF-EMP' and message like '%Note from HR: Peak season%'),'employee is told the reason');

select pg_temp.act_as(5);
set local role authenticated;
select throws_ok($$select public.cancel_leave_request((select id from public.leave_requests where employee_code='WF-EMP' and reason='Errands'))$$,null,'another employee cannot cancel the leave');
reset role;

select pg_temp.act_as(4);
set local role authenticated;
select lives_ok($$select public.cancel_leave_request((select id from public.leave_requests where employee_code='WF-EMP' and reason='Errands'))$$,'employee cancels pending leave');
select lives_ok($$select public.cancel_leave_request((select id from public.leave_requests where employee_code='WF-EMP' and reason='Medical check'))$$,'employee cancels approved future leave');
select throws_ok($$select public.cancel_leave_request((select id from public.leave_requests where employee_code='WF-EMP' and reason='Family trip'))$$,null,'rejected leave cannot be cancelled');
reset role;
select is((select status from public.leave_requests where employee_code='WF-EMP' and reason='Errands'),'Cancelled','pending leave is cancelled');
select ok((select cancelled_at is not null from public.leave_requests where employee_code='WF-EMP' and reason='Medical check'),'cancellation time is recorded');

insert into public.leave_requests(employee_code,leave_type,start_date,end_date,days,reason,status)
values('WF-EMP','Vacation',(now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date,1,'Started already','Approved');
select pg_temp.act_as(4);
set local role authenticated;
select throws_ok($$select public.cancel_leave_request((select id from public.leave_requests where employee_code='WF-EMP' and reason='Started already'))$$,null,'leave that has started cannot be cancelled');
select lives_ok($$select public.submit_leave_request('Vacation', (now() at time zone 'Asia/Manila')::date + 30, (now() at time zone 'Asia/Manila')::date + 30, 'Errands again')$$,'cancelled dates can be requested again');
reset role;

-- ------------------------------------------------------- leave policies ---
select pg_temp.act_as(4);
set local role authenticated;
select is((select count(*)::int from public.leave_policies),4,'employees can read leave allowances');
select throws_ok($$select public.save_leave_policy('Vacation',30)$$,'42501',null,'employees cannot change allowances');
reset role;

select pg_temp.act_as(2);
set local role authenticated;
select lives_ok($$select public.save_leave_policy('Vacation',15,'Updated for 2027')$$,'HR changes an allowance');
select throws_ok($$select public.save_leave_policy('Vacation',400)$$,null,'allowance must be realistic');
select throws_ok($$select public.save_leave_policy('Sabbatical',5)$$,null,'unknown leave type is rejected');
select lives_ok($$select public.save_leave_policy('Other',null)$$,'a type can have no fixed allowance');
reset role;
select is((select annual_days from public.leave_policies where leave_type='Vacation'),15.0,'allowance is saved');
select is((select updated_by from public.leave_policies where leave_type='Vacation'),'WF-HR','editor is recorded');
select ok(not has_table_privilege('authenticated','public.leave_policies','UPDATE'),'allowances change only through the RPC');

-- -------------------------------------------------- statutory payroll ---
select is((select row(sss,philhealth,pagibig,withholding_tax)::text from private.ph_statutory_deductions(35000)),'(1750.00,875.00,200.00,1701.30)','₱35,000 monthly salary');
select is((select row(sss,philhealth,pagibig,withholding_tax)::text from private.ph_statutory_deductions(20000)),'(1000.00,500.00,200.00,0.00)','₱20,000 is below the tax threshold');
select is((select row(sss,philhealth,pagibig,withholding_tax)::text from private.ph_statutory_deductions(150000)),'(1750.00,2500.00,200.00,28262.55)','contribution ceilings apply');
select is((select row(sss,philhealth,pagibig,withholding_tax)::text from private.ph_statutory_deductions(1200)),'(250.00,250.00,12.00,0.00)','minimum credits and the 1% Pag-IBIG rate');
select is((select row(sss,philhealth,pagibig,withholding_tax)::text from private.ph_statutory_deductions(0)),'(0,0,0,0)','no salary, no deductions');
select ok(not has_function_privilege('authenticated','private.ph_statutory_deductions(numeric)','execute'),'calculator is not a public RPC');

select pg_temp.act_as(3);
set local role authenticated;
select lives_ok($$select public.generate_payroll('WF Statutory 2099', 0, 'Philippine statutory')$$,'payroll admin runs statutory payroll');
select lives_ok($$select public.generate_payroll(payroll_period=>'WF Flat 2099', deduction_rate=>8.25)$$,'two-argument flat-rate call still works');
select throws_ok($$select public.generate_payroll('WF Bad 2099', 0, 'Guesswork')$$,null,'unknown method is rejected');
reset role;
select is((select row(sss_contribution,philhealth_contribution,pagibig_contribution,withholding_tax,deductions,net)::text from public.payroll where employee_code='WF-EMP' and period='WF Statutory 2099'),'(1750.00,875.00,200.00,1701.30,4526.30,30473.70)','itemized deductions add up to the total');
select is((select calculation_method from public.payroll_runs where period='WF Statutory 2099'),'Philippine statutory','run records the method');
select is((select row(deductions,sss_contribution)::text from public.payroll where employee_code='WF-EMP' and period='WF Flat 2099'),'(2887.50,0.00)','flat-rate payroll is unchanged');
select is((select calculation_method from public.payroll_runs where period='WF Flat 2099'),'Flat rate','flat method is the default');

select pg_temp.act_as(2);
set local role authenticated;
select throws_ok($$select public.generate_payroll('WF HR 2099', 0, 'Philippine statutory')$$,'42501',null,'HR cannot run payroll');
reset role;

-- --------------------------------------------------- document files ---
insert into storage.objects(bucket_id,name,metadata) values
 ('hr-documents','43000000-0000-4000-8000-000000000001/contract.pdf','{"size":2048,"mimetype":"application/pdf"}'),
 ('hr-documents','43000000-0000-4000-8000-000000000002/notes.txt','{"size":12,"mimetype":"text/plain"}');

select pg_temp.act_as(2);
set local role authenticated;
select lives_ok($$insert into public.employee_documents(employee_code,title,document_type,content,filename,file_path,file_size,mime_type,uploaded_by)
  values('WF-EMP','Employment contract','Contract','Signed employment contract.','contract.pdf','43000000-0000-4000-8000-000000000001/contract.pdf',1,'text/html','WF-HR')$$,'HR attaches an uploaded file');
select throws_ok($$insert into public.employee_documents(employee_code,title,document_type,content,filename,file_path,uploaded_by)
  values('WF-EMP','Missing file','Contract','No upload.','missing.pdf','43000000-0000-4000-8000-000000000009/missing.pdf','WF-HR')$$,null,'a record cannot point to a missing upload');
select throws_ok($$insert into public.employee_documents(employee_code,title,document_type,content,filename,file_path,uploaded_by)
  values('WF-EMP','Bad path','Contract','Bad path.','x.pdf','../other/x.pdf','WF-HR')$$,null,'file paths are validated');
select is((select count(*)::int from storage.objects where bucket_id='hr-documents' and name like '43000000-0000-4000-8000-000000000002/%'),1,'HR can see an unattached upload to clean it up');
reset role;
select is((select row(file_size,mime_type)::text from public.employee_documents where title='Employment contract' and employee_code='WF-EMP'),'(2048,application/pdf)','size and type come from Storage, not the browser');

select pg_temp.act_as(4);
set local role authenticated;
select is((select count(*)::int from storage.objects where bucket_id='hr-documents' and name='43000000-0000-4000-8000-000000000001/contract.pdf'),1,'employee can read their document file');
select is((select count(*)::int from storage.objects where bucket_id='hr-documents' and name like '43000000-0000-4000-8000-000000000002/%'),0,'employee cannot see unattached uploads');
reset role;

select pg_temp.act_as(5);
set local role authenticated;
select is((select count(*)::int from storage.objects where bucket_id='hr-documents'),0,'another employee cannot read the file');
reset role;

select pg_temp.act_as(2);
set local role authenticated;
select ok(exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='hr staff remove unattached document files' and cmd='DELETE' and qual ilike '%not (exists%employee_documents%'),'only unattached files can be deleted');
reset role;

-- ---------------------------------------------------- announcements ---
select pg_temp.act_as(2);
set local role authenticated;
insert into public.announcements(title,content,priority) values('WF Holiday notice','Office closed on Friday.','Normal');
reset role;
select ok(exists(select 1 from public.notifications where employee_code='WF-EMP' and title='WF Holiday notice'),'announcement reaches inboxes');

select pg_temp.act_as(4);
set local role authenticated;
with changed as (update public.announcements set title='Hacked' where title='WF Holiday notice' returning 1) select is(count(*)::int,0,'employees cannot edit announcements') from changed;
with removed as (delete from public.announcements where title='WF Holiday notice' returning 1) select is(count(*)::int,0,'employees cannot delete announcements') from removed;
reset role;

select pg_temp.act_as(2);
set local role authenticated;
with changed as (update public.announcements set title='WF Holiday notice (corrected)', content='Office closed on Monday.' where title='WF Holiday notice' returning 1) select is(count(*)::int,1,'HR corrects an announcement') from changed;
reset role;
select ok((select updated_at is not null from public.announcements where title='WF Holiday notice (corrected)'),'correction time is recorded');
select is((select message from public.notifications where employee_code='WF-EMP' and title='WF Holiday notice (corrected)'),'Office closed on Monday.','inbox copies show the corrected text');

select pg_temp.act_as(2);
set local role authenticated;
with removed as (delete from public.announcements where title='WF Holiday notice (corrected)' returning 1) select is(count(*)::int,1,'HR withdraws an announcement') from removed;
reset role;
select is((select count(*)::int from public.notifications where title like 'WF Holiday notice%'),0,'withdrawn announcement leaves inboxes');

select pg_temp.act_as(2);
set local role authenticated;
select lives_ok($$insert into public.announcements(title,content,priority) values('WF Long notice', repeat('x', 900), 'Normal')$$,'announcements longer than an inbox message can be published');
reset role;

-- --------------------------------------------- administrator accounts ---
select ok(not has_function_privilege('anon','public.manage_admin_account(text,text,text)','execute'),'anonymous cannot manage accounts');

select pg_temp.act_as(2);
set local role authenticated;
select throws_ok($$select public.manage_admin_account('change-role','WF-SEC','auditor')$$,'42501',null,'HR administrators cannot change roles');
reset role;

select pg_temp.act_as(1);
set local role authenticated;
select throws_ok($$select public.manage_admin_account('change-role','WF-ADMIN','auditor')$$,null,'administrators cannot change their own role');
select throws_ok($$select public.manage_admin_account('deactivate','WF-EMP')$$,null,'employee accounts are managed elsewhere');
select throws_ok($$select public.manage_admin_account('change-role','WF-SEC','superuser')$$,null,'unknown roles are rejected');
select is(public.manage_admin_account('change-role','WF-SEC','auditor')->>'role','auditor','System Administrator changes a role');
reset role;
select is((select role from public.profiles where employee_code='WF-SEC'),'auditor','role is saved');
select is((select raw_app_meta_data->>'role' from auth.users where id='41000000-0000-4000-8000-000000000006'),'auditor','sign-in metadata follows the role');
select ok(exists(select 1 from private.revoked_hrms_sessions where user_id='41000000-0000-4000-8000-000000000006'),'role change ends existing sign-ins');
select ok(exists(select 1 from public.audit_logs where action='Changed administrator role' and target like 'WF-SEC%'),'role change is audited');

select pg_temp.act_as(1);
set local role authenticated;
select is(public.manage_admin_account('deactivate','WF-PAY')->>'status','Inactive','System Administrator deactivates an account');
select throws_ok($$select public.manage_admin_account('deactivate','WF-PAY')$$,null,'cannot deactivate twice');
reset role;

select pg_temp.act_as(3);
set local role authenticated;
select is(public.current_hrms_role(),null,'deactivated account loses access immediately');
reset role;

select pg_temp.act_as(1);
set local role authenticated;
select is(public.manage_admin_account('reactivate','WF-PAY')->>'status','Active','account can be reactivated');
reset role;

select * from finish();
rollback;
