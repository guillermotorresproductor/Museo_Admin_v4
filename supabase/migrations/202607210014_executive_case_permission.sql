insert into public.permissions (code, description, sensitivity)
values ('executive.case.read', 'Leer y actuar en la bandeja de Dirección Ejecutiva', 'critical')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'executive.case.read'
where r.code in ('ejecutivo', 'administrador')
on conflict do nothing;
