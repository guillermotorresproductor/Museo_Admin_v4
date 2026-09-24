-- Individual inventory access for one employee. Does not change gerente_museografica.
-- An allow row can widen access only for modules.inventory.read and inventory.manage.

do $patch$
declare src text; patched text; pos integer;
  grant_sql text := $grant$
 -- inventory_individual_allow: not a general user_permissions allow bypass.
 if requested_permission in ('modules.inventory.read','inventory.manage')
    and exists(
      select 1 from public.user_permissions u
      join public.permissions p on p.id = u.permission_id
      where u.user_id = auth.uid()
        and u.museum_id = public.current_user_museum_id()
        and p.code = requested_permission
        and u.effect = 'deny'
        and (u.valid_until is null or u.valid_until > now())
    ) then
   return false;
 end if;
 if requested_permission in ('modules.inventory.read','inventory.manage')
    and exists(
      select 1 from public.profiles pr
      where pr.id = auth.uid()
        and pr.museum_id = public.current_user_museum_id()
        and pr.status in ('active','activo')
    )
    and exists(
      select 1 from public.user_permissions u
      join public.permissions p on p.id = u.permission_id
      where u.user_id = auth.uid()
        and u.museum_id = public.current_user_museum_id()
        and p.code = requested_permission
        and u.effect = 'allow'
        and (u.valid_until is null or u.valid_until > now())
    ) then
   return true;
 end if;
$grant$;
begin
  src := pg_get_functiondef('public.has_permission(text)'::regprocedure);
  if position('inventory_individual_allow' in src) > 0 then
    return;
  end if;
  pos := position(E'\nbegin' in src);
  if pos = 0 then
    raise exception 'HAS_PERMISSION_PATCH_FAILED';
  end if;
  patched := overlay(src placing E'\nbegin' || grant_sql from pos for 6);
  if patched = src or position('inventory_individual_allow' in patched) = 0 then
    raise exception 'HAS_PERMISSION_PATCH_FAILED';
  end if;
  execute patched;
end
$patch$;

insert into public.user_permissions(museum_id, user_id, permission_id, effect)
select e.museum_id, e.profile_id, p.id, 'allow'
from public.employees e
join public.permissions p on p.code in ('modules.inventory.read','inventory.manage')
where e.id = '19054839-4e00-4a1d-816e-c6c69e07506d'
  and e.profile_id = '55605f82-606b-46fe-87e0-a76809ddcab0'
  and e.museum_id = 'a1f597f7-44a2-44b2-9214-93364c2a12ff'
  and e.access_profile = 'gerente_museografica'
on conflict (museum_id, user_id, permission_id) do nothing;
