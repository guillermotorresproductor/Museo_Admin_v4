-- Assigned shifts. Runs in one transaction and rolls it back.
-- Does not use 24 or 25 September 2026 rows.
-- record_employee_attendance and list_shift_punch_editor still pick one shift;
-- these tests cover the data contract, not that pending reader limitation.

begin;

do $assigned$
declare
  actor uuid;
  museum uuid;
  manager uuid;
  subject uuid;
  subject_user uuid;
  other_employee uuid;
  general_employee uuid;
  general_user uuid;
  tz text;
  original_tz text;
  actor_column text;
  audit_actor uuid;
  audit_new jsonb;
  result jsonb;
  second jsonb;
  listed jsonb;
  day_row jsonb;
  history jsonb;
  shift_updated timestamptz;
  other_id uuid;
  kept_start timestamptz;
  kept_end timestamptz;
  day_off_id uuid;
  foreign_museum uuid := 'a2700000-0000-4000-8000-0000000000aa';
  foreign_employee uuid := 'a2700000-0000-4000-8000-0000000000ab';
  past_shift uuid := 'a2700000-0000-4000-8000-000000000001';
  event_shift uuid;
  alert_shift uuid;
  correction_shift uuid;
  overtime_shift uuid;
  exclusion_shift uuid;
  attempt_shift uuid;
  stale_shift uuid;
  locked_a uuid;
  locked_b uuid;
  monday date := date '2027-06-07';
begin
  if extract(isodow from monday) <> 1 then raise exception 'DATE_NOT_MONDAY'; end if;
  if extract(isodow from date '2027-06-12') <> 6 then raise exception 'DATE_NOT_SATURDAY'; end if;
  if extract(isodow from date '2027-06-13') <> 7 then raise exception 'DATE_NOT_SUNDAY'; end if;

  alter table public.employees disable trigger protect_employee_module_profile;
  select e.profile_id, e.museum_id, e.id into actor, museum, manager
    from public.employees e
    join public.profiles p on p.id = e.profile_id
   where e.status = 'activo' and p.status in ('active', 'activo')
   order by e.created_at
   limit 1;
  select e.id, e.profile_id into subject, subject_user
    from public.employees e
   where e.museum_id = museum and e.status = 'activo' and e.profile_id is not null and e.profile_id <> actor
   limit 1;
  if subject is null then raise exception 'NEED_SECOND_EMPLOYEE'; end if;
  select e.id into other_employee
    from public.employees e
   where e.museum_id = museum and e.status = 'activo' and e.id not in (manager, subject)
   limit 1;
  select public.attendance_shift_timezone(museum) into tz;
  original_tz := tz;

  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor, 'role', 'authenticated')::text,
    true
  );

  update public.employees set access_profile = 'gerente_administrativo' where id = manager;
  if not public.has_permission('schedules.manage') then raise exception 'MANAGER_DENIED'; end if;
  update public.employees set access_profile = 'director_ejecutivo' where id = manager;
  if not public.has_permission('schedules.manage') then raise exception 'DIRECTOR_DENIED'; end if;

  select e.id, e.profile_id into general_employee, general_user
    from public.employees e
   where e.museum_id = museum and e.status = 'activo' and e.profile_id is not null
     and e.profile_id <> actor and e.id <> subject
     and (select count(*) from public.employees same where same.profile_id = e.profile_id) = 1
     and not exists (
       select 1 from public.user_permissions u
       join public.permissions p on p.id = u.permission_id
        where u.user_id = e.profile_id and u.museum_id = museum and p.code = 'schedules.manage'
     )
   limit 1;
  if general_employee is null then raise exception 'NEED_GENERAL_ADMIN_SUBJECT'; end if;
  update public.employees set access_profile = 'administrador_general' where id = general_employee;
  perform set_config('request.jwt.claim.sub', general_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', general_user, 'role', 'authenticated')::text, true);
  if public.has_permission('schedules.manage') then raise exception 'GENERAL_ALLOWED'; end if;
  begin
    perform public.schedule_employee_shift(subject, monday, time '08:00', time '17:00');
    raise exception 'GENERAL_WRITE_ALLOWED';
  exception when insufficient_privilege then
    if sqlerrm <> 'FORBIDDEN' then raise; end if;
  end;
  update public.employees set access_profile = 'asistente_administrativa' where id = general_employee;
  if public.has_permission('schedules.manage') then raise exception 'ASSISTANT_ALLOWED'; end if;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);

  update public.employees set access_profile = 'gerente_administrativo' where id = manager;
  delete from public.user_permissions
   where user_id = actor and museum_id = museum
     and permission_id = (select id from public.permissions where code = 'schedules.manage');
  insert into public.user_permissions(user_id, museum_id, permission_id, effect)
  select actor, museum, id, 'deny' from public.permissions where code = 'schedules.manage';
  if public.has_permission('schedules.manage') then raise exception 'DENY_IGNORED'; end if;
  begin
    perform public.schedule_employee_shift(subject, monday, time '08:00', time '17:00');
    raise exception 'DENY_WRITE_ALLOWED';
  exception when insufficient_privilege then
    if sqlerrm <> 'FORBIDDEN' then raise; end if;
  end;
  delete from public.user_permissions
   where user_id = actor and museum_id = museum
     and permission_id = (select id from public.permissions where code = 'schedules.manage');
  if not public.has_permission('schedules.manage') then raise exception 'DENY_STUCK'; end if;

  update public.employees set access_profile = 'director_ejecutivo' where id = manager;
  result := public.schedule_employee_shift(subject, monday, time '08:00', time '17:00');
  if result->>'local_start' <> '08:00' or result->>'local_end' <> '17:00' then raise exception 'EIGHT_TO_FIVE'; end if;
  if (result->>'shift_date')::date <> monday then raise exception 'EIGHT_TO_FIVE_DATE'; end if;
  if result->>'crosses_midnight' <> 'false' then raise exception 'EIGHT_TO_FIVE_OVERNIGHT'; end if;
  select case
           when exists (
             select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'user_id'
           ) then 'user_id' else 'actor_user_id'
         end into actor_column;
  execute format(
    'select %I, new_value from public.audit_logs where record_id = $1 and action = $2 order by created_at desc limit 1',
    actor_column
  ) into audit_actor, audit_new using (result->>'id')::uuid, 'SHIFT_SCHEDULED';
  if audit_actor is distinct from actor then raise exception 'AUDIT_ACTOR'; end if;
  if audit_new->>'employee_id' <> subject::text
     or audit_new->>'shift_id' <> result->>'id'
     or audit_new->>'status' <> 'scheduled'
     or audit_new->>'shift_date' <> monday::text then
    raise exception 'AUDIT_PAYLOAD';
  end if;

  update public.employees set access_profile = 'gerente_administrativo' where id = manager;
  result := public.schedule_employee_shift(subject, date '2027-06-08', time '09:00', time '18:00');
  if result->>'local_start' <> '09:00' or result->>'local_end' <> '18:00' then raise exception 'NINE_TO_SIX'; end if;
  result := public.schedule_employee_shift(subject, date '2027-06-09', time '14:00', time '23:00');
  if result->>'local_start' <> '14:00' or result->>'local_end' <> '23:00' then raise exception 'TWO_TO_ELEVEN'; end if;
  result := public.schedule_employee_shift(subject, date '2027-06-12', time '08:00', time '12:00');
  if (result->>'shift_date')::date <> date '2027-06-12' then raise exception 'SATURDAY'; end if;
  result := public.schedule_employee_shift(subject, date '2027-06-13', time '10:00', time '14:00');
  if (result->>'shift_date')::date <> date '2027-06-13' then raise exception 'SUNDAY'; end if;

  result := public.schedule_employee_shift(subject, date '2027-06-14', time '18:00', time '02:00');
  if (result->>'shift_date')::date <> date '2027-06-14' then raise exception 'OVERNIGHT_DATE'; end if;
  if result->>'crosses_midnight' <> 'true' then raise exception 'OVERNIGHT_FLAG'; end if;
  if (result->>'local_start') <> '18:00' or result->>'local_end' <> '02:00' then raise exception 'OVERNIGHT_HOURS'; end if;
  if ((result->>'ends_at')::timestamptz at time zone tz)::date <> date '2027-06-15' then raise exception 'OVERNIGHT_END_DATE'; end if;
  perform public.set_employee_day_off(subject, date '2027-06-15', 'Libre al dia siguiente', '[]'::jsonb);
  if not exists (
    select 1 from public.employee_shifts
     where employee_id = subject and shift_date = date '2027-06-14' and status = 'scheduled'
  ) or not exists (
    select 1 from public.employee_shifts
     where employee_id = subject and shift_date = date '2027-06-15' and status = 'day_off'
       and starts_at is null and ends_at is null and expected_lunch_minutes is null
  ) then
    raise exception 'OVERNIGHT_BLOCKS_NEXT_DAY_OFF';
  end if;

  result := public.schedule_employee_shift(subject, date '2027-06-16', time '08:00', time '12:00');
  second := public.schedule_employee_shift(subject, date '2027-06-16', time '13:00', time '17:00');
  if result->>'id' = second->>'id' then raise exception 'SPLIT_SAME_ROW'; end if;
  if (select count(*) from public.employee_shifts
       where employee_id = subject and shift_date = date '2027-06-16' and status = 'scheduled') <> 2 then
    raise exception 'SPLIT_COUNT';
  end if;
  perform public.schedule_employee_shift(subject, date '2027-06-17', time '08:00', time '12:00');
  begin
    perform public.schedule_employee_shift(subject, date '2027-06-17', time '11:00', time '15:00');
    raise exception 'OVERLAP_ALLOWED';
  exception when exclusion_violation then
    if sqlerrm <> 'SHIFT_OVERLAP' then raise; end if;
  end;
  if (select count(*) from public.employee_shifts
       where employee_id = subject and shift_date = date '2027-06-17' and status = 'scheduled') <> 1 then
    raise exception 'OVERLAP_WROTE';
  end if;

  result := public.schedule_employee_shift(subject, date '2027-06-18', time '08:00', time '17:00');
  begin
    insert into public.employee_shifts(
      museum_id, employee_id, shift_date, starts_at, ends_at, expected_lunch_minutes,
      shift_type, status, created_by
    ) values (
      museum, subject, date '2027-06-18', null, null, null, 'regular', 'day_off', actor
    );
    raise exception 'DAY_OFF_WITH_SCHEDULED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'DAY_OFF_CONFLICT' then raise; end if;
  end;

  result := public.schedule_employee_shift(subject, date '2027-06-21', time '08:00', time '12:00');
  second := public.schedule_employee_shift(subject, date '2027-06-21', time '13:00', time '17:00');
  kept_start := (result->>'starts_at')::timestamptz;
  kept_end := (result->>'ends_at')::timestamptz;
  perform public.set_employee_day_off(
    subject, date '2027-06-21', 'Dia libre de ambos turnos',
    jsonb_build_array(
      jsonb_build_object('id', result->>'id', 'updated_at', result->>'updated_at'),
      jsonb_build_object('id', second->>'id', 'updated_at', second->>'updated_at')
    )
  );
  if (select status from public.employee_shifts where id = (result->>'id')::uuid) <> 'cancelled' then
    raise exception 'DAY_OFF_DID_NOT_CANCEL';
  end if;
  if (select starts_at from public.employee_shifts where id = (result->>'id')::uuid) <> kept_start
     or (select ends_at from public.employee_shifts where id = (result->>'id')::uuid) <> kept_end then
    raise exception 'CANCELLED_LOST_HOURS';
  end if;
  if (select count(*) from public.employee_shifts
       where employee_id = subject and shift_date = date '2027-06-21' and status = 'day_off'
         and starts_at is null and ends_at is null and expected_lunch_minutes is null) <> 1 then
    raise exception 'DAY_OFF_HOURS';
  end if;
  if exists (
    select 1 from public.attendance_events ev
     where ev.shift_id in ((result->>'id')::uuid, (second->>'id')::uuid)
  ) or exists (
    select 1 from public.attendance_operational_alerts al
     where al.shift_id in ((result->>'id')::uuid, (second->>'id')::uuid)
  ) then
    raise exception 'DAY_OFF_CREATED_ACTIVITY';
  end if;
  history := public.list_attendance_history(date '2027-06-21', date '2027-06-21');
  if exists (
    select 1
      from jsonb_array_elements(coalesce(history->'employees', '[]'::jsonb)) emp,
           jsonb_array_elements(coalesce(emp->'days', '[]'::jsonb)) item
     where item->>'shift_id' in (result->>'id', second->>'id')
        or coalesce((item->>'regular_minutes')::integer, 0) <> 0
  ) then
    raise exception 'DAY_OFF_COMPUTES_HOURS';
  end if;

  result := public.schedule_employee_shift(subject, date '2027-06-22', time '08:00', time '12:00');
  second := public.schedule_employee_shift(subject, date '2027-06-22', time '13:00', time '17:00');
  locked_a := (result->>'id')::uuid;
  locked_b := (second->>'id')::uuid;
  insert into public.attendance_attempts(id, museum_id, employee_id, shift_id, actor_user_id, requested_event, result)
  values ('a2700000-0000-4000-8000-000000000111', museum, subject, locked_b, actor, 'clock_in', 'accepted');
  insert into public.attendance_events(
    id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by
  ) values (
    'a2700000-0000-4000-8000-000000000211', museum, subject, locked_b,
    'a2700000-0000-4000-8000-000000000111', 'clock_in',
    (date '2027-06-22' + time '13:00') at time zone tz, 'on_time', 1, subject_user
  );
  begin
    perform public.set_employee_day_off(
      subject, date '2027-06-22', 'No debe aplicar',
      jsonb_build_array(
        jsonb_build_object('id', locked_a, 'updated_at', result->>'updated_at'),
        jsonb_build_object('id', locked_b, 'updated_at', second->>'updated_at')
      )
    );
    raise exception 'PARTIAL_DAY_OFF_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'SHIFT_LOCKED' then raise; end if;
  end;
  if (select status from public.employee_shifts where id = locked_a) <> 'scheduled'
     or (select status from public.employee_shifts where id = locked_b) <> 'scheduled'
     or exists (
       select 1 from public.employee_shifts
        where employee_id = subject and shift_date = date '2027-06-22' and status = 'day_off'
     ) then
    raise exception 'PARTIAL_DAY_OFF_WROTE';
  end if;

  insert into public.employee_shifts(
    id, museum_id, employee_id, shift_date, starts_at, ends_at, shift_type, status, created_by
  ) values (
    past_shift, museum, subject, date '2025-03-03',
    (date '2025-03-03' + time '08:00') at time zone tz,
    (date '2025-03-03' + time '17:00') at time zone tz,
    'regular', 'scheduled', actor
  );
  select updated_at into shift_updated from public.employee_shifts where id = past_shift;
  begin
    perform public.schedule_employee_shift(
      subject, date '2027-08-02', time '09:00', time '17:00', past_shift,
      null, false, null, shift_updated, 'Mover un turno que ya comenzo'
    );
    raise exception 'STARTED_EDIT_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'SHIFT_LOCKED' then raise; end if;
  end;
  if (select shift_date from public.employee_shifts where id = past_shift) <> date '2025-03-03' then
    raise exception 'STARTED_SHIFT_MOVED';
  end if;

  result := public.schedule_employee_shift(subject, date '2027-07-01', time '08:00', time '17:00');
  event_shift := (result->>'id')::uuid;
  shift_updated := (result->>'updated_at')::timestamptz;
  insert into public.attendance_attempts(id, museum_id, employee_id, shift_id, actor_user_id, requested_event, result)
  values ('a2700000-0000-4000-8000-000000000121', museum, subject, event_shift, actor, 'clock_in', 'accepted');
  insert into public.attendance_events(
    id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by
  ) values (
    'a2700000-0000-4000-8000-000000000221', museum, subject, event_shift,
    'a2700000-0000-4000-8000-000000000121', 'clock_in',
    (date '2027-07-01' + time '08:00') at time zone tz, 'on_time', 1, subject_user
  );
  begin
    perform public.schedule_employee_shift(
      subject, date '2027-07-01', time '09:00', time '17:00', event_shift,
      null, false, null, shift_updated, 'No debe cambiar un turno con ponche'
    );
    raise exception 'EVENT_EDIT_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'SHIFT_LOCKED' then raise; end if;
  end;

  result := public.schedule_employee_shift(subject, date '2027-07-02', time '08:00', time '17:00');
  alert_shift := (result->>'id')::uuid;
  shift_updated := (result->>'updated_at')::timestamptz;
  insert into public.attendance_operational_alerts(museum_id, employee_id, shift_id, alert_date, alert_type, status)
  values (museum, subject, alert_shift, date '2027-07-02', 'late', 'active');
  begin
    perform public.schedule_employee_shift(
      subject, date '2027-07-02', time '09:00', time '17:00', alert_shift,
      null, false, null, shift_updated, 'No debe cambiar un turno con alerta'
    );
    raise exception 'ALERT_EDIT_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'SHIFT_LOCKED' then raise; end if;
  end;

  result := public.schedule_employee_shift(subject, date '2027-07-05', time '08:00', time '17:00');
  correction_shift := (result->>'id')::uuid;
  shift_updated := (result->>'updated_at')::timestamptz;
  insert into public.attendance_correction_requests(
    museum_id, employee_id, shift_id, requested_event_type, requested_occurred_at, reason, requested_by
  ) values (
    museum, subject, correction_shift, 'clock_in',
    (date '2027-07-05' + time '08:05') at time zone tz, 'Olvido el ponche de entrada', subject_user
  );
  begin
    perform public.schedule_employee_shift(
      subject, date '2027-07-05', time '09:00', time '17:00', correction_shift,
      null, false, null, shift_updated, 'No debe cambiar un turno con correccion'
    );
    raise exception 'CORRECTION_EDIT_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'SHIFT_LOCKED' then raise; end if;
  end;

  result := public.schedule_employee_shift(subject, date '2027-07-06', time '08:00', time '17:00');
  overtime_shift := (result->>'id')::uuid;
  shift_updated := (result->>'updated_at')::timestamptz;
  insert into public.attendance_attempts(id, museum_id, employee_id, shift_id, actor_user_id, requested_event, result)
  values ('a2700000-0000-4000-8000-000000000131', museum, subject, overtime_shift, actor, 'clock_out', 'accepted');
  insert into public.attendance_events(
    id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by
  ) values (
    'a2700000-0000-4000-8000-000000000231', museum, subject, overtime_shift,
    'a2700000-0000-4000-8000-000000000131', 'clock_out',
    (date '2027-07-06' + time '18:00') at time zone tz, 'overtime_pending', 1, subject_user
  );
  insert into public.attendance_overtime_reviews(
    museum_id, employee_id, shift_id, clock_out_event_id, additional_minutes
  ) values (
    museum, subject, overtime_shift, 'a2700000-0000-4000-8000-000000000231', 30
  );
  begin
    perform public.schedule_employee_shift(
      subject, date '2027-07-06', time '09:00', time '17:00', overtime_shift,
      null, false, null, shift_updated, 'No debe cambiar un turno con horas extra'
    );
    raise exception 'OVERTIME_EDIT_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'SHIFT_LOCKED' then raise; end if;
  end;

  result := public.schedule_employee_shift(subject, date '2027-07-07', time '08:00', time '17:00');
  exclusion_shift := (result->>'id')::uuid;
  shift_updated := (result->>'updated_at')::timestamptz;
  insert into public.attendance_exclusions(
    museum_id, employee_id, shift_id, scope, action, motive, acted_by
  ) values (
    museum, subject, exclusion_shift, 'shift', 'exclude', 'system_test', actor
  );
  begin
    perform public.schedule_employee_shift(
      subject, date '2027-07-07', time '09:00', time '17:00', exclusion_shift,
      null, false, null, shift_updated, 'No debe cambiar un turno excluido'
    );
    raise exception 'EXCLUSION_EDIT_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'SHIFT_LOCKED' then raise; end if;
  end;

  result := public.schedule_employee_shift(subject, date '2027-07-08', time '08:00', time '17:00');
  attempt_shift := (result->>'id')::uuid;
  shift_updated := (result->>'updated_at')::timestamptz;
  insert into public.attendance_attempts(id, museum_id, employee_id, shift_id, actor_user_id, requested_event, result)
  values ('a2700000-0000-4000-8000-000000000141', museum, subject, attempt_shift, actor, 'clock_in', 'presence_not_configured');
  second := public.schedule_employee_shift(
    subject, date '2027-07-08', time '09:00', time '17:00', attempt_shift,
    null, false, null, shift_updated, 'Un intento aislado no congela el turno'
  );
  if second->>'local_start' <> '09:00' then raise exception 'ATTEMPT_FROZE_SHIFT'; end if;

  result := public.schedule_employee_shift(subject, date '2027-07-09', time '08:00', time '17:00');
  stale_shift := (result->>'id')::uuid;
  begin
    perform public.schedule_employee_shift(
      subject, date '2027-07-09', time '09:00', time '17:00', stale_shift,
      null, false, null, (result->>'updated_at')::timestamptz - interval '1 second',
      'Version vieja del turno'
    );
    raise exception 'STALE_WRITE_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'SHIFT_CHANGED_RELOAD' then raise; end if;
  end;
  if (select to_char(starts_at at time zone tz, 'HH24:MI') from public.employee_shifts where id = stale_shift) <> '08:00' then
    raise exception 'STALE_WRITE_CHANGED';
  end if;

  insert into public.museums(id, name, slug)
  values (foreign_museum, 'Museo de prueba de turnos', 'assigned-shift-a270');
  insert into public.employees(id, museum_id, first_name, last_name, email, position, department)
  values (foreign_employee, foreign_museum, 'Otro', 'Museo', 'otro-turno@example.invalid', 'Prueba', 'Prueba');
  begin
    perform public.schedule_employee_shift(foreign_employee, date '2027-07-12', time '08:00', time '17:00');
    raise exception 'FOREIGN_MUSEUM_ALLOWED';
  exception when sqlstate 'P0002' then
    if sqlerrm <> 'EMPLOYEE_NOT_FOUND' then raise; end if;
  end;

  begin
    perform public.schedule_employee_shift(manager, date '2027-07-13', time '08:00', time '17:00');
    raise exception 'SELF_ALLOWED';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHIFT_SELF_FORBIDDEN' then raise; end if;
  end;

  result := public.schedule_employee_shift(
    subject, date '2027-07-14', time '08:00', time '16:00',
    null, 45, true
  );
  if (result->>'expected_lunch_minutes')::integer <> 45 then raise exception 'LUNCH_NOT_SET'; end if;
  second := public.schedule_employee_shift(subject, date '2027-07-15', time '08:00', time '16:00');
  if (second->>'expected_lunch_minutes')::integer <> 45 then raise exception 'LUNCH_NOT_INHERITED'; end if;
  listed := public.schedule_employee_shift(
    subject, date '2027-07-15', time '08:00', time '16:30',
    (second->>'id')::uuid, null, false, null, (second->>'updated_at')::timestamptz,
    'Ajuste de salida sin tocar el almuerzo'
  );
  if listed->>'local_end' <> '16:30' or (listed->>'expected_lunch_minutes')::integer <> 45 then
    raise exception 'LUNCH_CLEARED';
  end if;

  perform public.set_employee_day_off(subject, date '2027-07-16', 'Dia sin turno previo', '[]'::jsonb);
  select id into day_off_id
    from public.employee_shifts
   where employee_id = subject and shift_date = date '2027-07-16' and status = 'day_off';
  select updated_at into shift_updated from public.employee_shifts where id = day_off_id;
  result := public.schedule_employee_shift(
    subject, date '2027-07-16', time '08:00', time '17:00',
    day_off_id, null, false, null, shift_updated, null
  );
  if (result->>'id')::uuid <> day_off_id or result->>'status' <> 'scheduled' or result->>'local_start' <> '08:00' then
    raise exception 'DAY_OFF_NOT_CONVERTED';
  end if;
  second := public.schedule_employee_shift(subject, date '2027-07-16', time '18:00', time '21:00');
  if second->>'id' = result->>'id' or second->>'status' <> 'scheduled' then raise exception 'SECOND_SHIFT_MISSING'; end if;
  if exists (
    select 1 from public.employee_shifts
     where employee_id = subject and shift_date = date '2027-07-16' and status = 'day_off'
  ) then
    raise exception 'DAY_OFF_STILL_PRESENT';
  end if;

  result := public.schedule_employee_shift(subject, date '2027-07-19', time '08:00', time '12:00');
  kept_start := (result->>'starts_at')::timestamptz;
  kept_end := (result->>'ends_at')::timestamptz;
  second := public.cancel_employee_shift((result->>'id')::uuid, (result->>'updated_at')::timestamptz, 'Retiro del turno');
  if second->>'status' <> 'cancelled'
     or (second->>'starts_at')::timestamptz <> kept_start
     or (second->>'ends_at')::timestamptz <> kept_end then
    raise exception 'CANCEL_CHANGED_HOURS';
  end if;
  other_id := (public.schedule_employee_shift(subject, date '2027-07-19', time '08:00', time '12:00')->>'id')::uuid;
  if other_id = (result->>'id')::uuid then raise exception 'CANCEL_BLOCKED_NEW_SHIFT'; end if;

  if other_employee is not null then
    perform public.schedule_employee_shift(other_employee, date '2027-06-16', time '08:00', time '12:00');
  end if;
  perform set_config('request.jwt.claim.sub', subject_user::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', subject_user, 'role', 'authenticated')::text,
    true
  );
  if not public.has_permission('schedules.read.self') then raise exception 'MY_SHIFTS_DENIED'; end if;
  listed := public.list_my_assigned_shifts(date '2027-06-16', date '2027-06-16');
  if (listed->>'employee_id')::uuid <> subject then raise exception 'MY_SHIFTS_OTHER_EMPLOYEE'; end if;
  select item into day_row
    from jsonb_array_elements(listed->'days') item
   where item->>'shift_date' = '2027-06-16';
  if jsonb_array_length(day_row->'shifts') <> 2 then raise exception 'MY_SHIFTS_NOT_MULTIPLE'; end if;
  if other_employee is not null and exists (
    select 1
      from jsonb_array_elements(day_row->'shifts') item
      join public.employee_shifts s on s.id = (item->>'id')::uuid
     where s.employee_id <> subject
  ) then
    raise exception 'MY_SHIFTS_LEAKED';
  end if;

  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor, 'role', 'authenticated')::text,
    true
  );
  update public.attendance_settings set timezone = 'Pacific/Honolulu' where museum_id = museum;
  result := public.schedule_employee_shift(subject, date '2027-07-20', time '08:00', time '17:00');
  if result->>'local_start' <> '08:00' or (result->>'shift_date')::date <> date '2027-07-20' then
    raise exception 'MUSEUM_TIMEZONE_IGNORED';
  end if;
  if ((result->>'starts_at')::timestamptz at time zone 'Pacific/Honolulu')::time <> time '08:00' then
    raise exception 'MUSEUM_TIMEZONE_OFFSET';
  end if;
  update public.attendance_settings set timezone = original_tz where museum_id = museum;
  begin
    update public.attendance_settings set timezone = '   ' where museum_id = museum;
    perform public.schedule_employee_shift(subject, date '2027-07-21', time '08:00', time '17:00');
    raise exception 'EMPTY_TIMEZONE_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'SHIFT_TIMEZONE_NOT_CONFIGURED' then raise; end if;
  end;
  if (select nullif(trim(timezone), '') from public.attendance_settings where museum_id = museum) is null then
    raise exception 'EMPTY_TIMEZONE_STUCK';
  end if;

  alter table public.employees enable trigger protect_employee_module_profile;
end
$assigned$;

select 'ASSIGNED_SHIFTS_OK' as result;

rollback;
