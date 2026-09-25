-- Geofence acceptance may use a bounded GPS accuracy allowance.
-- The configured radius stays the direct rule. 70 m is only an absolute cap
-- on the reported point when accuracy compensation is used. No schema change.

create or replace function public.attendance_geofence_decision(
  distance_meters double precision,
  accuracy_text text,
  radius_meters integer
) returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  max_geofence_distance_meters constant double precision := 70;
  max_geolocation_accuracy_meters constant double precision := 40;
  accuracy_meters double precision;
begin
  if distance_meters is null or radius_meters is null then
    return 'reject';
  end if;
  if distance_meters <= radius_meters then
    return 'direct_geofence';
  end if;
  if accuracy_text is null or accuracy_text !~ '^[0-9]+(\.[0-9]+)?$' then
    return 'reject';
  end if;
  accuracy_meters := accuracy_text::double precision;
  if accuracy_meters > max_geolocation_accuracy_meters
     or distance_meters > max_geofence_distance_meters
     or greatest(distance_meters - accuracy_meters, 0) > radius_meters then
    return 'reject';
  end if;
  return 'accuracy_compensated';
end
$$;

revoke all on function public.attendance_geofence_decision(double precision, text, integer) from public, anon, authenticated;
grant execute on function public.attendance_geofence_decision(double precision, text, integer) to service_role;

create or replace function public.record_employee_attendance(actor_user_id uuid, actor_museum_id uuid, requested_event text, presence jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.employees;
  s public.employee_shifts;
  cfg public.attendance_settings;
  a public.attendance_attempts;
  ev public.attendance_events;
  now_at timestamptz := now();
  prior text;
  class text := 'standard';
  method text := coalesce(presence->>'method', '');
  valid_presence boolean := false;
  extra_minutes integer;
  audit_actor text;
  distance_meters double precision;
  geofence_decision text;
  evidence jsonb;
begin
  if requested_event not in ('clock_in', 'lunch_out', 'lunch_in', 'clock_out') then
    raise exception 'INVALID_CLOCK_ACTION' using errcode = '22023';
  end if;
  select * into e from public.employees where museum_id = actor_museum_id and profile_id = actor_user_id and status = 'activo';
  if not found then
    raise exception 'ACTIVE_EMPLOYEE_REQUIRED' using errcode = 'P0001';
  end if;
  select * into cfg from public.attendance_settings where museum_id = actor_museum_id;
  if not found then
    insert into public.attendance_attempts(museum_id, employee_id, actor_user_id, requested_event, result, reason_code)
    values (actor_museum_id, e.id, actor_user_id, requested_event, 'presence_not_configured', 'ATTENDANCE_SETTINGS_REQUIRED');
    return jsonb_build_object('ok', false, 'code', 'PRESENCE_NOT_CONFIGURED');
  end if;
  select * into s
  from public.employee_shifts
  where museum_id = actor_museum_id
    and employee_id = e.id
    and status = 'scheduled'
    and now_at between starts_at - interval '24 hours' and ends_at + interval '16 hours'
  order by abs(extract(epoch from (now_at - starts_at)))
  limit 1;
  if not found then
    insert into public.attendance_attempts(museum_id, employee_id, actor_user_id, requested_event, result, settings_version, reason_code)
    values (actor_museum_id, e.id, actor_user_id, requested_event, 'no_assigned_shift', cfg.version, 'NO_ASSIGNED_SHIFT');
    return jsonb_build_object('ok', false, 'code', 'NO_ASSIGNED_SHIFT');
  end if;
  if requested_event = 'clock_in' and now_at < s.starts_at - make_interval(mins => cfg.early_clock_in_minutes) then
    insert into public.attendance_attempts(museum_id, employee_id, shift_id, actor_user_id, requested_event, result, settings_version, reason_code)
    values (actor_museum_id, e.id, s.id, actor_user_id, requested_event, 'too_early', cfg.version, 'CLOCK_WINDOW_NOT_OPEN');
    return jsonb_build_object('ok', false, 'code', 'TOO_EARLY', 'available_at', s.starts_at - make_interval(mins => cfg.early_clock_in_minutes));
  end if;
  if not cfg.presence_required then
    valid_presence := true;
  elsif method = 'geolocation'
    and cfg.presence_validation_mode in ('geolocation', 'any')
    and cfg.latitude is not null
    and cfg.geofence_radius_meters is not null
    and presence ? 'latitude'
    and presence ? 'longitude'
  then
    distance_meters := public.attendance_distance_meters(
      cfg.latitude,
      cfg.longitude,
      (presence->>'latitude')::double precision,
      (presence->>'longitude')::double precision
    );
    geofence_decision := public.attendance_geofence_decision(distance_meters, presence->>'accuracy_meters', cfg.geofence_radius_meters);
    valid_presence := geofence_decision in ('direct_geofence', 'accuracy_compensated');
  elsif method = 'wifi' and cfg.presence_validation_mode in ('wifi', 'any') and presence ? 'network_hash' then
    valid_presence := (presence->>'network_hash') = any(cfg.allowed_wifi_hashes);
  end if;
  evidence := presence - 'network_hash' - 'geofence_decision';
  if geofence_decision in ('direct_geofence', 'accuracy_compensated') then
    evidence := evidence || jsonb_build_object('geofence_decision', geofence_decision);
  end if;
  if not valid_presence then
    insert into public.attendance_attempts(museum_id, employee_id, shift_id, actor_user_id, requested_event, result, presence_method, presence_evidence, settings_version, reason_code)
    values (actor_museum_id, e.id, s.id, actor_user_id, requested_event, 'presence_validation_failed', nullif(method, ''), evidence, cfg.version, 'PHYSICAL_PRESENCE_REQUIRED');
    return jsonb_build_object('ok', false, 'code', 'PRESENCE_VALIDATION_FAILED');
  end if;
  select event_type into prior from public.attendance_events where shift_id = s.id order by occurred_at desc limit 1;
  if (requested_event = 'clock_in' and prior is not null)
     or (requested_event = 'lunch_out' and prior is distinct from 'clock_in')
     or (requested_event = 'lunch_in' and prior is distinct from 'lunch_out')
     or (requested_event = 'clock_out' and prior not in ('clock_in', 'lunch_in')) then
    insert into public.attendance_attempts(museum_id, employee_id, shift_id, actor_user_id, requested_event, result, presence_method, settings_version, reason_code)
    values (actor_museum_id, e.id, s.id, actor_user_id, requested_event, 'invalid_sequence', nullif(method, ''), cfg.version, 'INVALID_EVENT_SEQUENCE');
    return jsonb_build_object('ok', false, 'code', 'INVALID_EVENT_SEQUENCE');
  end if;
  if requested_event = 'clock_in' then
    if now_at <= s.starts_at then class := 'on_time';
    elsif now_at <= s.starts_at + make_interval(mins => cfg.late_tolerance_minutes) then class := 'tolerance';
    elsif now_at <= s.starts_at + make_interval(mins => cfg.partial_absence_minutes) then class := 'late';
    else class := 'partial_absence';
    end if;
  elsif requested_event = 'clock_out' and now_at > s.ends_at + make_interval(mins => cfg.overtime_review_threshold_minutes) then
    class := 'overtime_pending';
  end if;
  insert into public.attendance_attempts(museum_id, employee_id, shift_id, actor_user_id, requested_event, result, presence_method, presence_evidence, settings_version)
  values (actor_museum_id, e.id, s.id, actor_user_id, requested_event, 'accepted', nullif(method, ''), evidence, cfg.version)
  returning * into a;
  insert into public.attendance_events(museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by)
  values (actor_museum_id, e.id, s.id, a.id, requested_event, now_at, class, cfg.version, actor_user_id)
  returning * into ev;
  if requested_event = 'clock_in' then
    insert into public.employee_time_entries(museum_id, employee_id, clock_in, source, sync_status, created_by)
    values (actor_museum_id, e.id, now_at, 'instituva', 'not_configured', actor_user_id);
  elsif requested_event = 'clock_out' then
    update public.employee_time_entries set clock_out = now_at, updated_at = now_at
    where museum_id = actor_museum_id and employee_id = e.id and clock_out is null;
    extra_minutes := greatest(0, floor(extract(epoch from (now_at - s.ends_at)) / 60));
    if extra_minutes > cfg.overtime_review_threshold_minutes then
      insert into public.attendance_overtime_reviews(museum_id, employee_id, shift_id, clock_out_event_id, additional_minutes)
      values (actor_museum_id, e.id, s.id, ev.id, extra_minutes);
    end if;
  end if;
  select case
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'actor_user_id'
    ) then 'actor_user_id' else 'user_id'
  end into audit_actor;
  execute format(
    'insert into public.audit_logs(museum_id, %I, action, table_name, record_id, new_value) values ($1, $2, $3, $4, $5, $6)',
    audit_actor
  )
  using actor_museum_id, actor_user_id, 'ATTENDANCE_EVENT_RECORDED', 'attendance_events', ev.id,
    jsonb_build_object('employee_id', e.id, 'shift_id', s.id, 'event_type', requested_event, 'occurred_at', now_at, 'classification', class, 'settings_version', cfg.version);
  return jsonb_build_object(
    'ok', true,
    'event', to_jsonb(ev),
    'next_action', case requested_event when 'clock_in' then 'lunch_out' when 'lunch_out' then 'lunch_in' when 'lunch_in' then 'clock_out' else 'clock_in' end
  );
end
$$;

revoke all on function public.record_employee_attendance(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_employee_attendance(uuid, uuid, text, jsonb) to service_role;
