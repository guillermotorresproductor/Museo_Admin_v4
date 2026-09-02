begin;

create temporary table inventory_test_state (
  id uuid not null,
  version bigint not null
) on commit drop;
grant select, insert, update on inventory_test_state to authenticated;

do $$
declare
  v_user_id uuid;
begin
  select ur.user_id into v_user_id
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  join public.role_permissions rp on rp.role_id = r.id
  join public.permissions p on p.id = rp.permission_id
  join public.profiles pr on pr.id = ur.user_id and pr.status = 'active'
  where p.code = 'inventory.manage'
    and (ur.valid_until is null or ur.valid_until > now())
  limit 1;
  if v_user_id is null then
    raise exception 'No Staging user has inventory.manage';
  end if;
  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
end;
$$;

set local role authenticated;

insert into inventory_test_state(id, version)
select created.id, created.version
from public.inventory_create(jsonb_build_object(
  'asset_tag', 'CODEX-STAGING-ROLLBACK-001',
  'serial_number', 'CODEX-SERIAL-ROLLBACK-001',
  'name', 'Equipo sintético de prueba',
  'description', 'Prueba transaccional; nunca persiste',
  'category', 'Prueba',
  'brand', 'Codex',
  'model', 'Staging',
  'purchase_order', 'TEST-ROLLBACK',
  'supplier', 'Prueba',
  'received_date', '2026-09-01',
  'cost', '1.00',
  'condition', 'excelente',
  'location', 'Almacén 1',
  'responsible', 'Prueba Staging',
  'status', 'activo',
  'warranty', 'No aplica'
)) created;

do $$
declare
  v_id uuid;
  v_version bigint;
  v_updated public.inventory_items;
begin
  select id, version into v_id, v_version from inventory_test_state;
  v_updated := public.inventory_update(v_id, v_version, jsonb_build_object(
    'asset_tag', 'CODEX-STAGING-ROLLBACK-001',
    'serial_number', 'CODEX-SERIAL-ROLLBACK-001',
    'name', 'Equipo sintético de prueba',
    'description', 'Prueba transaccional; nunca persiste',
    'category', 'Prueba',
    'brand', 'Codex',
    'model', 'Staging',
    'purchase_order', 'TEST-ROLLBACK',
    'supplier', 'Prueba',
    'received_date', '2026-09-01',
    'cost', '1.00',
    'condition', 'buena',
    'location', 'Almacén 2',
    'responsible', 'Prueba Staging actualizada',
    'status', 'activo',
    'warranty', 'No aplica'
  ));
  update inventory_test_state set version = v_updated.version where id = v_id;
end;
$$;

do $$
declare
  v_id uuid;
  v_version bigint;
begin
  select id, version into v_id, v_version from inventory_test_state;
  begin
    perform public.inventory_update(v_id, v_version - 1, '{}'::jsonb);
    raise exception 'Concurrency test did not reject a stale version';
  exception when serialization_failure then
    null;
  end;
end;
$$;

do $$
declare
  v_id uuid;
  v_version bigint;
  v_archived public.inventory_items;
begin
  select id, version into v_id, v_version from inventory_test_state;
  v_archived := public.inventory_archive(v_id, v_version);
  update inventory_test_state set version = v_archived.version where id = v_id;
end;
$$;

do $$
declare
  v_id uuid;
  v_action_count integer;
begin
  select id into v_id from inventory_test_state;
  select count(distinct action) into v_action_count
  from public.audit_logs
  where record_id = v_id
    and action in (
      'INVENTORY_CREATED', 'INVENTORY_EDITED', 'INVENTORY_LOCATION_CHANGED',
      'INVENTORY_RESPONSIBLE_CHANGED', 'INVENTORY_CONDITION_CHANGED', 'INVENTORY_ARCHIVED'
    );
  if v_action_count <> 6 then
    raise exception 'Expected 6 inventory audit actions, got %', v_action_count;
  end if;
end;
$$;

reset role;
rollback;

select 'inventory_staging_transaction_passed' as result;
