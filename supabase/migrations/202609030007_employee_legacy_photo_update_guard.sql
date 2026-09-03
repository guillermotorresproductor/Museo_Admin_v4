-- Allow unrelated employee updates when a legacy inline photo already exists.
-- New or changed inline photos remain prohibited.
create or replace function public.protect_employee_sensitive_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.role() <> 'service_role' then
    if new.museum_id <> old.museum_id or new.profile_id is distinct from old.profile_id then
      raise exception 'Identity links must be changed by an authorized server function' using errcode = '42501';
    end if;
    if new.access_level is distinct from old.access_level and not public.has_permission('roles.assign') then
      raise exception 'Access is managed through RBAC' using errcode = '42501';
    end if;
    if new.medical_condition is distinct from old.medical_condition and not public.has_permission('employees.medical.write') then
      raise exception 'Medical data requires a dedicated permission' using errcode = '42501';
    end if;
  end if;
  if new.photo_url is distinct from old.photo_url and new.photo_url like 'data:%' then
    raise exception 'Employee photos must use private Storage' using errcode = '22023';
  end if;
  new.updated_at = now();
  return new;
end
$$;
