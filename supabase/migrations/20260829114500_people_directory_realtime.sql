-- Professional People Directory fields and role-scoped realtime delivery.

alter table public.profiles
  add column if not exists middle_name text,
  add column if not exists preferred_name text,
  add column if not exists employment_type text not null default 'Full-time',
  add column if not exists work_arrangement text not null default 'On-site',
  add column if not exists work_location text not null default 'Main Office',
  add column if not exists cost_center text,
  add column if not exists manager_code text references public.profiles(employee_code) on delete set null,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_relationship text,
  add column if not exists emergency_contact_phone text;

alter table public.profiles drop constraint if exists profiles_employment_type_check;
alter table public.profiles
  add constraint profiles_employment_type_check
  check (employment_type in ('Full-time', 'Part-time', 'Contract', 'Intern'));

alter table public.profiles drop constraint if exists profiles_work_arrangement_check;
alter table public.profiles
  add constraint profiles_work_arrangement_check
  check (work_arrangement in ('On-site', 'Hybrid', 'Remote'));

alter table public.profiles drop constraint if exists profiles_names_length_check;
alter table public.profiles
  add constraint profiles_names_length_check
  check (
    char_length(first_name) between 1 and 80
    and char_length(last_name) between 1 and 80
    and (middle_name is null or char_length(middle_name) <= 80)
    and (preferred_name is null or char_length(preferred_name) <= 80)
  );

alter table public.profiles drop constraint if exists profiles_contact_length_check;
alter table public.profiles
  add constraint profiles_contact_length_check
  check (
    (phone is null or char_length(phone) between 7 and 30)
    and (emergency_contact_name is null or char_length(emergency_contact_name) <= 120)
    and (emergency_contact_relationship is null or char_length(emergency_contact_relationship) <= 60)
    and (emergency_contact_phone is null or char_length(emergency_contact_phone) between 7 and 30)
  );

create index if not exists profiles_manager_idx on public.profiles(manager_code);
create index if not exists profiles_department_status_idx on public.profiles(department, status);

-- Column grants complement, but do not replace, the profiles_update_hr RLS
-- policy. Only active admin/hr_admin sessions can update another profile.
grant update (
  first_name, middle_name, last_name, preferred_name, phone, department,
  position, salary, hire_date, employment_type, work_arrangement,
  work_location, cost_center, manager_code, emergency_contact_name,
  emergency_contact_relationship, emergency_contact_phone
) on public.profiles to authenticated;

-- Supabase Realtime still applies each table's RLS policies before delivering
-- changes. Employees therefore receive only their own authorized records.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'profiles', 'attendance', 'leave_requests', 'payroll', 'payroll_runs',
    'performance_reviews', 'performance_cycles', 'announcements',
    'security_alerts', 'account_sessions', 'audit_logs', 'employee_requests',
    'request_comments', 'notifications', 'employee_documents',
    'document_acknowledgements', 'work_schedules', 'employee_benefits',
    'employee_goals', 'lifecycle_cases', 'lifecycle_tasks'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end $$;
