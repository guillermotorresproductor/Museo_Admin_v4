-- Close legacy RLS rules that treat NULL employee module profile as an
-- unrestricted administrator. External accountants must NOT be treated as NULL.
-- Existing employees and other users keep the exact original resolution logic.
create or replace function public.current_employee_module_profile()
returns text language sql stable security definer set search_path to ''
as $function$
 select case
   when exists (
     select 1 from public.external_accountant_access ea
     where ea.user_id = auth.uid()
   ) then '__external_accountant__'
   else (
     select case
       when count(*)=1 then max(e.access_profile)
       when bool_or(e.access_profile is not null) then '__invalid_link__'
     end
     from public.employees e
     join public.profiles p on p.id=e.profile_id and p.museum_id=e.museum_id
     where p.id=auth.uid()
       and p.museum_id=public.current_user_museum_id()
   )
 end
$function$;
