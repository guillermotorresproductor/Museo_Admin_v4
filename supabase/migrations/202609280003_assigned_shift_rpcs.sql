-- Write and read assigned shifts. Actor and museum come from the session.
-- record_employee_attendance and list_shift_punch_editor still select a single
-- shift. Several non-overlapping shifts may be stored; those two readers are
-- unchanged and are not split-shift aware yet.

do $patch$
declare
  src text;
  patched text;
  pos integer;
  grant_sql text := $grant$
 -- schedules_manage_profiles: an explicit deny wins, then only two profiles.
 if requested_permission = 'schedules.manage'
    and exists(
      select 1 from public.user_permissions u
      join public.permissions p on p.id = u.permission_id
      where u.user_id = auth.uid()
        and u.museum_id = public.current_user_museum_id()
        and p.code = 'schedules.manage'
        and u.effect = 'deny'
        and (u.valid_until is null or u.valid_until > now())
    ) then
   return false;
 end if;
 if requested_permission = 'schedules.manage'
    and exists(
      select 1 from public.profiles pr
      where pr.id = auth.uid()
        and pr.museum_id = public.current_user_museum_id()
        and pr.status in ('active','activo')
    )
    and public.current_employee_module_profile() in ('director_ejecutivo','gerente_administrativo') then
   return true;
 end if;
$grant$;
begin
  src := replace(pg_get_functiondef('public.has_permission(text)'::regprocedure), E'\r\n', E'\n');
  if position('schedules_manage_profiles' in src) > 0 then
    return;
  end if;
  pos := position(E'\nbegin' in src);
  if pos = 0 then
    raise exception 'HAS_PERMISSION_PATCH_FAILED';
  end if;
  patched := overlay(src placing E'\nbegin' || grant_sql from pos for 6);
  if patched = src or position('schedules_manage_profiles' in patched) = 0 then
    raise exception 'HAS_PERMISSION_PATCH_FAILED';
  end if;
  execute patched;
end
$patch$;

create or replace function public.attendance_write_shift_audit(
  p_museum uuid,
  p_action text,
  p_record uuid,
  p_old jsonb,
  p_new jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_actor text;
begin
  select case
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'user_id'
    ) then 'user_id'
    else 'actor_user_id'
  end into audit_actor;
  execute format(
    'insert into public.audit_logs(museum_id,%I,action,table_name,record_id,old_value,new_value) values($1,$2,$3,$4,$5,$6,$7)',
    audit_actor
  ) using p_museum, auth.uid(), p_action, 'employee_shifts', p_record, p_old, p_new;
end $$;

create or replace function public.attendance_shift_value(
  p_employee uuid,
  p_shift uuid,
  p_shift_date date,
  p_status text,
  p_starts timestamptz,
  p_ends timestamptz,
  p_lunch integer,
  p_shift_type text,
  p_reason text
) returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'employee_id', p_employee,
    'shift_id', p_shift,
    'shift_date', p_shift_date,
    'status', p_status,
    'starts_at', p_starts,
    'ends_at', p_ends,
    'expected_lunch_minutes', p_lunch,
    'shift_type', p_shift_type,
    'reason', nullif(trim(coalesce(p_reason, '')), '')
  );
$$;

create or replace function public.attendance_shift_json(
  p_id uuid,
  p_status text,
  p_shift_date date,
  p_starts timestamptz,
  p_ends timestamptz,
  p_lunch integer,
  p_shift_type text,
  p_updated timestamptz,
  p_tz text
) returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p_id,
    'status', p_status,
    'shift_date', p_shift_date,
    'starts_at', p_starts,
    'ends_at', p_ends,
    'local_start', case when p_starts is null then null else to_char(p_starts at time zone p_tz, 'HH24:MI') end,
    'local_end', case when p_ends is null then null else to_char(p_ends at time zone p_tz, 'HH24:MI') end,
    'crosses_midnight', p_starts is not null and p_ends is not null and (p_ends at time zone p_tz)::date > p_shift_date,
    'expected_lunch_minutes', p_lunch,
    'shift_type', p_shift_type,
    'updated_at', p_updated
  );
$$;

create or replace function public.attendance_inherit_lunch(p_museum uuid, p_employee uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select s.expected_lunch_minutes
    from public.employee_shifts s
   where s.museum_id = p_museum
     and s.employee_id = p_employee
     and s.status = 'scheduled'
     and s.expected_lunch_minutes is not null
   order by s.shift_date desc, s.starts_at desc nulls last
   limit 1;
$$;

create or replace function public.attendance_lock_shift_date(p_employee uuid, p_shift_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_employee::text || ':' || p_shift_date::text, 0));
end $$;

create or replace function public.attendance_shift_days(
  p_museum uuid,
  p_employee uuid,
  p_from date,
  p_to date
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz text;
  result jsonb;
begin
  tz := public.attendance_shift_timezone(p_museum);
  with span as (
    select generate_series(p_from, p_to, interval '1 day')::date as shift_date
  ),
  assigned as (
    select s.id, s.status, s.shift_date, s.starts_at, s.ends_at,
           s.expected_lunch_minutes, s.shift_type, s.updated_at
      from public.employee_shifts s
     where s.museum_id = p_museum
       and s.employee_id = p_employee
       and s.shift_date between p_from and p_to
  )
  select coalesce(jsonb_agg(payload order by shift_date), '[]'::jsonb)
    into result
    from (
      select span.shift_date,
             jsonb_build_object(
               'shift_date', span.shift_date,
               'day_off', coalesce(bool_or(assigned.status = 'day_off'), false),
               'shifts', coalesce(
                 jsonb_agg(
                   public.attendance_shift_json(
                     assigned.id, assigned.status, assigned.shift_date, assigned.starts_at, assigned.ends_at,
                     assigned.expected_lunch_minutes, assigned.shift_type, assigned.updated_at, tz
                   )
                   order by assigned.starts_at
                 ) filter (where assigned.id is not null and assigned.status in ('scheduled', 'completed')),
                 '[]'::jsonb
               ),
               'withdrawn', coalesce(
                 jsonb_agg(
                   public.attendance_shift_json(
                     assigned.id, assigned.status, assigned.shift_date, assigned.starts_at, assigned.ends_at,
                     assigned.expected_lunch_minutes, assigned.shift_type, assigned.updated_at, tz
                   )
                   order by assigned.starts_at
                 ) filter (where assigned.id is not null and assigned.status = 'cancelled'),
                 '[]'::jsonb
               )
             ) as payload
        from span
        left join assigned on assigned.shift_date = span.shift_date
       group by span.shift_date
    ) days;
  return result;
end $$;

create or replace function public.attendance_resolve_shift_range(
  p_museum uuid,
  p_from date,
  p_to date,
  p_week boolean
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz text;
  today date;
  day_from date;
  day_to date;
begin
  tz := public.attendance_shift_timezone(p_museum);
  today := (now() at time zone tz)::date;
  if p_from is null and p_to is null then
    if p_week then
      day_from := today - (extract(isodow from today)::integer - 1);
      day_to := day_from + 6;
    else
      day_from := today;
      day_to := today;
    end if;
  elsif p_from is null or p_to is null then
    day_from := coalesce(p_from, p_to);
    day_to := day_from;
  else
    day_from := p_from;
    day_to := p_to;
  end if;
  if day_to < day_from or (day_to - day_from) > 41 then
    raise exception 'INVALID_PERIOD' using errcode = '22023';
  end if;
  return jsonb_build_object('timezone', tz, 'today', today, 'from', day_from, 'to', day_to);
end $$;

create or replace function public.schedule_employee_shift(
  p_employee_id uuid,
  p_shift_date date,
  p_starts_local time,
  p_ends_local time,
  p_shift_id uuid default null,
  p_expected_lunch_minutes integer default null,
  p_set_lunch boolean default false,
  p_shift_type text default null,
  p_expected_updated_at timestamptz default null,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  museum uuid;
  employee_row public.employees;
  shift_row public.employee_shifts;
  tz text;
  v_start timestamptz;
  v_end timestamptz;
  v_lunch integer;
  v_type text;
  v_reason text;
  changed boolean;
  was_day_off boolean;
  old_value jsonb;
begin
  if auth.uid() is null or not public.has_permission('schedules.manage') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  museum := public.current_user_museum_id();
  if museum is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into employee_row
    from public.employees
   where id = p_employee_id and museum_id = museum;
  if not found or employee_row.status <> 'activo' then
    raise exception 'EMPLOYEE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if employee_row.profile_id is not distinct from auth.uid() then
    raise exception 'SHIFT_SELF_FORBIDDEN' using errcode = '42501';
  end if;
  if p_shift_date is null or p_starts_local is null or p_ends_local is null or p_ends_local = p_starts_local then
    raise exception 'INVALID_SHIFT_HOURS' using errcode = '22023';
  end if;
  if p_shift_type is not null and p_shift_type not in ('regular', 'night', 'special_activity', 'weekend', 'extraordinary') then
    raise exception 'INVALID_SHIFT_TYPE' using errcode = '22023';
  end if;
  if coalesce(p_set_lunch, false) and p_expected_lunch_minutes is not null and p_expected_lunch_minutes < 0 then
    raise exception 'INVALID_LUNCH' using errcode = '22023';
  end if;
  tz := public.attendance_shift_timezone(museum);
  v_start := (p_shift_date + p_starts_local) at time zone tz;
  if p_ends_local > p_starts_local then
    v_end := (p_shift_date + p_ends_local) at time zone tz;
  else
    v_end := ((p_shift_date + 1) + p_ends_local) at time zone tz;
  end if;
  if v_start <= now() then
    raise exception 'SHIFT_LOCKED' using errcode = 'P0001';
  end if;
  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  perform public.attendance_lock_shift_date(p_employee_id, p_shift_date);

  if p_shift_id is null then
    if exists (
      select 1 from public.employee_shifts
       where museum_id = museum and employee_id = p_employee_id
         and shift_date = p_shift_date and status = 'day_off'
    ) then
      raise exception 'SHIFT_CHANGED_RELOAD' using errcode = 'P0001';
    end if;
    v_lunch := case
      when coalesce(p_set_lunch, false) then p_expected_lunch_minutes
      else public.attendance_inherit_lunch(museum, p_employee_id)
    end;
    v_type := coalesce(p_shift_type, 'regular');
    begin
      insert into public.employee_shifts(
        museum_id, employee_id, shift_date, starts_at, ends_at, shift_type,
        expected_lunch_minutes, status, created_by
      ) values (
        museum, p_employee_id, p_shift_date, v_start, v_end, v_type,
        v_lunch, 'scheduled', auth.uid()
      ) returning * into shift_row;
    exception
      when exclusion_violation then
        raise exception 'SHIFT_OVERLAP' using errcode = '23P01';
      when unique_violation then
        if sqlerrm ilike '%employee_shifts_one_day_off%' then
          raise exception 'DAY_OFF_EXISTS' using errcode = '23505';
        end if;
        raise;
    end;
    perform public.attendance_write_shift_audit(
      museum, 'SHIFT_SCHEDULED', shift_row.id, null,
      public.attendance_shift_value(
        p_employee_id, shift_row.id, shift_row.shift_date, shift_row.status,
        shift_row.starts_at, shift_row.ends_at, shift_row.expected_lunch_minutes, shift_row.shift_type, v_reason
      )
    );
  else
    select * into shift_row
      from public.employee_shifts
     where id = p_shift_id and museum_id = museum and employee_id = p_employee_id
     for update;
    if not found then
      raise exception 'SHIFT_NOT_FOUND' using errcode = 'P0002';
    end if;
    if shift_row.updated_at is distinct from p_expected_updated_at then
      raise exception 'SHIFT_CHANGED_RELOAD' using errcode = 'P0001';
    end if;
    if shift_row.status = 'day_off' and shift_row.shift_date is distinct from p_shift_date then
      raise exception 'SHIFT_DATE_MISMATCH' using errcode = '22023';
    end if;
    if shift_row.status not in ('scheduled', 'day_off') then
      raise exception 'SHIFT_LOCKED' using errcode = 'P0001';
    end if;
    if shift_row.status = 'scheduled' and shift_row.shift_date is distinct from p_shift_date then
      perform public.attendance_lock_shift_date(p_employee_id, shift_row.shift_date);
    end if;
    was_day_off := shift_row.status = 'day_off';
    v_type := coalesce(p_shift_type, shift_row.shift_type);
    if coalesce(p_set_lunch, false) then
      v_lunch := p_expected_lunch_minutes;
    elsif shift_row.status = 'scheduled' then
      v_lunch := shift_row.expected_lunch_minutes;
    else
      v_lunch := public.attendance_inherit_lunch(museum, p_employee_id);
    end if;
    changed := was_day_off
      or shift_row.starts_at is distinct from v_start
      or shift_row.ends_at is distinct from v_end
      or shift_row.shift_date is distinct from p_shift_date
      or shift_row.expected_lunch_minutes is distinct from v_lunch
      or shift_row.shift_type is distinct from v_type;
    if not was_day_off and changed and v_reason is null then
      raise exception 'REASON_REQUIRED' using errcode = '22023';
    end if;
    if not changed then
      return public.attendance_shift_json(
        shift_row.id, shift_row.status, shift_row.shift_date, shift_row.starts_at, shift_row.ends_at,
        shift_row.expected_lunch_minutes, shift_row.shift_type, shift_row.updated_at, tz
      );
    end if;
    old_value := public.attendance_shift_value(
      shift_row.employee_id, shift_row.id, shift_row.shift_date, shift_row.status,
      shift_row.starts_at, shift_row.ends_at, shift_row.expected_lunch_minutes, shift_row.shift_type, v_reason
    );
    begin
      update public.employee_shifts
         set starts_at = v_start,
             ends_at = v_end,
             shift_date = p_shift_date,
             status = 'scheduled',
             shift_type = v_type,
             expected_lunch_minutes = v_lunch,
             updated_at = now()
       where id = shift_row.id
       returning * into shift_row;
    exception
      when exclusion_violation then
        raise exception 'SHIFT_OVERLAP' using errcode = '23P01';
    end;
    perform public.attendance_write_shift_audit(
      museum,
      case when was_day_off then 'SHIFT_SCHEDULED' else 'SHIFT_HOURS_CHANGED' end,
      shift_row.id,
      old_value,
      public.attendance_shift_value(
        shift_row.employee_id, shift_row.id, shift_row.shift_date, shift_row.status,
        shift_row.starts_at, shift_row.ends_at, shift_row.expected_lunch_minutes, shift_row.shift_type, v_reason
      )
    );
  end if;

  return public.attendance_shift_json(
    shift_row.id, shift_row.status, shift_row.shift_date, shift_row.starts_at, shift_row.ends_at,
    shift_row.expected_lunch_minutes, shift_row.shift_type, shift_row.updated_at, tz
  );
end $$;

create or replace function public.cancel_employee_shift(
  p_shift_id uuid,
  p_expected_updated_at timestamptz,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  museum uuid;
  employee_row public.employees;
  shift_row public.employee_shifts;
  tz text;
  v_reason text;
begin
  if auth.uid() is null or not public.has_permission('schedules.manage') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  museum := public.current_user_museum_id();
  if museum is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into shift_row
    from public.employee_shifts
   where id = p_shift_id and museum_id = museum
   for update;
  if not found then
    raise exception 'SHIFT_NOT_FOUND' using errcode = 'P0002';
  end if;
  select * into employee_row
    from public.employees
   where id = shift_row.employee_id and museum_id = museum;
  if not found or employee_row.status <> 'activo' then
    raise exception 'EMPLOYEE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if employee_row.profile_id is not distinct from auth.uid() then
    raise exception 'SHIFT_SELF_FORBIDDEN' using errcode = '42501';
  end if;
  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is null or length(v_reason) < 3 then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;
  if shift_row.updated_at is distinct from p_expected_updated_at then
    raise exception 'SHIFT_CHANGED_RELOAD' using errcode = 'P0001';
  end if;
  if shift_row.status <> 'scheduled' then
    raise exception 'SHIFT_LOCKED' using errcode = 'P0001';
  end if;
  perform public.attendance_lock_shift_date(shift_row.employee_id, shift_row.shift_date);
  tz := public.attendance_shift_timezone(museum);
  update public.employee_shifts
     set status = 'cancelled',
         updated_at = now()
   where id = shift_row.id
   returning * into shift_row;
  perform public.attendance_write_shift_audit(
    museum, 'SHIFT_CANCELLED', shift_row.id,
    public.attendance_shift_value(
      shift_row.employee_id, shift_row.id, shift_row.shift_date, 'scheduled',
      shift_row.starts_at, shift_row.ends_at, shift_row.expected_lunch_minutes, shift_row.shift_type, v_reason
    ),
    public.attendance_shift_value(
      shift_row.employee_id, shift_row.id, shift_row.shift_date, shift_row.status,
      shift_row.starts_at, shift_row.ends_at, shift_row.expected_lunch_minutes, shift_row.shift_type, v_reason
    )
  );
  return public.attendance_shift_json(
    shift_row.id, shift_row.status, shift_row.shift_date, shift_row.starts_at, shift_row.ends_at,
    shift_row.expected_lunch_minutes, shift_row.shift_type, shift_row.updated_at, tz
  );
end $$;

create or replace function public.set_employee_day_off(
  p_employee_id uuid,
  p_shift_date date,
  p_reason text,
  p_expected_shifts jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  museum uuid;
  employee_row public.employees;
  shift_row public.employee_shifts;
  day_row public.employee_shifts;
  tz text;
  today date;
  v_reason text;
  cancelled jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not public.has_permission('schedules.manage') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  museum := public.current_user_museum_id();
  if museum is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_shift_date is null then
    raise exception 'INVALID_PERIOD' using errcode = '22023';
  end if;
  select * into employee_row
    from public.employees
   where id = p_employee_id and museum_id = museum;
  if not found or employee_row.status <> 'activo' then
    raise exception 'EMPLOYEE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if employee_row.profile_id is not distinct from auth.uid() then
    raise exception 'SHIFT_SELF_FORBIDDEN' using errcode = '42501';
  end if;
  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is null or length(v_reason) < 3 then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;
  if p_expected_shifts is not null and jsonb_typeof(p_expected_shifts) <> 'array' then
    raise exception 'SHIFT_CHANGED_RELOAD' using errcode = 'P0001';
  end if;
  tz := public.attendance_shift_timezone(museum);
  today := (now() at time zone tz)::date;
  if p_shift_date < today then
    raise exception 'SHIFT_LOCKED' using errcode = 'P0001';
  end if;
  perform public.attendance_lock_shift_date(p_employee_id, p_shift_date);
  perform 1
    from public.employee_shifts
   where museum_id = museum
     and employee_id = p_employee_id
     and shift_date = p_shift_date
     and status = 'scheduled'
   for update;
  if exists (
    with actual as (
      select id, updated_at
        from public.employee_shifts
       where museum_id = museum
         and employee_id = p_employee_id
         and shift_date = p_shift_date
         and status = 'scheduled'
    ),
    expected as (
      select (item->>'id')::uuid as id,
             (item->>'updated_at')::timestamptz as updated_at
        from jsonb_array_elements(coalesce(p_expected_shifts, '[]'::jsonb)) item
    )
    select 1
     where exists (select id, updated_at from actual except select id, updated_at from expected)
        or exists (select id, updated_at from expected except select id, updated_at from actual)
  ) then
    raise exception 'SHIFT_CHANGED_RELOAD' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.employee_shifts
     where museum_id = museum and employee_id = p_employee_id
       and shift_date = p_shift_date and status = 'day_off'
  ) then
    raise exception 'DAY_OFF_EXISTS' using errcode = '23505';
  end if;
  for shift_row in
    select *
      from public.employee_shifts
     where museum_id = museum
       and employee_id = p_employee_id
       and shift_date = p_shift_date
       and status = 'scheduled'
     order by starts_at
  loop
    if public.attendance_shift_has_activity(shift_row.id) or shift_row.starts_at <= now() then
      raise exception 'SHIFT_LOCKED' using errcode = 'P0001';
    end if;
    update public.employee_shifts
       set status = 'cancelled',
           updated_at = now()
     where id = shift_row.id;
    perform public.attendance_write_shift_audit(
      museum, 'SHIFT_CANCELLED', shift_row.id,
      public.attendance_shift_value(
        shift_row.employee_id, shift_row.id, shift_row.shift_date, 'scheduled',
        shift_row.starts_at, shift_row.ends_at, shift_row.expected_lunch_minutes, shift_row.shift_type, v_reason
      ),
      public.attendance_shift_value(
        shift_row.employee_id, shift_row.id, shift_row.shift_date, 'cancelled',
        shift_row.starts_at, shift_row.ends_at, shift_row.expected_lunch_minutes, shift_row.shift_type, v_reason
      )
    );
    cancelled := cancelled || jsonb_build_array(shift_row.id);
  end loop;
  insert into public.employee_shifts(
    museum_id, employee_id, shift_date, starts_at, ends_at,
    expected_lunch_minutes, shift_type, status, created_by
  ) values (
    museum, p_employee_id, p_shift_date, null, null,
    null, 'regular', 'day_off', auth.uid()
  ) returning * into day_row;
  perform public.attendance_write_shift_audit(
    museum, 'SHIFT_DAY_OFF', day_row.id, null,
    public.attendance_shift_value(
      day_row.employee_id, day_row.id, day_row.shift_date, day_row.status,
      null, null, null, day_row.shift_type, v_reason
    )
  );
  return jsonb_build_object(
    'day_off', public.attendance_shift_json(
      day_row.id, day_row.status, day_row.shift_date, day_row.starts_at, day_row.ends_at,
      day_row.expected_lunch_minutes, day_row.shift_type, day_row.updated_at, tz
    ),
    'cancelled_ids', cancelled
  );
end $$;

create or replace function public.list_employee_shifts(
  p_employee_id uuid,
  p_from date default null,
  p_to date default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  museum uuid;
  employee_row public.employees;
  span jsonb;
begin
  if auth.uid() is null or not public.has_permission('schedules.manage') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  museum := public.current_user_museum_id();
  if museum is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into employee_row
    from public.employees
   where id = p_employee_id and museum_id = museum and status = 'activo';
  if not found then
    raise exception 'EMPLOYEE_NOT_FOUND' using errcode = 'P0002';
  end if;
  span := public.attendance_resolve_shift_range(museum, p_from, p_to, false);
  return span || jsonb_build_object(
    'employee_id', employee_row.id,
    'self', employee_row.profile_id is not distinct from auth.uid(),
    'habitual', employee_row.work_schedule,
    'days', public.attendance_shift_days(
      museum, employee_row.id, (span->>'from')::date, (span->>'to')::date
    )
  );
end $$;

create or replace function public.list_my_assigned_shifts(
  p_from date default null,
  p_to date default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  museum uuid;
  employee_row public.employees;
  span jsonb;
begin
  if auth.uid() is null or not public.has_permission('schedules.read.self') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  museum := public.current_user_museum_id();
  if museum is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into employee_row
    from public.employees
   where museum_id = museum
     and profile_id = auth.uid()
     and status = 'activo'
   limit 1;
  if not found then
    raise exception 'EMPLOYEE_NOT_FOUND' using errcode = 'P0002';
  end if;
  span := public.attendance_resolve_shift_range(museum, p_from, p_to, true);
  return span || jsonb_build_object(
    'employee_id', employee_row.id,
    'habitual', employee_row.work_schedule,
    'days', public.attendance_shift_days(
      museum, employee_row.id, (span->>'from')::date, (span->>'to')::date
    )
  );
end $$;

revoke all on function public.attendance_write_shift_audit(uuid, text, uuid, jsonb, jsonb) from public;
revoke all on function public.attendance_shift_value(uuid, uuid, date, text, timestamptz, timestamptz, integer, text, text) from public;
revoke all on function public.attendance_shift_json(uuid, text, date, timestamptz, timestamptz, integer, text, timestamptz, text) from public;
revoke all on function public.attendance_inherit_lunch(uuid, uuid) from public;
revoke all on function public.attendance_lock_shift_date(uuid, date) from public;
revoke all on function public.attendance_shift_days(uuid, uuid, date, date) from public;
revoke all on function public.attendance_resolve_shift_range(uuid, date, date, boolean) from public;

revoke all on function public.schedule_employee_shift(uuid, date, time, time, uuid, integer, boolean, text, timestamptz, text) from public;
grant execute on function public.schedule_employee_shift(uuid, date, time, time, uuid, integer, boolean, text, timestamptz, text) to authenticated;

revoke all on function public.cancel_employee_shift(uuid, timestamptz, text) from public;
grant execute on function public.cancel_employee_shift(uuid, timestamptz, text) to authenticated;

revoke all on function public.set_employee_day_off(uuid, date, text, jsonb) from public;
grant execute on function public.set_employee_day_off(uuid, date, text, jsonb) to authenticated;

revoke all on function public.list_employee_shifts(uuid, date, date) from public;
grant execute on function public.list_employee_shifts(uuid, date, date) to authenticated;

revoke all on function public.list_my_assigned_shifts(date, date) from public;
grant execute on function public.list_my_assigned_shifts(date, date) to authenticated;
