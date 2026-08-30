-- pgTAP verification for the local Quantum HRMS schema.
-- Every assertion is read-only and runs inside a rolled-back transaction.

begin;
select plan(8);

select is(
  (
    select count(*)::integer
    from pg_tables
    where schemaname = 'public'
      and tablename = any(array[
        'profiles', 'attendance', 'leave_requests', 'payroll', 'performance_reviews',
        'announcements', 'security_alerts', 'account_sessions', 'audit_logs',
        'employee_requests', 'request_comments', 'notifications',
        'employee_documents', 'document_acknowledgements', 'work_schedules',
        'employee_benefits', 'employee_goals', 'lifecycle_cases', 'lifecycle_tasks',
        'payroll_runs', 'performance_cycles', 'security_alert_responses',
        'zap_scan_runs', 'zap_findings'
      ])
  ),
  24,
  'all 24 HRMS tables exist'
);

select is(
  (
    select count(*)::integer
    from pg_tables
    where schemaname = 'public'
      and rowsecurity
      and tablename = any(array[
        'profiles', 'attendance', 'leave_requests', 'payroll', 'performance_reviews',
        'announcements', 'security_alerts', 'account_sessions', 'audit_logs',
        'employee_requests', 'request_comments', 'notifications',
        'employee_documents', 'document_acknowledgements', 'work_schedules',
        'employee_benefits', 'employee_goals', 'lifecycle_cases', 'lifecycle_tasks',
        'payroll_runs', 'performance_cycles', 'security_alert_responses',
        'zap_scan_runs', 'zap_findings'
      ])
  ),
  24,
  'RLS is enabled on every HRMS table'
);

select is(
  (
    select count(distinct tablename)::integer
    from pg_policies
    where schemaname = 'public'
  ),
  24,
  'every HRMS table has at least one RLS policy'
);

select is(
  (
    select count(distinct routine_name)::integer
    from information_schema.routines
    where routine_schema = 'public'
      and routine_name = any(array[
        'submit_employee_request', 'add_request_comment', 'cancel_employee_request',
        'review_employee_request', 'mark_notification_read',
        'mark_all_notifications_read', 'acknowledge_document',
        'update_goal_progress', 'create_lifecycle_case', 'update_lifecycle_task',
        'generate_payroll', 'transition_payroll_run', 'save_performance_review',
        'publish_performance_review', 'respond_to_security_alert'
      ])
  ),
  15,
  'all protected workflow functions exist'
);

select is(
  (select count(*)::integer from public.profiles),
  5,
  'five fictional employee profiles are seeded'
);

select ok(
  exists (
    select 1 from public.profiles
    where email = 'admin@quantum.test' and role = 'admin' and status = 'Active'
  ),
  'fictional administrator profile is active and role-scoped'
);

select ok(
  exists (
    select 1 from public.profiles
    where email = 'employee@quantum.test' and role = 'employee' and status = 'Active'
  ),
  'fictional employee profile is active and role-scoped'
);

select is(
  (
    select count(*)::integer
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
  ),
  24,
  'all HRMS tables are registered for controlled Realtime updates'
);

select * from finish();
rollback;
