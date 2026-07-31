-- Usher schedule normalized shifts + RLS + audit
-- Idempotent. DO NOT auto-apply from the app; apply manually in staging/production.
-- Replaces insecure whole-document app_records filtering for calendario_ujieres.

begin;

insert into public.permissions(code, description, sensitivity) values
  ('usher.schedule.read.own', 'Leer turnos propios del calendario de ujieres', 'sensitive'),
  ('usher.schedule.read.all', 'Leer todos los turnos del calendario de ujieres del museo', 'sensitive'),
  ('usher.schedule.manage', 'Crear, editar y eliminar turnos del calendario de ujieres', 'sensitive')
on conflict (code) do nothing;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on (
  (r.code = 'administrador' and p.code in ('usher.schedule.read.own', 'usher.schedule.read.all', 'usher.schedule.manage'))
  or (r.code = 'ejecutivo' and p.code in ('usher.schedule.read.own', 'usher.schedule.read.all', 'usher.schedule.manage'))
  or (r.code = 'empleado' and p.code in ('usher.schedule.read.own'))
)
on conflict do nothing;

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
  constraint usher_shifts_time_order check (ends_at > starts_at)
);

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

create or replace function public.normalize_usher_position(raw text)
returns text
language sql
immutable
as $$
  select lower(trim(both from regexp_replace(coalesce(raw, ''), '\s+', ' ', 'g')));
$$;

create or replace function public.is_usher_position(raw text)
returns boolean
language sql
immutable
as $$
  select public.normalize_usher_position(raw) in ('ujier', 'ujier ejecutivo');
$$;

create or replace function public.is_usher_executive_position(raw text)
returns boolean
language sql
immutable
as $$
  select public.normalize_usher_position(raw) = 'ujier ejecutivo';
$$;

create or replace function public.current_linked_usher_employee()
returns public.employees
language sql
stable
security definer
set search_path = ''
as $$
  select e.*
  from public.employees e
  where e.museum_id = public.current_user_museum_id()
    and e.auth_user_id = auth.uid()
    and coalesce(e.status, 'activo') <> 'inactivo'
    and public.is_usher_position(e.position)
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
  select public.has_permission('usher.schedule.manage')
    or exists (
      select 1
      from public.current_linked_usher_employee() e
      where public.is_usher_executive_position(e.position)
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
  select public.has_permission('usher.schedule.read.own')
    or exists (select 1 from public.current_linked_usher_employee());
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
  linked public.employees;
  inactive_link public.employees;
begin
  if mid is null or auth.uid() is null then
    return;
  end if;

  select e.* into linked from public.current_linked_usher_employee() e;

  if linked.id is null then
    select e.* into inactive_link
    from public.employees e
    where e.museum_id = mid
      and e.auth_user_id = auth.uid()
      and public.is_usher_position(e.position)
      and coalesce(e.status, 'activo') = 'inactivo'
    limit 1;
  end if;

  museum_id := mid;
  can_manage := public.can_manage_usher_schedule();
  can_read_all := public.can_read_all_usher_schedule();
  can_read_own := public.can_read_own_usher_schedule();
  linked_employee_id := linked.id;
  linked_employee_name := trim(both from concat(coalesce(linked.first_name, ''), ' ', coalesce(linked.last_name, '')));
  unlinked := linked.id is null and inactive_link.id is null and not can_read_all and not can_manage;
  inactive_blocked := linked.id is null and inactive_link.id is not null and not can_read_all and not can_manage;
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
  join public.employees e on e.id = s.employee_id
  where s.museum_id = access_row.museum_id
    and s.shift_date between p_from and p_to
    and (
      access_row.can_read_all
      or s.employee_id = access_row.linked_employee_id
    )
  order by s.shift_date asc, s.starts_at asc, s.id asc;
end;
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
  insert into public.usher_shift_audit(museum_id, shift_id, actor_user_id, action, old_value, new_value)
  values (p_museum_id, p_shift_id, auth.uid(), p_action, p_old, p_new);

  insert into public.audit_logs(museum_id, actor_user_id, action, table_name, record_id, old_value, new_value)
  values (p_museum_id, auth.uid(), upper(p_action), 'usher_shifts', p_shift_id, p_old, p_new);
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
begin
  select * into access_row from public.usher_schedule_access_state();
  if access_row.museum_id is null or not access_row.can_manage then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'INVALID_TIME_RANGE' using errcode = '22000';
  end if;

  select * into target
  from public.employees e
  where e.id = p_employee_id
    and e.museum_id = access_row.museum_id
    and coalesce(e.status, 'activo') <> 'inactivo'
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
        area = trim(both from p_area),
        updated_by = auth.uid(),
        updated_at = now()
    where id = existing.id
    returning * into saved;
    perform public.write_usher_shift_audit(access_row.museum_id, saved.id, 'edit', old_json, to_jsonb(saved));
  else
    insert into public.usher_shifts(
      museum_id, employee_id, shift_date, starts_at, ends_at, area, created_by, updated_by
    ) values (
      access_row.museum_id, p_employee_id, p_shift_date, p_starts_at, p_ends_at, trim(both from p_area), auth.uid(), auth.uid()
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
  select * into access_row from public.usher_schedule_access_state();
  if access_row.museum_id is null or not access_row.can_manage then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into existing
  from public.usher_shifts s
  where s.id = p_id and s.museum_id = access_row.museum_id;
  if existing.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  delete from public.usher_shifts where id = existing.id;
  perform public.write_usher_shift_audit(access_row.museum_id, existing.id, 'delete', to_jsonb(existing), null);
  return true;
end;
$$;

create or replace function public.import_legacy_usher_shifts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  mid uuid := public.current_user_museum_id();
  doc jsonb;
  item jsonb;
  inserted integer := 0;
  emp public.employees;
  entrada text;
  salida text;
begin
  if mid is null or not public.has_permission('system.configure') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select payload into doc
  from public.app_records
  where museum_id = mid
    and module = 'calendario_ujieres'
    and record_key = 'records'
  limit 1;

  if doc is null or jsonb_typeof(doc) <> 'array' then
    return 0;
  end if;

  for item in select * from jsonb_array_elements(doc)
  loop
    select e.* into emp
    from public.employees e
    where e.museum_id = mid
      and public.is_usher_position(e.position)
      and lower(trim(both from concat(coalesce(e.first_name, ''), ' ', coalesce(e.last_name, ''))))
        = lower(trim(both from coalesce(item->>'ujier', '')))
    order by e.created_at asc
    limit 1;

    if emp.id is null then
      continue;
    end if;

    entrada := coalesce(nullif(trim(both from item->>'horaEntrada'), ''), null);
    salida := coalesce(nullif(trim(both from item->>'horaSalida'), ''), null);
    if entrada is null or salida is null then
      continue;
    end if;

    insert into public.usher_shifts(
      museum_id, employee_id, shift_date, starts_at, ends_at, area, legacy_horario, source, created_by, updated_by
    )
    select
      mid,
      emp.id,
      (item->>'fecha')::date,
      entrada::time,
      salida::time,
      coalesce(nullif(trim(both from item->>'area'), ''), 'Sin área'),
      item->>'horario',
      'legacy_import',
      auth.uid(),
      auth.uid()
    where not exists (
      select 1 from public.usher_shifts s
      where s.museum_id = mid
        and s.employee_id = emp.id
        and s.shift_date = (item->>'fecha')::date
        and s.starts_at = entrada::time
        and s.ends_at = salida::time
    );
    if found then
      inserted := inserted + 1;
    end if;
  end loop;

  return inserted;
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
    or employee_id = (select id from public.current_linked_usher_employee())
  )
);

drop policy if exists usher_shifts_insert on public.usher_shifts;
create policy usher_shifts_insert on public.usher_shifts
for insert to authenticated
with check (
  museum_id = public.current_user_museum_id()
  and public.can_manage_usher_schedule()
);

drop policy if exists usher_shifts_update on public.usher_shifts;
create policy usher_shifts_update on public.usher_shifts
for update to authenticated
using (
  museum_id = public.current_user_museum_id()
  and public.can_manage_usher_schedule()
)
with check (
  museum_id = public.current_user_museum_id()
  and public.can_manage_usher_schedule()
);

drop policy if exists usher_shifts_delete on public.usher_shifts;
create policy usher_shifts_delete on public.usher_shifts
for delete to authenticated
using (
  museum_id = public.current_user_museum_id()
  and public.can_manage_usher_schedule()
);

drop policy if exists usher_shift_audit_select on public.usher_shift_audit;
create policy usher_shift_audit_select on public.usher_shift_audit
for select to authenticated
using (
  museum_id = public.current_user_museum_id()
  and public.has_permission('audit.read')
);

revoke all on table public.usher_shifts from anon, public;
revoke all on table public.usher_shift_audit from anon, public;
grant select, insert, update, delete on table public.usher_shifts to authenticated;
grant select on table public.usher_shift_audit to authenticated;

grant execute on function public.normalize_usher_position(text) to authenticated;
grant execute on function public.is_usher_position(text) to authenticated;
grant execute on function public.is_usher_executive_position(text) to authenticated;
grant execute on function public.current_linked_usher_employee() to authenticated;
grant execute on function public.can_manage_usher_schedule() to authenticated;
grant execute on function public.can_read_all_usher_schedule() to authenticated;
grant execute on function public.can_read_own_usher_schedule() to authenticated;
grant execute on function public.usher_schedule_access_state() to authenticated;
grant execute on function public.list_usher_shifts(date, date) to authenticated;
grant execute on function public.upsert_usher_shift(uuid, uuid, date, time, time, text) to authenticated;
grant execute on function public.delete_usher_shift(uuid) to authenticated;
grant execute on function public.import_legacy_usher_shifts() to authenticated;
grant execute on function public.write_usher_shift_audit(uuid, uuid, text, jsonb, jsonb) to authenticated;

commit;
