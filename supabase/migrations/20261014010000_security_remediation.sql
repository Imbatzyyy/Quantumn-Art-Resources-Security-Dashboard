-- Verified-session checks apply inside privileged functions, not only in RLS/UI.
create or replace function public.update_own_profile(new_phone text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform public.assert_hrms_access();
  if new_phone is null or trim(new_phone) !~ '^\+?[0-9 ()-]{7,30}$'
     or length(regexp_replace(new_phone, '[^0-9]', '', 'g')) not between 7 and 15 then
    raise exception 'Enter a valid phone number with 7–15 digits.';
  end if;
  update public.profiles set phone=trim(new_phone),updated_at=now() where auth_user_id=auth.uid();
  if not found then raise exception 'HRMS profile not found.'; end if;
end $$;

-- Keep the validated object ownership/path checks and add the same access gate.
do $$ declare definition text; begin
  select pg_get_functiondef('public.update_own_avatar_path(text)'::regprocedure) into definition;
  definition:=replace(definition,E'begin\n',E'begin\n  perform public.assert_hrms_access();\n');
  execute definition;
end $$;

-- Idle expiry is independent of polling and token refresh. UI activity may only
-- extend an already-valid session; it can never revive an expired session.
create table private.hrms_session_activity (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_activity_at timestamptz not null default now()
);
alter table private.hrms_session_activity enable row level security;
revoke all on private.hrms_session_activity from public,anon,authenticated;
create index hrms_session_activity_user_idx on private.hrms_session_activity(user_id);

create or replace function private.hrms_session_valid() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists (
    select 1 from auth.sessions s
    join public.profiles p on p.auth_user_id=s.user_id
    left join private.hrms_session_activity a on a.session_id=s.id
    where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid()
      and p.status in ('Active','On Leave')
      and s.created_at > now()-case when p.role='employee' then interval '12 hours' else interval '8 hours' end
      and coalesce(a.last_activity_at,s.created_at) > now()-case when p.role='employee' then interval '30 minutes' else interval '15 minutes' end
      and not exists(select 1 from private.revoked_hrms_sessions r where r.session_id=s.id)
  );
$$;

create function public.touch_hrms_session() returns void
language plpgsql security definer set search_path='' as $$
begin
  perform public.assert_hrms_access();
  insert into private.hrms_session_activity(session_id,user_id,last_activity_at)
  values ((auth.jwt()->>'session_id')::uuid,auth.uid(),now())
  on conflict(session_id) do update set last_activity_at=excluded.last_activity_at
    where private.hrms_session_activity.last_activity_at < now()-interval '30 seconds';
end $$;
revoke all on function public.touch_hrms_session() from public,anon;
grant execute on function public.touch_hrms_session() to authenticated;

-- The actor is server-derived but these free-text descriptions are client
-- assertions. Do not mix them with transaction-confirmed evidence.
alter table public.audit_logs add column event_source text not null default 'database';
alter table public.audit_logs add constraint audit_event_source_check
  check(event_source in ('database','client','auth','export'));
create or replace function public.record_user_activity(activity_action text,activity_target text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform public.assert_hrms_access();
  if activity_action is null or activity_target is null
    or length(trim(activity_action)) not between 3 and 160
    or length(trim(activity_target)) not between 1 and 240 then raise exception 'Invalid audit activity.'; end if;
  insert into public.audit_logs(actor_employee_code,actor_label,action,target,display_time,event_source)
  select employee_code,concat(first_name,' ',last_name),trim(activity_action),trim(activity_target),'Just now','client'
  from public.profiles where auth_user_id=auth.uid();
end $$;

create function public.my_security_history() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform public.assert_hrms_access();
  select coalesce(jsonb_agg(row order by row.created_at desc),'[]') into result from (
    select id::text,action,target,created_at,event_source from public.audit_logs
    where actor_employee_code=public.current_employee_code()
    and (action ilike '%password%' or action ilike '%factor%' or action ilike '%session%'
      or action ilike '%sign-in%' or action ilike '%security%' or action ilike '%export%')
    order by created_at desc limit 100
  ) row;
  return result;
end $$;
revoke all on function public.my_security_history() from public,anon;
grant execute on function public.my_security_history() to authenticated;

-- Serialize the organization-level invariant, not just the target row.
do $$ declare definition text; begin
  select pg_get_functiondef('public.manage_admin_account(text,text,text)'::regprocedure) into definition;
  definition:=replace(definition,'  perform public.assert_hrms_access();',
    E'  perform pg_advisory_xact_lock(hashtextextended(''hrms:administrator-membership'',0));\n  perform public.assert_hrms_access();');
  execute definition;
end $$;

-- Stable notification ownership: repeated text is not an identifier.
alter table public.notifications add column announcement_id bigint references public.announcements(id) on delete cascade;
create index notification_announcement_idx on public.notifications(announcement_id);
update public.notifications n set announcement_id=a.id from public.announcements a
where n.category='Announcement' and n.title=a.title and n.message=left(a.content,600) and n.created_at=a.created_at
  and (select count(*) from public.announcements b where b.title=a.title and left(b.content,600)=left(a.content,600) and b.created_at=a.created_at)=1;
create or replace function public.notify_announcement_recipients() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.notifications(employee_code,category,title,message,destination,action_label,announcement_id)
  select employee_code,'Announcement',new.title,left(new.content,600),'home','Read update',new.id
  from public.profiles where status in ('Active','On Leave') and role='employee';
  return new;
end $$;
create or replace function private.sync_announcement_notifications() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then return old; end if;
  update public.notifications set title=new.title,message=left(new.content,600) where announcement_id=new.id;
  return new;
end $$;
create index if not exists leave_policies_updated_by_idx on public.leave_policies(updated_by);

-- Own-device revocation uses the same denylist as security administrators.
do $$ declare definition text; begin
  select pg_get_functiondef('public.revoke_hrms_sessions(text,text)'::regprocedure) into definition;
  definition:=replace(definition,
    'if operation = ''revoke-session'' and not public.has_hrms_role(array[''admin'',''security_admin'']) then',
    'if operation = ''revoke-session'' and not public.has_hrms_role(array[''admin'',''security_admin'']) and not exists(select 1 from public.account_sessions where session_code=target_code and employee_code=public.current_employee_code()) then');
  execute definition;
end $$;

comment on function public.touch_hrms_session() is 'Call only for foreground user activity, not background polling. Cannot revive expired sessions.';
notify pgrst,'reload schema';
