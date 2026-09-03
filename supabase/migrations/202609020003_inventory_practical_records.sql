-- Inventario práctico: un registro representa una pieza individual o un lote.
-- Conserva los RPC públicos, RLS, auditoría, aislamiento y versión optimista de v1.

alter table public.inventory_items
  add column record_type text not null default 'individual';

alter table public.inventory_items
  drop constraint inventory_items_quantity_check,
  add constraint inventory_items_record_type_check
    check (record_type in ('individual', 'lot')),
  add constraint inventory_items_quantity_check
    check (quantity >= 1),
  add constraint inventory_items_individual_quantity_check
    check (record_type <> 'individual' or quantity = 1);

create or replace function public.inventory_create(p_item jsonb)
returns public.inventory_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_museum_id uuid := public.current_user_museum_id();
  v_item public.inventory_items;
begin
  if v_museum_id is null or not public.has_permission('inventory.manage') then
    raise exception 'Not authorized to manage inventory.' using errcode = '42501';
  end if;

  insert into public.inventory_items (
    museum_id, record_type, asset_tag, serial_number, name, description, category,
    brand, model, quantity, purchase_order, supplier, received_date, cost,
    condition, location, responsible, status, warranty, created_by, updated_by
  ) values (
    v_museum_id, coalesce(nullif(p_item->>'record_type', ''), 'individual'),
    btrim(p_item->>'asset_tag'), nullif(btrim(p_item->>'serial_number'), ''),
    btrim(p_item->>'name'), coalesce(btrim(p_item->>'description'), ''), btrim(p_item->>'category'),
    nullif(btrim(p_item->>'brand'), ''), nullif(btrim(p_item->>'model'), ''),
    coalesce(nullif(p_item->>'quantity', '')::integer, 1),
    nullif(btrim(p_item->>'purchase_order'), ''), nullif(btrim(p_item->>'supplier'), ''),
    nullif(p_item->>'received_date', '')::date, nullif(p_item->>'cost', '')::numeric,
    p_item->>'condition', btrim(p_item->>'location'), nullif(btrim(p_item->>'responsible'), ''),
    p_item->>'status', nullif(btrim(p_item->>'warranty'), ''), auth.uid(), auth.uid()
  ) returning * into v_item;
  return v_item;
end;
$$;

create or replace function public.inventory_update(p_id uuid, p_expected_version bigint, p_item jsonb)
returns public.inventory_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_museum_id uuid := public.current_user_museum_id();
  v_item public.inventory_items;
begin
  if v_museum_id is null or not public.has_permission('inventory.manage') then
    raise exception 'Not authorized to manage inventory.' using errcode = '42501';
  end if;

  update public.inventory_items set
    record_type = coalesce(nullif(p_item->>'record_type', ''), 'individual'),
    asset_tag = btrim(p_item->>'asset_tag'),
    serial_number = nullif(btrim(p_item->>'serial_number'), ''),
    name = btrim(p_item->>'name'), description = coalesce(btrim(p_item->>'description'), ''),
    category = btrim(p_item->>'category'), brand = nullif(btrim(p_item->>'brand'), ''),
    model = nullif(btrim(p_item->>'model'), ''),
    quantity = coalesce(nullif(p_item->>'quantity', '')::integer, 1),
    purchase_order = nullif(btrim(p_item->>'purchase_order'), ''),
    supplier = nullif(btrim(p_item->>'supplier'), ''),
    received_date = nullif(p_item->>'received_date', '')::date,
    cost = nullif(p_item->>'cost', '')::numeric,
    condition = p_item->>'condition', location = btrim(p_item->>'location'),
    responsible = nullif(btrim(p_item->>'responsible'), ''), status = p_item->>'status',
    warranty = nullif(btrim(p_item->>'warranty'), ''), updated_by = auth.uid(),
    updated_at = now(), version = version + 1
  where id = p_id and museum_id = v_museum_id and archived_at is null and version = p_expected_version
  returning * into v_item;

  if v_item.id is null then
    raise exception 'Inventory item changed by another user or is unavailable.' using errcode = '40001';
  end if;
  return v_item;
end;
$$;

revoke all on function public.inventory_create(jsonb) from public, anon;
revoke all on function public.inventory_update(uuid,bigint,jsonb) from public, anon;
grant execute on function public.inventory_create(jsonb) to authenticated;
grant execute on function public.inventory_update(uuid,bigint,jsonb) to authenticated;

comment on column public.inventory_items.record_type is
  'individual = una pieza identificable; lot = varias piezas homogéneas en un solo registro.';
comment on column public.inventory_items.quantity is
  'Cantidad física de piezas del registro; individual exige 1 y lot permite enteros >= 1.';
