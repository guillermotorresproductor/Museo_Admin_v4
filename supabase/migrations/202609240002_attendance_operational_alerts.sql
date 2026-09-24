-- Operational attendance alerts. Separate from attendance_incidents and overtime.
-- Patches the deployed has_permission; does not replace it.
-- Does not call list_today_attendance or ensure_pending_attendance_incidents.

insert into public.permissions(code, description, sensitivity)
values ('attendance.alerts.read', 'Consultar y revisar las alertas operativas de asistencia del museo', 'sensitive')
on conflict (code) do update set description = excluded.description, sensitivity = excluded.sensitivity;

do $patch$
declare src text; patched text; pos integer;
  grant_sql text := $grant$
 if requested_permission = 'attendance.alerts.read'
    and not exists(
      select 1 from public.user_permissions u
      join public.permissions p on p.id = u.permission_id
      where u.user_id = auth.uid()
        and u.museum_id = public.current_user_museum_id()
        and p.code = 'attendance.alerts.read'
        and u.effect = 'deny'
        and (u.valid_until is null or u.valid_until > now())
    )
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
  if position('attendance.alerts.read' in src) > 0 then
    return;
  end if;
  pos := position(E'\nbegin' in src);
  if pos = 0 then
    raise exception 'HAS_PERMISSION_PATCH_FAILED';
  end if;
  patched := overlay(src placing E'\nbegin' || grant_sql from pos for 6);
  if patched = src or position('attendance.alerts.read' in patched) = 0 then
    raise exception 'HAS_PERMISSION_PATCH_FAILED';
  end if;
  execute patched;
end
$patch$;

create table public.attendance_operational_alerts (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  shift_id uuid not null references public.employee_shifts(id) on delete restrict,
  alert_date date not null,
  alert_type text not null check (alert_type in (
    'late','missing_clock_in','lunch_exceeded','missing_lunch','early_clock_out','missing_clock_out','inconsistent_sequence'
  )),
  detected_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active','auto_resolved','reviewed')),
  resolved_at timestamptz,
  resolution_type text check (resolution_type is null or resolution_type in (
    'auto_clock_in','auto_lunch_return','auto_lunch_recorded','auto_clock_out','auto_sequence_valid','auto_condition_cleared','manual_review'
  )),
  details jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shift_id, alert_type)
);

alter table public.attendance_operational_alerts enable row level security;
revoke all on public.attendance_operational_alerts from public, anon, authenticated;

create or replace function public.sync_attendance_operational_alerts()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  museum uuid := public.current_user_museum_id();
  today date := (now() at time zone 'America/Puerto_Rico')::date;
  discarded integer;
  exit_grace interval := interval '5 minutes';
begin
  if auth.uid() is null or museum is null or not public.has_permission('attendance.alerts.read') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  with shifts as (
    select s.id, s.museum_id, s.employee_id, s.starts_at, s.ends_at,
           coalesce(s.expected_lunch_minutes, 0) as expected_lunch_minutes,
           cfg.late_tolerance_minutes
    from public.employee_shifts s
    join public.employees e on e.id = s.employee_id and e.museum_id = s.museum_id and e.status = 'activo'
    left join public.attendance_settings cfg on cfg.museum_id = s.museum_id
    where s.museum_id = museum
      and s.status = 'scheduled'
      and (s.starts_at at time zone 'America/Puerto_Rico')::date = today
  ),
  effective as (
    select ev.shift_id, ev.event_type, ev.occurred_at
    from public.attendance_events ev
    join shifts s on s.id = ev.shift_id
    where ev.museum_id = museum
      and not exists (
        select 1 from public.attendance_events newer
        where newer.supersedes_event_id = ev.id
      )
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
    from shifts s
    left join effective ev on ev.shift_id = s.id
    group by s.id, s.museum_id, s.employee_id, s.starts_at, s.ends_at, s.expected_lunch_minutes, s.late_tolerance_minutes
  ),
  classified as (
    select p.*,
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
      case when p.lunch_in is null then now() else p.lunch_in end as lunch_end
    from picked p
  ),
  desired as (
    select c.museum_id, c.employee_id, c.id as shift_id, today as alert_date, v.alert_type, v.target_status, v.resolution_type, v.details
    from classified c
    cross join lateral (
      values
        ('late', 'active', null::text, jsonb_build_object(
          'clock_in', c.clock_in,
          'late_minutes', floor(extract(epoch from (c.clock_in - c.starts_at)) / 60)::integer,
          'tolerance_minutes', c.late_tolerance_minutes
        )),
        ('missing_clock_in', 'active', null::text, jsonb_build_object(
          'starts_at', c.starts_at,
          'tolerance_minutes', c.late_tolerance_minutes
        )),
        ('lunch_exceeded', case when c.lunch_in is null then 'active' else 'auto_resolved' end,
          case when c.lunch_in is null then null else 'auto_lunch_return' end,
          jsonb_build_object(
            'lunch_out', c.lunch_out,
            'lunch_in', c.lunch_in,
            'expected_lunch_minutes', c.expected_lunch_minutes,
            'exceeded_minutes', floor(extract(epoch from (c.lunch_end - c.lunch_out)) / 60)::integer - c.expected_lunch_minutes
          )),
        ('missing_lunch', 'active', null::text, jsonb_build_object(
          'expected_lunch_minutes', c.expected_lunch_minutes,
          'ends_at', c.ends_at
        )),
        ('early_clock_out', 'active', null::text, jsonb_build_object(
          'clock_out', c.clock_out,
          'ends_at', c.ends_at,
          'early_minutes', floor(extract(epoch from (c.ends_at - c.clock_out)) / 60)::integer
        )),
        ('missing_clock_out', 'active', null::text, jsonb_build_object('ends_at', c.ends_at)),
        ('inconsistent_sequence', 'active', null::text, jsonb_build_object(
          'clock_in', c.clock_in, 'lunch_out', c.lunch_out, 'lunch_in', c.lunch_in, 'clock_out', c.clock_out
        ))
    ) as v(alert_type, target_status, resolution_type, details)
    where
      (v.alert_type = 'late' and c.late_tolerance_minutes is not null and c.clock_in_count = 1
        and c.clock_in > c.starts_at + make_interval(mins => c.late_tolerance_minutes))
      or (v.alert_type = 'missing_clock_in' and c.late_tolerance_minutes is not null
        and c.clock_in_count = 0 and c.lunch_out_count = 0 and c.lunch_in_count = 0 and c.clock_out_count = 0 and c.unknown_count = 0
        and now() > c.starts_at + make_interval(mins => c.late_tolerance_minutes))
      or (v.alert_type = 'lunch_exceeded' and c.expected_lunch_minutes > 0
        and c.clock_in_count = 1 and c.lunch_out_count = 1 and c.lunch_in_count <= 1
        and c.lunch_out >= c.clock_in and (c.lunch_in is null or c.lunch_in >= c.lunch_out)
        and c.lunch_end > c.lunch_out + make_interval(mins => c.expected_lunch_minutes))
      or (v.alert_type = 'missing_lunch' and c.expected_lunch_minutes > 0
        and c.clock_in_count = 1 and c.lunch_out_count = 0 and c.lunch_in_count = 0
        and now() >= c.ends_at)
      or (v.alert_type = 'early_clock_out' and c.clock_in_count = 1 and c.clock_out_count = 1
        and c.clock_out >= c.clock_in and c.clock_out < c.ends_at
        and (
          (c.lunch_out_count = 0 and c.lunch_in_count = 0)
          or (c.lunch_out_count = 1 and c.lunch_in_count = 1 and c.lunch_out >= c.clock_in and c.lunch_in >= c.lunch_out and c.clock_out >= c.lunch_in)
        ))
      or (v.alert_type = 'missing_clock_out' and c.clock_in_count = 1 and c.clock_out_count = 0
        and now() >= c.ends_at + exit_grace)
      or (v.alert_type = 'inconsistent_sequence' and c.inconsistent)
  ),
  upserted as (
    insert into public.attendance_operational_alerts as a (
      museum_id, employee_id, shift_id, alert_date, alert_type, status, resolved_at, resolution_type, details
    )
    select d.museum_id, d.employee_id, d.shift_id, d.alert_date, d.alert_type, d.target_status,
      case when d.target_status = 'auto_resolved' then now() else null end,
      d.resolution_type, d.details
    from desired d
    on conflict (shift_id, alert_type) do update set
      details = excluded.details,
      updated_at = now(),
      status = case
        when a.status = 'reviewed' then a.status
        when excluded.status = 'auto_resolved' then 'auto_resolved'
        else a.status
      end,
      resolved_at = case
        when a.status = 'reviewed' then a.resolved_at
        when excluded.status = 'auto_resolved' then coalesce(a.resolved_at, now())
        else a.resolved_at
      end,
      resolution_type = case
        when a.status = 'reviewed' then a.resolution_type
        when excluded.status = 'auto_resolved' then excluded.resolution_type
        else a.resolution_type
      end
    returning a.id
  ),
  cleared as (
    update public.attendance_operational_alerts a
       set status = 'auto_resolved',
           resolved_at = coalesce(a.resolved_at, now()),
           resolution_type = case a.alert_type
             when 'missing_clock_in' then 'auto_clock_in'
             when 'lunch_exceeded' then 'auto_lunch_return'
             when 'missing_lunch' then 'auto_lunch_recorded'
             when 'missing_clock_out' then 'auto_clock_out'
             when 'inconsistent_sequence' then 'auto_sequence_valid'
             else 'auto_condition_cleared'
           end,
           updated_at = now()
     where a.museum_id = museum
       and a.alert_date = today
       and a.status = 'active'
       and not exists (
         select 1 from desired d
         where d.shift_id = a.shift_id and d.alert_type = a.alert_type
       )
    returning a.id
  )
  select count(*) into discarded from upserted;

  return public.list_attendance_operational_alerts();
end
$$;

create or replace function public.list_attendance_operational_alerts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  museum uuid := public.current_user_museum_id();
begin
  if auth.uid() is null or museum is null or not public.has_permission('attendance.alerts.read') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'employee_id', a.employee_id,
      'name', e.first_name || ' ' || e.last_name,
      'shift_id', a.shift_id,
      'alert_date', a.alert_date,
      'alert_type', a.alert_type,
      'status', a.status,
      'detected_at', a.detected_at,
      'resolved_at', a.resolved_at,
      'resolution_type', a.resolution_type,
      'details', a.details,
      'reviewed_by', a.reviewed_by,
      'reviewed_at', a.reviewed_at,
      'review_comment', a.review_comment
    ) order by case a.status when 'active' then 0 when 'auto_resolved' then 1 else 2 end, e.last_name, e.first_name, a.alert_type)
    from public.attendance_operational_alerts a
    join public.employees e on e.id = a.employee_id and e.museum_id = a.museum_id
    where a.museum_id = museum
      and (a.alert_date = (now() at time zone 'America/Puerto_Rico')::date or a.status = 'active')
  ), '[]'::jsonb);
end
$$;

create or replace function public.review_attendance_operational_alert(p_alert_id uuid, p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  museum uuid := public.current_user_museum_id();
  row_id uuid;
begin
  if auth.uid() is null or museum is null or not public.has_permission('attendance.alerts.read') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.attendance_operational_alerts
     set status = 'reviewed',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_comment = nullif(trim(coalesce(p_comment, '')), ''),
         resolution_type = 'manual_review',
         resolved_at = coalesce(resolved_at, now()),
         updated_at = now()
   where id = p_alert_id
     and museum_id = museum
     and status in ('active', 'auto_resolved')
  returning id into row_id;
  if row_id is null then
    raise exception 'ALERT_NOT_REVIEWABLE' using errcode = 'P0001';
  end if;
  insert into public.audit_logs(museum_id, actor_user_id, action, table_name, record_id, new_value)
  values (museum, auth.uid(), 'ATTENDANCE_ALERT_REVIEWED', 'attendance_operational_alerts', row_id,
    jsonb_build_object('comment', nullif(trim(coalesce(p_comment, '')), '')));
  return public.list_attendance_operational_alerts();
end
$$;

revoke all on function public.sync_attendance_operational_alerts() from public, anon;
revoke all on function public.list_attendance_operational_alerts() from public, anon;
revoke all on function public.review_attendance_operational_alert(uuid, text) from public, anon;
grant execute on function public.sync_attendance_operational_alerts() to authenticated;
grant execute on function public.list_attendance_operational_alerts() to authenticated;
grant execute on function public.review_attendance_operational_alert(uuid, text) to authenticated;
