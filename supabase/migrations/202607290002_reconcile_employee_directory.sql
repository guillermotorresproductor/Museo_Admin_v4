-- Reconcile existing employee records with authenticated profiles.
-- An authenticated profile is not automatically an employee: employment
-- remains an explicit organizational relationship.
-- Preserve unattached sample employees as inactive demonstration records.

do $$
begin
  -- Recover missing display names only when Auth contains a valid human name.
  update public.profiles p
     set full_name = metadata.resolved_name,
         updated_at = now()
    from (
      select
        u.id,
        coalesce(
          nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
          nullif(btrim(u.raw_user_meta_data ->> 'name'), '')
        ) as resolved_name
      from auth.users u
    ) metadata
   where p.id = metadata.id
     and metadata.resolved_name is not null
     and position('@' in metadata.resolved_name) = 0
     and (
       btrim(coalesce(p.full_name, '')) = ''
       or position('@' in p.full_name) > 0
       or p.full_name = 'Usuario Institucional'
     );

  -- Link only employee records that already represent an employment
  -- relationship and share the authenticated profile's institutional email.
  update public.employees e
     set profile_id = p.id,
         auth_user_id = p.id,
         access_level = p.role,
         status = case when p.status = 'active' then 'activo' else 'inactivo' end,
         updated_at = now()
    from public.profiles p
   where e.museum_id = p.museum_id
     and lower(e.email) = lower(p.email)
     and (e.profile_id is null or e.profile_id = p.id)
     and (e.auth_user_id is null or e.auth_user_id = p.id);

  update public.employees
     set position = 'Empleado de ejemplo',
         department = 'Demostración',
         status = 'inactivo',
         updated_at = now()
   where lower(first_name) in ('joaquín', 'joaquin')
     and lower(last_name) in ('hernández', 'hernandez')
     and auth_user_id is null;
end
$$;
