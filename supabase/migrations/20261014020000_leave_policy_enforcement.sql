-- Calendar-day policies already exist; use them per type and per calendar year.
-- Pending requests reserve allowance. A cross-year request debits each year
-- separately. No assumption about working days or statutory entitlement.
create function private.enforce_leave_allowance() returns trigger
language plpgsql security definer set search_path='' as $$
declare allowance numeric; yr integer; yr_start date; yr_end date; reserved integer; requested integer;
begin
  if new.status not in ('Pending','Approved') then return new; end if;
  if new.start_date is null or new.end_date is null or new.end_date < new.start_date
    or new.days <> new.end_date-new.start_date+1 then raise exception 'Invalid leave duration.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('leave:'||new.employee_code,0));
  select annual_days into allowance from public.leave_policies where leave_type=new.leave_type for share;
  if not found then raise exception 'Unsupported leave type.'; end if;
  if allowance is null then return new; end if;
  for yr in extract(year from new.start_date)::integer..extract(year from new.end_date)::integer loop
    yr_start:=make_date(yr,1,1); yr_end:=make_date(yr,12,31);
    requested:=least(new.end_date,yr_end)-greatest(new.start_date,yr_start)+1;
    select coalesce(sum(least(end_date,yr_end)-greatest(start_date,yr_start)+1),0) into reserved
    from public.leave_requests where employee_code=new.employee_code and leave_type=new.leave_type
      and status in ('Pending','Approved') and id is distinct from new.id
      and start_date<=yr_end and end_date>=yr_start;
    if reserved+requested>allowance then
      raise exception '% leave exceeds the % calendar-day allowance for %. Pending requests reserve days.',new.leave_type,allowance,yr;
    end if;
  end loop;
  return new;
end $$;
create trigger enforce_leave_allowance before insert or update on public.leave_requests
for each row execute function private.enforce_leave_allowance();
revoke all on function private.enforce_leave_allowance() from public,anon,authenticated;

create function public.my_leave_balances(balance_year integer default extract(year from (now() at time zone 'Asia/Manila'))::integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform public.assert_hrms_access();
  if balance_year is null or balance_year not between 2000 and 2200 then raise exception 'Invalid balance year.'; end if;
  select jsonb_agg(jsonb_build_object('type',p.leave_type,'annualDays',p.annual_days,'description',p.description,
    'year',balance_year,'approved',coalesce(r.approved,0),'pending',coalesce(r.pending,0),
    'available',case when p.annual_days is null then null else greatest(0,p.annual_days-coalesce(r.approved,0)-coalesce(r.pending,0)) end)
    order by p.leave_type) into result
  from public.leave_policies p left join lateral (
    select sum(least(end_date,make_date(balance_year,12,31))-greatest(start_date,make_date(balance_year,1,1))+1)
      filter(where status='Approved') approved,
      sum(least(end_date,make_date(balance_year,12,31))-greatest(start_date,make_date(balance_year,1,1))+1)
      filter(where status='Pending') pending
    from public.leave_requests where employee_code=public.current_employee_code() and leave_type=p.leave_type
      and status in ('Pending','Approved') and start_date<=make_date(balance_year,12,31) and end_date>=make_date(balance_year,1,1)
  ) r on true;
  return coalesce(result,'[]');
end $$;
revoke all on function public.my_leave_balances(integer) from public,anon;
grant execute on function public.my_leave_balances(integer) to authenticated;

-- Reject NULL parameters explicitly; SQL NOT IN alone is not a NULL check.
do $$ declare definition text; signature text; begin
  foreach signature in array array['public.submit_leave_request(text,date,date,text)',
    'public.review_leave_request(bigint,text,text)','public.manage_admin_account(text,text,text)'] loop
    select pg_get_functiondef(signature::regprocedure) into definition;
    definition:=replace(definition,'if requested_type not in','if requested_type is null or requested_type not in');
    definition:=replace(definition,'if char_length(trim(requested_reason)) not between','if requested_reason is null or char_length(trim(requested_reason)) not between');
    definition:=replace(definition,'if decision not in','if decision is null or decision not in');
    definition:=replace(definition,'if operation not in','if operation is null or operation not in');
    definition:=replace(definition,'if new_role not in','if new_role is null or new_role not in');
    execute definition;
  end loop;
end $$;
notify pgrst,'reload schema';
