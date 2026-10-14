-- Enable only after the enrollment/recovery UI is deployed and verified.
create table private.security_policy(singleton boolean primary key default true check(singleton),privileged_mfa_required boolean not null default false);
insert into private.security_policy values(true,false);
create table private.mfa_recovery_codes(user_id uuid not null references auth.users(id) on delete cascade,code_hash text not null,created_at timestamptz not null default now(),primary key(user_id,code_hash));
create table private.mfa_recovery_pending(user_id uuid primary key references auth.users(id) on delete cascade,created_at timestamptz not null default now());
alter table private.security_policy enable row level security;
alter table private.mfa_recovery_codes enable row level security;
alter table private.mfa_recovery_pending enable row level security;
revoke all on private.security_policy,private.mfa_recovery_codes,private.mfa_recovery_pending from public,anon,authenticated;

create function private.mfa_enrollment_required() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p,private.security_policy s where p.auth_user_id=auth.uid() and p.role<>'employee' and s.privileged_mfa_required)
   or exists(select 1 from private.mfa_recovery_pending where user_id=auth.uid());
$$;
revoke all on function private.mfa_enrollment_required() from public,anon;
grant execute on function private.mfa_enrollment_required() to authenticated;

create or replace function private.hrms_access_allowed() returns boolean language sql stable security definer set search_path='' as $$
 select private.hrms_session_valid() and private.signin_email_verified()
 and exists(select 1 from auth.users u where u.id=auth.uid()
   and coalesce(u.raw_app_meta_data->>'must_set_password','false')<>'true'
   and coalesce(u.raw_app_meta_data->>'must_change_password','false')<>'true')
 and ((auth.jwt()->>'aal'='aal2' and exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified'))
   or (not private.mfa_enrollment_required() and not exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified')));
$$;
do $$ declare d text; begin
 select pg_get_functiondef('public.get_hrms_identity()'::regprocedure) into d;
 d:=replace(d,'exists(select 1 from auth.mfa_factors f where f.user_id=auth.uid() and f.status=''verified'')',
   '(private.mfa_enrollment_required() or exists(select 1 from auth.mfa_factors f where f.user_id=auth.uid() and f.status=''verified''))');
 execute d;
 select pg_get_functiondef('public.finish_hrms_signin(text,text,text)'::regprocedure) into d;
 d:=replace(d,'if factor is null then raise exception ''Your authenticator setup could not be verified.'' using errcode=''42501''; end if;',
   'if factor is null then return jsonb_build_object(''mfaRequired'',true,''factorId'','''',''enrollmentRequired'',true,''portal'',portal,''email'',''''); end if;');
 execute d;
end $$;

create function public.create_mfa_recovery_codes() returns jsonb language plpgsql security definer set search_path='' as $$
declare codes jsonb:='[]'; code text; i integer; actor text;
begin
 perform public.assert_hrms_access();
 if auth.jwt()->>'aal' is distinct from 'aal2' or not exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified')
 then raise exception 'Verify your authenticator before generating recovery codes.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('mfa-recovery:'||auth.uid()::text,0));
 delete from private.mfa_recovery_codes where user_id=auth.uid();
 for i in 1..8 loop
   code:=encode(extensions.gen_random_bytes(16),'hex');
   insert into private.mfa_recovery_codes(user_id,code_hash) values(auth.uid(),encode(extensions.digest(code,'sha256'),'hex'));
   codes:=codes||jsonb_build_array(code);
 end loop;
 delete from private.mfa_recovery_pending where user_id=auth.uid();
 actor:=public.current_employee_code();
 insert into public.audit_logs(actor_employee_code,actor_label,action,target,display_time) values(actor,actor,'Generated MFA recovery codes','Eight single-use recovery codes; previous codes replaced','Just now');
 return codes;
end $$;
revoke all on function public.create_mfa_recovery_codes() from public,anon;
grant execute on function public.create_mfa_recovery_codes() to authenticated;

-- Called with the requesting user's JWT, never with a service-role identity.
-- A 128-bit code is only accepted after password AND session-bound email proof.
create function public.consume_mfa_recovery(recovery_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare normalized text:=lower(replace(trim(coalesce(recovery_code,'')),'-','')); actor text;
begin
 if not private.hrms_session_valid() or not private.signin_email_verified()
   or not exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]')) a where a->>'method'='password')
 then raise exception 'Sign in with your password and verify your email first.' using errcode='42501'; end if;
 if normalized !~ '^[0-9a-f]{32}$' then raise exception 'Invalid or already-used recovery code.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('mfa-recovery:'||auth.uid()::text,0));
 delete from private.mfa_recovery_codes where user_id=auth.uid() and code_hash=encode(extensions.digest(normalized,'sha256'),'hex');
 if not found then raise exception 'Invalid or already-used recovery code.'; end if;
 insert into private.mfa_recovery_pending(user_id) values(auth.uid()) on conflict(user_id) do update set created_at=now();
 insert into private.revoked_hrms_sessions(session_id,user_id)
 select id,user_id from auth.sessions where user_id=auth.uid() and id::text<>auth.jwt()->>'session_id' on conflict do nothing;
 select employee_code into actor from public.profiles where auth_user_id=auth.uid();
 insert into public.audit_logs(actor_employee_code,actor_label,action,target,display_time) values(actor,actor,'Used MFA recovery code','Other sessions revoked; authenticator re-enrollment required','Just now');
 return jsonb_build_object('userId',auth.uid(),'authorized',true);
end $$;
revoke all on function public.consume_mfa_recovery(text) from public,anon;
grant execute on function public.consume_mfa_recovery(text) to authenticated;

create function public.set_privileged_mfa_required(required boolean) returns void language sql security definer set search_path='' as $$
 update private.security_policy set privileged_mfa_required=required where singleton;
$$;
revoke all on function public.set_privileged_mfa_required(boolean) from public,anon,authenticated;
grant execute on function public.set_privileged_mfa_required(boolean) to service_role;
notify pgrst,'reload schema';
