-- Defense in depth: these checks apply to REST, RPC, Storage and server functions.
create or replace function public.acknowledge_document(selected_document_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  employee text := public.current_employee_code();
begin
  if employee is null or not public.is_active_hrms_user() then
    raise exception 'Active authentication is required';
  end if;
  if not exists (
    select 1
    from public.employee_documents document
    where document.id = selected_document_id
      and (document.employee_code is null or document.employee_code = employee)
      and document.requires_ack = true
      and (document.expires_on is null or document.expires_on >= (now() at time zone 'Asia/Manila')::date)
  ) then
    raise exception 'Acknowledgement is not available for this document';
  end if;

  insert into public.document_acknowledgements (document_id, employee_code)
  values (selected_document_id, employee)
  on conflict (document_id, employee_code) do update
    set acknowledged_at = excluded.acknowledged_at;
end;
$$;
alter table public.employee_requests add column submission_key uuid unique;
revoke execute on function public.submit_employee_request(text,text,text,date,text,text) from public,anon,authenticated;
create or replace function public.submit_employee_request(
  request_key uuid,
  requested_type text,
  requested_subject text,
  requested_description text,
  requested_date date default null,
  requested_value text default null,
  requested_priority text default 'Normal'
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  employee text := public.current_employee_code();
  new_id bigint;
begin
  if employee is null or not public.is_active_hrms_user() then
    raise exception 'Active authentication is required';
  end if;
  if requested_type not in (
    'Attendance Correction', 'Overtime', 'Schedule Change', 'Profile Correction',
    'Document Request', 'Payroll Concern', 'General HR'
  ) then
    raise exception 'Unsupported request type';
  end if;
  if char_length(trim(requested_subject)) not between 3 and 120 then
    raise exception 'Use a subject between 3 and 120 characters';
  end if;
  if char_length(trim(requested_description)) not between 3 and 1000 then
    raise exception 'Use a description between 3 and 1000 characters';
  end if;
  if requested_priority not in ('Normal', 'High', 'Urgent') then
    raise exception 'Unsupported request priority';
  end if;

  if request_key is null then raise exception 'A request idempotency key is required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('request:' || request_key::text,0));
  select id into new_id from public.employee_requests where submission_key=request_key and employee_code=employee;
  if found then return new_id; end if;
  insert into public.employee_requests
    (employee_code, request_type, subject, description, requested_date, requested_value, priority, submission_key)
  values
    (
      employee,
      requested_type,
      trim(requested_subject),
      trim(requested_description),
      requested_date,
      nullif(trim(requested_value), ''),
      requested_priority,
      request_key
    )
  returning id into new_id;

  return new_id;
end;
$$;
revoke all on function public.submit_employee_request(uuid,text,text,text,date,text,text) from public,anon;
grant execute on function public.submit_employee_request(uuid,text,text,text,date,text,text) to authenticated;
create schema if not exists private;
-- Raw document bodies are read on demand; listing metadata does not download every file.
create or replace function public.read_employee_document(selected_document_id bigint) returns text
language plpgsql security invoker set search_path = '' as $$
declare body text; begin
 perform public.assert_hrms_access();
 select content into body from public.employee_documents where id=selected_document_id and (expires_on is null or expires_on >= (now() at time zone 'Asia/Manila')::date);
 if not found then raise exception 'This document is unavailable, expired or outside your access.'; end if;
 perform public.record_user_activity('Downloaded authorized document', selected_document_id::text);
 return body;
end;
$$;
revoke all on function public.read_employee_document(bigint) from public,anon;
grant execute on function public.read_employee_document(bigint) to authenticated;

create or replace function public.store_zap_evidence(scan jsonb, findings jsonb, actor text) returns text
language plpgsql security definer set search_path = '' as $$
declare existing text; run public.zap_scan_runs%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended(scan->>'report_sha256',0));
 select scan_code into existing from public.zap_scan_runs where report_sha256=scan->>'report_sha256' limit 1;
 if found then return existing; end if;
 run := jsonb_populate_record(null::public.zap_scan_runs,scan);
 insert into public.zap_scan_runs(scan_code,scan_type,environment,target_url,zap_version,completed_at,status,high_count,medium_count,low_count,informational_count,report_name,report_sha256,authorized_scope,reviewed_by,reviewed_at,notes)
 values(run.scan_code,run.scan_type,run.environment,run.target_url,run.zap_version,run.completed_at,run.status,run.high_count,run.medium_count,run.low_count,run.informational_count,run.report_name,run.report_sha256,run.authorized_scope,actor,now(),run.notes);
 insert into public.zap_findings(scan_code,plugin_id,name,risk,confidence,description,solution,reference_url,affected_url,evidence,status)
 select run.scan_code,f.plugin_id,f.name,f.risk,f.confidence,f.description,f.solution,f.reference_url,f.affected_url,f.evidence,'Open'
 from jsonb_populate_recordset(null::public.zap_findings,findings) f;
 insert into public.audit_logs(actor_employee_code,actor_label,action,target,display_time) values(actor,actor,'Imported baseline report evidence',run.scan_code,'Just now');
 return run.scan_code;
end;
$$;
revoke all on function public.store_zap_evidence(jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.store_zap_evidence(jsonb,jsonb,text) to service_role;

create or replace function public.clock_attendance(clock_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare employee text; local_now timestamp := now() at time zone 'Asia/Manila'; existing public.attendance%rowtype; assigned public.work_schedules%rowtype;
begin
 perform public.assert_hrms_access(); employee:=public.current_employee_code();
 if clock_action not in ('in','out') then raise exception 'Choose clock in or clock out.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('attendance:'||employee,0));
 select * into assigned from public.work_schedules where employee_code=employee and work_date=local_now::date;
 if clock_action='in' then
   if assigned.work_mode='Rest Day' then raise exception 'You cannot clock in for an assigned rest day.'; end if;
   if exists(select 1 from public.attendance where employee_code=employee and clock_out is null and work_date>=local_now::date-1) then return; end if;
   insert into public.attendance(employee_code,work_date,clock_in,status,hours)
   values(employee,local_now::date,local_now::time,case when assigned.shift_start is not null and local_now::time>assigned.shift_start then 'Late' else 'Present' end,0)
   on conflict(employee_code,work_date) do nothing;
 else
   select * into existing from public.attendance where employee_code=employee and clock_out is null and work_date>=local_now::date-1 order by work_date desc limit 1 for update;
   if not found then return; end if;
   if local_now-(existing.work_date+existing.clock_in)>interval '24 hours' then raise exception 'Ask HR to correct the earlier attendance record.'; end if;
   update public.attendance set clock_out=local_now::time,hours=greatest(0,extract(epoch from (local_now-(existing.work_date+existing.clock_in)))/3600),updated_at=now() where id=existing.id;
 end if;
end;
$$;
revoke all on function public.clock_attendance(text) from public,anon;
grant execute on function public.clock_attendance(text) to authenticated;
revoke execute on function public.clock_attendance() from public,anon,authenticated;
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.work_schedules'::regclass and contype='c' and pg_get_constraintdef(oid) like '%shift_end > shift_start%' loop
   execute format('alter table public.work_schedules drop constraint %I',c.conname);
 end loop;
end $$;
alter table public.work_schedules add constraint valid_shift_duration check(work_mode='Rest Day' or shift_start<>shift_end);

-- Serialize workflows and preserve published records.
create or replace function public.submit_leave_request(
  requested_type text,
  requested_start date,
  requested_end date,
  requested_reason text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  employee text := public.current_employee_code();
  calculated_days integer;
  new_id bigint;
begin
  if employee is null or not public.is_active_hrms_user() then
    raise exception 'Active authentication is required';
  end if;
  if requested_type not in ('Vacation', 'Sick', 'Emergency', 'Other') then
    raise exception 'Unsupported leave type';
  end if;
  if requested_start is null or requested_end is null or requested_start < (now() at time zone 'Asia/Manila')::date or requested_end < requested_start then
    raise exception 'Choose a valid current or future leave period';
  end if;

  calculated_days := requested_end - requested_start + 1;
  if calculated_days < 1 or calculated_days > 30 then
    raise exception 'A leave request must cover between 1 and 30 days';
  end if;
  if char_length(trim(requested_reason)) not between 3 and 500 then
    raise exception 'Provide a reason between 3 and 500 characters';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('leave:' || employee, 0));
  if exists (
    select 1
    from public.leave_requests
    where employee_code = employee
      and status in ('Pending', 'Approved')
      and daterange(start_date, end_date, '[]') && daterange(requested_start, requested_end, '[]')
  ) then
    raise exception 'This request overlaps an existing pending or approved leave period';
  end if;

  insert into public.leave_requests
    (employee_code, leave_type, start_date, end_date, days, reason, status)
  values
    (employee, requested_type, requested_start, requested_end, calculated_days, trim(requested_reason), 'Pending')
  returning id into new_id;

  return new_id;
end;
$$;
revoke insert,update on public.leave_requests from authenticated;
create or replace function public.generate_payroll(payroll_period text, deduction_rate numeric)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_id bigint;
  affected integer;
begin
  if not public.has_hrms_role(array['admin', 'payroll_admin']) then
    raise exception 'Payroll administrator access required';
  end if;
  if char_length(trim(payroll_period)) not between 3 and 60 then
    raise exception 'Enter a valid payroll period';
  end if;
  if deduction_rate < 0 or deduction_rate > 50 then
    raise exception 'Deduction rate must be between 0 and 50 percent';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('payroll:' || trim(payroll_period), 0));
  if exists (
    select 1 from public.payroll_runs
    where period = trim(payroll_period) and status in ('Released','Paid','Locked')
  ) then
    raise exception 'A released, paid or locked payroll run cannot be regenerated';
  end if;

  insert into public.payroll_runs
    (period, deduction_rate, status, created_by)
  values
    (trim(payroll_period), deduction_rate, 'Draft', public.current_employee_code())
  on conflict (period) do update set
    deduction_rate = excluded.deduction_rate,
    status = 'Draft',
    approved_by = null,
    approved_at = null,
    released_at = null,
    paid_at = null,
    locked_at = null,
    updated_at = now()
  returning id into run_id;

  delete from public.payroll pr where pr.payroll_run_id = run_id and not exists (
    select 1 from public.profiles p where p.employee_code=pr.employee_code and p.status in ('Active','On Leave') and p.role='employee');

  insert into public.payroll
    (employee_code, payroll_run_id, period, gross, allowances, bonuses, deductions, status, payment_date)
  select
    employee_code,
    run_id,
    trim(payroll_period),
    salary,
    0,
    0,
    round(salary * (deduction_rate / 100), 2),
    'Draft',
    null
  from public.profiles
  where status in ('Active', 'On Leave')
    and role = 'employee'
  on conflict (employee_code, period) do update set
    payroll_run_id = excluded.payroll_run_id,
    gross = excluded.gross,
    allowances = excluded.allowances,
    bonuses = excluded.bonuses,
    deductions = excluded.deductions,
    status = 'Draft',
    payment_date = null;

  get diagnostics affected = row_count;

  update public.payroll_runs payroll_run
  set employee_count = totals.employee_count,
      gross_total = totals.gross_total,
      net_total = totals.net_total,
      updated_at = now()
  from (
    select count(*)::integer employee_count,
           coalesce(sum(gross + allowances + bonuses), 0) gross_total,
           coalesce(sum(net), 0) net_total
    from public.payroll
    where payroll_run_id = run_id
  ) totals
  where payroll_run.id = run_id;

  return affected;
end;
$$;
create or replace function public.transition_payroll_run(
  selected_run_id bigint,
  next_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
  run_period text;
  employee_record record;
begin
  if not public.has_hrms_role(array['admin', 'payroll_admin']) then
    raise exception 'Payroll administrator access required';
  end if;

  select period into run_period from public.payroll_runs where id=selected_run_id;
  perform pg_advisory_xact_lock(hashtextextended('payroll:' || run_period, 0));
  select status, period into current_status, run_period
  from public.payroll_runs
  where id = selected_run_id
  for update;

  if current_status is null then raise exception 'Payroll run not found'; end if;
  if not (
    (current_status = 'Draft' and next_status = 'Validation')
    or (current_status = 'Validation' and next_status = 'Approved')
    or (current_status = 'Approved' and next_status = 'Released')
    or (current_status = 'Released' and next_status = 'Paid')
    or (current_status = 'Paid' and next_status = 'Locked')
  ) then
    raise exception 'Payroll must advance through Draft, Validation, Approved, Released, Paid, and Locked';
  end if;

  update public.payroll_runs
  set status = next_status,
      approved_by = case when next_status = 'Approved' then public.current_employee_code() else approved_by end,
      approved_at = case when next_status = 'Approved' then now() else approved_at end,
      released_at = case when next_status = 'Released' then now() else released_at end,
      paid_at = case when next_status = 'Paid' then now() else paid_at end,
      locked_at = case when next_status = 'Locked' then now() else locked_at end,
      updated_at = now()
  where id = selected_run_id;

  update public.payroll
  set status = next_status,
      payment_date = case when next_status = 'Paid' then (now() at time zone 'Asia/Manila')::date else payment_date end
  where payroll_run_id = selected_run_id;

  if next_status = 'Released' then
    for employee_record in
      select employee_code from public.payroll where payroll_run_id = selected_run_id
    loop
      perform public.notify_employee(
        employee_record.employee_code,
        'Payroll',
        'Payslip released',
        'Your private payslip for ' || run_period || ' is ready.',
        'pay',
        'View payslip'
      );
    end loop;
  end if;
end;
$$;
create or replace function public.update_lifecycle_task(
  selected_task_id bigint,
  new_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_case_id bigint;
  parent_employee text;
  parent_type text;
  remaining_tasks integer;
begin
  if not public.has_hrms_role(array['admin', 'hr_admin']) then
    raise exception 'HR administrator access required';
  end if;
  if new_status not in ('Pending', 'Complete', 'Skipped') then
    raise exception 'Unsupported task status';
  end if;

  select case_id into parent_case_id from public.lifecycle_tasks where id=selected_task_id;
  perform 1 from public.lifecycle_cases where id=parent_case_id for update;
  update public.lifecycle_tasks
  set status = new_status,
      completed_by = case when new_status in ('Complete', 'Skipped') then public.current_employee_code() else null end,
      completed_at = case when new_status in ('Complete', 'Skipped') then now() else null end,
      updated_at = now()
  where id = selected_task_id
  returning case_id into parent_case_id;

  if parent_case_id is null then raise exception 'Lifecycle task not found'; end if;

  select employee_code, case_type into parent_employee, parent_type
  from public.lifecycle_cases
  where id = parent_case_id;

  select count(*) into remaining_tasks
  from public.lifecycle_tasks
  where case_id = parent_case_id
    and status = 'Pending';

  if remaining_tasks = 0 then
    update public.lifecycle_cases
    set status = 'Completed', updated_at = now()
    where id = parent_case_id;

    if parent_type = 'Offboarding' then
      update public.profiles
      set status = 'Inactive', updated_at = now()
      where employee_code = parent_employee and role='employee';
    end if;
  else
    update public.lifecycle_cases set status='Active',updated_at=now() where id=parent_case_id and status='Completed';
    -- Reopening offboarding does not silently reactivate an account.
  end if;
end;
$$;
create or replace function public.respond_to_security_alert(
  selected_alert_code text,
  response_action text,
  response_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  employee text := public.current_employee_code();
  next_status text;
begin
  if employee is null or not public.is_active_hrms_user() then
    raise exception 'Active authentication is required';
  end if;
  if response_action not in ('This was me', 'This was not me', 'Reviewed', 'Session revoked') then
    raise exception 'Unsupported account-security response';
  end if;

  perform 1 from public.security_alerts where alert_code=selected_alert_code and employee_code=employee for update;
  if exists(select 1 from public.security_alerts where alert_code=selected_alert_code and employee_code=employee and status in ('Resolved','False Positive')) then
    raise exception 'This alert is closed. Contact the security team to reopen it.';
  end if;
  if not exists (
    select 1 from public.security_alerts
    where alert_code = selected_alert_code and employee_code = employee
  ) then
    raise exception 'Account alert not found';
  end if;

  next_status := case
    when response_action in ('This was me', 'Reviewed') then 'Acknowledged'
    else 'Investigating'
  end;

  update public.security_alerts
  set status = next_status,
      acknowledged_at = case when next_status = 'Acknowledged' then now() else acknowledged_at end,
      updated_at = now()
  where alert_code = selected_alert_code;

  insert into public.security_alert_responses
    (alert_code, actor_employee_code, response_action, note)
  values
    (selected_alert_code, employee, response_action, nullif(trim(response_note), ''));
end;
$$;
revoke execute on function public.respond_to_own_alert(text,text) from authenticated,anon,public;
create or replace function private.preserve_published_review() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if old.status='Published' and new is distinct from old then
   raise exception 'Published reviews are immutable. Use a new review period or revision label.';
 end if;
 return new;
end;
$$;
create trigger preserve_published_review before update on public.performance_reviews for each row execute function private.preserve_published_review();

-- Enrollment stays opt-in during rollout; enrolled accounts must use AAL2.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table private.revoked_hrms_sessions (
  session_id uuid primary key,
  user_id uuid not null,
  revoked_at timestamptz not null default now()
);
revoke all on private.revoked_hrms_sessions from public, anon, authenticated;
alter table private.revoked_hrms_sessions enable row level security;
-- Dashboard-installed DDL maintenance must never be a callable public RPC.
-- Revoking caller grants preserves its use by the owner/event trigger.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

create or replace function private.hrms_session_valid() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and exists (select 1 from auth.sessions s where s.id::text = auth.jwt()->>'session_id' and s.user_id = auth.uid())
    and not exists (select 1 from private.revoked_hrms_sessions r where r.session_id::text = auth.jwt()->>'session_id')
    and exists (select 1 from public.profiles p where p.auth_user_id = auth.uid() and p.status in ('Active','On Leave'));
$$;
create or replace function private.hrms_access_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.hrms_session_valid()
    and exists (select 1 from auth.users u where u.id = auth.uid()
      and coalesce(u.raw_app_meta_data->>'must_set_password','false') <> 'true'
      and coalesce(u.raw_app_meta_data->>'must_change_password','false') <> 'true')
    and (auth.jwt()->>'aal' = 'aal2' or not exists
      (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'));
$$;
revoke all on function private.hrms_session_valid(), private.hrms_access_allowed() from public, anon;
grant execute on function private.hrms_session_valid(), private.hrms_access_allowed() to authenticated;

create or replace function public.assert_hrms_access() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.hrms_access_allowed() then
    raise exception 'Your session requires authentication, account setup or MFA verification.' using errcode = '42501';
  end if;
end;
$$;
-- Only own identity is available before MFA/password setup. Never returns other accounts.
create or replace function public.get_hrms_identity() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not private.hrms_session_valid() then raise exception 'Your HRMS session is no longer active.' using errcode = '42501'; end if;
  select to_jsonb(p) || jsonb_build_object('must_change_password', coalesce(u.raw_app_meta_data->>'must_change_password','false') = 'true',
    'must_set_password', coalesce(u.raw_app_meta_data->>'must_set_password','false') = 'true') into result
    from public.profiles p join auth.users u on u.id = p.auth_user_id where p.auth_user_id = auth.uid();
  if not private.hrms_access_allowed() then
    select jsonb_object_agg(key,value) into result from jsonb_each(result) where key in
      ('employee_code','auth_user_id','first_name','last_name','email','role','status','must_change_password','must_set_password');
  end if;
  return result;
end;
$$;
revoke all on function public.assert_hrms_access(), public.get_hrms_identity() from public, anon;
grant execute on function public.assert_hrms_access(), public.get_hrms_identity() to authenticated;

create or replace function public.assert_hrms_setup_access() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
 if not private.hrms_session_valid() or (auth.jwt()->>'aal' <> 'aal2' and exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified')) then
   raise exception 'Your setup session requires authentication or MFA verification.' using errcode='42501';
 end if;
end;
$$;
revoke all on function public.assert_hrms_setup_access() from public,anon;
grant execute on function public.assert_hrms_setup_access() to authenticated;

create or replace function public.current_employee_code() returns text
language sql stable security definer set search_path = '' as $$
 select p.employee_code from public.profiles p where p.auth_user_id = auth.uid() and private.hrms_access_allowed();
$$;
create or replace function public.current_hrms_role() returns text
language sql stable security definer set search_path = '' as $$
 select p.role from public.profiles p where p.auth_user_id = auth.uid() and private.hrms_access_allowed();
$$;
create or replace function public.is_active_hrms_user() returns boolean
language sql stable security definer set search_path = '' as $$ select private.hrms_access_allowed(); $$;

do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname = 'public' and rowsecurity loop
    execute format('create policy hrms_verified_session on public.%I as restrictive for all to authenticated using ((select private.hrms_access_allowed())) with check ((select private.hrms_access_allowed()))', t.tablename);
  end loop;
end $$;
create policy hrms_avatar_verified_session on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'profile-avatars' or (select private.hrms_access_allowed()))
  with check (bucket_id <> 'profile-avatars' or (select private.hrms_access_allowed()));
create policy hrms_document_expiry on public.employee_documents as restrictive for select to authenticated
  using (public.current_hrms_role() <> 'employee' or expires_on is null or expires_on >= (now() at time zone 'Asia/Manila')::date);

alter table public.account_sessions add column auth_session_id uuid unique;
-- Legacy rows have no reliable relationship to an Auth session: never present them as revocable access.
create or replace function public.record_hrms_session(device_label text, location_label text) returns text
language plpgsql security definer set search_path = '' as $$
declare sid uuid; code text; employee text;
begin
  perform public.assert_hrms_access();
  sid := (auth.jwt()->>'session_id')::uuid;
  code := 'SES-' || upper(replace(sid::text,'-',''));
  employee := public.current_employee_code();
  insert into public.account_sessions(session_code, employee_code, device, location, last_active_label, is_current, assurance_level, trust_status, last_seen_at, auth_session_id)
  values(code, employee, left(coalesce(device_label,'Web browser'),160), left(coalesce(location_label,'Not verified'),120), 'Recently observed', false, auth.jwt()->>'aal', 'Review Needed', now(), sid)
  on conflict (session_code) do update set last_seen_at = now(), assurance_level = excluded.assurance_level
    where account_sessions.employee_code = employee and account_sessions.auth_session_id = sid
      and (account_sessions.last_seen_at < now() - interval '60 seconds' or account_sessions.assurance_level <> excluded.assurance_level);
  return code;
end;
$$;
create or replace function public.revoke_hrms_sessions(operation text, target_code text default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare sid uuid; actor text; affected integer;
begin
  perform public.assert_hrms_access();
  sid := (auth.jwt()->>'session_id')::uuid; actor := public.current_employee_code();
  if operation not in ('revoke-session','revoke-other-sessions','end-current-session') then raise exception 'Invalid session operation.'; end if;
  if operation = 'revoke-session' and not public.has_hrms_role(array['admin','security_admin']) then raise exception 'Security administrator access required.' using errcode = '42501'; end if;
  if operation = 'revoke-session' and not exists (select 1 from public.account_sessions where session_code = target_code and auth_session_id is not null and auth_session_id <> sid) then
    raise exception 'This is a legacy observation or the current session, not a revocable other session.';
  end if;
  insert into private.revoked_hrms_sessions(session_id,user_id)
    select s.id,s.user_id from auth.sessions s
    where (operation = 'end-current-session' and s.id = sid and s.user_id = auth.uid())
      or (operation = 'revoke-other-sessions' and s.user_id = auth.uid() and s.id <> sid)
      or (operation = 'revoke-session' and s.id in (select a.auth_session_id from public.account_sessions a where a.session_code = target_code and a.auth_session_id <> sid))
    on conflict do nothing;
  get diagnostics affected = row_count;
  delete from public.account_sessions a using private.revoked_hrms_sessions r where a.auth_session_id = r.session_id;
  insert into public.audit_logs(actor_employee_code,actor_label,action,target,display_time)
    values(actor,actor,'Revoked HRMS access', operation || ' · ' || affected || ' sessions','Just now');
  return affected;
end;
$$;
revoke all on function public.record_hrms_session(text,text), public.revoke_hrms_sessions(text,text) from public,anon;
grant execute on function public.record_hrms_session(text,text), public.revoke_hrms_sessions(text,text) to authenticated;
revoke insert,update,delete on public.account_sessions from authenticated;
create policy security_auditor_session_read on public.account_sessions for select to authenticated
 using (public.has_hrms_role(array['auditor']));

-- HR specialists manage employees, not the operational state of privileged accounts.
create or replace function private.protect_privileged_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is not null and old.role <> 'employee' and public.current_hrms_role() <> 'admin' then
   if (to_jsonb(new) - 'phone' - 'avatar_path' - 'updated_at') is distinct from (to_jsonb(old) - 'phone' - 'avatar_path' - 'updated_at') then
     raise exception 'Only a System Administrator can change privileged employment records.' using errcode = '42501';
   end if;
 end if;
 return new;
end;
$$;
create trigger protect_privileged_profile before update on public.profiles for each row execute function private.protect_privileged_profile();

alter table public.employee_documents add constraint sensitive_document_named_recipient check (not sensitive or employee_code is not null) not valid;
alter table public.employee_documents validate constraint sensitive_document_named_recipient;

-- The aggregate is role restricted and does not depend on REST's row limit.
create or replace function public.security_overview(window_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; start_at timestamptz;
begin
 perform public.assert_hrms_access();
 if not public.has_hrms_role(array['admin','security_admin','auditor']) then raise exception 'Security overview access required.' using errcode = '42501'; end if;
 if window_days not in (7,30,90) then raise exception 'Select 7, 30 or 90 days.'; end if;
 start_at := ((now() at time zone 'Asia/Manila')::date - (window_days - 1))::timestamp at time zone 'Asia/Manila';
 select jsonb_build_object(
   'asOf',now(), 'windowDays',window_days, 'timeZone','Asia/Manila',
   'accounts',(select jsonb_build_object('total',count(*),'mfaEnabled',count(*) filter(where exists(select 1 from auth.mfa_factors f where f.user_id=p.auth_user_id and f.status='verified')),
     'privileged',count(*) filter(where p.role <> 'employee'),'privilegedMfaEnabled',count(*) filter(where p.role <> 'employee' and exists(select 1 from auth.mfa_factors f where f.user_id=p.auth_user_id and f.status='verified')))
     from public.profiles p where p.status in ('Active','On Leave') and p.auth_user_id is not null),
   'alerts',(select jsonb_build_object('open',count(*) filter(where status not in ('Resolved','False Positive')),
     'critical',count(*) filter(where severity='Critical' and status not in ('Resolved','False Positive')),
     'resolvedInWindow',count(*) filter(where status='Resolved' and resolved_at >= start_at),
     'falsePositivesInWindow',count(*) filter(where status='False Positive' and resolved_at >= start_at)) from public.security_alerts),
   'sessions',(select jsonb_build_object('observedRecently',count(*) filter(where a.last_seen_at > now() - interval '15 minutes' and a.auth_session_id is not null),
      'legacyObservations',count(*) filter(where a.auth_session_id is null)) from public.account_sessions a),
   'trend',(select coalesce(jsonb_agg(jsonb_build_object('date',d.day::date,'total',coalesce(a.total,0),'high',coalesce(a.high,0)) order by d.day),'[]'::jsonb)
      from generate_series((start_at at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date,interval '1 day') d(day)
      left join (select (created_at at time zone 'Asia/Manila')::date as day,count(*) total,count(*) filter(where severity in ('High','Critical')) high from public.security_alerts where created_at >= start_at group by 1) a on a.day=d.day::date),
   'bySeverity',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select severity,count(*) total from public.security_alerts where status not in ('Resolved','False Positive') group by severity) x),
   'byStatus',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select status,count(*) total from public.security_alerts group by status) x),
   'latestScan',(select to_jsonb(x) from (select scan_code,scan_type,completed_at,status,high_count,medium_count,low_count,informational_count,target_url from public.zap_scan_runs order by completed_at desc limit 1) x),
   'recentAlerts',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select alert_code,title,severity,status,created_at from public.security_alerts where status not in ('Resolved','False Positive') order by case severity when 'Critical' then 0 when 'High' then 1 when 'Medium' then 2 else 3 end,created_at desc limit 8) x)
 ) into result;
 return result;
end;
$$;
revoke all on function public.security_overview(integer) from public,anon;
grant execute on function public.security_overview(integer) to authenticated;

create index if not exists security_alerts_open_created_idx on public.security_alerts(created_at desc) where status not in ('Resolved','False Positive');
create index if not exists security_alerts_resolved_idx on public.security_alerts(resolved_at) where resolved_at is not null;
create index if not exists account_sessions_last_seen_idx on public.account_sessions(last_seen_at);

-- Install missing FK indexes; preserve existing indexes and policies.
create or replace function public.manage_security_alert(operation text, details jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor text; code text; affected public.profiles%rowtype; next_status text; note text; completed boolean;
begin
 perform public.assert_hrms_access();
 if not public.has_hrms_role(array['admin','security_admin']) then raise exception 'Security administrator access required.' using errcode = '42501'; end if;
 actor := public.current_employee_code();
 if operation = 'create-alert' then
   if details->>'severity' not in ('Critical','High','Medium','Low') or length(trim(coalesce(details->>'title',''))) not between 4 and 140
      or length(trim(coalesce(details->>'description',''))) not between 10 and 1200 or length(trim(coalesce(details->>'recommendedAction',''))) not between 10 and 800 then
      raise exception 'Complete a valid title, severity, description and recommended action.';
   end if;
   select * into affected from public.profiles where employee_code = details->>'employeeCode';
   if not found then raise exception 'Select a valid account.'; end if;
   code := 'ALT-' || upper(replace(gen_random_uuid()::text,'-',''));
   insert into public.security_alerts(alert_code,employee_code,severity,event_type,title,description,affected_label,display_time,status,recommended_action,why_it_matters,confidence)
    values(code,affected.employee_code,details->>'severity',left(coalesce(details->>'eventType','Security review'),80),trim(details->>'title'),trim(details->>'description'),
      affected.first_name || ' ' || affected.last_name || ' · ' || affected.employee_code,'Just now','New',trim(details->>'recommendedAction'),
      left(coalesce(details->>'whyItMatters','Review possible unauthorized access.'),800),case when details->>'confidence' in ('High','Medium','Low') then details->>'confidence' else 'Medium' end);
 elsif operation = 'update-alert' then
   code := details->>'alertCode'; next_status := details->>'status'; note := left(trim(coalesce(details->>'note','')),1200);
   if next_status not in ('Investigating','Acknowledged','Confirmed','Contained','Resolved','False Positive') then raise exception 'Select a valid investigation status.'; end if;
   completed := next_status in ('Resolved','False Positive');
   if completed and length(trim(coalesce(details->>'resolutionReason',''))) < 3 then raise exception 'Provide a resolution reason before closing the alert.'; end if;
   perform 1 from public.security_alerts where alert_code=code for update;
   if not found then raise exception 'Alert not found.'; end if;
   update public.security_alerts set status=next_status,assigned_to=actor,resolution_reason=case when completed then left(details->>'resolutionReason',160) else null end,
     resolution_notes=nullif(note,''),acknowledged_at=coalesce(acknowledged_at,now()),resolved_at=case when completed then now() else null end,updated_at=now() where alert_code=code;
   insert into public.security_alert_responses(alert_code,actor_employee_code,response_action,note)
     values(code,actor,case next_status when 'False Positive' then 'False positive' when 'Resolved' then 'Resolved' when 'Contained' then 'Contained' else 'Investigation started' end,nullif(note,''));
 else raise exception 'Unsupported alert operation.';
 end if;
 insert into public.audit_logs(actor_employee_code,actor_label,action,target,display_time) values(actor,actor,operation,code,'Just now');
 return jsonb_build_object('alertCode',code,'updated',true,'status',coalesce(next_status,'New'));
end;
$$;
revoke all on function public.manage_security_alert(text,jsonb) from public,anon;
grant execute on function public.manage_security_alert(text,jsonb) to authenticated;
revoke update on public.security_alerts from authenticated;
create or replace function public.security_account_options() returns table(employee_code text,first_name text,last_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
 perform public.assert_hrms_access();
 if not public.has_hrms_role(array['admin','security_admin']) then raise exception 'Security administrator access required.' using errcode='42501'; end if;
 return query select p.employee_code,p.first_name,p.last_name from public.profiles p order by p.first_name,p.employee_code;
end;
$$;
revoke all on function public.security_account_options() from public,anon;
grant execute on function public.security_account_options() to authenticated;

do $$ declare c record; begin
 for c in select con.conrelid, con.conname, a.attname, t.relname
   from pg_constraint con join pg_class t on t.oid=con.conrelid join pg_namespace n on n.oid=t.relnamespace
   join pg_attribute a on a.attrelid=con.conrelid and a.attnum=con.conkey[1]
   where con.contype='f' and n.nspname='public' and array_length(con.conkey,1)=1
     and not exists(select 1 from pg_index i where i.indrelid=con.conrelid and i.indkey[0]=con.conkey[1])
 loop execute format('create index if not exists %I on public.%I(%I)',left(c.conname,55)||'_idx',c.relname,c.attname); end loop;
end $$;
