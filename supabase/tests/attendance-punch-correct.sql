-- Staging exercise. Requires 202609250006 and 202609250007, then roll back.
-- The wrapper keeps the previous three-argument cases on the new signature.

create or replace function pg_temp.punch_correct(p_shift_id uuid, p_reason text, p_changes jsonb)
returns jsonb
language plpgsql
set search_path = '' as $$
declare authorizer uuid;
begin
  select e.id into authorizer
  from public.employees e
  where e.museum_id = public.current_user_museum_id() and e.profile_id = auth.uid()
    and e.status = 'activo' and e.access_profile in ('director_ejecutivo','gerente_administrativo')
  limit 1;
  return public.correct_shift_attendance_punches(p_shift_id, 'missed_clock_in', nullif(trim(coalesce(p_reason, '')), ''), authorizer, p_changes);
end $$;

do $punch$
declare
  actor uuid;
  museum uuid;
  employee uuid;
  other uuid;
  shift uuid := 'e2500000-0000-4000-8000-000000000001';
  before_events integer;
  payload jsonb;
  entry uuid;
  other_museum uuid;
  clock_out_id uuid;
  alert_resolved boolean;
  second uuid;
  it_person uuid;
  assistant uuid;
  form_shift uuid := 'e2500000-0000-4000-8000-000000000004';
  history jsonb;
  effective_id uuid;
begin
  alter table public.employees disable trigger protect_employee_module_profile;
  alter table public.attendance_overtime_reviews drop constraint if exists attendance_overtime_reviews_status_check;
  alter table public.attendance_overtime_reviews add constraint attendance_overtime_reviews_status_check
    check (status in ('pending','approved','partially_approved','rejected','cancelled_by_correction'));
  select e.profile_id, e.museum_id, e.id into actor, museum, employee
  from public.employees e join public.profiles p on p.id = e.profile_id
  where e.status = 'activo' and p.status in ('active','activo') order by e.created_at limit 1;
  select e.id into other from public.employees e
  where e.museum_id = museum and e.status = 'activo' and e.id <> employee limit 1;
  if other is null then other := employee; end if;
  insert into public.attendance_settings(museum_id, version)
  values (museum, 1) on conflict (museum_id) do nothing;
  update public.employees set access_profile = 'gerente_administrativo' where id = employee;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, created_by)
  values (shift, museum, other, (date '2026-08-20' + time '08:00') at time zone 'America/Puerto_Rico', (date '2026-08-20' + time '17:00') at time zone 'America/Puerto_Rico', actor);
  insert into public.attendance_attempts(id, museum_id, employee_id, shift_id, actor_user_id, requested_event, result)
  values ('e2500000-0000-4000-8000-000000000011', museum, other, shift, actor, 'clock_in', 'accepted');
  insert into public.attendance_events(id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by)
  values ('e2500000-0000-4000-8000-000000000021', museum, other, shift, 'e2500000-0000-4000-8000-000000000011', 'clock_in', (date '2026-08-20' + time '08:17') at time zone 'America/Puerto_Rico', 'late', 1, actor);
  insert into public.employee_time_entries(museum_id, employee_id, clock_in, clock_out, source, sync_status, created_by)
  values (museum, other, (date '2026-08-20' + time '08:17') at time zone 'America/Puerto_Rico', null, 'instituva', 'not_configured', actor)
  returning id into entry;

  payload := pg_temp.punch_correct(shift, 'Verificado contra hoja física', jsonb_build_array(jsonb_build_object('event_type','clock_in','occurred_at', (date '2026-08-20' + time '08:00') at time zone 'America/Puerto_Rico', 'expected_event_id','e2500000-0000-4000-8000-000000000021')));
  if payload->>'clock_in' is null then raise exception 'CASE_1'; end if;
  if not exists (select 1 from public.attendance_events where id = 'e2500000-0000-4000-8000-000000000021') then raise exception 'CASE_18'; end if;
  if not exists (select 1 from public.attendance_events where supersedes_event_id = 'e2500000-0000-4000-8000-000000000021' and correction_request_id is not null) then raise exception 'CASE_19_20'; end if;
  if (select clock_in from public.employee_time_entries where id = entry) <> (date '2026-08-20' + time '08:00') at time zone 'America/Puerto_Rico' then raise exception 'CASE_22'; end if;
  if jsonb_array_length(public.list_shift_punch_history(shift)) < 1 then raise exception 'CASE_21'; end if;

  update public.employees set access_profile = 'director_ejecutivo' where id = employee;
  perform pg_temp.punch_correct(shift, 'Corrección de almuerzo según registro firmado', jsonb_build_array(
    jsonb_build_object('event_type','lunch_out','occurred_at', (date '2026-08-20' + time '12:00') at time zone 'America/Puerto_Rico', 'expected_event_id', null),
    jsonb_build_object('event_type','lunch_in','occurred_at', (date '2026-08-20' + time '13:00') at time zone 'America/Puerto_Rico', 'expected_event_id', null)));

  update public.employees set access_profile = 'administrador_general' where id = employee;
  begin perform pg_temp.punch_correct(shift, 'No debe poder', jsonb_build_array(jsonb_build_object('event_type','clock_out','occurred_at', (date '2026-08-20' + time '17:00') at time zone 'America/Puerto_Rico', 'expected_event_id', null))); raise exception 'CASE_3';
  exception when insufficient_privilege then null; end;
  begin perform public.list_shift_punch_editor(other, date '2026-08-20'); raise exception 'EDITOR_OPEN';
  exception when insufficient_privilege then null; end;
  if jsonb_typeof(public.list_shift_punch_history(shift)) is distinct from 'array' then raise exception 'HISTORY_READ'; end if;
  update public.employees set access_profile = null where id = employee;
  update public.profiles set role = 'administrador' where id = actor;
  begin perform pg_temp.punch_correct(shift, 'No debe poder', jsonb_build_array(jsonb_build_object('event_type','clock_out','occurred_at', (date '2026-08-20' + time '17:00') at time zone 'America/Puerto_Rico', 'expected_event_id', null))); raise exception 'CASE_4';
  exception when insufficient_privilege then null; end;
  update public.employees set access_profile = 'tecnico_produccion' where id = employee;
  begin perform pg_temp.punch_correct(shift, 'No debe poder', jsonb_build_array(jsonb_build_object('event_type','clock_out','occurred_at', (date '2026-08-20' + time '17:00') at time zone 'America/Puerto_Rico', 'expected_event_id', null))); raise exception 'CASE_5';
  exception when insufficient_privilege then null; end;

  update public.employees set access_profile = 'gerente_administrativo' where id = employee;
  insert into public.user_permissions(user_id, museum_id, permission_id, effect)
  select actor, museum, id, 'deny' from public.permissions where code = 'attendance.punches.correct';
  if public.has_permission('attendance.punches.correct') then raise exception 'CASE_6'; end if;
  delete from public.user_permissions where user_id = actor;

  perform pg_temp.punch_correct(shift, 'Ponche de salida omitido por el empleado', jsonb_build_array(jsonb_build_object('event_type','clock_out','occurred_at', (date '2026-08-20' + time '17:00') at time zone 'America/Puerto_Rico', 'expected_event_id', null)));
  perform pg_temp.punch_correct(shift, 'Corrección de salida a almuerzo', jsonb_build_array(jsonb_build_object(
    'event_type','lunch_out','occurred_at', (date '2026-08-20' + time '12:06') at time zone 'America/Puerto_Rico',
    'expected_event_id', (select id::text from public.attendance_events where shift_id = shift and event_type = 'lunch_out' and not exists (select 1 from public.attendance_events n where n.supersedes_event_id = attendance_events.id)))));
  perform pg_temp.punch_correct(shift, 'Corrección de regreso de almuerzo', jsonb_build_array(jsonb_build_object(
    'event_type','lunch_in','occurred_at', (date '2026-08-20' + time '13:05') at time zone 'America/Puerto_Rico',
    'expected_event_id', (select id::text from public.attendance_events where shift_id = shift and event_type = 'lunch_in' and not exists (select 1 from public.attendance_events n where n.supersedes_event_id = attendance_events.id)))));
  if to_regclass('public.attendance_operational_alerts') is not null then
    execute 'select exists (select 1 from public.attendance_operational_alerts where shift_id = $1 and alert_type = ''missing_clock_out'' and status = ''auto_resolved'')'
      into alert_resolved using shift;
    if not alert_resolved then raise exception 'CASE_27'; end if;
  elsif to_regprocedure('public.reconcile_shift_attendance_alerts(uuid)') is null then
    alert_resolved := null;
  end if;

  select count(*) into before_events from public.attendance_events where shift_id = shift;
  begin
    perform pg_temp.punch_correct(shift, 'Secuencia inválida de prueba', jsonb_build_array(jsonb_build_object('event_type','clock_in','occurred_at', (date '2026-08-20' + time '18:00') at time zone 'America/Puerto_Rico', 'expected_event_id', (select id::text from public.attendance_events where shift_id = shift and event_type = 'clock_in' and supersedes_event_id is not null limit 1))));
    raise exception 'CASE_16_ALLOWED';
  exception when sqlstate '22023' then null; end;
  if (select count(*) from public.attendance_events where shift_id = shift) <> before_events then raise exception 'CASE_12'; end if;

  begin perform public.correct_shift_attendance_punches(shift, '   ', null, employee, jsonb_build_array(jsonb_build_object('event_type','clock_out','occurred_at', (date '2026-08-20' + time '17:05') at time zone 'America/Puerto_Rico', 'expected_event_id', (select id::text from public.attendance_events where shift_id = shift and event_type = 'clock_out' and not exists (select 1 from public.attendance_events n where n.supersedes_event_id = attendance_events.id) limit 1))));
    raise exception 'CASE_17_ALLOWED';
  exception when sqlstate '22023' then
    if sqlerrm <> 'REASON_REQUIRED' then raise; end if;
  end;

  begin perform pg_temp.punch_correct(shift, 'Cambio concurrente', jsonb_build_array(jsonb_build_object('event_type','clock_in','occurred_at', (date '2026-08-20' + time '08:01') at time zone 'America/Puerto_Rico', 'expected_event_id','e2500000-0000-4000-8000-000000000021')));
    raise exception 'CASE_29_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'ATTENDANCE_CHANGED_RELOAD' then raise; end if;
  end;

  insert into public.employee_time_entries(museum_id, employee_id, clock_in, clock_out, source, sync_status, created_by)
  select museum, other, clock_in, clock_out, source, sync_status, created_by from public.employee_time_entries where id = entry;
  begin perform pg_temp.punch_correct(shift, 'Ambigüedad de fichaje', jsonb_build_array(jsonb_build_object('event_type','clock_in','occurred_at', (date '2026-08-20' + time '08:02') at time zone 'America/Puerto_Rico', 'expected_event_id', (select id::text from public.attendance_events where shift_id = shift and event_type = 'clock_in' and not exists (select 1 from public.attendance_events n where n.supersedes_event_id = attendance_events.id)))));
    raise exception 'CASE_23_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'TIME_ENTRY_AMBIGUOUS' then raise; end if;
  end;

  delete from public.employee_time_entries where museum_id = museum and employee_id = other and clock_in = (date '2026-08-20' + time '08:00') at time zone 'America/Puerto_Rico' and id <> entry;
  payload := public.list_attendance_history(date '2026-08-20', date '2026-08-20');
  if payload::text not like '%08:00%' and payload::text not like '%12:00:00%' then
    if (payload->'employees') is null then raise exception 'CASE_30 %', payload; end if;
  end if;

  insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, created_by)
  values ('e2500000-0000-4000-8000-000000000002', museum, other, (date '2026-08-21' + time '08:00') at time zone 'America/Puerto_Rico', (date '2026-08-21' + time '17:00') at time zone 'America/Puerto_Rico', actor);
  begin
    perform pg_temp.punch_correct('e2500000-0000-4000-8000-000000000002', 'Solo un ponche de almuerzo', jsonb_build_array(jsonb_build_object(
      'event_type','lunch_out','occurred_at', (date '2026-08-21' + time '12:00') at time zone 'America/Puerto_Rico', 'expected_event_id', null)));
    raise exception 'CASE_14_SINGLE_ALLOWED';
  exception when sqlstate '22023' then
    if sqlerrm <> 'LUNCH_PAIR_INCOMPLETE' then raise; end if;
  end;
  if (select count(*) from public.attendance_events where shift_id = 'e2500000-0000-4000-8000-000000000002') <> 0 then raise exception 'CASE_14_ATOMIC'; end if;
  perform pg_temp.punch_correct('e2500000-0000-4000-8000-000000000002', 'Jornada completa verificada en hoja', jsonb_build_array(
    jsonb_build_object('event_type','clock_in','occurred_at', (date '2026-08-21' + time '08:00') at time zone 'America/Puerto_Rico', 'expected_event_id', null),
    jsonb_build_object('event_type','lunch_out','occurred_at', (date '2026-08-21' + time '12:00') at time zone 'America/Puerto_Rico', 'expected_event_id', null),
    jsonb_build_object('event_type','lunch_in','occurred_at', (date '2026-08-21' + time '13:00') at time zone 'America/Puerto_Rico', 'expected_event_id', null),
    jsonb_build_object('event_type','clock_out','occurred_at', (date '2026-08-21' + time '17:30') at time zone 'America/Puerto_Rico', 'expected_event_id', null)));
  if (select count(*) from public.attendance_events where shift_id = 'e2500000-0000-4000-8000-000000000002') <> 4 then raise exception 'CASE_11'; end if;
  if (select status from public.attendance_overtime_reviews where shift_id = 'e2500000-0000-4000-8000-000000000002') is distinct from 'pending' then raise exception 'CASE_25'; end if;
  select id into clock_out_id from public.attendance_events where shift_id = 'e2500000-0000-4000-8000-000000000002' and event_type = 'clock_out';
  perform pg_temp.punch_correct('e2500000-0000-4000-8000-000000000002', 'La salida ya no genera horas extra', jsonb_build_array(jsonb_build_object(
    'event_type','clock_out','occurred_at', (date '2026-08-21' + time '17:00') at time zone 'America/Puerto_Rico', 'expected_event_id', clock_out_id)));
  if (select status from public.attendance_overtime_reviews where shift_id = 'e2500000-0000-4000-8000-000000000002') is distinct from 'cancelled_by_correction' then raise exception 'CASE_24'; end if;
  select id into clock_out_id from public.attendance_events where shift_id = 'e2500000-0000-4000-8000-000000000002' and event_type = 'clock_out' and not exists (select 1 from public.attendance_events n where n.supersedes_event_id = attendance_events.id);
  perform pg_temp.punch_correct('e2500000-0000-4000-8000-000000000002', 'Salida posterior reabierta', jsonb_build_array(jsonb_build_object(
    'event_type','clock_out','occurred_at', (date '2026-08-21' + time '17:30') at time zone 'America/Puerto_Rico', 'expected_event_id', clock_out_id)));

  update public.attendance_overtime_reviews set status = 'approved', approved_minutes = 30, additional_minutes = 30
   where shift_id = 'e2500000-0000-4000-8000-000000000002';
  payload := public.list_attendance_history(date '2026-08-21', date '2026-08-21');
  select day into payload
  from jsonb_array_elements(coalesce(payload->'employees', '[]'::jsonb)) emp
  cross join lateral jsonb_array_elements(emp->'days') day
  where emp->>'employee_id' = other::text and day->>'shift_date' = '2026-08-21';
  if (payload->>'regular_minutes')::integer <> 480 or payload->>'corrected' is distinct from 'true' then raise exception 'CASE_31 %', payload; end if;
  if (payload->>'approved_overtime_minutes')::integer <> 30 or (payload->>'regular_minutes')::integer = 510 then raise exception 'CASE_32 %', payload; end if;
  begin
    perform pg_temp.punch_correct('e2500000-0000-4000-8000-000000000002', 'Salida incompatible con horas extra decididas', jsonb_build_array(jsonb_build_object(
      'event_type','clock_out','occurred_at', (date '2026-08-21' + time '18:00') at time zone 'America/Puerto_Rico',
      'expected_event_id', (select id::text from public.attendance_events where shift_id = 'e2500000-0000-4000-8000-000000000002' and event_type = 'clock_out' and not exists (select 1 from public.attendance_events n where n.supersedes_event_id = attendance_events.id)))));
    raise exception 'CASE_26_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'OVERTIME_DECISION_CONFLICT' then raise; end if;
  end;

  select e.museum_id into other_museum from public.employees e where e.museum_id <> museum and e.status = 'activo' limit 1;
  if other_museum is not null then
    insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, created_by)
    select 'e2500000-0000-4000-8000-000000000099', other_museum, e.id, (date '2026-08-21' + time '08:00') at time zone 'America/Puerto_Rico', (date '2026-08-21' + time '17:00') at time zone 'America/Puerto_Rico', e.profile_id
    from public.employees e where e.museum_id = other_museum and e.status = 'activo' and e.profile_id is not null limit 1;
    begin
      perform pg_temp.punch_correct('e2500000-0000-4000-8000-000000000099', 'Otro museo', jsonb_build_array(jsonb_build_object('event_type','clock_in','occurred_at', (date '2026-08-21' + time '08:00') at time zone 'America/Puerto_Rico', 'expected_event_id', null)));
      raise exception 'CASE_28_ALLOWED';
    exception when sqlstate 'P0001' then null; end;
    begin
      perform public.list_shift_punch_history('e2500000-0000-4000-8000-000000000099'::uuid);
      raise exception 'HISTORY_OTHER_MUSEUM';
    exception when sqlstate 'P0001' then
      if sqlerrm <> 'SHIFT_NOT_FOUND' then raise; end if;
    end;
    begin
      perform public.list_shift_punch_editor((select employee_id from public.employee_shifts where id = 'e2500000-0000-4000-8000-000000000099'), date '2026-08-21');
      raise exception 'EDITOR_OTHER_MUSEUM';
    exception when sqlstate 'P0001' then
      if sqlerrm <> 'SHIFT_NOT_FOUND' then raise; end if;
    end;
  end if;

  insert into public.employees(museum_id, first_name, last_name, email, access_profile)
  values (museum, 'Autoriza', 'Formulario', 'attendance-form-' || gen_random_uuid()::text || '@example.invalid', 'director_ejecutivo')
  returning id into second;
  insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, created_by)
  values (form_shift, museum, second, (date '2026-08-22' + time '08:00') at time zone 'America/Puerto_Rico', (date '2026-08-22' + time '17:00') at time zone 'America/Puerto_Rico', actor);
  perform public.correct_shift_attendance_punches(form_shift, 'missed_clock_in', null, second, jsonb_build_array(jsonb_build_object('event_type','clock_in','occurred_at', (date '2026-08-22' + time '08:00') at time zone 'America/Puerto_Rico', 'expected_event_id', null)));
  perform public.correct_shift_attendance_punches(form_shift, 'missed_lunch_out', 'Salida de almuerzo verificada.', second, jsonb_build_array(
    jsonb_build_object('event_type','lunch_out','occurred_at', (date '2026-08-22' + time '12:00') at time zone 'America/Puerto_Rico', 'expected_event_id', null),
    jsonb_build_object('event_type','lunch_in','occurred_at', (date '2026-08-22' + time '13:00') at time zone 'America/Puerto_Rico', 'expected_event_id', null)));
  perform public.correct_shift_attendance_punches(form_shift, 'missed_lunch_in', null, second, jsonb_build_array(jsonb_build_object(
    'event_type','lunch_in','occurred_at', (date '2026-08-22' + time '13:05') at time zone 'America/Puerto_Rico',
    'expected_event_id', (select id::text from public.attendance_events where shift_id = form_shift and event_type = 'lunch_in' and not exists (select 1 from public.attendance_events n where n.supersedes_event_id = attendance_events.id)))));
  perform public.correct_shift_attendance_punches(form_shift, 'missed_clock_out', null, second, jsonb_build_array(jsonb_build_object('event_type','clock_out','occurred_at', (date '2026-08-22' + time '17:00') at time zone 'America/Puerto_Rico', 'expected_event_id', null)));
  select id into effective_id from public.attendance_events where shift_id = form_shift and event_type = 'clock_in' and not exists (select 1 from public.attendance_events n where n.supersedes_event_id = attendance_events.id);
  begin
    perform public.correct_shift_attendance_punches(form_shift, 'other', '   ', second, jsonb_build_array(jsonb_build_object('event_type','clock_in','occurred_at', (date '2026-08-22' + time '08:04') at time zone 'America/Puerto_Rico', 'expected_event_id', effective_id)));
    raise exception 'OTHER_WITHOUT_EXPLANATION';
  exception when sqlstate '22023' then if sqlerrm <> 'EXPLANATION_REQUIRED' then raise; end if; end;
  begin
    perform public.correct_shift_attendance_punches(form_shift, '', 'Texto', second, jsonb_build_array(jsonb_build_object('event_type','clock_in','occurred_at', (date '2026-08-22' + time '08:04') at time zone 'America/Puerto_Rico', 'expected_event_id', effective_id)));
    raise exception 'EMPTY_MOTIVE';
  exception when sqlstate '22023' then if sqlerrm <> 'REASON_REQUIRED' then raise; end if; end;
  begin
    perform public.correct_shift_attendance_punches(form_shift, 'fuera-de-catalogo', 'Texto', second, jsonb_build_array(jsonb_build_object('event_type','clock_in','occurred_at', (date '2026-08-22' + time '08:04') at time zone 'America/Puerto_Rico', 'expected_event_id', effective_id)));
    raise exception 'BAD_MOTIVE';
  exception when sqlstate '22023' then if sqlerrm <> 'REASON_NOT_ALLOWED' then raise; end if; end;
  begin
    perform public.correct_shift_attendance_punches(form_shift, 'missed_clock_in', null, null, jsonb_build_array(jsonb_build_object('event_type','clock_in','occurred_at', (date '2026-08-22' + time '08:04') at time zone 'America/Puerto_Rico', 'expected_event_id', effective_id)));
    raise exception 'EMPTY_AUTHORIZER';
  exception when sqlstate '22023' then if sqlerrm <> 'AUTHORIZER_REQUIRED' then raise; end if; end;
  begin
    perform public.correct_shift_attendance_punches(form_shift, 'missed_clock_in', null, 'e2500000-0000-4000-8000-000000000098', jsonb_build_array(jsonb_build_object('event_type','clock_in','occurred_at', (date '2026-08-22' + time '08:04') at time zone 'America/Puerto_Rico', 'expected_event_id', effective_id)));
    raise exception 'FOREIGN_AUTHORIZER';
  exception when sqlstate 'P0001' then if sqlerrm <> 'AUTHORIZER_NOT_FOUND' then raise; end if; end;
  if other_museum is not null and exists (select 1 from public.employees e where e.museum_id = other_museum and e.status = 'activo') then
    begin
      perform public.correct_shift_attendance_punches(form_shift, 'missed_clock_in', null, (select e.id from public.employees e where e.museum_id = other_museum and e.status = 'activo' limit 1), jsonb_build_array(jsonb_build_object('event_type','clock_in','occurred_at', (date '2026-08-22' + time '08:04') at time zone 'America/Puerto_Rico', 'expected_event_id', effective_id)));
      raise exception 'OTHER_MUSEUM_AUTHORIZER';
    exception when sqlstate 'P0001' then if sqlerrm <> 'AUTHORIZER_NOT_FOUND' then raise; end if; end;
  end if;
  perform public.correct_shift_attendance_punches(form_shift, 'other', 'Empleado indicó que olvidó realizar el ponche al comenzar su turno.', second, jsonb_build_array(jsonb_build_object('event_type','clock_in','occurred_at', (date '2026-08-22' + time '08:04') at time zone 'America/Puerto_Rico', 'expected_event_id', effective_id)));
  if not exists (
    select 1 from public.attendance_events original
    join public.attendance_events newer on newer.supersedes_event_id = original.id
    where original.shift_id = form_shift and original.event_type = 'clock_in' and newer.correction_request_id is not null
  ) then raise exception 'FORM_SUPERSEDE'; end if;
  if not exists (
    select 1 from public.attendance_correction_requests r
    where r.shift_id = form_shift and r.correction_motive = 'other' and r.direct_admin
      and r.correction_explanation = 'Empleado indicó que olvidó realizar el ponche al comenzar su turno.'
      and r.authorized_employee_id = second and r.requested_by = actor and r.decided_by = actor
      and r.corrected_event_id is not null
  ) then raise exception 'FORM_PERSISTENCE'; end if;
  history := public.list_shift_punch_history(form_shift);
  if not exists (
    select 1 from jsonb_array_elements(history) item
    where item->>'motive' = 'other'
      and item->>'explanation' = 'Empleado indicó que olvidó realizar el ponche al comenzar su turno.'
      and item->>'authorized_by' = (select trim(first_name || ' ' || last_name) from public.employees where id = second)
      and item->>'corrected_by' is not distinct from (select nullif(trim(full_name), '') from public.profiles where id = actor)
      and item->>'corrected_on' is not null
  ) then raise exception 'FORM_HISTORY %', history; end if;
  if second = employee then raise exception 'AUTHORIZER_NOT_DISTINCT'; end if;
  if (select count(distinct item->>'motive') from jsonb_array_elements(history) item where item->>'motive' in ('missed_clock_in','missed_lunch_out','missed_lunch_in','missed_clock_out')) <> 4 then raise exception 'FORM_MOTIVES'; end if;
  insert into public.attendance_correction_requests(
    museum_id, employee_id, shift_id, requested_event_type, requested_occurred_at,
    reason, status, requested_by, decided_by, decided_at, decision_reason, direct_admin
  ) values (
    museum, second, form_shift, 'clock_out', now(), 'Registro anterior', 'approved', actor, actor, now(), 'Registro anterior', true
  );
  if not exists (
    select 1 from jsonb_array_elements(public.list_shift_punch_history(form_shift)) item
    where item->>'motive' is null and item->>'explanation' is null and item->>'authorized_by' is null
      and coalesce(item->>'corrected_by', '') = coalesce((select nullif(trim(full_name), '') from public.profiles where id = actor), '')
  ) then raise exception 'OLD_HISTORY'; end if;
  if jsonb_typeof(public.list_attendance_correction_authorizers()) is distinct from 'array' then raise exception 'AUTHORIZER_LIST'; end if;
  if not exists (
    select 1 from jsonb_array_elements(public.list_attendance_correction_authorizers()) item where item->>'id' = second::text
  ) then raise exception 'AUTHORIZER_LIST_MEMBER'; end if;
  if (select access_profile from public.employees where id = employee) is distinct from 'gerente_administrativo' then raise exception 'GERENTE_PROFILE'; end if;
  if not exists (
    select 1 from jsonb_array_elements(public.list_attendance_correction_authorizers()) item where item->>'id' = employee::text
  ) then raise exception 'GERENTE_MISSING'; end if;
  insert into public.employees(museum_id, first_name, last_name, email, access_profile)
  values (museum, 'Perfil', 'Tecnico', 'attendance-form-it-' || gen_random_uuid()::text || '@example.invalid', 'it_programador')
  returning id into it_person;
  insert into public.employees(museum_id, first_name, last_name, email, access_profile)
  values (museum, 'Perfil', 'Asistente', 'attendance-form-assistant-' || gen_random_uuid()::text || '@example.invalid', 'asistente_administrativa')
  returning id into assistant;
  if exists (
    select 1 from jsonb_array_elements(public.list_attendance_correction_authorizers()) item
    where item->>'id' in (it_person::text, assistant::text)
  ) then raise exception 'UNAUTHORIZED_PROFILE_LISTED'; end if;
  select count(*) into before_events from public.attendance_events where shift_id = form_shift;
  begin
    perform public.correct_shift_attendance_punches(form_shift, 'missed_clock_in', null, it_person, jsonb_build_array(jsonb_build_object('event_type','clock_in','occurred_at', (date '2026-08-22' + time '08:06') at time zone 'America/Puerto_Rico', 'expected_event_id', effective_id)));
    raise exception 'IT_ALLOWED';
  exception when sqlstate 'P0001' then if sqlerrm <> 'AUTHORIZER_NOT_FOUND' then raise; end if; end;
  begin
    perform public.correct_shift_attendance_punches(form_shift, 'missed_clock_in', null, assistant, jsonb_build_array(jsonb_build_object('event_type','clock_in','occurred_at', (date '2026-08-22' + time '08:06') at time zone 'America/Puerto_Rico', 'expected_event_id', effective_id)));
    raise exception 'ASSISTANT_ALLOWED';
  exception when sqlstate 'P0001' then if sqlerrm <> 'AUTHORIZER_NOT_FOUND' then raise; end if; end;
  if (select count(*) from public.attendance_events where shift_id = form_shift) <> before_events then raise exception 'UNAUTHORIZED_MUTATED'; end if;

  if to_regprocedure('public.request_own_attendance_correction(uuid,text,timestamptz,text)') is not null
     and to_regprocedure('public.decide_attendance_correction(uuid,text,text)') is not null then
    insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, created_by)
    values ('e2500000-0000-4000-8000-000000000003', museum, employee, (date '2026-09-24' + time '08:00') at time zone 'America/Puerto_Rico', (date '2026-09-24' + time '17:00') at time zone 'America/Puerto_Rico', actor);
    payload := public.request_own_attendance_correction('e2500000-0000-4000-8000-000000000003', 'clock_in', (date '2026-09-24' + time '08:00') at time zone 'America/Puerto_Rico', 'Olvidé ponchar la entrada');
    if payload->>'status' is distinct from 'pending' then raise exception 'CASE_33 %', payload; end if;
    begin
      perform public.decide_attendance_correction((payload->>'id')::uuid, 'approved', 'No debe aprobarse sola');
      raise exception 'CASE_34_ALLOWED';
    exception when insufficient_privilege then
      if sqlerrm <> 'SELF_APPROVAL_FORBIDDEN' then raise; end if;
    end;
    if (select status from public.attendance_correction_requests where id = (payload->>'id')::uuid) is distinct from 'pending' then raise exception 'CASE_34_MUTATED'; end if;
  end if;
end
$punch$;
