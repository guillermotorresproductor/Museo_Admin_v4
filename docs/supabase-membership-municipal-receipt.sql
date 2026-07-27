-- Recibo oficial del Municipio de Guaynabo para Membresías.
-- Ejecutar una sola vez después de supabase-memberships.sql.

alter table public.museum_members
  add column if not exists municipal_receipt_number text;

create unique index if not exists museum_members_municipal_receipt_unique_idx
  on public.museum_members (museum_id, municipal_receipt_number)
  where municipal_receipt_number is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'museum_members_paid_activation_receipt_check'
      and conrelid = 'public.museum_members'::regclass
  ) then
    alter table public.museum_members
      add constraint museum_members_paid_activation_receipt_check
      check (
        status <> 'Activo'
        or plan_code = 'cortesia-anual'
        or nullif(btrim(municipal_receipt_number), '') is not null
      ) not valid;
  end if;
end
$$;

comment on column public.museum_members.municipal_receipt_number is
  'Número de recibo oficial emitido por el Municipio de Guaynabo antes de aprobar una membresía con aportación.';
