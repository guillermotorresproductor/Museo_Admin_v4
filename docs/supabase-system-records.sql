create table if not exists public.app_records (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null,
  module text not null,
  record_key text not null,
  payload jsonb not null default '[]'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (museum_id, module, record_key)
);

alter table public.app_records enable row level security;

drop policy if exists "authenticated users can read app records" on public.app_records;
drop policy if exists "authenticated users can insert app records" on public.app_records;
drop policy if exists "authenticated users can update app records" on public.app_records;
drop policy if exists "authenticated users can delete app records" on public.app_records;

create policy "authenticated users can read app records"
on public.app_records
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.museum_id = app_records.museum_id
  )
);

create policy "authenticated users can insert app records"
on public.app_records
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.museum_id = app_records.museum_id
  )
);

create policy "authenticated users can update app records"
on public.app_records
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.museum_id = app_records.museum_id
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.museum_id = app_records.museum_id
  )
);

create policy "authenticated users can delete app records"
on public.app_records
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.museum_id = app_records.museum_id
  )
);
