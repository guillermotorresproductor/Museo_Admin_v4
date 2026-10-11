-- All museums: Content & Marketing can view and REGISTER equipment inventory.
-- No rights to edit/archive existing inventory and NO museographic collections access.
-- Employee titles, compensation, payroll, attendance, roles and other profiles remain intact.
-- The pre-existing 202609240004 individual inventory.manage grant for Ana is unchanged.
begin;

update public.employee_module_profiles
set modules = array_append(modules, 'inventory')
where code = 'contenido_marketing' and not ('inventory' = any(modules));

do $marketing_inventory_catalog$
begin
  if not exists (select 1 from public.employee_module_profiles
                 where code = 'contenido_marketing' and 'inventory' = any(modules)) then
    raise exception 'MARKETING_MODULE_PROFILE_MISSING' using errcode = '55000';
  end if;
end
$marketing_inventory_catalog$;

insert into public.permissions (code, description, sensitivity)
values ('inventory.create', 'Registrar equipos nuevos en Inventario', 'sensitive'),
       ('inventory.photo.attach', 'Adjuntar primera fotografía de equipos en Inventario', 'sensitive')
on conflict (code) do nothing;

-- Preserve existing has_permission resolver and Ana's individual exception.
-- Marketing's new create permission is granted only after active-user,
-- per-user explicit denial, and module-boundary checks have succeeded.
do $marketing_inventory_permission$
declare
  source_sql text;
  updated_sql text;
  anchor_sql text;
  pre_boundary_anchor text;
begin
  source_sql := pg_get_functiondef('public.has_permission(text)'::regprocedure);
  if position('marketing_equipment_create_v1' in source_sql) > 0 then
    return;
  end if;
  -- Support only the two exact resolver formats validated in Staging
  -- (compact) and Production (spaced); fail closed on any other definition.
  anchor_sql := case
    when position('if requested_permission=''modules.''||target_module||''.read''' in source_sql) > 0
      then 'if requested_permission=''modules.''||target_module||''.read'''
    when position('if requested_permission = ''modules.'' || target_module || ''.read''' in source_sql) > 0
      then 'if requested_permission = ''modules.'' || target_module || ''.read'''
    else null
  end;
  pre_boundary_anchor := case
    when position('target_module:=public.permission_module(requested_permission);' in source_sql) > 0
      then 'target_module:=public.permission_module(requested_permission);'
    when position('target_module := public.permission_module(requested_permission);' in source_sql) > 0
      then 'target_module := public.permission_module(requested_permission);'
    else null
  end;
  if anchor_sql is null or pre_boundary_anchor is null then
    raise exception 'INVENTORY_MARKETING_PERMISSION_RESOLVER_CHANGED' using errcode = '55000';
  end if;
  updated_sql := replace(
    source_sql,
    anchor_sql,
    '-- marketing_equipment_create_v1: runs after explicit denies and the module boundary.'
      || E'\n -- A higher technical role must not grant edit/archive. An earlier explicit allow still returns first.'
      || E'\n if chosen=''contenido_marketing'' and requested_permission=''inventory.manage'' then return false; end if;'
      || E'\n if chosen=''contenido_marketing'' and requested_permission=''inventory.create'' then return true; end if;'
      || E'\n ' || anchor_sql
  );
  -- A linked user with individual Inventory read access is also eligible;
  -- the preceding user-level deny and active-account checks still apply.
  updated_sql := replace(
    updated_sql,
    pre_boundary_anchor,
    'if requested_permission=''inventory.photo.attach'' and public.has_permission(''modules.inventory.read'') then return true; end if;'
      || E'\n ' || pre_boundary_anchor
  );
  if updated_sql = source_sql then
    raise exception 'INVENTORY_MARKETING_PERMISSION_PATCH_FAILED' using errcode = '55000';
  end if;
  execute updated_sql;
end
$marketing_inventory_permission$;

-- inventory_create remains the same audited, museum-isolated RPC, but now
-- accepts the narrow inventory.create capability in addition to manage.
do $marketing_inventory_rpc$
declare
  source_sql text;
  updated_sql text;
  old_guard constant text := 'not public.has_permission(''inventory.manage'')';
  new_guard constant text := 'not (public.has_permission(''inventory.manage'') or public.has_permission(''inventory.create''))';
begin
  source_sql := pg_get_functiondef('public.inventory_create(jsonb)'::regprocedure);
  if position('inventory.create' in source_sql) = 0 then
    if position(old_guard in source_sql) = 0 then
      raise exception 'INVENTORY_CREATE_GUARD_CHANGED' using errcode = '55000';
    end if;
    updated_sql := replace(source_sql, old_guard, new_guard);
    execute updated_sql;
  end if;
end
$marketing_inventory_rpc$;

-- Canonical object only: {museum}/{equipment}/main.webp. No extra folders.
create or replace function public.can_manage_inventory_photo(object_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select
    auth.uid() is not null
    and public.current_user_museum_id() is not null
    and public.has_permission('inventory.manage')
    and cardinality(storage.foldername(object_name)) = 2
    and (storage.foldername(object_name))[1] = public.current_user_museum_id()::text
    and storage.filename(object_name) = 'main.webp'
    and exists (
      select 1 from public.inventory_items i
      where i.museum_id = public.current_user_museum_id()
        and i.id::text = (storage.foldername(object_name))[2]
        and i.archived_at is null
    );
$$;

-- Any user with inventory module read access may attach a MISSING equipment photo,
-- including on records created by colleagues in the same museum.
-- Replacing attached photos requires inventory.manage as before.
create or replace function public.can_create_inventory_photo(object_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select
    auth.uid() is not null
    and public.has_permission('inventory.photo.attach')
    and cardinality(storage.foldername(object_name)) = 2
    and (storage.foldername(object_name))[1] = public.current_user_museum_id()::text
    and storage.filename(object_name) = 'main.webp'
    and exists (
      select 1 from public.inventory_items i
      where i.museum_id = public.current_user_museum_id()
        and i.id::text = (storage.foldername(object_name))[2]
        and i.photo_path is null
        and i.archived_at is null
    );
$$;
revoke all on function public.can_create_inventory_photo(text) from public, anon;
grant execute on function public.can_create_inventory_photo(text) to authenticated;

do $marketing_inventory_photo_policy$
begin
  if (select count(*) from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname in ('inventory_photos_manage_insert', 'inventory_photos_manage_delete')) <> 2 then
    raise exception 'INVENTORY_PHOTO_POLICIES_MISSING' using errcode = '55000';
  end if;
end
$marketing_inventory_photo_policy$;
alter policy inventory_photos_manage_insert on storage.objects
with check (
  bucket_id = 'inventory-photos'
  and (
    public.can_manage_inventory_photo(name)
    or public.can_create_inventory_photo(name)
  )
);

-- A failed photo-attachment RPC must not leave an orphaned file. Permit the
-- uploader to clean up ONLY a not-yet-attached image they uploaded themselves,
-- on an active item in the same museum. Attached photos still require manage.
alter policy inventory_photos_manage_delete on storage.objects
using (
  bucket_id = 'inventory-photos'
  and (
    public.can_manage_inventory_photo(name)
    or (public.can_create_inventory_photo(name) and owner_id = auth.uid()::text)
  )
);

-- After initial upload, attach a missing photo uploaded by the current user.
-- No viewer can replace a file or associate a file created by another user.
-- Administrators with inventory.manage retain their existing rights.
do $marketing_inventory_photo_rpc$
declare
  source_sql text;
  updated_sql text;
  old_guard constant text := 'not public.has_permission(''inventory.manage'')';
  new_guard constant text :=
    'not (public.has_permission(''inventory.manage'') or '
    || '(public.has_permission(''inventory.photo.attach'') and exists ('
    || 'select 1 from public.inventory_items i '
    || 'join storage.objects s on s.bucket_id = ''inventory-photos'' '
    || 'and s.name = i.museum_id::text || ''/'' || i.id::text || ''/main.webp'' '
    || 'and s.owner_id = auth.uid()::text '
    || 'where i.id = p_id and i.museum_id = v_museum_id '
    || 'and i.photo_path is null and i.archived_at is null)))';
begin
  source_sql := pg_get_functiondef('public.inventory_set_photo(uuid,bigint)'::regprocedure);
  if position('inventory.photo.attach' in source_sql) = 0 then
    if position(old_guard in source_sql) = 0 then
      raise exception 'INVENTORY_PHOTO_RPC_GUARD_CHANGED' using errcode = '55000';
    end if;
    updated_sql := replace(source_sql, old_guard, new_guard);
    if position('inventory.photo.attach' in updated_sql) = 0
       or position(old_guard in updated_sql) > 0 then
      raise exception 'INVENTORY_PHOTO_RPC_PATCH_FAILED' using errcode = '55000';
    end if;
    execute updated_sql;
  end if;
end
$marketing_inventory_photo_rpc$;

notify pgrst, 'reload schema';
commit;
