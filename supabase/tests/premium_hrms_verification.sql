-- Read-only structural verification for the premium Quantum HRMS migration.
-- Run after all files in supabase/migrations have completed successfully.

select
  tablename,
  rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename = any(array[
    'profiles', 'attendance', 'leave_requests', 'payroll', 'performance_reviews',
    'announcements', 'security_alerts', 'account_sessions', 'audit_logs',
    'employee_requests', 'request_comments', 'notifications',
    'employee_documents', 'document_acknowledgements', 'work_schedules',
    'employee_benefits', 'employee_goals', 'lifecycle_cases', 'lifecycle_tasks',
    'payroll_runs', 'performance_cycles'
  ])
order by tablename;

select
  tablename,
  count(*) as policy_count
from pg_policies
where schemaname = 'public'
  and tablename = any(array[
    'profiles', 'attendance', 'leave_requests', 'payroll', 'performance_reviews',
    'announcements', 'security_alerts', 'account_sessions', 'audit_logs',
    'employee_requests', 'request_comments', 'notifications',
    'employee_documents', 'document_acknowledgements', 'work_schedules',
    'employee_benefits', 'employee_goals', 'lifecycle_cases', 'lifecycle_tasks',
    'payroll_runs', 'performance_cycles'
  ])
group by tablename
order by tablename;

select
  routine_name,
  routine_type,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = any(array[
    'submit_employee_request', 'add_request_comment', 'cancel_employee_request',
    'review_employee_request', 'mark_notification_read',
    'mark_all_notifications_read', 'acknowledge_document',
    'update_goal_progress', 'create_lifecycle_case', 'update_lifecycle_task',
    'generate_payroll', 'transition_payroll_run', 'save_performance_review',
    'publish_performance_review'
  ])
order by routine_name;

select
  (select count(*) from public.employee_requests) as employee_requests,
  (select count(*) from public.employee_documents) as employee_documents,
  (select count(*) from public.work_schedules) as work_schedules,
  (select count(*) from public.employee_benefits) as employee_benefits,
  (select count(*) from public.employee_goals) as employee_goals,
  (select count(*) from public.lifecycle_cases) as lifecycle_cases,
  (select count(*) from public.payroll_runs) as payroll_runs,
  (select count(*) from public.performance_cycles) as performance_cycles;

-- This assertion raises an error if any protected HRMS table has RLS disabled.
do $$
declare
  unprotected_tables text;
begin
  select string_agg(tablename, ', ' order by tablename)
  into unprotected_tables
  from pg_tables
  where schemaname = 'public'
    and tablename = any(array[
      'profiles', 'attendance', 'leave_requests', 'payroll', 'performance_reviews',
      'announcements', 'security_alerts', 'account_sessions', 'audit_logs',
      'employee_requests', 'request_comments', 'notifications',
      'employee_documents', 'document_acknowledgements', 'work_schedules',
      'employee_benefits', 'employee_goals', 'lifecycle_cases', 'lifecycle_tasks',
      'payroll_runs', 'performance_cycles'
    ])
    and rowsecurity = false;

  if unprotected_tables is not null then
    raise exception 'RLS is disabled on: %', unprotected_tables;
  end if;
end $$;
