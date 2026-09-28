-- Email sign-in verification is session-bound and enforced below the UI.
create table private.email_signin_sessions (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  challenge_id uuid,
  code_digest text,
  state text not null check(state in ('pending','sent','failed','verified')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  expires_at timestamptz,
  attempts integer not null default 0,
  verified_at timestamptz
);
create index email_signin_user_idx on private.email_signin_sessions(user_id);
create table private.email_signin_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  sends integer not null default 0,
  attempts integer not null default 0,
  last_sent_at timestamptz
);
alter table private.email_signin_sessions enable row level security;
alter table private.email_signin_limits enable row level security;
revoke all on private.email_signin_sessions,private.email_signin_limits from public,anon,authenticated;
-- Preserve already-open sessions during rollout. Every NEW sign-in is challenged.
insert into private.email_signin_sessions(session_id,user_id,email,state,verified_at)
select s.id,s.user_id,u.email,'verified',now() from auth.sessions s join auth.users u on u.id=s.user_id where u.email is not null;

create function private.signin_email_verified() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.email_signin_sessions v join auth.users u on u.id=v.user_id
 where v.session_id::text=auth.jwt()->>'session_id' and v.user_id=auth.uid() and v.email=u.email and v.state='verified');
$$;
revoke all on function private.signin_email_verified() from public,anon;
grant execute on function private.signin_email_verified() to authenticated;
create or replace function private.hrms_access_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select private.hrms_session_valid() and private.signin_email_verified()
 and exists(select 1 from auth.users u where u.id=auth.uid()
   and coalesce(u.raw_app_meta_data->>'must_set_password','false')<>'true'
   and coalesce(u.raw_app_meta_data->>'must_change_password','false')<>'true')
 and (auth.jwt()->>'aal'='aal2' or not exists(select 1 from auth.mfa_factors f where f.user_id=auth.uid() and f.status='verified'));
$$;

create function public.signin_email_context() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u auth.users%rowtype; p public.profiles%rowtype; v private.email_signin_sessions%rowtype;
begin
 if not private.hrms_session_valid() then raise exception 'Sign in again.' using errcode='42501'; end if;
 select * into u from auth.users where id=auth.uid();
 select * into p from public.profiles where auth_user_id=auth.uid();
 select * into v from private.email_signin_sessions where session_id::text=auth.jwt()->>'session_id';
 return jsonb_build_object('sessionId',auth.jwt()->>'session_id','userId',auth.uid(),'email',u.email,'firstName',p.first_name,
 'portal',case when p.role='employee' then 'employee' else 'admin' end,
 'setupRequired',coalesce(u.raw_app_meta_data->>'must_set_password','false')='true' or coalesce(u.raw_app_meta_data->>'must_change_password','false')='true',
 'passwordAuthenticated',exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]')) a where a->>'method'='password'),
 'verified',private.signin_email_verified(),'challengeId',case when v.state='sent' then v.challenge_id end,
 'expiresAt',v.expires_at,'resendAt',v.sent_at+interval '60 seconds');
end $$;
revoke all on function public.signin_email_context() from public,anon;
grant execute on function public.signin_email_context() to authenticated;

-- Only the server may reserve/deliver/verify codes. Wrong attempts COMMIT, not raise/rollback.
create function public.manage_signin_email(operation text, sid uuid, uid uuid, code_hash text default null, challenge uuid default null, force_resend boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u auth.users%rowtype; v private.email_signin_sessions%rowtype; l private.email_signin_limits%rowtype; setup_required boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended('email-signin:'||uid::text,0));
 select * into u from auth.users where id=uid;
 if not found or u.email is null or not exists(select 1 from auth.sessions where id=sid and user_id=uid)
 or exists(select 1 from private.revoked_hrms_sessions where session_id=sid)
 or not exists(select 1 from public.profiles where auth_user_id=uid and status in ('Active','On Leave')) then return jsonb_build_object('error','invalid_session'); end if;
 setup_required:=coalesce(u.raw_app_meta_data->>'must_set_password','false')='true' or coalesce(u.raw_app_meta_data->>'must_change_password','false')='true';
 if operation='complete-setup-session' then
   -- Service-only handoff from complete-initial-password after it has verified
   -- the temporary password, completed setup and established this fresh session.
   if setup_required or coalesce((u.raw_app_meta_data->>'password_changed_at')::timestamptz,'epoch') < now()-interval '1 minute'
   then return jsonb_build_object('error','setup_not_completed'); end if;
   insert into private.email_signin_sessions(session_id,user_id,email,state,verified_at) values(sid,uid,u.email,'verified',now())
   on conflict(session_id) do update set email=excluded.email,state='verified',verified_at=now(),code_digest=null;
   return jsonb_build_object('verified',true);
 end if;
 if setup_required then return jsonb_build_object('error','setup_required'); end if;
 select * into v from private.email_signin_sessions where session_id=sid for update;
 if v.state='verified' and v.email=u.email then return jsonb_build_object('verified',true); end if;
 insert into private.email_signin_limits(user_id) values(uid) on conflict do nothing;
 update private.email_signin_limits set window_start=now(),sends=0,attempts=0 where user_id=uid and window_start<=now()-interval '1 hour';
 select * into l from private.email_signin_limits where user_id=uid for update;
 if operation='reserve' then
   if not force_resend and v.email=u.email and v.state='sent' and v.expires_at>now() and v.attempts<5 then
     return jsonb_build_object('sent',true,'challengeId',v.challenge_id,'expiresAt',v.expires_at,'resendAt',v.sent_at+interval '60 seconds');
   end if;
   if l.sends>=10 or l.attempts>=20 then return jsonb_build_object('error','rate_limit','retryAt',l.window_start+interval '1 hour'); end if;
   if l.last_sent_at>now()-interval '60 seconds' then return jsonb_build_object('error','cooldown','retryAt',l.last_sent_at+interval '60 seconds'); end if;
   if challenge is null or code_hash is null or length(code_hash)<>64 then return jsonb_build_object('error','invalid_challenge'); end if;
   update private.email_signin_limits set sends=sends+1,last_sent_at=now() where user_id=uid;
   insert into private.email_signin_sessions(session_id,user_id,email,challenge_id,code_digest,state,sent_at,expires_at)
   values(sid,uid,u.email,challenge,code_hash,'pending',now(),now()+interval '10 minutes')
   on conflict(session_id) do update set email=excluded.email,challenge_id=excluded.challenge_id,code_digest=excluded.code_digest,state='pending',sent_at=now(),expires_at=excluded.expires_at,attempts=0,verified_at=null;
   return jsonb_build_object('send',true,'challengeId',challenge,'expiresAt',now()+interval '10 minutes','resendAt',now()+interval '60 seconds');
 elsif operation in ('sent','failed') then
   if v.challenge_id is distinct from challenge or v.state<>'pending' then return jsonb_build_object('error','replaced'); end if;
   update private.email_signin_sessions set state=operation,code_digest=case when operation='failed' then null else code_digest end where session_id=sid;
   return jsonb_build_object('sent',operation='sent');
 elsif operation='verify' then
   if l.attempts>=20 then return jsonb_build_object('error','rate_limit','retryAt',l.window_start+interval '1 hour'); end if;
   if v.state is distinct from 'sent' or v.challenge_id is distinct from challenge or v.email is distinct from u.email or v.expires_at<=now() or v.attempts>=5 then return jsonb_build_object('error','expired'); end if;
   update private.email_signin_limits set attempts=attempts+1 where user_id=uid;
   update private.email_signin_sessions set attempts=attempts+1 where session_id=sid;
   if code_hash is null or v.code_digest is distinct from code_hash then return jsonb_build_object('error','incorrect','attemptsRemaining',greatest(0,4-v.attempts)); end if;
   update private.email_signin_sessions set state='verified',verified_at=now(),code_digest=null where session_id=sid;
   insert into public.audit_logs(actor_employee_code,actor_label,action,target,display_time)
   select employee_code,employee_code,'Verified sign-in email','Own session','Just now' from public.profiles where auth_user_id=uid;
   return jsonb_build_object('verified',true);
 end if;
 return jsonb_build_object('error','unsupported_operation');
end $$;
revoke all on function public.manage_signin_email(text,uuid,uuid,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.manage_signin_email(text,uuid,uuid,text,uuid,boolean) to service_role;
