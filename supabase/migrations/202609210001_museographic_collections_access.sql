-- Grant only the operational Collections capability to the museographic profile.
-- Preserve module lists, technical roles, employee assignments and explicit denies.
begin;
create or replace function public.has_permission(requested_permission text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare chosen text:=public.current_employee_module_profile(); target_module text;
begin
 if chosen is null then return public.module_profile_base_permission(requested_permission); end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and status in ('active','activo')
   and museum_id=public.current_user_museum_id()) then return false; end if;
 if requested_permission='module_profiles.active' then return true; end if;
 if exists(select 1 from public.user_permissions u join public.permissions p on p.id=u.permission_id
   where u.user_id=auth.uid() and u.museum_id=public.current_user_museum_id() and p.code=requested_permission
   and u.effect='deny' and (u.valid_until is null or u.valid_until>now())) then return false; end if;
 target_module:=public.permission_module(requested_permission);
 if not exists(select 1 from public.employee_module_profiles where code=chosen and target_module=any(modules)) then return false; end if;
 -- Museographic management needs the catalog and loan receipt write capability.
 -- This follows the existing active-profile, module and explicit-deny checks.
 if chosen='gerente_museografica' and requested_permission='collections.write' then return true; end if;
 -- Other profiles and all other operations retain their prior behavior.
 if requested_permission='modules.'||target_module||'.read'
   or requested_permission in ('collections.read','announcements.read') then return true; end if;
 return public.module_profile_base_permission(requested_permission);
end $$;

commit;
