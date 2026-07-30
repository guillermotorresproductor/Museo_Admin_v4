-- Reconcile authenticated profiles with the employee directory without
-- hard-coding tenant users or personal email addresses.
-- Preserve sample employees as explicitly inactive demonstration records.

do $$
declare
  account record;
  target_employee_id uuid;
  resolved_name text;
  resolved_first_name text;
  resolved_last_name text;
begin
  for account in
    select
      p.id,
      p.museum_id,
      p.email,
      p.role,
      p.full_name,
      coalesce(
        nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
        nullif(btrim(u.raw_user_meta_data ->> 'name'), '')
      ) as metadata_name
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.status = 'active'
  loop
    resolved_name := case
      when btrim(coalesce(account.full_name, '')) <> ''
        and position('@' in account.full_name) = 0
        then btrim(account.full_name)
      when btrim(coalesce(account.metadata_name, '')) <> ''
        and position('@' in account.metadata_name) = 0
        then btrim(account.metadata_name)
      else 'Usuario Institucional'
    end;

    resolved_first_name := split_part(resolved_name, ' ', 1);
    resolved_last_name := case
      when position(' ' in resolved_name) > 0
        then btrim(substring(resolved_name from position(' ' in resolved_name) + 1))
      else 'Institucional'
    end;

    update public.profiles
       set full_name = resolved_name,
           updated_at = now()
     where id = account.id
       and (
         btrim(coalesce(full_name, '')) = ''
         or position('@' in full_name) > 0
       );

    target_employee_id := null;
    select id
      into target_employee_id
    from public.employees
    where museum_id = account.museum_id
      and (
        auth_user_id = account.id
        or profile_id = account.id
        or lower(email) = lower(account.email)
      )
    order by
      case when auth_user_id = account.id then 0 else 1 end,
      case when profile_id = account.id then 0 else 1 end,
      created_at
    limit 1;

    if target_employee_id is null then
      insert into public.employees (
        museum_id,
        profile_id,
        auth_user_id,
        first_name,
        last_name,
        position,
        department,
        email,
        access_level,
        status
      )
      values (
        account.museum_id,
        account.id,
        account.id,
        resolved_first_name,
        resolved_last_name,
        '',
        '',
        account.email,
        account.role,
        'activo'
      );
    else
      update public.employees
         set profile_id = account.id,
             auth_user_id = account.id,
             first_name = case
               when btrim(first_name) = '' then resolved_first_name
               else first_name
             end,
             last_name = case
               when btrim(last_name) = '' then resolved_last_name
               else last_name
             end,
             email = account.email,
             access_level = account.role,
             status = 'activo',
             updated_at = now()
       where id = target_employee_id;
    end if;
  end loop;

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
