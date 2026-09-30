-- Reset requests are private server-side capabilities, not public profile data.
create table private.admin_password_resets (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  email text not null,
  token_digest text unique,
  state text not null check (state in ('pending','sent','exchanging','exchanged','consuming','completed','failed','replaced')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes',
  session_id uuid,
  completed_at timestamptz
);
create index admin_password_resets_user_idx on private.admin_password_resets(user_id, created_at);
create index admin_password_resets_actor_idx on private.admin_password_resets(requested_by, created_at);
alter table private.admin_password_resets enable row level security;
revoke all on private.admin_password_resets from public, anon, authenticated;

create function public.manage_admin_password_reset(
  operation text, request_id uuid default null, actor_id uuid default null,
  target_code text default null, token_hash text default null, sid uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.admin_password_resets%rowtype; p public.profiles%rowtype; u auth.users%rowtype;
begin
  -- Serialize issuance and consumption, including concurrent requests by different admins.
  perform pg_advisory_xact_lock(hashtextextended('admin-password-resets', 0));
  if operation = 'reserve' then
    if not exists(select 1 from public.profiles where auth_user_id=actor_id and role='admin' and status='Active')
    then return jsonb_build_object('error','forbidden'); end if;
    select * into p from public.profiles where employee_code=target_code;
    select * into u from auth.users where id=p.auth_user_id;
    if p.role not in ('admin','hr_admin','payroll_admin','security_admin','auditor') or p.status is distinct from 'Active'
      or u.id is null or lower(u.email) is distinct from lower(p.email)
      or coalesce(u.raw_app_meta_data->>'must_set_password','false')='true'
    then return jsonb_build_object('error','ineligible'); end if;
    if exists(select 1 from private.admin_password_resets where user_id=u.id and created_at>now()-interval '60 seconds')
      or (select count(*) from private.admin_password_resets where user_id=u.id and created_at>now()-interval '1 hour')>=3
      or (select count(*) from private.admin_password_resets where requested_by=actor_id and created_at>now()-interval '1 hour')>=10
    then return jsonb_build_object('error','rate_limit'); end if;
    -- Completed records are retained in audit_logs; bound table growth on normal use.
    delete from private.admin_password_resets where expires_at<now()-interval '7 days';
    insert into private.admin_password_resets(id,user_id,requested_by,email,state)
    values(request_id,u.id,actor_id,u.email,'pending') returning * into r;
    return jsonb_build_object('id',r.id,'userId',u.id,'email',u.email,'firstName',p.first_name,'expiresAt',r.expires_at);
  end if;
  if operation='exchange' then
    select * into r from private.admin_password_resets where token_digest=token_hash for update;
  else
    select * into r from private.admin_password_resets where id=request_id for update;
  end if;
  if r.id is null then return jsonb_build_object('error','invalid'); end if;
  if operation='failed' then
    update private.admin_password_resets set state='failed',token_digest=null where id=r.id and state<>'completed';
    return jsonb_build_object('ok',true);
  end if;
  select * into p from public.profiles where auth_user_id=r.user_id;
  select * into u from auth.users where id=r.user_id;
  if operation<>'complete' and (p.status is distinct from 'Active' or p.role not in ('admin','hr_admin','payroll_admin','security_admin','auditor')
    or u.email is distinct from r.email or lower(p.email) is distinct from lower(r.email)
    or coalesce(u.raw_app_meta_data->>'must_set_password','false')='true'
    or r.expires_at<=now())
  then return jsonb_build_object('error','expired'); end if;
  if operation='sent' and r.state='pending' and token_hash ~ '^[a-f0-9]{64}$' then
    update private.admin_password_resets set state='replaced',token_digest=null
    where user_id=r.user_id and id<>r.id and state in ('pending','sent','exchanging','exchanged');
    update private.admin_password_resets set state='sent',token_digest=token_hash where id=r.id;
    insert into public.audit_logs(actor_employee_code,actor_label,action,target,display_time)
    select employee_code,first_name||' '||last_name,'Sent administrator password reset',p.employee_code||' · 30-minute link','Just now'
    from public.profiles where auth_user_id=r.requested_by;
  elsif operation='exchange' and r.state='sent' then
    update private.admin_password_resets set state='exchanging' where id=r.id;
  elsif operation='bind' and r.state='exchanging'
    and exists(select 1 from auth.sessions where id=sid and user_id=r.user_id) then
    update private.admin_password_resets set state='exchanged',session_id=sid,token_digest=null where id=r.id;
  elsif operation='consume' and r.state='exchanged' and r.session_id=sid
    and exists(select 1 from auth.sessions where id=sid and user_id=r.user_id)
    and not exists(select 1 from private.revoked_hrms_sessions where session_id=sid) then
    update private.admin_password_resets set state='consuming' where id=r.id;
  elsif operation='complete' and r.state='consuming' and r.session_id=sid then
    update private.admin_password_resets set state='completed',completed_at=now() where id=r.id;
    insert into private.revoked_hrms_sessions(session_id,user_id)
    select id,user_id from auth.sessions where user_id=r.user_id on conflict do nothing;
    insert into public.audit_logs(actor_employee_code,actor_label,action,target,display_time)
    values(p.employee_code,p.first_name||' '||p.last_name,'Completed administrator password reset','Own account · existing sessions revoked','Just now');
  else return jsonb_build_object('error','invalid'); end if;
  return jsonb_build_object('ok',true,'id',r.id,'userId',r.user_id,'email',r.email,'expiresAt',r.expires_at);
end $$;
revoke all on function public.manage_admin_password_reset(text,uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.manage_admin_password_reset(text,uuid,uuid,text,text,uuid) to service_role;
