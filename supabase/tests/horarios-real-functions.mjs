import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const testsDir = dirname(fileURLToPath(import.meta.url));
const migrationDir = join(testsDir, "../migrations");

function lines(name, start, end) {
  return readFileSync(join(migrationDir, name), "utf8").split(/\r?\n/).slice(start - 1, end).join("\n");
}

const schema = `
create schema if not exists auth;
create table auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table public.museums (id uuid primary key, name text not null);
create table public.profiles (
  id uuid primary key references auth.users(id),
  museum_id uuid not null references public.museums(id),
  full_name text not null default '',
  email text not null,
  role text not null default 'empleado',
  status text not null default 'active' check (status in ('active','suspended','inactive'))
);
create table public.employee_module_profiles (
  code text primary key, label text not null, modules text[] not null
);
insert into public.employee_module_profiles(code, label, modules) values
  ('director_ejecutivo','Director Ejecutivo', array['administration','personal']),
  ('gerente_administrativo','Gerente Administrativo', array['administration','personal']),
  ('mantenimiento','Mantenimiento', array['personal']);
create table public.employees (
  id uuid primary key,
  museum_id uuid not null references public.museums(id),
  profile_id uuid references public.profiles(id),
  first_name text not null,
  last_name text not null,
  email text not null,
  status text not null check (status in ('activo','inactivo','terminado')),
  work_schedule text,
  access_profile text references public.employee_module_profiles(code)
);
create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null,
  sensitivity text not null
);
create table public.roles (id uuid primary key default gen_random_uuid(), code text not null unique, name text not null);
create table public.role_permissions (
  role_id uuid not null references public.roles(id),
  permission_id uuid not null references public.permissions(id),
  primary key (role_id, permission_id)
);
create table public.user_roles (
  museum_id uuid not null references public.museums(id),
  user_id uuid not null references public.profiles(id),
  role_id uuid not null references public.roles(id),
  valid_until timestamptz,
  primary key (museum_id, user_id, role_id)
);
create table public.user_permissions (
  museum_id uuid not null references public.museums(id),
  user_id uuid not null references public.profiles(id),
  permission_id uuid not null references public.permissions(id),
  effect text not null check (effect in ('allow','deny')),
  valid_until timestamptz,
  primary key (museum_id, user_id, permission_id)
);
create table public.attendance_settings (museum_id uuid primary key references public.museums(id), timezone text not null);
create table public.employee_shifts (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id),
  employee_id uuid not null references public.employees(id),
  starts_at timestamptz,
  ends_at timestamptz,
  shift_date date not null,
  shift_type text not null default 'regular' check (shift_type in ('regular','night','special_activity','weekend','extraordinary')),
  expected_lunch_minutes integer check (expected_lunch_minutes is null or expected_lunch_minutes >= 0),
  status text not null default 'scheduled',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_shifts_status_check check (status in ('scheduled','cancelled','completed','day_off')),
  constraint employee_shifts_time_contract_check check (
    (status in ('scheduled','cancelled','completed') and starts_at is not null and ends_at is not null and ends_at > starts_at)
    or (status = 'day_off' and starts_at is null and ends_at is null and expected_lunch_minutes is null)
  )
);
create unique index employee_shifts_one_day_off on public.employee_shifts (employee_id, shift_date) where status = 'day_off';
create table public.attendance_events (id uuid primary key default gen_random_uuid(), shift_id uuid);
create table public.attendance_operational_alerts (id uuid primary key default gen_random_uuid(), shift_id uuid);
create table public.attendance_correction_requests (id uuid primary key default gen_random_uuid(), shift_id uuid);
create table public.attendance_overtime_reviews (id uuid primary key default gen_random_uuid(), shift_id uuid);
create table public.attendance_exclusions (id uuid primary key default gen_random_uuid(), shift_id uuid);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id),
  actor_user_id uuid references public.profiles(id),
  action text not null,
  table_name text not null,
  record_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create table public.employee_time_entries (
  id uuid primary key,
  employee_id uuid not null,
  punched_at timestamptz not null,
  kind text not null
);
create table public.payroll_shift_days (
  id uuid primary key,
  employee_id uuid not null,
  amount numeric not null
);

insert into auth.users(id) values
  ('33333333-3333-4333-8333-333333333333'),
  ('66666666-6666-4666-8666-666666666666');
insert into public.museums(id, name) values ('11111111-1111-4111-8111-111111111111','Museo ficticio');
insert into public.profiles(id, museum_id, full_name, email, role, status) values
  ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Director Ficticio','director@example.test','ejecutivo','active'),
  ('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111','Empleado Ficticio','empleado@example.test','empleado','active');
insert into public.employees(id, museum_id, profile_id, first_name, last_name, email, status, access_profile) values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','Director','Ficticio','director@example.test','activo','director_ejecutivo'),
  ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','66666666-6666-4666-8666-666666666666','Empleado','Ficticio','empleado@example.test','activo','mantenimiento');
insert into public.attendance_settings(museum_id, timezone) values ('11111111-1111-4111-8111-111111111111','America/Puerto_Rico');
insert into public.permissions(code, description, sensitivity) values
  ('schedules.read.self','Leer horario propio','sensitive'),
  ('schedules.manage','Administrar horarios','sensitive');
insert into public.roles(code, name) values ('empleado','Empleado');
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'empleado' and p.code = 'schedules.read.self';
insert into public.user_roles(museum_id, user_id, role_id)
select '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666666', id from public.roles where code = 'empleado';
insert into public.employee_time_entries(id, employee_id, punched_at, kind) values
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1','55555555-5555-4555-8555-555555555555','2027-06-07 12:00+00','clock_in');
insert into public.payroll_shift_days(id, employee_id, amount) values
  ('b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2','55555555-5555-4555-8555-555555555555',123.45);

do $roles$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  grant usage on schema public to anon, authenticated;
end $roles$;
`;

const triggers = `
create trigger employee_shifts_protect_history
  before update on public.employee_shifts
  for each row execute function public.employee_shifts_protect_history();
create trigger employee_shifts_z_contract
  before insert or update on public.employee_shifts
  for each row execute function public.employee_shifts_enforce_contract();
`;

const flow = `
do $flow$
declare
  saved jsonb;
  viewed jsonb;
  published jsonb;
  mine jsonb;
  shifts int;
  punch_at timestamptz;
  payroll_amount numeric;
begin
  perform set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
  if public.has_permission('schedules.manage') then
    raise exception 'MAINTENANCE_SHOULD_NOT_MANAGE';
  end if;
  if not public.has_permission('schedules.read.self') then
    raise exception 'EMPLOYEE_SHOULD_READ_SELF';
  end if;
  begin
    perform public.save_schedule_week_draft('2027-06-07', '[]'::jsonb);
    raise exception 'FORBIDDEN_NOT_RAISED';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
  if not public.has_permission('schedules.manage') then
    raise exception 'DIRECTOR_SHOULD_MANAGE';
  end if;
  begin
    perform public.save_schedule_week_draft('2027-06-07', jsonb_build_array(jsonb_build_object(
      'employeeId','dddddddd-dddd-4ddd-8ddd-dddddddddddd','date','2027-06-07','dayOff',false,
      'start','08:00','end','17:00','lunch',60,'reason','','baseline','none')));
    raise exception 'SELF_EDIT_NOT_BLOCKED';
  exception when insufficient_privilege then null;
  end;

  saved := public.save_schedule_week_draft('2027-06-07', jsonb_build_array(
    jsonb_build_object('employeeId','55555555-5555-4555-8555-555555555555','date','2027-06-07','dayOff',false,'start','13:00','end','22:00','lunch',60,'reason','','baseline','none'),
    jsonb_build_object('employeeId','55555555-5555-4555-8555-555555555555','date','2027-06-08','dayOff',false,'start','13:00','end','22:00','lunch',60,'reason','','baseline','none'),
    jsonb_build_object('employeeId','55555555-5555-4555-8555-555555555555','date','2027-06-09','dayOff',false,'start','13:00','end','22:00','lunch',60,'reason','','baseline','none'),
    jsonb_build_object('employeeId','55555555-5555-4555-8555-555555555555','date','2027-06-10','dayOff',false,'start','13:00','end','22:00','lunch',60,'reason','','baseline','none'),
    jsonb_build_object('employeeId','55555555-5555-4555-8555-555555555555','date','2027-06-11','dayOff',false,'start','22:00','end','07:00','lunch',60,'reason','','baseline','none'),
    jsonb_build_object('employeeId','55555555-5555-4555-8555-555555555555','date','2027-06-12','dayOff',true,'reason','Descanso semanal','baseline','none')
  ));
  if (saved->>'revision')::int <> 1 then raise exception 'DRAFT_REVISION'; end if;
  if (select count(*) from public.employee_shifts where employee_id = '55555555-5555-4555-8555-555555555555') <> 0 then
    raise exception 'DRAFT_WROTE_OFFICIAL_SHIFT';
  end if;

  perform set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
  begin
    perform public.get_schedule_week_draft('2027-06-07');
    raise exception 'EMPLOYEE_SAW_DRAFT';
  exception when insufficient_privilege then null;
  end;
  mine := public.list_my_assigned_shifts('2027-06-07','2027-06-13');
  if mine::text like '%13:00%' or mine::text like '%schedule_week%' then
    raise exception 'MI_ESPACIO_LEAKED_DRAFT';
  end if;

  perform set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
  viewed := public.get_schedule_week_draft('2027-06-07');
  if jsonb_array_length(viewed->'items') <> 6 then raise exception 'REVIEW_COUNT'; end if;
  if not exists (
    select 1 from jsonb_array_elements(viewed->'items') item
    where item->>'date' = '2027-06-11' and item->>'start' = '22:00' and item->>'end' = '07:00'
  ) then raise exception 'REVIEW_NIGHT'; end if;

  published := public.publish_schedule_week((saved->>'id')::uuid, (saved->>'revision')::int);
  if published->>'state' <> 'published' then raise exception 'NOT_PUBLISHED'; end if;
  select count(*) into shifts from public.employee_shifts
   where employee_id = '55555555-5555-4555-8555-555555555555' and status = 'scheduled';
  if shifts <> 5 then raise exception 'SCHEDULED_COUNT %', shifts; end if;
  if (select count(*) from public.employee_shifts
      where employee_id = '55555555-5555-4555-8555-555555555555' and status = 'day_off' and shift_date = '2027-06-12') <> 1 then
    raise exception 'DAY_OFF_MISSING';
  end if;
  if (select count(*) from public.audit_logs
      where action = 'SCHEDULE_WEEK_PUBLISHED' and actor_user_id = '33333333-3333-4333-8333-333333333333'
        and record_id = (saved->>'id')::uuid) <> 1 then
    raise exception 'AUDIT_MISSING';
  end if;
  begin
    perform public.publish_schedule_week((published->>'id')::uuid, (published->>'revision')::int);
    raise exception 'SECOND_PUBLISH_ALLOWED';
  exception when raise_exception then
    if sqlerrm <> 'DRAFT_CONFLICT' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
  mine := public.list_my_assigned_shifts('2027-06-07','2027-06-13');
  if mine::text not like '%13:00%' or mine::text not like '%22:00%' or position('day_off' in mine::text) = 0 then
    raise exception 'MI_ESPACIO_MISSING_OFFICIAL %', mine;
  end if;
  if position('schedule_week' in pg_get_functiondef('public.list_my_assigned_shifts(date,date)'::regprocedure)) > 0 then
    raise exception 'LIST_MY_READS_DRAFTS';
  end if;

  select punched_at into punch_at from public.employee_time_entries where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1';
  select amount into payroll_amount from public.payroll_shift_days where id = 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2';
  if punch_at <> '2027-06-07 12:00+00' or payroll_amount <> 123.45 then
    raise exception 'PUNCH_OR_PAYROLL_CHANGED';
  end if;
end $flow$;
`;

const overlap = `
do $overlap$
begin
  perform set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
  perform public.schedule_employee_shift(
    '55555555-5555-4555-8555-555555555555', '2027-07-04', '22:00', '07:00',
    null, 0, true, null, null, 'Turno previo'
  );
  begin
    perform public.save_schedule_week_draft('2027-07-05', jsonb_build_array(jsonb_build_object(
      'employeeId','55555555-5555-4555-8555-555555555555','date','2027-07-05','dayOff',false,
      'start','05:00','end','13:00','lunch',0,'reason','','baseline','none')));
    raise exception 'OVERLAP_NOT_BLOCKED';
  exception when exclusion_violation then
    if sqlerrm <> 'SHIFT_OVERLAP' then raise; end if;
  end;
  if exists (select 1 from public.employee_shifts where employee_id = '55555555-5555-4555-8555-555555555555' and shift_date = '2027-07-05') then
    raise exception 'OVERLAP_WROTE_MONDAY';
  end if;
end $overlap$;
`;

const conflict = `
do $conflict$
declare saved jsonb;
begin
  perform set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
  perform public.schedule_employee_shift(
    '55555555-5555-4555-8555-555555555555', '2027-07-12', '08:00', '17:00',
    null, 60, true, null, null, 'Base'
  );
  saved := public.save_schedule_week_draft('2027-07-12', jsonb_build_array(jsonb_build_object(
    'employeeId','55555555-5555-4555-8555-555555555555','date','2027-07-12','dayOff',false,
    'start','09:00','end','18:00','lunch',60,'reason','Cambio de hora','baseline','scheduled',
    'expectedShiftId', (select id::text from public.employee_shifts where employee_id = '55555555-5555-4555-8555-555555555555' and shift_date = '2027-07-12' and status = 'scheduled'),
    'expectedUpdatedAt', (select updated_at from public.employee_shifts where employee_id = '55555555-5555-4555-8555-555555555555' and shift_date = '2027-07-12' and status = 'scheduled')
  )));
  update public.employee_shifts set updated_at = updated_at + interval '2 seconds'
   where employee_id = '55555555-5555-4555-8555-555555555555' and shift_date = '2027-07-12' and status = 'scheduled';
  begin
    perform public.publish_schedule_week((saved->>'id')::uuid, (saved->>'revision')::int);
    raise exception 'CONFLICT_NOT_DETECTED';
  exception when raise_exception then
    if sqlerrm <> 'SHIFT_CONFLICT' then raise; end if;
  end;
  if (select to_char(starts_at at time zone 'America/Puerto_Rico', 'HH24:MI') from public.employee_shifts
      where employee_id = '55555555-5555-4555-8555-555555555555' and shift_date = '2027-07-12' and status = 'scheduled') <> '08:00' then
    raise exception 'CONFLICT_CHANGED_OFFICIAL';
  end if;
end $conflict$;
`;

const rollback = `
do $rollback$
declare saved jsonb;
begin
  perform set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
  saved := public.save_schedule_week_draft('2027-07-19', jsonb_build_array(
    jsonb_build_object('employeeId','55555555-5555-4555-8555-555555555555','date','2027-07-19','dayOff',false,'start','08:00','end','17:00','lunch',60,'reason','','baseline','none'),
    jsonb_build_object('employeeId','55555555-5555-4555-8555-555555555555','date','2027-07-20','dayOff',false,'start','08:00','end','17:00','lunch',60,'reason','','baseline','none')
  ));
  alter function public.schedule_employee_shift(uuid, date, time, time, uuid, integer, boolean, text, timestamptz, text) rename to schedule_employee_shift_core;
  create function public.schedule_employee_shift(
    p_employee_id uuid, p_shift_date date, p_starts_local time, p_ends_local time,
    p_shift_id uuid default null, p_expected_lunch_minutes integer default null,
    p_set_lunch boolean default false, p_shift_type text default null,
    p_expected_updated_at timestamptz default null, p_reason text default null
  ) returns jsonb language plpgsql security definer set search_path = public as $wrap$
  declare calls int;
  begin
    select count(*) into calls from public.employee_shifts
     where employee_id = p_employee_id and shift_date between '2027-07-19' and '2027-07-25' and status = 'scheduled';
    if calls >= 1 then raise exception 'FORCED_BATCH_FAILURE' using errcode = 'P0001'; end if;
    return public.schedule_employee_shift_core(p_employee_id, p_shift_date, p_starts_local, p_ends_local, p_shift_id, p_expected_lunch_minutes, p_set_lunch, p_shift_type, p_expected_updated_at, p_reason);
  end $wrap$;
  begin
    perform public.publish_schedule_week((saved->>'id')::uuid, (saved->>'revision')::int);
    raise exception 'ROLLBACK_DID_NOT_FAIL';
  exception when raise_exception then
    if sqlerrm <> 'FORCED_BATCH_FAILURE' then raise; end if;
  end;
  if exists (select 1 from public.employee_shifts where employee_id = '55555555-5555-4555-8555-555555555555' and shift_date between '2027-07-19' and '2027-07-25') then
    raise exception 'ROLLBACK_LEFT_SHIFTS';
  end if;
  if (select state from public.schedule_week_drafts where id = (saved->>'id')::uuid) <> 'draft' then
    raise exception 'ROLLBACK_PUBLISHED_DRAFT';
  end if;
  drop function public.schedule_employee_shift(uuid, date, time, time, uuid, integer, boolean, text, timestamptz, text);
  alter function public.schedule_employee_shift_core(uuid, date, time, time, uuid, integer, boolean, text, timestamptz, text) rename to schedule_employee_shift;
end $rollback$;
`;

const rls = `
do $rls$
begin
  set local role authenticated;
  begin
    perform 1 from public.schedule_week_drafts;
    raise exception 'AUTHENTICATED_READ_DRAFTS';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $rls$;
`;

const db = new PGlite();
const steps = [
  ["schema", schema],
  ["museum", lines("202607210001_identity_rbac_rls.sql", 143, 145)],
  ["module-profile", lines("202609180002_employee_module_profiles.sql", 23, 28)],
  ["permission-module", lines("202609180002_employee_module_profiles.sql", 38, 54)],
  ["permission-base", lines("202609060002_personal_access_compatibility.sql", 39, 79).replace(
    "function public.has_permission(requested_permission text)",
    "function public.module_profile_base_permission(requested_permission text)"
  )],
  ["permission", lines("202609220001_administrative_manager_employee_management.sql", 4, 23)],
  ["permission-patch", lines("202609280003_assigned_shift_rpcs.sql", 13, 58)],
  ["timezone", lines("202609280001_assigned_shift_contract.sql", 6, 23)],
  ["contract", lines("202609280001_assigned_shift_contract.sql", 139, 178)],
  ["activity", lines("202609280002_assigned_shift_immutability.sql", 5, 52)],
  ["shift-helpers", lines("202609280003_assigned_shift_rpcs.sql", 60, 270)],
  ["day-off", lines("202609280003_assigned_shift_rpcs.sql", 531, 667)],
  ["list-my", lines("202609280003_assigned_shift_rpcs.sql", 707, 744)],
  ["week-guard", lines("202610260002_legal_overtime_and_week_guard.sql", 631, 662)],
  ["schedule-shift", lines("202610260002_legal_overtime_and_week_guard.sql", 713, 899)],
  ["triggers", triggers]
];

let failed = false;
try {
  for (const [name, sql] of steps) {
    try {
      await db.exec(sql);
      console.log(`PASS load ${name}`);
    } catch (error) {
      failed = true;
      console.error(`FAIL load ${name}`);
      console.error(error?.message || error);
      break;
    }
  }
  if (!failed) {
    try {
      await db.exec("create schema if not exists extensions; create extension if not exists btree_gist with schema extensions;");
      await db.exec(`
        alter table public.employee_shifts
          add constraint employee_shifts_no_scheduled_overlap
          exclude using gist (employee_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
          where (status = 'scheduled');
      `);
      console.log("PASS load overlap-constraint");
    } catch (error) {
      console.log(`SKIP overlap-constraint: ${error?.message || error}`);
    }
  }
  if (!failed) {
    try {
      await db.exec(readFileSync(join(migrationDir, "202610270001_schedule_week_drafts.sql"), "utf8"));
      console.log("PASS load migration");
    } catch (error) {
      failed = true;
      console.error("FAIL load migration");
      console.error(error?.message || error);
    }
  }
  if (!failed) {
    for (const [name, sql] of [["flow", flow], ["overlap", overlap], ["conflict", conflict], ["rollback", rollback], ["rls", rls]]) {
      try {
        await db.exec(sql);
        console.log(`PASS ${name}`);
      } catch (error) {
        failed = true;
        console.error(`FAIL ${name}`);
        console.error(error?.message || error);
        break;
      }
    }
  }
} finally {
  await db.close();
}
if (failed) process.exit(1);
console.log("HORARIOS real functions: passed");
