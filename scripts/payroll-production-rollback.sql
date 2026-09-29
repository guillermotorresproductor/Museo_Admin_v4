-- Prepared only. Do not run unless the production deploy must be withdrawn.
-- Drops the new Nómina real objects. Does not update or delete employee_compensation rows.
-- Refuses to continue when employee_budget_assignments has any row.
begin;

do $rollback_guard$
declare
  assignment_rows bigint;
begin
  if to_regclass('public.employee_budget_assignments') is null
     or to_regprocedure('public.payroll_actual(date,date)') is null
     or to_regprocedure('public.list_attendance_history(date,date,boolean)') is null then
    raise exception 'ROLLBACK_ABORT unexpected_state';
  end if;

  select count(*) into assignment_rows
  from public.employee_budget_assignments;
  if assignment_rows is distinct from 0 then
    raise exception 'ROLLBACK_ABORT assignments_not_empty';
  end if;
end
$rollback_guard$;

drop function if exists public.payroll_actual(date, date);
drop function if exists public.assign_employee_budget_line(uuid, uuid, date);
drop function if exists public.close_employee_budget_assignment(uuid, date);
drop table if exists public.employee_budget_assignments;
drop function if exists public.employee_budget_assignments_guard();

drop function if exists public.list_attendance_history(date, date, boolean);

create function public.list_attendance_history(
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  museum uuid := public.current_user_museum_id();
begin
  if auth.uid() is null or museum is null or not public.has_permission('attendance.history.read') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'INVALID_PERIOD' using errcode = '22023';
  end if;
  if (p_to - p_from) > 365 then
    raise exception 'RANGE_TOO_LONG' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'employees', coalesce((
      with shifts as (
        select s.id, s.employee_id, s.starts_at, s.ends_at,
               (s.starts_at at time zone 'America/Puerto_Rico')::date as shift_date
        from public.employee_shifts s
        where s.museum_id = museum
          and s.status = 'scheduled'
          and (s.starts_at at time zone 'America/Puerto_Rico')::date between p_from and p_to
      ),
      effective as (
        select ev.shift_id, ev.event_type, ev.occurred_at, ev.classification,
               public.attendance_is_excluded(ev.shift_id, ev.id) as is_excluded
        from public.attendance_events ev
        join shifts s on s.id = ev.shift_id
        where ev.museum_id = museum
          and not exists (
            select 1 from public.attendance_events newer
            where newer.supersedes_event_id = ev.id
          )
      ),
      corrected as (
        select distinct ev.shift_id
        from public.attendance_events ev
        join shifts s on s.id = ev.shift_id
        where ev.museum_id = museum
          and (ev.correction_request_id is not null or ev.supersedes_event_id is not null)
      ),
      picked as (
        select
          s.id as shift_id,
          s.employee_id,
          s.shift_date,
          s.starts_at,
          s.ends_at,
          max(ev.occurred_at) filter (where ev.event_type = 'clock_in' and not ev.is_excluded) as clock_in,
          max(ev.occurred_at) filter (where ev.event_type = 'lunch_out' and not ev.is_excluded) as lunch_out,
          max(ev.occurred_at) filter (where ev.event_type = 'lunch_in' and not ev.is_excluded) as lunch_in,
          max(ev.occurred_at) filter (where ev.event_type = 'clock_out' and not ev.is_excluded) as clock_out,
          max(ev.occurred_at) filter (where ev.event_type = 'clock_in') as visible_clock_in,
          max(ev.occurred_at) filter (where ev.event_type = 'lunch_out') as visible_lunch_out,
          max(ev.occurred_at) filter (where ev.event_type = 'lunch_in') as visible_lunch_in,
          max(ev.occurred_at) filter (where ev.event_type = 'clock_out') as visible_clock_out,
          coalesce(bool_or(ev.is_excluded) filter (where ev.event_type = 'clock_in'), false) as clock_in_excluded,
          coalesce(bool_or(ev.is_excluded) filter (where ev.event_type = 'lunch_out'), false) as lunch_out_excluded,
          coalesce(bool_or(ev.is_excluded) filter (where ev.event_type = 'lunch_in'), false) as lunch_in_excluded,
          coalesce(bool_or(ev.is_excluded) filter (where ev.event_type = 'clock_out'), false) as clock_out_excluded,
          public.attendance_is_excluded(s.id, null) as shift_excluded,
          (array_agg(ev.classification order by ev.occurred_at desc) filter (where ev.event_type = 'clock_in' and not ev.is_excluded))[1] as clock_in_classification,
          count(*) filter (where ev.event_type = 'clock_in' and not ev.is_excluded) as clock_in_count,
          count(*) filter (where ev.event_type = 'lunch_out' and not ev.is_excluded) as lunch_out_count,
          count(*) filter (where ev.event_type = 'lunch_in' and not ev.is_excluded) as lunch_in_count,
          count(*) filter (where ev.event_type = 'clock_out' and not ev.is_excluded) as clock_out_count,
          count(*) filter (where ev.event_type not in ('clock_in','lunch_out','lunch_in','clock_out') and not ev.is_excluded) as unknown_count,
          exists(select 1 from corrected c where c.shift_id = s.id) as corrected
        from shifts s
        left join effective ev on ev.shift_id = s.id
        group by s.id, s.employee_id, s.shift_date, s.starts_at, s.ends_at, public.attendance_is_excluded(s.id, null)
      ),
      classified as (
        select
          p.*,
          (
            p.clock_in_count > 1 or p.lunch_out_count > 1 or p.lunch_in_count > 1 or p.clock_out_count > 1
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
          (
            p.ends_at <= now()
            and p.clock_in is not null
            and (
              p.clock_out is null
              or (p.lunch_out is not null and p.lunch_in is null)
              or (p.lunch_in is not null and p.lunch_out is null)
            )
          ) as incomplete,
          case when p.shift_excluded then 0 else coalesce(ot.approved_minutes, 0) end as approved_overtime_minutes
        from picked p
        left join public.attendance_overtime_reviews ot
          on ot.shift_id = p.shift_id
         and ot.museum_id = museum
         and ot.status in ('approved','partially_approved')
         and not p.shift_excluded
         and not public.attendance_is_excluded(p.shift_id, ot.clock_out_event_id)
      ),
      timed as (
        select
          c.*,
          case
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
          end as status,
          case
            when c.inconsistent or c.clock_in is null then 0
            when c.clock_out is null and c.ends_at <= now() then
              case
                when c.lunch_out is null then 0
                else greatest(0, floor(extract(epoch from (least(c.lunch_out, c.ends_at) - greatest(c.clock_in, c.starts_at))) / 60))::integer
              end
            else
              greatest(0, floor(extract(epoch from (
                least(coalesce(c.lunch_out, coalesce(c.clock_out, now())), coalesce(c.clock_out, now()), c.ends_at)
                - greatest(c.clock_in, c.starts_at)
              )) / 60))::integer
              + case
                  when c.lunch_in is null or c.lunch_in >= c.ends_at then 0
                  else greatest(0, floor(extract(epoch from (
                    least(coalesce(c.clock_out, now()), c.ends_at) - greatest(c.lunch_in, c.starts_at)
                  )) / 60))::integer
                end
          end as regular_minutes
        from classified c
      ),
      days as (
        select
          t.employee_id,
          jsonb_agg(jsonb_build_object(
            'shift_id', t.shift_id,
            'shift_date', t.shift_date,
            'shift_excluded', t.shift_excluded,
            'clock_in', t.visible_clock_in,
            'lunch_out', t.visible_lunch_out,
            'lunch_in', t.visible_lunch_in,
            'clock_out', t.visible_clock_out,
            'clock_in_excluded', t.clock_in_excluded,
            'lunch_out_excluded', t.lunch_out_excluded,
            'lunch_in_excluded', t.lunch_in_excluded,
            'clock_out_excluded', t.clock_out_excluded,
            'regular_minutes', t.regular_minutes,
            'approved_overtime_minutes', t.approved_overtime_minutes,
            'status', t.status,
            'corrected', t.corrected,
            'late', t.clock_in_classification in ('late','partial_absence')
          ) order by t.shift_date) as day_rows,
          count(*)::integer as scheduled_days,
          count(*) filter (where t.clock_in is not null or t.lunch_out is not null or t.lunch_in is not null or t.clock_out is not null)::integer as days_with_punches,
          coalesce(sum(t.regular_minutes), 0)::integer as regular_minutes,
          coalesce(sum(t.approved_overtime_minutes), 0)::integer as approved_overtime_minutes,
          count(*) filter (where t.clock_in_classification in ('late','partial_absence'))::integer as late_days,
          count(*) filter (where t.inconsistent or t.incomplete)::integer as incident_days,
          count(*) filter (where t.corrected)::integer as corrected_days
        from timed t
        group by t.employee_id
      )
      select jsonb_agg(jsonb_build_object(
        'employee_id', e.id,
        'name', e.first_name || ' ' || e.last_name,
        'scheduled_days', d.scheduled_days,
        'days_with_punches', d.days_with_punches,
        'regular_minutes', d.regular_minutes,
        'approved_overtime_minutes', d.approved_overtime_minutes,
        'late_days', d.late_days,
        'incident_days', d.incident_days,
        'corrected_days', d.corrected_days,
        'days', d.day_rows
      ) order by e.last_name, e.first_name)
      from days d
      join public.employees e on e.id = d.employee_id and e.museum_id = museum
        and e.status = 'activo'
    ), '[]'::jsonb)
  );
end
$$;


revoke all on function public.list_attendance_history(date, date) from public, anon;
grant execute on function public.list_attendance_history(date, date) to authenticated;

notify pgrst, 'reload schema';
commit;
