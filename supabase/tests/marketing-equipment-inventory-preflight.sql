-- READ ONLY. Safe before and after the approved migration in Staging or Production.
-- Produces one audit record; no sensitive employee data and no DML/DDL.
-- Expected BEFORE deployment: ready_for_migration=true, deployed=false.
-- Expected AFTER deployment: ready_for_migration=true, deployed=true.
WITH profile AS (
  SELECT modules FROM public.employee_module_profiles
  WHERE code='contenido_marketing'
), inventory_policies AS (
  SELECT count(*) AS n
  FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects'
    AND policyname IN (
      'inventory_photos_manage_insert',
      'inventory_photos_manage_update',
      'inventory_photos_manage_delete',
      'module_profile_storage_read'
    )
), functions AS (
  SELECT
    pg_get_functiondef('public.has_permission(text)'::regprocedure) AS permission_def,
    pg_get_functiondef('public.inventory_create(jsonb)'::regprocedure) AS create_def,
    pg_get_functiondef('public.inventory_set_photo(uuid,bigint)'::regprocedure) AS photo_def
)
SELECT jsonb_build_object(
  'marketing_profile_exists', EXISTS(SELECT 1 FROM profile),
  'marketing_has_inventory', coalesce((SELECT 'inventory'=ANY(modules) FROM profile),false),
  'inventory_create_catalogued', EXISTS(SELECT 1 FROM public.permissions WHERE code='inventory.create'),
  'inventory_photo_attach_catalogued', EXISTS(SELECT 1 FROM public.permissions WHERE code='inventory.photo.attach'),
  'expected_storage_policies', (SELECT n=4 FROM inventory_policies),
  'photo_owner_column', EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='storage' AND table_name='objects' AND column_name='owner_id'
  ),
  'resolver_module_anchor', (SELECT
    position('target_module:=public.permission_module(requested_permission);' IN permission_def)>0
    OR position('target_module := public.permission_module(requested_permission);' IN permission_def)>0
    FROM functions),
  'resolver_profile_anchor', (SELECT
    position('if requested_permission=''modules.''||target_module||''.read''' IN permission_def)>0
    OR position('if requested_permission = ''modules.'' || target_module || ''.read''' IN permission_def)>0
    FROM functions),
  'create_guard_supported', (SELECT
    position('not public.has_permission(''inventory.manage'')' IN create_def)>0
    OR position('inventory.create' IN create_def)>0 FROM functions),
  'photo_guard_supported', (SELECT
    position('not public.has_permission(''inventory.manage'')' IN photo_def)>0
    OR position('inventory.photo.attach' IN photo_def)>0 FROM functions),
  'create_rpc', to_regprocedure('public.inventory_create(jsonb)') IS NOT NULL,
  'photo_rpc', to_regprocedure('public.inventory_set_photo(uuid,bigint)') IS NOT NULL,
  'deployed', (
    EXISTS(SELECT 1 FROM public.permissions WHERE code='inventory.create')
    AND EXISTS(SELECT 1 FROM public.permissions WHERE code='inventory.photo.attach')
    AND coalesce((SELECT 'inventory'=ANY(modules) FROM profile),false)
    AND (SELECT position('marketing_equipment_create_v1' IN permission_def)>0 FROM functions)
    AND (SELECT position('inventory.create' IN create_def)>0 FROM functions)
    AND (SELECT position('inventory.photo.attach' IN photo_def)>0 FROM functions)
  )
) AS inventory_release_preflight
FROM functions;
