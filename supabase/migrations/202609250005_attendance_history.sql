-- Historical attendance report. Does not replace list_today_staff_status
-- or any punch, geofence, correction, or overtime function.

insert into public.permissions(code, description, sensitivity)
values ('attendance.history.read', 'Consultar el historial de asistencia del museo', 'sensitive')
on conflict (code) do update set description = excluded.description, sensitivity = excluded.sensitivity;

do $patch$
declare src text; patched text; pos integer;
  grant_sql text := $grant$
 -- attendance_history_access: deny wins, then the same profiles that read today.
 if requested_permission = 'attendance.history.read'
    and exists(
      select 1 from public.user_permissions u
      join public.permissions p on p.id = u.permission_id
      where u.user_id = auth.uid()
        and u.museum_id = public.current_user_museum_id()
        and p.code = 'attendance.history.read'
        and u.effect = 'deny'
        and (u.valid_until is null or u.valid_until > now())
    ) then
   return false;
 end if;
 if requested_permission = 'attendance.history.read'
    and exists(
      select 1 from public.profiles pr
      where pr.id = auth.uid()
        and pr.museum_id = public.current_user_museum_id()
        and pr.status in ('active','activo')
    )
    and (
      public.current_employee_module_profile() in ('administrador_general','director_ejecutivo','gerente_administrativo')
      or (
        public.current_employee_module_profile() is null
        and exists(
          select 1 from public.profiles pr
          where pr.id = auth.uid() and lower(pr.role) = 'administrador'
        )
      )
    ) then
   return true;
 end if;
$grant$;
begin
  src := pg_get_functiondef('public.has_permission(text)'::regprocedure);
  if position('attendance_history_access' in src) > 0 then
    return;
  end if;
  pos := position(E'\nbegin' in src);
  if pos = 0 then raise exception 'HAS_PERMISSION_PATCH_FAILED'; end if;
  patched := overlay(src placing E'\nbegin' || grant_sql from pos for 6);
  if patched = src or position('attendance_history_access' in patched) = 0 then
    raise exception 'HAS_PERMISSION_PATCH_FAILED';
  end if;
  execute patched;
end
$patch$;

create or replace function public.attendance_report_bounds(p_kind text, p_anchor date)
returns table(period_start date, period_end date)
language plpgsql
immutable
set search_path = ''
as $$
declare
  month_start date;
  month_end date;
begin
  if p_anchor is null or p_kind not in ('day','week','semimonth','month') then
    raise exception 'INVALID_PERIOD' using errcode = '22023';
  end if;
  if p_kind = 'day' then
    period_start := p_anchor;
    period_end := p_anchor;
  elsif p_kind = 'week' then
    period_start := p_anchor - (extract(isodow from p_anchor)::integer - 1);
    period_end := period_start + 6;
  elsif p_kind = 'month' then
    month_start := date_trunc('month', p_anchor)::date;
    period_start := month_start;
    period_end := (month_start + interval '1 month' - interval '1 day')::date;
  else
    month_start := date_trunc('month', p_anchor)::date;
    month_end := (month_start + interval '1 month' - interval '1 day')::date;
    if extract(day from p_anchor) <= 15 then
      period_start := month_start;
      period_end := month_start + 14;
    else
      period_start := month_start + 15;
      period_end := month_end;
    end if;
  end if;
  return next;
end
$$;

revoke all on function public.attendance_report_bounds(text, date) from public, anon, authenticated;

create or replace function public.list_attendance_history(p_from date, p_to date)
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
        select ev.shift_id, ev.event_type, ev.occurred_at, ev.classification
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
          max(ev.occurred_at) filter (where ev.event_type = 'clock_in') as clock_in,
          max(ev.occurred_at) filter (where ev.event_type = 'lunch_out') as lunch_out,
          max(ev.occurred_at) filter (where ev.event_type = 'lunch_in') as lunch_in,
          max(ev.occurred_at) filter (where ev.event_type = 'clock_out') as clock_out,
          (array_agg(ev.classification order by ev.occurred_at desc) filter (where ev.event_type = 'clock_in'))[1] as clock_in_classification,
          count(*) filter (where ev.event_type = 'clock_in') as clock_in_count,
          count(*) filter (where ev.event_type = 'lunch_out') as lunch_out_count,
          count(*) filter (where ev.event_type = 'lunch_in') as lunch_in_count,
          count(*) filter (where ev.event_type = 'clock_out') as clock_out_count,
          count(*) filter (where ev.event_type not in ('clock_in','lunch_out','lunch_in','clock_out')) as unknown_count,
          exists(select 1 from corrected c where c.shift_id = s.id) as corrected
        from shifts s
        left join effective ev on ev.shift_id = s.id
        group by s.id, s.employee_id, s.shift_date, s.starts_at, s.ends_at
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
          coalesce(ot.approved_minutes, 0) as approved_overtime_minutes
        from picked p
        left join public.attendance_overtime_reviews ot
          on ot.shift_id = p.shift_id
         and ot.museum_id = museum
         and ot.status in ('approved','partially_approved')
      ),
      timed as (
        select
          c.*,
          case
            when c.inconsistent then 'INCONSISTENCIA'
            when c.clock_in is null then 'SIN PONCHAR'
            when c.incomplete then 'INCOMPLETA'
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
            'shift_date', t.shift_date,
            'clock_in', t.clock_in,
            'lunch_out', t.lunch_out,
            'lunch_in', t.lunch_in,
            'clock_out', t.clock_out,
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
      join public.employees e on e.id = d.employee_id and e.museum_id = museum and e.status = 'activo'
    ), '[]'::jsonb)
  );
end
$$;

revoke all on function public.list_attendance_history(date, date) from public, anon;
grant execute on function public.list_attendance_history(date, date) to authenticated;
