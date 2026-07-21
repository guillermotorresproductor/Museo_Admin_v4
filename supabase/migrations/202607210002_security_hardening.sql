create or replace function public.current_user_permissions()
returns table(code text)
language sql stable security definer set search_path='' as $$
  select distinct p.code
  from public.permissions p
  where public.has_permission(p.code)
  order by p.code
$$;
grant execute on function public.current_user_permissions() to authenticated;

create or replace function public.protect_profile_security_fields()
returns trigger language plpgsql set search_path='' as $$
begin
  if auth.uid() is not null and auth.role() <> 'service_role' then
    if new.id <> old.id or new.museum_id <> old.museum_id or new.role <> old.role or new.status <> old.status then
      raise exception 'Security fields must be changed by an authorized server function' using errcode='42501';
    end if;
  end if;
  new.updated_at=now();
  return new;
end $$;
create trigger profiles_protect_security before update on public.profiles for each row execute function public.protect_profile_security_fields();

create or replace function public.protect_employee_sensitive_fields()
returns trigger language plpgsql set search_path='' as $$
begin
  if auth.uid() is not null and auth.role() <> 'service_role' then
    if new.museum_id <> old.museum_id or new.auth_user_id is distinct from old.auth_user_id or new.profile_id is distinct from old.profile_id then
      raise exception 'Identity links must be changed by an authorized server function' using errcode='42501';
    end if;
    if new.access_level is distinct from old.access_level and not public.has_permission('roles.assign') then
      raise exception 'Access is managed through RBAC' using errcode='42501';
    end if;
    if new.medical_condition is distinct from old.medical_condition and not public.has_permission('employees.medical.write') then
      raise exception 'Medical data requires a dedicated permission' using errcode='42501';
    end if;
  end if;
  if new.photo_url like 'data:%' then
    raise exception 'Employee photos must use private Storage' using errcode='22023';
  end if;
  new.updated_at=now();
  return new;
end $$;
create trigger employees_protect_sensitive before update on public.employees for each row execute function public.protect_employee_sensitive_fields();

revoke delete on public.employees from authenticated;
revoke insert,update,delete on public.roles,public.permissions,public.role_permissions,public.user_roles,public.user_permissions from authenticated;
revoke insert,update,delete on public.audit_logs from authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('employee-private','employee-private',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy employee_private_read on storage.objects for select to authenticated using(
 bucket_id='employee-private' and (storage.foldername(name))[1]=public.current_user_museum_id()::text and
 (public.has_permission('employees.read.all') or exists(select 1 from public.employees e where e.auth_user_id=auth.uid() and e.museum_id=public.current_user_museum_id() and e.id::text=(storage.foldername(name))[2]))
);
create policy employee_private_insert on storage.objects for insert to authenticated with check(
 bucket_id='employee-private' and (storage.foldername(name))[1]=public.current_user_museum_id()::text and public.has_permission('employees.update.basic')
);
create policy employee_private_update on storage.objects for update to authenticated using(
 bucket_id='employee-private' and (storage.foldername(name))[1]=public.current_user_museum_id()::text and public.has_permission('employees.update.basic')
) with check(bucket_id='employee-private' and (storage.foldername(name))[1]=public.current_user_museum_id()::text);