-- Administrative correction form: catalog motive, explanation, and authorizer.
-- Does not replace request_own_attendance_correction or decide_attendance_correction.
-- Does not rewrite 202609250006. Existing rows keep the new columns null.
--
-- Autorizado por is employees.id. The person must be an active employee of the
-- session museum whose access_profile is director_ejecutivo or
-- gerente_administrativo. Those are the only profiles that can decide an
-- attendance correction, correct punches, or decide overtime. Sharing the
-- administration module is not enough: administrador_general can consult
-- attendance, and asistente_administrativa and it_programador are not
-- attendance approvers.
-- Corregido por remains auth.uid(), stored in requested_by and decided_by.

alter table public.attendance_correction_requests
  add column if not exists correction_motive text,
  add column if not exists correction_explanation text,
  add column if not exists authorized_employee_id uuid references public.employees(id) on delete restrict;

alter table public.attendance_correction_requests
  drop constraint if exists attendance_correction_motive_check;
alter table public.attendance_correction_requests
  add constraint attendance_correction_motive_check
  check (correction_motive is null or correction_motive in (
    'missed_clock_in','missed_lunch_out','missed_lunch_in','missed_clock_out','other'
  ));

alter table public.attendance_correction_requests
  drop constraint if exists attendance_correction_other_explanation_check;
alter table public.attendance_correction_requests
  add constraint attendance_correction_other_explanation_check
  check (correction_motive is distinct from 'other' or length(trim(coalesce(correction_explanation, ''))) > 0);

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
      'motive', r.correction_motive,
      'explanation', r.correction_explanation,
      'authorized_by', nullif(trim(auth_emp.first_name || ' ' || auth_emp.last_name), ''),
      'corrected_by', nullif(trim(pr.full_name), ''),
      'corrected_on', r.decided_at
    ) order by r.decided_at, r.requested_event_type)
    from public.attendance_correction_requests r
    left join public.attendance_events original_event on original_event.id = r.original_event_id
    left join public.attendance_events corrected_event on corrected_event.id = r.corrected_event_id
    left join public.profiles pr on pr.id = r.decided_by
    left join public.employees auth_emp on auth_emp.id = r.authorized_employee_id
    where r.shift_id = p_shift_id and r.museum_id = museum and r.status = 'approved'
  ), '[]'::jsonb);
end $$;

drop function if exists public.correct_shift_attendance_punches(uuid, text, jsonb);

create or replace function public.correct_shift_attendance_punches(
  p_shift_id uuid,
  p_motive text,
  p_explanation text,
  p_authorized_employee_id uuid,
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
  motive text := trim(coalesce(p_motive, ''));
  explanation text := nullif(trim(coalesce(p_explanation, '')), '');
  reason text;
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
  if motive = '' then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;
  if motive not in ('missed_clock_in','missed_lunch_out','missed_lunch_in','missed_clock_out','other') then
    raise exception 'REASON_NOT_ALLOWED' using errcode = '22023';
  end if;
  if motive = 'other' and explanation is null then
    raise exception 'EXPLANATION_REQUIRED' using errcode = '22023';
  end if;
  if p_authorized_employee_id is null then
    raise exception 'AUTHORIZER_REQUIRED' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.employees e
    where e.id = p_authorized_employee_id and e.museum_id = museum and e.status = 'activo'
      and e.access_profile in ('director_ejecutivo','gerente_administrativo')
  ) then
    raise exception 'AUTHORIZER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes) not between 1 and 4 then
    raise exception 'INVALID_CORRECTION' using errcode = '22023';
  end if;
  reason := case motive
    when 'missed_clock_in' then 'No ponchó en la hora de entrada laboral'
    when 'missed_lunch_out' then 'No ponchó en la salida del período de almuerzo'
    when 'missed_lunch_in' then 'No ponchó en la entrada del período de almuerzo'
    when 'missed_clock_out' then 'No ponchó en la hora de salida'
    else 'Otro. ' || explanation
  end;

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
      reason, status, requested_by, decided_by, decided_at, decision_reason, direct_admin,
      correction_motive, correction_explanation, authorized_employee_id
    ) values (
      museum, shift_row.employee_id, shift_row.id, expected_id, change_type, occurred_at,
      reason, 'approved', auth.uid(), auth.uid(), now(), coalesce(explanation, reason), true,
      motive, explanation, p_authorized_employee_id
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
        jsonb_build_object('event_type', change_type, 'occurred_at', occurred_at, 'corrected_event_id', corrected_id, 'reason', reason, 'motive', motive, 'authorized_employee_id', p_authorized_employee_id, 'status', 'approved'));
    else
      insert into public.audit_logs(museum_id, actor_user_id, action, table_name, record_id, old_value, new_value)
      values (museum, auth.uid(), 'ATTENDANCE_ADMIN_PUNCH_CORRECTED', 'attendance_correction_requests', request_id,
        jsonb_build_object('event_type', change_type, 'original_event_id', expected_id),
        jsonb_build_object('event_type', change_type, 'occurred_at', occurred_at, 'corrected_event_id', corrected_id, 'reason', reason, 'motive', motive, 'authorized_employee_id', p_authorized_employee_id, 'status', 'approved'));
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

revoke all on function public.correct_shift_attendance_punches(uuid, text, text, uuid, jsonb) from public, anon;
grant execute on function public.correct_shift_attendance_punches(uuid, text, text, uuid, jsonb) to authenticated;

create or replace function public.list_attendance_correction_authorizers()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare museum uuid := public.current_user_museum_id();
begin
  if auth.uid() is null or museum is null or not public.has_permission('attendance.punches.correct') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', e.id, 'name', trim(e.first_name || ' ' || e.last_name)) order by e.last_name, e.first_name, e.id)
    from public.employees e
    where e.museum_id = museum and e.status = 'activo'
      and e.access_profile in ('director_ejecutivo','gerente_administrativo')
  ), '[]'::jsonb);
end $$;

revoke all on function public.list_attendance_correction_authorizers() from public, anon;
grant execute on function public.list_attendance_correction_authorizers() to authenticated;
