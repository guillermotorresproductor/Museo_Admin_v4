-- Staging exercise. The runner wraps this in a transaction and rolls it back.

do $test$
declare
  profile_user uuid := 'ca3d0682-662b-4fb5-b859-8e150beb07e6';
  employee_user uuid := 'cc2a33ee-6267-4cb0-8b63-1c5ede309d9e';
  admin uuid := '25abccb5-3927-4b1d-b928-098fde77f97c';
  museum uuid;
  other_museum uuid;
  eid uuid;
  sid uuid := 'b3c00000-0000-4000-8000-000000000001';
  start_at timestamptz := now() - interval '8 hours';
  end_at timestamptz := now() - interval '30 minutes';
  request_id uuid;
  original_id uuid;
  corrected_id uuid;
  before_events integer;
  after_events integer;
  finance_before integer := 0;
  finance_after integer := 0;
  decider_employee uuid;
  self_shift uuid := 'b3c00000-0000-4000-8000-000000000010';
  self_request uuid;
  reject_request uuid;
  events_before_reject integer;
  add_shift uuid := 'b3c00000-0000-4000-8000-000000000020';
  add_request uuid;
  ot_shift uuid := 'b3c00000-0000-4000-8000-000000000030';
  ot_request uuid;
  block_shift uuid := 'b3c00000-0000-4000-8000-000000000040';
  block_request uuid;
  alert_count integer;
begin
  if to_regclass('public.finance_records') is not null then
    select count(*) into finance_before from public.finance_records;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'actor_user_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'user_id'
  ) then
    alter table public.audit_logs rename column actor_user_id to user_id;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'user_id'
  ) or exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'actor_user_id'
  ) then
    raise exception 'AUDIT_LOGS_SCHEMA_NOT_PRODUCTION';
  end if;
  do $retarget$
  declare r record; src text; patched text;
  begin
    for r in
      select p.oid::regprocedure as proc
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) like '%audit_logs%actor_user_id%'
    loop
      src := pg_get_functiondef(r.proc);
      patched := replace(replace(src, 'audit_logs(museum_id,actor_user_id', 'audit_logs(museum_id,user_id'), 'audit_logs(museum_id, actor_user_id', 'audit_logs(museum_id, user_id');
      if patched <> src then execute patched; end if;
    end loop;
  end
  $retarget$;
  alter table public.employees disable trigger protect_employee_module_profile;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  museum := public.current_user_museum_id();
  update public.profiles set museum_id = museum where id = employee_user;
  update public.employees set museum_id = museum where profile_id = employee_user;
  perform set_config('request.jwt.claim.sub', employee_user::text, true);
  if not public.has_permission('attendance.corrections.request') then raise exception 'EMPLOYEE_CANNOT_REQUEST'; end if;
  if public.has_permission('attendance.corrections.decide') then raise exception 'EMPLOYEE_CAN_DECIDE'; end if;
  select id into eid from public.employees where profile_id = employee_user and museum_id = museum and status = 'activo';
  insert into public.attendance_settings(museum_id, version, presence_required, updated_by)
  values (museum, 7, false, admin)
  on conflict (museum_id) do update set version = 7, presence_required = false;
  insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, expected_lunch_minutes, status, created_by)
  values (sid, museum, eid, start_at, end_at, 60, 'scheduled', admin);
  insert into public.attendance_attempts(id, museum_id, employee_id, shift_id, actor_user_id, requested_event, result)
  values ('c3c00000-0000-4000-8000-000000000001', museum, eid, sid, employee_user, 'clock_in', 'accepted'),
         ('c3c00000-0000-4000-8000-000000000002', museum, eid, sid, employee_user, 'clock_out', 'accepted');
  insert into public.attendance_events(id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by)
  values ('e3c00000-0000-4000-8000-000000000001', museum, eid, sid, 'c3c00000-0000-4000-8000-000000000001', 'clock_in', start_at, 'on_time', 1, admin),
         ('e3c00000-0000-4000-8000-000000000002', museum, eid, sid, 'c3c00000-0000-4000-8000-000000000002', 'clock_out', end_at + interval '30 minutes', 'overtime_pending', 1, admin);
  original_id := 'e3c00000-0000-4000-8000-000000000002';
  insert into public.employee_time_entries(museum_id, employee_id, clock_in, clock_out, source, sync_status, created_by)
  values (museum, eid, start_at, end_at + interval '30 minutes', 'instituva', 'not_configured', admin);
  if to_regclass('public.attendance_overtime_reviews') is not null then
    insert into public.attendance_overtime_reviews(museum_id, employee_id, shift_id, clock_out_event_id, additional_minutes, status)
    values (museum, eid, sid, original_id, 30, 'pending');
  end if;
  begin
    perform public.request_own_attendance_correction(sid, 'clock_out', end_at, 'no');
    raise exception 'SHORT_REASON';
  exception when sqlstate '22023' then null;
  end;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  begin
    perform public.request_own_attendance_correction(sid, 'clock_out', end_at, 'No es mi turno');
    raise exception 'OTHER_EMPLOYEE_REQUESTED';
  exception when sqlstate 'P0001' or sqlstate '42501' then null;
  end;
  perform set_config('request.jwt.claim.sub', employee_user::text, true);
  request_id := (public.request_own_attendance_correction(sid, 'clock_out', end_at, 'La salida fue a las cinco')->>'id')::uuid;
  begin
    perform public.request_own_attendance_correction(sid, 'clock_out', end_at, 'Otra solicitud igual');
    raise exception 'DUPLICATE_ALLOWED';
  exception when sqlstate '23505' then null;
  end;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  if public.has_permission('attendance.corrections.decide') then raise exception 'ADMIN_CAN_DECIDE'; end if;
  begin
    perform public.decide_attendance_correction(request_id, 'rejected', 'No');
    raise exception 'ADMIN_DECIDED';
  exception when sqlstate '42501' then null;
  end;
  update public.employees set access_profile = 'gerente_museografica' where profile_id = profile_user;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  if public.has_permission('attendance.corrections.decide') then raise exception 'MUSEUM_MANAGER_CAN_DECIDE'; end if;
  update public.employees set access_profile = 'gerente_administrativo' where profile_id = profile_user;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  if not public.has_permission('attendance.corrections.decide') then raise exception 'MANAGER_CANNOT_LIST'; end if;
  if jsonb_array_length(public.list_attendance_corrections()->'pending') < 1 then raise exception 'PENDING_MISSING'; end if;
  update public.employees set access_profile = 'director_ejecutivo' where profile_id = profile_user;
  if not public.has_permission('attendance.corrections.decide') then raise exception 'DIRECTOR_DENIED'; end if;
  select count(*) into before_events from public.attendance_events e where e.shift_id = sid;
  perform public.decide_attendance_correction(request_id, 'approved', 'La salida correcta es el fin del turno');
  if (select status from public.attendance_correction_requests where id = request_id) <> 'approved' then raise exception 'NOT_APPROVED'; end if;
  if (select occurred_at from public.attendance_events where id = original_id) <> end_at + interval '30 minutes' then raise exception 'ORIGINAL_CHANGED'; end if;
  select corrected_event_id into corrected_id from public.attendance_correction_requests where id = request_id;
  if (select supersedes_event_id from public.attendance_events where id = corrected_id) <> original_id then raise exception 'SUPERSEDE_MISSING'; end if;
  if (select settings_version from public.attendance_events where id = corrected_id) <> 7 then raise exception 'SETTINGS_VERSION_ARBITRARY'; end if;
  if (select correction_request_id from public.attendance_events where id = corrected_id) <> request_id then raise exception 'REQUEST_LINK_MISSING'; end if;
  if (select t.clock_out from public.employee_time_entries t where t.employee_id = eid and t.clock_in = start_at) <> end_at then raise exception 'TIME_ENTRY_NOT_RECONCILED'; end if;
  select count(*) into after_events from public.attendance_events e where e.shift_id = sid;
  if after_events <> before_events + 1 then raise exception 'EVENT_COUNT'; end if;
  if to_regclass('public.attendance_overtime_reviews') is not null then
    if (select r.status from public.attendance_overtime_reviews r where r.shift_id = sid) <> 'cancelled_by_correction' then raise exception 'OVERTIME_NOT_CANCELLED'; end if;
  end if;
  begin
    perform public.decide_attendance_correction(request_id, 'rejected', 'Tarde');
    raise exception 'SECOND_DECISION';
  exception when sqlstate 'P0001' then null;
  end;
  if to_regclass('public.finance_records') is not null then
    select count(*) into finance_after from public.finance_records;
    if finance_before <> finance_after then raise exception 'PAYROLL_CHANGED'; end if;
  end if;
  if to_regclass('public.attendance_incidents') is not null then
    if (select count(*) from public.attendance_incidents i where i.employee_id = eid) <> 0 then raise exception 'INCIDENT_CREATED'; end if;
  end if;
  if (select a.user_id from public.audit_logs a where a.record_id = request_id and a.action = 'ATTENDANCE_CORRECTION_REQUESTED') <> employee_user then
    raise exception 'REQUEST_AUDIT_ACTOR';
  end if;
  if (select a.user_id from public.audit_logs a where a.record_id = request_id and a.action = 'ATTENDANCE_CORRECTION_APPROVED') <> profile_user then
    raise exception 'APPROVAL_AUDIT_ACTOR';
  end if;
  perform set_config('request.jwt.claim.sub', employee_user::text, true);
  request_id := (public.request_own_attendance_correction(sid, 'lunch_in', start_at + interval '5 hours', 'Falto el regreso')->>'id')::uuid;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  begin
    perform public.decide_attendance_correction(request_id, 'approved', 'Secuencia mala');
    raise exception 'BAD_SEQUENCE_APPROVED';
  exception when sqlstate '22023' then null;
  end;
  if (select status from public.attendance_correction_requests where id = request_id) <> 'pending' then raise exception 'BAD_SEQUENCE_WROTE'; end if;

  perform set_config('request.jwt.claim.sub', admin::text, true);
  update public.employees set access_profile = 'administrador_general' where profile_id = admin and museum_id = public.current_user_museum_id();
  if public.has_permission('attendance.corrections.decide') then raise exception 'GENERAL_ADMIN_CAN_DECIDE'; end if;
  if exists (select 1 from public.employee_module_profiles where code = 'supervisor') then
    update public.employees set access_profile = 'supervisor' where profile_id = profile_user;
    perform set_config('request.jwt.claim.sub', profile_user::text, true);
    if public.has_permission('attendance.corrections.decide') then raise exception 'SUPERVISOR_CAN_DECIDE'; end if;
  end if;
  if exists (select 1 from public.employee_module_profiles where code in ('recursos_humanos','recursos humanos')) then
    update public.employees set access_profile = (select code from public.employee_module_profiles where code in ('recursos_humanos','recursos humanos') limit 1) where profile_id = profile_user;
    perform set_config('request.jwt.claim.sub', profile_user::text, true);
    if public.has_permission('attendance.corrections.decide') then raise exception 'HR_CAN_DECIDE'; end if;
  end if;

  update public.employees set access_profile = 'gerente_administrativo' where profile_id = profile_user;
  select e.id into decider_employee from public.employees e where e.profile_id = profile_user and e.museum_id = museum and e.status = 'activo';
  insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, expected_lunch_minutes, status, created_by)
  values (self_shift, museum, decider_employee, start_at, end_at, 0, 'scheduled', admin);
  insert into public.attendance_attempts(id, museum_id, employee_id, shift_id, actor_user_id, requested_event, result)
  values ('c3c00000-0000-4000-8000-000000000010', museum, decider_employee, self_shift, profile_user, 'clock_in', 'accepted');
  insert into public.attendance_events(id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by)
  values ('e3c00000-0000-4000-8000-000000000010', museum, decider_employee, self_shift, 'c3c00000-0000-4000-8000-000000000010', 'clock_in', start_at, 'on_time', 1, admin);
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  self_request := (public.request_own_attendance_correction(self_shift, 'clock_in', start_at + interval '10 minutes', 'Llegue diez minutos tarde')->>'id')::uuid;
  begin
    perform public.decide_attendance_correction(self_request, 'approved', 'No debe autoaprobarse');
    raise exception 'SELF_APPROVED';
  exception when sqlstate '42501' then null;
  end;
  if (select status from public.attendance_correction_requests where id = self_request) <> 'pending' then raise exception 'SELF_APPROVAL_WROTE'; end if;

  perform set_config('request.jwt.claim.sub', employee_user::text, true);
  reject_request := (public.request_own_attendance_correction(sid, 'lunch_out', start_at + interval '4 hours', 'Salida a almuerzo omitida')->>'id')::uuid;
  select count(*) into events_before_reject from public.attendance_events e where e.shift_id = sid;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  perform public.decide_attendance_correction(reject_request, 'rejected', 'El horario no corresponde');
  if (select status from public.attendance_correction_requests where id = reject_request) <> 'rejected' then raise exception 'NOT_REJECTED'; end if;
  if (select count(*) from public.attendance_events e where e.shift_id = sid) <> events_before_reject then raise exception 'REJECT_CREATED_EVENT'; end if;
  if (select a.user_id from public.audit_logs a where a.record_id = reject_request and a.action = 'ATTENDANCE_CORRECTION_REJECTED') <> profile_user then raise exception 'REJECT_AUDIT_ACTOR'; end if;

  perform set_config('request.jwt.claim.sub', employee_user::text, true);
  insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, expected_lunch_minutes, status, created_by)
  values (add_shift, museum, eid, start_at - interval '1 day', end_at - interval '1 day', 30, 'scheduled', admin);
  add_request := (public.request_own_attendance_correction(add_shift, 'clock_in', start_at - interval '1 day', 'Falto la entrada')->>'id')::uuid;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  perform public.decide_attendance_correction(add_request, 'approved', 'Se agrega la entrada');
  if not exists (select 1 from public.attendance_events e where e.shift_id = add_shift and e.event_type = 'clock_in' and e.correction_request_id = add_request and e.supersedes_event_id is null) then
    raise exception 'MISSING_CLOCK_IN_NOT_ADDED';
  end if;
  if (select count(*) from public.employee_time_entries t where t.employee_id = eid and t.clock_in = start_at - interval '1 day') <> 1 then raise exception 'MISSING_CLOCK_IN_ENTRY'; end if;
  perform set_config('request.jwt.claim.sub', employee_user::text, true);
  add_request := (public.request_own_attendance_correction(add_shift, 'lunch_out', start_at - interval '1 day' + interval '4 hours', 'Falto salida a almuerzo')->>'id')::uuid;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  perform public.decide_attendance_correction(add_request, 'approved', 'Se agrega almuerzo');
  perform set_config('request.jwt.claim.sub', employee_user::text, true);
  add_request := (public.request_own_attendance_correction(add_shift, 'lunch_in', start_at - interval '1 day' + interval '4 hours 30 minutes', 'Falto el regreso')->>'id')::uuid;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  perform public.decide_attendance_correction(add_request, 'approved', 'Se agrega el regreso');
  perform set_config('request.jwt.claim.sub', employee_user::text, true);
  add_request := (public.request_own_attendance_correction(add_shift, 'clock_out', end_at - interval '1 day', 'Falto la salida')->>'id')::uuid;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  perform public.decide_attendance_correction(add_request, 'approved', 'Se agrega la salida');
  if (select count(*) from public.attendance_events e where e.shift_id = add_shift and e.correction_request_id is not null) <> 4 then raise exception 'MISSING_PUNCHES_INCOMPLETE'; end if;
  perform set_config('request.jwt.claim.sub', employee_user::text, true);
  add_request := (public.request_own_attendance_correction(add_shift, 'clock_in', start_at - interval '1 day' + interval '5 minutes', 'La entrada fue cinco minutos despues')->>'id')::uuid;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  perform public.decide_attendance_correction(add_request, 'approved', 'Se corrige la entrada');
  if (select e.supersedes_event_id from public.attendance_events e where e.correction_request_id = add_request) is null then raise exception 'CLOCK_IN_SUPERSEDE_MISSING'; end if;
  perform set_config('request.jwt.claim.sub', employee_user::text, true);
  add_request := (public.request_own_attendance_correction(add_shift, 'lunch_out', start_at - interval '1 day' + interval '4 hours 10 minutes', 'El almuerzo empezo despues')->>'id')::uuid;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  perform public.decide_attendance_correction(add_request, 'approved', 'Se corrige la salida a almuerzo');
  perform set_config('request.jwt.claim.sub', employee_user::text, true);
  add_request := (public.request_own_attendance_correction(add_shift, 'lunch_in', start_at - interval '1 day' + interval '4 hours 40 minutes', 'El regreso fue despues')->>'id')::uuid;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  perform public.decide_attendance_correction(add_request, 'approved', 'Se corrige el regreso de almuerzo');

  if to_regclass('public.attendance_overtime_reviews') is not null then
    insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, expected_lunch_minutes, status, created_by)
    values (ot_shift, museum, eid, start_at - interval '2 days', end_at - interval '2 days', 0, 'scheduled', admin);
    insert into public.attendance_attempts(id, museum_id, employee_id, shift_id, actor_user_id, requested_event, result)
    values ('c3c00000-0000-4000-8000-000000000030', museum, eid, ot_shift, employee_user, 'clock_in', 'accepted'),
           ('c3c00000-0000-4000-8000-000000000031', museum, eid, ot_shift, employee_user, 'clock_out', 'accepted');
    insert into public.attendance_events(id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by)
    values ('e3c00000-0000-4000-8000-000000000030', museum, eid, ot_shift, 'c3c00000-0000-4000-8000-000000000030', 'clock_in', start_at - interval '2 days', 'on_time', 1, admin),
           ('e3c00000-0000-4000-8000-000000000031', museum, eid, ot_shift, 'c3c00000-0000-4000-8000-000000000031', 'clock_out', end_at - interval '2 days', 'standard', 1, admin);
    insert into public.employee_time_entries(museum_id, employee_id, clock_in, clock_out, source, sync_status, created_by)
    values (museum, eid, start_at - interval '2 days', end_at - interval '2 days', 'instituva', 'not_configured', admin);
    perform set_config('request.jwt.claim.sub', employee_user::text, true);
    ot_request := (public.request_own_attendance_correction(ot_shift, 'clock_out', end_at - interval '2 days' + interval '30 minutes', 'Salida real treinta minutos despues')->>'id')::uuid;
    perform set_config('request.jwt.claim.sub', profile_user::text, true);
    perform public.decide_attendance_correction(ot_request, 'approved', 'La salida extendida queda pendiente de horas extra');
    if (select r.status from public.attendance_overtime_reviews r where r.shift_id = ot_shift) <> 'pending' then raise exception 'OVERTIME_NOT_OPENED_PENDING'; end if;
    if (select r.additional_minutes from public.attendance_overtime_reviews r where r.shift_id = ot_shift) <> 30 then raise exception 'OVERTIME_MINUTES'; end if;
    if (select a.user_id from public.audit_logs a where a.record_id = ot_shift and a.action = 'OVERTIME_REVIEW_OPENED_BY_CORRECTION') <> profile_user then raise exception 'OVERTIME_AUDIT_ACTOR'; end if;

    insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, expected_lunch_minutes, status, created_by)
    values (block_shift, museum, eid, start_at - interval '3 days', end_at - interval '3 days', 0, 'scheduled', admin);
    insert into public.attendance_attempts(id, museum_id, employee_id, shift_id, actor_user_id, requested_event, result)
    values ('c3c00000-0000-4000-8000-000000000040', museum, eid, block_shift, employee_user, 'clock_in', 'accepted'),
           ('c3c00000-0000-4000-8000-000000000041', museum, eid, block_shift, employee_user, 'clock_out', 'accepted');
    insert into public.attendance_events(id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by)
    values ('e3c00000-0000-4000-8000-000000000040', museum, eid, block_shift, 'c3c00000-0000-4000-8000-000000000040', 'clock_in', start_at - interval '3 days', 'on_time', 1, admin),
           ('e3c00000-0000-4000-8000-000000000041', museum, eid, block_shift, 'c3c00000-0000-4000-8000-000000000041', 'clock_out', end_at - interval '3 days' + interval '30 minutes', 'overtime_pending', 1, admin);
    insert into public.employee_time_entries(museum_id, employee_id, clock_in, clock_out, source, sync_status, created_by)
    values (museum, eid, start_at - interval '3 days', end_at - interval '3 days' + interval '30 minutes', 'instituva', 'not_configured', admin);
    insert into public.attendance_overtime_reviews(museum_id, employee_id, shift_id, clock_out_event_id, additional_minutes, status, approved_minutes, decided_by, decided_at, decision_reason)
    values (museum, eid, block_shift, 'e3c00000-0000-4000-8000-000000000041', 30, 'approved', 30, admin, now(), 'Ya aprobado');
    perform set_config('request.jwt.claim.sub', employee_user::text, true);
    block_request := (public.request_own_attendance_correction(block_shift, 'clock_out', end_at - interval '3 days', 'Quiero anular el tiempo extra ya aprobado')->>'id')::uuid;
    perform set_config('request.jwt.claim.sub', profile_user::text, true);
    begin
      perform public.decide_attendance_correction(block_request, 'approved', 'No debe cambiar overtime cerrado');
      raise exception 'APPROVED_OVERTIME_CHANGED';
    exception when sqlstate 'P0001' then null;
    end;
    if (select status from public.attendance_correction_requests where id = block_request) <> 'pending' then raise exception 'BLOCKED_REQUEST_CHANGED'; end if;
    if (select r.status from public.attendance_overtime_reviews r where r.shift_id = block_shift) <> 'approved' then raise exception 'APPROVED_OVERTIME_MUTATED'; end if;
    update public.attendance_overtime_reviews set status = 'partially_approved', approved_minutes = 15 where shift_id = block_shift;
    begin
      perform public.decide_attendance_correction(block_request, 'approved', 'No debe cambiar overtime parcial');
      raise exception 'PARTIAL_OVERTIME_CHANGED';
    exception when sqlstate 'P0001' then null;
    end;
    update public.attendance_overtime_reviews set status = 'rejected', approved_minutes = 0 where shift_id = block_shift;
    begin
      perform public.decide_attendance_correction(block_request, 'approved', 'No debe cambiar overtime rechazado');
      raise exception 'REJECTED_OVERTIME_CHANGED';
    exception when sqlstate 'P0001' then null;
    end;
    if (select status from public.attendance_correction_requests where id = block_request) <> 'pending' then raise exception 'REJECTED_OVERTIME_REQUEST_CHANGED'; end if;
  end if;

  perform set_config('request.jwt.claim.sub', '6bed20b8-9bea-4dbf-9dab-0998051d2a71', true);
  begin
    perform public.decide_attendance_correction(request_id, 'rejected', 'Otro museo');
    raise exception 'OTHER_MUSEUM_DECIDED';
  exception when sqlstate '42501' or sqlstate 'P0001' then null;
  end;

  if to_regclass('public.attendance_operational_alerts') is not null then
    perform public.reconcile_shift_attendance_alerts(sid);
    select count(*) into alert_count from public.attendance_operational_alerts a where a.shift_id = sid;
    perform public.reconcile_shift_attendance_alerts(sid);
    if (select count(*) from public.attendance_operational_alerts a where a.shift_id = sid) <> alert_count then raise exception 'ALERTS_DUPLICATED'; end if;
  end if;

  perform set_config('request.jwt.claim.sub', employee_user::text, true);
  insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, expected_lunch_minutes, status, created_by)
  values ('b3c00000-0000-4000-8000-000000000050', museum, eid, start_at - interval '5 days', end_at - interval '5 days', 0, 'scheduled', admin);
  insert into public.attendance_attempts(id, museum_id, employee_id, shift_id, actor_user_id, requested_event, result)
  values ('c3c00000-0000-4000-8000-000000000050', museum, eid, 'b3c00000-0000-4000-8000-000000000050', employee_user, 'clock_in', 'accepted'),
         ('c3c00000-0000-4000-8000-000000000051', museum, eid, 'b3c00000-0000-4000-8000-000000000050', employee_user, 'clock_out', 'accepted');
  insert into public.attendance_events(id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by)
  values ('e3c00000-0000-4000-8000-000000000050', museum, eid, 'b3c00000-0000-4000-8000-000000000050', 'c3c00000-0000-4000-8000-000000000050', 'clock_in', start_at - interval '5 days', 'on_time', 7, admin),
         ('e3c00000-0000-4000-8000-000000000051', museum, eid, 'b3c00000-0000-4000-8000-000000000050', 'c3c00000-0000-4000-8000-000000000051', 'clock_out', end_at - interval '5 days', 'standard', 7, admin);
  insert into public.employee_time_entries(museum_id, employee_id, clock_in, clock_out, source, sync_status, created_by)
  values (museum, eid, start_at - interval '5 days', end_at - interval '5 days', 'instituva', 'not_configured', admin),
         (museum, eid, start_at - interval '5 days', end_at - interval '5 days', 'instituva', 'not_configured', admin);
  request_id := (public.request_own_attendance_correction('b3c00000-0000-4000-8000-000000000050', 'clock_out', end_at - interval '5 days' + interval '10 minutes', 'Salida ambigua')->>'id')::uuid;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  begin
    perform public.decide_attendance_correction(request_id, 'approved', 'No debe elegir un registro');
    raise exception 'AMBIGUOUS_ENTRY_APPROVED';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%TIME_ENTRY_AMBIGUOUS%' then raise; end if;
  end;
  if (select status from public.attendance_correction_requests where id = request_id) <> 'pending' then raise exception 'AMBIGUOUS_REQUEST_CHANGED'; end if;
  if (select count(*) from public.employee_time_entries t where t.employee_id = eid and t.clock_in = start_at - interval '5 days' and t.clock_out = end_at - interval '5 days') <> 2 then raise exception 'AMBIGUOUS_ROWS_CHANGED'; end if;

  perform set_config('request.jwt.claim.sub', employee_user::text, true);
  insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, expected_lunch_minutes, status, created_by)
  values ('b3c00000-0000-4000-8000-000000000060', museum, eid, start_at - interval '6 days', end_at - interval '6 days', 0, 'scheduled', admin);
  insert into public.attendance_attempts(id, museum_id, employee_id, shift_id, actor_user_id, requested_event, result)
  values ('c3c00000-0000-4000-8000-000000000060', museum, eid, 'b3c00000-0000-4000-8000-000000000060', employee_user, 'clock_in', 'accepted'),
         ('c3c00000-0000-4000-8000-000000000061', museum, eid, 'b3c00000-0000-4000-8000-000000000060', employee_user, 'clock_out', 'accepted');
  insert into public.attendance_events(id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by)
  values ('e3c00000-0000-4000-8000-000000000060', museum, eid, 'b3c00000-0000-4000-8000-000000000060', 'c3c00000-0000-4000-8000-000000000060', 'clock_in', start_at - interval '6 days', 'on_time', 7, admin),
         ('e3c00000-0000-4000-8000-000000000061', museum, eid, 'b3c00000-0000-4000-8000-000000000060', 'c3c00000-0000-4000-8000-000000000061', 'clock_out', end_at - interval '6 days', 'standard', 7, admin);
  request_id := (public.request_own_attendance_correction('b3c00000-0000-4000-8000-000000000060', 'clock_out', end_at - interval '6 days' + interval '10 minutes', 'Sin registro de tiempo')->>'id')::uuid;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  begin
    perform public.decide_attendance_correction(request_id, 'approved', 'No debe inventar el registro');
    raise exception 'MISSING_ENTRY_APPROVED';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%TIME_ENTRY_NOT_RECONCILABLE%' then raise; end if;
  end;
  if (select status from public.attendance_correction_requests where id = request_id) <> 'pending' then raise exception 'MISSING_ENTRY_REQUEST_CHANGED'; end if;
  if exists (select 1 from public.employee_time_entries t where t.employee_id = eid and t.clock_in = start_at - interval '6 days') then raise exception 'MISSING_ENTRY_CREATED'; end if;

  if (select t.clock_out from public.employee_time_entries t where t.employee_id = eid and t.clock_in = start_at) <> end_at then raise exception 'OTHER_SHIFT_ENTRY_CHANGED'; end if;

  perform set_config('request.jwt.claim.sub', employee_user::text, true);
  insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, expected_lunch_minutes, status, created_by)
  values ('b3c00000-0000-4000-8000-000000000070', museum, eid, start_at - interval '7 days', end_at - interval '7 days', 0, 'scheduled', admin);
  insert into public.attendance_attempts(id, museum_id, employee_id, shift_id, actor_user_id, requested_event, result)
  values ('c3c00000-0000-4000-8000-000000000070', museum, eid, 'b3c00000-0000-4000-8000-000000000070', employee_user, 'clock_in', 'accepted');
  insert into public.attendance_events(id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by)
  values ('e3c00000-0000-4000-8000-000000000070', museum, eid, 'b3c00000-0000-4000-8000-000000000070', 'c3c00000-0000-4000-8000-000000000070', 'clock_in', start_at - interval '7 days', 'on_time', 7, admin);
  insert into public.employee_time_entries(museum_id, employee_id, clock_in, clock_out, source, sync_status, created_by)
  values (museum, eid, start_at - interval '7 days', null, 'instituva', 'not_configured', admin);
  request_id := (public.request_own_attendance_correction('b3c00000-0000-4000-8000-000000000070', 'clock_in', start_at - interval '7 days' + interval '5 minutes', 'Entrada para fallo de auditoria')->>'id')::uuid;
  create or replace function public.fail_correction_audit_test()
  returns trigger language plpgsql as $fail$
  begin
    if new.action = 'ATTENDANCE_CORRECTION_APPROVED' then
      raise exception 'AUDIT_FORCED_FAILURE' using errcode = 'P0001';
    end if;
    return new;
  end $fail$;
  create trigger fail_correction_audit_test before insert on public.audit_logs
  for each row execute function public.fail_correction_audit_test();
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  begin
    perform public.decide_attendance_correction(request_id, 'approved', 'Esta auditoria debe fallar');
    raise exception 'AUDIT_FAILURE_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%AUDIT_FORCED_FAILURE%' then raise; end if;
  end;
  if (select status from public.attendance_correction_requests where id = request_id) <> 'pending' then raise exception 'AUDIT_FAILURE_COMMITTED'; end if;
  if exists (select 1 from public.attendance_events e where e.correction_request_id = request_id) then raise exception 'AUDIT_FAILURE_CREATED_EVENT'; end if;
  if (select t.clock_in from public.employee_time_entries t where t.employee_id = eid and t.clock_out is null and t.clock_in = start_at - interval '7 days') <> start_at - interval '7 days' then raise exception 'AUDIT_FAILURE_CHANGED_TIME'; end if;

  raise notice 'ATTENDANCE_CORRECTIONS_OK';
end
$test$;
