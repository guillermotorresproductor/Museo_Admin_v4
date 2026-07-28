insert into public.permissions(code,description,sensitivity) values
 ('time.read.all','Leer todos los ponches del museo','sensitive')
on conflict(code) do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id
from public.roles r
cross join public.permissions p
where r.code in ('recursos_humanos','ejecutivo','administrador')
  and p.code='time.read.all'
on conflict do nothing;

create policy employee_time_all_read on public.employee_time_entries
for select to authenticated using(
  museum_id=public.current_user_museum_id()
  and public.has_permission('time.read.all')
);
