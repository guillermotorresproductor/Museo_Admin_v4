begin;

create temporary table inventory_isolation_context (
  manager_id uuid not null,
  manager_museum_id uuid not null,
  other_museum_id uuid not null,
  inventory_permission_id uuid not null
) on commit drop;
grant select on inventory_isolation_context to authenticated;

do $$
declare
  v_manager_id uuid;
  v_manager_museum_id uuid;
  v_other_museum_id uuid := gen_random_uuid();
  v_permission_id uuid;
begin
  select ur.user_id, ur.museum_id
  into v_manager_id, v_manager_museum_id
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id and r.code = 'administrador'
  join public.profiles pr on pr.id = ur.user_id and pr.status = 'active'
  where ur.valid_until is null or ur.valid_until > now()
  limit 1;
  select id into v_permission_id from public.permissions where code = 'inventory.manage';
  if v_manager_id is null or v_permission_id is null then
    raise exception 'Staging requires an active administrador with inventory.manage';
  end if;

  insert into inventory_isolation_context
  values (v_manager_id, v_manager_museum_id, v_other_museum_id, v_permission_id);
  insert into public.museums(id, name, slug)
  values (v_other_museum_id, 'Museo sintético aislado', 'codex-isolation-rollback');
  perform set_config('request.jwt.claim.sub', v_manager_id::text, true);

  insert into public.inventory_items(
    museum_id, asset_tag, name, description, category, quantity, condition,
    location, status, created_by, updated_by
  ) values (
    v_other_museum_id, 'CODEX-OTHER-MUSEUM-ROLLBACK', 'Equipo de otro museo',
    'Nunca persiste', 'Prueba', 1, 'excelente', 'Aislado', 'activo',
    v_manager_id, v_manager_id
  );
end;
$$;

set local role authenticated;

do $$
declare
  v_context inventory_isolation_context;
  v_created public.inventory_items;
  v_visible integer;
begin
  select * into v_context from inventory_isolation_context;
  if public.current_user_museum_id() <> v_context.manager_museum_id then
    raise exception 'Session museum mismatch';
  end if;
  if not public.has_permission('inventory.manage') then
    raise exception 'Administrator test user is missing inventory.manage';
  end if;

  select count(*) into v_visible
  from public.inventory_items
  where museum_id = v_context.other_museum_id;
  if v_visible <> 0 then
    raise exception 'Cross-museum inventory read was allowed';
  end if;

  v_created := public.inventory_create(jsonb_build_object(
    'museum_id', v_context.other_museum_id,
    'asset_tag', 'CODEX-RPC-TENANT-ROLLBACK',
    'name', 'Prueba RPC tenant', 'description', 'Nunca persiste',
    'category', 'Prueba', 'condition', 'excelente',
    'location', 'Almacén 1', 'status', 'activo'
  ));
  if v_created.photo_path is not null then
    raise exception 'Create without photo unexpectedly set photo_path';
  end if;
  if v_created.museum_id <> v_context.manager_museum_id then
    raise exception 'RPC accepted a caller-supplied museum_id';
  end if;

  begin
    insert into public.inventory_items(
      museum_id, asset_tag, name, description, category, quantity, condition,
      location, status, created_by, updated_by
    ) values (
      v_context.other_museum_id, 'CODEX-CROSS-WRITE-ROLLBACK', 'No permitido',
      'Nunca persiste', 'Prueba', 1, 'excelente', 'Aislado', 'activo',
      v_context.manager_id, v_context.manager_id
    );
    raise exception 'Cross-museum direct write was allowed';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into storage.objects(bucket_id, name, owner_id)
    values ('inventory-photos', v_context.other_museum_id::text || '/' || v_created.id::text || '/main.webp', auth.uid()::text);
    raise exception 'Cross-museum storage write was allowed';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;

insert into public.user_permissions(museum_id, user_id, permission_id, effect, assigned_by)
select manager_museum_id, manager_id, inventory_permission_id, 'deny', manager_id
from inventory_isolation_context
on conflict (museum_id, user_id, permission_id)
do update set effect = 'deny', valid_until = null;

set local role authenticated;

do $$
begin
  if public.has_permission('inventory.manage') then
    raise exception 'Explicit deny did not remove inventory.manage';
  end if;
  begin
    perform public.inventory_create(jsonb_build_object(
      'asset_tag', 'CODEX-DENIED-ROLLBACK', 'name', 'No permitido',
      'description', 'Nunca persiste', 'category', 'Prueba',
      'condition', 'excelente', 'location', 'Almacén 1', 'status', 'activo'
    ));
    raise exception 'User without inventory.manage created an item';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
rollback;

select 'inventory_staging_isolation_passed' as result;
