-- Grant Irma Rodriguez edit-only access to equipment inventory, not archive.
-- Preserve all equipment records and all employee/collection permissions.
begin;

insert into public.permissions (code, description, sensitivity)
values ('inventory.edit', 'Editar equipos existentes sin archivar', 'sensitive')
on conflict (code) do nothing;

do $grant_edit$
declare
  v_employee record;
  v_permission_id uuid;
begin
  select e.id, e.profile_id, e.museum_id into v_employee
  from public.employees e
  join public.profiles pr on pr.id = e.profile_id and pr.museum_id = e.museum_id
  where e.first_name = 'Irma'
    and e.last_name in ('Rodríguez','Rodriguez')
    and e.access_profile = 'contenido_marketing'
    and e.status = 'activo'
    and pr.status in ('active','activo');
  if not found or v_employee.profile_id is null then
    raise exception 'IRMA_ACTIVE_MARKETING_PROFILE_NOT_FOUND';
  end if;
  select id into v_permission_id from public.permissions where code = 'inventory.edit';
  insert into public.user_permissions(museum_id,user_id,permission_id,effect)
  values (v_employee.museum_id,v_employee.profile_id,v_permission_id,'allow')
  on conflict (museum_id,user_id,permission_id)
  do update set effect = 'allow', valid_until = null;
end
$grant_edit$;

-- Respect existing explicit deny and module restrictions, and check active account.
do $edit_permission$
declare
  v_src text;
  v_new text;
  v_anchor constant text := 'if requested_permission=''inventory.photo.attach'' and public.has_permission(''modules.inventory.read'') then return true; end if;';
  v_branch constant text := $branch$
 -- inventory_edit_only_v1: explicitly granted user permission, never archive.
 if requested_permission = 'inventory.edit' then
   return exists (
     select 1 from public.user_permissions u
     join public.permissions p on p.id = u.permission_id
     where u.user_id = auth.uid()
       and u.museum_id = public.current_user_museum_id()
       and p.code = 'inventory.edit'
       and u.effect = 'allow'
       and (u.valid_until is null or u.valid_until > now())
   ) and public.module_profile_allows('inventory');
 end if;
$branch$;
begin
  v_src := pg_get_functiondef('public.has_permission(text)'::regprocedure);
  if position('inventory_edit_only_v1' in v_src) = 0 then
    if position(v_anchor in v_src) = 0 then raise exception 'EDIT_PERMISSION_RESOLVER_UNEXPECTED'; end if;
    v_new := replace(v_src,v_anchor,v_branch || E'\n ' || v_anchor);
    execute v_new;
  end if;
end
$edit_permission$;

-- Update ONLY the edit RPC authorization, never the archive RPC.
do $edit_rpc$
declare
  v_src text;
  v_new text;
  v_old constant text := 'not public.has_permission(''inventory.manage'')';
  v_new_guard constant text := 'not (public.has_permission(''inventory.manage'') or public.has_permission(''inventory.edit''))';
begin
  v_src := pg_get_functiondef('public.inventory_update(uuid,bigint,jsonb)'::regprocedure);
  if position('inventory.edit' in v_src) = 0 then
    if position(v_old in v_src) = 0 then raise exception 'INVENTORY_UPDATE_GUARD_UNEXPECTED'; end if;
    v_new := replace(v_src,v_old,v_new_guard);
    execute v_new;
  end if;
end
$edit_rpc$;
notify pgrst, 'reload schema';
commit;
