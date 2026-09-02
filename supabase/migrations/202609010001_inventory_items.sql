-- Inventario administrativo relacional: equipos físicos, auditoría, RLS y fotos privadas.
-- Diseñado para aplicarse primero y únicamente en Museo Staging.

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete restrict,
  asset_tag text not null,
  serial_number text,
  name text not null,
  description text not null default '',
  category text not null,
  brand text,
  model text,
  quantity integer not null default 1 check (quantity = 1),
  purchase_order text,
  supplier text,
  received_date date,
  cost numeric(12,2) check (cost is null or cost >= 0),
  condition text not null check (condition in ('excelente','buena','regular','necesita_reparacion','fuera_de_servicio')),
  location text not null,
  responsible text,
  status text not null default 'activo' check (status in ('activo','en_reparacion','prestado','retirado')),
  warranty text,
  photo_path text,
  photo_updated_at timestamptz,
  version bigint not null default 1 check (version > 0),
  archived_at timestamptz,
  archived_by uuid references public.profiles(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (asset_tag = btrim(asset_tag) and asset_tag <> ''),
  check (serial_number is null or (serial_number = btrim(serial_number) and serial_number <> '')),
  check ((archived_at is null and archived_by is null) or (archived_at is not null and archived_by is not null)),
  check (photo_path is null or photo_path = museum_id::text || '/' || id::text || '/main.webp')
);

create unique index inventory_items_museum_asset_tag_unique
  on public.inventory_items (museum_id, lower(asset_tag));
create unique index inventory_items_museum_serial_unique
  on public.inventory_items (museum_id, lower(serial_number))
  where serial_number is not null;
create index inventory_items_museum_active_idx
  on public.inventory_items (museum_id, archived_at, updated_at desc);

create or replace function public.inventory_audit_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op = 'DELETE' then
    raise exception 'Inventory items cannot be deleted; archive the item instead.' using errcode = '23514';
  end if;

  v_old := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_new := to_jsonb(new);

  if tg_op = 'INSERT' then
    insert into public.audit_logs(museum_id, actor_user_id, action, table_name, record_id, old_value, new_value)
    values (new.museum_id, auth.uid(), 'INVENTORY_CREATED', 'inventory_items', new.id, null, v_new);
    return new;
  end if;

  insert into public.audit_logs(museum_id, actor_user_id, action, table_name, record_id, old_value, new_value)
  values (new.museum_id, auth.uid(), 'INVENTORY_EDITED', 'inventory_items', new.id, v_old, v_new);

  if old.location is distinct from new.location then
    insert into public.audit_logs(museum_id, actor_user_id, action, table_name, record_id, old_value, new_value)
    values (new.museum_id, auth.uid(), 'INVENTORY_LOCATION_CHANGED', 'inventory_items', new.id,
      jsonb_build_object('location', old.location), jsonb_build_object('location', new.location));
  end if;
  if old.responsible is distinct from new.responsible then
    insert into public.audit_logs(museum_id, actor_user_id, action, table_name, record_id, old_value, new_value)
    values (new.museum_id, auth.uid(), 'INVENTORY_RESPONSIBLE_CHANGED', 'inventory_items', new.id,
      jsonb_build_object('responsible', old.responsible), jsonb_build_object('responsible', new.responsible));
  end if;
  if old.condition is distinct from new.condition then
    insert into public.audit_logs(museum_id, actor_user_id, action, table_name, record_id, old_value, new_value)
    values (new.museum_id, auth.uid(), 'INVENTORY_CONDITION_CHANGED', 'inventory_items', new.id,
      jsonb_build_object('condition', old.condition), jsonb_build_object('condition', new.condition));
  end if;
  if old.archived_at is null and new.archived_at is not null then
    insert into public.audit_logs(museum_id, actor_user_id, action, table_name, record_id, old_value, new_value)
    values (new.museum_id, auth.uid(), 'INVENTORY_ARCHIVED', 'inventory_items', new.id,
      jsonb_build_object('archived_at', null), jsonb_build_object('archived_at', new.archived_at));
  end if;
  return new;
end;
$$;

create trigger inventory_items_no_delete_and_audit
before delete on public.inventory_items
for each row execute function public.inventory_audit_changes();

create trigger inventory_items_audit
after insert or update on public.inventory_items
for each row execute function public.inventory_audit_changes();

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
    museum_id, asset_tag, serial_number, name, description, category, brand, model,
    quantity, purchase_order, supplier, received_date, cost, condition, location,
    responsible, status, warranty, created_by, updated_by
  ) values (
    v_museum_id,
    btrim(p_item->>'asset_tag'), nullif(btrim(p_item->>'serial_number'), ''),
    btrim(p_item->>'name'), coalesce(btrim(p_item->>'description'), ''), btrim(p_item->>'category'),
    nullif(btrim(p_item->>'brand'), ''), nullif(btrim(p_item->>'model'), ''), 1,
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
    asset_tag = btrim(p_item->>'asset_tag'),
    serial_number = nullif(btrim(p_item->>'serial_number'), ''),
    name = btrim(p_item->>'name'), description = coalesce(btrim(p_item->>'description'), ''),
    category = btrim(p_item->>'category'), brand = nullif(btrim(p_item->>'brand'), ''),
    model = nullif(btrim(p_item->>'model'), ''), quantity = 1,
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

create or replace function public.inventory_archive(p_id uuid, p_expected_version bigint)
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
  update public.inventory_items set archived_at = now(), archived_by = auth.uid(),
    updated_by = auth.uid(), updated_at = now(), version = version + 1
  where id = p_id and museum_id = v_museum_id and archived_at is null and version = p_expected_version
  returning * into v_item;
  if v_item.id is null then
    raise exception 'Inventory item changed by another user or is unavailable.' using errcode = '40001';
  end if;
  return v_item;
end;
$$;

create or replace function public.inventory_set_photo(p_id uuid, p_expected_version bigint)
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
  update public.inventory_items set photo_path = museum_id::text || '/' || id::text || '/main.webp',
    photo_updated_at = now(), updated_by = auth.uid(), updated_at = now(), version = version + 1
  where id = p_id and museum_id = v_museum_id and archived_at is null and version = p_expected_version
  returning * into v_item;
  if v_item.id is null then
    raise exception 'Inventory item changed by another user or is unavailable.' using errcode = '40001';
  end if;
  return v_item;
end;
$$;

alter table public.inventory_items enable row level security;
create policy inventory_items_same_museum_read on public.inventory_items
  for select to authenticated
  using (museum_id = public.current_user_museum_id());

revoke all on public.inventory_items from anon, authenticated;
grant select on public.inventory_items to authenticated;
revoke all on function public.inventory_create(jsonb) from public;
revoke all on function public.inventory_update(uuid,bigint,jsonb) from public;
revoke all on function public.inventory_archive(uuid,bigint) from public;
revoke all on function public.inventory_set_photo(uuid,bigint) from public;
grant execute on function public.inventory_create(jsonb) to authenticated;
grant execute on function public.inventory_update(uuid,bigint,jsonb) to authenticated;
grant execute on function public.inventory_archive(uuid,bigint) to authenticated;
grant execute on function public.inventory_set_photo(uuid,bigint) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inventory-photos', 'inventory-photos', false, 10485760, array['image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['image/webp'];

create policy inventory_photos_same_museum_read on storage.objects
  for select to authenticated
  using (bucket_id = 'inventory-photos' and (storage.foldername(name))[1] = public.current_user_museum_id()::text);
create policy inventory_photos_manage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'inventory-photos'
    and public.has_permission('inventory.manage')
    and (storage.foldername(name))[1] = public.current_user_museum_id()::text
    and storage.filename(name) = 'main.webp'
    and exists (
      select 1 from public.inventory_items i
      where i.museum_id = public.current_user_museum_id()
        and i.id::text = (storage.foldername(name))[2]
        and i.archived_at is null
    )
  );
create policy inventory_photos_manage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'inventory-photos' and public.has_permission('inventory.manage') and (storage.foldername(name))[1] = public.current_user_museum_id()::text)
  with check (bucket_id = 'inventory-photos' and public.has_permission('inventory.manage') and (storage.foldername(name))[1] = public.current_user_museum_id()::text and storage.filename(name) = 'main.webp');
create policy inventory_photos_manage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'inventory-photos' and public.has_permission('inventory.manage') and (storage.foldername(name))[1] = public.current_user_museum_id()::text);

grant select, insert, update, delete on storage.objects to authenticated;
