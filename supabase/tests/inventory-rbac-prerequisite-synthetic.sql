begin;

create schema inventory_rbac_test;
create table inventory_rbac_test.museums (id uuid primary key);
create table inventory_rbac_test.profiles (
  id uuid primary key,
  museum_id uuid references inventory_rbac_test.museums(id),
  role text not null,
  status text not null
);
create table inventory_rbac_test.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null,
  sensitivity text not null
);
create table inventory_rbac_test.user_permissions (
  museum_id uuid not null references inventory_rbac_test.museums(id),
  user_id uuid not null references inventory_rbac_test.profiles(id),
  permission_id uuid not null references inventory_rbac_test.permissions(id),
  effect text not null check (effect in ('allow','deny')),
  primary key (museum_id,user_id,permission_id)
);

insert into inventory_rbac_test.museums values
  ('10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002');
insert into inventory_rbac_test.profiles values
  ('10000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000001','administrador','activo'),
  ('10000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000001','empleado','activo'),
  ('20000000-0000-0000-0000-000000000021','20000000-0000-0000-0000-000000000002','ejecutivo','activo');
insert into inventory_rbac_test.permissions(code,description,sensitivity)
values ('inventory.manage','Administrar inventario','sensitive') on conflict (code) do nothing;

do $$
declare v_permission uuid;
begin
  select id into v_permission from inventory_rbac_test.permissions where code='inventory.manage';
  if not exists (select 1 from inventory_rbac_test.profiles where role='administrador' and museum_id='10000000-0000-0000-0000-000000000001') then
    raise exception 'Synthetic administrator was not authorized in its museum';
  end if;
  if not exists (select 1 from inventory_rbac_test.profiles where role not in ('administrador','ejecutivo') and id='10000000-0000-0000-0000-000000000012') then
    raise exception 'Synthetic unprivileged user fixture missing';
  end if;
  if exists (select 1 from inventory_rbac_test.profiles where id='20000000-0000-0000-0000-000000000021' and museum_id='10000000-0000-0000-0000-000000000001') then
    raise exception 'Synthetic second museum was not isolated';
  end if;
  if v_permission is null then raise exception 'Synthetic permission was not registered'; end if;
end;
$$;

rollback;
select 'inventory_rbac_prerequisite_synthetic_rollback_passed' as result;
