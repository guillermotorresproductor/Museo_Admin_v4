-- Direct administrative punch correction. Does not replace request/decide.

insert into public.permissions(code, description, sensitivity)
values ('attendance.punches.correct', 'Corregir ponches de otros empleados del museo', 'critical')
on conflict (code) do update set description = excluded.description, sensitivity = excluded.sensitivity;

alter table public.attendance_correction_requests
  add column if not exists direct_admin boolean not null default false;

do $decider$
declare cname text;
begin
  select con.conname into cname
  from pg_constraint con
  where con.conrelid = 'public.attendance_correction_requests'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%decided_by%'
    and position('direct_admin' in pg_get_constraintdef(con.oid)) = 0;
  if cname is not null then
    execute format('alter table public.attendance_correction_requests drop constraint %I', cname);
    alter table public.attendance_correction_requests
      add constraint attendance_correction_requests_decider_check
      check (decided_by is null or decided_by <> requested_by or direct_admin);
  end if;
end
$decider$;

do $patch$
declare src text; patched text; pos integer;
  grant_sql text := $grant$
 -- attendance_punches_correct: deny wins, then only two profiles.
 if requested_permission = 'attendance.punches.correct'
    and exists(
      select 1 from public.user_permissions u
      join public.permissions p on p.id = u.permission_id
      where u.user_id = auth.uid()
        and u.museum_id = public.current_user_museum_id()
        and p.code = 'attendance.punches.correct'
        and u.effect = 'deny'
        and (u.valid_until is null or u.valid_until > now())
    ) then
   return false;
 end if;
 if requested_permission = 'attendance.punches.correct'
    and exists(
      select 1 from public.profiles pr
      where pr.id = auth.uid()
        and pr.museum_id = public.current_user_museum_id()
        and pr.status in ('active','activo')
    )
    and public.current_employee_module_profile() in ('gerente_administrativo','director_ejecutivo') then
   return true;
 end if;
$grant$;
begin
  src := pg_get_functiondef('public.has_permission(text)'::regprocedure);
  if position('attendance_punches_correct' in src) > 0 then
    return;
  end if;
  pos := position(E'\nbegin' in src);
  if pos = 0 then raise exception 'HAS_PERMISSION_PATCH_FAILED'; end if;
  patched := overlay(src placing E'\nbegin' || grant_sql from pos for 6);
  if patched = src or position('attendance_punches_correct' in patched) = 0 then
    raise exception 'HAS_PERMISSION_PATCH_FAILED';
  end if;
  execute patched;
end
$patch$;

create or replace function public.list_shift_punch_history(p_shift_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare museum uuid := public.current_user_museum_id();
begin
  if auth.uid() is null or museum is null
     or not (public.has_permission('attendance.punches.correct') or public.has_permission('attendance.history.read')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.employee_shifts s where s.id = p_shift_id and s.museum_id = museum) then
    raise exception 'SHIFT_NOT_FOUND' using errcode = 'P0001';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'event_type', r.requested_event_type,
      'original_at', original_event.occurred_at,
      'corrected_at', corrected_event.occurred_at,
      'corrected_by', pr.full_name,
      'corrected_on', r.decided_at,
      'reason', r.reason
    ) order by r.decided_at, r.requested_event_type)
    from public.attendance_correction_requests r
    left join public.attendance_events original_event on original_event.id = r.original_event_id
    left join public.attendance_events corrected_event on corrected_event.id = r.corrected_event_id
    left join public.profiles pr on pr.id = r.decided_by
    where r.shift_id = p_shift_id and r.museum_id = museum and r.status = 'approved'
  ), '[]'::jsonb);
end $$;

create or replace function public.correct_shift_attendance_punches(
  p_shift_id uuid,
  p_reason text,
  p_changes jsonb
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  museum uuid := public.current_user_museum_id();
  shift_row public.employee_shifts;
  change jsonb;
  change_type text;
  occurred_at timestamptz;
  expected_id uuid;
  current_id uuid;
  request_id uuid;
  attempt_id uuid;
  corrected_id uuid;
  new_clock_out_event uuid;
  reason text := trim(coalesce(p_reason, ''));
  threshold integer := 0;
  tolerance integer := 5;
  partial_absence integer := 30;
  settings_version integer;
  classification text;
  old_in timestamptz;
  old_out timestamptz;
  old_lunch_out timestamptz;
  old_lunch_in timestamptz;
  new_in timestamptz;
  new_out timestamptz;
  new_lunch_out timestamptz;
  new_lunch_in timestamptz;
  seen text[] := '{}';
  entry_count integer;
  extra_minutes integer;
  review_status text;
  review_minutes integer;
  review_id uuid;
begin
  if auth.uid() is null or museum is null or not public.has_permission('attendance.punches.correct') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if length(reason) < 5 then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;
  if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes) not between 1 and 4 then
    raise exception 'INVALID_CORRECTION' using errcode = '22023';
  end if;

  select * into shift_row from public.employee_shifts
   where id = p_shift_id and museum_id = museum for update;
  if not found then raise exception 'SHIFT_NOT_FOUND' using errcode = 'P0001'; end if;
  if not exists (
    select 1 from public.employees e
    where e.id = shift_row.employee_id and e.museum_id = museum and e.status = 'activo'
  ) then
    raise exception 'EMPLOYEE_NOT_FOUND' using errcode = 'P0001';
  end if;

  select coalesce(overtime_review_threshold_minutes, 0), coalesce(late_tolerance_minutes, 5),
         coalesce(partial_absence_minutes, 30), version
    into threshold, tolerance, partial_absence, settings_version
    from public.attendance_settings where museum_id = museum;
  if settings_version is null then raise exception 'ATTENDANCE_SETTINGS_REQUIRED' using errcode = 'P0001'; end if;

  select
    max(ev.occurred_at) filter (where ev.event_type = 'clock_in'),
    max(ev.occurred_at) filter (where ev.event_type = 'clock_out'),
    max(ev.occurred_at) filter (where ev.event_type = 'lunch_out'),
    max(ev.occurred_at) filter (where ev.event_type = 'lunch_in'),
    (array_agg(ev.id order by ev.occurred_at desc) filter (where ev.event_type = 'clock_out'))[1]
  into old_in, old_out, old_lunch_out, old_lunch_in, new_clock_out_event
  from public.attendance_events ev
  where ev.shift_id = shift_row.id and ev.museum_id = museum
    and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id);
  new_in := old_in;
  new_out := old_out;
  new_lunch_out := old_lunch_out;
  new_lunch_in := old_lunch_in;

  for change in select value from jsonb_array_elements(p_changes) loop
    change_type := change->>'event_type';
    if change_type not in ('clock_in','lunch_out','lunch_in','clock_out') or change_type = any(seen) or change->>'occurred_at' is null then
      raise exception 'INVALID_CORRECTION' using errcode = '22023';
    end if;
    seen := seen || change_type;
    occurred_at := (change->>'occurred_at')::timestamptz;
    expected_id := nullif(change->>'expected_event_id', '')::uuid;
    select ev.id into current_id
      from public.attendance_events ev
     where ev.shift_id = shift_row.id and ev.museum_id = museum and ev.event_type = change_type
       and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id)
     order by ev.occurred_at desc limit 1;
    if current_id is distinct from expected_id then
      raise exception 'ATTENDANCE_CHANGED_RELOAD' using errcode = 'P0001';
    end if;
    if change_type = 'clock_in' then new_in := occurred_at;
    elsif change_type = 'lunch_out' then new_lunch_out := occurred_at;
    elsif change_type = 'lunch_in' then new_lunch_in := occurred_at;
    else new_out := occurred_at; end if;
  end loop;

  if (new_lunch_out is null) is distinct from (new_lunch_in is null) then
    raise exception 'LUNCH_PAIR_INCOMPLETE' using errcode = '22023';
  end if;
  if (new_in is not null and new_lunch_out is not null and new_lunch_out <= new_in)
     or (new_lunch_out is not null and new_lunch_in is not null and new_lunch_in <= new_lunch_out)
     or (new_in is not null and new_out is not null and new_out <= new_in)
     or (new_lunch_in is not null and new_out is not null and new_out <= new_lunch_in) then
    raise exception 'INVALID_CORRECTION_SEQUENCE' using errcode = '22023';
  end if;

  if new_out is distinct from old_out then
    extra_minutes := greatest(0, floor(extract(epoch from (new_out - shift_row.ends_at)) / 60)::integer);
    select id, status, additional_minutes into review_id, review_status, review_minutes
      from public.attendance_overtime_reviews where shift_id = shift_row.id for update;
    if review_status in ('approved','partially_approved','rejected') and extra_minutes is distinct from review_minutes then
      raise exception 'OVERTIME_DECISION_CONFLICT' using errcode = 'P0001';
    end if;
  end if;

  for change in select value from jsonb_array_elements(p_changes) loop
    change_type := change->>'event_type';
    occurred_at := (change->>'occurred_at')::timestamptz;
    expected_id := nullif(change->>'expected_event_id', '')::uuid;
    classification := 'standard';
    if change_type = 'clock_in' then
      if occurred_at <= shift_row.starts_at then classification := 'on_time';
      elsif occurred_at <= shift_row.starts_at + make_interval(mins => tolerance) then classification := 'tolerance';
      elsif occurred_at <= shift_row.starts_at + make_interval(mins => partial_absence) then classification := 'late';
      else classification := 'partial_absence'; end if;
    elsif change_type = 'clock_out' and occurred_at > shift_row.ends_at + make_interval(mins => threshold) then
      classification := 'overtime_pending';
    end if;
    insert into public.attendance_correction_requests(
      museum_id, employee_id, shift_id, original_event_id, requested_event_type, requested_occurred_at,
      reason, status, requested_by, decided_by, decided_at, decision_reason, direct_admin
    ) values (
      museum, shift_row.employee_id, shift_row.id, expected_id, change_type, occurred_at,
      reason, 'approved', auth.uid(), auth.uid(), now(), reason, true
    ) returning id into request_id;
    insert into public.attendance_attempts(
      museum_id, employee_id, shift_id, actor_user_id, requested_event, occurred_at, result, presence_method, reason_code, settings_version
    ) values (
      museum, shift_row.employee_id, shift_row.id, auth.uid(), change_type, now(),
      'accepted', 'administrative_correction', 'APPROVED_CORRECTION', settings_version
    ) returning id into attempt_id;
    insert into public.attendance_events(
      museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version,
      supersedes_event_id, correction_request_id, created_by
    ) values (
      museum, shift_row.employee_id, shift_row.id, attempt_id, change_type, occurred_at, classification, settings_version,
      expected_id, request_id, auth.uid()
    ) returning id into corrected_id;
    update public.attendance_correction_requests set corrected_event_id = corrected_id where id = request_id;
    if change_type = 'clock_out' then new_clock_out_event := corrected_id; end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'user_id'
    ) then
      insert into public.audit_logs(museum_id, user_id, action, table_name, record_id, old_value, new_value)
      values (museum, auth.uid(), 'ATTENDANCE_ADMIN_PUNCH_CORRECTED', 'attendance_correction_requests', request_id,
        jsonb_build_object('event_type', change_type, 'original_event_id', expected_id),
        jsonb_build_object('event_type', change_type, 'occurred_at', occurred_at, 'corrected_event_id', corrected_id, 'reason', reason, 'status', 'approved'));
    else
      insert into public.audit_logs(museum_id, actor_user_id, action, table_name, record_id, old_value, new_value)
      values (museum, auth.uid(), 'ATTENDANCE_ADMIN_PUNCH_CORRECTED', 'attendance_correction_requests', request_id,
        jsonb_build_object('event_type', change_type, 'original_event_id', expected_id),
        jsonb_build_object('event_type', change_type, 'occurred_at', occurred_at, 'corrected_event_id', corrected_id, 'reason', reason, 'status', 'approved'));
    end if;
  end loop;

  if old_in is not null and (new_in is distinct from old_in or new_out is distinct from old_out) then
    select count(*) into entry_count from public.employee_time_entries t
     where t.museum_id = museum and t.employee_id = shift_row.employee_id
       and t.clock_in = old_in and t.clock_out is not distinct from old_out;
    if entry_count = 0 then raise exception 'TIME_ENTRY_NOT_RECONCILABLE' using errcode = 'P0001';
    elsif entry_count > 1 then raise exception 'TIME_ENTRY_AMBIGUOUS' using errcode = 'P0001'; end if;
    update public.employee_time_entries t
       set clock_in = new_in, clock_out = new_out, updated_at = now()
     where t.museum_id = museum and t.employee_id = shift_row.employee_id
       and t.clock_in = old_in and t.clock_out is not distinct from old_out;
  elsif old_in is null and new_in is not null and new_in is distinct from old_in then
    if exists (
      select 1 from public.employee_time_entries t
       where t.museum_id = museum and t.employee_id = shift_row.employee_id
         and (t.clock_out is null or t.clock_in = new_in)
    ) then raise exception 'TIME_ENTRY_NOT_RECONCILABLE' using errcode = 'P0001'; end if;
    insert into public.employee_time_entries(museum_id, employee_id, clock_in, clock_out, source, sync_status, created_by)
    values (museum, shift_row.employee_id, new_in, new_out, 'instituva', 'not_configured', auth.uid());
  end if;

  if new_out is distinct from old_out and to_regclass('public.attendance_overtime_reviews') is not null then
    if review_status in ('approved','partially_approved','rejected') then null;
    elsif extra_minutes > threshold and review_id is null then
      insert into public.attendance_overtime_reviews(museum_id, employee_id, shift_id, clock_out_event_id, additional_minutes)
      values (museum, shift_row.employee_id, shift_row.id, new_clock_out_event, extra_minutes);
    elsif extra_minutes > threshold and review_status in ('pending','cancelled_by_correction') then
      update public.attendance_overtime_reviews
         set status = 'pending', additional_minutes = extra_minutes, clock_out_event_id = new_clock_out_event,
             approved_minutes = null, decided_by = null, decided_at = null, decision_reason = null
       where id = review_id;
    elsif review_status = 'pending' and extra_minutes <= threshold then
      update public.attendance_overtime_reviews
         set status = 'cancelled_by_correction', decided_at = now(), decision_reason = 'La salida efectiva ya no genera horas extra.'
       where id = review_id and status = 'pending';
    end if;
  end if;

  if to_regprocedure('public.reconcile_shift_attendance_alerts(uuid)') is not null then
    execute 'select public.reconcile_shift_attendance_alerts($1)' using shift_row.id;
  end if;

  return jsonb_build_object('shift_id', shift_row.id, 'clock_in', new_in, 'lunch_out', new_lunch_out, 'lunch_in', new_lunch_in, 'clock_out', new_out);
end $$;

create or replace function public.list_shift_punch_editor(p_employee_id uuid, p_shift_date date)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  museum uuid := public.current_user_museum_id();
  shift_id uuid;
begin
  if auth.uid() is null or museum is null or not public.has_permission('attendance.punches.correct') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select s.id into shift_id
  from public.employee_shifts s
  where s.museum_id = museum and s.employee_id = p_employee_id and s.status = 'scheduled'
    and (s.starts_at at time zone 'America/Puerto_Rico')::date = p_shift_date
  order by s.starts_at limit 1;
  if shift_id is null then raise exception 'SHIFT_NOT_FOUND' using errcode = 'P0001'; end if;
  return (
    select jsonb_build_object(
      'shift_id', s.id,
      'starts_at', s.starts_at,
      'ends_at', s.ends_at,
      'events', coalesce(jsonb_object_agg(ev.event_type, jsonb_build_object('id', ev.id, 'occurred_at', ev.occurred_at)), '{}'::jsonb),
      'history', public.list_shift_punch_history(s.id)
    )
    from public.employee_shifts s
    left join public.attendance_events ev on ev.shift_id = s.id and ev.museum_id = museum
      and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id)
      and ev.event_type in ('clock_in','lunch_out','lunch_in','clock_out')
    where s.id = shift_id
    group by s.id, s.starts_at, s.ends_at
  );
end $$;

revoke all on function public.list_shift_punch_editor(uuid, date) from public, anon;
grant execute on function public.list_shift_punch_editor(uuid, date) to authenticated;
revoke all on function public.list_shift_punch_history(uuid) from public, anon;
revoke all on function public.correct_shift_attendance_punches(uuid, text, jsonb) from public, anon;
grant execute on function public.list_shift_punch_history(uuid) to authenticated;

create or replace function public.list_shift_punch_history(p_employee_id uuid, p_shift_date date)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  museum uuid := public.current_user_museum_id();
  shift_id uuid;
begin
  if auth.uid() is null or museum is null
     or not (public.has_permission('attendance.punches.correct') or public.has_permission('attendance.history.read')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select s.id into shift_id
  from public.employee_shifts s
  where s.museum_id = museum and s.employee_id = p_employee_id and s.status = 'scheduled'
    and (s.starts_at at time zone 'America/Puerto_Rico')::date = p_shift_date
  order by s.starts_at
  limit 1;
  if shift_id is null then raise exception 'SHIFT_NOT_FOUND' using errcode = 'P0001'; end if;
  return (
    select jsonb_build_object(
      'starts_at', s.starts_at,
      'ends_at', s.ends_at,
      'history', public.list_shift_punch_history(s.id)
    )
    from public.employee_shifts s
    where s.id = shift_id and s.museum_id = museum
  );
end $$;

revoke all on function public.list_shift_punch_history(uuid, date) from public, anon;
grant execute on function public.list_shift_punch_history(uuid, date) to authenticated;
grant execute on function public.correct_shift_attendance_punches(uuid, text, jsonb) to authenticated;
