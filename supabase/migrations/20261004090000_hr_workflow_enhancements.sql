-- HR workflow enhancements (additive):
--   1. Leave decisions carry an optional note to the employee; employees can
--      cancel pending leave, or approved leave that has not started.
--   2. Organization-wide leave allowances per leave type.
--   3. Itemized Philippine statutory payroll deductions (SSS, PhilHealth,
--      Pag-IBIG, withholding tax) alongside the existing flat-rate method.
--   4. Private file attachments for HR documents.
--   5. HR can correct or withdraw announcements.
--   6. System Administrators can change another administrator's role, or
--      deactivate and reactivate the account.
-- Existing RPC call shapes keep working: new parameters all have defaults.

-- ---------------------------------------------------------------------------
-- 1. Leave decision notes and cancellation
-- ---------------------------------------------------------------------------

alter table public.leave_requests
  add column if not exists decision_note text,
  add column if not exists cancelled_at timestamptz;

alter table public.leave_requests drop constraint if exists leave_requests_decision_note_length;
alter table public.leave_requests
  add constraint leave_requests_decision_note_length
  check (decision_note is null or char_length(decision_note) <= 500);

alter table public.leave_requests drop constraint if exists leave_requests_status_check;
alter table public.leave_requests
  add constraint leave_requests_status_check
  check (status in ('Pending', 'Approved', 'Rejected', 'Cancelled'));

drop function if exists public.review_leave_request(bigint, text);
create or replace function public.review_leave_request(
  request_id bigint,
  decision text,
  decision_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_owner text;
  request_type text;
  note text := nullif(left(trim(coalesce(decision_note, '')), 500), '');
begin
  perform public.assert_hrms_access();
  if not public.has_hrms_role(array['admin', 'hr_admin']) then
    raise exception 'HR administrator access required' using errcode = '42501';
  end if;
  if decision not in ('Approved', 'Rejected') then
    raise exception 'Decision must be Approved or Rejected';
  end if;

  update public.leave_requests
  set status = decision,
      decision_note = note,
      reviewed_by = public.current_employee_code(),
      reviewed_at = now()
  where id = request_id
    and status = 'Pending'
  returning employee_code, leave_type into request_owner, request_type;

  if request_owner is null then
    raise exception 'Pending leave request not found';
  end if;

  perform public.notify_employee(
    request_owner,
    'Leave',
    request_type || ' leave ' || lower(decision),
    left('Your leave request has been ' || lower(decision) || '.' || coalesce(' Note from HR: ' || note, ''), 600),
    'leave',
    'View leave'
  );
end;
$$;

revoke all on function public.review_leave_request(bigint, text, text) from public, anon;
grant execute on function public.review_leave_request(bigint, text, text) to authenticated;

create or replace function public.cancel_leave_request(request_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  employee text;
  today date := (now() at time zone 'Asia/Manila')::date;
  affected integer;
begin
  perform public.assert_hrms_access();
  employee := public.current_employee_code();
  if employee is null then
    raise exception 'Active authentication is required' using errcode = '42501';
  end if;

  update public.leave_requests
  set status = 'Cancelled',
      cancelled_at = now()
  where id = request_id
    and employee_code = employee
    and (status = 'Pending' or (status = 'Approved' and start_date > today));
  get diagnostics affected = row_count;

  if affected = 0 then
    raise exception 'Only your pending leave, or approved leave that has not started, can be cancelled';
  end if;
end;
$$;

revoke all on function public.cancel_leave_request(bigint) from public, anon;
grant execute on function public.cancel_leave_request(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Leave allowances per type
-- ---------------------------------------------------------------------------

create table if not exists public.leave_policies (
  leave_type text primary key check (leave_type in ('Vacation', 'Sick', 'Emergency', 'Other')),
  -- Null means the type has no fixed yearly allowance (decided case by case).
  annual_days numeric(5, 1) check (annual_days is null or annual_days between 0 and 365),
  description text not null default '' check (char_length(description) <= 300),
  updated_by text references public.profiles(employee_code) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.leave_policies (leave_type, annual_days, description) values
  ('Vacation', 12, 'Planned time off. File at least a few days ahead.'),
  ('Sick', 12, 'Illness or medical appointments.'),
  ('Emergency', 3, 'Unexpected family or personal emergencies.'),
  ('Other', null, 'Reviewed case by case by HR.')
on conflict (leave_type) do nothing;

alter table public.leave_policies enable row level security;

create policy leave_policies_select on public.leave_policies
  for select to authenticated
  using (public.is_active_hrms_user());

create policy hrms_verified_session on public.leave_policies
  as restrictive for all to authenticated
  using ((select private.hrms_access_allowed()))
  with check ((select private.hrms_access_allowed()));

revoke all on public.leave_policies from anon, authenticated;
grant select on public.leave_policies to authenticated;

create or replace function public.save_leave_policy(
  selected_type text,
  allowance numeric,
  policy_description text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_hrms_access();
  if not public.has_hrms_role(array['admin', 'hr_admin']) then
    raise exception 'HR administrator access required' using errcode = '42501';
  end if;
  if allowance is not null and (allowance < 0 or allowance > 365) then
    raise exception 'A yearly allowance must be between 0 and 365 days';
  end if;

  update public.leave_policies
  set annual_days = allowance,
      description = coalesce(left(trim(policy_description), 300), description),
      updated_by = public.current_employee_code(),
      updated_at = now()
  where leave_type = selected_type;

  if not found then
    raise exception 'Unsupported leave type';
  end if;
end;
$$;

revoke all on function public.save_leave_policy(text, numeric, text) from public, anon;
grant execute on function public.save_leave_policy(text, numeric, text) to authenticated;

drop trigger if exists audit_leave_policies on public.leave_policies;
create trigger audit_leave_policies
  after insert or update or delete on public.leave_policies
  for each row execute procedure public.record_hrms_audit();

-- ---------------------------------------------------------------------------
-- 3. Philippine statutory payroll deductions
-- ---------------------------------------------------------------------------

alter table public.payroll
  add column if not exists sss_contribution numeric(12, 2) not null default 0 check (sss_contribution >= 0),
  add column if not exists philhealth_contribution numeric(12, 2) not null default 0 check (philhealth_contribution >= 0),
  add column if not exists pagibig_contribution numeric(12, 2) not null default 0 check (pagibig_contribution >= 0),
  add column if not exists withholding_tax numeric(12, 2) not null default 0 check (withholding_tax >= 0);

alter table public.payroll_runs
  add column if not exists calculation_method text not null default 'Flat rate';

alter table public.payroll_runs drop constraint if exists payroll_runs_calculation_method_check;
alter table public.payroll_runs
  add constraint payroll_runs_calculation_method_check
  check (calculation_method in ('Flat rate', 'Philippine statutory'));

-- Employee shares on a monthly salary, using the 2025 published schedules:
--   SSS: 5% of the monthly salary credit (₱5,000 to ₱35,000, ₱500 steps).
--   PhilHealth: 2.5% of salary between ₱10,000 and ₱100,000.
--   Pag-IBIG: 2% (1% at ₱1,500 or less) of salary up to ₱10,000.
--   Withholding tax: BIR TRAIN monthly table (2023 onward) on salary less the
--   three contributions above.
create or replace function private.ph_statutory_deductions(monthly_salary numeric)
returns table (sss numeric, philhealth numeric, pagibig numeric, withholding_tax numeric)
language plpgsql
immutable
set search_path = ''
as $$
declare
  salary numeric := greatest(coalesce(monthly_salary, 0), 0);
  credit numeric;
  taxable numeric;
begin
  if salary = 0 then
    return query select 0::numeric, 0::numeric, 0::numeric, 0::numeric;
    return;
  end if;

  credit := least(35000, greatest(5000, floor((salary + 250) / 500) * 500));
  sss := round(credit * 0.05, 2);
  philhealth := round(least(100000, greatest(10000, salary)) * 0.025, 2);
  pagibig := round(least(salary, 10000) * case when salary <= 1500 then 0.01 else 0.02 end, 2);

  taxable := greatest(salary - sss - philhealth - pagibig, 0);
  withholding_tax := round(case
    when taxable <= 20833 then 0
    when taxable < 33333 then (taxable - 20833) * 0.15
    when taxable < 66667 then 1875 + (taxable - 33333) * 0.20
    when taxable < 166667 then 8541.80 + (taxable - 66667) * 0.25
    when taxable < 666667 then 33541.80 + (taxable - 166667) * 0.30
    else 183541.80 + (taxable - 666667) * 0.35
  end, 2);

  return next;
end;
$$;

revoke all on function private.ph_statutory_deductions(numeric) from public, anon, authenticated;

drop function if exists public.generate_payroll(text, numeric);
create or replace function public.generate_payroll(
  payroll_period text,
  deduction_rate numeric default 0,
  calculation_method text default 'Flat rate'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_id bigint;
  affected integer;
  method text := coalesce(calculation_method, 'Flat rate');
  rate numeric := coalesce(deduction_rate, 0);
begin
  perform public.assert_hrms_access();
  if not public.has_hrms_role(array['admin', 'payroll_admin']) then
    raise exception 'Payroll administrator access required' using errcode = '42501';
  end if;
  if char_length(trim(payroll_period)) not between 3 and 60 then
    raise exception 'Enter a valid payroll period';
  end if;
  if method not in ('Flat rate', 'Philippine statutory') then
    raise exception 'Choose flat rate or Philippine statutory deductions';
  end if;
  if method = 'Philippine statutory' then
    rate := 0;
  elsif rate < 0 or rate > 50 then
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
    (period, deduction_rate, calculation_method, status, created_by)
  values
    (trim(payroll_period), rate, method, 'Draft', public.current_employee_code())
  on conflict (period) do update set
    deduction_rate = excluded.deduction_rate,
    calculation_method = excluded.calculation_method,
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
    (employee_code, payroll_run_id, period, gross, allowances, bonuses, deductions,
     sss_contribution, philhealth_contribution, pagibig_contribution, withholding_tax,
     status, payment_date)
  select
    profile.employee_code,
    run_id,
    trim(payroll_period),
    profile.salary,
    0,
    0,
    case when method = 'Philippine statutory'
      then statutory.sss + statutory.philhealth + statutory.pagibig + statutory.withholding_tax
      else round(profile.salary * (rate / 100), 2) end,
    case when method = 'Philippine statutory' then statutory.sss else 0 end,
    case when method = 'Philippine statutory' then statutory.philhealth else 0 end,
    case when method = 'Philippine statutory' then statutory.pagibig else 0 end,
    case when method = 'Philippine statutory' then statutory.withholding_tax else 0 end,
    'Draft',
    null
  from public.profiles profile
  cross join lateral private.ph_statutory_deductions(profile.salary) statutory
  where profile.status in ('Active', 'On Leave')
    and profile.role = 'employee'
  on conflict (employee_code, period) do update set
    payroll_run_id = excluded.payroll_run_id,
    gross = excluded.gross,
    allowances = excluded.allowances,
    bonuses = excluded.bonuses,
    deductions = excluded.deductions,
    sss_contribution = excluded.sss_contribution,
    philhealth_contribution = excluded.philhealth_contribution,
    pagibig_contribution = excluded.pagibig_contribution,
    withholding_tax = excluded.withholding_tax,
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

revoke all on function public.generate_payroll(text, numeric, text) from public, anon;
grant execute on function public.generate_payroll(text, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Private document attachments
-- ---------------------------------------------------------------------------

alter table public.employee_documents
  add column if not exists file_path text,
  add column if not exists file_size bigint,
  add column if not exists mime_type text;

alter table public.employee_documents drop constraint if exists employee_documents_file_path_format;
alter table public.employee_documents
  add constraint employee_documents_file_path_format
  check (
    file_path is null
    or file_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]{1,120}$'
  );

create unique index if not exists employee_documents_file_path_idx
  on public.employee_documents (file_path)
  where file_path is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hr-documents',
  'hr-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- A file is readable exactly when its document record is visible to the
-- caller under the employee_documents policies (ownership, role, expiry).
drop policy if exists "hr documents readable with their record" on storage.objects;
create policy "hr documents readable with their record"
on storage.objects for select
to authenticated
using (
  bucket_id = 'hr-documents'
  and (
    exists (
      select 1 from public.employee_documents document
      where document.file_path = storage.objects.name
    )
    -- Uploaders can see a file they have not attached yet, so a failed save
    -- can be cleaned up.
    or (
      public.has_hrms_role(array['admin', 'hr_admin', 'payroll_admin'])
      and not exists (
        select 1 from public.employee_documents document
        where document.file_path = storage.objects.name
      )
    )
  )
);

drop policy if exists "hr staff upload document files" on storage.objects;
create policy "hr staff upload document files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'hr-documents'
  and public.has_hrms_role(array['admin', 'hr_admin', 'payroll_admin'])
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]{1,120}$'
);

-- Uploaders may remove a file only while no document record uses it, so a
-- failed save can clean up without letting anyone erase issued records.
drop policy if exists "hr staff remove unattached document files" on storage.objects;
create policy "hr staff remove unattached document files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'hr-documents'
  and public.has_hrms_role(array['admin', 'hr_admin', 'payroll_admin'])
  and not exists (
    select 1 from public.employee_documents document
    where document.file_path = storage.objects.name
  )
);

drop policy if exists hrms_documents_verified_session on storage.objects;
create policy hrms_documents_verified_session on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'hr-documents' or (select private.hrms_access_allowed()))
  with check (bucket_id <> 'hr-documents' or (select private.hrms_access_allowed()));

-- File size and type always come from Storage, never from the browser.
create or replace function private.attach_document_file() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  stored record;
begin
  if new.file_path is null then
    new.file_size := null;
    new.mime_type := null;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.file_path is not distinct from old.file_path then
    new.file_size := old.file_size;
    new.mime_type := old.mime_type;
    return new;
  end if;
  select (object.metadata->>'size')::bigint as size, object.metadata->>'mimetype' as mimetype
  into stored
  from storage.objects object
  where object.bucket_id = 'hr-documents' and object.name = new.file_path;
  if not found then
    raise exception 'Upload the document file before saving the record.';
  end if;
  new.file_size := stored.size;
  new.mime_type := stored.mimetype;
  return new;
end;
$$;

revoke all on function private.attach_document_file() from public, anon, authenticated;

drop trigger if exists attach_document_file on public.employee_documents;
create trigger attach_document_file
  before insert or update on public.employee_documents
  for each row execute procedure private.attach_document_file();

-- ---------------------------------------------------------------------------
-- 5. Announcement corrections and withdrawal
-- ---------------------------------------------------------------------------

alter table public.announcements
  add column if not exists updated_at timestamptz;

drop trigger if exists set_updated_at on public.announcements;
create trigger set_updated_at
  before update on public.announcements
  for each row execute procedure public.set_hrms_updated_at();

drop policy if exists announcements_update_hr on public.announcements;
create policy announcements_update_hr on public.announcements
  for update to authenticated
  using (public.has_hrms_role(array['admin', 'hr_admin']))
  with check (public.has_hrms_role(array['admin', 'hr_admin']));

drop policy if exists announcements_delete_hr on public.announcements;
create policy announcements_delete_hr on public.announcements
  for delete to authenticated
  using (public.has_hrms_role(array['admin', 'hr_admin']));

grant update (title, content, priority) on public.announcements to authenticated;
grant delete on public.announcements to authenticated;

-- Notification messages are limited to 600 characters, while announcements
-- allow 1,000. Truncate the inbox copy so long announcements can be published.
create or replace function public.notify_announcement_recipients()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications
    (employee_code, category, title, message, destination, action_label)
  select employee_code, 'Announcement', new.title, left(new.content, 600), 'home', 'Read update'
  from public.profiles
  where status in ('Active', 'On Leave') and role = 'employee';
  return new;
end;
$$;

revoke all on function public.notify_announcement_recipients() from public, anon, authenticated;

-- Inbox copies follow the announcement: corrected text replaces them, and a
-- withdrawn announcement disappears from inboxes.
create or replace function private.sync_announcement_notifications() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    delete from public.notifications
    where category = 'Announcement'
      and title = old.title
      and message = left(old.content, 600)
      and created_at >= old.created_at;
    return old;
  end if;
  if new.title is distinct from old.title or new.content is distinct from old.content then
    update public.notifications
    set title = new.title,
        message = left(new.content, 600)
    where category = 'Announcement'
      and title = old.title
      and message = left(old.content, 600)
      and created_at >= old.created_at;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_announcement_notifications() from public, anon, authenticated;

drop trigger if exists sync_announcement_notifications on public.announcements;
create trigger sync_announcement_notifications
  after update or delete on public.announcements
  for each row execute procedure private.sync_announcement_notifications();

-- ---------------------------------------------------------------------------
-- 6. Administrator account management
-- ---------------------------------------------------------------------------

create or replace function public.manage_admin_account(
  operation text,
  target_code text,
  new_role text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor text;
  target public.profiles%rowtype;
  remaining_admins integer;
  revoked integer := 0;
begin
  perform public.assert_hrms_access();
  if not public.has_hrms_role(array['admin']) then
    raise exception 'Only a System Administrator can manage administrator accounts.' using errcode = '42501';
  end if;
  actor := public.current_employee_code();
  if operation not in ('change-role', 'deactivate', 'reactivate') then
    raise exception 'Unsupported account operation.';
  end if;

  select * into target from public.profiles where employee_code = target_code for update;
  if not found or target.role = 'employee' then
    raise exception 'Select an administrator account.';
  end if;
  if target.employee_code = actor then
    raise exception 'You cannot change your own role or access. Ask another System Administrator.';
  end if;

  if operation = 'change-role' then
    if new_role not in ('admin', 'hr_admin', 'payroll_admin', 'security_admin', 'auditor') then
      raise exception 'Select a supported administrator role.';
    end if;
    if new_role = target.role then
      raise exception 'The account already has this role.';
    end if;
  end if;

  -- Never leave the organization without an active System Administrator.
  if target.role = 'admin' and target.status = 'Active'
     and (operation = 'deactivate' or (operation = 'change-role' and new_role <> 'admin')) then
    select count(*) into remaining_admins
    from public.profiles
    where role = 'admin' and status = 'Active' and employee_code <> target.employee_code;
    if remaining_admins = 0 then
      raise exception 'At least one active System Administrator is required.';
    end if;
  end if;

  if operation = 'change-role' then
    update public.profiles set role = new_role, updated_at = now() where employee_code = target.employee_code;
    if target.auth_user_id is not null then
      update auth.users
      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role)
      where id = target.auth_user_id;
    end if;
  elsif operation = 'deactivate' then
    if target.status = 'Inactive' then
      raise exception 'This account is already deactivated.';
    end if;
    update public.profiles set status = 'Inactive', updated_at = now() where employee_code = target.employee_code;
  else
    if target.status <> 'Inactive' then
      raise exception 'This account is already active.';
    end if;
    update public.profiles set status = 'Active', updated_at = now() where employee_code = target.employee_code;
  end if;

  -- Role changes and deactivation end every existing sign-in for the account.
  if operation in ('change-role', 'deactivate') and target.auth_user_id is not null then
    insert into private.revoked_hrms_sessions (session_id, user_id)
    select session.id, session.user_id from auth.sessions session where session.user_id = target.auth_user_id
    on conflict do nothing;
    get diagnostics revoked = row_count;
    delete from public.account_sessions where employee_code = target.employee_code;
  end if;

  insert into public.audit_logs (actor_employee_code, actor_label, action, target, display_time)
  values (
    actor,
    actor,
    case operation
      when 'change-role' then 'Changed administrator role'
      when 'deactivate' then 'Deactivated administrator account'
      else 'Reactivated administrator account'
    end,
    target.employee_code || case when operation = 'change-role' then ' · ' || target.role || ' → ' || new_role else '' end,
    'Just now'
  );

  return jsonb_build_object(
    'employeeCode', target.employee_code,
    'role', case when operation = 'change-role' then new_role else target.role end,
    'status', case operation when 'deactivate' then 'Inactive' when 'reactivate' then 'Active' else target.status end,
    'sessionsEnded', revoked
  );
end;
$$;

revoke all on function public.manage_admin_account(text, text, text) from public, anon;
grant execute on function public.manage_admin_account(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime delivery for the new table (RLS still applies per subscriber).
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'leave_policies'
  ) then
    alter publication supabase_realtime add table public.leave_policies;
  end if;
end $$;
