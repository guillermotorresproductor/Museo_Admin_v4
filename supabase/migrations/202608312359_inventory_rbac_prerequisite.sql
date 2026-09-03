-- Compatibilidad RBAC mínima requerida por Inventario.
-- Staging usa RBAC normalizado; Producción legacy conserva el rol en profiles.role.
-- No modifica auth, profiles, roles ni asignaciones de usuarios existentes.

do $$
declare
  v_has_permissions boolean := to_regclass('public.permissions') is not null;
  v_has_user_permissions boolean := to_regclass('public.user_permissions') is not null;
  v_has_roles boolean := to_regclass('public.roles') is not null;
  v_has_role_permissions boolean := to_regclass('public.role_permissions') is not null;
  v_has_user_roles boolean := to_regclass('public.user_roles') is not null;
  v_bad text;
  v_required_role_count integer;
begin
  if to_regclass('public.museums') is null or to_regclass('public.profiles') is null then
    raise exception 'Inventory RBAC prerequisite requires public.museums and public.profiles.' using errcode = '55000';
  end if;

  select string_agg(required.name, ', ' order by required.name) into v_bad
  from (values ('id','uuid'), ('museum_id','uuid'), ('role','text'), ('status','text')) required(name,type_name)
  left join information_schema.columns c on c.table_schema='public' and c.table_name='profiles'
    and c.column_name=required.name and c.udt_name=required.type_name
  where c.column_name is null;
  if v_bad is not null then
    raise exception 'Incompatible public.profiles; missing/wrong columns: %.', v_bad using errcode = '55000';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='current_user_museum_id'
      and pg_get_function_identity_arguments(p.oid)='' and pg_get_function_result(p.oid)='uuid'
  ) then
    raise exception 'Inventory RBAC prerequisite requires public.current_user_museum_id() returning uuid.' using errcode = '55000';
  end if;

  if v_has_permissions <> v_has_user_permissions then
    raise exception 'Incompatible partial RBAC: permissions and user_permissions must both exist or both be absent.' using errcode = '55000';
  end if;
  if (v_has_roles::int + v_has_role_permissions::int + v_has_user_roles::int) not in (0,3) then
    raise exception 'Incompatible partial normalized RBAC: roles, role_permissions and user_roles must exist together.' using errcode = '55000';
  end if;
  if v_has_roles and not v_has_permissions then
    raise exception 'Incompatible normalized RBAC: role tables exist without permission tables.' using errcode = '55000';
  end if;

  if v_has_permissions then
    select string_agg(required.name, ', ' order by required.name) into v_bad
    from (values ('id','uuid'),('code','text'),('description','text'),('sensitivity','text')) required(name,type_name)
    left join information_schema.columns c on c.table_schema='public' and c.table_name='permissions'
      and c.column_name=required.name and c.udt_name=required.type_name
    where c.column_name is null;
    if v_bad is not null or not exists (
      select 1 from pg_index i join pg_class t on t.oid=i.indrelid join pg_namespace n on n.oid=t.relnamespace
      where n.nspname='public' and t.relname='permissions' and i.indisunique
        and pg_get_indexdef(i.indexrelid) like '%(code)%'
    ) then
      raise exception 'Incompatible public.permissions structure.' using errcode = '55000';
    end if;

    select string_agg(required.name, ', ' order by required.name) into v_bad
    from (values ('museum_id','uuid'),('user_id','uuid'),('permission_id','uuid'),('effect','text'),
      ('assigned_by','uuid'),('valid_until','timestamptz'),('created_at','timestamptz')) required(name,type_name)
    left join information_schema.columns c on c.table_schema='public' and c.table_name='user_permissions'
      and c.column_name=required.name and c.udt_name=required.type_name
    where c.column_name is null;
    if v_bad is not null then
      raise exception 'Incompatible public.user_permissions; missing/wrong columns: %.', v_bad using errcode = '55000';
    end if;
  end if;

  if v_has_roles then
    execute 'select count(distinct code) from public.roles where code in (''administrador'',''ejecutivo'')'
      into v_required_role_count;
    if v_required_role_count <> 2 then
      raise exception 'Normalized RBAC requires existing administrador and ejecutivo roles.' using errcode = '55000';
    end if;
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='has_permission'
      and not (pg_get_function_identity_arguments(p.oid)='requested_permission text' and pg_get_function_result(p.oid)='boolean')
  ) then
    raise exception 'Incompatible public.has_permission overload/signature.' using errcode = '55000';
  end if;
end;
$$;

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null,
  sensitivity text not null default 'normal' check (sensitivity in ('normal','sensitive','critical'))
);

create table if not exists public.user_permissions (
  museum_id uuid not null references public.museums(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  effect text not null check (effect in ('allow','deny')),
  assigned_by uuid references public.profiles(id),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  primary key (museum_id,user_id,permission_id)
);

alter table public.permissions enable row level security;
alter table public.user_permissions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='permissions' and policyname='permissions_catalog_read') then
    create policy permissions_catalog_read on public.permissions for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_permissions' and policyname='user_permissions_self_read') then
    create policy user_permissions_self_read on public.user_permissions for select to authenticated using (user_id=auth.uid());
  end if;
end;
$$;

insert into public.permissions(code,description,sensitivity)
values ('inventory.manage','Administrar inventario','sensitive')
on conflict (code) do nothing;

do $$
begin
  if to_regclass('public.roles') is not null then
    insert into public.role_permissions(role_id,permission_id)
    select r.id,p.id from public.roles r cross join public.permissions p
    where r.code in ('administrador','ejecutivo') and p.code='inventory.manage'
    on conflict do nothing;
  end if;
end;
$$;

do $$
begin
  if to_regprocedure('public.has_permission(text)') is null then
    execute $function$
      create function public.has_permission(requested_permission text)
      returns boolean language sql stable security definer set search_path=''
      as $body$
        select auth.uid() is not null
          and exists (
            select 1 from public.profiles pr where pr.id=auth.uid()
              and pr.museum_id=public.current_user_museum_id() and pr.status in ('active','activo')
          )
          and not exists (
            select 1 from public.user_permissions up join public.permissions p on p.id=up.permission_id
            where up.user_id=auth.uid() and up.museum_id=public.current_user_museum_id()
              and p.code=requested_permission and up.effect='deny'
              and (up.valid_until is null or up.valid_until>now())
          )
          and (
            exists (
              select 1 from public.user_permissions up join public.permissions p on p.id=up.permission_id
              where up.user_id=auth.uid() and up.museum_id=public.current_user_museum_id()
                and p.code=requested_permission and up.effect='allow'
                and (up.valid_until is null or up.valid_until>now())
            )
            or (requested_permission='inventory.manage' and exists (
              select 1 from public.profiles pr where pr.id=auth.uid()
                and pr.museum_id=public.current_user_museum_id()
                and pr.role in ('administrador','ejecutivo')
            ))
          )
      $body$
    $function$;
  end if;
end;
$$;

revoke all on public.permissions,public.user_permissions from anon;
grant select on public.permissions,public.user_permissions to authenticated;
revoke all on function public.has_permission(text) from public,anon;
grant execute on function public.has_permission(text) to authenticated;
