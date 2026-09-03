-- Piloto reproducible; ejecutar solo en Staging. Sin fotos ni seriales reales.
begin;

create temporary table pilot_context(manager_id uuid, museum_id uuid, other_museum_id uuid, permission_id uuid) on commit drop;
create temporary table pilot_items(id uuid primary key, asset_tag text, record_type text, quantity integer, version bigint) on commit drop;
grant select on pilot_context to authenticated;
grant select,insert,update on pilot_items to authenticated;

do $$
declare u uuid; m uuid; p uuid;
begin
  select ur.user_id,ur.museum_id into u,m
  from public.user_roles ur
  join public.roles r on r.id=ur.role_id
  join public.role_permissions rp on rp.role_id=r.id
  join public.permissions pe on pe.id=rp.permission_id and pe.code='inventory.manage'
  join public.profiles pr on pr.id=ur.user_id and pr.status='active'
  where ur.valid_until is null or ur.valid_until>now() limit 1;
  select id into p from public.permissions where code='inventory.manage';
  if u is null or p is null then raise exception 'PILOT_PREREQUISITE: inventory manager required'; end if;
  if exists(select 1 from public.inventory_items where asset_tag like 'CODEX-PRACTICAL-PILOT-%') then
    raise exception 'PILOT_DIRTY_START: synthetic data exists';
  end if;
  insert into pilot_context values(u,m,gen_random_uuid(),p);
  perform set_config('request.jwt.claim.sub',u::text,true);
end $$;

set local role authenticated;

insert into pilot_items
select id,asset_tag,record_type,quantity,version from public.inventory_create(
  '{"record_type":"individual","quantity":1,"asset_tag":"CODEX-PRACTICAL-PILOT-I01","name":"Equipo sintético 1","description":"Piloto con rollback","category":"Prueba","condition":"excelente","location":"Almacén 1","status":"activo"}'::jsonb);
insert into pilot_items
select id,asset_tag,record_type,quantity,version from public.inventory_create(
  '{"record_type":"individual","quantity":1,"asset_tag":"CODEX-PRACTICAL-PILOT-I02","name":"Equipo sintético 2","description":"Piloto con rollback","category":"Prueba","condition":"buena","location":"Almacén 1","status":"activo"}'::jsonb);
insert into pilot_items
select id,asset_tag,record_type,quantity,version from public.inventory_create(
  '{"record_type":"individual","quantity":1,"asset_tag":"CODEX-PRACTICAL-PILOT-I03","name":"Equipo sintético 3","description":"Piloto con rollback","category":"Prueba","condition":"regular","location":"Almacén 2","status":"activo"}'::jsonb);
insert into pilot_items
select id,asset_tag,record_type,quantity,version from public.inventory_create(
  '{"record_type":"lot","quantity":4,"asset_tag":"CODEX-PRACTICAL-PILOT-L01","name":"Lote sintético 1","description":"Piloto con rollback","category":"Prueba","condition":"buena","location":"Almacén 1","status":"activo"}'::jsonb);
insert into pilot_items
select id,asset_tag,record_type,quantity,version from public.inventory_create(
  '{"record_type":"lot","quantity":7,"asset_tag":"CODEX-PRACTICAL-PILOT-L02","name":"Lote sintético 2","description":"Piloto con rollback","category":"Prueba","condition":"regular","location":"Almacén 2","status":"activo"}'::jsonb);

do $$
declare c pilot_context; r integer; q integer; i pilot_items; updated public.inventory_items;
begin
  select * into c from pilot_context;
  if public.current_user_museum_id()<>c.museum_id or not public.has_permission('inventory.manage') then
    raise exception 'PILOT_PERMISSION: invalid manager context';
  end if;
  select count(*),sum(x.quantity) into r,q from public.inventory_items x join pilot_items p on p.id=x.id
   where x.museum_id=c.museum_id and x.record_type=p.record_type and x.quantity=p.quantity
     and x.serial_number is null and x.photo_path is null;
  if r<>5 or q<>14 then raise exception 'PILOT_QUANTITY: expected 5 records/14 pieces, got %/%',r,q; end if;
  if (select count(*) from pilot_items where record_type='individual' and quantity=1)<>3
     or (select count(*) from pilot_items where record_type='lot')<>2 then raise exception 'PILOT_TYPES'; end if;
  if (select count(*) from public.audit_logs a join pilot_items p on p.id=a.record_id where a.action='INVENTORY_CREATED')<>5 then
    raise exception 'PILOT_AUDIT: create events missing';
  end if;

  select * into i from pilot_items where asset_tag='CODEX-PRACTICAL-PILOT-I01';
  updated:=public.inventory_update(i.id,i.version,
    '{"record_type":"individual","quantity":1,"asset_tag":"CODEX-PRACTICAL-PILOT-I01","name":"Equipo sintético 1","description":"Prueba de versión","category":"Prueba","condition":"buena","location":"Almacén 2","status":"activo"}'::jsonb);
  begin
    perform public.inventory_update(i.id,i.version,'{}'::jsonb);
    raise exception 'PILOT_CONCURRENCY: stale version accepted';
  exception when serialization_failure then null; end;
  if (select count(*) from public.audit_logs where record_id=i.id and action='INVENTORY_LOCATION_CHANGED')<>1 then
    raise exception 'PILOT_AUDIT: location event missing';
  end if;

  begin
    perform public.inventory_create('{"record_type":"individual","quantity":2,"asset_tag":"CODEX-PRACTICAL-PILOT-BAD-I","name":"Inválido","description":"Piloto","category":"Prueba","condition":"regular","location":"Almacén 1","status":"activo"}'::jsonb);
    raise exception 'PILOT_CONSTRAINT: individual quantity 2 accepted';
  exception when check_violation then null; end;
  begin
    perform public.inventory_create('{"record_type":"lot","quantity":0,"asset_tag":"CODEX-PRACTICAL-PILOT-BAD-L","name":"Inválido","description":"Piloto","category":"Prueba","condition":"regular","location":"Almacén 1","status":"activo"}'::jsonb);
    raise exception 'PILOT_CONSTRAINT: zero quantity accepted';
  exception when check_violation then null; end;
end $$;

reset role;
do $$ declare c pilot_context; begin
  select * into c from pilot_context;
  insert into public.museums(id,name,slug) values(c.other_museum_id,'Museo sintético piloto','codex-practical-pilot-rollback');
  insert into public.inventory_items(museum_id,record_type,asset_tag,name,description,category,quantity,condition,location,status,created_by,updated_by)
  values(c.other_museum_id,'individual','CODEX-PRACTICAL-PILOT-OTHER','Aislado','Piloto','Prueba',1,'regular','Aislado','activo',c.manager_id,c.manager_id);
  perform set_config('request.jwt.claim.sub',c.manager_id::text,true);
end $$;
set local role authenticated;
do $$ declare c pilot_context; begin
  select * into c from pilot_context;
  if exists(select 1 from public.inventory_items where museum_id=c.other_museum_id) then raise exception 'PILOT_RLS: cross-museum read'; end if;
end $$;

reset role;
insert into public.user_permissions(museum_id,user_id,permission_id,effect,assigned_by)
select museum_id,manager_id,permission_id,'deny',manager_id from pilot_context
on conflict(museum_id,user_id,permission_id) do update set effect='deny',valid_until=null;
set local role authenticated;
do $$ begin
  if public.has_permission('inventory.manage') then raise exception 'PILOT_PERMISSION: deny ineffective'; end if;
  begin
    perform public.inventory_create('{"record_type":"individual","quantity":1,"asset_tag":"CODEX-PRACTICAL-PILOT-DENIED","name":"Denegado","description":"Piloto","category":"Prueba","condition":"regular","location":"Almacén 1","status":"activo"}'::jsonb);
    raise exception 'PILOT_PERMISSION: denied create accepted';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
select 'inventory_practical_staging_pilot_passed' result,5 records_tested,14 pieces_tested,3 individuals,2 lots;
rollback;
