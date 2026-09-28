-- The punch button follows the current shift only. A past shift that started
-- and did not finish can show as inconsistent. No punches are created or closed.

create or replace function public.attendance_current_shift_action(event_types text[])
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when event_types is null or cardinality(event_types) = 0 then 'clock_in'
    when event_types[cardinality(event_types)] = 'clock_in' then 'lunch_out'
    when event_types[cardinality(event_types)] = 'lunch_out' then 'lunch_in'
    when event_types[cardinality(event_types)] = 'lunch_in' then 'clock_out'
    else null
  end
$$;

revoke all on function public.attendance_current_shift_action(text[]) from public, anon, authenticated;

create or replace function public.my_current_punch_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  employee_row public.employees;
  shift_row public.employee_shifts;
  museum uuid := public.current_user_museum_id();
  operative text[];
begin
  if auth.uid() is null or museum is null then
    return jsonb_build_object('shift_id', null, 'events', '[]'::jsonb, 'action', 'clock_in', 'historical_open', '[]'::jsonb);
  end if;
  select * into employee_row
    from public.employees
   where museum_id = museum and profile_id = auth.uid() and status = 'activo';
  if not found then
    return jsonb_build_object('shift_id', null, 'events', '[]'::jsonb, 'action', 'clock_in', 'historical_open', '[]'::jsonb);
  end if;
  select * into shift_row
    from public.employee_shifts
   where museum_id = museum
     and employee_id = employee_row.id
     and status = 'scheduled'
     and now() between starts_at - interval '24 hours' and ends_at + interval '16 hours'
   order by abs(extract(epoch from (now() - starts_at)))
   limit 1;
  select coalesce(array_agg(ev.event_type order by ev.occurred_at), '{}'::text[])
    into operative
    from public.attendance_events ev
   where shift_row.id is not null
     and ev.shift_id = shift_row.id
     and ev.employee_id = employee_row.id
     and not exists (
       select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id
     )
     and not public.attendance_is_excluded(ev.shift_id, null)
     and not public.attendance_is_excluded(ev.shift_id, ev.id);
  return jsonb_build_object(
    'shift_id', shift_row.id,
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ev.id,
        'shift_id', ev.shift_id,
        'event_type', ev.event_type,
        'occurred_at', ev.occurred_at
      ) order by ev.occurred_at)
      from public.attendance_events ev
      where shift_row.id is not null
        and ev.shift_id = shift_row.id
        and ev.employee_id = employee_row.id
        and not exists (
          select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id
        )
        and not public.attendance_is_excluded(ev.shift_id, null)
        and not public.attendance_is_excluded(ev.shift_id, ev.id)
    ), '[]'::jsonb),
    'action', public.attendance_current_shift_action(operative),
    'historical_open', coalesce((
      select jsonb_agg(jsonb_build_object(
        'shift_id', open_shift.shift_id,
        'shift_date', open_shift.shift_date,
        'excluded', open_shift.excluded,
        'last_event_type', open_shift.last_event_type,
        'last_occurred_at', open_shift.last_occurred_at
      ) order by open_shift.shift_date desc)
      from (
        select
          s.id as shift_id,
          s.shift_date,
          public.attendance_is_excluded(s.id, null) as excluded,
          (
            select ev.event_type
              from public.attendance_events ev
             where ev.shift_id = s.id
               and not exists (
                 select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id
               )
             order by ev.occurred_at desc
             limit 1
          ) as last_event_type,
          (
            select ev.occurred_at
              from public.attendance_events ev
             where ev.shift_id = s.id
               and not exists (
                 select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id
               )
             order by ev.occurred_at desc
             limit 1
          ) as last_occurred_at,
          exists (
            select 1 from public.attendance_events ev
             where ev.shift_id = s.id and ev.event_type = 'clock_in'
               and not exists (
                 select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id
               )
          ) as started,
          exists (
            select 1 from public.attendance_events ev
             where ev.shift_id = s.id and ev.event_type = 'clock_out'
               and not exists (
                 select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id
               )
          ) as closed,
          exists (
            select 1 from public.attendance_events ev
             where ev.shift_id = s.id and ev.event_type = 'lunch_out'
               and not exists (
                 select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id
               )
          ) as left_lunch,
          exists (
            select 1 from public.attendance_events ev
             where ev.shift_id = s.id and ev.event_type = 'lunch_in'
               and not exists (
                 select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id
               )
          ) as returned_lunch
        from public.employee_shifts s
        where s.museum_id = museum
          and s.employee_id = employee_row.id
          and s.ends_at <= now()
          and s.id is distinct from shift_row.id
      ) open_shift
      where open_shift.started
        and (
          not open_shift.closed
          or (open_shift.left_lunch and not open_shift.returned_lunch)
          or (open_shift.returned_lunch and not open_shift.left_lunch)
        )
    ), '[]'::jsonb)
  );
end
$$;

revoke all on function public.my_current_punch_state() from public, anon;
grant execute on function public.my_current_punch_state() to authenticated;

do $history_status$
declare
  src text := replace(pg_get_functiondef('public.list_attendance_history(date,date)'::regprocedure), E'\r\n', E'\n');
  old text := replace($old$          case
            when c.inconsistent then 'INCONSISTENCIA'
            when c.clock_in is null then 'SIN PONCHAR'
            when c.incomplete then 'INCOMPLETA'
            when c.clock_out is null and c.ends_at > now() then 'EN CURSO'
            else 'COMPLETA'
          end as status,$old$, E'\r\n', E'\n');
  new text := replace($new$          case
            when c.inconsistent then 'INCONSISTENCIA'
            when c.incomplete then 'INCONSISTENCIA'
            when c.clock_in is null
             and c.ends_at <= now()
             and c.visible_clock_in is not null
             and (
               c.visible_clock_out is null
               or (c.visible_lunch_out is not null and c.visible_lunch_in is null)
               or (c.visible_lunch_in is not null and c.visible_lunch_out is null)
             ) then 'INCONSISTENCIA'
            when c.clock_in is null then 'SIN PONCHAR'
            when c.clock_out is null and c.ends_at > now() then 'EN CURSO'
            else 'COMPLETA'
          end as status,$new$, E'\r\n', E'\n');
begin
  if position('when c.incomplete then ''INCONSISTENCIA''' in src) > 0
     and position('c.visible_clock_in is not null' in src) > 0 then
    return;
  end if;
  if position(old in src) = 0 then
    raise exception 'HISTORY_STATUS_PATCH_FAILED';
  end if;
  execute replace(src, old, new);
end
$history_status$;
