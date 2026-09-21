-- Focused capability for Museology. No role/account backfill or data changes.
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
 -- Evaluate after active identity, explicit denials and museum/module boundary.
 if chosen='gerente_museografica' and requested_permission='collections.write' then return true; end if;
 if requested_permission='modules.'||target_module||'.read'
   or requested_permission in ('collections.read','announcements.read') then return true; end if;
 return public.module_profile_base_permission(requested_permission);
end $$;
-- The legacy permissive policy only accepts administrative capabilities.
-- Permit collection writers to insert receipts; existing restrictive policies
-- and museum ownership checks continue to apply. No UPDATE/DELETE grant.
create policy loan_receipt_catalog_insert on public.app_records for insert to authenticated
with check (module='recibos_prestamo' and museum_id=public.current_user_museum_id()
 and created_by=auth.uid() and updated_by=auth.uid() and public.has_permission('collections.write'));
create policy loan_receipt_catalog_read on public.app_records for select to authenticated
using (module='recibos_prestamo' and museum_id=public.current_user_museum_id()
 and (public.has_permission('collections.read') or public.has_permission('collections.write')));
notify pgrst,'reload schema';
commit;
