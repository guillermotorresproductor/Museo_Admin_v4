-- Follow-up for 202610110002 (already deployed in Staging outside migration history).
-- Keep Marketing create-only by default, but honor a deliberate, active, explicit
-- user_permissions ALLOW for inventory.manage within the current museum.
-- No employee, collections, HR, payroll, attendance or stored asset changes.
-- Previously evaluated active-profile, user DENY and module-boundary checks stay intact.
begin;

do $marketing_explicit_manage_allow$
declare
  current_def text;
  next_def text;
  old_branch constant text := 'if chosen=''contenido_marketing'' and requested_permission=''inventory.manage'' then return false; end if;';
  new_branch constant text := $branch$
-- marketing_inventory_manage_explicit_allow_v1
if chosen='contenido_marketing' and requested_permission='inventory.manage' then
  return exists (
    select 1
      from public.user_permissions u
      join public.permissions p on p.id = u.permission_id
    where u.user_id = auth.uid()
      and u.museum_id = public.current_user_museum_id()
      and p.code = 'inventory.manage'
      and u.effect = 'allow'
      and (u.valid_until is null or u.valid_until > now())
  );
end if;
$branch$;
begin
  current_def := pg_get_functiondef('public.has_permission(text)'::regprocedure);

  if position('marketing_inventory_manage_explicit_allow_v1' in current_def) > 0 then
    return;
  end if;

  if position('marketing_equipment_create_v1' in current_def) = 0
     or position(old_branch in current_def) = 0
     or (
       position('target_module:=public.permission_module(requested_permission);' in current_def) = 0
       and position('target_module := public.permission_module(requested_permission);' in current_def) = 0
     ) then
    raise exception 'MARKETING_INVENTORY_RESOLVER_UNEXPECTED'
      using errcode = '55000';
  end if;

  next_def := replace(current_def, old_branch, new_branch);
  if next_def = current_def
     or position('marketing_inventory_manage_explicit_allow_v1' in next_def) = 0 then
    raise exception 'MARKETING_INVENTORY_MANAGE_PATCH_FAILED'
      using errcode = '55000';
  end if;

  execute next_def;
end
$marketing_explicit_manage_allow$;

notify pgrst, 'reload schema';
commit;
