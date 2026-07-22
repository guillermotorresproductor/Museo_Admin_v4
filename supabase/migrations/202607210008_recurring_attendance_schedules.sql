-- Recurring schedules are the operational source of truth. Concrete shifts are
-- materialized ahead of time and remain immutable historical evidence once used.

create table public.attendance_schedule_rules (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  weekdays smallint[] not null,
  starts_local time not null,
  ends_local time not null,
  effective_from date not null,
  effective_until date,
  shift_type text not null default 'regular' check(shift_type in ('regular','night','special_activity','weekend','extraordinary')),
  expected_lunch_minutes integer check(expected_lunch_minutes is null or expected_lunch_minutes>=0),
  timezone text not null default 'America/Puerto_Rico',
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  check(cardinality(weekdays)>0 and weekdays<@array[1,2,3,4,5,6,7]::smallint[]),
  check(effective_until is null or effective_until>=effective_from),
  check(starts_local<>ends_local)
);
create index attendance_schedule_rules_employee_idx on public.attendance_schedule_rules(employee_id,active,effective_from);

create table public.attendance_schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  rule_id uuid references public.attendance_schedule_rules(id) on delete restrict,
  exception_date date not null,
  exception_type text not null check(exception_type in ('cancelled','override','additional')),
  starts_local time,
  ends_local time,
  shift_type text check(shift_type is null or shift_type in ('regular','night','special_activity','weekend','extraordinary')),
  reason text not null check(length(trim(reason))>=3),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(employee_id,exception_date,rule_id),
  check(exception_type='cancelled' or (starts_local is not null and ends_local is not null and starts_local<>ends_local))
);

alter table public.employee_shifts add column schedule_rule_id uuid references public.attendance_schedule_rules(id) on delete restrict;
alter table public.employee_shifts add column schedule_exception_id uuid references public.attendance_schedule_exceptions(id) on delete restrict;
create unique index employee_shifts_employee_start_unique on public.employee_shifts(employee_id,starts_at);

alter table public.attendance_schedule_rules enable row level security;
alter table public.attendance_schedule_exceptions enable row level security;

create policy schedule_rules_self_read on public.attendance_schedule_rules for select to authenticated using(
 museum_id=public.current_user_museum_id() and public.has_permission('schedules.read.self') and exists(select 1 from public.employees e where e.id=employee_id and e.auth_user_id=auth.uid()));
create policy schedule_rules_admin_read on public.attendance_schedule_rules for select to authenticated using(
 museum_id=public.current_user_museum_id() and (public.has_permission('time.read.all') or (public.has_permission('schedules.read.team') and exists(select 1 from public.employee_supervisors es join public.employees supervisor on supervisor.id=es.supervisor_employee_id where es.employee_id=attendance_schedule_rules.employee_id and es.museum_id=public.current_user_museum_id() and supervisor.auth_user_id=auth.uid() and (es.valid_until is null or es.valid_until>now())))));
create policy schedule_exceptions_self_read on public.attendance_schedule_exceptions for select to authenticated using(
 museum_id=public.current_user_museum_id() and public.has_permission('schedules.read.self') and exists(select 1 from public.employees e where e.id=employee_id and e.auth_user_id=auth.uid()));
create policy schedule_exceptions_admin_read on public.attendance_schedule_exceptions for select to authenticated using(
 museum_id=public.current_user_museum_id() and (public.has_permission('time.read.all') or (public.has_permission('schedules.read.team') and exists(select 1 from public.employee_supervisors es join public.employees supervisor on supervisor.id=es.supervisor_employee_id where es.employee_id=attendance_schedule_exceptions.employee_id and es.museum_id=public.current_user_museum_id() and supervisor.auth_user_id=auth.uid() and (es.valid_until is null or es.valid_until>now())))));

grant select on public.attendance_schedule_rules,public.attendance_schedule_exceptions to authenticated;
revoke insert,update,delete on public.attendance_schedule_rules,public.attendance_schedule_exceptions from authenticated;

create or replace function public.has_permission_for_user(target_user_id uuid,target_museum_id uuid,requested_permission text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles pr where pr.id=target_user_id and pr.museum_id=target_museum_id and pr.status='active')
 and not exists(select 1 from public.user_permissions up join public.permissions p on p.id=up.permission_id where up.user_id=target_user_id and up.museum_id=target_museum_id and p.code=requested_permission and up.effect='deny' and (up.valid_until is null or up.valid_until>now()))
 and (exists(select 1 from public.user_permissions up join public.permissions p on p.id=up.permission_id where up.user_id=target_user_id and up.museum_id=target_museum_id and p.code=requested_permission and up.effect='allow' and (up.valid_until is null or up.valid_until>now()))
   or exists(select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id join public.permissions p on p.id=rp.permission_id where ur.user_id=target_user_id and ur.museum_id=target_museum_id and p.code=requested_permission and (ur.valid_until is null or ur.valid_until>now())))
$$;

create or replace function public.can_manage_employee_schedule(actor_user_id uuid,target_employee_id uuid,actor_museum_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.employees target where target.id=target_employee_id and target.museum_id=actor_museum_id)
 and (public.has_permission_for_user(actor_user_id,actor_museum_id,'time.read.all') or exists(
   select 1 from public.employee_supervisors es join public.employees supervisor on supervisor.id=es.supervisor_employee_id
   where es.employee_id=target_employee_id and es.museum_id=actor_museum_id and supervisor.auth_user_id=actor_user_id and (es.valid_until is null or es.valid_until>now())
 ))
$$;

create or replace function public.materialize_attendance_shifts(target_rule_id uuid,horizon_days integer default 90)
returns integer language plpgsql security definer set search_path='' as $$
declare r public.attendance_schedule_rules; generated integer:=0;
begin
 if horizon_days<1 or horizon_days>180 then raise exception 'INVALID_HORIZON' using errcode='22023'; end if;
 select * into r from public.attendance_schedule_rules where id=target_rule_id and active=true;
 if not found then return 0; end if;
 with dates as (
   select d::date work_date from generate_series(greatest(r.effective_from,(now() at time zone r.timezone)::date),least(coalesce(r.effective_until,(now() at time zone r.timezone)::date+horizon_days),(now() at time zone r.timezone)::date+horizon_days),interval '1 day') d
   where extract(isodow from d)::smallint=any(r.weekdays)
 ), planned as (
   select d.work_date,coalesce(x.starts_local,r.starts_local) local_start,coalesce(x.ends_local,r.ends_local) local_end,coalesce(x.shift_type,r.shift_type) planned_type,x.id exception_id
   from dates d left join public.attendance_schedule_exceptions x on x.employee_id=r.employee_id and x.rule_id=r.id and x.exception_date=d.work_date
   where coalesce(x.exception_type,'scheduled')<>'cancelled'
 ), inserted as (
   insert into public.employee_shifts(museum_id,employee_id,starts_at,ends_at,shift_type,expected_lunch_minutes,status,created_by,notes,schedule_rule_id,schedule_exception_id)
   select r.museum_id,r.employee_id,(work_date+local_start) at time zone r.timezone,
     case when local_end>local_start then (work_date+local_end) at time zone r.timezone else (work_date+1+local_end) at time zone r.timezone end,
     planned_type,r.expected_lunch_minutes,'scheduled',r.updated_by,'Generado por regla recurrente',r.id,exception_id
   from planned on conflict(employee_id,starts_at) do nothing returning 1
 ) select count(*) into generated from inserted;
 return generated;
end $$;

create or replace function public.save_attendance_schedule_rule(actor_user_id uuid,actor_museum_id uuid,rule_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target_employee uuid:=(rule_payload->>'employee_id')::uuid; saved public.attendance_schedule_rules; generated integer; days smallint[];
begin
 if not public.has_permission_for_user(actor_user_id,actor_museum_id,'schedules.manage') or not public.can_manage_employee_schedule(actor_user_id,target_employee,actor_museum_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select array_agg(distinct value::smallint order by value::smallint) into days from jsonb_array_elements_text(rule_payload->'weekdays');
 if days is null or cardinality(days)=0 then raise exception 'WEEKDAYS_REQUIRED' using errcode='22023'; end if;
 insert into public.attendance_schedule_rules(museum_id,employee_id,weekdays,starts_local,ends_local,effective_from,effective_until,shift_type,expected_lunch_minutes,timezone,active,created_by,updated_by)
 values(actor_museum_id,target_employee,days,(rule_payload->>'starts_local')::time,(rule_payload->>'ends_local')::time,(rule_payload->>'effective_from')::date,nullif(rule_payload->>'effective_until','')::date,coalesce(nullif(rule_payload->>'shift_type',''),'regular'),nullif(rule_payload->>'expected_lunch_minutes','')::integer,coalesce(nullif(rule_payload->>'timezone',''),'America/Puerto_Rico'),true,actor_user_id,actor_user_id)
 returning * into saved;
 generated:=public.materialize_attendance_shifts(saved.id,90);
 insert into public.audit_logs(museum_id,actor_user_id,action,table_name,record_id,new_value) values(actor_museum_id,actor_user_id,'ATTENDANCE_SCHEDULE_RULE_CREATED','attendance_schedule_rules',saved.id,jsonb_build_object('employee_id',saved.employee_id,'weekdays',saved.weekdays,'starts_local',saved.starts_local,'ends_local',saved.ends_local,'effective_from',saved.effective_from,'effective_until',saved.effective_until,'generated_shifts',generated));
 return jsonb_build_object('rule',to_jsonb(saved),'generated_shifts',generated);
end $$;

revoke all on function public.can_manage_employee_schedule(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.has_permission_for_user(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.materialize_attendance_shifts(uuid,integer) from public,anon,authenticated;
revoke all on function public.save_attendance_schedule_rule(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.has_permission_for_user(uuid,uuid,text),public.can_manage_employee_schedule(uuid,uuid,uuid),public.materialize_attendance_shifts(uuid,integer),public.save_attendance_schedule_rule(uuid,uuid,jsonb) to service_role;
