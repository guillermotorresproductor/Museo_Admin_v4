-- Reclassification of a lone clock_out, excluded open time entries, and the
-- server sequence. Disposable rows only. Rolls back. Does not use 28 Sep 2026.

begin;

do $reclass$
declare
  actor uuid;
  museum uuid;
  manager uuid;
  puncher uuid;
  puncher_user uuid;
  tz text;
  radius integer;
  radius_after integer;
  lat double precision;
  lng double precision;
  presence jsonb;
  result jsonb;
  others_before integer;
  others_after integer;
  punch_shift uuid := 'a2810000-0000-4000-8000-000000000001';
  wrong_shift uuid := 'a2810000-0000-4000-8000-000000000002';
  blocked_shift uuid := 'a2810000-0000-4000-8000-000000000003';
  wrong_event uuid := 'a2810000-0000-4000-8000-000000000021';
  blocked_event uuid := 'a2810000-0000-4000-8000-000000000022';
  wrong_attempt uuid := 'a2810000-0000-4000-8000-000000000011';
  blocked_attempt uuid := 'a2810000-0000-4000-8000-000000000012';
  open_entry uuid := 'a2810000-0000-4000-8000-000000000031';
  excluded_entry uuid := 'a2810000-0000-4000-8000-000000000032';
  wrong_at timestamptz := (date '2027-11-02' + time '07:46:45') at time zone 'America/Puerto_Rico';
  corrected_at timestamptz := (date '2027-11-02' + time '07:46:00') at time zone 'America/Puerto_Rico';
  editor jsonb;
  history jsonb;
  original_type text;
  original_at timestamptz;
  original_supersedes uuid;
  new_event uuid;
  real_out uuid;
  lunch_out_id uuid;
  lunch_in_id uuid;
  moved_lunch uuid;
  index_before text;
  index_after text;
  real_at timestamptz := (date '2027-11-02' + time '17:00:00') at time zone 'America/Puerto_Rico';
  lunch_out_at timestamptz := (date '2027-11-02' + time '12:00:00') at time zone 'America/Puerto_Rico';
  lunch_in_at timestamptz := (date '2027-11-02' + time '13:00:00') at time zone 'America/Puerto_Rico';
  moved_lunch_at timestamptz := (date '2027-11-02' + time '12:05:00') at time zone 'America/Puerto_Rico';
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employees' and column_name = 'attendance_required'
  ) then
    alter table public.employees add column attendance_required boolean not null default true;
  end if;
  alter table public.employees disable trigger protect_employee_module_profile;
  select e.profile_id, e.museum_id, e.id into actor, museum, manager
    from public.employees e
    join public.profiles p on p.id = e.profile_id
   where e.status = 'activo' and p.status in ('active', 'activo')
   order by e.created_at
   limit 1;
  if actor is null then raise exception 'FIXTURE_MANAGER'; end if;
  select public.attendance_shift_timezone(museum) into tz;
  select indexdef into index_before from pg_indexes
   where schemaname = 'public' and indexname = 'attendance_events_original_type_idx';
  if index_before is null then raise exception 'INDEX_MISSING'; end if;
  select s.geofence_radius_meters, s.latitude, s.longitude
    into radius, lat, lng
    from public.attendance_settings s
   where s.museum_id = museum;
  if radius is null or lat is null or lng is null then raise exception 'FIXTURE_GEOFENCE'; end if;

  select e.id, e.profile_id into puncher, puncher_user
    from public.employees e
   where e.museum_id = museum and e.status = 'activo' and e.profile_id is not null
     and e.attendance_required
     and (select count(*) from public.employees same where same.museum_id = museum and same.profile_id = e.profile_id) = 1
     and not exists (
       select 1 from public.employee_time_entries t
        where t.employee_id = e.id and t.clock_out is null and t.excluded_at is null
     )
     and not exists (
       select 1 from public.employee_shifts s
        where s.employee_id = e.id and s.status = 'day_off'
          and s.shift_date = (now() at time zone tz)::date
     )
     and not exists (
       select 1 from public.employee_shifts s
        where s.employee_id = e.id and s.status = 'scheduled'
          and tstzrange(s.starts_at, s.ends_at, '[)') && tstzrange(now() - interval '1 minute', now() + interval '3 hours', '[)')
     )
   limit 1;
  if puncher is null then raise exception 'FIXTURE_PUNCHER'; end if;

  update public.employees set access_profile = 'gerente_administrativo' where id = manager;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);
  if not public.has_permission('attendance.punches.correct') then raise exception 'MANAGER_CANNOT_CORRECT'; end if;

  select count(*) into others_before
    from public.attendance_events ev
   where ev.employee_id <> puncher;

  presence := jsonb_build_object('method', 'geolocation', 'latitude', lat, 'longitude', lng, 'accuracy_meters', '5');
  insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, status, shift_date, created_by)
  values (
    punch_shift, museum, puncher, now() - interval '1 minute', now() + interval '3 hours', 'scheduled',
    ((now() - interval '1 minute') at time zone tz)::date, actor
  );

  result := public.record_employee_attendance(puncher_user, museum, 'clock_out', presence);
  if result->>'code' is distinct from 'INVALID_EVENT_SEQUENCE' then raise exception 'EMPTY_CLOCK_OUT_ALLOWED %', result; end if;
  if exists (select 1 from public.attendance_events where shift_id = punch_shift) then raise exception 'EMPTY_CLOCK_OUT_WROTE_EVENT'; end if;

  result := public.record_employee_attendance(puncher_user, museum, 'clock_in', presence);
  if result->>'ok' is distinct from 'true' or result->'event'->>'event_type' is distinct from 'clock_in' then
    raise exception 'EMPTY_CLOCK_IN_REJECTED %', result;
  end if;
  result := public.record_employee_attendance(puncher_user, museum, 'lunch_out', presence);
  if result->>'ok' is distinct from 'true' then raise exception 'LUNCH_OUT_REJECTED %', result; end if;
  result := public.record_employee_attendance(puncher_user, museum, 'lunch_in', presence);
  if result->>'ok' is distinct from 'true' then raise exception 'LUNCH_IN_REJECTED %', result; end if;
  result := public.record_employee_attendance(puncher_user, museum, 'clock_out', presence);
  if result->>'ok' is distinct from 'true' or result->'event'->>'event_type' is distinct from 'clock_out' then
    raise exception 'SEQUENCE_CLOCK_OUT_REJECTED %', result;
  end if;

  insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, status, shift_date, created_by)
  values (
    blocked_shift, museum, puncher,
    (date '2027-11-03' + time '08:00') at time zone 'America/Puerto_Rico',
    (date '2027-11-03' + time '17:00') at time zone 'America/Puerto_Rico',
    'scheduled', date '2027-11-03', actor
  );
  insert into public.attendance_attempts(id, museum_id, employee_id, shift_id, actor_user_id, requested_event, occurred_at, result)
  values (blocked_attempt, museum, puncher, blocked_shift, puncher_user, 'clock_out', (date '2027-11-03' + time '07:46:45') at time zone 'America/Puerto_Rico', 'accepted');
  insert into public.attendance_events(id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by)
  values (blocked_event, museum, puncher, blocked_shift, blocked_attempt, 'clock_out', (date '2027-11-03' + time '07:46:45') at time zone 'America/Puerto_Rico', 'standard', 1, puncher_user);
  insert into public.employee_time_entries(id, museum_id, employee_id, clock_in, clock_out, source, sync_status, created_by, excluded_at)
  values (open_entry, museum, puncher, timestamptz '2027-10-01 12:00:00+00', null, 'instituva', 'not_configured', actor, null);
  begin
    perform public.correct_shift_attendance_punches(
      blocked_shift, 'other', 'No debe guardar mientras hay un fichaje abierto.', manager,
      jsonb_build_array(jsonb_build_object('event_type', 'clock_in', 'occurred_at', (date '2027-11-03' + time '07:46:00') at time zone 'America/Puerto_Rico', 'expected_event_id', null))
    );
    raise exception 'OPEN_ENTRY_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'TIME_ENTRY_NOT_RECONCILABLE' then raise; end if;
  end;
  if (select count(*) from public.attendance_events where shift_id = blocked_shift) <> 1 then raise exception 'OPEN_ENTRY_MUTATED'; end if;
  delete from public.employee_time_entries where id = open_entry;

  insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, status, shift_date, created_by)
  values (
    wrong_shift, museum, puncher,
    (date '2027-11-02' + time '08:00') at time zone 'America/Puerto_Rico',
    (date '2027-11-02' + time '17:00') at time zone 'America/Puerto_Rico',
    'scheduled', date '2027-11-02', actor
  );
  insert into public.attendance_attempts(id, museum_id, employee_id, shift_id, actor_user_id, requested_event, occurred_at, result)
  values (wrong_attempt, museum, puncher, wrong_shift, puncher_user, 'clock_out', wrong_at, 'accepted');
  insert into public.attendance_events(id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by)
  values (wrong_event, museum, puncher, wrong_shift, wrong_attempt, 'clock_out', wrong_at, 'standard', 1, puncher_user);
  insert into public.employee_time_entries(id, museum_id, employee_id, clock_in, clock_out, source, sync_status, created_by, excluded_at)
  values (excluded_entry, museum, puncher, timestamptz '2027-09-25 12:00:03+00', null, 'instituva', 'not_configured', actor, timestamptz '2027-09-27 15:47:44+00');

  result := public.correct_shift_attendance_punches(
    wrong_shift, 'other', 'El ponche de entrada fue registrado como salida.', manager,
    jsonb_build_array(jsonb_build_object('event_type', 'clock_in', 'occurred_at', corrected_at, 'expected_event_id', null))
  );
  if (result->>'clock_in')::timestamptz is distinct from corrected_at or result->>'clock_out' is not null then
    raise exception 'RECLASS_RESULT %', result;
  end if;

  select ev.event_type, ev.occurred_at, ev.supersedes_event_id
    into original_type, original_at, original_supersedes
    from public.attendance_events ev
   where ev.id = wrong_event;
  if original_type is distinct from 'clock_out' or original_at is distinct from wrong_at or original_supersedes is not null then
    raise exception 'ORIGINAL_CHANGED';
  end if;
  select ev.id into new_event
    from public.attendance_events ev
   where ev.shift_id = wrong_shift and ev.event_type = 'clock_in' and ev.supersedes_event_id = wrong_event;
  if new_event is null then raise exception 'SUPERSEDE_MISSING'; end if;
  if (select ev.occurred_at from public.attendance_events ev where ev.id = new_event) is distinct from corrected_at then
    raise exception 'CORRECTED_TIME';
  end if;
  if exists (
    select 1 from public.attendance_events ev
     where ev.shift_id = wrong_shift and ev.event_type = 'clock_out'
       and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id)
  ) then raise exception 'CLOCK_OUT_STILL_OPERATIVE'; end if;
  if not exists (
    select 1 from public.employee_time_entries t
     where t.employee_id = puncher and t.clock_in = corrected_at and t.clock_out is null and t.excluded_at is null
  ) then raise exception 'TIME_ENTRY_NOT_OPEN'; end if;
  if (select t.clock_out is null and t.excluded_at is not null from public.employee_time_entries t where t.id = excluded_entry) is not true then
    raise exception 'EXCLUDED_ENTRY_CHANGED';
  end if;
  if not exists (
    select 1 from public.attendance_correction_requests r
     where r.shift_id = wrong_shift and r.status = 'approved' and r.direct_admin
       and r.requested_event_type = 'clock_in' and r.original_event_id = wrong_event
       and r.corrected_event_id = new_event and r.correction_motive = 'other'
       and r.correction_explanation = 'El ponche de entrada fue registrado como salida.'
       and r.authorized_employee_id = manager
  ) then raise exception 'CORRECTION_REQUEST'; end if;
  if not exists (
    select 1 from public.attendance_attempts a
     where a.shift_id = wrong_shift and a.requested_event = 'clock_in' and a.result = 'accepted'
       and a.presence_method = 'administrative_correction' and a.reason_code = 'APPROVED_CORRECTION'
  ) then raise exception 'ADMIN_ATTEMPT'; end if;
  if not exists (
    select 1 from public.audit_logs al
     where al.action = 'ATTENDANCE_ADMIN_PUNCH_CORRECTED' and al.museum_id = museum
       and al.new_value->>'corrected_event_id' = new_event::text
       and al.old_value->>'original_event_id' = wrong_event::text
  ) then raise exception 'AUDIT'; end if;

  editor := public.list_shift_punch_editor(puncher, date '2027-11-02');
  if editor->'events'->'clock_in'->>'id' is distinct from new_event::text
     or editor->'events' ? 'clock_out' then
    raise exception 'EDITOR %', editor->'events';
  end if;
  select item into history
    from jsonb_array_elements(public.list_shift_punch_history(wrong_shift)) item
   where item->>'event_type' = 'clock_in' and item->>'motive' = 'other';
  if history is null or history->>'authorized_by' is null or history->>'explanation' is null then
    raise exception 'HISTORY %', history;
  end if;

  perform public.correct_shift_attendance_punches(
    wrong_shift, 'missed_lunch_out', null, manager,
    jsonb_build_array(
      jsonb_build_object('event_type', 'lunch_out', 'occurred_at', lunch_out_at, 'expected_event_id', null),
      jsonb_build_object('event_type', 'lunch_in', 'occurred_at', lunch_in_at, 'expected_event_id', null)
    )
  );
  result := public.correct_shift_attendance_punches(
    wrong_shift, 'missed_clock_out', null, manager,
    jsonb_build_array(jsonb_build_object('event_type', 'clock_out', 'occurred_at', real_at, 'expected_event_id', null))
  );
  if (result->>'clock_out')::timestamptz is distinct from real_at then raise exception 'REAL_CLOCK_OUT %', result; end if;
  select ev.id into real_out
    from public.attendance_events ev
   where ev.shift_id = wrong_shift and ev.event_type = 'clock_out' and ev.occurred_at = real_at
     and ev.supersedes_event_id = wrong_event;
  if real_out is null then raise exception 'REAL_CLOCK_OUT_LINK'; end if;
  if exists (
    select 1 from public.attendance_events newer where newer.supersedes_event_id = real_out
  ) then raise exception 'REAL_CLOCK_OUT_NOT_OPERATIVE'; end if;
  select ev.event_type, ev.occurred_at, ev.supersedes_event_id
    into original_type, original_at, original_supersedes
    from public.attendance_events ev where ev.id = wrong_event;
  if original_type is distinct from 'clock_out' or original_at is distinct from wrong_at or original_supersedes is not null then
    raise exception 'ORIGINAL_CHANGED_AFTER_REAL_EXIT';
  end if;
  if (select ev.correction_request_id from public.attendance_events ev where ev.id = wrong_event) is not null then
    raise exception 'ORIGINAL_REQUEST_WRITTEN';
  end if;
  if (
    select count(*) from public.attendance_events ev
     where ev.shift_id = wrong_shift and ev.event_type = 'clock_out' and ev.supersedes_event_id is null
  ) <> 1 then raise exception 'SECOND_ORIGINAL_CLOCK_OUT'; end if;
  select ev.id into lunch_out_id
    from public.attendance_events ev
   where ev.shift_id = wrong_shift and ev.event_type = 'lunch_out'
     and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id);
  select ev.id into lunch_in_id
    from public.attendance_events ev
   where ev.shift_id = wrong_shift and ev.event_type = 'lunch_in'
     and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id);
  if (select ev.occurred_at from public.attendance_events ev where ev.id = new_event) <> corrected_at
     or (select ev.occurred_at from public.attendance_events ev where ev.id = lunch_out_id) <> lunch_out_at
     or (select ev.occurred_at from public.attendance_events ev where ev.id = lunch_in_id) <> lunch_in_at
     or (select ev.occurred_at from public.attendance_events ev where ev.id = real_out) <> real_at
     or corrected_at >= lunch_out_at or lunch_out_at >= lunch_in_at or lunch_in_at >= real_at then
    raise exception 'EFFECTIVE_SEQUENCE';
  end if;
  if not exists (
    select 1 from public.employee_time_entries t
     where t.employee_id = puncher and t.clock_in = corrected_at and t.clock_out = real_at and t.excluded_at is null
  ) then raise exception 'TIME_ENTRY_NOT_CLOSED'; end if;
  if (select t.clock_out is null and t.excluded_at is not null from public.employee_time_entries t where t.id = excluded_entry) is not true then
    raise exception 'EXCLUDED_ENTRY_CHANGED_LATER';
  end if;
  if not exists (
    select 1 from public.attendance_correction_requests r
     where r.corrected_event_id = real_out and r.original_event_id = wrong_event
       and r.requested_event_type = 'clock_out' and r.status = 'approved' and r.direct_admin
       and r.correction_motive = 'missed_clock_out' and r.authorized_employee_id = manager
  ) then raise exception 'REAL_EXIT_REQUEST'; end if;
  if not exists (
    select 1 from public.attendance_attempts a
     where a.id = (select ev.attempt_id from public.attendance_events ev where ev.id = real_out)
       and a.presence_method = 'administrative_correction' and a.reason_code = 'APPROVED_CORRECTION'
       and a.requested_event = 'clock_out' and a.result = 'accepted'
  ) then raise exception 'REAL_EXIT_ATTEMPT'; end if;
  if not exists (
    select 1 from public.audit_logs al
     where al.action = 'ATTENDANCE_ADMIN_PUNCH_CORRECTED'
       and al.new_value->>'corrected_event_id' = real_out::text
       and al.old_value->>'original_event_id' = wrong_event::text
  ) then raise exception 'REAL_EXIT_AUDIT'; end if;
  select item into history
    from jsonb_array_elements(public.list_shift_punch_history(wrong_shift)) item
   where item->>'event_type' = 'clock_out' and item->>'motive' = 'missed_clock_out';
  if (history->>'original_at')::timestamptz is distinct from wrong_at
     or (history->>'corrected_at')::timestamptz is distinct from real_at
     or history->>'authorized_by' is null then
    raise exception 'REAL_EXIT_HISTORY %', history;
  end if;

  perform public.correct_shift_attendance_punches(
    wrong_shift, 'missed_lunch_out', null, manager,
    jsonb_build_array(jsonb_build_object('event_type', 'lunch_out', 'occurred_at', moved_lunch_at, 'expected_event_id', lunch_out_id))
  );
  select ev.id into moved_lunch
    from public.attendance_events ev
   where ev.supersedes_event_id = lunch_out_id and ev.event_type = 'lunch_out' and ev.occurred_at = moved_lunch_at;
  if moved_lunch is null then raise exception 'SAME_TYPE_CORRECTION'; end if;
  if (
    select count(*) from public.attendance_events ev
     where ev.shift_id = wrong_shift and ev.event_type = 'lunch_out'
       and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id)
  ) <> 1 or (
    select count(*) from public.attendance_events ev
     where ev.shift_id = wrong_shift and ev.event_type = 'clock_out'
       and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id)
  ) <> 1 then raise exception 'TWO_OPERATIVE'; end if;
  begin
    perform public.correct_shift_attendance_punches(
      wrong_shift, 'missed_clock_out', null, manager,
      jsonb_build_array(jsonb_build_object('event_type', 'clock_out', 'occurred_at', real_at + interval '5 minutes', 'expected_event_id', null))
    );
    raise exception 'SECOND_OPERATIVE_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'ATTENDANCE_CHANGED_RELOAD' then raise; end if;
  end;
  select indexdef into index_after from pg_indexes
   where schemaname = 'public' and indexname = 'attendance_events_original_type_idx';
  if index_after is distinct from index_before then raise exception 'INDEX_CHANGED'; end if;

  select count(*) into others_after from public.attendance_events ev where ev.employee_id <> puncher;
  if others_after <> others_before then raise exception 'OTHER_EMPLOYEES_CHANGED'; end if;
  select s.geofence_radius_meters into radius_after from public.attendance_settings s where s.museum_id = museum;
  if radius_after is distinct from radius then raise exception 'RADIUS_CHANGED'; end if;
  raise notice 'PUNCH_RECLASSIFY_OK';
end
$reclass$;

rollback;
