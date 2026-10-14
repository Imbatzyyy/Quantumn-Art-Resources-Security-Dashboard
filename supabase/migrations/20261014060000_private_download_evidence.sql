-- The database records preparation, not an unverifiable claim that a browser
-- saved the bytes. This function has explicit ownership and release checks.
create or replace function public.prepare_own_payslip(selected_payroll_id bigint) returns public.payroll
language plpgsql security definer set search_path='' as $$
declare result public.payroll; actor text;
begin
 perform public.assert_hrms_access(); actor:=public.current_employee_code();
 select * into result from public.payroll where id=selected_payroll_id and employee_code=actor and status in ('Released','Paid','Locked');
 if not found then raise exception 'This released payslip is unavailable.' using errcode='42501'; end if;
 insert into public.audit_logs(actor_employee_code,actor_label,action,target,display_time,event_source)
 values(actor,actor,'Prepared own payslip export',result.period,'Just now','export');
 return result;
end $$;
revoke all on function public.prepare_own_payslip(bigint) from public,anon;
grant execute on function public.prepare_own_payslip(bigint) to authenticated;

create or replace function public.read_employee_document(selected_document_id bigint) returns text
language plpgsql security definer set search_path='' as $$
declare body text; actor text;
begin
 perform public.assert_hrms_access(); actor:=public.current_employee_code();
 select content into body from public.employee_documents where id=selected_document_id
   and (expires_on is null or expires_on >= (now() at time zone 'Asia/Manila')::date)
   and (employee_code is null or employee_code=actor or public.has_hrms_role(array['admin','hr_admin','auditor'])
     or (document_type in ('Payslip','Tax') and public.has_hrms_role(array['payroll_admin'])));
 if not found then raise exception 'This document is unavailable, expired or outside your access.' using errcode='42501'; end if;
 insert into public.audit_logs(actor_employee_code,actor_label,action,target,display_time,event_source)
 values(actor,actor,'Prepared authorized document download',selected_document_id::text,'Just now','export');
 return body;
end $$;
notify pgrst,'reload schema';
