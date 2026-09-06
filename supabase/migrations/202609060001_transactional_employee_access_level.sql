-- Local only: atomic replacement of the three existing employee access levels.
-- No Auth/status writes, new roles/tables, JWT changes, or RLS policy changes.
begin;

-- Keep direct client writes to profile security fields forbidden. The trusted
-- postgres-owned RPC can change only another user's role, after RBAC validation.
-- This checks the SQL execution identity, never a caller-settable GUC/JWT marker.
create or replace function public.protect_profile_security_fields()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is not null and auth.role() <> 'service_role' then
    if new.id is distinct from old.id or new.museum_id is distinct from old.museum_id
       or new.status is distinct from old.status then
      raise exception 'Security fields must be changed by an authorized server function' using errcode='42501';
    end if;
    if new.role is distinct from old.role and not (
      current_user = 'postgres' and auth.uid() <> old.id
      and old.museum_id = public.current_user_museum_id()
      and public.has_permission('roles.assign')
      and new.role in ('empleado','ejecutivo','administrador')
    ) then
      raise exception 'Security fields must be changed by an authorized server function' using errcode='42501';
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.replace_employee_access_level(
  p_employee_id uuid, p_role_code text, p_expected_role text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  museum uuid;
  employee_row public.employees%rowtype;
  target_profile public.profiles%rowtype;
  requested text := lower(btrim(p_role_code));
  expected text := lower(btrim(p_expected_role));
  previous text;
  target_role_id uuid;
  normalized boolean;
  relation_count integer;
  old_assignments jsonb := '[]'::jsonb;
  actor_column text;
  before_value jsonb;
begin
  if actor_id is null or public.has_permission('roles.assign') is not true then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if requested is null or requested not in ('empleado','ejecutivo','administrador')
     or expected is null or expected not in ('empleado','ejecutivo','administrador') then
    raise exception 'INVALID_ACCESS_LEVEL' using errcode='22023';
  end if;
  museum := public.current_user_museum_id();
  select * into employee_row from public.employees
    where id=p_employee_id and museum_id=museum for update;
  if not found then raise exception 'EMPLOYEE_NOT_FOUND' using errcode='42501'; end if;
  if employee_row.profile_id = actor_id then
    raise exception 'SELF_LEVEL_CHANGE_FORBIDDEN' using errcode='42501';
  end if;

  -- Lock actor and target in deterministic order. Two employees linked to the
  -- same target profile also serialize here. Recheck authorization after waiting.
  perform p.id from public.profiles p
    where p.id=actor_id or p.id=employee_row.profile_id order by p.id for update;
  if not public.has_permission('roles.assign') or public.current_user_museum_id() is distinct from museum then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  relation_count := num_nonnulls(to_regclass('public.roles'), to_regclass('public.role_permissions'), to_regclass('public.user_roles'));
  if relation_count not in (0,3) then raise exception 'PARTIAL_RBAC_SCHEMA'; end if;
  normalized := relation_count=3;
  if normalized then
    execute 'select id from public.roles where code=$1 and active' into target_role_id using requested;
    if target_role_id is null then raise exception 'INVALID_ACCESS_LEVEL' using errcode='22023'; end if;
  end if;
  previous := lower(employee_row.access_level);
  if employee_row.profile_id is not null then
    select * into target_profile from public.profiles
      where id=employee_row.profile_id and museum_id=museum;
    if not found then raise exception 'IDENTITY_LINK_INVALID' using errcode='42501'; end if;
    previous := lower(target_profile.role);
    if previous not in ('empleado','ejecutivo','administrador') or previous is null then
      raise exception 'INVALID_ACCESS_LEVEL' using errcode='22023';
    end if;
    if normalized then
      -- Include profiles.role exactly as has_permission does; expired grants do
      -- not contribute to the displayed level. Preserve all unrelated grants.
      execute $query$
        select coalesce(jsonb_agg(to_jsonb(ur) order by ur.role_id), '[]'::jsonb)
        from public.user_roles ur join public.roles r on r.id=ur.role_id
        where ur.user_id=$1 and ur.museum_id=$2
          and r.code in ('empleado','ejecutivo','administrador')
      $query$ into old_assignments using target_profile.id,museum;
      execute $query$
        select code from (
          select $3::text as code
          union select r.code from public.user_roles ur join public.roles r on r.id=ur.role_id
          where ur.user_id=$1 and ur.museum_id=$2
            and (ur.valid_until is null or ur.valid_until>now())
            and r.code in ('empleado','ejecutivo','administrador')
        ) levels order by case code when 'administrador' then 3 when 'ejecutivo' then 2 else 1 end desc limit 1
      $query$ into previous using target_profile.id,museum,previous;
    end if;
  end if;
  if previous is distinct from expected then
    raise exception 'ACCESS_LEVEL_CHANGED_RELOAD' using errcode='40001';
  end if;
  before_value := jsonb_build_object('role', previous, 'access_level',employee_row.access_level,
    'profile_role',target_profile.role,'assignments',old_assignments);

  if employee_row.profile_id is not null then
    update public.profiles set role=requested where id=target_profile.id and museum_id=museum;
    if normalized then
      execute $query$
        delete from public.user_roles ur using public.roles r
        where ur.role_id=r.id and ur.user_id=$1 and ur.museum_id=$2
          and r.code in ('empleado','ejecutivo','administrador')
      $query$ using target_profile.id,museum;
      execute 'insert into public.user_roles(museum_id,user_id,role_id,assigned_by,valid_until) values($1,$2,$3,$4,null)'
        using museum,target_profile.id,target_role_id,actor_id;
    end if;
  end if;
  update public.employees set access_level=requested where id=p_employee_id and museum_id=museum;

  -- Resolve only the known audit schema variation, never swallow write errors.
  select a.attname into actor_column from pg_catalog.pg_attribute a
    where a.attrelid='public.audit_logs'::regclass and not a.attisdropped
      and a.attname in ('actor_user_id','user_id')
    order by case a.attname when 'actor_user_id' then 0 else 1 end limit 1;
  if actor_column is null then raise exception 'AUDIT_ACTOR_COLUMN_REQUIRED'; end if;
  execute format('insert into public.audit_logs(museum_id,%I,action,table_name,record_id,old_value,new_value) values($1,$2,$3,$4,$5,$6,$7)',actor_column)
    using museum,actor_id,'ACCESS_LEVEL_CHANGED','employees',p_employee_id,before_value,
      jsonb_build_object('role',requested,'profile_id',employee_row.profile_id);
  return jsonb_build_object('assigned',true,'role',requested);
  -- No exception handler: any failure aborts this entire statement/transaction,
  -- including prior updates, assignment deletes/inserts and audit triggers.
end;
$$;
alter function public.replace_employee_access_level(uuid,text,text) owner to postgres;
revoke all on function public.replace_employee_access_level(uuid,text,text) from public,anon,service_role;
grant execute on function public.replace_employee_access_level(uuid,text,text) to authenticated;
commit;
