-- Disposable schema and fictional accounts. Never point this file at a shared database.
create schema if not exists auth;
create or replace function auth.uid() returns uuid
language sql volatile as $uid$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$uid$;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end
$roles$;
grant usage on schema public to authenticated, anon;

create table public.museums (id uuid primary key, name text not null);
create table public.profiles (id uuid primary key, museum_id uuid not null, status text not null);
create table public.employees (
  id uuid primary key,
  museum_id uuid not null,
  profile_id uuid,
  first_name text not null,
  last_name text not null,
  status text not null,
  access_profile text,
  work_schedule text
);
create table public.permissions (id uuid primary key, code text not null);
create table public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  museum_id uuid not null,
  permission_id uuid not null,
  effect text not null
);
create table public.attendance_settings (museum_id uuid primary key, timezone text not null);
create table public.employee_shifts (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null,
  employee_id uuid not null,
  shift_date date not null,
  starts_at timestamptz,
  ends_at timestamptz,
  shift_type text not null default 'regular',
  expected_lunch_minutes integer,
  status text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.attendance_events (id uuid primary key, shift_id uuid, event_type text);
create table public.employee_time_entries (id uuid primary key, employee_id uuid, clock_in timestamptz, clock_out timestamptz);
create table public.payroll_shift_days (id uuid primary key, employee_id uuid, shift_date date, amount numeric);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null,
  actor_user_id uuid,
  action text not null,
  table_name text not null,
  record_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create table public.test_state (key text primary key, value text);
create table public.test_shift_calls (n integer);

insert into public.museums values
  ('11111111-1111-4111-8111-111111111111', 'Museo ficticio'),
  ('22222222-2222-4222-8222-222222222222', 'Otro museo ficticio');
insert into public.attendance_settings values
  ('11111111-1111-4111-8111-111111111111', 'America/Puerto_Rico'),
  ('22222222-2222-4222-8222-222222222222', 'America/Puerto_Rico');
insert into public.permissions values ('10101010-1010-4010-8010-101010101010', 'schedules.manage');

insert into public.profiles values
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'active'),
  ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'active'),
  ('66666666-6666-4666-8666-666666666666', '11111111-1111-4111-8111-111111111111', 'active'),
  ('77777777-7777-4777-8777-777777777777', '11111111-1111-4111-8111-111111111111', 'active'),
  ('88888888-8888-4888-8888-888888888888', '11111111-1111-4111-8111-111111111111', 'active'),
  ('99999999-9999-4999-8999-999999999999', '11111111-1111-4111-8111-111111111111', 'active'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'active'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccd', '22222222-2222-4222-8222-222222222222', 'active');

insert into public.employees values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'Director', 'Ficticio', 'activo', 'director_ejecutivo', null),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444', 'Gerente', 'Ficticio', 'activo', 'gerente_administrativo', null),
  ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666666', 'Ujier', 'Ficticio', 'activo', 'ujier', '08:00-17:00'),
  ('77777777-7777-4777-8777-777777777771', '11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777777', 'Admin', 'Ficticio', 'activo', 'administrador_general', null),
  ('88888888-8888-4888-8888-888888888881', '11111111-1111-4111-8111-111111111111', '88888888-8888-4888-8888-888888888888', 'Asistente', 'Ficticia', 'activo', 'asistente_administrativa', null),
  ('99999999-9999-4999-8999-999999999991', '11111111-1111-4111-8111-111111111111', '99999999-9999-4999-8999-999999999999', 'Mantenimiento', 'Ficticio', 'activo', 'mantenimiento', null),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Guia', 'Ficticia', 'activo', 'guia', null),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '22222222-2222-4222-8222-222222222222', 'cccccccc-cccc-4ccc-8ccc-cccccccccccd', 'Ajeno', 'Ficticio', 'activo', 'ujier', null),
  ('abababab-abab-4aba-8aba-abababababab', '11111111-1111-4111-8111-111111111111', null, 'Inactivo', 'Ficticio', 'inactivo', 'ujier', null),
  ('b0b0b0b0-b0b0-40b0-80b0-b0b0b0b0b0b0', '11111111-1111-4111-8111-111111111111', null, 'Rollback', 'Ficticio', 'activo', 'ujier', null),
  ('e0e0e0e0-e0e0-40e0-80e0-e0e0e0e0e0e0', '11111111-1111-4111-8111-111111111111', null, 'Extra', 'Ficticio', 'activo', 'ujier', null),
  ('f0f0f0f0-f0f0-40f0-80f0-f0f0f0f0f0f0', '11111111-1111-4111-8111-111111111111', null, 'Conflicto', 'Ficticio', 'activo', 'ujier', null),
  ('a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', '11111111-1111-4111-8111-111111111111', null, 'Cerrado', 'Ficticio', 'activo', 'ujier', null),
  ('a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2', '11111111-1111-4111-8111-111111111111', null, 'Solape', 'Ficticio', 'activo', 'ujier', null),
  ('a3a3a3a3-a3a3-43a3-83a3-a3a3a3a3a3a3', '11111111-1111-4111-8111-111111111111', null, 'Reemplazo', 'Ficticio', 'activo', 'ujier', null);

insert into public.employee_time_entries values
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', '55555555-5555-4555-8555-555555555555', '2026-01-01T12:00:00Z', null);
insert into public.payroll_shift_days values
  ('b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2', '55555555-5555-4555-8555-555555555555', '2026-01-01', 12.50);
insert into public.test_state values
  ('punch', (select clock_in::text || '|' || coalesce(clock_out::text, '') from public.employee_time_entries where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1')),
  ('payroll', (select amount::text from public.payroll_shift_days where id = 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2')),
  ('events', (select count(*)::text from public.attendance_events));

create or replace function public.current_user_museum_id() returns uuid
language sql stable set search_path = '' as $museum$
  select museum_id from public.profiles where id = auth.uid()
$museum$;

create or replace function public.has_permission(requested_permission text) returns boolean
language plpgsql stable set search_path = '' as $perm$
declare
  uid uuid := auth.uid();
  profile text;
begin
  if uid is null then return false; end if;
  if exists (
    select 1 from public.user_permissions u
    join public.permissions p on p.id = u.permission_id
    where u.user_id = uid and p.code = requested_permission and u.effect = 'deny'
  ) then
    return false;
  end if;
  if requested_permission = 'schedules.manage' then
    select e.access_profile into profile
    from public.employees e
    where e.profile_id = uid and e.status = 'activo'
    order by e.id
    limit 1;
    return profile in ('director_ejecutivo', 'gerente_administrativo');
  end if;
  if requested_permission = 'schedules.read.self' then
    return exists (select 1 from public.employees e where e.profile_id = uid and e.status = 'activo');
  end if;
  return false;
end
$perm$;

create or replace function public.attendance_shift_timezone(p_museum uuid) returns text
language plpgsql stable set search_path = '' as $tz$
declare
  tz text;
begin
  select nullif(trim(timezone), '') into tz from public.attendance_settings where museum_id = p_museum;
  if tz is null then raise exception 'SHIFT_TIMEZONE_NOT_CONFIGURED' using errcode = 'P0001'; end if;
  return tz;
end
$tz$;

create or replace function public.attendance_lock_shift_date(p_employee uuid, p_shift_date date) returns void
language plpgsql set search_path = '' as $lock$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_employee::text || ':' || p_shift_date::text, 0));
end
$lock$;

create or replace function public.attendance_shift_has_activity(p_shift_id uuid) returns boolean
language sql stable set search_path = '' as $activity$
  select exists (select 1 from public.attendance_events where shift_id = p_shift_id)
$activity$;

create or replace function public.attendance_write_shift_audit(
  p_museum uuid, p_action text, p_record uuid, p_old jsonb, p_new jsonb
) returns void
language plpgsql set search_path = '' as $aud$
begin
  insert into public.audit_logs(museum_id, actor_user_id, action, table_name, record_id, old_value, new_value)
  values (p_museum, auth.uid(), p_action, 'employee_shifts', p_record, p_old, p_new);
end
$aud$;

create or replace function public.attendance_week_schedule_guard(
  p_museum uuid, p_employee uuid, p_shift_date date, p_shift_id uuid,
  p_starts timestamptz, p_ends timestamptz, p_lunch integer, p_reason text
) returns void
language plpgsql set search_path = '' as $guard$
declare
  week_start date := p_shift_date - (extract(isodow from p_shift_date)::integer - 1);
  added integer := greatest(0, floor(extract(epoch from (p_ends - p_starts)) / 60)::integer - greatest(coalesce(p_lunch, 0), 0));
  existing integer;
begin
  select coalesce(sum(greatest(0, floor(extract(epoch from (s.ends_at - s.starts_at)) / 60)::integer - greatest(coalesce(s.expected_lunch_minutes, 0), 0))), 0)
    into existing
  from public.employee_shifts s
  where s.museum_id = p_museum and s.employee_id = p_employee and s.status = 'scheduled'
    and s.shift_date between week_start and week_start + 6
    and s.id is distinct from p_shift_id;
  if existing + added > 2400 and coalesce(p_reason, '') !~* 'autorizaci[oó]n excepcional' then
    raise exception 'WEEKLY_SCHEDULE_LIMIT' using errcode = 'P0001';
  end if;
end
$guard$;

create or replace function public.schedule_employee_shift(
  p_employee_id uuid, p_shift_date date, p_starts_local time, p_ends_local time,
  p_shift_id uuid default null, p_expected_lunch_minutes integer default null,
  p_set_lunch boolean default false, p_shift_type text default null,
  p_expected_updated_at timestamptz default null, p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $sched$
declare
  museum uuid;
  employee_row public.employees%rowtype;
  shift_row public.employee_shifts%rowtype;
  tz text;
  v_start timestamptz;
  v_end timestamptz;
  v_lunch integer;
  v_reason text;
begin
  if auth.uid() is null or not public.has_permission('schedules.manage') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  museum := public.current_user_museum_id();
  if museum is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into employee_row from public.employees where id = p_employee_id and museum_id = museum;
  if not found or employee_row.status <> 'activo' then
    raise exception 'EMPLOYEE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if employee_row.profile_id is not distinct from auth.uid() then
    raise exception 'SHIFT_SELF_FORBIDDEN' using errcode = '42501';
  end if;
  if p_shift_date is null or p_starts_local is null or p_ends_local is null or p_ends_local = p_starts_local then
    raise exception 'INVALID_SHIFT_HOURS' using errcode = '22023';
  end if;
  tz := public.attendance_shift_timezone(museum);
  v_start := (p_shift_date + p_starts_local) at time zone tz;
  if p_ends_local > p_starts_local then v_end := (p_shift_date + p_ends_local) at time zone tz;
  else v_end := ((p_shift_date + 1) + p_ends_local) at time zone tz; end if;
  if v_start <= now() then raise exception 'SHIFT_LOCKED' using errcode = 'P0001'; end if;
  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  v_lunch := case when coalesce(p_set_lunch, false) then p_expected_lunch_minutes else 60 end;
  if v_lunch is not null and v_lunch < 0 then raise exception 'INVALID_LUNCH' using errcode = '22023'; end if;
  perform public.attendance_lock_shift_date(p_employee_id, p_shift_date);
  if exists (
    select 1 from public.employee_shifts
    where employee_id = p_employee_id and status = 'scheduled' and id is distinct from p_shift_id
      and starts_at < v_end and v_start < ends_at
  ) then
    raise exception 'SHIFT_OVERLAP' using errcode = '23P01';
  end if;
  if p_shift_id is null then
    if exists (
      select 1 from public.employee_shifts
      where museum_id = museum and employee_id = p_employee_id and shift_date = p_shift_date and status = 'day_off'
    ) then
      raise exception 'SHIFT_CHANGED_RELOAD' using errcode = 'P0001';
    end if;
    perform public.attendance_week_schedule_guard(museum, p_employee_id, p_shift_date, null, v_start, v_end, v_lunch, v_reason);
    insert into public.employee_shifts(
      museum_id, employee_id, shift_date, starts_at, ends_at, shift_type, expected_lunch_minutes, status, created_by
    ) values (
      museum, p_employee_id, p_shift_date, v_start, v_end, coalesce(p_shift_type, 'regular'), v_lunch, 'scheduled', auth.uid()
    ) returning * into shift_row;
    perform public.attendance_write_shift_audit(museum, 'SHIFT_SCHEDULED', shift_row.id, null, jsonb_build_object('reason', v_reason));
  else
    select * into shift_row from public.employee_shifts
    where id = p_shift_id and museum_id = museum and employee_id = p_employee_id
    for update;
    if not found then raise exception 'SHIFT_NOT_FOUND' using errcode = 'P0002'; end if;
    if shift_row.updated_at is distinct from p_expected_updated_at then
      raise exception 'SHIFT_CHANGED_RELOAD' using errcode = 'P0001';
    end if;
    if shift_row.status not in ('scheduled', 'day_off') then
      raise exception 'SHIFT_LOCKED' using errcode = 'P0001';
    end if;
    if shift_row.status = 'scheduled' and v_reason is null and (
      shift_row.starts_at is distinct from v_start or shift_row.ends_at is distinct from v_end
      or shift_row.expected_lunch_minutes is distinct from v_lunch
    ) then
      raise exception 'REASON_REQUIRED' using errcode = '22023';
    end if;
    perform public.attendance_week_schedule_guard(museum, p_employee_id, p_shift_date, p_shift_id, v_start, v_end, v_lunch, v_reason);
    update public.employee_shifts
       set starts_at = v_start, ends_at = v_end, shift_date = p_shift_date, status = 'scheduled',
           expected_lunch_minutes = v_lunch, shift_type = coalesce(p_shift_type, shift_type), updated_at = now()
     where id = shift_row.id
     returning * into shift_row;
    perform public.attendance_write_shift_audit(museum, 'SHIFT_HOURS_CHANGED', shift_row.id, null, jsonb_build_object('reason', v_reason));
  end if;
  return jsonb_build_object('id', shift_row.id, 'status', shift_row.status);
end
$sched$;

create or replace function public.set_employee_day_off(
  p_employee_id uuid, p_shift_date date, p_reason text, p_expected_shifts jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $off$
declare
  museum uuid;
  employee_row public.employees%rowtype;
  shift_row public.employee_shifts%rowtype;
  day_row public.employee_shifts%rowtype;
  tz text;
  today date;
  v_reason text;
begin
  if auth.uid() is null or not public.has_permission('schedules.manage') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  museum := public.current_user_museum_id();
  if museum is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into employee_row from public.employees where id = p_employee_id and museum_id = museum;
  if not found or employee_row.status <> 'activo' then
    raise exception 'EMPLOYEE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if employee_row.profile_id is not distinct from auth.uid() then
    raise exception 'SHIFT_SELF_FORBIDDEN' using errcode = '42501';
  end if;
  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is null or length(v_reason) < 3 then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;
  tz := public.attendance_shift_timezone(museum);
  today := (now() at time zone tz)::date;
  if p_shift_date < today then raise exception 'SHIFT_LOCKED' using errcode = 'P0001'; end if;
  perform public.attendance_lock_shift_date(p_employee_id, p_shift_date);
  if exists (
    with actual as (
      select id, updated_at from public.employee_shifts
      where museum_id = museum and employee_id = p_employee_id and shift_date = p_shift_date and status = 'scheduled'
    ),
    expected as (
      select (item->>'id')::uuid as id, (item->>'updated_at')::timestamptz as updated_at
      from jsonb_array_elements(coalesce(p_expected_shifts, '[]'::jsonb)) item
    )
    select 1
    where exists (select id, updated_at from actual except select id, updated_at from expected)
       or exists (select id, updated_at from expected except select id, updated_at from actual)
  ) then
    raise exception 'SHIFT_CHANGED_RELOAD' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.employee_shifts
    where museum_id = museum and employee_id = p_employee_id and shift_date = p_shift_date and status = 'day_off'
  ) then
    raise exception 'DAY_OFF_EXISTS' using errcode = '23505';
  end if;
  for shift_row in
    select * from public.employee_shifts
    where museum_id = museum and employee_id = p_employee_id and shift_date = p_shift_date and status = 'scheduled'
    order by starts_at
  loop
    if public.attendance_shift_has_activity(shift_row.id) or shift_row.starts_at <= now() then
      raise exception 'SHIFT_LOCKED' using errcode = 'P0001';
    end if;
    update public.employee_shifts set status = 'cancelled', updated_at = now() where id = shift_row.id;
    perform public.attendance_write_shift_audit(museum, 'SHIFT_CANCELLED', shift_row.id, null, jsonb_build_object('reason', v_reason));
  end loop;
  insert into public.employee_shifts(
    museum_id, employee_id, shift_date, starts_at, ends_at, expected_lunch_minutes, shift_type, status, created_by
  ) values (
    museum, p_employee_id, p_shift_date, null, null, null, 'regular', 'day_off', auth.uid()
  ) returning * into day_row;
  perform public.attendance_write_shift_audit(museum, 'SHIFT_DAY_OFF', day_row.id, null, jsonb_build_object('reason', v_reason));
  return jsonb_build_object('day_off', day_row.id);
end
$off$;

create or replace function public.list_my_assigned_shifts(p_from date default null, p_to date default null) returns jsonb
language plpgsql security definer set search_path = '' as $list$
declare
  museum uuid;
  person uuid;
  tz text;
  day_from date;
  day_to date;
  days jsonb;
begin
  if auth.uid() is null or not public.has_permission('schedules.read.self') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  museum := public.current_user_museum_id();
  if museum is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select id into person from public.employees
  where museum_id = museum and profile_id = auth.uid() and status = 'activo'
  limit 1;
  if not found then raise exception 'EMPLOYEE_NOT_FOUND' using errcode = 'P0002'; end if;
  tz := public.attendance_shift_timezone(museum);
  day_from := coalesce(p_from, (now() at time zone tz)::date);
  day_to := coalesce(p_to, day_from);
  select coalesce(jsonb_agg(jsonb_build_object(
    'shift_date', shift_date,
    'status', status,
    'local_start', to_char(starts_at at time zone tz, 'HH24:MI'),
    'local_end', to_char(ends_at at time zone tz, 'HH24:MI')
  ) order by shift_date, starts_at), '[]'::jsonb)
  into days
  from public.employee_shifts
  where museum_id = museum and employee_id = person
    and shift_date between day_from and day_to
    and status in ('scheduled', 'day_off');
  return jsonb_build_object('employee_id', person, 'days', days);
end
$list$;

create or replace function public.test_as(p_user uuid) returns void
language plpgsql as $as$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
end
$as$;

create or replace function public.test_fail(p_ok boolean, p_message text) returns void
language plpgsql as $fail$
begin
  if not p_ok then raise exception 'FAIL: %', p_message; end if;
end
$fail$;
