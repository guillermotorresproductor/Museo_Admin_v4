-- Read-only "estado del personal hoy". Does not rewrite has_permission from a
-- snapshot: it inserts one early grant into whatever resolver is deployed.
-- Does not create schedule rules, shifts, events, or incident rows.

insert into public.permissions(code, description, sensitivity)
values ('attendance.today.read', 'Consultar el estado de asistencia del personal de hoy', 'sensitive')
on conflict (code) do update set description = excluded.description, sensitivity = excluded.sensitivity;

do $patch$
declare src text; patched text; pos integer;
  grant_sql text := $grant$
 if requested_permission = 'attendance.today.read'
    and not exists(
      select 1 from public.user_permissions u
      join public.permissions p on p.id = u.permission_id
      where u.user_id = auth.uid()
        and u.museum_id = public.current_user_museum_id()
        and p.code = 'attendance.today.read'
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
  if position('attendance.today.read' in src) > 0 then
    return;
  end if;
  pos := position(E'\nbegin' in src);
  if pos = 0 then
    raise exception 'HAS_PERMISSION_PATCH_FAILED';
  end if;
  patched := overlay(src placing E'\nbegin' || grant_sql from pos for 6);
  if patched = src or position('attendance.today.read' in patched) = 0 then
    raise exception 'HAS_PERMISSION_PATCH_FAILED';
  end if;
  execute patched;
end
$patch$;

create or replace function public.list_today_staff_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  museum uuid := public.current_user_museum_id();
  today date := (now() at time zone 'America/Puerto_Rico')::date;
begin
  if auth.uid() is null or museum is null or not public.has_permission('attendance.today.read') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return coalesce((
    with shifts as (
      select s.id, s.employee_id, s.starts_at, s.ends_at, s.expected_lunch_minutes
      from public.employee_shifts s
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
      select
        s.id as shift_id,
        s.employee_id,
        s.starts_at,
        s.ends_at,
        s.expected_lunch_minutes,
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
      group by s.id, s.employee_id, s.starts_at, s.ends_at, s.expected_lunch_minutes
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
        ) as inconsistent
      from picked p
    ),
    timed as (
      select
        c.*,
        case
          when c.inconsistent then 'INCONSISTENCIA'
          when c.clock_out is not null then 'JORNADA TERMINADA'
          when c.clock_in is null then 'NO HA PONCHADO'
          when c.lunch_out is not null and c.lunch_in is null then 'ALMUERZO'
          else 'TRABAJANDO'
        end as status,
        case
          when c.inconsistent or c.clock_in is null then 0
          else
            greatest(0, floor(extract(epoch from (
              least(coalesce(c.lunch_out, coalesce(c.clock_out, now())), coalesce(c.clock_out, now()))
              - greatest(c.clock_in, c.starts_at)
            )) / 60))::integer
            + case
                when c.lunch_in is null then 0
                else greatest(0, floor(extract(epoch from (coalesce(c.clock_out, now()) - c.lunch_in)) / 60))::integer
              end
        end as worked_minutes
      from classified c
    )
    select jsonb_agg(jsonb_build_object(
      'employee_id', e.id,
      'name', e.first_name || ' ' || e.last_name,
      'shift_id', t.shift_id,
      'starts_at', t.starts_at,
      'ends_at', t.ends_at,
      'expected_lunch_minutes', t.expected_lunch_minutes,
      'clock_in', t.clock_in,
      'lunch_out', t.lunch_out,
      'lunch_in', t.lunch_in,
      'clock_out', t.clock_out,
      'status', t.status,
      'worked_minutes', t.worked_minutes
    ) order by e.last_name, e.first_name)
    from timed t
    join public.employees e on e.id = t.employee_id and e.museum_id = museum and e.status = 'activo'
  ), '[]'::jsonb);
end
$$;

revoke all on function public.list_today_staff_status() from public, anon;
grant execute on function public.list_today_staff_status() to authenticated;
