-- Grant existing finance.write to administrador only.
-- Does not create/alter the permission, and does not change the finanzas role grant.

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'finance.write'
where r.code = 'administrador'
on conflict do nothing;
