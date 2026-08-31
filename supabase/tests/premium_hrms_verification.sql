-- pgTAP verification for the local Quantum HRMS schema.
-- Every assertion is read-only and runs inside a rolled-back transaction.

begin;
select plan(14);

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
        'publish_performance_review', 'respond_to_security_alert',
        'update_own_avatar_path'
      ])
  ),
  16,
  'all protected workflow functions exist'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'avatar_path'
      and data_type = 'text'
  ),
  'employee profiles include a protected avatar storage path'
);

select ok(
  exists (
    select 1
    from storage.buckets
    where id = 'profile-avatars'
      and not public
  ),
  'profile avatars use a private Supabase Storage bucket'
);

select ok(
  exists (
    select 1
    from storage.buckets
    where id = 'profile-avatars'
      and file_size_limit = 2097152
      and allowed_mime_types = array['image/webp', 'image/png']::text[]
  ),
  'profile avatar uploads accept bounded WebP crops and browser PNG fallback only'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = any(array[
        'profile avatar owners can read',
        'profile avatar owners can insert',
        'profile avatar owners can update',
        'profile avatar owners can delete'
      ])
  ),
  4,
  'profile avatar objects have owner-scoped read, insert, update, and delete policies'
);

select ok(
  exists (
    select 1
    from pg_proc
    where oid = 'public.update_own_avatar_path(text)'::regprocedure
      and prosecdef
  ),
  'profile path registration uses a security-definer function'
);

select ok(
  has_function_privilege('authenticated', 'public.update_own_avatar_path(text)', 'execute')
    and not has_function_privilege('anon', 'public.update_own_avatar_path(text)', 'execute'),
  'only authenticated accounts can register their uploaded avatar path'
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
