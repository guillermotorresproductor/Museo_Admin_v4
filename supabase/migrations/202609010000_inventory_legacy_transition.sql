-- Preserva la tabla legacy de Inventario antes de instalar inventory_items v1.
-- Es segura para reejecución: la estructura v1 es un no-op y una legacy ya movida deja public disponible.

do $$
declare
  v_item_count bigint;
  v_is_v1 boolean;
  v_is_known_legacy boolean;
begin
  if to_regclass('public.inventory_items') is null then
    return;
  end if;

  select
    count(*) filter (where column_name in (
      'serial_number', 'category', 'quantity', 'condition', 'responsible',
      'status', 'photo_path', 'version', 'archived_at', 'updated_by'
    )) = 10,
    count(*) filter (where column_name in ('condition_status', 'contact_or_donor')) = 2
      and count(*) filter (where column_name in ('version', 'archived_at', 'photo_path')) = 0
  into v_is_v1, v_is_known_legacy
  from information_schema.columns
  where table_schema = 'public' and table_name = 'inventory_items';

  if v_is_v1 then
    return;
  end if;

  if not v_is_known_legacy then
    raise exception 'Unknown public.inventory_items structure; legacy transition aborted.'
      using errcode = '55000';
  end if;

  execute 'select count(*) from public.inventory_items' into v_item_count;
  if v_item_count <> 0 then
    raise exception 'Legacy public.inventory_items contains % row(s); transition requires 0.', v_item_count
      using errcode = '55000';
  end if;

  create schema if not exists legacy;
  revoke all on schema legacy from public;
  revoke all on schema legacy from anon, authenticated;

  if to_regclass('legacy.inventory_items_pre_v1') is not null then
    raise exception 'legacy.inventory_items_pre_v1 already exists; transition aborted.'
      using errcode = '55000';
  end if;

  alter table public.inventory_items rename to inventory_items_pre_v1;
  alter table public.inventory_items_pre_v1 set schema legacy;

  revoke all on table legacy.inventory_items_pre_v1 from public;
  revoke all on table legacy.inventory_items_pre_v1 from anon, authenticated;
  comment on table legacy.inventory_items_pre_v1 is
    'Preserved on 2026-09-02 by inventory v1 transition; empty legacy structure retained with policies and history, access revoked.';
end;
$$;
