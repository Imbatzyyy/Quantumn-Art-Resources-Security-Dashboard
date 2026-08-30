-- Complete shared employee/admin workflows and tighten active-account access.

alter table public.performance_reviews
  add column if not exists quality_score integer not null default 80 check (quality_score between 0 and 100),
  add column if not exists productivity_score integer not null default 80 check (productivity_score between 0 and 100),
  add column if not exists teamwork_score integer not null default 80 check (teamwork_score between 0 and 100);

update public.performance_reviews
set quality_score = case employee_code when 'EMP001' then 92 when 'EMP003' then 94 when 'EMP004' then 90 else score end,
    productivity_score = case employee_code when 'EMP001' then 86 when 'EMP003' then 91 when 'EMP004' then 84 else score end,
    teamwork_score = case employee_code when 'EMP001' then 89 when 'EMP003' then 88 when 'EMP004' then 85 else score end,
    comments = case employee_code
      when 'EMP001' then 'Consistently delivers accurate work and supports the operations team.'
      when 'EMP003' then 'Strong payroll accuracy and dependable completion of time-sensitive work.'
      when 'EMP004' then 'Produces thoughtful interface work and collaborates effectively.'
      else comments
    end;

create or replace function public.is_active_hrms_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where auth_user_id = (select auth.uid())
      and status = 'Active'
  )
$$;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    (auth_user_id = (select auth.uid()) and status = 'Active')
    or (select public.is_hrms_admin())
  );

drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance
  for select to authenticated
  using (
    (
      employee_code = (select public.current_employee_code())
      and (select public.is_active_hrms_user())
    )
    or (select public.is_hrms_admin())
  );

drop policy if exists leave_select on public.leave_requests;
create policy leave_select on public.leave_requests
  for select to authenticated
  using (
    (
      employee_code = (select public.current_employee_code())
      and (select public.is_active_hrms_user())
    )
    or (select public.is_hrms_admin())
  );

drop policy if exists leave_insert_own on public.leave_requests;
revoke insert on public.leave_requests from authenticated;

drop policy if exists payroll_select on public.payroll;
create policy payroll_select on public.payroll
  for select to authenticated
  using (
    (
      employee_code = (select public.current_employee_code())
      and (select public.is_active_hrms_user())
    )
    or (select public.is_hrms_admin())
  );

drop policy if exists payroll_update_admin on public.payroll;
create policy payroll_update_admin on public.payroll
  for update to authenticated
  using ((select public.is_hrms_admin()))
  with check ((select public.is_hrms_admin()));
grant update on public.payroll to authenticated;

drop policy if exists performance_select on public.performance_reviews;
create policy performance_select on public.performance_reviews
  for select to authenticated
  using (
    (
      employee_code = (select public.current_employee_code())
      and (select public.is_active_hrms_user())
    )
    or (select public.is_hrms_admin())
  );

drop policy if exists performance_insert_admin on public.performance_reviews;
create policy performance_insert_admin on public.performance_reviews
  for insert to authenticated
  with check ((select public.is_hrms_admin()));

drop policy if exists performance_update_admin on public.performance_reviews;
create policy performance_update_admin on public.performance_reviews
  for update to authenticated
  using ((select public.is_hrms_admin()))
  with check ((select public.is_hrms_admin()));
grant insert, update on public.performance_reviews to authenticated;

drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
  for select to authenticated
  using ((select public.is_active_hrms_user()));

drop policy if exists alerts_select on public.security_alerts;
create policy alerts_select on public.security_alerts
  for select to authenticated
  using (
    (
      employee_code = (select public.current_employee_code())
      and (select public.is_active_hrms_user())
    )
    or (select public.is_hrms_admin())
  );

drop policy if exists sessions_select on public.account_sessions;
create policy sessions_select on public.account_sessions
  for select to authenticated
  using (
    (
      employee_code = (select public.current_employee_code())
      and (select public.is_active_hrms_user())
    )
    or (select public.is_hrms_admin())
  );

drop policy if exists sessions_delete on public.account_sessions;
create policy sessions_delete on public.account_sessions
  for delete to authenticated
  using (
    is_current = false
    and (
      (
        employee_code = (select public.current_employee_code())
        and (select public.is_active_hrms_user())
      )
      or (select public.is_hrms_admin())
    )
  );

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
  if requested_start is null or requested_end is null or requested_start < current_date or requested_end < requested_start then
    raise exception 'Choose a valid current or future leave period';
  end if;

  calculated_days := requested_end - requested_start + 1;
  if calculated_days < 1 or calculated_days > 30 then
    raise exception 'A leave request must cover between 1 and 30 days';
  end if;
  if char_length(trim(requested_reason)) not between 3 and 500 then
    raise exception 'Provide a reason between 3 and 500 characters';
  end if;
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

create or replace function public.review_leave_request(request_id bigint, decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_hrms_admin() then
    raise exception 'Administrator access required';
  end if;
  if decision not in ('Approved', 'Rejected') then
    raise exception 'Decision must be Approved or Rejected';
  end if;

  update public.leave_requests
  set status = decision,
      reviewed_by = public.current_employee_code(),
      reviewed_at = now()
  where id = request_id
    and status = 'Pending';

  if not found then
    raise exception 'Pending leave request not found';
  end if;
end;
$$;

create or replace function public.generate_payroll(payroll_period text, deduction_rate numeric)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  if not public.is_hrms_admin() then
    raise exception 'Administrator access required';
  end if;
  if char_length(trim(payroll_period)) not between 3 and 60 then
    raise exception 'Enter a valid payroll period';
  end if;
  if deduction_rate < 0 or deduction_rate > 50 then
    raise exception 'Deduction rate must be between 0 and 50 percent';
  end if;

  insert into public.payroll (employee_code, period, gross, deductions, status)
  select
    employee_code,
    trim(payroll_period),
    salary,
    round(salary * (deduction_rate / 100), 2),
    'Draft'
  from public.profiles
  where status = 'Active'
  on conflict (employee_code, period) do update set
    gross = excluded.gross,
    deductions = excluded.deductions,
    status = 'Draft',
    payment_date = null;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.respond_to_own_alert(
  selected_alert_code text,
  response_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_active_hrms_user() then
    raise exception 'Active authentication is required';
  end if;
  if response_status not in ('Acknowledged', 'Investigating') then
    raise exception 'Unsupported employee response';
  end if;

  update public.security_alerts
  set status = response_status,
      updated_at = now()
  where alert_code = selected_alert_code
    and employee_code = public.current_employee_code();

  if not found then
    raise exception 'Account alert not found';
  end if;
end;
$$;

create or replace function public.record_user_activity(
  activity_action text,
  activity_target text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  employee text := public.current_employee_code();
  actor_name text;
begin
  if employee is null or not public.is_active_hrms_user() then
    raise exception 'Active authentication is required';
  end if;
  if char_length(trim(activity_action)) not between 3 and 160
     or char_length(trim(activity_target)) not between 1 and 240 then
    raise exception 'Invalid audit activity';
  end if;

  select concat(first_name, ' ', last_name)
  into actor_name
  from public.profiles
  where employee_code = employee;

  insert into public.audit_logs
    (actor_employee_code, actor_label, action, target, display_time)
  values
    (
      employee,
      actor_name,
      trim(activity_action),
      trim(activity_target),
      to_char(timezone('Asia/Manila', now()), 'Mon DD, YYYY HH12:MI AM')
    );
end;
$$;

drop trigger if exists audit_payroll on public.payroll;
create trigger audit_payroll after insert or update on public.payroll
  for each row execute procedure public.record_hrms_audit();

drop trigger if exists audit_performance_reviews on public.performance_reviews;
create trigger audit_performance_reviews after insert or update on public.performance_reviews
  for each row execute procedure public.record_hrms_audit();

revoke all on function public.is_active_hrms_user() from public, anon;
revoke all on function public.submit_leave_request(text, date, date, text) from public, anon;
revoke all on function public.review_leave_request(bigint, text) from public, anon;
revoke all on function public.generate_payroll(text, numeric) from public, anon;
revoke all on function public.respond_to_own_alert(text, text) from public, anon;
revoke all on function public.record_user_activity(text, text) from public, anon;

grant execute on function public.is_active_hrms_user() to authenticated;
grant execute on function public.submit_leave_request(text, date, date, text) to authenticated;
grant execute on function public.review_leave_request(bigint, text) to authenticated;
grant execute on function public.generate_payroll(text, numeric) to authenticated;
grant execute on function public.respond_to_own_alert(text, text) to authenticated;
grant execute on function public.record_user_activity(text, text) to authenticated;
