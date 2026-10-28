-- Staging exercise for the 2026-10-28 punch-correction governance.
-- Requires 202610280001 and 202610280002. The runner wraps this in a transaction and rolls it back.
-- It does not change stored punches outside that transaction.

do $gov$
declare
  actor uuid;
  museum uuid;
  employee uuid;
  other_user uuid;
  other_employee uuid;
  subject uuid;
  authorizer uuid;
  gerente_listed uuid;
  subject_shift uuid := 'e6280000-0000-4000-8000-000000000001';
  own_shift uuid := 'e6280000-0000-4000-8000-000000000002';
  request_shift uuid := 'e6280000-0000-4000-8000-000000000003';
  event_id uuid := 'e6280000-0000-4000-8000-000000000021';
  start_at timestamptz := now() - interval '20 hours';
  end_at timestamptz := now() - interval '12 hours';
  old_punch timestamptz := now() - interval '19 hours';
  new_punch timestamptz := now() - interval '20 hours';
  before_events integer;
  audits_before integer;
  audits_after integer;
  request_id uuid;
  src text;
  deny_at integer;
  allow_at integer;
begin
  alter table public.employees disable trigger protect_employee_module_profile;
  select e.profile_id, e.museum_id, e.id into actor, museum, employee
  from public.employees e
  join public.profiles p on p.id = e.profile_id and p.museum_id = e.museum_id
  where e.status = 'activo' and p.status in ('active','activo')
  order by e.created_at
  limit 1;
  if actor is null then raise exception 'FIXTURE_ACTOR'; end if;
  select e.profile_id, e.id into other_user, other_employee
  from public.employees e
  join public.profiles p on p.id = e.profile_id and p.museum_id = e.museum_id
  where e.museum_id = museum and e.status = 'activo' and p.status in ('active','activo') and e.profile_id <> actor
  order by e.created_at
  limit 1;
  if other_user is null then raise exception 'FIXTURE_SECOND_ACTOR'; end if;

  insert into public.employees(museum_id, first_name, last_name, email, access_profile, status)
  values (museum, 'Gobernanza', 'Sujeto', 'punch-governance-subject-' || gen_random_uuid()::text || '@example.invalid', 'tecnico_produccion', 'activo')
  returning id into subject;
  insert into public.employees(museum_id, first_name, last_name, email, access_profile, status)
  values (museum, 'Gobernanza', 'Autoriza', 'punch-governance-authorizer-' || gen_random_uuid()::text || '@example.invalid', 'director_ejecutivo', 'activo')
  returning id into authorizer;
  insert into public.employees(museum_id, first_name, last_name, email, access_profile, status)
  values (museum, 'Gobernanza', 'Gerente', 'punch-governance-gerente-' || gen_random_uuid()::text || '@example.invalid', 'gerente_administrativo', 'activo')
  returning id into gerente_listed;
  insert into public.attendance_settings(museum_id, version)
  values (museum, 1) on conflict (museum_id) do nothing;

  insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, status, created_by)
  values (subject_shift, museum, subject, start_at, end_at, 'scheduled', actor);
  insert into public.attendance_attempts(id, museum_id, employee_id, shift_id, actor_user_id, requested_event, result)
  values ('e6280000-0000-4000-8000-000000000011', museum, subject, subject_shift, actor, 'clock_in', 'accepted');
  insert into public.attendance_events(id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by)
  values (event_id, museum, subject, subject_shift, 'e6280000-0000-4000-8000-000000000011', 'clock_in', old_punch, 'late', 1, actor);
  insert into public.employee_time_entries(museum_id, employee_id, clock_in, clock_out, source, sync_status, created_by)
  values (museum, subject, old_punch, null, 'instituva', 'not_configured', actor);
  insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, status, created_by)
  values (own_shift, museum, employee, start_at, end_at, 'scheduled', actor);

  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);

  update public.employees set access_profile = 'director_ejecutivo' where id = employee;
  if not public.has_permission('attendance.punches.correct') then raise exception 'DIRECTOR_DENIED'; end if;
  if not public.has_permission('attendance.corrections.decide') then raise exception 'DIRECTOR_LOST_DECIDE'; end if;
  if not public.has_permission('schedules.manage') then raise exception 'DIRECTOR_LOST_SCHEDULES'; end if;

  update public.employees set access_profile = 'administrador_general' where id = employee;
  if not public.has_permission('attendance.punches.correct') then raise exception 'ADMIN_DENIED'; end if;
  if public.has_permission('attendance.corrections.decide') then raise exception 'ADMIN_GAINED_DECIDE'; end if;
  if public.has_permission('schedules.manage') then raise exception 'ADMIN_GAINED_SCHEDULES'; end if;
  if public.has_permission('attendance.exclusions.manage') then raise exception 'ADMIN_GAINED_EXCLUSIONS'; end if;
  if not public.has_permission('attendance.history.read') then raise exception 'ADMIN_LOST_HISTORY'; end if;
  if not public.has_permission('attendance.today.read') then raise exception 'ADMIN_LOST_TODAY'; end if;
  if not exists (
    select 1 from jsonb_array_elements(public.list_attendance_correction_authorizers()) item
    where item->>'id' in (employee::text, authorizer::text)
    having count(*) = 2
  ) then raise exception 'AUTHORIZER_LIST_INCOMPLETE'; end if;
  if exists (
    select 1 from jsonb_array_elements(public.list_attendance_correction_authorizers()) item
    where item->>'id' = gerente_listed::text
  ) then raise exception 'GERENTE_LISTED'; end if;
  select count(*) into before_events from public.attendance_events where shift_id = subject_shift;
  begin
    perform public.correct_shift_attendance_punches(subject_shift, 'missed_clock_in', null, gerente_listed, jsonb_build_array(
      jsonb_build_object('event_type', 'clock_in', 'occurred_at', new_punch, 'expected_event_id', event_id)));
    raise exception 'GERENTE_AUTHORIZER_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'AUTHORIZER_NOT_FOUND' then raise; end if;
  end;
  if (select count(*) from public.attendance_events where shift_id = subject_shift) <> before_events then
    raise exception 'GERENTE_AUTHORIZER_MUTATED';
  end if;
  insert into public.user_permissions(user_id, museum_id, permission_id, effect)
  select actor, museum, id, 'deny' from public.permissions where code = 'attendance.punches.correct';
  if public.has_permission('attendance.punches.correct') then raise exception 'ADMIN_DENY_LOST'; end if;
  delete from public.user_permissions where user_id = actor and museum_id = museum
    and permission_id = (select id from public.permissions where code = 'attendance.punches.correct');
  if not public.has_permission('attendance.punches.correct') then raise exception 'ADMIN_DENY_STUCK'; end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'user_id'
  ) then
    select count(*) into audits_before from public.audit_logs
     where action = 'ATTENDANCE_ADMIN_PUNCH_CORRECTED' and user_id = actor;
  else
    select count(*) into audits_before from public.audit_logs
     where action = 'ATTENDANCE_ADMIN_PUNCH_CORRECTED' and actor_user_id = actor;
  end if;
  perform public.correct_shift_attendance_punches(subject_shift, 'missed_clock_in', null, authorizer, jsonb_build_array(
    jsonb_build_object('event_type', 'clock_in', 'occurred_at', new_punch, 'expected_event_id', event_id)));
  if (select occurred_at from public.attendance_events where id = event_id) <> old_punch then raise exception 'ORIGINAL_MUTATED'; end if;
  if not exists (select 1 from public.attendance_events where supersedes_event_id = event_id) then raise exception 'SUPERSEDE_MISSING'; end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'user_id'
  ) then
    select count(*) into audits_after from public.audit_logs
     where action = 'ATTENDANCE_ADMIN_PUNCH_CORRECTED' and user_id = actor;
  else
    select count(*) into audits_after from public.audit_logs
     where action = 'ATTENDANCE_ADMIN_PUNCH_CORRECTED' and actor_user_id = actor;
  end if;
  if audits_after <> audits_before + 1 then raise exception 'AUDIT_MISSING'; end if;

  update public.employees set access_profile = 'gerente_administrativo' where id = employee;
  if public.has_permission('attendance.punches.correct') then raise exception 'GERENTE_CAN_CORRECT'; end if;
  insert into public.user_permissions(user_id, museum_id, permission_id, effect)
  select actor, museum, id, 'allow' from public.permissions where code = 'attendance.punches.correct';
  if public.has_permission('attendance.punches.correct') then raise exception 'GERENTE_ALLOW_OVERRIDES'; end if;
  delete from public.user_permissions where user_id = actor and museum_id = museum
    and permission_id = (select id from public.permissions where code = 'attendance.punches.correct');
  if not public.has_permission('attendance.history.read') then raise exception 'GERENTE_LOST_HISTORY'; end if;
  if not public.has_permission('attendance.today.read') then raise exception 'GERENTE_LOST_TODAY'; end if;
  if not public.has_permission('attendance.corrections.decide') then raise exception 'GERENTE_LOST_DECIDE'; end if;
  if not public.has_permission('attendance.corrections.request') then raise exception 'GERENTE_LOST_REQUEST'; end if;
  if not public.has_permission('attendance.exclusions.manage') then raise exception 'GERENTE_LOST_EXCLUSIONS'; end if;
  if not public.has_permission('schedules.manage') then raise exception 'GERENTE_LOST_SCHEDULES'; end if;
  select count(*) into before_events from public.attendance_events where shift_id in (subject_shift, own_shift);
  begin
    perform public.correct_shift_attendance_punches(subject_shift, 'missed_clock_in', null, authorizer, jsonb_build_array(
      jsonb_build_object('event_type', 'clock_in', 'occurred_at', new_punch + interval '1 minute', 'expected_event_id',
        (select id from public.attendance_events where shift_id = subject_shift and event_type = 'clock_in'
           and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id = attendance_events.id)))));
    raise exception 'GERENTE_OTHER_ALLOWED';
  exception when insufficient_privilege then null; end;
  begin
    perform public.correct_shift_attendance_punches(own_shift, 'missed_clock_in', null, authorizer, jsonb_build_array(
      jsonb_build_object('event_type', 'clock_in', 'occurred_at', new_punch, 'expected_event_id', null)));
    raise exception 'GERENTE_OWN_ALLOWED';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.attendance_events where shift_id in (subject_shift, own_shift)) <> before_events then
    raise exception 'GERENTE_MUTATED';
  end if;

  perform set_config('request.jwt.claim.sub', other_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', other_user, 'role', 'authenticated')::text, true);
  insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, status, created_by)
  values (request_shift, museum, other_employee, start_at, end_at, 'scheduled', actor);
  insert into public.attendance_attempts(id, museum_id, employee_id, shift_id, actor_user_id, requested_event, result)
  values ('e6280000-0000-4000-8000-000000000031', museum, other_employee, request_shift, other_user, 'clock_in', 'accepted');
  insert into public.attendance_events(id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by)
  values ('e6280000-0000-4000-8000-000000000041', museum, other_employee, request_shift, 'e6280000-0000-4000-8000-000000000031', 'clock_in', old_punch, 'on_time', 1, other_user);
  insert into public.employee_time_entries(museum_id, employee_id, clock_in, clock_out, source, sync_status, created_by)
  values (museum, other_employee, old_punch, null, 'instituva', 'not_configured', other_user);
  request_id := (public.request_own_attendance_correction(request_shift, 'clock_in', new_punch, 'Olvidé la hora de entrada')->>'id')::uuid;
  select count(*) into before_events from public.attendance_events where shift_id = request_shift;

  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);
  if jsonb_typeof(public.list_attendance_corrections()) is distinct from 'object' then raise exception 'GERENTE_CANNOT_LIST'; end if;
  begin
    perform public.decide_attendance_correction(request_id, 'approved', 'No debe cambiar la hora');
    raise exception 'GERENTE_APPROVED';
  exception when insufficient_privilege then null; end;
  if (select status from public.attendance_correction_requests where id = request_id) <> 'pending' then raise exception 'GERENTE_APPROVAL_WROTE'; end if;
  if (select occurred_at from public.attendance_events where id = 'e6280000-0000-4000-8000-000000000041') <> old_punch then raise exception 'GERENTE_CHANGED_REQUESTED_PUNCH'; end if;
  if to_regprocedure('public.decide_attendance_correction(uuid,uuid,uuid,text,text)') is not null then
    insert into public.user_permissions(user_id, museum_id, permission_id, effect)
    select actor, museum, id, 'allow' from public.permissions where code = 'attendance.corrections.approve';
    begin
      perform public.decide_attendance_correction(actor, museum, request_id, 'approved', 'Tampoco por la vía anterior');
      raise exception 'LEGACY_APPROVE_ALLOWED';
    exception when insufficient_privilege then null; end;
    delete from public.user_permissions where user_id = actor and museum_id = museum
      and permission_id = (select id from public.permissions where code = 'attendance.corrections.approve');
    if (select status from public.attendance_correction_requests where id = request_id) <> 'pending' then raise exception 'LEGACY_APPROVAL_WROTE'; end if;
  end if;
  perform public.decide_attendance_correction(request_id, 'rejected', 'La solicitud no modifica el ponche');
  if (select status from public.attendance_correction_requests where id = request_id) <> 'rejected' then raise exception 'GERENTE_CANNOT_REJECT'; end if;
  if (select count(*) from public.attendance_events where shift_id = request_shift) <> before_events then raise exception 'REJECT_MUTATED'; end if;

  perform set_config('request.jwt.claim.sub', other_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', other_user, 'role', 'authenticated')::text, true);
  request_id := (public.request_own_attendance_correction(request_shift, 'clock_in', new_punch + interval '2 minutes', 'Segunda solicitud de entrada')->>'id')::uuid;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);
  update public.employees set access_profile = 'director_ejecutivo' where id = employee;
  perform public.decide_attendance_correction(request_id, 'approved', 'El director sí puede corregir la hora');
  if (select status from public.attendance_correction_requests where id = request_id) <> 'approved' then raise exception 'DIRECTOR_APPROVAL_FAILED'; end if;
  if (select occurred_at from public.attendance_events where id = 'e6280000-0000-4000-8000-000000000041') <> old_punch then raise exception 'DIRECTOR_CHANGED_ORIGINAL'; end if;
  if not exists (
    select 1 from public.audit_logs
    where record_id = request_id and action = 'ATTENDANCE_CORRECTION_APPROVED'
  ) then raise exception 'APPROVAL_AUDIT_MISSING'; end if;

  update public.employees set access_profile = 'tecnico_produccion' where id = employee;
  if public.has_permission('attendance.punches.correct') then raise exception 'TECNICO_GAINED_CORRECT'; end if;

  src := replace(pg_get_functiondef('public.has_permission(text)'::regprocedure), E'\r\n', E'\n');
  deny_at := position('punch_correction_governance_20261028' in src);
  allow_at := position('in (''administrador_general'',''director_ejecutivo'') then' in src);
  if deny_at = 0 or allow_at = 0 or deny_at > allow_at then raise exception 'DENY_NOT_PRIORITY'; end if;
  if position('schedules_manage_profiles' in src) = 0 then raise exception 'SCHEDULES_PATCH_MISSING'; end if;
  if position('p_decision = ''approved'' and not public.has_permission(''attendance.punches.correct'')' in pg_get_functiondef('public.decide_attendance_correction(uuid,text,text)'::regprocedure)) = 0 then
    raise exception 'DECIDE_GUARD_MISSING';
  end if;
  if position('e.access_profile in (''administrador_general'',''director_ejecutivo'')' in pg_get_functiondef('public.list_attendance_correction_authorizers()'::regprocedure)) = 0
     or position('e.access_profile in (''director_ejecutivo'',''gerente_administrativo'')' in pg_get_functiondef('public.list_attendance_correction_authorizers()'::regprocedure)) > 0
     or position('e.access_profile in (''administrador_general'',''director_ejecutivo'')' in pg_get_functiondef('public.correct_shift_attendance_punches(uuid,text,text,uuid,jsonb)'::regprocedure)) = 0
     or position('e.access_profile in (''director_ejecutivo'',''gerente_administrativo'')' in pg_get_functiondef('public.correct_shift_attendance_punches(uuid,text,text,uuid,jsonb)'::regprocedure)) > 0 then
    raise exception 'AUTHORIZER_PROFILES_DIVERGED';
  end if;

  raise notice 'PUNCH_CORRECTION_GOVERNANCE_OK';
end
$gov$;
