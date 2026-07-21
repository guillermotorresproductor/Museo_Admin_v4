create extension if not exists pgcrypto with schema extensions;

create table public.museums (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.museums (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Museo de la Música de Puerto Rico', 'museo-musica-pr')
on conflict (id) do nothing;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  museum_id uuid not null references public.museums(id),
  full_name text not null default '',
  email text not null,
  role text not null default 'empleado',
  status text not null default 'active' check (status in ('active','suspended','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_museum_id_idx on public.profiles(museum_id);
create unique index profiles_email_lower_idx on public.profiles(lower(email));

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id),
  profile_id uuid null references public.profiles(id) on delete set null,
  auth_user_id uuid null references auth.users(id) on delete set null,
  employee_number text,
  first_name text not null,
  last_name text not null,
  photo_url text,
  position text not null default '',
  department text not null default '',
  email text not null,
  phone text,
  address text,
  hire_date date,
  work_schedule text,
  education_level text,
  medical_condition text,
  access_level text not null default 'empleado',
  status text not null default 'activo' check (status in ('activo','inactivo','terminado')),
  terminated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_auth_profile_match check (profile_id is null or auth_user_id is null or profile_id = auth_user_id)
);
create index employees_museum_id_idx on public.employees(museum_id);
create index employees_profile_id_idx on public.employees(profile_id);
create unique index employees_auth_user_id_unique on public.employees(auth_user_id) where auth_user_id is not null;
create unique index employees_museum_email_unique on public.employees(museum_id, lower(email));

create table public.employee_medical_records (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id),
  employee_id uuid not null references public.employees(id) on delete restrict,
  notes text not null,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index employee_medical_employee_idx on public.employee_medical_records(employee_id);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true
);
create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null,
  sensitivity text not null default 'normal' check (sensitivity in ('normal','sensitive','critical'))
);
create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);
create table public.user_roles (
  museum_id uuid not null references public.museums(id),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references public.profiles(id),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  primary key (museum_id, user_id, role_id)
);
create index user_roles_user_idx on public.user_roles(user_id, museum_id);
create table public.user_permissions (
  museum_id uuid not null references public.museums(id),
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  effect text not null check (effect in ('allow','deny')),
  assigned_by uuid references public.profiles(id),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  primary key (museum_id, user_id, permission_id)
);
create table public.employee_supervisors (
  museum_id uuid not null references public.museums(id),
  supervisor_employee_id uuid not null references public.employees(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  primary key (museum_id, supervisor_employee_id, employee_id),
  check (supervisor_employee_id <> employee_id)
);

insert into public.roles(code,name) values
 ('empleado','Empleado'),('supervisor','Supervisor'),('recursos_humanos','Recursos Humanos'),
 ('finanzas','Finanzas'),('ejecutivo','Ejecutivo'),('administrador','Administrador');
insert into public.permissions(code,description,sensitivity) values
 ('profile.read.self','Leer perfil propio','normal'),('profile.update.self','Actualizar perfil propio no sensible','normal'),
 ('employees.read.self','Leer expediente propio permitido','sensitive'),('employees.read.team','Leer expedientes del equipo','sensitive'),
 ('employees.read.all','Leer directorio laboral del museo','sensitive'),('employees.create','Crear expediente laboral','sensitive'),
 ('employees.update.basic','Actualizar datos básicos','sensitive'),('employees.update.employment','Actualizar datos laborales','sensitive'),
 ('employees.deactivate','Desactivar expediente laboral','critical'),('employees.medical.read','Leer datos médicos','critical'),
 ('employees.medical.write','Editar datos médicos','critical'),('notifications.read.self','Leer notificaciones propias','normal'),
 ('notifications.manage','Administrar notificaciones','sensitive'),('finance.read','Leer Finanzas','critical'),
 ('finance.write','Editar Finanzas','critical'),('finance.export','Exportar Finanzas','critical'),
 ('users.invite','Invitar usuarios','critical'),('users.deactivate','Suspender acceso','critical'),
 ('roles.assign','Asignar roles y permisos','critical'),('audit.read','Leer auditoría','critical'),
 ('system.configure','Configurar el sistema','critical');

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on
 (r.code='empleado' and p.code in ('profile.read.self','profile.update.self','employees.read.self','notifications.read.self')) or
 (r.code='supervisor' and p.code in ('profile.read.self','profile.update.self','employees.read.self','employees.read.team','notifications.read.self')) or
 (r.code='recursos_humanos' and p.code in ('profile.read.self','profile.update.self','employees.read.self','employees.read.all','employees.create','employees.update.basic','employees.update.employment','employees.deactivate','users.invite','users.deactivate','notifications.read.self')) or
 (r.code='finanzas' and p.code in ('profile.read.self','profile.update.self','employees.read.self','notifications.read.self','finance.read','finance.write','finance.export')) or
 (r.code='ejecutivo' and p.code in ('profile.read.self','profile.update.self','employees.read.self','employees.read.all','notifications.read.self','notifications.manage','audit.read')) or
 (r.code='administrador' and p.code in ('profile.read.self','profile.update.self','employees.read.self','employees.read.all','employees.create','employees.update.basic','employees.update.employment','employees.deactivate','notifications.read.self','notifications.manage','users.invite','users.deactivate','roles.assign','audit.read','system.configure'));

create or replace function public.current_user_museum_id() returns uuid language sql stable security definer set search_path='' as $$
 select museum_id from public.profiles where id=auth.uid() and status='active'
$$;
create or replace function public.has_permission(requested_permission text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.profiles pr where pr.id=auth.uid() and pr.status='active') and
 not exists(select 1 from public.user_permissions up join public.permissions p on p.id=up.permission_id where up.user_id=auth.uid() and up.museum_id=public.current_user_museum_id() and p.code=requested_permission and up.effect='deny' and (up.valid_until is null or up.valid_until>now())) and
 (exists(select 1 from public.user_permissions up join public.permissions p on p.id=up.permission_id where up.user_id=auth.uid() and up.museum_id=public.current_user_museum_id() and p.code=requested_permission and up.effect='allow' and (up.valid_until is null or up.valid_until>now())) or
 exists(select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id join public.permissions p on p.id=rp.permission_id where ur.user_id=auth.uid() and ur.museum_id=public.current_user_museum_id() and p.code=requested_permission and (ur.valid_until is null or ur.valid_until>now())))
$$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
declare default_role_id uuid;
begin
 insert into public.profiles(id,museum_id,full_name,email,role,status) values(new.id,'00000000-0000-0000-0000-000000000001',coalesce(new.raw_user_meta_data->>'full_name',''),coalesce(new.email,''),'empleado','active') on conflict(id) do nothing;
 select id into default_role_id from public.roles where code='empleado';
 insert into public.user_roles(museum_id,user_id,role_id) values('00000000-0000-0000-0000-000000000001',new.id,default_role_id) on conflict do nothing;
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), museum_id uuid not null references public.museums(id), actor_user_id uuid references public.profiles(id),
 action text not null, table_name text not null, record_id uuid, old_value jsonb, new_value jsonb, created_at timestamptz not null default now()
);
create index audit_logs_museum_created_idx on public.audit_logs(museum_id,created_at desc);
create or replace function public.audit_employee_changes() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_logs(museum_id,actor_user_id,action,table_name,record_id,old_value,new_value)
 values(coalesce(new.museum_id,old.museum_id),auth.uid(),tg_op,'employees',coalesce(new.id,old.id),case when tg_op='INSERT' then null else to_jsonb(old)-'medical_condition' end,case when tg_op='DELETE' then null else to_jsonb(new)-'medical_condition' end);
 return coalesce(new,old);
end $$;
create trigger employees_audit after insert or update or delete on public.employees for each row execute function public.audit_employee_changes();

alter table public.museums enable row level security; alter table public.profiles enable row level security; alter table public.employees enable row level security;
alter table public.employee_medical_records enable row level security; alter table public.roles enable row level security; alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security; alter table public.user_roles enable row level security; alter table public.user_permissions enable row level security;
alter table public.employee_supervisors enable row level security; alter table public.audit_logs enable row level security;

create policy museums_same_tenant_select on public.museums for select to authenticated using(id=public.current_user_museum_id());
create policy profiles_self_select on public.profiles for select to authenticated using(id=auth.uid());
create policy profiles_self_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid() and museum_id=public.current_user_museum_id());
create policy employees_select on public.employees for select to authenticated using(museum_id=public.current_user_museum_id() and (public.has_permission('employees.read.all') or auth_user_id=auth.uid() or profile_id=auth.uid()));
create policy employees_insert on public.employees for insert to authenticated with check(museum_id=public.current_user_museum_id() and public.has_permission('employees.create'));
create policy employees_update on public.employees for update to authenticated using(museum_id=public.current_user_museum_id() and (public.has_permission('employees.update.basic') or auth_user_id=auth.uid())) with check(museum_id=public.current_user_museum_id());
create policy medical_select on public.employee_medical_records for select to authenticated using(museum_id=public.current_user_museum_id() and public.has_permission('employees.medical.read'));
create policy medical_insert on public.employee_medical_records for insert to authenticated with check(museum_id=public.current_user_museum_id() and public.has_permission('employees.medical.write'));
create policy medical_update on public.employee_medical_records for update to authenticated using(museum_id=public.current_user_museum_id() and public.has_permission('employees.medical.write')) with check(museum_id=public.current_user_museum_id());
create policy roles_catalog_read on public.roles for select to authenticated using(true); create policy permissions_catalog_read on public.permissions for select to authenticated using(true);
create policy role_permissions_read on public.role_permissions for select to authenticated using(true);
create policy user_roles_self_read on public.user_roles for select to authenticated using(user_id=auth.uid() or public.has_permission('roles.assign'));
create policy user_permissions_self_read on public.user_permissions for select to authenticated using(user_id=auth.uid() or public.has_permission('roles.assign'));
create policy supervisors_same_museum_read on public.employee_supervisors for select to authenticated using(museum_id=public.current_user_museum_id());
create policy audit_authorized_read on public.audit_logs for select to authenticated using(museum_id=public.current_user_museum_id() and public.has_permission('audit.read'));

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select on public.museums,public.roles,public.permissions,public.role_permissions to authenticated;
grant select,update on public.profiles to authenticated;
grant select,insert,update on public.employees to authenticated;
grant select,insert,update on public.employee_medical_records to authenticated;
grant select on public.user_roles,public.user_permissions,public.employee_supervisors,public.audit_logs to authenticated;
grant execute on function public.current_user_museum_id() to authenticated;
grant execute on function public.has_permission(text) to authenticated;