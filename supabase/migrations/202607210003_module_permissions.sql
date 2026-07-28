insert into public.permissions(code,description,sensitivity) values
 ('calendar.manage','Administrar calendarios y asignaciones','sensitive'),
 ('rentals.manage','Administrar configuración y solicitudes de renta','sensitive'),
 ('inventory.manage','Administrar inventario','sensitive')
on conflict(code) do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on
 (r.code='ejecutivo' and p.code in ('calendar.manage','rentals.manage','inventory.manage')) or
 (r.code='administrador' and p.code in ('calendar.manage','rentals.manage','inventory.manage'))
on conflict do nothing;