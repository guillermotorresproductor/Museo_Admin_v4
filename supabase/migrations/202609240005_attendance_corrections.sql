-- Punch corrections. Does not install the old actor_user_id workflow.
-- Request is limited to the signed-in employee. Decision is limited to two profiles.

insert into public.permissions(code, description, sensitivity) values
  ('attendance.corrections.request', 'Solicitar corrección de los propios ponches', 'sensitive'),
  ('attendance.corrections.decide', 'Aprobar o rechazar correcciones de ponches del museo', 'critical')
on conflict (code) do update set description = excluded.description, sensitivity = excluded.sensitivity;

do $patch$
declare src text; patched text; pos integer;
  grant_sql text := $grant$
 -- attendance_correction_access: not a general allow bypass.
 if requested_permission = 'attendance.corrections.decide'
    and exists(
      select 1 from public.user_permissions u
      join public.permissions p on p.id = u.permission_id
      where u.user_id = auth.uid()
        and u.museum_id = public.current_user_museum_id()
        and p.code = 'attendance.corrections.decide'
        and u.effect = 'deny'
        and (u.valid_until is null or u.valid_until > now())
    ) then
   return false;
 end if;
 if requested_permission = 'attendance.corrections.decide'
    and exists(
      select 1 from public.profiles pr
      where pr.id = auth.uid()
        and pr.museum_id = public.current_user_museum_id()
        and pr.status in ('active','activo')
    )
    and public.current_employee_module_profile() in ('director_ejecutivo','gerente_administrativo') then
   return true;
 end if;
 if requested_permission = 'attendance.corrections.request'
    and exists(
      select 1 from public.employees e
      join public.profiles pr on pr.id = e.profile_id and pr.museum_id = e.museum_id
      where e.profile_id = auth.uid()
        and e.museum_id = public.current_user_museum_id()
        and e.status = 'activo'
        and pr.status in ('active','activo')
    )
    and not exists(
      select 1 from public.user_permissions u
      join public.permissions p on p.id = u.permission_id
      where u.user_id = auth.uid()
        and u.museum_id = public.current_user_museum_id()
        and p.code = 'attendance.corrections.request'
        and u.effect = 'deny'
        and (u.valid_until is null or u.valid_until > now())
    ) then
   return true;
 end if;
$grant$;
begin
  src := pg_get_functiondef('public.has_permission(text)'::regprocedure);
  if position('attendance_correction_access' in src) > 0 then
    return;
  end if;
  pos := position(E'\nbegin' in src);
  if pos = 0 then raise exception 'HAS_PERMISSION_PATCH_FAILED'; end if;
  patched := overlay(src placing E'\nbegin' || grant_sql from pos for 6);
  if patched = src or position('attendance_correction_access' in patched) = 0 then
    raise exception 'HAS_PERMISSION_PATCH_FAILED';
  end if;
  execute patched;
end
$patch$;

do $status$
declare cname text;
begin
  select con.conname into cname
  from pg_constraint con
  where con.conrelid = 'public.attendance_overtime_reviews'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%pending%'
    and pg_get_constraintdef(con.oid) ilike '%rejected%';
  if cname is not null and position('cancelled_by_correction' in pg_get_constraintdef((
    select oid from pg_constraint where conname = cname and conrelid = 'public.attendance_overtime_reviews'::regclass
  ))) = 0 then
    execute format('alter table public.attendance_overtime_reviews drop constraint %I', cname);
    alter table public.attendance_overtime_reviews
      add constraint attendance_overtime_reviews_status_check
      check (status in ('pending','approved','partially_approved','rejected','cancelled_by_correction'));
  end if;
end
$status$;

create unique index if not exists attendance_corrections_one_pending_event
  on public.attendance_correction_requests(employee_id, shift_id, requested_event_type)
  where status = 'pending';

create or replace function public.prevent_attendance_correction_delete()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'ATTENDANCE_CORRECTION_HISTORY_IMMUTABLE' using errcode = 'P0001';
end $$;

drop trigger if exists attendance_correction_requests_no_delete on public.attendance_correction_requests;
create trigger attendance_correction_requests_no_delete
before delete on public.attendance_correction_requests
for each row execute function public.prevent_attendance_correction_delete();

create or replace function public.request_own_attendance_correction(
  p_shift_id uuid,
  p_event_type text,
  p_proposed_occurred_at timestamptz,
  p_reason text
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  museum uuid := public.current_user_museum_id();
  employee_row public.employees;
  shift_row public.employee_shifts;
  original_id uuid;
  request_row public.attendance_correction_requests;
begin
  if auth.uid() is null or museum is null or not public.has_permission('attendance.corrections.request') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_event_type not in ('clock_in','lunch_out','lunch_in','clock_out') then
    raise exception 'INVALID_EVENT_TYPE' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;
  select * into employee_row from public.employees
   where profile_id = auth.uid() and museum_id = museum and status = 'activo';
  if not found then raise exception 'ACTIVE_EMPLOYEE_REQUIRED' using errcode = 'P0001'; end if;
  select * into shift_row from public.employee_shifts
   where id = p_shift_id and museum_id = museum and employee_id = employee_row.id and status = 'scheduled';
  if not found then raise exception 'SHIFT_NOT_AVAILABLE' using errcode = 'P0001'; end if;
  if shift_row.starts_at < now() - interval '45 days' or shift_row.starts_at > now() + interval '1 day' then
    raise exception 'SHIFT_OUTSIDE_WINDOW' using errcode = '22023';
  end if;
  if p_proposed_occurred_at < shift_row.starts_at - interval '24 hours'
     or p_proposed_occurred_at > shift_row.ends_at + interval '24 hours' then
    raise exception 'PROPOSED_TIME_OUTSIDE_SHIFT' using errcode = '22023';
  end if;
  select ev.id into original_id
    from public.attendance_events ev
   where ev.shift_id = shift_row.id and ev.museum_id = museum and ev.employee_id = employee_row.id
     and ev.event_type = p_event_type
     and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id)
   order by ev.occurred_at desc
   limit 1;
  insert into public.attendance_correction_requests(
    museum_id, employee_id, shift_id, original_event_id, requested_event_type,
    requested_occurred_at, reason, requested_by
  ) values (
    museum, employee_row.id, shift_row.id, original_id, p_event_type,
    p_proposed_occurred_at, trim(p_reason), auth.uid()
  ) returning * into request_row;
  insert into public.audit_logs(museum_id, actor_user_id, action, table_name, record_id, new_value)
  values (museum, auth.uid(), 'ATTENDANCE_CORRECTION_REQUESTED', 'attendance_correction_requests', request_row.id,
    jsonb_build_object('employee_id', employee_row.id, 'shift_id', shift_row.id, 'original_event_id', original_id,
      'requested_event_type', p_event_type, 'requested_occurred_at', p_proposed_occurred_at, 'reason', trim(p_reason)));
  return to_jsonb(request_row);
exception when unique_violation then
  raise exception 'PENDING_CORRECTION_EXISTS' using errcode = '23505';
end $$;

create or replace function public.list_attendance_corrections()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare museum uuid := public.current_user_museum_id();
begin
  if auth.uid() is null or museum is null or not public.has_permission('attendance.corrections.decide') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'pending', coalesce((
      select jsonb_agg(row_to_json(x) order by x.requested_at)
      from (
        select r.id, e.first_name || ' ' || e.last_name as name, s.starts_at, s.ends_at,
               r.requested_event_type, original.occurred_at as original_at, r.requested_occurred_at as proposed_at,
               case when original.occurred_at is null then null
                    else round(extract(epoch from (r.requested_occurred_at - original.occurred_at)) / 60)::integer end as difference_minutes,
               r.reason, r.requested_at, r.status
        from public.attendance_correction_requests r
        join public.employees e on e.id = r.employee_id and e.museum_id = r.museum_id
        join public.employee_shifts s on s.id = r.shift_id
        left join public.attendance_events original on original.id = r.original_event_id
        where r.museum_id = museum and r.status = 'pending'
      ) x
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(row_to_json(x) order by x.decided_at desc)
      from (
        select r.id, e.first_name || ' ' || e.last_name as name, s.starts_at, s.ends_at,
               r.requested_event_type, original.occurred_at as original_at, r.requested_occurred_at as proposed_at,
               r.reason, r.status, r.decided_at, r.decision_reason, decider.full_name as decided_by_name
        from public.attendance_correction_requests r
        join public.employees e on e.id = r.employee_id and e.museum_id = r.museum_id
        join public.employee_shifts s on s.id = r.shift_id
        left join public.attendance_events original on original.id = r.original_event_id
        left join public.profiles decider on decider.id = r.decided_by
        where r.museum_id = museum and r.status in ('approved','rejected')
        order by r.decided_at desc nulls last
        limit 30
      ) x
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.decide_attendance_correction(
  p_request_id uuid,
  p_decision text,
  p_reason text
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  museum uuid := public.current_user_museum_id();
  request_row public.attendance_correction_requests;
  shift_row public.employee_shifts;
  threshold integer := 0;
  tolerance integer := 5;
  partial_absence integer := 30;
  original_still uuid;
  attempt_id uuid;
  corrected_id uuid;
  classification text := 'standard';
  old_in timestamptz;
  old_out timestamptz;
  new_in timestamptz;
  new_out timestamptz;
  new_lunch_out timestamptz;
  new_lunch_in timestamptz;
  entry_count integer;
  settings_version integer;
  extra_minutes integer;
  review_status text;
  review_minutes integer;
  review_id uuid;
begin
  if auth.uid() is null or museum is null or not public.has_permission('attendance.corrections.decide') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_decision not in ('approved','rejected') then
    raise exception 'INVALID_DECISION' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 1 then
    raise exception 'DECISION_REASON_REQUIRED' using errcode = '22023';
  end if;
  select * into request_row from public.attendance_correction_requests
   where id = p_request_id and museum_id = museum for update;
  if not found then raise exception 'CORRECTION_NOT_FOUND' using errcode = 'P0001'; end if;
  if request_row.status <> 'pending' then raise exception 'CORRECTION_ALREADY_DECIDED' using errcode = 'P0001'; end if;
  if request_row.requested_by = auth.uid() then raise exception 'SELF_APPROVAL_FORBIDDEN' using errcode = '42501'; end if;

  if p_decision = 'rejected' then
    update public.attendance_correction_requests
       set status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_reason = trim(p_reason)
     where id = request_row.id and status = 'pending';
    if not found then raise exception 'CORRECTION_ALREADY_DECIDED' using errcode = 'P0001'; end if;
    insert into public.audit_logs(museum_id, actor_user_id, action, table_name, record_id, old_value, new_value)
    values (museum, auth.uid(), 'ATTENDANCE_CORRECTION_REJECTED', 'attendance_correction_requests', request_row.id,
      to_jsonb(request_row), jsonb_build_object('status','rejected','decision_reason', trim(p_reason)));
    return public.list_attendance_corrections();
  end if;

  select * into shift_row from public.employee_shifts where id = request_row.shift_id and museum_id = museum;
  select coalesce(overtime_review_threshold_minutes, 0), coalesce(late_tolerance_minutes, 5),
         coalesce(partial_absence_minutes, 30), version
    into threshold, tolerance, partial_absence, settings_version
    from public.attendance_settings where museum_id = museum;
  if not found or settings_version is null then
    raise exception 'ATTENDANCE_SETTINGS_REQUIRED' using errcode = 'P0001';
  end if;

  select ev.id into original_still
    from public.attendance_events ev
   where ev.shift_id = shift_row.id and ev.event_type = request_row.requested_event_type and ev.museum_id = museum
     and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id)
   order by ev.occurred_at desc limit 1;
  if original_still is distinct from request_row.original_event_id then
    raise exception 'EFFECTIVE_EVENT_CHANGED' using errcode = 'P0001';
  end if;

  select
    max(ev.occurred_at) filter (where ev.event_type = 'clock_in'),
    max(ev.occurred_at) filter (where ev.event_type = 'clock_out'),
    max(ev.occurred_at) filter (where ev.event_type = 'lunch_out'),
    max(ev.occurred_at) filter (where ev.event_type = 'lunch_in')
  into old_in, old_out, new_lunch_out, new_lunch_in
  from public.attendance_events ev
  where ev.shift_id = shift_row.id and ev.museum_id = museum
    and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id);
  new_in := case when request_row.requested_event_type = 'clock_in' then request_row.requested_occurred_at else old_in end;
  new_out := case when request_row.requested_event_type = 'clock_out' then request_row.requested_occurred_at else old_out end;
  new_lunch_out := case when request_row.requested_event_type = 'lunch_out' then request_row.requested_occurred_at else new_lunch_out end;
  new_lunch_in := case when request_row.requested_event_type = 'lunch_in' then request_row.requested_occurred_at else new_lunch_in end;
  if (new_in is not null and new_lunch_out is not null and new_lunch_out < new_in)
     or (new_lunch_in is not null and new_lunch_out is null)
     or (new_lunch_in is not null and new_lunch_out is not null and new_lunch_in < new_lunch_out)
     or (new_out is not null and new_in is not null and new_out < new_in)
     or (new_out is not null and new_lunch_in is not null and new_out < new_lunch_in)
     or (new_out is not null and new_lunch_out is not null and new_lunch_in is null and new_out < new_lunch_out) then
    raise exception 'INVALID_CORRECTION_SEQUENCE' using errcode = '22023';
  end if;

  if request_row.requested_event_type = 'clock_out' and new_out is distinct from old_out then
    extra_minutes := greatest(0, floor(extract(epoch from (new_out - shift_row.ends_at)) / 60)::integer);
    select id, status, additional_minutes into review_id, review_status, review_minutes
      from public.attendance_overtime_reviews where shift_id = shift_row.id for update;
    if review_status in ('approved','partially_approved','rejected') and extra_minutes is distinct from review_minutes then
      raise exception 'OVERTIME_DECISION_CONFLICT' using errcode = 'P0001';
    end if;
  end if;

  if request_row.requested_event_type = 'clock_in' then
    if request_row.requested_occurred_at <= shift_row.starts_at then classification := 'on_time';
    elsif request_row.requested_occurred_at <= shift_row.starts_at + make_interval(mins => tolerance) then classification := 'tolerance';
    elsif request_row.requested_occurred_at <= shift_row.starts_at + make_interval(mins => partial_absence) then classification := 'late';
    else classification := 'partial_absence'; end if;
  elsif request_row.requested_event_type = 'clock_out'
    and request_row.requested_occurred_at > shift_row.ends_at + make_interval(mins => threshold) then
    classification := 'overtime_pending';
  end if;

  insert into public.attendance_attempts(
    museum_id, employee_id, shift_id, actor_user_id, requested_event, occurred_at, result, presence_method, reason_code, settings_version
  ) values (
    museum, request_row.employee_id, shift_row.id, auth.uid(), request_row.requested_event_type, now(),
    'accepted', 'administrative_correction', 'APPROVED_CORRECTION', settings_version
  ) returning id into attempt_id;
  insert into public.attendance_events(
    museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version,
    supersedes_event_id, correction_request_id, created_by
  ) values (
    museum, request_row.employee_id, shift_row.id, attempt_id, request_row.requested_event_type,
    request_row.requested_occurred_at, classification, settings_version, request_row.original_event_id, request_row.id, auth.uid()
  ) returning id into corrected_id;

  update public.attendance_correction_requests
     set status = 'approved', decided_by = auth.uid(), decided_at = now(), decision_reason = trim(p_reason),
         corrected_event_id = corrected_id
   where id = request_row.id and status = 'pending';
  if not found then raise exception 'CORRECTION_ALREADY_DECIDED' using errcode = 'P0001'; end if;

  if old_in is not null and (new_in is distinct from old_in or new_out is distinct from old_out) then
    select count(*) into entry_count
      from public.employee_time_entries t
     where t.museum_id = museum and t.employee_id = request_row.employee_id
       and t.clock_in = old_in and t.clock_out is not distinct from old_out;
    if entry_count = 0 then
      raise exception 'TIME_ENTRY_NOT_RECONCILABLE' using errcode = 'P0001';
    elsif entry_count > 1 then
      raise exception 'TIME_ENTRY_AMBIGUOUS' using errcode = 'P0001';
    end if;
    update public.employee_time_entries t
       set clock_in = new_in, clock_out = new_out, updated_at = now()
     where t.museum_id = museum and t.employee_id = request_row.employee_id
       and t.clock_in = old_in and t.clock_out is not distinct from old_out;
  elsif old_in is null and request_row.requested_event_type = 'clock_in' and new_in is not null then
    if exists (
      select 1 from public.employee_time_entries t
       where t.museum_id = museum and t.employee_id = request_row.employee_id
         and (t.clock_out is null or t.clock_in = new_in)
    ) then
      raise exception 'TIME_ENTRY_NOT_RECONCILABLE' using errcode = 'P0001';
    end if;
    insert into public.employee_time_entries(museum_id, employee_id, clock_in, clock_out, source, sync_status, created_by)
    values (museum, request_row.employee_id, new_in, new_out, 'instituva', 'not_configured', auth.uid());
  end if;

  if request_row.requested_event_type = 'clock_out' and new_out is distinct from old_out and to_regclass('public.attendance_overtime_reviews') is not null then
    if review_status in ('approved','partially_approved','rejected') then
      null;
    elsif extra_minutes > threshold and review_id is null then
      insert into public.attendance_overtime_reviews(museum_id, employee_id, shift_id, clock_out_event_id, additional_minutes)
      values (museum, request_row.employee_id, shift_row.id, corrected_id, extra_minutes);
      insert into public.audit_logs(museum_id, actor_user_id, action, table_name, record_id, new_value)
      values (museum, auth.uid(), 'OVERTIME_REVIEW_OPENED_BY_CORRECTION', 'attendance_overtime_reviews', shift_row.id,
        jsonb_build_object('correction_request_id', request_row.id, 'additional_minutes', extra_minutes, 'status', 'pending'));
    elsif extra_minutes > threshold and review_status in ('pending','cancelled_by_correction') then
      update public.attendance_overtime_reviews
         set status = 'pending', additional_minutes = extra_minutes, clock_out_event_id = corrected_id,
             approved_minutes = null, decided_by = null, decided_at = null, decision_reason = null
       where id = review_id;
      insert into public.audit_logs(museum_id, actor_user_id, action, table_name, record_id, new_value)
      values (museum, auth.uid(), 'OVERTIME_REVIEW_REOPENED_BY_CORRECTION', 'attendance_overtime_reviews', review_id,
        jsonb_build_object('correction_request_id', request_row.id, 'additional_minutes', extra_minutes, 'status', 'pending'));
    elsif review_status = 'pending' and extra_minutes <= threshold then
      update public.attendance_overtime_reviews
         set status = 'cancelled_by_correction', decided_at = now(),
             decision_reason = 'La salida efectiva ya no genera horas extra.'
       where id = review_id and status = 'pending';
      insert into public.audit_logs(museum_id, actor_user_id, action, table_name, record_id, new_value)
      values (museum, auth.uid(), 'OVERTIME_REVIEW_CANCELLED_BY_CORRECTION', 'attendance_overtime_reviews', review_id,
        jsonb_build_object('correction_request_id', request_row.id, 'previous_minutes', review_minutes, 'status', 'cancelled_by_correction'));
    end if;
  end if;

  if to_regprocedure('public.reconcile_shift_attendance_alerts(uuid)') is not null then
    execute 'select public.reconcile_shift_attendance_alerts($1)' using shift_row.id;
  end if;

  insert into public.audit_logs(museum_id, actor_user_id, action, table_name, record_id, old_value, new_value)
  values (museum, auth.uid(), 'ATTENDANCE_CORRECTION_APPROVED', 'attendance_correction_requests', request_row.id,
    to_jsonb(request_row), jsonb_build_object(
      'status','approved','decision_reason', trim(p_reason),'corrected_event_id', corrected_id,
      'supersedes_event_id', request_row.original_event_id,
      'effective_clock_in', new_in, 'effective_clock_out', new_out));
  return public.list_attendance_corrections();
end $$;

revoke all on function public.request_own_attendance_correction(uuid, text, timestamptz, text) from public, anon;
revoke all on function public.list_attendance_corrections() from public, anon;
revoke all on function public.decide_attendance_correction(uuid, text, text) from public, anon;
grant execute on function public.request_own_attendance_correction(uuid, text, timestamptz, text) to authenticated;
grant execute on function public.list_attendance_corrections() to authenticated;
grant execute on function public.decide_attendance_correction(uuid, text, text) to authenticated;

do $alerts$
begin
  if to_regclass('public.attendance_operational_alerts') is null then
    return;
  end if;
  execute $fn$
    create or replace function public.reconcile_shift_attendance_alerts(p_shift_id uuid)
    returns void language plpgsql security definer set search_path = '' as $body$
    declare
      museum uuid;
      exit_grace interval := interval '5 minutes';
    begin
      select s.museum_id into museum from public.employee_shifts s where s.id = p_shift_id;
      with shifts as (
        select s.id, s.museum_id, s.employee_id, s.starts_at, s.ends_at,
               coalesce(s.expected_lunch_minutes, 0) as expected_lunch_minutes,
               cfg.late_tolerance_minutes,
               (s.starts_at at time zone 'America/Puerto_Rico')::date as alert_date
        from public.employee_shifts s
        left join public.attendance_settings cfg on cfg.museum_id = s.museum_id
        where s.id = p_shift_id and s.museum_id = museum
      ),
      effective as (
        select ev.shift_id, ev.event_type, ev.occurred_at
        from public.attendance_events ev
        where ev.shift_id = p_shift_id and ev.museum_id = museum
          and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id)
      ),
      picked as (
        select s.*,
          max(ev.occurred_at) filter (where ev.event_type = 'clock_in') as clock_in,
          max(ev.occurred_at) filter (where ev.event_type = 'lunch_out') as lunch_out,
          max(ev.occurred_at) filter (where ev.event_type = 'lunch_in') as lunch_in,
          max(ev.occurred_at) filter (where ev.event_type = 'clock_out') as clock_out,
          count(*) filter (where ev.event_type = 'clock_in') as clock_in_count,
          count(*) filter (where ev.event_type = 'lunch_out') as lunch_out_count,
          count(*) filter (where ev.event_type = 'lunch_in') as lunch_in_count,
          count(*) filter (where ev.event_type = 'clock_out') as clock_out_count,
          count(*) filter (where ev.event_type not in ('clock_in','lunch_out','lunch_in','clock_out')) as unknown_count
        from shifts s left join effective ev on ev.shift_id = s.id
        group by s.id, s.museum_id, s.employee_id, s.starts_at, s.ends_at, s.expected_lunch_minutes, s.late_tolerance_minutes, s.alert_date
      ),
      classified as (
        select p.*,
          (p.clock_in_count > 1 or p.lunch_out_count > 1 or p.lunch_in_count > 1 or p.clock_out_count > 1
            or p.unknown_count > 0
            or (p.lunch_out is not null and p.clock_in is null)
            or (p.lunch_in is not null and p.lunch_out is null)
            or (p.clock_out is not null and p.clock_in is null)
            or (p.lunch_out is not null and p.clock_in is not null and p.lunch_out < p.clock_in)
            or (p.lunch_in is not null and p.lunch_out is not null and p.lunch_in < p.lunch_out)
            or (p.clock_out is not null and p.lunch_out is not null and p.lunch_in is null)
            or (p.clock_out is not null and p.lunch_in is not null and p.clock_out < p.lunch_in)
            or (p.clock_out is not null and p.lunch_out is null and p.clock_in is not null and p.clock_out < p.clock_in)
          ) as inconsistent,
          case when p.lunch_in is null then now() else p.lunch_in end as lunch_end
        from picked p
      ),
      desired as (
        select c.museum_id, c.employee_id, c.id as shift_id, c.alert_date, v.alert_type, v.target_status, v.resolution_type, v.details
        from classified c
        cross join lateral (values
          ('late','active',null::text,jsonb_build_object('clock_in', c.clock_in, 'late_minutes', floor(extract(epoch from (c.clock_in - c.starts_at))/60)::integer, 'tolerance_minutes', c.late_tolerance_minutes)),
          ('missing_clock_in','active',null::text,jsonb_build_object('starts_at', c.starts_at)),
          ('lunch_exceeded', case when c.lunch_in is null then 'active' else 'auto_resolved' end, case when c.lunch_in is null then null else 'auto_lunch_return' end, jsonb_build_object('lunch_out', c.lunch_out, 'lunch_in', c.lunch_in, 'expected_lunch_minutes', c.expected_lunch_minutes)),
          ('missing_lunch','active',null::text,jsonb_build_object('ends_at', c.ends_at)),
          ('early_clock_out','active',null::text,jsonb_build_object('clock_out', c.clock_out, 'ends_at', c.ends_at)),
          ('missing_clock_out','active',null::text,jsonb_build_object('ends_at', c.ends_at)),
          ('inconsistent_sequence','active',null::text,jsonb_build_object('clock_in', c.clock_in, 'lunch_out', c.lunch_out, 'lunch_in', c.lunch_in, 'clock_out', c.clock_out))
        ) as v(alert_type, target_status, resolution_type, details)
        where (v.alert_type = 'late' and c.late_tolerance_minutes is not null and c.clock_in_count = 1 and c.clock_in > c.starts_at + make_interval(mins => c.late_tolerance_minutes))
           or (v.alert_type = 'missing_clock_in' and c.clock_in_count = 0 and c.lunch_out_count = 0 and c.lunch_in_count = 0 and c.clock_out_count = 0 and now() > c.starts_at + make_interval(mins => coalesce(c.late_tolerance_minutes, 5)))
           or (v.alert_type = 'lunch_exceeded' and c.expected_lunch_minutes > 0 and c.clock_in_count = 1 and c.lunch_out_count = 1 and c.lunch_in_count <= 1 and c.lunch_out >= c.clock_in and (c.lunch_in is null or c.lunch_in >= c.lunch_out) and c.lunch_end > c.lunch_out + make_interval(mins => c.expected_lunch_minutes))
           or (v.alert_type = 'missing_lunch' and c.expected_lunch_minutes > 0 and c.clock_in_count = 1 and c.lunch_out_count = 0 and c.lunch_in_count = 0 and now() >= c.ends_at)
           or (v.alert_type = 'early_clock_out' and c.clock_in_count = 1 and c.clock_out_count = 1 and c.clock_out >= c.clock_in and c.clock_out < c.ends_at)
           or (v.alert_type = 'missing_clock_out' and c.clock_in_count = 1 and c.clock_out_count = 0 and now() >= c.ends_at + exit_grace)
           or (v.alert_type = 'inconsistent_sequence' and c.inconsistent)
      ),
      upserted as (
        insert into public.attendance_operational_alerts as a (
          museum_id, employee_id, shift_id, alert_date, alert_type, status, resolved_at, resolution_type, details
        )
        select d.museum_id, d.employee_id, d.shift_id, d.alert_date, d.alert_type, d.target_status,
          case when d.target_status = 'auto_resolved' then now() else null end, d.resolution_type, d.details
        from desired d
        on conflict (shift_id, alert_type) do update set
          details = excluded.details, updated_at = now(),
          status = case when a.status = 'reviewed' then a.status when excluded.status = 'auto_resolved' then 'auto_resolved' else a.status end,
          resolved_at = case when a.status = 'reviewed' then a.resolved_at when excluded.status = 'auto_resolved' then coalesce(a.resolved_at, now()) else a.resolved_at end,
          resolution_type = case when a.status = 'reviewed' then a.resolution_type when excluded.status = 'auto_resolved' then excluded.resolution_type else a.resolution_type end
        returning a.id
      )
      update public.attendance_operational_alerts a
         set status = 'auto_resolved', resolved_at = coalesce(a.resolved_at, now()),
             resolution_type = 'auto_condition_cleared', updated_at = now()
       where a.shift_id = p_shift_id and a.museum_id = museum and a.status = 'active'
         and not exists (select 1 from desired d where d.shift_id = a.shift_id and d.alert_type = a.alert_type);
    end
    $body$;
  $fn$;
  revoke all on function public.reconcile_shift_attendance_alerts(uuid) from public, anon, authenticated;
end
$alerts$;
