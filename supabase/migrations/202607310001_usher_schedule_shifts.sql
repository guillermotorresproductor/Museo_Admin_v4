-- Usher schedule normalized shifts + hardened RLS + non-bypassable audit
-- Idempotent. DO NOT auto-apply from the app; apply manually in staging/production.
-- Verified schema assumptions (202607210001):
--   profiles.id = auth.uid()
--   employees.auth_user_id uuid null, unique when present
--   employees.status in ('activo','inactivo','terminado')
--   audit_logs(museum_id, actor_user_id, action, table_name, record_id, old_value, new_value, created_at)

begin;

insert into public.permissions(code, description, sensitivity) values
  ('usher.schedule.read.own', 'Leer turnos propios del calendario de ujieres', 'sensitive'),
  ('usher.schedule.read.all', 'Leer todos los turnos del calendario de ujieres del museo', 'sensitive'),
  ('usher.schedule.manage', 'Crear, editar y eliminar turnos del calendario de ujieres', 'sensitive')
on conflict (code) do nothing;

-- Admin/Ejecutivo receive catalog permissions. Do NOT grant read.own to every empleado.
-- Effective own-access still requires an active linked Ujier/Ujier ejecutivo employee row.
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on (
  (r.code = 'administrador' and p.code in ('usher.schedule.read.own', 'usher.schedule.read.all', 'usher.schedule.manage'))
  or (r.code = 'ejecutivo' and p.code in ('usher.schedule.read.own', 'usher.schedule.read.all', 'usher.schedule.manage'))
)
on conflict do nothing;

-- Remove indiscriminate empleado → read.own grant if a previous revision added it.
delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.code = 'empleado'
  and p.code = 'usher.schedule.read.own';

create table if not exists public.usher_shifts (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id),
  employee_id uuid not null references public.employees(id),
  shift_date date not null,
  starts_at time not null,
  ends_at time not null,
  area text not null,
  legacy_horario text null,
  source text not null default 'app' check (source in ('app', 'legacy_import')),
  created_by uuid null references public.profiles(id),
  updated_by uuid null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint usher_shifts_time_order check (ends_at > starts_at),
  constraint usher_shifts_area_nonempty check (length(trim(both from area)) > 0)
);

-- Same-museum employee integrity (employees.id is PK, so (id, museum_id) is unique).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'employees_id_museum_key'
  ) then
    alter table public.employees
      add constraint employees_id_museum_key unique (id, museum_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'usher_shifts_employee_museum_fk'
  ) then
    alter table public.usher_shifts
      add constraint usher_shifts_employee_museum_fk
      foreign key (employee_id, museum_id)
      references public.employees (id, museum_id);
  end if;
end $$;

create unique index if not exists usher_shifts_exact_duplicate_uidx
  on public.usher_shifts (museum_id, employee_id, shift_date, starts_at, ends_at);

create index if not exists usher_shifts_museum_date_idx
  on public.usher_shifts (museum_id, shift_date, starts_at);

create index if not exists usher_shifts_employee_date_idx
  on public.usher_shifts (museum_id, employee_id, shift_date);

create table if not exists public.usher_shift_audit (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id),
  shift_id uuid null,
  actor_user_id uuid null references public.profiles(id),
  action text not null check (action in ('create', 'edit', 'delete')),
  old_value jsonb null,
  new_value jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists usher_shift_audit_museum_created_idx
  on public.usher_shift_audit (museum_id, created_at desc);

create or replace function public.normalize_usher_label(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(trim(both from regexp_replace(coalesce(raw, ''), '\s+', ' ', 'g')));
$$;

create or replace function public.employee_status_is_inactive(raw text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public.normalize_usher_label(raw) in ('inactivo', 'inactive', 'terminado', 'terminated', 'suspended');
$$;

create or replace function public.employee_status_is_active(raw text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public.normalize_usher_label(coalesce(nullif(trim(both from coalesce(raw, '')), ''), 'activo'))
    in ('activo', 'active');
$$;

create or replace function public.normalize_usher_position(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select public.normalize_usher_label(raw);
$$;

create or replace function public.is_usher_position(raw text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public.normalize_usher_position(raw) in ('ujier', 'ujier ejecutivo');
$$;

create or replace function public.is_usher_executive_position(raw text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public.normalize_usher_position(raw) = 'ujier ejecutivo';
$$;

-- Internal: returns only the linked active usher employee id (never the full employees row).
create or replace function public.current_linked_usher_employee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.employees e
  where e.museum_id = public.current_user_museum_id()
    and e.auth_user_id = auth.uid()
    and public.employee_status_is_active(e.status)
    and public.is_usher_position(e.position)
  order by e.created_at asc
  limit 1;
$$;

create or replace function public.current_linked_inactive_usher_employee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.employees e
  where e.museum_id = public.current_user_museum_id()
    and e.auth_user_id = auth.uid()
    and public.is_usher_position(e.position)
    and public.employee_status_is_inactive(e.status)
  order by e.created_at asc
  limit 1;
$$;

create or replace function public.can_manage_usher_schedule()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and public.current_user_museum_id() is not null
    and (
      public.has_permission('usher.schedule.manage')
      or exists (
        select 1
        from public.employees e
        where e.id = public.current_linked_usher_employee_id()
          and public.is_usher_executive_position(e.position)
      )
    );
$$;

create or replace function public.can_read_all_usher_schedule()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_permission('usher.schedule.read.all')
    or public.can_manage_usher_schedule();
$$;

create or replace function public.can_read_own_usher_schedule()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Own access requires an active linked Ujier/Ujier ejecutivo in the same museum.
  select public.current_linked_usher_employee_id() is not null;
$$;

create or replace function public.write_usher_shift_audit(
  p_museum_id uuid,
  p_shift_id uuid,
  p_action text,
  p_old jsonb,
  p_new jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;
  if p_museum_id is null or p_museum_id <> public.current_user_museum_id() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_action not in ('create', 'edit', 'delete') then
    raise exception 'INVALID_AUDIT_ACTION' using errcode = '22000';
  end if;

  insert into public.usher_shift_audit(museum_id, shift_id, actor_user_id, action, old_value, new_value)
  values (p_museum_id, p_shift_id, auth.uid(), p_action, p_old, p_new);

  insert into public.audit_logs(museum_id, actor_user_id, action, table_name, record_id, old_value, new_value)
  values (p_museum_id, auth.uid(), upper(p_action), 'usher_shifts', p_shift_id, p_old, p_new);
end;
$$;

create or replace function public.usher_schedule_access_state()
returns table (
  museum_id uuid,
  can_read_own boolean,
  can_read_all boolean,
  can_manage boolean,
  linked_employee_id uuid,
  linked_employee_name text,
  unlinked boolean,
  inactive_blocked boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  mid uuid := public.current_user_museum_id();
  linked_id uuid;
  inactive_id uuid;
  linked_name text := null;
begin
  if mid is null or auth.uid() is null then
    return;
  end if;

  linked_id := public.current_linked_usher_employee_id();
  inactive_id := public.current_linked_inactive_usher_employee_id();

  if linked_id is not null then
    select trim(both from concat(coalesce(e.first_name, ''), ' ', coalesce(e.last_name, '')))
      into linked_name
    from public.employees e
    where e.id = linked_id
      and e.museum_id = mid;
  end if;

  museum_id := mid;
  can_manage := public.can_manage_usher_schedule();
  can_read_all := public.can_read_all_usher_schedule();
  can_read_own := public.can_read_own_usher_schedule();
  linked_employee_id := linked_id;
  linked_employee_name := linked_name;
  inactive_blocked := linked_id is null and inactive_id is not null and not can_read_all and not can_manage;
  unlinked := linked_id is null and inactive_id is null and not can_read_all and not can_manage;
  return next;
end;
$$;

create or replace function public.list_usher_shifts(p_from date, p_to date)
returns table (
  id uuid,
  museum_id uuid,
  employee_id uuid,
  employee_name text,
  shift_date date,
  starts_at time,
  ends_at time,
  area text,
  legacy_horario text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  access_row record;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;
  if p_from is null or p_to is null then
    raise exception 'INVALID_DATE_RANGE' using errcode = '22000';
  end if;
  if p_from > p_to then
    raise exception 'INVALID_DATE_RANGE' using errcode = '22000';
  end if;
  if (p_to - p_from) > 366 then
    raise exception 'DATE_RANGE_TOO_LARGE' using errcode = '22000';
  end if;

  select * into access_row from public.usher_schedule_access_state();
  if access_row.museum_id is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;
  if access_row.inactive_blocked then
    raise exception 'INACTIVE_EMPLOYEE' using errcode = '42501';
  end if;
  if access_row.unlinked then
    raise exception 'UNLINKED_EMPLOYEE' using errcode = '42501';
  end if;
  if not access_row.can_read_all and not access_row.can_read_own then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select
    s.id,
    s.museum_id,
    s.employee_id,
    trim(both from concat(coalesce(e.first_name, ''), ' ', coalesce(e.last_name, ''))) as employee_name,
    s.shift_date,
    s.starts_at,
    s.ends_at,
    s.area,
    s.legacy_horario
  from public.usher_shifts s
  join public.employees e
    on e.id = s.employee_id
   and e.museum_id = s.museum_id
  where s.museum_id = access_row.museum_id
    and s.shift_date between p_from and p_to
    and (
      access_row.can_read_all
      or s.employee_id = access_row.linked_employee_id
    )
  order by s.shift_date asc, s.starts_at asc, s.id asc;
end;
$$;

create or replace function public.upsert_usher_shift(
  p_id uuid,
  p_employee_id uuid,
  p_shift_date date,
  p_starts_at time,
  p_ends_at time,
  p_area text
)
returns public.usher_shifts
language plpgsql
security definer
set search_path = ''
as $$
declare
  access_row record;
  target public.employees;
  existing public.usher_shifts;
  saved public.usher_shifts;
  old_json jsonb;
  clean_area text := trim(both from coalesce(p_area, ''));
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  select * into access_row from public.usher_schedule_access_state();
  if access_row.museum_id is null or not access_row.can_manage then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if access_row.inactive_blocked then
    raise exception 'INACTIVE_EMPLOYEE' using errcode = '42501';
  end if;
  if p_employee_id is null or p_shift_date is null or p_starts_at is null or p_ends_at is null then
    raise exception 'MISSING_REQUIRED_FIELDS' using errcode = '22000';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'INVALID_TIME_RANGE' using errcode = '22000';
  end if;
  if clean_area = '' then
    raise exception 'INVALID_AREA' using errcode = '22000';
  end if;

  select * into target
  from public.employees e
  where e.id = p_employee_id
    and e.museum_id = access_row.museum_id
    and public.employee_status_is_active(e.status)
    and public.is_usher_position(e.position);
  if target.id is null then
    raise exception 'INVALID_USHER' using errcode = '22000';
  end if;

  if p_id is not null then
    select * into existing
    from public.usher_shifts s
    where s.id = p_id and s.museum_id = access_row.museum_id;
    if existing.id is null then
      raise exception 'NOT_FOUND' using errcode = 'P0002';
    end if;
    old_json := to_jsonb(existing);
    update public.usher_shifts
    set employee_id = p_employee_id,
        shift_date = p_shift_date,
        starts_at = p_starts_at,
        ends_at = p_ends_at,
        area = clean_area,
        updated_by = auth.uid(),
        updated_at = now()
    where id = existing.id
      and museum_id = access_row.museum_id
    returning * into saved;
    perform public.write_usher_shift_audit(access_row.museum_id, saved.id, 'edit', old_json, to_jsonb(saved));
  else
    insert into public.usher_shifts(
      museum_id, employee_id, shift_date, starts_at, ends_at, area, created_by, updated_by
    ) values (
      access_row.museum_id, p_employee_id, p_shift_date, p_starts_at, p_ends_at, clean_area, auth.uid(), auth.uid()
    )
    returning * into saved;
    perform public.write_usher_shift_audit(access_row.museum_id, saved.id, 'create', null, to_jsonb(saved));
  end if;

  return saved;
end;
$$;

create or replace function public.delete_usher_shift(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  access_row record;
  existing public.usher_shifts;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  select * into access_row from public.usher_schedule_access_state();
  if access_row.museum_id is null or not access_row.can_manage then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if access_row.inactive_blocked then
    raise exception 'INACTIVE_EMPLOYEE' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'MISSING_REQUIRED_FIELDS' using errcode = '22000';
  end if;

  select * into existing
  from public.usher_shifts s
  where s.id = p_id and s.museum_id = access_row.museum_id;
  if existing.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  delete from public.usher_shifts
  where id = existing.id
    and museum_id = access_row.museum_id;
  perform public.write_usher_shift_audit(access_row.museum_id, existing.id, 'delete', to_jsonb(existing), null);
  return true;
end;
$$;

create or replace function public.parse_usher_legacy_time_token(raw text)
returns time
language plpgsql
immutable
set search_path = ''
as $$
declare
  text_value text := lower(trim(both from coalesce(raw, '')));
  hour_part integer;
  minute_part integer;
  period text;
  match text[];
begin
  text_value := regexp_replace(text_value, '\.', '', 'g');
  text_value := regexp_replace(text_value, '\s+', ' ', 'g');
  match := regexp_match(text_value, '^(\d{1,2}):(\d{2})\s*(a\s*m|p\s*m|am|pm)$');
  if match is not null then
    hour_part := match[1]::integer;
    minute_part := match[2]::integer;
    period := replace(match[3], ' ', '');
    if hour_part < 1 or hour_part > 12 or minute_part > 59 then
      return null;
    end if;
    if period like 'p%' and hour_part < 12 then
      hour_part := hour_part + 12;
    elsif period like 'a%' and hour_part = 12 then
      hour_part := 0;
    end if;
    return make_time(hour_part, minute_part, 0);
  end if;
  match := regexp_match(text_value, '^(\d{1,2}):(\d{2})$');
  if match is not null then
    hour_part := match[1]::integer;
    minute_part := match[2]::integer;
    if hour_part > 23 or minute_part > 59 then
      return null;
    end if;
    return make_time(hour_part, minute_part, 0);
  end if;
  return null;
end;
$$;

-- Administrative importer: not granted to authenticated. Requires system.configure.
create or replace function public.import_legacy_usher_shifts()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  mid uuid := public.current_user_museum_id();
  doc jsonb;
  item jsonb;
  inserted integer := 0;
  skipped integer := 0;
  ambiguous integer := 0;
  errors integer := 0;
  match_count integer;
  emp_id uuid;
  emp_name text;
  entrada time;
  salida time;
  shift_day date;
  area_text text;
  raw_horario text;
  parts text[];
begin
  if mid is null or auth.uid() is null or not public.has_permission('system.configure') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select payload into doc
  from public.app_records
  where museum_id = mid
    and module = 'calendario_ujieres'
    and record_key = 'records'
  limit 1;

  if doc is null or jsonb_typeof(doc) <> 'array' then
    return jsonb_build_object(
      'inserted', 0, 'skipped', 0, 'ambiguous', 0, 'errors', 0, 'source', 'calendario_ujieres'
    );
  end if;

  for item in select * from jsonb_array_elements(doc)
  loop
    begin
      emp_name := lower(trim(both from coalesce(item->>'ujier', '')));
      if emp_name = '' then
        skipped := skipped + 1;
        continue;
      end if;

      select count(*) into match_count
      from public.employees e
      where e.museum_id = mid
        and public.is_usher_position(e.position)
        and lower(trim(both from concat(coalesce(e.first_name, ''), ' ', coalesce(e.last_name, '')))) = emp_name;

      if match_count = 0 then
        skipped := skipped + 1;
        continue;
      end if;
      if match_count > 1 then
        ambiguous := ambiguous + 1;
        continue;
      end if;

      select e.id into emp_id
      from public.employees e
      where e.museum_id = mid
        and public.is_usher_position(e.position)
        and lower(trim(both from concat(coalesce(e.first_name, ''), ' ', coalesce(e.last_name, '')))) = emp_name
      limit 1;

      entrada := public.parse_usher_legacy_time_token(item->>'horaEntrada');
      salida := public.parse_usher_legacy_time_token(item->>'horaSalida');
      raw_horario := trim(both from coalesce(item->>'horario', ''));
      if (entrada is null or salida is null) and raw_horario <> '' then
        parts := regexp_split_to_array(raw_horario, '\s*[-–—]\s*');
        if array_length(parts, 1) >= 2 then
          entrada := coalesce(entrada, public.parse_usher_legacy_time_token(parts[1]));
          salida := coalesce(salida, public.parse_usher_legacy_time_token(parts[2]));
        end if;
      end if;

      begin
        shift_day := (item->>'fecha')::date;
      exception when others then
        errors := errors + 1;
        continue;
      end;

      if shift_day is null or entrada is null or salida is null or salida <= entrada then
        errors := errors + 1;
        continue;
      end if;

      area_text := nullif(trim(both from coalesce(item->>'area', '')), '');
      if area_text is null then
        area_text := 'Sin área';
      end if;

      insert into public.usher_shifts(
        museum_id, employee_id, shift_date, starts_at, ends_at, area, legacy_horario, source, created_by, updated_by
      )
      select
        mid, emp_id, shift_day, entrada, salida, area_text, nullif(raw_horario, ''), 'legacy_import', auth.uid(), auth.uid()
      where not exists (
        select 1 from public.usher_shifts s
        where s.museum_id = mid
          and s.employee_id = emp_id
          and s.shift_date = shift_day
          and s.starts_at = entrada
          and s.ends_at = salida
      );
      if found then
        inserted := inserted + 1;
      else
        skipped := skipped + 1;
      end if;
    exception when others then
      errors := errors + 1;
    end;
  end loop;

  return jsonb_build_object(
    'inserted', inserted,
    'skipped', skipped,
    'ambiguous', ambiguous,
    'errors', errors,
    'source', 'calendario_ujieres',
    'note', 'Historical app_records JSON was not modified.'
  );
end;
$$;

alter table public.usher_shifts enable row level security;
alter table public.usher_shift_audit enable row level security;

drop policy if exists usher_shifts_select on public.usher_shifts;
create policy usher_shifts_select on public.usher_shifts
for select to authenticated
using (
  museum_id = public.current_user_museum_id()
  and (
    public.can_read_all_usher_schedule()
    or employee_id = public.current_linked_usher_employee_id()
  )
);

-- No direct mutations for authenticated: RPC SECURITY DEFINER is the only write path.
drop policy if exists usher_shifts_insert on public.usher_shifts;
drop policy if exists usher_shifts_update on public.usher_shifts;
drop policy if exists usher_shifts_delete on public.usher_shifts;

drop policy if exists usher_shift_audit_select on public.usher_shift_audit;
create policy usher_shift_audit_select on public.usher_shift_audit
for select to authenticated
using (
  museum_id = public.current_user_museum_id()
  and public.has_permission('audit.read')
);

-- Drop legacy full-row helper if a previous revision created it.
drop function if exists public.current_linked_usher_employee();

revoke all on table public.usher_shifts from public, anon, authenticated;
revoke all on table public.usher_shift_audit from public, anon, authenticated;
grant select on table public.usher_shifts to authenticated;
grant select on table public.usher_shift_audit to authenticated;

-- Harden function privileges: revoke PUBLIC defaults, expose only client RPCs.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'normalize_usher_label',
        'employee_status_is_inactive',
        'employee_status_is_active',
        'normalize_usher_position',
        'is_usher_position',
        'is_usher_executive_position',
        'current_linked_usher_employee_id',
        'current_linked_inactive_usher_employee_id',
        'can_manage_usher_schedule',
        'can_read_all_usher_schedule',
        'can_read_own_usher_schedule',
        'write_usher_shift_audit',
        'parse_usher_legacy_time_token',
        'import_legacy_usher_shifts',
        'usher_schedule_access_state',
        'list_usher_shifts',
        'upsert_usher_shift',
        'delete_usher_shift'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn.sig);
  end loop;
end $$;

grant execute on function public.usher_schedule_access_state() to authenticated;
grant execute on function public.list_usher_shifts(date, date) to authenticated;
grant execute on function public.upsert_usher_shift(uuid, uuid, date, time, time, text) to authenticated;
grant execute on function public.delete_usher_shift(uuid) to authenticated;

commit;
