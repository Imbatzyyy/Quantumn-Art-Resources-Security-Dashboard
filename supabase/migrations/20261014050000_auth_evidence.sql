alter table public.audit_logs drop constraint audit_event_source_check;
alter table public.audit_logs add constraint audit_event_source_check check(event_source in ('database','client','auth','export','legacy'));
-- Historical free-form events do not have reliable provenance. Keep them,
-- but never retroactively certify that their descriptions were server verified.
update public.audit_logs set event_source='legacy' where created_at < '2026-10-14T00:00:00Z' and event_source='database';

create or replace function public.my_security_history() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.assert_hrms_access();
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]') into result from (
   select * from (
     select 'hrms-'||id::text id,action,target,created_at,event_source from public.audit_logs
     where actor_employee_code=public.current_employee_code()
       and (action ilike '%password%' or action ilike '%factor%' or action ilike '%session%' or action ilike '%MFA%'
       or action ilike '%sign-in%' or action ilike '%security%' or action ilike '%export%')
     union all
     select 'auth-'||id::text,payload->>'action','Supabase Auth account event',created_at,'auth'
     from auth.audit_log_entries where payload->>'actor_id'=auth.uid()::text
       and payload->>'action' in ('login','logout','user_updated_password','user_recovery_requested','factor_enrolled','factor_unenrolled','factor_deleted','factor_in_progress','user_updated_email')
   ) e order by created_at desc,id limit 100
 ) r;
 return result;
end $$;

alter function public.security_overview(integer) set schema private;
alter function private.security_overview(integer) rename to security_overview_base;
revoke all on function private.security_overview_base(integer) from public,anon,authenticated;
create function public.security_overview(window_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; auth_events jsonb; controls jsonb;
begin
 -- Original function validates both access role and allowed time windows.
 result:=private.security_overview_base(window_days);
 select jsonb_build_object(
   'passwordSignIns',count(*) filter(where payload->>'action'='login'),
   'passwordChanges',count(*) filter(where payload->>'action'='user_updated_password'),
   'recoveryRequests',count(*) filter(where payload->>'action'='user_recovery_requested'),
   'factorRemovals',count(*) filter(where payload->>'action' in ('factor_unenrolled','factor_deleted')),
   'failedPasswordAttemptsAvailable',false,
   'trend',(select coalesce(jsonb_agg(to_jsonb(t) order by t.date),'[]') from (
     select d::date date,count(a.id) signins
     from generate_series((now() at time zone 'Asia/Manila')::date-(window_days-1),(now() at time zone 'Asia/Manila')::date,interval '1 day') d
     left join auth.audit_log_entries a on (a.created_at at time zone 'Asia/Manila')::date=d::date and a.payload->>'action'='login'
     group by d
   ) t)
 ) into auth_events from auth.audit_log_entries
 where created_at>=((now() at time zone 'Asia/Manila')::date-(window_days-1))::timestamp at time zone 'Asia/Manila';
 select jsonb_build_object('rlsTables',count(*) filter(where c.relrowsecurity),'publicTables',count(*),
   'privilegedMfaRequired',(select privileged_mfa_required from private.security_policy),
   'privateBuckets',(select count(*) from storage.buckets where not public),
   'publicBuckets',(select count(*) from storage.buckets where public),
   'employeeIdleMinutes',30,'adminIdleMinutes',15,'employeeMaximumHours',12,'adminMaximumHours',8) into controls
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r';
 return result||jsonb_build_object('authEvents',auth_events,'controls',controls);
end $$;
revoke all on function public.security_overview(integer) from public,anon;
grant execute on function public.security_overview(integer) to authenticated;
notify pgrst,'reload schema';
