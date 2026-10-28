-- Weekly schedule drafts and one-transaction publication.
-- Does not alter employees, employee_shifts, attendance, punches, or payroll.
-- Does not replace schedule_employee_shift or set_employee_day_off.
-- Identity matches those functions: employees.profile_id compared with auth.uid().
-- Apply only on an isolated database first. Do not run against production from this branch.

create table if not exists public.schedule_week_drafts (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null,
  week_start date not null,
  state text not null default 'draft' check (state in ('draft', 'published', 'discarded')),
  revision integer not null default 1 check (revision > 0),
  created_by uuid not null,
  published_by uuid,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_week_drafts_monday check (extract(isodow from week_start) = 1),
  constraint schedule_week_drafts_published_fields check (
    (state = 'published' and published_by is not null and published_at is not null)
    or (state <> 'published' and published_by is null and published_at is null)
  )
);

create table if not exists public.schedule_week_draft_items (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.schedule_week_drafts(id) on delete cascade,
  employee_id uuid not null,
  shift_date date not null,
  action text not null check (action in ('set_shift', 'day_off')),
  starts_local time,
  ends_local time,
  lunch_minutes integer,
  source_shift_id uuid,
  source_updated_at timestamptz,
  source_status text,
  reason text not null default '',
  created_at timestamptz not null default now(),
  constraint schedule_week_draft_items_fields check (
    (action = 'day_off' and starts_local is null and ends_local is null and lunch_minutes is null)
    or (
      action = 'set_shift'
      and starts_local is not null
      and ends_local is not null
      and starts_local <> ends_local
      and lunch_minutes between 0 and 1439
    )
  ),
  constraint schedule_week_draft_items_source_status_check check (
    source_status is null or source_status in ('scheduled', 'day_off')
  ),
  constraint schedule_week_draft_items_day unique (draft_id, employee_id, shift_date)
);

alter table public.schedule_week_draft_items
  add column if not exists source_status text;

create unique index if not exists schedule_week_drafts_one_open
  on public.schedule_week_drafts (museum_id, week_start)
  where state = 'draft';

create index if not exists schedule_week_drafts_museum_week
  on public.schedule_week_drafts (museum_id, week_start);

create index if not exists schedule_week_draft_items_draft
  on public.schedule_week_draft_items (draft_id);

alter table public.schedule_week_drafts enable row level security;
alter table public.schedule_week_draft_items enable row level security;

create or replace function public.schedule_local_bounds(
  p_day date,
  p_start time,
  p_end time,
  p_tz text
) returns table(starts_at timestamptz, ends_at timestamptz)
language sql
stable
set search_path = ''
as $bounds$
  select (p_day + p_start) at time zone p_tz,
         case
           when p_end > p_start then (p_day + p_end) at time zone p_tz
           else ((p_day + 1) + p_end) at time zone p_tz
         end;
$bounds$;

create or replace function public.schedule_draft_net_minutes(
  p_day date,
  p_start time,
  p_end time,
  p_lunch integer,
  p_tz text
) returns integer
language sql
stable
set search_path = ''
as $net$
  select case
    when p_start is null or p_end is null or p_start = p_end or p_lunch is null or p_lunch < 0 then null
    else floor(extract(epoch from (b.ends_at - b.starts_at)) / 60)::integer - p_lunch
  end
  from public.schedule_local_bounds(p_day, p_start, p_end, p_tz) b;
$net$;

create or replace function public.schedule_week_require_manager()
returns table(actor uuid, museum uuid)
language plpgsql
set search_path = ''
as $actor$
begin
  actor := auth.uid();
  if actor is null or not public.has_permission('schedules.manage') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  museum := public.current_user_museum_id();
  if museum is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return next;
end;
$actor$;

create or replace function public.schedule_week_lock_dates(p_employee uuid, p_week date)
returns void
language plpgsql
set search_path = ''
as $lock$
declare
  day date;
begin
  for day in
    select g::date
    from generate_series(p_week, p_week + 6, interval '1 day') g
    order by 1
  loop
    perform public.attendance_lock_shift_date(p_employee, day);
  end loop;
end;
$lock$;

create or replace function public.schedule_week_write_audit(
  p_museum uuid,
  p_action text,
  p_record uuid,
  p_new jsonb
) returns void
language plpgsql
set search_path = ''
as $audit$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'user_id'
  ) then
    insert into public.audit_logs(museum_id, user_id, action, table_name, record_id, old_value, new_value)
    values (p_museum, auth.uid(), p_action, 'schedule_week_drafts', p_record, null, p_new);
  else
    insert into public.audit_logs(museum_id, actor_user_id, action, table_name, record_id, old_value, new_value)
    values (p_museum, auth.uid(), p_action, 'schedule_week_drafts', p_record, null, p_new);
  end if;
end;
$audit$;

create or replace function public.schedule_week_assert_plan(
  p_museum uuid,
  p_week date,
  p_items jsonb,
  p_tz text
) returns void
language plpgsql
set search_path = ''
as $plan$
declare
  rec record;
begin
  for rec in
    with incoming as (
      select (item->>'employeeId')::uuid as employee_id,
             (item->>'date')::date as shift_date,
             item->>'action' as action,
             case
               when item->>'action' = 'day_off' then 0
               else public.schedule_draft_net_minutes(
                 (item->>'date')::date,
                 (item->>'start')::time,
                 (item->>'end')::time,
                 (item->>'lunch')::integer,
                 p_tz
               )
             end as net_minutes,
             coalesce(item->>'reason', '') as reason,
             coalesce((item->>'changed')::boolean, false) as changed
      from jsonb_array_elements(p_items) item
    ),
    days as (
      select people.employee_id, g::date as shift_date
      from (select distinct employee_id from incoming) people
      cross join generate_series(p_week, p_week + 6, interval '1 day') g
    ),
    totals as (
      select d.employee_id,
             sum(
               case
                 when i.shift_date is not null then i.net_minutes
                 else (
                   select coalesce(sum(greatest(0, floor(extract(epoch from (s.ends_at - s.starts_at)) / 60)::integer - greatest(coalesce(s.expected_lunch_minutes, 0), 0))), 0)
                   from public.employee_shifts s
                   where s.museum_id = p_museum
                     and s.employee_id = d.employee_id
                     and s.shift_date = d.shift_date
                     and s.status = 'scheduled'
                 )
               end
             )::integer as week_minutes,
             bool_or(
               coalesce(i.changed, false)
               and i.action = 'set_shift'
               and coalesce(i.reason, '') !~* 'autorizaci[oó]n excepcional'
             ) as needs_exception
      from days d
      left join incoming i on i.employee_id = d.employee_id and i.shift_date = d.shift_date
      group by d.employee_id
    )
    select employee_id, week_minutes, needs_exception from totals
  loop
    if rec.week_minutes > 2400 and rec.needs_exception then
      raise exception 'WEEKLY_SCHEDULE_LIMIT' using errcode = 'P0001';
    end if;
  end loop;

  if exists (
    with ranges as (
      select s.employee_id, s.starts_at, s.ends_at
      from public.employee_shifts s
      where s.museum_id = p_museum
        and s.status = 'scheduled'
        and s.employee_id in (select (item->>'employeeId')::uuid from jsonb_array_elements(p_items) item)
        and s.shift_date between p_week - 1 and p_week + 6
        and not exists (
          select 1 from jsonb_array_elements(p_items) item
          where (item->>'employeeId')::uuid = s.employee_id
            and (item->>'date')::date = s.shift_date
        )
      union all
      select (item->>'employeeId')::uuid, b.starts_at, b.ends_at
      from jsonb_array_elements(p_items) item
      cross join lateral public.schedule_local_bounds(
        (item->>'date')::date, (item->>'start')::time, (item->>'end')::time, p_tz
      ) b
      where item->>'action' = 'set_shift'
    ),
    numbered as (
      select employee_id, starts_at, ends_at, row_number() over () as n from ranges
    )
    select 1
    from numbered a
    join numbered b on a.employee_id = b.employee_id and a.n < b.n
    where a.starts_at < b.ends_at and b.starts_at < a.ends_at
  ) then
    raise exception 'SHIFT_OVERLAP' using errcode = '23P01';
  end if;
end;
$plan$;

create or replace function public.save_schedule_week_draft(
  p_week_start date,
  p_items jsonb,
  p_draft_id uuid default null,
  p_expected_revision integer default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $save$
declare
  v_actor uuid;
  v_museum uuid;
  v_tz text;
  v_draft public.schedule_week_drafts%rowtype;
  v_item jsonb;
  v_employee public.employees%rowtype;
  v_day date;
  v_action text;
  v_start time;
  v_end time;
  v_lunch integer;
  v_net integer;
  v_reason text;
  v_baseline text;
  v_expected_id uuid;
  v_expected_at timestamptz;
  v_scheduled integer;
  v_completed integer;
  v_day_off integer;
  v_current public.employee_shifts%rowtype;
  v_source_id uuid;
  v_source_at timestamptz;
  v_source_status text;
  v_changed boolean;
  v_have_current boolean;
  v_bounds record;
  v_parsed jsonb := '[]'::jsonb;
  v_ready jsonb := '[]'::jsonb;
  v_key text;
  v_seen text[] := array[]::text[];
  rec record;
begin
  select a.actor, a.museum into v_actor, v_museum from public.schedule_week_require_manager() a;
  if p_week_start is null or extract(isodow from p_week_start) <> 1 then
    raise exception 'INVALID_WEEK' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 300 then
    raise exception 'INVALID_ITEMS' using errcode = '22023';
  end if;
  v_tz := public.attendance_shift_timezone(v_museum);

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'INVALID_ITEM' using errcode = '22023';
    end if;
    begin
      v_day := (v_item->>'date')::date;
      if nullif(v_item->>'employeeId', '') is null then
        raise exception 'INVALID_ITEM' using errcode = '22023';
      end if;
      perform (v_item->>'employeeId')::uuid;
    exception when invalid_text_representation or datetime_field_overflow then
      raise exception 'INVALID_ITEM' using errcode = '22023';
    end;
    if v_day < p_week_start or v_day > p_week_start + 6 then
      raise exception 'DATE_OUTSIDE_WEEK' using errcode = '22023';
    end if;
    v_key := (v_item->>'employeeId') || '|' || v_day::text;
    if v_key = any(v_seen) then
      raise exception 'DUPLICATE_DAY' using errcode = '22023';
    end if;
    v_seen := array_append(v_seen, v_key);
    v_baseline := coalesce(nullif(v_item->>'baseline', ''), 'unknown');
    if v_baseline not in ('none', 'day_off', 'scheduled', 'unknown') then
      raise exception 'INVALID_ITEM' using errcode = '22023';
    end if;
    v_reason := coalesce(v_item->>'reason', '');
    if length(v_reason) > 240 then
      raise exception 'INVALID_REASON' using errcode = '22023';
    end if;
    if coalesce((v_item->>'dayOff')::boolean, false) then
      if length(trim(v_reason)) < 3 then
        raise exception 'REASON_REQUIRED' using errcode = '22023';
      end if;
    else
      begin
        v_start := (v_item->>'start')::time;
        v_end := (v_item->>'end')::time;
        v_lunch := (v_item->>'lunch')::integer;
      exception when invalid_text_representation or datetime_field_overflow then
        raise exception 'INVALID_SHIFT' using errcode = '22023';
      end;
      if v_start is null or v_end is null or v_start = v_end or v_lunch is null or v_lunch < 0 then
        raise exception 'INVALID_SHIFT' using errcode = '22023';
      end if;
      v_net := public.schedule_draft_net_minutes(v_day, v_start, v_end, v_lunch, v_tz);
      if v_net is null or v_net < 1 or v_net > 480 then
        raise exception 'INVALID_HOURS' using errcode = '22023';
      end if;
    end if;
    if v_baseline = 'scheduled' and (
      nullif(v_item->>'expectedShiftId', '') is null
      or nullif(v_item->>'expectedUpdatedAt', '') is null
    ) then
      raise exception 'INVALID_ITEM' using errcode = '22023';
    end if;
    v_parsed := v_parsed || jsonb_build_array(v_item);
  end loop;

  if p_draft_id is null then
    begin
      insert into public.schedule_week_drafts(museum_id, week_start, created_by)
      values (v_museum, p_week_start, v_actor)
      returning * into v_draft;
    exception when unique_violation then
      raise exception 'DRAFT_CONFLICT' using errcode = 'P0001';
    end;
  else
    select * into v_draft
    from public.schedule_week_drafts
    where id = p_draft_id and museum_id = v_museum
    for update;
    if not found or v_draft.state <> 'draft' or v_draft.week_start <> p_week_start
       or p_expected_revision is distinct from v_draft.revision then
      raise exception 'DRAFT_CONFLICT' using errcode = 'P0001';
    end if;
  end if;

  for rec in
    select distinct (item->>'employeeId')::uuid as employee_id
    from jsonb_array_elements(v_parsed) item
    order by 1
  loop
    perform public.schedule_week_lock_dates(rec.employee_id, p_week_start);
  end loop;

  for v_item in select value from jsonb_array_elements(v_parsed)
  loop
    select * into v_employee
    from public.employees
    where id = (v_item->>'employeeId')::uuid and museum_id = v_museum
    for update;
    if not found or v_employee.status <> 'activo' then
      raise exception 'EMPLOYEE_NOT_ACTIVE' using errcode = '42501';
    end if;
    if v_employee.profile_id is not distinct from v_actor then
      raise exception 'SHIFT_SELF_FORBIDDEN' using errcode = '42501';
    end if;
    v_day := (v_item->>'date')::date;
    v_action := case when coalesce((v_item->>'dayOff')::boolean, false) then 'day_off' else 'set_shift' end;
    v_reason := coalesce(v_item->>'reason', '');
    v_baseline := coalesce(nullif(v_item->>'baseline', ''), 'unknown');
    v_expected_id := nullif(v_item->>'expectedShiftId', '')::uuid;
    v_expected_at := nullif(v_item->>'expectedUpdatedAt', '')::timestamptz;

    perform 1 from public.employee_shifts
    where museum_id = v_museum and employee_id = v_employee.id and shift_date = v_day
      and status in ('scheduled', 'day_off', 'completed')
    for update;
    select count(*) filter (where status = 'scheduled'),
           count(*) filter (where status = 'completed'),
           count(*) filter (where status = 'day_off')
      into v_scheduled, v_completed, v_day_off
    from public.employee_shifts
    where museum_id = v_museum and employee_id = v_employee.id and shift_date = v_day
      and status in ('scheduled', 'day_off', 'completed');
    if v_completed > 0 then
      raise exception 'COMPLETED_SHIFT_LOCKED' using errcode = 'P0001';
    end if;
    if v_scheduled > 1 then
      raise exception 'MULTIPLE_SHIFTS_REQUIRE_MANUAL_REVIEW' using errcode = 'P0001';
    end if;
    if v_scheduled > 0 and v_day_off > 0 then
      raise exception 'DAY_OFF_CONFLICT' using errcode = 'P0001';
    end if;

    v_have_current := false;
    if v_scheduled = 1 or v_day_off = 1 then
      select * into v_current
      from public.employee_shifts
      where museum_id = v_museum and employee_id = v_employee.id and shift_date = v_day
        and status in ('scheduled', 'day_off')
      order by starts_at nulls last
      limit 1;
      v_have_current := found;
    end if;
    if v_have_current and public.attendance_shift_has_activity(v_current.id) then
      raise exception 'SHIFT_LOCKED' using errcode = 'P0001';
    end if;
    if v_have_current and v_current.status = 'scheduled' and v_current.starts_at <= now() then
      raise exception 'SHIFT_LOCKED' using errcode = 'P0001';
    end if;
    if v_action = 'day_off' and v_day < (now() at time zone v_tz)::date then
      raise exception 'SHIFT_LOCKED' using errcode = 'P0001';
    end if;

    if v_baseline = 'unknown' or v_baseline = 'none' then
      if v_scheduled > 0 or v_day_off > 0 then
        raise exception 'SHIFT_CONFLICT' using errcode = 'P0001';
      end if;
    elsif v_baseline = 'day_off' then
      if v_day_off <> 1 or v_scheduled <> 0 then
        raise exception 'SHIFT_CONFLICT' using errcode = 'P0001';
      end if;
    elsif v_baseline = 'scheduled' then
      if not v_have_current or v_scheduled <> 1 or v_current.id is distinct from v_expected_id
         or v_current.updated_at is distinct from v_expected_at then
        raise exception 'SHIFT_CONFLICT' using errcode = 'P0001';
      end if;
    end if;

    v_source_id := null;
    v_source_at := null;
    v_source_status := null;
    v_changed := true;
    v_start := null;
    v_end := null;
    v_lunch := null;
    if v_have_current and v_current.status in ('scheduled', 'day_off') then
      v_source_id := v_current.id;
      v_source_at := v_current.updated_at;
      v_source_status := v_current.status;
    end if;
    if v_action = 'set_shift' then
      v_start := (v_item->>'start')::time;
      v_end := (v_item->>'end')::time;
      v_lunch := (v_item->>'lunch')::integer;
      select * into v_bounds from public.schedule_local_bounds(v_day, v_start, v_end, v_tz);
      if v_bounds.starts_at <= now() then
        raise exception 'SHIFT_LOCKED' using errcode = 'P0001';
      end if;
      if v_source_status = 'scheduled' then
        v_changed := v_current.starts_at is distinct from v_bounds.starts_at
          or v_current.ends_at is distinct from v_bounds.ends_at
          or v_current.expected_lunch_minutes is distinct from v_lunch;
      end if;
      if v_source_status = 'scheduled' and v_changed and length(trim(v_reason)) < 3 then
        raise exception 'REASON_REQUIRED' using errcode = '22023';
      end if;
    else
      v_changed := v_source_status is distinct from 'day_off';
    end if;

    v_ready := v_ready || jsonb_build_array(jsonb_build_object(
      'employeeId', v_employee.id,
      'date', v_day,
      'action', v_action,
      'start', v_start,
      'end', v_end,
      'lunch', v_lunch,
      'reason', v_reason,
      'changed', v_changed,
      'sourceId', v_source_id,
      'sourceAt', v_source_at,
      'sourceStatus', v_source_status
    ));
  end loop;

  perform public.schedule_week_assert_plan(v_museum, p_week_start, v_ready, v_tz);

  delete from public.schedule_week_draft_items where draft_id = v_draft.id;
  for v_item in select value from jsonb_array_elements(v_ready)
  loop
    insert into public.schedule_week_draft_items(
      draft_id, employee_id, shift_date, action, starts_local, ends_local, lunch_minutes,
      source_shift_id, source_updated_at, source_status, reason
    ) values (
      v_draft.id,
      (v_item->>'employeeId')::uuid,
      (v_item->>'date')::date,
      v_item->>'action',
      nullif(v_item->>'start', '')::time,
      nullif(v_item->>'end', '')::time,
      nullif(v_item->>'lunch', '')::integer,
      nullif(v_item->>'sourceId', '')::uuid,
      nullif(v_item->>'sourceAt', '')::timestamptz,
      nullif(v_item->>'sourceStatus', ''),
      coalesce(v_item->>'reason', '')
    );
  end loop;

  if p_draft_id is not null then
    update public.schedule_week_drafts
       set revision = revision + 1, updated_at = now()
     where id = v_draft.id
     returning * into v_draft;
  end if;

  perform public.schedule_week_write_audit(
    v_museum,
    'SCHEDULE_WEEK_DRAFT_SAVED',
    v_draft.id,
    jsonb_build_object(
      'draft_id', v_draft.id,
      'week_start', v_draft.week_start,
      'revision', v_draft.revision,
      'item_count', jsonb_array_length(v_ready),
      'actor', v_actor
    )
  );

  return jsonb_build_object(
    'id', v_draft.id,
    'revision', v_draft.revision,
    'state', v_draft.state,
    'week_start', v_draft.week_start,
    'item_count', jsonb_array_length(v_ready)
  );
end;
$save$;

create or replace function public.get_schedule_week_draft(p_week_start date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $get$
declare
  v_actor uuid;
  v_museum uuid;
  v_draft public.schedule_week_drafts%rowtype;
  v_items jsonb;
begin
  select a.actor, a.museum into v_actor, v_museum from public.schedule_week_require_manager() a;
  if p_week_start is null or extract(isodow from p_week_start) <> 1 then
    raise exception 'INVALID_WEEK' using errcode = '22023';
  end if;
  select * into v_draft
  from public.schedule_week_drafts
  where museum_id = v_museum and week_start = p_week_start and state = 'draft';
  if not found then
    return jsonb_build_object(
      'id', null,
      'revision', null,
      'state', null,
      'week_start', p_week_start,
      'items', '[]'::jsonb
    );
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'employeeId', employee_id,
    'date', shift_date,
    'dayOff', action = 'day_off',
    'start', to_char(starts_local, 'HH24:MI'),
    'end', to_char(ends_local, 'HH24:MI'),
    'lunch', lunch_minutes,
    'reason', reason,
    'baseline', case
      when source_status = 'scheduled' then 'scheduled'
      when source_status = 'day_off' then 'day_off'
      else 'none'
    end,
    'sourceShiftId', source_shift_id,
    'sourceUpdatedAt', source_updated_at,
    'sourceStatus', source_status
  ) order by employee_id, shift_date), '[]'::jsonb)
  into v_items
  from public.schedule_week_draft_items
  where draft_id = v_draft.id;
  return jsonb_build_object(
    'id', v_draft.id,
    'revision', v_draft.revision,
    'state', v_draft.state,
    'week_start', v_draft.week_start,
    'updated_at', v_draft.updated_at,
    'items', v_items
  );
end;
$get$;

create or replace function public.discard_schedule_week_draft(
  p_draft_id uuid,
  p_expected_revision integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $discard$
declare
  v_actor uuid;
  v_museum uuid;
  v_draft public.schedule_week_drafts%rowtype;
begin
  select a.actor, a.museum into v_actor, v_museum from public.schedule_week_require_manager() a;
  select * into v_draft
  from public.schedule_week_drafts
  where id = p_draft_id and museum_id = v_museum
  for update;
  if not found or v_draft.state <> 'draft' or v_draft.revision is distinct from p_expected_revision then
    raise exception 'DRAFT_CONFLICT' using errcode = 'P0001';
  end if;
  update public.schedule_week_drafts
     set state = 'discarded', revision = revision + 1, updated_at = now()
   where id = v_draft.id
   returning * into v_draft;
  perform public.schedule_week_write_audit(
    v_museum,
    'SCHEDULE_WEEK_DISCARDED',
    v_draft.id,
    jsonb_build_object('draft_id', v_draft.id, 'week_start', v_draft.week_start, 'revision', v_draft.revision, 'actor', v_actor)
  );
  return jsonb_build_object('status', 'discarded', 'id', v_draft.id, 'revision', v_draft.revision);
end;
$discard$;

create or replace function public.publish_schedule_week(
  p_draft_id uuid,
  p_expected_revision integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $publish$
declare
  v_actor uuid;
  v_museum uuid;
  v_tz text;
  v_today date;
  v_draft public.schedule_week_drafts%rowtype;
  v_item public.schedule_week_draft_items%rowtype;
  v_employee public.employees%rowtype;
  v_current public.employee_shifts%rowtype;
  v_bounds record;
  v_ready jsonb := '[]'::jsonb;
  v_changed boolean;
  v_reason text;
  v_expected jsonb;
  v_count integer := 0;
  v_n integer;
  v_scheduled integer;
  v_completed integer;
  v_have_current boolean;
  rec record;
begin
  select a.actor, a.museum into v_actor, v_museum from public.schedule_week_require_manager() a;
  select * into v_draft
  from public.schedule_week_drafts
  where id = p_draft_id and museum_id = v_museum
  for update;
  if not found or v_draft.state <> 'draft' or v_draft.revision is distinct from p_expected_revision then
    raise exception 'DRAFT_CONFLICT' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_museum::text || '|' || v_draft.week_start::text, 0));
  v_tz := public.attendance_shift_timezone(v_museum);
  v_today := (now() at time zone v_tz)::date;
  select count(*) into v_n from public.schedule_week_draft_items where draft_id = v_draft.id;
  if v_n = 0 or v_n > 300 then
    raise exception 'INVALID_BATCH' using errcode = '22023';
  end if;

  for rec in
    select distinct employee_id
    from public.schedule_week_draft_items
    where draft_id = v_draft.id
    order by 1
  loop
    perform public.schedule_week_lock_dates(rec.employee_id, v_draft.week_start);
    perform 1 from public.employee_shifts
    where museum_id = v_museum and employee_id = rec.employee_id
      and shift_date between v_draft.week_start - 1 and v_draft.week_start + 6
    for update;
  end loop;

  for v_item in
    select * from public.schedule_week_draft_items
    where draft_id = v_draft.id
    order by employee_id, shift_date
  loop
    if v_item.shift_date < v_draft.week_start or v_item.shift_date > v_draft.week_start + 6 then
      raise exception 'DATE_OUTSIDE_WEEK' using errcode = '22023';
    end if;
    select * into v_employee
    from public.employees
    where id = v_item.employee_id and museum_id = v_museum
    for update;
    if not found or v_employee.status <> 'activo' then
      raise exception 'EMPLOYEE_NOT_ACTIVE' using errcode = '42501';
    end if;
    if v_employee.profile_id is not distinct from v_actor then
      raise exception 'SHIFT_SELF_FORBIDDEN' using errcode = '42501';
    end if;

    select count(*) filter (where status = 'scheduled'),
           count(*) filter (where status = 'completed')
      into v_scheduled, v_completed
    from public.employee_shifts
    where museum_id = v_museum and employee_id = v_item.employee_id and shift_date = v_item.shift_date
      and status in ('scheduled', 'completed', 'day_off');
    if v_completed > 0 then
      raise exception 'COMPLETED_SHIFT_LOCKED' using errcode = 'P0001';
    end if;
    if v_scheduled > 1 then
      raise exception 'MULTIPLE_SHIFTS_REQUIRE_MANUAL_REVIEW' using errcode = 'P0001';
    end if;

    v_have_current := false;
    if v_item.source_shift_id is not null then
      select * into v_current
      from public.employee_shifts
      where id = v_item.source_shift_id
        and museum_id = v_museum
        and employee_id = v_item.employee_id
        and shift_date = v_item.shift_date;
      if not found
         or v_current.updated_at is distinct from v_item.source_updated_at
         or v_current.status is distinct from v_item.source_status
         or v_current.status not in ('scheduled', 'day_off') then
        raise exception 'SHIFT_CONFLICT' using errcode = 'P0001';
      end if;
      v_have_current := true;
    elsif exists (
      select 1 from public.employee_shifts
      where museum_id = v_museum and employee_id = v_item.employee_id and shift_date = v_item.shift_date
        and status in ('scheduled', 'day_off', 'completed')
    ) then
      raise exception 'MISSING_BASELINE_SNAPSHOT' using errcode = 'P0001';
    end if;

    if v_have_current and public.attendance_shift_has_activity(v_current.id) then
      raise exception 'SHIFT_LOCKED' using errcode = 'P0001';
    end if;
    if v_have_current and v_current.status = 'scheduled' and v_current.starts_at <= now() then
      raise exception 'SHIFT_LOCKED' using errcode = 'P0001';
    end if;

    v_changed := true;
    if v_item.action = 'set_shift' then
      select * into v_bounds
      from public.schedule_local_bounds(v_item.shift_date, v_item.starts_local, v_item.ends_local, v_tz);
      if v_bounds.starts_at <= now() then
        raise exception 'SHIFT_LOCKED' using errcode = 'P0001';
      end if;
      if public.schedule_draft_net_minutes(v_item.shift_date, v_item.starts_local, v_item.ends_local, v_item.lunch_minutes, v_tz) not between 1 and 480 then
        raise exception 'INVALID_HOURS' using errcode = '22023';
      end if;
      if v_item.source_status = 'scheduled' then
        v_changed := v_current.starts_at is distinct from v_bounds.starts_at
          or v_current.ends_at is distinct from v_bounds.ends_at
          or v_current.expected_lunch_minutes is distinct from v_item.lunch_minutes;
      end if;
      if v_item.source_status = 'scheduled' and v_changed and length(trim(coalesce(v_item.reason, ''))) < 3 then
        raise exception 'REASON_REQUIRED' using errcode = '22023';
      end if;
    else
      if v_item.shift_date < v_today then
        raise exception 'SHIFT_LOCKED' using errcode = 'P0001';
      end if;
      if length(trim(coalesce(v_item.reason, ''))) < 3 then
        raise exception 'REASON_REQUIRED' using errcode = '22023';
      end if;
      v_changed := v_item.source_status is distinct from 'day_off';
    end if;

    v_ready := v_ready || jsonb_build_array(jsonb_build_object(
      'employeeId', v_item.employee_id,
      'date', v_item.shift_date,
      'action', v_item.action,
      'start', v_item.starts_local,
      'end', v_item.ends_local,
      'lunch', v_item.lunch_minutes,
      'reason', v_item.reason,
      'changed', v_changed
    ));
  end loop;

  perform public.schedule_week_assert_plan(v_museum, v_draft.week_start, v_ready, v_tz);

  for v_item in
    select i.*
    from public.schedule_week_draft_items i
    left join public.employee_shifts s on s.id = i.source_shift_id and s.status = 'scheduled'
    where i.draft_id = v_draft.id
    order by i.employee_id,
      case
        when i.action = 'day_off' then -1000000
        else public.schedule_draft_net_minutes(i.shift_date, i.starts_local, i.ends_local, i.lunch_minutes, v_tz)
             - coalesce(
               floor(extract(epoch from (s.ends_at - s.starts_at)) / 60)::integer - coalesce(s.expected_lunch_minutes, 0),
               0
             )
      end,
      i.shift_date
  loop
    if v_item.action = 'day_off' and v_item.source_status = 'day_off' then
      v_count := v_count + 1;
      continue;
    end if;
    if v_item.action = 'set_shift' and v_item.source_status = 'scheduled' then
      select * into v_current from public.employee_shifts where id = v_item.source_shift_id;
      select * into v_bounds
      from public.schedule_local_bounds(v_item.shift_date, v_item.starts_local, v_item.ends_local, v_tz);
      if v_current.starts_at = v_bounds.starts_at
         and v_current.ends_at = v_bounds.ends_at
         and v_current.expected_lunch_minutes is not distinct from v_item.lunch_minutes then
        v_count := v_count + 1;
        continue;
      end if;
    end if;

    if v_item.action = 'day_off' then
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'updated_at', updated_at)), '[]'::jsonb)
        into v_expected
      from public.employee_shifts
      where museum_id = v_museum and employee_id = v_item.employee_id
        and shift_date = v_item.shift_date and status = 'scheduled';
      perform public.set_employee_day_off(
        p_employee_id => v_item.employee_id,
        p_shift_date => v_item.shift_date,
        p_reason => trim(v_item.reason),
        p_expected_shifts => v_expected
      );
    else
      v_reason := coalesce(nullif(trim(v_item.reason), ''), 'Programación semanal');
      perform public.schedule_employee_shift(
        p_employee_id => v_item.employee_id,
        p_shift_date => v_item.shift_date,
        p_starts_local => v_item.starts_local,
        p_ends_local => v_item.ends_local,
        p_shift_id => v_item.source_shift_id,
        p_expected_lunch_minutes => v_item.lunch_minutes,
        p_set_lunch => true,
        p_shift_type => null,
        p_expected_updated_at => v_item.source_updated_at,
        p_reason => v_reason
      );
    end if;
    v_count := v_count + 1;
  end loop;

  update public.schedule_week_drafts
     set state = 'published',
         published_by = v_actor,
         published_at = now(),
         revision = revision + 1,
         updated_at = now()
   where id = v_draft.id and state = 'draft' and revision = p_expected_revision
   returning * into v_draft;
  if not found then
    raise exception 'DRAFT_CONFLICT' using errcode = 'P0001';
  end if;

  perform public.schedule_week_write_audit(
    v_museum,
    'SCHEDULE_WEEK_PUBLISHED',
    v_draft.id,
    jsonb_build_object(
      'draft_id', v_draft.id,
      'week_start', v_draft.week_start,
      'revision', v_draft.revision,
      'count', v_count,
      'published_by', v_actor,
      'published_at', v_draft.published_at
    )
  );

  return jsonb_build_object(
    'status', 'published',
    'count', v_count,
    'draft_id', v_draft.id,
    'revision', v_draft.revision,
    'week_start', v_draft.week_start,
    'published_at', v_draft.published_at
  );
end;
$publish$;

revoke all on function public.schedule_local_bounds(date, time, time, text) from public;
revoke all on function public.schedule_draft_net_minutes(date, time, time, integer, text) from public;
revoke all on function public.schedule_week_require_manager() from public;
revoke all on function public.schedule_week_lock_dates(uuid, date) from public;
revoke all on function public.schedule_week_write_audit(uuid, text, uuid, jsonb) from public;
revoke all on function public.schedule_week_assert_plan(uuid, date, jsonb, text) from public;

revoke all on function public.save_schedule_week_draft(date, jsonb, uuid, integer) from public;
revoke all on function public.get_schedule_week_draft(date) from public;
revoke all on function public.discard_schedule_week_draft(uuid, integer) from public;
revoke all on function public.publish_schedule_week(uuid, integer) from public;

revoke all on table public.schedule_week_drafts from public;
revoke all on table public.schedule_week_draft_items from public;

do $secure$
declare
  fn text;
  rel text;
begin
  foreach fn in array array[
    'public.save_schedule_week_draft(date,jsonb,uuid,integer)',
    'public.get_schedule_week_draft(date)',
    'public.discard_schedule_week_draft(uuid,integer)',
    'public.publish_schedule_week(uuid,integer)'
  ]
  loop
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', fn);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('grant execute on function %s to authenticated', fn);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('revoke all on function %s from service_role', fn);
    end if;
  end loop;

  foreach fn in array array[
    'public.schedule_local_bounds(date,time,time,text)',
    'public.schedule_draft_net_minutes(date,time,time,integer,text)',
    'public.schedule_week_require_manager()',
    'public.schedule_week_lock_dates(uuid,date)',
    'public.schedule_week_write_audit(uuid,text,uuid,jsonb)',
    'public.schedule_week_assert_plan(uuid,date,jsonb,text)'
  ]
  loop
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', fn);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on function %s from authenticated', fn);
    end if;
  end loop;

  foreach rel in array array['public.schedule_week_drafts', 'public.schedule_week_draft_items']
  loop
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table %s from anon', rel);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on table %s from authenticated', rel);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('revoke all on table %s from service_role', rel);
    end if;
  end loop;
end;
$secure$;
