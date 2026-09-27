-- Exclusion and restoration. Run inside a transaction and roll it back.
-- Uses disposable 1–4 September 2026 shifts so the 24 and 25 September rows stay untouched.

begin;

do $exclusions$
declare
  actor uuid;
  museum uuid;
  manager uuid;
  subject uuid;
  subject_user uuid;
  other_user uuid;
  other_museum uuid := 'e2700000-0000-4000-8000-0000000000aa';
  full_shift uuid := 'e2700000-0000-4000-8000-000000000001';
  ot_shift uuid := 'e2700000-0000-4000-8000-000000000002';
  open_shift uuid := 'e2700000-0000-4000-8000-000000000003';
  pending_shift uuid := 'e2700000-0000-4000-8000-000000000004';
  foreign_shift uuid := 'e2700000-0000-4000-8000-000000000005';
  day date := date '2026-09-01';
  start_at timestamptz := (date '2026-09-01' + time '08:00') at time zone 'America/Puerto_Rico';
  end_at timestamptz := (date '2026-09-01' + time '17:00') at time zone 'America/Puerto_Rico';
  threshold integer := 0;
  clock_out_at timestamptz;
  clock_in_id uuid := 'e2700000-0000-4000-8000-000000000011';
  lunch_out_id uuid := 'e2700000-0000-4000-8000-000000000012';
  lunch_in_id uuid := 'e2700000-0000-4000-8000-000000000013';
  clock_out_id uuid := 'e2700000-0000-4000-8000-000000000014';
  ot_in uuid := 'e2700000-0000-4000-8000-000000000021';
  ot_out uuid := 'e2700000-0000-4000-8000-000000000022';
  open_in uuid := 'e2700000-0000-4000-8000-000000000031';
  events_before integer;
  events_after integer;
  rows_before integer;
  history jsonb;
  day_row jsonb;
  day_minutes integer;
  employee_before integer;
  employee_after integer;
  summed integer;
  entry uuid;
  open_entry uuid;
begin
  alter table public.employees disable trigger protect_employee_module_profile;
  select e.profile_id, e.museum_id, e.id into actor, museum, manager
    from public.employees e
    join public.profiles p on p.id = e.profile_id
   where e.status = 'activo' and p.status in ('active','activo')
   order by e.created_at
   limit 1;
  select e.id, e.profile_id into subject, subject_user
    from public.employees e
   where e.museum_id = museum and e.status = 'activo' and e.profile_id is not null and e.profile_id <> actor
     and not exists (
       select 1 from public.employee_time_entries t
       where t.employee_id = e.id and t.clock_out is null and t.excluded_at is null
     )
   limit 1;
  if subject is null then raise exception 'NEED_SECOND_EMPLOYEE'; end if;
  insert into public.attendance_settings(museum_id, version, overtime_review_threshold_minutes)
  values (museum, 1, 0)
  on conflict (museum_id) do nothing;
  select coalesce(overtime_review_threshold_minutes, 0) into threshold
    from public.attendance_settings where museum_id = museum;
  clock_out_at := end_at + make_interval(mins => threshold + 10);
  update public.employees set access_profile = 'gerente_administrativo' where id = manager;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  if not public.has_permission('attendance.exclusions.manage') then raise exception 'MANAGER_DENIED'; end if;
  update public.employees set access_profile = 'director_ejecutivo' where id = manager;
  if not public.has_permission('attendance.exclusions.manage') then raise exception 'DIRECTOR_DENIED'; end if;
  update public.employees set access_profile = 'administrador_general' where id = manager;
  if public.has_permission('attendance.exclusions.manage') then raise exception 'GENERAL_ALLOWED'; end if;
  update public.employees set access_profile = 'asistente_administrativa' where id = manager;
  if public.has_permission('attendance.exclusions.manage') then raise exception 'ASSISTANT_ALLOWED'; end if;
  update public.employees set access_profile = 'it_programador' where id = manager;
  if public.has_permission('attendance.exclusions.manage') then raise exception 'IT_ALLOWED'; end if;
  update public.employees set access_profile = 'gerente_administrativo' where id = manager;
  insert into public.user_permissions(user_id, museum_id, permission_id, effect)
  select actor, museum, id, 'deny' from public.permissions where code = 'attendance.exclusions.manage';
  if public.has_permission('attendance.exclusions.manage') then raise exception 'DENY_IGNORED'; end if;
  delete from public.user_permissions where user_id = actor and museum_id = museum
    and permission_id = (select id from public.permissions where code = 'attendance.exclusions.manage');
  if not public.has_permission('attendance.exclusions.manage') then raise exception 'DENY_STUCK'; end if;

  insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, created_by)
  values
    (full_shift, museum, subject, start_at, end_at, actor),
    (ot_shift, museum, subject, start_at + interval '1 day', end_at + interval '1 day', actor),
    (open_shift, museum, subject, start_at + interval '2 day', end_at + interval '2 day', actor),
    (pending_shift, museum, subject, start_at + interval '3 day', end_at + interval '3 day', actor);
  insert into public.attendance_attempts(id, museum_id, employee_id, shift_id, actor_user_id, requested_event, result)
  values
    ('e2700000-0000-4000-8000-000000000111', museum, subject, full_shift, actor, 'clock_in', 'accepted'),
    ('e2700000-0000-4000-8000-000000000112', museum, subject, full_shift, actor, 'lunch_out', 'accepted'),
    ('e2700000-0000-4000-8000-000000000113', museum, subject, full_shift, actor, 'lunch_in', 'accepted'),
    ('e2700000-0000-4000-8000-000000000114', museum, subject, full_shift, actor, 'clock_out', 'accepted'),
    ('e2700000-0000-4000-8000-000000000121', museum, subject, ot_shift, actor, 'clock_in', 'accepted'),
    ('e2700000-0000-4000-8000-000000000122', museum, subject, ot_shift, actor, 'clock_out', 'accepted'),
    ('e2700000-0000-4000-8000-000000000131', museum, subject, open_shift, actor, 'clock_in', 'accepted'),
    ('e2700000-0000-4000-8000-000000000141', museum, subject, pending_shift, actor, 'clock_in', 'accepted'),
    ('e2700000-0000-4000-8000-000000000142', museum, subject, pending_shift, actor, 'clock_out', 'accepted');
  insert into public.attendance_events(id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by)
  values
    (clock_in_id, museum, subject, full_shift, 'e2700000-0000-4000-8000-000000000111', 'clock_in', start_at, 'on_time', 1, subject_user),
    (lunch_out_id, museum, subject, full_shift, 'e2700000-0000-4000-8000-000000000112', 'lunch_out', start_at + interval '4 hours', 'standard', 1, subject_user),
    (lunch_in_id, museum, subject, full_shift, 'e2700000-0000-4000-8000-000000000113', 'lunch_in', start_at + interval '5 hours', 'standard', 1, subject_user),
    (clock_out_id, museum, subject, full_shift, 'e2700000-0000-4000-8000-000000000114', 'clock_out', end_at, 'standard', 1, subject_user),
    (ot_in, museum, subject, ot_shift, 'e2700000-0000-4000-8000-000000000121', 'clock_in', start_at + interval '1 day', 'on_time', 1, subject_user),
    (ot_out, museum, subject, ot_shift, 'e2700000-0000-4000-8000-000000000122', 'clock_out', clock_out_at + interval '1 day', 'overtime_pending', 1, subject_user),
    (open_in, museum, subject, open_shift, 'e2700000-0000-4000-8000-000000000131', 'clock_in', start_at + interval '2 day', 'on_time', 1, subject_user),
    ('e2700000-0000-4000-8000-000000000041', museum, subject, pending_shift, 'e2700000-0000-4000-8000-000000000141', 'clock_in', start_at + interval '3 day', 'on_time', 1, subject_user),
    ('e2700000-0000-4000-8000-000000000042', museum, subject, pending_shift, 'e2700000-0000-4000-8000-000000000142', 'clock_out', end_at + interval '3 day', 'standard', 1, subject_user);
  insert into public.employee_time_entries(museum_id, employee_id, clock_in, clock_out, source, sync_status, created_by)
  values
    (museum, subject, start_at, end_at, 'instituva', 'not_configured', actor),
    (museum, subject, start_at + interval '1 day', clock_out_at + interval '1 day', 'instituva', 'not_configured', actor),
    (museum, subject, start_at + interval '2 day', null, 'instituva', 'not_configured', actor),
    (museum, subject, start_at + interval '3 day', end_at + interval '3 day', 'instituva', 'not_configured', actor);
  insert into public.attendance_overtime_reviews(museum_id, employee_id, shift_id, clock_out_event_id, additional_minutes)
  values (museum, subject, ot_shift, ot_out, threshold + 10);

  select count(*) into events_before from public.attendance_events where shift_id = full_shift;
  begin
    perform public.set_attendance_exclusion(full_shift, clock_in_id, 'exclude', 'system_test', null);
    raise exception 'SEQUENCE_ALLOWED';
  exception when sqlstate '22023' then
    if sqlerrm <> 'INVALID_EXCLUSION_SEQUENCE' then raise; end if;
  end;
  if exists (select 1 from public.attendance_exclusions where shift_id = full_shift) then raise exception 'SEQUENCE_WROTE'; end if;

  begin
    perform public.set_attendance_exclusion(full_shift, null, 'exclude', 'other', '   ');
    raise exception 'OTHER_ALLOWED';
  exception when sqlstate '22023' then
    if sqlerrm <> 'EXPLANATION_REQUIRED' then raise; end if;
  end;

  history := public.list_attendance_history(day, day + 3);
  select coalesce((item->>'regular_minutes')::integer, 0) into day_minutes
    from jsonb_array_elements(history->'employees') emp,
         jsonb_array_elements(emp->'days') item
   where item->>'shift_id' = full_shift::text;
  if day_minutes is null or day_minutes <= 0 then raise exception 'HISTORY_BEFORE_EMPTY'; end if;
  select coalesce((emp->>'regular_minutes')::integer, 0) into employee_before
    from jsonb_array_elements(history->'employees') emp
   where emp->>'employee_id' = subject::text;

  if to_regclass('public.attendance_operational_alerts') is not null then
    insert into public.attendance_operational_alerts(museum_id, employee_id, shift_id, alert_date, alert_type, status)
    values (museum, subject, full_shift, day, 'late', 'active');
  end if;

  perform public.set_attendance_exclusion(full_shift, null, 'exclude', 'system_test', null);
  if (select count(*) from public.attendance_exclusions where shift_id = full_shift) <> 1 then raise exception 'SHIFT_NOT_ATOMIC'; end if;
  if (select scope from public.attendance_exclusions where shift_id = full_shift) <> 'shift' then raise exception 'SHIFT_SCOPE'; end if;
  if not public.attendance_is_excluded(full_shift, clock_in_id) then raise exception 'SHIFT_STILL_COUNTS'; end if;
  if (select created_by from public.attendance_events where id = clock_in_id) <> subject_user then raise exception 'ACTOR_CHANGED'; end if;
  if (select occurred_at from public.attendance_events where id = clock_in_id) <> start_at then raise exception 'TIME_CHANGED'; end if;
  if exists (select 1 from public.attendance_events where supersedes_event_id = clock_in_id) then raise exception 'FAKE_EVENT'; end if;
  select count(*) into events_after from public.attendance_events where shift_id = full_shift;
  if events_after <> events_before then raise exception 'EVENTS_CHANGED'; end if;
  if (select excluded_at from public.employee_time_entries where employee_id = subject and clock_in = start_at) is null then
    raise exception 'PROJECTION_MISSING';
  end if;
  if to_regclass('public.attendance_operational_alerts') is not null
     and exists (select 1 from public.attendance_operational_alerts where shift_id = full_shift and status = 'active') then
    raise exception 'ALERT_STILL_ACTIVE';
  end if;

  history := public.list_attendance_history(day, day + 3);
  select item into day_row
    from jsonb_array_elements(history->'employees') emp,
         jsonb_array_elements(emp->'days') item
   where item->>'shift_id' = full_shift::text;
  if day_row is null then raise exception 'EXCLUDED_HIDDEN'; end if;
  if (day_row->>'regular_minutes')::integer <> 0 then raise exception 'EXCLUDED_DAY_SUMS'; end if;
  if coalesce(day_row->>'shift_excluded','') <> 'true' then raise exception 'EXCLUDED_FLAG'; end if;
  if day_row->>'clock_in' is null then raise exception 'ORIGINAL_TIME_HIDDEN'; end if;
  select coalesce((emp->>'regular_minutes')::integer, 0) into employee_after
    from jsonb_array_elements(history->'employees') emp
   where emp->>'employee_id' = subject::text;
  select coalesce(sum((item->>'regular_minutes')::integer), 0) into summed
    from jsonb_array_elements(history->'employees') emp,
         jsonb_array_elements(emp->'days') item
   where emp->>'employee_id' = subject::text;
  if employee_after <> employee_before - day_minutes then raise exception 'PERIOD_STILL_SUMS_EXCLUDED'; end if;
  if summed <> employee_after then raise exception 'PERIOD_TOTAL_MISMATCH'; end if;
  if exists (
    select 1
    from jsonb_array_elements(history->'employees') emp,
         jsonb_array_elements(emp->'days') item
    where item->>'shift_id' = full_shift::text
      and (item->>'regular_minutes')::integer <> 0
  ) then raise exception 'PERIOD_INCLUDES_EXCLUDED'; end if;

  perform public.set_attendance_exclusion(full_shift, null, 'restore', 'incorrect_admin_record', null);
  if (select count(*) from public.attendance_exclusions where shift_id = full_shift) <> 2 then raise exception 'RESTORE_ERASED'; end if;
  if public.attendance_is_excluded(full_shift, clock_in_id) then raise exception 'RESTORE_STILL_EXCLUDED'; end if;
  if (select excluded_at from public.employee_time_entries where employee_id = subject and clock_in = start_at) is not null then
    raise exception 'PROJECTION_NOT_CLEARED';
  end if;

  perform public.set_attendance_exclusion(ot_shift, ot_out, 'exclude', 'duplicate_punch', null);
  if (select status from public.attendance_overtime_reviews where shift_id = ot_shift) <> 'cancelled_by_exclusion' then
    raise exception 'OVERTIME_NOT_CANCELLED';
  end if;
  if (select excluded_at from public.employee_time_entries where employee_id = subject and clock_in = start_at + interval '1 day') is null then
    raise exception 'CLOCK_OUT_PROJECTION';
  end if;
  perform public.set_attendance_exclusion(ot_shift, ot_out, 'restore', 'mistaken_punch', null);
  if (select status from public.attendance_overtime_reviews where shift_id = ot_shift) <> 'pending' then raise exception 'OVERTIME_NOT_REOPENED'; end if;
  if (select decided_by from public.attendance_overtime_reviews where shift_id = ot_shift) is not null then raise exception 'OVERTIME_INHERITED_DECIDER'; end if;
  if (select approved_minutes from public.attendance_overtime_reviews where shift_id = ot_shift) is not null then raise exception 'OVERTIME_INHERITED_MINUTES'; end if;
  update public.attendance_overtime_reviews
     set status = 'approved', approved_minutes = 10, decided_by = actor, decided_at = now(), decision_reason = 'Decisión de prueba'
   where shift_id = ot_shift;
  begin
    perform public.set_attendance_exclusion(ot_shift, ot_out, 'exclude', 'system_test', null);
    raise exception 'DECIDED_OVERTIME_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'OVERTIME_DECISION_CONFLICT' then raise; end if;
  end;
  if (select status from public.attendance_overtime_reviews where shift_id = ot_shift) <> 'approved' then raise exception 'DECIDED_OVERTIME_MUTATED'; end if;

  select id into open_entry from public.employee_time_entries
   where employee_id = subject and clock_in = start_at + interval '2 day';
  perform public.set_attendance_exclusion(open_shift, open_in, 'exclude', 'system_test', null);
  if (select excluded_at from public.employee_time_entries where id = open_entry) is null then raise exception 'OPEN_PROJECTION'; end if;
  insert into public.employee_time_entries(museum_id, employee_id, clock_in, clock_out, source, sync_status, created_by)
  values (museum, subject, start_at + interval '2 day' + interval '3 hours', null, 'instituva', 'not_configured', actor)
  returning id into entry;
  begin
    perform public.set_attendance_exclusion(open_shift, open_in, 'restore', 'system_test', null);
    raise exception 'OPEN_CONFLICT_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'TIME_ENTRY_OPEN_CONFLICT' then raise; end if;
  end;
  if (select action from public.attendance_exclusions where shift_id = open_shift order by acted_at desc, id desc limit 1) <> 'exclude' then
    raise exception 'CONFLICT_WROTE';
  end if;
  if (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'employee_time_entries_one_open') not ilike '%excluded_at is null%' then
    raise exception 'OPEN_INDEX';
  end if;

  insert into public.attendance_correction_requests(
    museum_id, employee_id, shift_id, requested_event_type, requested_occurred_at, reason, requested_by
  ) values (
    museum, subject, pending_shift, 'clock_out', end_at + interval '3 day', 'Olvidé registrar la salida', subject_user
  );
  select count(*) into rows_before from public.attendance_exclusions where shift_id = pending_shift;
  begin
    perform public.set_attendance_exclusion(pending_shift, null, 'exclude', 'system_test', null);
    raise exception 'PENDING_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'PENDING_CORRECTION' then raise; end if;
  end;
  if (select count(*) from public.attendance_exclusions where shift_id = pending_shift) <> rows_before then raise exception 'PENDING_WROTE'; end if;

  perform public.set_attendance_exclusion(full_shift, null, 'exclude', 'system_test', 'Jornada de prueba controlada');
  if (
    select max(acted_at) filter (where action = 'exclude')
    from public.attendance_exclusions where shift_id = full_shift
  ) <= (
    select max(acted_at) filter (where action = 'restore')
    from public.attendance_exclusions where shift_id = full_shift
  ) then raise exception 'ACTED_AT_ORDER'; end if;
  if (select count(*) from public.attendance_exclusions where shift_id = full_shift) < 2 then
    raise exception 'RESTORE_HISTORY_MISSING';
  end if;
  begin
    perform public.correct_shift_attendance_punches(full_shift, 'missed_clock_in', null, manager, jsonb_build_array(jsonb_build_object(
      'event_type','clock_in','occurred_at', start_at + interval '5 minutes','expected_event_id', clock_in_id::text
    )));
    raise exception 'CORRECT_EXCLUDED_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'EXCLUSION_ACTIVE' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', subject_user::text, true);
  begin
    perform public.request_own_attendance_correction(full_shift, 'clock_out', end_at, 'Quiero corregir la salida');
    raise exception 'REQUEST_EXCLUDED_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'EXCLUSION_ACTIVE' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  insert into public.attendance_correction_requests(
    museum_id, employee_id, shift_id, original_event_id, requested_event_type, requested_occurred_at, reason, requested_by
  ) values (
    museum, subject, full_shift, clock_out_id, 'clock_out', end_at + interval '10 minutes', 'Solicitud posterior a la exclusión', subject_user
  );
  begin
    perform public.decide_attendance_correction((
      select id from public.attendance_correction_requests
      where shift_id = full_shift and status = 'pending' and requested_by = subject_user
      order by requested_at desc limit 1
    ), 'approved', 'No debe aprobarse');
    raise exception 'DECIDE_EXCLUDED_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'EXCLUSION_ACTIVE' then raise; end if;
  end;
  if (select status from public.attendance_correction_requests where shift_id = full_shift and requested_by = subject_user order by requested_at desc limit 1) <> 'pending' then
    raise exception 'APPROVAL_MUTATED_PENDING';
  end if;

  if to_regprocedure('public.decide_attendance_correction(uuid,uuid,uuid,text,text)') is not null then
    insert into public.user_permissions(user_id, museum_id, permission_id, effect)
    select actor, museum, id, 'allow' from public.permissions
     where code in ('attendance.corrections.approve', 'time.read.all');
    begin
      perform public.decide_attendance_correction(actor, museum, (
        select id from public.attendance_correction_requests
        where shift_id = full_shift and status = 'pending' and requested_by = subject_user
        order by requested_at desc limit 1
      ), 'approved', 'No debe aprobarse');
      raise exception 'LEGACY_DECIDE_ALLOWED';
    exception when sqlstate 'P0001' then
      if sqlerrm <> 'EXCLUSION_ACTIVE' then raise; end if;
    end;
    if (select status from public.attendance_correction_requests where shift_id = full_shift and requested_by = subject_user order by requested_at desc limit 1) <> 'pending' then
      raise exception 'LEGACY_APPROVAL_MUTATED';
    end if;
    perform public.decide_attendance_correction(actor, museum, (
      select id from public.attendance_correction_requests
      where shift_id = full_shift and status = 'pending' and requested_by = subject_user
      order by requested_at desc limit 1
    ), 'rejected', 'Rechazo permitido');
    if (select status from public.attendance_correction_requests where shift_id = full_shift and requested_by = subject_user order by requested_at desc limit 1) <> 'rejected' then
      raise exception 'LEGACY_REJECT_BLOCKED';
    end if;
    if not public.attendance_is_excluded(full_shift, null) then raise exception 'REJECT_CLEARED_EXCLUSION'; end if;
    if position('decision=''approved'' and (' in pg_get_functiondef('public.decide_attendance_correction(uuid,uuid,uuid,text,text)'::regprocedure)) = 0
       or position('EXCLUSION_ACTIVE' in pg_get_functiondef('public.decide_attendance_correction(uuid,uuid,uuid,text,text)'::regprocedure)) = 0 then
      raise exception 'DECIDE_GUARD_MISSING';
    end if;
  end if;

  if position('p_decision = ''approved'' and (' in pg_get_functiondef('public.decide_attendance_correction(uuid,text,text)'::regprocedure)) = 0
     or position('EXCLUSION_ACTIVE' in pg_get_functiondef('public.decide_attendance_correction(uuid,text,text)'::regprocedure)) = 0 then
    raise exception 'DECIDE_GUARD_MISSING';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'user_id'
  ) then
    insert into public.attendance_correction_requests(
      museum_id, employee_id, shift_id, original_event_id, requested_event_type, requested_occurred_at, reason, requested_by
    ) values (
      museum, subject, full_shift, clock_in_id, 'clock_in', start_at + interval '6 minutes', 'Segunda solicitud sobre excluido', subject_user
    );
    perform public.decide_attendance_correction((
      select id from public.attendance_correction_requests
      where shift_id = full_shift and status = 'pending' and requested_event_type = 'clock_in'
      order by requested_at desc limit 1
    ), 'rejected', 'Rechazo de tres argumentos');
    if (select status from public.attendance_correction_requests where shift_id = full_shift and requested_event_type = 'clock_in' and requested_by = subject_user order by requested_at desc limit 1) <> 'rejected' then
      raise exception 'SESSION_REJECT_BLOCKED';
    end if;
  end if;

  if exists (
    select 1
    from pg_proc a
    join pg_proc b on b.pronamespace = a.pronamespace and b.proname = a.proname and b.oid > a.oid
    join pg_namespace n on n.oid = a.pronamespace
    where n.nspname = 'public'
      and a.proname in ('decide_attendance_correction', 'set_attendance_exclusion')
      and a.proargnames && b.proargnames
  ) then raise exception 'POSTGREST_AMBIGUOUS'; end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'set_attendance_exclusion') <> 1 then
    raise exception 'EXCLUSION_RPC_OVERLOAD';
  end if;
  if position('excluded_at' in pg_get_functiondef('public.list_attendance_history(date,date)'::regprocedure)) > 0
     or position('attendance_is_excluded' in pg_get_functiondef('public.list_attendance_history(date,date)'::regprocedure)) = 0
     or position('excluded_at' in pg_get_functiondef('public.list_today_staff_status()'::regprocedure)) > 0
     or position('attendance_is_excluded' in pg_get_functiondef('public.sync_attendance_operational_alerts()'::regprocedure)) = 0
     or position('attendance_is_excluded' in pg_get_functiondef('public.reconcile_shift_attendance_alerts(uuid)'::regprocedure)) = 0 then
    raise exception 'EVENT_AUTHORITY_DRIFT';
  end if;

  insert into public.attendance_attempts(id, museum_id, employee_id, shift_id, actor_user_id, requested_event, result)
  values ('e2700000-0000-4000-8000-000000000123', museum, subject, ot_shift, actor, 'clock_out', 'accepted');
  insert into public.attendance_events(
    id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, supersedes_event_id, created_by
  ) values (
    'e2700000-0000-4000-8000-000000000023', museum, subject, ot_shift, 'e2700000-0000-4000-8000-000000000123',
    'clock_out', clock_out_at + interval '1 day', 'standard', 1, ot_out, actor
  );
  begin
    perform public.set_attendance_exclusion(ot_shift, ot_out, 'exclude', 'system_test', null);
    raise exception 'STALE_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'ATTENDANCE_CHANGED_RELOAD' then raise; end if;
  end;
  if position('for update' in pg_get_functiondef('public.set_attendance_exclusion(uuid,uuid,text,text,text)'::regprocedure)) = 0 then
    raise exception 'LOCK_MISSING';
  end if;
  if position('delete from public.attendance_events' in lower(pg_get_functiondef('public.set_attendance_exclusion(uuid,uuid,text,text,text)'::regprocedure))) > 0 then
    raise exception 'DELETES_EVENTS';
  end if;

  begin
    update public.attendance_exclusions set motive = 'system_test' where shift_id = full_shift;
    raise exception 'UPDATE_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'ATTENDANCE_EXCLUSION_HISTORY_IMMUTABLE' then raise; end if;
  end;
  begin
    delete from public.attendance_exclusions where shift_id = full_shift;
    raise exception 'DELETE_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'ATTENDANCE_EXCLUSION_HISTORY_IMMUTABLE' then raise; end if;
  end;

  insert into public.museums(id, name, slug) values (other_museum, 'Museo de prueba exclusión', 'exclusion-test-museum');
  insert into auth.users(id, email, raw_user_meta_data)
  values ('e2700000-0000-4000-8000-000000000099', 'exclusion-other@example.invalid', '{}');
  alter table public.profiles disable trigger profiles_protect_security;
  update public.profiles set museum_id = other_museum, status = 'active' where id = 'e2700000-0000-4000-8000-000000000099';
  insert into public.employees(id, museum_id, profile_id, auth_user_id, email, first_name, last_name, access_level, access_profile, status)
  values ('e2700000-0000-4000-8000-000000000098', other_museum, 'e2700000-0000-4000-8000-000000000099', 'e2700000-0000-4000-8000-000000000099',
          'exclusion-other@example.invalid', 'Otro', 'Museo', 'empleado', 'director_ejecutivo', 'activo');
  insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, created_by)
  values (foreign_shift, other_museum, 'e2700000-0000-4000-8000-000000000098', start_at, end_at, 'e2700000-0000-4000-8000-000000000099');
  begin
    perform public.set_attendance_exclusion(foreign_shift, null, 'exclude', 'system_test', null);
    raise exception 'OTHER_MUSEUM_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'SHIFT_NOT_FOUND' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', 'e2700000-0000-4000-8000-000000000099', true);
  if not public.has_permission('attendance.exclusions.manage') then raise exception 'OTHER_DIRECTOR_DENIED'; end if;
  begin
    perform public.set_attendance_exclusion(full_shift, null, 'exclude', 'system_test', null);
    raise exception 'CROSS_MUSEUM_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'SHIFT_NOT_FOUND' then raise; end if;
  end;
end
$exclusions$;

rollback;
