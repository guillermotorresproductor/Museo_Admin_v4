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
values ('inventory.create', 'Registrar equipos nuevos en Inventario', 'sensitive')
on conflict (code) do nothing;

-- Preserve existing has_permission resolver and Ana's individual exception.
-- Marketing's new create permission is granted only after active-user,
-- per-user explicit denial, and module-boundary checks have succeeded.
do $marketing_inventory_permission$
declare
  source_sql text;
  updated_sql text;
  anchor_sql constant text := 'if requested_permission=''modules.''||target_module||''.read''';
begin
  source_sql := pg_get_functiondef('public.has_permission(text)'::regprocedure);
  if position('marketing_equipment_create_v1' in source_sql) > 0 then
    return;
  end if;
  if position(anchor_sql in source_sql) = 0 then
    raise exception 'INVENTORY_MARKETING_PERMISSION_RESOLVER_CHANGED' using errcode = '55000';
  end if;
  updated_sql := replace(
    source_sql,
    anchor_sql,
    '-- marketing_equipment_create_v1: runs after explicit denies and the module boundary.'
      || E'\n if chosen=''contenido_marketing'' and requested_permission=''inventory.create'' then return true; end if;'
      || E'\n ' || anchor_sql
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

-- Allow an initial photo for a NEW item created by the same Marketing user.
-- Updates/deletes of existing photos and other users' equipment stay restricted.
create or replace function public.can_create_inventory_photo(object_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select
    auth.uid() is not null
    and public.has_permission('inventory.create')
    and (storage.foldername(object_name))[1] = public.current_user_museum_id()::text
    and storage.filename(object_name) = 'main.webp'
    and exists (
      select 1 from public.inventory_items i
      where i.museum_id = public.current_user_museum_id()
        and i.id::text = (storage.foldername(object_name))[2]
        and i.created_by = auth.uid()
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
-- creator to clean up ONLY the not-yet-attached original image for their own
-- active item in their current museum. Delete of attached photos remains
-- limited to the existing inventory.manage permission.
alter policy inventory_photos_manage_delete on storage.objects
using (
  bucket_id = 'inventory-photos'
  and (
    (
      public.has_permission('inventory.manage')
      and (storage.foldername(name))[1] = public.current_user_museum_id()::text
    )
    or public.can_create_inventory_photo(name)
  )
);

-- After initial upload, update only the calling user's never-photographed item.
-- Administrators with inventory.manage retain their existing rights.
do $marketing_inventory_photo_rpc$
declare
  source_sql text;
  updated_sql text;
  old_guard constant text := 'not public.has_permission(''inventory.manage'')';
  new_guard constant text :=
    'not (public.has_permission(''inventory.manage'') or '
    || '(public.has_permission(''inventory.create'') and exists ('
    || 'select 1 from public.inventory_items i '
    || 'where i.id = p_id and i.museum_id = v_museum_id '
    || 'and i.created_by = auth.uid() and i.photo_path is null and i.archived_at is null)))';
begin
  source_sql := pg_get_functiondef('public.inventory_set_photo(uuid,bigint)'::regprocedure);
  if position('inventory.create' in source_sql) = 0 then
    if position(old_guard in source_sql) = 0 then
      raise exception 'INVENTORY_PHOTO_RPC_GUARD_CHANGED' using errcode = '55000';
    end if;
    updated_sql := replace(source_sql, old_guard, new_guard);
    execute updated_sql;
  end if;
end
$marketing_inventory_photo_rpc$;

notify pgrst, 'reload schema';
commit;
