-- Consolidate identity/email/MFA checks into the existing bounded identity read.
-- Keep the same pre-verification allowlist: no HR records are exposed early.
create or replace function public.get_hrms_identity() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.hrms_session_valid() then raise exception 'Your HRMS session is no longer active.' using errcode='42501'; end if;
 select to_jsonb(p) || jsonb_build_object(
   'must_change_password',coalesce(u.raw_app_meta_data->>'must_change_password','false')='true',
   'must_set_password',coalesce(u.raw_app_meta_data->>'must_set_password','false')='true',
   'email_verified',private.signin_email_verified(),
   'mfa_required',coalesce(auth.jwt()->>'aal','aal1')<>'aal2' and exists(select 1 from auth.mfa_factors f where f.user_id=auth.uid() and f.status='verified')
 ) into result from public.profiles p join auth.users u on u.id=p.auth_user_id where p.auth_user_id=auth.uid();
 if not private.hrms_access_allowed() then
   select jsonb_object_agg(key,value) into result from jsonb_each(result) where key in
     ('employee_code','auth_user_id','first_name','last_name','email','role','status','must_change_password','must_set_password','email_verified','mfa_required');
 end if;
 return result;
end $$;

-- One authenticated round trip replaces repeated bootstrap, MFA, and heartbeat
-- calls after code verification. The email gate itself is NOT cached or bypassed.
create function public.finish_hrms_signin(selected_portal text, device_label text, location_label text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare identity jsonb; portal text; factor uuid; session_code text;
begin
 identity:=public.get_hrms_identity();
 portal:=case when identity->>'role'='employee' then 'employee' else 'admin' end;
 if selected_portal is null or selected_portal not in ('employee','admin') or selected_portal<>portal
   or not coalesce((identity->>'email_verified')::boolean,false)
   or coalesce((identity->>'must_change_password')::boolean,false)
   or coalesce((identity->>'must_set_password')::boolean,false)
   or not exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]')) a where a->>'method'='password')
 then raise exception 'Complete your sign-in verification first.' using errcode='42501'; end if;
 if (identity->>'mfa_required')::boolean then
   select id into factor from auth.mfa_factors where user_id=auth.uid() and status='verified' and factor_type='totp' order by created_at limit 1;
   if factor is null then raise exception 'Your authenticator setup could not be verified.' using errcode='42501'; end if;
   return jsonb_build_object('mfaRequired',true,'factorId',factor,'portal',portal,'email','');
 end if;
 perform public.assert_hrms_access();
 session_code:=public.record_hrms_session(device_label,location_label);
 return jsonb_build_object('profile',identity,'sessionCode',session_code);
end $$;
revoke all on function public.finish_hrms_signin(text,text,text) from public,anon;
grant execute on function public.finish_hrms_signin(text,text,text) to authenticated;
