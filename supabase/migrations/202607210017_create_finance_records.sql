-- Create public.finance_records for Museo Finanzas module.
-- No seed data. No audit_logs changes. No permission/role grants.

create table if not exists public.finance_records (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete restrict,
  record_type text not null
    check (record_type in ('income', 'expense')),
  category text not null check (length(trim(category)) > 0),
  concept text not null check (length(trim(concept)) > 0),
  month text not null
    check (month in (
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'
    )),
  year integer not null check (year between 2000 and 2100),
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists finance_records_natural_key_idx
  on public.finance_records (
    museum_id, record_type, category, concept, month, year
  );
create index if not exists finance_records_museum_year_idx
  on public.finance_records (museum_id, year, created_at);
alter table public.finance_records enable row level security;
create policy finance_records_select_same_museum
  on public.finance_records
  for select
  to authenticated
  using (
    museum_id = public.current_user_museum_id()
    and public.has_permission('finance.read')
  );
create policy finance_records_insert_same_museum
  on public.finance_records
  for insert
  to authenticated
  with check (
    museum_id = public.current_user_museum_id()
    and public.has_permission('finance.write')
  );
create policy finance_records_update_same_museum
  on public.finance_records
  for update
  to authenticated
  using (
    museum_id = public.current_user_museum_id()
    and public.has_permission('finance.write')
  )
  with check (
    museum_id = public.current_user_museum_id()
    and public.has_permission('finance.write')
  );
-- No DELETE policy → denied by RLS default.

grant select, insert, update on public.finance_records to authenticated;
-- Explicitly no DELETE grant.;
