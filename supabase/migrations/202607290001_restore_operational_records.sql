-- Restore operational app_records + ensure finance_records RLS stays permission-gated.
-- Idempotent. DO NOT invent new permission codes; map modules to existing permissions.
-- Fail-closed: unknown modules cannot be read or modified.

begin;

create table if not exists public.app_records (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete restrict,
  module text not null,
  record_key text not null,
  payload jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (museum_id, module, record_key)
);

create index if not exists app_records_museum_module_idx
  on public.app_records(museum_id, module);

-- Module → permission inventory (existing codes only):
-- module                | record_key(s)              | pages                         | read                                      | write                                     | delete
-- renta_espacios        | spaces_v2, spaces, requests| renta-espacios.html, ...      | rentals.manage                            | rentals.manage                            | system.configure
-- calendario_general    | records                    | calendario.html, rental-page  | calendar.manage OR schedules.read.team    | calendar.manage                           | system.configure
-- calendario_obras      | records                    | calendario-obras.html         | calendar.manage                           | calendar.manage                           | system.configure
-- inventario            | records                    | inventario.html               | inventory.manage                          | inventory.manage                          | system.configure
-- notificaciones        | preferences                | notificaciones.html           | notifications.manage                      | notifications.manage                      | system.configure
-- solicitud_materiales  | requests                   | solicitud-materiales.html     | system.configure OR (audit.read+notifications.manage) | same | system.configure
-- recibos_prestamo      | receipts                   | recibo-prestamo.html          | system.configure OR (audit.read+notifications.manage) | same | system.configure
-- calendario_ujieres    | records                    | legacy JSON (import only)     | system.configure                          | system.configure                          | system.configure
-- unknown               | *                          | *                             | DENY                                      | DENY                                      | DENY

create or replace function public.app_records_has_module_access(p_module text, p_mode text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  mode text := lower(trim(both from coalesce(p_mode, '')));
  module_name text := trim(both from coalesce(p_module, ''));
begin
  if auth.uid() is null then
    return false;
  end if;
  if public.current_user_museum_id() is null then
    return false;
  end if;
  if mode not in ('read', 'write', 'delete') then
    return false;
  end if;
  if module_name = '' then
    return false;
  end if;

  -- Hard-coded module map. Callers cannot pass an arbitrary permission code.
  if module_name = 'renta_espacios' then
    if mode = 'delete' then
      return public.has_permission('system.configure');
    end if;
    return public.has_permission('rentals.manage');
  end if;

  if module_name = 'calendario_general' then
    if mode = 'delete' then
      return public.has_permission('system.configure');
    end if;
    if mode = 'read' then
      return public.has_permission('calendar.manage')
        or public.has_permission('schedules.read.team');
    end if;
    return public.has_permission('calendar.manage');
  end if;

  if module_name = 'calendario_obras' then
    if mode = 'delete' then
      return public.has_permission('system.configure');
    end if;
    return public.has_permission('calendar.manage');
  end if;

  if module_name = 'inventario' then
    if mode = 'delete' then
      return public.has_permission('system.configure');
    end if;
    return public.has_permission('inventory.manage');
  end if;

  if module_name = 'notificaciones' then
    if mode = 'delete' then
      return public.has_permission('system.configure');
    end if;
    return public.has_permission('notifications.manage');
  end if;

  if module_name in ('solicitud_materiales', 'recibos_prestamo') then
    if mode = 'delete' then
      return public.has_permission('system.configure');
    end if;
    return public.has_permission('system.configure')
      or (
        public.has_permission('audit.read')
        and public.has_permission('notifications.manage')
      );
  end if;

  if module_name = 'calendario_ujieres' then
    -- Legacy JSON document: only system operators may touch it via app_records.
    return public.has_permission('system.configure');
  end if;

  -- Fail-closed for unknown modules.
  return false;
end;
$$;

alter table public.app_records enable row level security;

drop policy if exists app_records_same_museum_select on public.app_records;
drop policy if exists app_records_same_museum_insert on public.app_records;
drop policy if exists app_records_same_museum_update on public.app_records;
drop policy if exists app_records_same_museum_delete on public.app_records;
drop policy if exists app_records_module_select on public.app_records;
drop policy if exists app_records_module_insert on public.app_records;
drop policy if exists app_records_module_update on public.app_records;
drop policy if exists app_records_module_delete on public.app_records;
drop policy if exists "authenticated users can read app records" on public.app_records;
drop policy if exists "authenticated users can insert app records" on public.app_records;
drop policy if exists "authenticated users can update app records" on public.app_records;
drop policy if exists "authenticated users can delete app records" on public.app_records;

create policy app_records_module_select
  on public.app_records for select to authenticated
  using (
    museum_id = public.current_user_museum_id()
    and public.app_records_has_module_access(module, 'read')
  );

create policy app_records_module_insert
  on public.app_records for insert to authenticated
  with check (
    museum_id = public.current_user_museum_id()
    and created_by = auth.uid()
    and updated_by = auth.uid()
    and public.app_records_has_module_access(module, 'write')
  );

create policy app_records_module_update
  on public.app_records for update to authenticated
  using (
    museum_id = public.current_user_museum_id()
    and public.app_records_has_module_access(module, 'write')
  )
  with check (
    museum_id = public.current_user_museum_id()
    and updated_by = auth.uid()
    and public.app_records_has_module_access(module, 'write')
  );

create policy app_records_module_delete
  on public.app_records for delete to authenticated
  using (
    museum_id = public.current_user_museum_id()
    and public.app_records_has_module_access(module, 'delete')
  );

revoke all on table public.app_records from public, anon;
revoke all on table public.app_records from authenticated;
grant select, insert, update on public.app_records to authenticated;
revoke delete on public.app_records from authenticated;

revoke all on function public.app_records_has_module_access(text, text) from public, anon;
grant execute on function public.app_records_has_module_access(text, text) to authenticated;

-- finance_records: keep separate from app_records. Align with hardened finance grants.
create table if not exists public.finance_records (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete restrict,
  record_type text not null check (record_type in ('income', 'expense')),
  category text not null,
  concept text not null,
  month text not null check (
    month in (
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'
    )
  ),
  year integer not null check (year between 2000 and 2200),
  amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (museum_id, record_type, category, concept, month, year)
);

create index if not exists finance_records_museum_year_idx
  on public.finance_records(museum_id, year);

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions on permissions.code in ('finance.read', 'finance.write')
where roles.code in ('administrador', 'finanzas')
on conflict do nothing;

alter table public.finance_records enable row level security;

drop policy if exists finance_records_authorized_select on public.finance_records;
drop policy if exists finance_records_authorized_insert on public.finance_records;
drop policy if exists finance_records_authorized_update on public.finance_records;
drop policy if exists finance_records_authorized_delete on public.finance_records;
drop policy if exists finance_records_select_same_museum on public.finance_records;
drop policy if exists finance_records_insert_same_museum on public.finance_records;
drop policy if exists finance_records_update_same_museum on public.finance_records;
drop policy if exists "finance read only authorized museum users" on public.finance_records;
drop policy if exists "finance insert only authorized museum users" on public.finance_records;
drop policy if exists "finance update only authorized museum users" on public.finance_records;
drop policy if exists "finance delete only authorized museum users" on public.finance_records;

create policy finance_records_authorized_select
  on public.finance_records for select to authenticated
  using (
    museum_id = public.current_user_museum_id()
    and public.has_permission('finance.read')
  );

create policy finance_records_authorized_insert
  on public.finance_records for insert to authenticated
  with check (
    museum_id = public.current_user_museum_id()
    and public.has_permission('finance.write')
  );

create policy finance_records_authorized_update
  on public.finance_records for update to authenticated
  using (
    museum_id = public.current_user_museum_id()
    and public.has_permission('finance.write')
  )
  with check (
    museum_id = public.current_user_museum_id()
    and public.has_permission('finance.write')
  );

create policy finance_records_authorized_delete
  on public.finance_records for delete to authenticated
  using (
    museum_id = public.current_user_museum_id()
    and public.has_permission('finance.write')
  );

-- Preserve hardened grants from later finance migrations: no direct UPDATE/DELETE for clients.
revoke all on table public.finance_records from public, anon;
revoke all on table public.finance_records from authenticated;
grant select, insert on public.finance_records to authenticated;

commit;
