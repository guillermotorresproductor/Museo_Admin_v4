-- Restore the operational tables consumed by the legacy Museo web modules.
-- Idempotent so staging and production can converge without replacing data.

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

alter table public.app_records enable row level security;

drop policy if exists app_records_same_museum_select on public.app_records;
drop policy if exists app_records_same_museum_insert on public.app_records;
drop policy if exists app_records_same_museum_update on public.app_records;
drop policy if exists app_records_same_museum_delete on public.app_records;
drop policy if exists "authenticated users can read app records" on public.app_records;
drop policy if exists "authenticated users can insert app records" on public.app_records;
drop policy if exists "authenticated users can update app records" on public.app_records;
drop policy if exists "authenticated users can delete app records" on public.app_records;

create policy app_records_same_museum_select
  on public.app_records for select to authenticated
  using (museum_id = public.current_user_museum_id());

create policy app_records_same_museum_insert
  on public.app_records for insert to authenticated
  with check (
    museum_id = public.current_user_museum_id()
    and created_by = auth.uid()
    and updated_by = auth.uid()
  );

create policy app_records_same_museum_update
  on public.app_records for update to authenticated
  using (museum_id = public.current_user_museum_id())
  with check (
    museum_id = public.current_user_museum_id()
    and updated_by = auth.uid()
  );

create policy app_records_same_museum_delete
  on public.app_records for delete to authenticated
  using (
    museum_id = public.current_user_museum_id()
    and public.has_permission('system.configure')
  );

grant select, insert, update on public.app_records to authenticated;
revoke delete on public.app_records from authenticated;

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

grant select, insert, update, delete on public.finance_records to authenticated;
