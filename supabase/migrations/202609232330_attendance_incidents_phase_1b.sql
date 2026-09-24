-- Phase 1B. Incidents explain a day. They do not rewrite attendance_events or finance_records.

create table if not exists public.attendance_incidents (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  shift_id uuid references public.employee_shifts(id) on delete restrict,
  incident_date date not null,
  incident_type text not null check (incident_type in (
    'vacation','illness','authorized_day_off','official_business','unpaid_absence','pending_unexplained_absence','other'
  )),
  status text not null default 'pending' check (status in ('pending','employee_explained','hr_documented','resolved')),
  employee_explanation text,
  hr_notes text,
  resolution text check (resolution is null or resolution in (
    'vacation','illness','authorized_day_off','official_business','unpaid_absence','other'
  )),
  resolution_comment text,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_incidents_one_per_day unique (museum_id, employee_id, incident_date),
  constraint attendance_incidents_resolved_fields check (
    status <> 'resolved' or (resolution is not null and resolved_by is not null and resolved_at is not null)
  )
);

create table if not exists public.attendance_incident_history (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.attendance_incidents(id) on delete restrict,
  museum_id uuid not null references public.museums(id) on delete restrict,
  action text not null,
  actor_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_institutional_days (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete restrict,
  observance_date date not null,
  name text not null check (length(trim(name)) >= 2),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint attendance_institutional_days_one unique (museum_id, observance_date)
);

alter table public.attendance_incidents enable row level security;
alter table public.attendance_incident_history enable row level security;
alter table public.attendance_institutional_days enable row level security;
revoke all on public.attendance_incidents, public.attendance_incident_history, public.attendance_institutional_days from public, anon, authenticated;

create or replace function public.prevent_attendance_incident_history_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'ATTENDANCE_INCIDENT_HISTORY_IMMUTABLE' using errcode = 'P0001';
end $$;

drop trigger if exists attendance_incident_history_immutable on public.attendance_incident_history;
create trigger attendance_incident_history_immutable
before update or delete on public.attendance_incident_history
for each row execute function public.prevent_attendance_incident_history_mutation();

create or replace function public.record_attendance_incident_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.attendance_incident_history(incident_id, museum_id, action, actor_id, detail)
  values (
    new.id, new.museum_id, tg_op, auth.uid(),
    jsonb_build_object(
      'incident_type', new.incident_type, 'status', new.status,
      'employee_explanation', new.employee_explanation, 'hr_notes', new.hr_notes,
      'resolution', new.resolution, 'resolution_comment', new.resolution_comment,
      'resolved_by', new.resolved_by, 'resolved_at', new.resolved_at
    )
  );
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists attendance_incidents_history on public.attendance_incidents;
create trigger attendance_incidents_history
before insert or update on public.attendance_incidents
for each row execute function public.record_attendance_incident_history();

insert into public.permissions(code, description, sensitivity) values
  ('attendance.board.read','Ver asistencia de hoy','sensitive'),
  ('attendance.incidents.resolve','Resolver incidencias de asistencia','critical'),
  ('attendance.incidents.document','Documentar incidencias de asistencia','sensitive'),
  ('attendance.incidents.read.self','Ver incidencias propias','sensitive'),
  ('attendance.incidents.explain','Explicar una incidencia propia','sensitive')
on conflict (code) do nothing;

create or replace function public.permission_module(permission text)
returns text language sql immutable set search_path = '' as $$
 select case
 when permission like 'modules.%.read' then split_part(permission,'.',2)
 when permission like 'collections.%' then 'collections'
 when permission like 'calendar.%' then 'calendar'
 when permission like 'usher.%' then 'ushers'
 when permission like 'maintenance.%' then 'maintenance'
 when permission like 'rentals.%' then 'rentals'
 when permission like 'memberships.%' then 'memberships'
 when permission like 'inventory.%' then 'inventory'
 when permission like 'documents.%' then 'documents'
 when permission like 'announcements.%' then 'announcements'
 when permission in ('profile.read.self','profile.update.self','employees.read.self','notifications.read.self',
   'schedules.read.self','time.clock','time.read.self','attendance.corrections.request',
   'attendance.incidents.read.self','attendance.incidents.explain') then 'personal'
 when permission in ('attendance.board.read','attendance.incidents.resolve','attendance.incidents.document','modules.attendance_board.read') then 'attendance_board'
 else 'administration' end
$$;

update public.employee_module_profiles
set modules = modules || array['attendance_board']
where code in ('director_ejecutivo','gerente_administrativo')
  and not ('attendance_board' = any(modules));

create or replace function public.has_permission(requested_permission text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare chosen text := public.current_employee_module_profile(); target_module text;
begin
 if requested_permission in ('attendance.incidents.read.self','attendance.incidents.explain')
    and exists(select 1 from public.employees e where e.profile_id = auth.uid() and e.status = 'activo') then
   return true;
 end if;
 if requested_permission in ('attendance.board.read','modules.attendance_board.read')
    and (chosen in ('director_ejecutivo','gerente_administrativo')
      or (chosen is null and exists(select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) = 'administrador'))) then
   return true;
 end if;
 if requested_permission = 'attendance.incidents.document'
    and (chosen in ('director_ejecutivo','gerente_administrativo')
      or (chosen is null and exists(select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) in ('administrador','recursos_humanos')))) then
   return true;
 end if;
 if requested_permission = 'attendance.incidents.resolve'
    and (chosen in ('director_ejecutivo','gerente_administrativo')
      or (chosen is null and exists(select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) = 'administrador'))) then
   return true;
 end if;
 if chosen is null then return public.module_profile_base_permission(requested_permission); end if;
 if not exists(select 1 from public.profiles where id = auth.uid() and status in ('active','activo')
   and museum_id = public.current_user_museum_id()) then return false; end if;
 if requested_permission = 'module_profiles.active' then return true; end if;
 if exists(select 1 from public.user_permissions u join public.permissions p on p.id = u.permission_id
   where u.user_id = auth.uid() and u.museum_id = public.current_user_museum_id() and p.code = requested_permission
   and u.effect = 'deny' and (u.valid_until is null or u.valid_until > now())) then return false; end if;
 target_module := public.permission_module(requested_permission);
 if not exists(select 1 from public.employee_module_profiles where code = chosen and target_module = any(modules)) then return false; end if;
 if chosen = 'gerente_museografica' and requested_permission = 'collections.write' then return true; end if;
 if chosen = 'gerente_administrativo' and requested_permission in
   ('employees.read.all','employees.create','employees.update.basic','employees.update.employment','employees.deactivate') then return true; end if;
 if requested_permission = 'modules.' || target_module || '.read'
   or requested_permission in ('collections.read','announcements.read') then return true; end if;
 return public.module_profile_base_permission(requested_permission);
end $$;

create or replace function public.ensure_pending_attendance_incidents(target_museum uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare inserted integer;
begin
  insert into public.attendance_incidents(museum_id, employee_id, shift_id, incident_date, incident_type, status, created_by)
  select s.museum_id, s.employee_id, s.id, (s.starts_at at time zone 'America/Puerto_Rico')::date,
    'pending_unexplained_absence', 'pending', null
  from public.employee_shifts s
  join public.employees e on e.id = s.employee_id and e.museum_id = s.museum_id
  where s.museum_id = target_museum
    and s.status = 'scheduled'
    and e.status = 'activo'
    and e.attendance_required
    and s.ends_at < now()
    and not exists (
      select 1 from public.attendance_events ev
      where ev.shift_id = s.id and ev.event_type = 'clock_in'
    )
    and not exists (
      select 1 from public.attendance_institutional_days h
      where h.museum_id = s.museum_id and h.observance_date = (s.starts_at at time zone 'America/Puerto_Rico')::date
    )
    and not exists (
      select 1 from public.attendance_incidents i
      where i.employee_id = s.employee_id and i.incident_date = (s.starts_at at time zone 'America/Puerto_Rico')::date
    );
  get diagnostics inserted = row_count;
  return inserted;
end $$;

create or replace function public.list_today_attendance()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare museum uuid := public.current_user_museum_id(); today date := (now() at time zone 'America/Puerto_Rico')::date;
begin
  if auth.uid() is null or not public.has_permission('attendance.board.read') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  perform public.ensure_pending_attendance_incidents(museum);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'employee_id', e.id,
      'name', e.first_name || ' ' || e.last_name,
      'position', e.position,
      'shift_id', s.id,
      'event_type', ev.event_type,
      'classification', ev.classification,
      'incident_id', i.id,
      'incident_type', i.incident_type,
      'incident_status', i.status,
      'holiday', h.name
    ) order by e.last_name, e.first_name)
    from public.employees e
    left join public.employee_shifts s on s.employee_id = e.id and s.museum_id = e.museum_id
      and (s.starts_at at time zone 'America/Puerto_Rico')::date = today and s.status = 'scheduled'
    left join lateral (
      select event_type, classification from public.attendance_events
      where shift_id = s.id order by occurred_at desc limit 1
    ) ev on true
    left join public.attendance_incidents i on i.employee_id = e.id and i.incident_date = today
    left join public.attendance_institutional_days h on h.museum_id = e.museum_id and h.observance_date = today
    where e.museum_id = museum and e.status = 'activo' and e.attendance_required
  ), '[]'::jsonb);
end $$;

create or replace function public.list_own_attendance_incidents()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare employee_row public.employees;
begin
  if auth.uid() is null or not public.has_permission('attendance.incidents.read.self') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into employee_row from public.employees where profile_id = auth.uid() and status = 'activo';
  if not found then return '[]'::jsonb; end if;
  perform public.ensure_pending_attendance_incidents(employee_row.museum_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', i.id, 'incident_date', i.incident_date, 'incident_type', i.incident_type,
      'status', i.status, 'employee_explanation', i.employee_explanation,
      'resolution', i.resolution, 'resolution_comment', i.resolution_comment
    ) order by i.incident_date desc)
    from public.attendance_incidents i
    where i.employee_id = employee_row.id
  ), '[]'::jsonb);
end $$;

create or replace function public.explain_own_attendance_incident(p_incident_id uuid, p_explanation text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare employee_row public.employees; row_id uuid;
begin
  if auth.uid() is null or not public.has_permission('attendance.incidents.explain') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_explanation,''))) < 5 then raise exception 'EXPLANATION_REQUIRED' using errcode = '22023'; end if;
  select * into employee_row from public.employees where profile_id = auth.uid() and status = 'activo';
  if not found then raise exception 'ACTIVE_EMPLOYEE_REQUIRED' using errcode = 'P0001'; end if;
  update public.attendance_incidents
  set employee_explanation = trim(p_explanation),
      status = case when status = 'resolved' then status else 'employee_explained' end
  where id = p_incident_id and employee_id = employee_row.id and status <> 'resolved'
  returning id into row_id;
  if row_id is null then raise exception 'INCIDENT_NOT_EXPLAINABLE' using errcode = 'P0001'; end if;
  return jsonb_build_object('ok', true, 'id', row_id);
end $$;

create or replace function public.document_attendance_incident(p_incident_id uuid, p_notes text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare row_id uuid; incident_employee uuid;
begin
  if auth.uid() is null or not public.has_permission('attendance.incidents.document') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select employee_id into incident_employee from public.attendance_incidents
  where id = p_incident_id and museum_id = public.current_user_museum_id();
  if incident_employee is null then raise exception 'INCIDENT_NOT_FOUND' using errcode = 'P0001'; end if;
  if exists(select 1 from public.employees e where e.id = incident_employee and e.profile_id = auth.uid()) then
    raise exception 'SELF_ACTION_FORBIDDEN' using errcode = '42501';
  end if;
  update public.attendance_incidents
  set hr_notes = trim(p_notes), status = case when status = 'resolved' then status else 'hr_documented' end
  where id = p_incident_id and status <> 'resolved'
  returning id into row_id;
  return jsonb_build_object('ok', true, 'id', row_id);
end $$;

create or replace function public.resolve_attendance_incident(p_incident_id uuid, p_resolution text, p_comment text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare row_id uuid; incident_employee uuid;
begin
  if auth.uid() is null or not public.has_permission('attendance.incidents.resolve') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_resolution not in ('vacation','illness','authorized_day_off','official_business','unpaid_absence','other') then
    raise exception 'INVALID_RESOLUTION' using errcode = '22023';
  end if;
  select employee_id into incident_employee from public.attendance_incidents
  where id = p_incident_id and museum_id = public.current_user_museum_id();
  if incident_employee is null then raise exception 'INCIDENT_NOT_FOUND' using errcode = 'P0001'; end if;
  if exists(select 1 from public.employees e where e.id = incident_employee and e.profile_id = auth.uid()) then
    raise exception 'SELF_ACTION_FORBIDDEN' using errcode = '42501';
  end if;
  update public.attendance_incidents
  set status = 'resolved', resolution = p_resolution, resolution_comment = trim(p_comment),
      resolved_by = auth.uid(), resolved_at = now(), incident_type = p_resolution
  where id = p_incident_id
  returning id into row_id;
  return jsonb_build_object('ok', true, 'id', row_id);
end $$;

create or replace function public.save_institutional_day(p_date date, p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare museum uuid := public.current_user_museum_id();
begin
  if auth.uid() is null or not public.has_permission('attendance.board.read') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.attendance_institutional_days(museum_id, observance_date, name, created_by)
  values (museum, p_date, trim(p_name), auth.uid())
  on conflict (museum_id, observance_date) do update set name = excluded.name;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.ensure_pending_attendance_incidents(uuid) from public, anon, authenticated;
revoke all on function public.list_today_attendance() from public, anon;
revoke all on function public.list_own_attendance_incidents() from public, anon;
revoke all on function public.explain_own_attendance_incident(uuid, text) from public, anon;
revoke all on function public.document_attendance_incident(uuid, text) from public, anon;
revoke all on function public.resolve_attendance_incident(uuid, text, text) from public, anon;
revoke all on function public.save_institutional_day(date, text) from public, anon;
grant execute on function public.list_today_attendance() to authenticated;
grant execute on function public.list_own_attendance_incidents() to authenticated;
grant execute on function public.explain_own_attendance_incident(uuid, text) to authenticated;
grant execute on function public.document_attendance_incident(uuid, text) to authenticated;
grant execute on function public.resolve_attendance_incident(uuid, text, text) to authenticated;
grant execute on function public.save_institutional_day(date, text) to authenticated;
