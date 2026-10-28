set time zone 'UTC';

do $permissions$
declare actor uuid := '33333333-3333-4333-8333-333333333333';
begin
  perform public.test_fail(extract(isodow from date '2027-06-07') = 1, 'fixture date is not Monday');
  perform public.test_as(actor);
  perform public.test_fail(public.has_permission('schedules.manage'), 'director denied');
  perform public.test_as('44444444-4444-4444-8444-444444444444');
  perform public.test_fail(public.has_permission('schedules.manage'), 'manager denied');
  perform public.test_as('77777777-7777-4777-8777-777777777777');
  perform public.test_fail(public.has_permission('schedules.manage'), 'general admin denied');
  perform public.test_as('88888888-8888-4888-8888-888888888888');
  perform public.test_fail(not public.has_permission('schedules.manage'), 'assistant allowed');
  perform public.test_as('99999999-9999-4999-8999-999999999999');
  perform public.test_fail(not public.has_permission('schedules.manage'), 'maintenance allowed');
  perform public.test_as('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  perform public.test_fail(not public.has_permission('schedules.manage'), 'guide allowed');
  perform public.test_as('66666666-6666-4666-8666-666666666666');
  perform public.test_fail(not public.has_permission('schedules.manage'), 'usher allowed to manage');
  perform public.test_fail(public.has_permission('schedules.read.self'), 'usher cannot read own schedule');
  begin
    perform public.save_schedule_week_draft('2027-06-07', '[]'::jsonb);
    raise exception 'FAIL: usher saved a draft';
  exception when insufficient_privilege then
    if sqlerrm not like '%FORBIDDEN%' then raise exception 'FAIL: %', sqlerrm; end if;
  end;
  perform public.test_as(actor);
  insert into public.user_permissions(user_id, museum_id, permission_id, effect)
  values (actor, '11111111-1111-4111-8111-111111111111', '10101010-1010-4010-8010-101010101010', 'deny');
  perform public.test_fail(not public.has_permission('schedules.manage'), 'explicit deny ignored');
  delete from public.user_permissions where user_id = actor and effect = 'deny';
  perform public.test_fail(public.has_permission('schedules.manage'), 'director lost access after deny');
end
$permissions$;

do $rejects$
declare director_employee uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
declare subject uuid := '55555555-5555-4555-8555-555555555555';
begin
  perform public.test_as('33333333-3333-4333-8333-333333333333');
  begin
    perform public.save_schedule_week_draft('2027-06-07', jsonb_build_array(jsonb_build_object(
      'employeeId', director_employee, 'date', '2027-06-07', 'dayOff', false,
      'start', '08:00', 'end', '17:00', 'lunch', 60, 'reason', '', 'baseline', 'none')));
    raise exception 'FAIL: self edit accepted';
  exception when insufficient_privilege then
    if sqlerrm not like '%SHIFT_SELF_FORBIDDEN%' then raise exception 'FAIL: %', sqlerrm; end if;
  end;
  begin
    perform public.save_schedule_week_draft('2027-06-07', jsonb_build_array(jsonb_build_object(
      'employeeId', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'date', '2027-06-07', 'dayOff', false,
      'start', '08:00', 'end', '17:00', 'lunch', 60, 'reason', '', 'baseline', 'none')));
    raise exception 'FAIL: foreign museum accepted';
  exception when insufficient_privilege then
    if sqlerrm not like '%EMPLOYEE_NOT_ACTIVE%' then raise exception 'FAIL: %', sqlerrm; end if;
  end;
  begin
    perform public.save_schedule_week_draft('2027-06-07', jsonb_build_array(jsonb_build_object(
      'employeeId', 'abababab-abab-4aba-8aba-abababababab', 'date', '2027-06-07', 'dayOff', false,
      'start', '08:00', 'end', '17:00', 'lunch', 60, 'reason', '', 'baseline', 'none')));
    raise exception 'FAIL: inactive employee accepted';
  exception when insufficient_privilege then
    if sqlerrm not like '%EMPLOYEE_NOT_ACTIVE%' then raise exception 'FAIL: %', sqlerrm; end if;
  end;
  begin
    perform public.save_schedule_week_draft('2027-06-07', jsonb_build_array(jsonb_build_object(
      'employeeId', subject, 'date', '2027-06-07', 'dayOff', false,
      'start', '08:00', 'end', '18:00', 'lunch', 60, 'reason', '', 'baseline', 'none')));
    raise exception 'FAIL: nine hour shift accepted';
  exception when invalid_parameter_value then
    if sqlerrm not like '%INVALID_HOURS%' then raise exception 'FAIL: %', sqlerrm; end if;
  end;
  begin
    perform public.save_schedule_week_draft('2027-06-07', jsonb_build_array(
      jsonb_build_object('employeeId', subject, 'date', '2027-06-07', 'dayOff', false, 'start', '08:00', 'end', '17:00', 'lunch', 60, 'reason', '', 'baseline', 'none'),
      jsonb_build_object('employeeId', subject, 'date', '2027-06-07', 'dayOff', false, 'start', '18:00', 'end', '22:00', 'lunch', 0, 'reason', '', 'baseline', 'none')
    ));
    raise exception 'FAIL: duplicate day accepted';
  exception when invalid_parameter_value then
    if sqlerrm not like '%DUPLICATE_DAY%' then raise exception 'FAIL: %', sqlerrm; end if;
  end;
  perform public.test_fail((select count(*) from public.employee_shifts where employee_id = subject) = 0, 'rejected drafts wrote official shifts');
end
$rejects$;

do $publish_week$
declare
  director uuid := '33333333-3333-4333-8333-333333333333';
  subject uuid := '55555555-5555-4555-8555-555555555555';
  items jsonb := '[]'::jsonb;
  saved jsonb;
  published jsonb;
  listed jsonb;
  i int;
  before_count int;
begin
  perform public.test_as(director);
  for i in 0..3 loop
    items := items || jsonb_build_array(jsonb_build_object(
      'employeeId', subject, 'date', (date '2027-06-07' + i), 'dayOff', false,
      'start', '13:00', 'end', '22:00', 'lunch', 60, 'reason', 'Tarde', 'baseline', 'none'));
  end loop;
  items := items || jsonb_build_array(
    jsonb_build_object('employeeId', subject, 'date', '2027-06-11', 'dayOff', false, 'start', '22:00', 'end', '07:00', 'lunch', 60, 'reason', 'Noche', 'baseline', 'none'),
    jsonb_build_object('employeeId', subject, 'date', '2027-06-12', 'dayOff', true, 'reason', 'Descanso semanal', 'baseline', 'none')
  );
  saved := public.save_schedule_week_draft('2027-06-07', items);
  perform public.test_fail((select count(*) from public.employee_shifts where employee_id = subject) = 0, 'draft wrote official shifts');
  perform public.test_as('66666666-6666-4666-8666-666666666666');
  begin
    perform public.get_schedule_week_draft('2027-06-07');
    raise exception 'FAIL: employee read the draft';
  exception when insufficient_privilege then
    if sqlerrm not like '%FORBIDDEN%' then raise exception 'FAIL: %', sqlerrm; end if;
  end;
  listed := public.list_my_assigned_shifts('2027-06-07', '2027-06-13');
  perform public.test_fail(listed::text not like '%13:00%', 'draft hours visible in mi espacio');
  perform public.test_as(director);
  published := public.publish_schedule_week((saved->>'id')::uuid, (saved->>'revision')::integer);
  perform public.test_fail((published->>'status') = 'published', 'publish status');
  perform public.test_fail((select count(*) from public.employee_shifts where employee_id = subject and status = 'scheduled') = 5, 'scheduled count');
  perform public.test_fail((select count(*) from public.employee_shifts where employee_id = subject and status = 'day_off') = 1, 'day off missing');
  perform public.test_fail((
    select floor(extract(epoch from (ends_at - starts_at)) / 60)::integer = 540 and expected_lunch_minutes = 60
      and (ends_at at time zone 'America/Puerto_Rico')::date = shift_date + 1
      and to_char(starts_at at time zone 'America/Puerto_Rico', 'HH24:MI') = '22:00'
    from public.employee_shifts
    where employee_id = subject and shift_date = '2027-06-11' and status = 'scheduled'
  ), 'night shift');
  perform public.test_fail((
    select coalesce(sum(floor(extract(epoch from (ends_at - starts_at)) / 60)::integer - expected_lunch_minutes), 0) = 2400
    from public.employee_shifts
    where employee_id = subject and status = 'scheduled' and shift_date between '2027-06-07' and '2027-06-13'
  ), 'week is not 40 net hours');
  perform public.test_fail(exists (
    select 1 from public.audit_logs
    where action = 'SCHEDULE_WEEK_PUBLISHED' and actor_user_id = director and record_id = (saved->>'id')::uuid
  ), 'week audit missing');
  perform public.test_fail(exists (
    select 1 from public.audit_logs where action = 'SHIFT_SCHEDULED' and actor_user_id = director
  ), 'shift audit missing');
  perform public.test_as('66666666-6666-4666-8666-666666666666');
  listed := public.list_my_assigned_shifts('2027-06-07', '2027-06-13');
  perform public.test_fail(listed::text like '%13:00%' and listed::text like '%22:00%' and listed::text like '%day_off%', 'mi espacio missing published shifts');
  perform public.test_as(director);
  before_count := (select count(*) from public.employee_shifts where employee_id = subject);
  begin
    perform public.publish_schedule_week((published->>'draft_id')::uuid, (published->>'revision')::integer);
    raise exception 'FAIL: same draft published twice';
  exception when raise_exception then
    if sqlerrm not like '%DRAFT_CONFLICT%' then raise exception 'FAIL: %', sqlerrm; end if;
  end;
  perform public.test_fail((select count(*) from public.employee_shifts where employee_id = subject) = before_count, 'second publish changed shifts');
end
$publish_week$;

do $weekly_limit$
declare
  subject uuid := 'e0e0e0e0-e0e0-40e0-80e0-e0e0e0e0e0e0';
  items jsonb := '[]'::jsonb;
  saved jsonb;
  i int;
begin
  perform public.test_as('33333333-3333-4333-8333-333333333333');
  for i in 0..5 loop
    items := items || jsonb_build_array(jsonb_build_object(
      'employeeId', subject, 'date', (date '2027-06-14' + i), 'dayOff', false,
      'start', '08:00', 'end', '17:00', 'lunch', 60, 'reason', 'Semana larga', 'baseline', 'none'));
  end loop;
  begin
    perform public.save_schedule_week_draft('2027-06-14', items);
    raise exception 'FAIL: 48 ordinary hours accepted';
  exception when raise_exception then
    if sqlerrm not like '%WEEKLY_SCHEDULE_LIMIT%' then raise exception 'FAIL: %', sqlerrm; end if;
  end;
  perform public.test_fail((select count(*) from public.employee_shifts where employee_id = subject) = 0, 'rejected week wrote shifts');
  for i in 0..5 loop
    items := jsonb_set(items, array[i::text, 'reason'], '"Cobertura con autorización excepcional"');
  end loop;
  saved := public.save_schedule_week_draft('2027-06-14', items);
  perform public.publish_schedule_week((saved->>'id')::uuid, (saved->>'revision')::integer);
  perform public.test_fail((
    select coalesce(sum(floor(extract(epoch from (ends_at - starts_at)) / 60)::integer - expected_lunch_minutes), 0) = 2880
    from public.employee_shifts where employee_id = subject and status = 'scheduled'
  ), 'exceptional week minutes');
end
$weekly_limit$;

do $reorder$
declare
  emp uuid := 'a3a3a3a3-a3a3-43a3-83a3-a3a3a3a3a3a3';
  monday_id uuid;
  monday_at timestamptz;
  saved jsonb;
begin
  perform public.test_as('33333333-3333-4333-8333-333333333333');
  insert into public.employee_shifts(museum_id, employee_id, shift_date, starts_at, ends_at, expected_lunch_minutes, status, created_by)
  select '11111111-1111-4111-8111-111111111111', emp, g::date,
         (g::date + time '08:00') at time zone 'America/Puerto_Rico',
         (g::date + time '17:00') at time zone 'America/Puerto_Rico',
         60, 'scheduled', '33333333-3333-4333-8333-333333333333'
  from generate_series(date '2027-06-21', date '2027-06-25', interval '1 day') g;
  select id, updated_at into monday_id, monday_at
  from public.employee_shifts where employee_id = emp and shift_date = '2027-06-21';
  saved := public.save_schedule_week_draft('2027-06-21', jsonb_build_array(
    jsonb_build_object('employeeId', emp, 'date', '2027-06-21', 'dayOff', false, 'start', '08:00', 'end', '13:00', 'lunch', 60,
      'reason', 'Menos horas el lunes', 'baseline', 'scheduled', 'expectedShiftId', monday_id, 'expectedUpdatedAt', monday_at),
    jsonb_build_object('employeeId', emp, 'date', '2027-06-26', 'dayOff', false, 'start', '08:00', 'end', '13:00', 'lunch', 60,
      'reason', 'Sabado corto', 'baseline', 'none')
  ));
  perform public.publish_schedule_week((saved->>'id')::uuid, (saved->>'revision')::integer);
  perform public.test_fail((
    select coalesce(sum(floor(extract(epoch from (ends_at - starts_at)) / 60)::integer - expected_lunch_minutes), 0) = 2400
    from public.employee_shifts
    where employee_id = emp and status = 'scheduled' and shift_date between '2027-06-21' and '2027-06-27'
  ), 'reordered week is not 40 hours');
end
$reorder$;

do $conflict$
declare
  emp uuid := 'f0f0f0f0-f0f0-40f0-80f0-f0f0f0f0f0f0';
  shift_id uuid;
  shift_at timestamptz;
  saved jsonb;
begin
  perform public.test_as('33333333-3333-4333-8333-333333333333');
  insert into public.employee_shifts(museum_id, employee_id, shift_date, starts_at, ends_at, expected_lunch_minutes, status, created_by)
  values ('11111111-1111-4111-8111-111111111111', emp, '2027-06-28',
          (timestamp '2027-06-28 08:00') at time zone 'America/Puerto_Rico',
          (timestamp '2027-06-28 17:00') at time zone 'America/Puerto_Rico',
          60, 'scheduled', '33333333-3333-4333-8333-333333333333')
  returning id, updated_at into shift_id, shift_at;
  saved := public.save_schedule_week_draft('2027-06-28', jsonb_build_array(jsonb_build_object(
    'employeeId', emp, 'date', '2027-06-28', 'dayOff', false, 'start', '09:00', 'end', '18:00', 'lunch', 60,
    'reason', 'Cambio de entrada', 'baseline', 'scheduled', 'expectedShiftId', shift_id, 'expectedUpdatedAt', shift_at)));
  update public.employee_shifts set updated_at = updated_at + interval '2 seconds' where id = shift_id;
  begin
    perform public.publish_schedule_week((saved->>'id')::uuid, (saved->>'revision')::integer);
    raise exception 'FAIL: stale shift published';
  exception when raise_exception then
    if sqlerrm not like '%SHIFT_CONFLICT%' then raise exception 'FAIL: %', sqlerrm; end if;
  end;
  perform public.test_fail(
    (select to_char(starts_at at time zone 'America/Puerto_Rico', 'HH24:MI') from public.employee_shifts where id = shift_id) = '08:00',
    'conflict publish changed the official shift');
  perform public.test_fail((select state from public.schedule_week_drafts where id = (saved->>'id')::uuid) = 'draft', 'conflict marked the draft published');
end
$conflict$;

do $completed$
declare emp uuid := 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1';
declare shift_id uuid;
begin
  perform public.test_as('33333333-3333-4333-8333-333333333333');
  insert into public.employee_shifts(museum_id, employee_id, shift_date, starts_at, ends_at, expected_lunch_minutes, status, created_by)
  values ('11111111-1111-4111-8111-111111111111', emp, '2027-07-05',
          (timestamp '2027-07-05 08:00') at time zone 'America/Puerto_Rico',
          (timestamp '2027-07-05 17:00') at time zone 'America/Puerto_Rico',
          60, 'completed', '33333333-3333-4333-8333-333333333333')
  returning id into shift_id;
  begin
    perform public.save_schedule_week_draft('2027-07-05', jsonb_build_array(jsonb_build_object(
      'employeeId', emp, 'date', '2027-07-05', 'dayOff', false, 'start', '09:00', 'end', '18:00', 'lunch', 60,
      'reason', 'No debe entrar', 'baseline', 'none')));
    raise exception 'FAIL: completed shift accepted';
  exception when raise_exception then
    if sqlerrm not like '%COMPLETED_SHIFT_LOCKED%' then raise exception 'FAIL: %', sqlerrm; end if;
  end;
  perform public.test_fail((select status from public.employee_shifts where id = shift_id) = 'completed', 'completed shift was rewritten');
end
$completed$;

do $started$
declare
  emp uuid := '99999999-9999-4999-8999-999999999991';
  today date := (now() at time zone 'America/Puerto_Rico')::date;
  week date := today - (extract(isodow from today)::integer - 1);
  shift_id uuid;
  original timestamptz;
begin
  perform public.test_as('33333333-3333-4333-8333-333333333333');
  insert into public.employee_shifts(museum_id, employee_id, shift_date, starts_at, ends_at, expected_lunch_minutes, status, created_by)
  values ('11111111-1111-4111-8111-111111111111', emp, today, now() - interval '30 minutes', now() + interval '6 hours',
          60, 'scheduled', '33333333-3333-4333-8333-333333333333')
  returning id, starts_at into shift_id, original;
  begin
    perform public.save_schedule_week_draft(week, jsonb_build_array(jsonb_build_object(
      'employeeId', emp, 'date', today, 'dayOff', false, 'start', '18:00', 'end', '23:00', 'lunch', 0,
      'reason', 'Turno ya iniciado', 'baseline', 'scheduled', 'expectedShiftId', shift_id, 'expectedUpdatedAt', original)));
    raise exception 'FAIL: started shift accepted';
  exception when raise_exception then
    if sqlerrm not like '%SHIFT_LOCKED%' then raise exception 'FAIL: %', sqlerrm; end if;
  end;
  perform public.test_fail((select starts_at = original from public.employee_shifts where id = shift_id), 'started shift changed');
end
$started$;

do $overlap$
declare emp uuid := 'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2';
begin
  perform public.test_as('33333333-3333-4333-8333-333333333333');
  insert into public.employee_shifts(museum_id, employee_id, shift_date, starts_at, ends_at, expected_lunch_minutes, status, created_by)
  values ('11111111-1111-4111-8111-111111111111', emp, '2027-06-06',
          (timestamp '2027-06-06 22:00') at time zone 'America/Puerto_Rico',
          (timestamp '2027-06-07 07:00') at time zone 'America/Puerto_Rico',
          60, 'scheduled', '33333333-3333-4333-8333-333333333333');
  begin
    perform public.save_schedule_week_draft('2027-06-07', jsonb_build_array(jsonb_build_object(
      'employeeId', emp, 'date', '2027-06-07', 'dayOff', false, 'start', '05:00', 'end', '13:00', 'lunch', 0,
      'reason', '', 'baseline', 'none')));
    raise exception 'FAIL: overlap accepted';
  exception when exclusion_violation then
    if sqlerrm not like '%SHIFT_OVERLAP%' then raise exception 'FAIL: %', sqlerrm; end if;
  end;
  perform public.test_fail((select count(*) from public.employee_shifts where employee_id = emp and shift_date = '2027-06-07') = 0, 'overlap wrote Monday');
end
$overlap$;

do $revision$
declare saved jsonb; again jsonb;
begin
  perform public.test_as('33333333-3333-4333-8333-333333333333');
  saved := public.save_schedule_week_draft('2027-07-19', jsonb_build_array(jsonb_build_object(
    'employeeId', '55555555-5555-4555-8555-555555555555', 'date', '2027-07-19', 'dayOff', false,
    'start', '08:00', 'end', '17:00', 'lunch', 60, 'reason', '', 'baseline', 'none')));
  again := public.save_schedule_week_draft('2027-07-19', jsonb_build_array(jsonb_build_object(
    'employeeId', '55555555-5555-4555-8555-555555555555', 'date', '2027-07-19', 'dayOff', false,
    'start', '09:00', 'end', '18:00', 'lunch', 60, 'reason', '', 'baseline', 'none')),
    (saved->>'id')::uuid, (saved->>'revision')::integer);
  begin
    perform public.save_schedule_week_draft('2027-07-19', jsonb_build_array(jsonb_build_object(
      'employeeId', '55555555-5555-4555-8555-555555555555', 'date', '2027-07-19', 'dayOff', false,
      'start', '10:00', 'end', '19:00', 'lunch', 60, 'reason', '', 'baseline', 'none')),
      (saved->>'id')::uuid, (saved->>'revision')::integer);
    raise exception 'FAIL: stale revision accepted';
  exception when raise_exception then
    if sqlerrm not like '%DRAFT_CONFLICT%' then raise exception 'FAIL: %', sqlerrm; end if;
  end;
  perform public.test_fail((select starts_local = time '09:00' from public.schedule_week_draft_items where draft_id = (again->>'id')::uuid), 'stale save replaced the draft');
end
$revision$;

do $discard$
declare saved jsonb;
begin
  perform public.test_as('44444444-4444-4444-8444-444444444444');
  saved := public.save_schedule_week_draft('2027-07-26', jsonb_build_array(jsonb_build_object(
    'employeeId', '55555555-5555-4555-8555-555555555555', 'date', '2027-07-26', 'dayOff', false,
    'start', '08:00', 'end', '17:00', 'lunch', 60, 'reason', '', 'baseline', 'none')));
  perform public.discard_schedule_week_draft((saved->>'id')::uuid, (saved->>'revision')::integer);
  perform public.test_fail((select state from public.schedule_week_drafts where id = (saved->>'id')::uuid) = 'discarded', 'discard state');
  perform public.test_fail((select count(*) from public.employee_shifts where employee_id = '55555555-5555-4555-8555-555555555555' and shift_date = '2027-07-26') = 0, 'discard wrote a shift');
  perform public.test_as('33333333-3333-4333-8333-333333333333');
  perform public.test_fail((public.get_schedule_week_draft('2027-07-26')->>'id') is null, 'discarded draft still loads');
end
$discard$;

do $seven_hours$
declare saved jsonb;
begin
  perform public.test_as('33333333-3333-4333-8333-333333333333');
  saved := public.save_schedule_week_draft('2027-08-09', jsonb_build_array(jsonb_build_object(
    'employeeId', '55555555-5555-4555-8555-555555555555', 'date', '2027-08-09', 'dayOff', false,
    'start', '13:00', 'end', '21:00', 'lunch', 60, 'reason', '', 'baseline', 'none')));
  perform public.publish_schedule_week((saved->>'id')::uuid, (saved->>'revision')::integer);
  perform public.test_fail((
    select floor(extract(epoch from (ends_at - starts_at)) / 60)::integer = 480 and expected_lunch_minutes = 60
    from public.employee_shifts
    where employee_id = '55555555-5555-4555-8555-555555555555' and shift_date = '2027-08-09' and status = 'scheduled'
  ), 'seven net hours');
end
$seven_hours$;

do $rollback$
declare
  emp uuid := 'b0b0b0b0-b0b0-40b0-80b0-b0b0b0b0b0b0';
  saved jsonb;
begin
  perform public.test_as('33333333-3333-4333-8333-333333333333');
  truncate public.test_shift_calls;
  saved := public.save_schedule_week_draft('2027-07-12', jsonb_build_array(
    jsonb_build_object('employeeId', emp, 'date', '2027-07-12', 'dayOff', false, 'start', '08:00', 'end', '17:00', 'lunch', 60, 'reason', '', 'baseline', 'none'),
    jsonb_build_object('employeeId', emp, 'date', '2027-07-13', 'dayOff', false, 'start', '08:00', 'end', '17:00', 'lunch', 60, 'reason', '', 'baseline', 'none')
  ));
  alter function public.schedule_employee_shift(uuid, date, time, time, uuid, integer, boolean, text, timestamptz, text)
    rename to schedule_employee_shift_core;
  create function public.schedule_employee_shift(
    p_employee_id uuid, p_shift_date date, p_starts_local time, p_ends_local time,
    p_shift_id uuid, p_expected_lunch_minutes integer, p_set_lunch boolean,
    p_shift_type text, p_expected_updated_at timestamptz, p_reason text
  ) returns jsonb
  language plpgsql
  as $wrap$
  begin
    insert into public.test_shift_calls(n) values (1);
    if (select count(*) from public.test_shift_calls) > 1 then
      raise exception 'FORCED_BATCH_FAILURE';
    end if;
    return public.schedule_employee_shift_core(
      p_employee_id, p_shift_date, p_starts_local, p_ends_local, p_shift_id,
      p_expected_lunch_minutes, p_set_lunch, p_shift_type, p_expected_updated_at, p_reason
    );
  end
  $wrap$;
  begin
    perform public.publish_schedule_week((saved->>'id')::uuid, (saved->>'revision')::integer);
    raise exception 'FAIL: partial publish succeeded';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like '%FORCED_BATCH_FAILURE%' then raise exception 'FAIL: %', sqlerrm; end if;
  end;
  perform public.test_fail((select count(*) from public.employee_shifts where employee_id = emp) = 0, 'rollback left a shift');
  perform public.test_fail((select state from public.schedule_week_drafts where id = (saved->>'id')::uuid) = 'draft', 'rollback published the draft');
  drop function public.schedule_employee_shift(uuid, date, time, time, uuid, integer, boolean, text, timestamptz, text);
  alter function public.schedule_employee_shift_core(uuid, date, time, time, uuid, integer, boolean, text, timestamptz, text)
    rename to schedule_employee_shift;
end
$rollback$;

do $activity$
declare
  emp uuid := 'a3a3a3a3-a3a3-43a3-83a3-a3a3a3a3a3a3';
  shift_id uuid;
  shift_at timestamptz;
begin
  perform public.test_as('33333333-3333-4333-8333-333333333333');
  select id, updated_at into shift_id, shift_at
  from public.employee_shifts where employee_id = emp and shift_date = '2027-06-22' and status = 'scheduled';
  insert into public.attendance_events values ('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', shift_id, 'clock_in');
  begin
    perform public.save_schedule_week_draft('2027-06-21', jsonb_build_array(jsonb_build_object(
      'employeeId', emp, 'date', '2027-06-22', 'dayOff', false, 'start', '09:00', 'end', '18:00', 'lunch', 60,
      'reason', 'Tiene ponche', 'baseline', 'scheduled', 'expectedShiftId', shift_id, 'expectedUpdatedAt', shift_at)));
    raise exception 'FAIL: shift with attendance accepted';
  exception when raise_exception then
    if sqlerrm not like '%SHIFT_LOCKED%' then raise exception 'FAIL: %', sqlerrm; end if;
  end;
  perform public.test_fail((select to_char(starts_at at time zone 'America/Puerto_Rico', 'HH24:MI') from public.employee_shifts where id = shift_id) = '08:00', 'attendance shift was edited');
end
$activity$;

do $guards$
begin
  perform public.test_fail(not has_table_privilege('authenticated', 'public.schedule_week_drafts', 'select'), 'authenticated can read drafts');
  perform public.test_fail(not has_table_privilege('authenticated', 'public.schedule_week_draft_items', 'select'), 'authenticated can read draft items');
  perform public.test_fail(not has_table_privilege('anon', 'public.schedule_week_drafts', 'select'), 'anon can read drafts');
  perform public.test_fail(has_function_privilege('authenticated', 'public.publish_schedule_week(uuid,integer)', 'execute'), 'publish not executable');
  perform public.test_fail(has_function_privilege('authenticated', 'public.save_schedule_week_draft(date,jsonb,uuid,integer)', 'execute'), 'save not executable');
  perform public.test_fail(not has_function_privilege('anon', 'public.publish_schedule_week(uuid,integer)', 'execute'), 'anon can publish');
  perform public.test_fail(not has_function_privilege('authenticated', 'public.schedule_week_assert_plan(uuid,date,jsonb,text)', 'execute'), 'helper exposed');
  perform public.test_fail(position('schedule_week_draft' in pg_get_functiondef('public.list_my_assigned_shifts(date,date)'::regprocedure)) = 0, 'mi espacio reads drafts');
  perform public.test_fail((select value from public.test_state where key = 'punch') = (select clock_in::text || '|' || coalesce(clock_out::text, '') from public.employee_time_entries where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'), 'punch row changed');
  perform public.test_fail((select value from public.test_state where key = 'payroll') = (select amount::text from public.payroll_shift_days where id = 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2'), 'payroll row changed');
  perform public.test_fail((select count(*) from public.attendance_events) = 1, 'attendance events changed unexpectedly');
end
$guards$;
