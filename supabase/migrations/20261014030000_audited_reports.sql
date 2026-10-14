-- An export is prepared and audited atomically. It does not claim the browser
-- saved the file. Explicit columns avoid exporting secrets or unrelated PII.
create function public.prepare_hr_report(report_id text, search_text text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor text; actor_role text; rows jsonb; event_id bigint;
begin
  perform public.assert_hrms_access();
  actor:=public.current_employee_code(); actor_role:=public.current_hrms_role();
  if report_id is null or report_id not in ('workforce','attendance','requests','payroll','audit')
    or length(coalesce(search_text,''))>200 then raise exception 'Invalid report.'; end if;
  if not (actor_role in ('admin','auditor')
    or actor_role='hr_admin' and report_id in ('workforce','attendance','requests','audit')
    or actor_role='payroll_admin' and report_id in ('workforce','payroll')
    or actor_role='security_admin' and report_id='audit') then
    raise exception 'This role cannot export this report.' using errcode='42501';
  end if;
  case report_id
  when 'workforce' then
    select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from (
      select employee_code id,first_name "firstName",last_name "lastName",department,position,role,status,hire_date "hireDate"
      from public.profiles where role='employee' order by employee_code limit 20001
    ) r;
  when 'attendance' then
    select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from (
      select employee_code "employeeId",work_date date,clock_in "clockIn",clock_out "clockOut",hours,status
      from public.attendance order by work_date desc,id desc limit 20001
    ) r;
  when 'requests' then
    select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from (
      select * from (
        select 'HR-'||id::text id,employee_code "employeeId",request_type type,subject,priority,status,decision_note "decisionNote",created_at "createdAt" from public.employee_requests
        union all
        select 'LEAVE-'||id::text,employee_code,'Leave',leave_type||' leave: '||start_date||' to '||end_date,'Normal',status,decision_note,created_at from public.leave_requests
      ) q order by "createdAt" desc,id limit 20001
    ) r;
  when 'payroll' then
    select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from (
      select period,status,employee_count "employeeCount",gross_total "grossTotal",net_total "netTotal",approved_by "approvedBy",released_at "releasedAt"
      from public.payroll_runs order by created_at desc,id desc limit 20001
    ) r;
  when 'audit' then
    select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from (
      select actor_label actor,action,target,created_at time,event_source "eventSource"
      from public.audit_logs where position(lower(coalesce(search_text,'')) in lower(concat_ws(' ',actor_label,action,target)))>0
      order by created_at desc,id desc limit 20001
    ) r;
  end case;
  if jsonb_array_length(rows)>20000 then raise exception 'Report exceeds 20,000 rows. Request a scoped export from the administrator; no partial report was generated.'; end if;
  insert into public.audit_logs(actor_employee_code,actor_label,action,target,display_time,event_source)
  values(actor,actor,'Prepared authorized report export',report_id||' · '||jsonb_array_length(rows)||' rows','Just now','export') returning id into event_id;
  return jsonb_build_object('rows',rows,'auditId',event_id,'generatedAt',now());
end $$;
revoke all on function public.prepare_hr_report(text,text) from public,anon;
grant execute on function public.prepare_hr_report(text,text) to authenticated;
notify pgrst,'reload schema';
