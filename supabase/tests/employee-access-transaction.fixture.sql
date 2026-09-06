\set ON_ERROR_STOP on
-- Synthetic objects in an isolated, disposable LOCAL database only.
do $$ begin
 if current_database() !~ '^instituva_access_test_[0-9a-f]+$' then raise exception 'Disposable test database required'; end if;
end $$;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
create table public.profiles(id uuid primary key,museum_id uuid,role text,status text,updated_at timestamptz default now());
create table public.employees(id uuid primary key,museum_id uuid,profile_id uuid references public.profiles(id),access_level text,status text,updated_at timestamptz default now());
create table public.roles(id uuid primary key default gen_random_uuid(),code text unique,active boolean default true);
create table public.permissions(id uuid primary key default gen_random_uuid(),code text unique,description text,sensitivity text);
create table public.role_permissions(role_id uuid references public.roles(id),permission_id uuid references public.permissions(id),primary key(role_id,permission_id));
create table public.user_roles(museum_id uuid,user_id uuid references public.profiles(id),role_id uuid references public.roles(id),assigned_by uuid,valid_until timestamptz,created_at timestamptz default now(),primary key(museum_id,user_id,role_id));
create table public.user_permissions(museum_id uuid,user_id uuid,permission_id uuid,effect text,valid_until timestamptz);
create table public.audit_logs(id uuid primary key default gen_random_uuid(),museum_id uuid,actor_user_id uuid,action text,table_name text,record_id uuid,old_value jsonb,new_value jsonb);
create function public.current_user_museum_id() returns uuid language sql stable security definer set search_path='' as $$ select museum_id from public.profiles where id=auth.uid() $$;
insert into public.roles(code) values ('empleado'),('ejecutivo'),('administrador'),('finanzas');
-- Reuse the real has_permission implementation and catalog from this repository.
\ir ../migrations/202609030005_current_user_permissions_production_fix.sql
\ir ../migrations/202609060001_transactional_employee_access_level.sql
\ir ../migrations/202609060002_personal_access_compatibility.sql
\ir ../migrations/202609060002_personal_access_compatibility.sql
grant usage on schema public,auth to authenticated;
grant select,update on public.profiles to authenticated;
insert into public.profiles(id,museum_id,role,status) values
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','administrador','active'),
 ('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','empleado','active'),
 ('30000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','empleado','active');
insert into public.employees(id,museum_id,profile_id,access_level,status) values
 ('40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','empleado','activo'),
 ('40000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','administrador','activo'),
 ('40000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','empleado','activo'),
 ('40000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001',null,'empleado','activo');
insert into public.user_roles(museum_id,user_id,role_id,assigned_by,valid_until)
 select '00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',id,'10000000-0000-4000-8000-000000000001',null from public.roles where code in ('empleado','finanzas');
insert into public.user_permissions(museum_id,user_id,permission_id,effect)
 select '00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',id,'deny' from public.permissions where code='finance.read';
-- Snapshot full rows, including state, grants, overrides, timestamps, audit and
-- effective permission answers. JSON equality after failure proves rollback.
create function public.test_access_snapshot() returns jsonb language sql as $$
 select jsonb_build_object(
 'profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),
 'employees',(select jsonb_agg(to_jsonb(e) order by id) from public.employees e),
 'roles',(select jsonb_agg(to_jsonb(r) order by user_id,role_id) from public.user_roles r),
 'overrides',(select jsonb_agg(to_jsonb(u) order by user_id,permission_id) from public.user_permissions u),
 'audit',(select jsonb_agg(to_jsonb(a) order by id) from public.audit_logs a),
 'permissions',(select jsonb_agg(jsonb_build_array(code,public.has_permission(code)) order by code) from public.permissions))
$$;
-- Faults are injected ONLY by this test trigger, never through a production RPC option.
create function public.test_access_failure() returns trigger language plpgsql as $$ begin
 if current_setting('test.access_fault',true)=tg_argv[0] then raise exception 'INJECTED:%',tg_argv[0]; end if;
 return null;
end $$;
create trigger test_fail_profile after update on public.profiles for each row execute function public.test_access_failure('profile');
create trigger test_fail_delete after delete on public.user_roles for each row execute function public.test_access_failure('delete');
create trigger test_fail_insert after insert on public.user_roles for each row execute function public.test_access_failure('insert');
create trigger test_fail_employee after update on public.employees for each row execute function public.test_access_failure('employee');
create trigger test_fail_audit after insert on public.audit_logs for each row execute function public.test_access_failure('audit');
