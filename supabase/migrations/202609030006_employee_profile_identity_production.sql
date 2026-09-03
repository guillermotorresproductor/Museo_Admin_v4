-- Align employee identity policies with the existing profiles relation.
-- It does not create, update, or delete employee records.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'profile_id'
  ) then
    raise exception 'public.employees.profile_id is required';
  end if;
end
$$;

drop policy if exists employees_select on public.employees;
alter table public.employees enable row level security;
grant select, insert, update on public.employees to authenticated;
revoke delete on public.employees from authenticated;

create policy employees_select on public.employees
for select to authenticated
using (
  museum_id = public.current_user_museum_id()
  and (public.has_permission('employees.read.all') or profile_id = auth.uid())
);

drop policy if exists employees_insert on public.employees;
create policy employees_insert on public.employees
for insert to authenticated
with check (
  museum_id = public.current_user_museum_id()
  and public.has_permission('employees.create')
);

drop policy if exists employees_update on public.employees;
create policy employees_update on public.employees
for update to authenticated
using (
  museum_id = public.current_user_museum_id()
  and (public.has_permission('employees.update.basic') or profile_id = auth.uid())
)
with check (museum_id = public.current_user_museum_id());

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
  if new.photo_url like 'data:%' then
    raise exception 'Employee photos must use private Storage' using errcode = '22023';
  end if;
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists employees_protect_sensitive on public.employees;
create trigger employees_protect_sensitive
before update on public.employees
for each row execute function public.protect_employee_sensitive_fields();

create or replace function public.audit_employee_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (
    museum_id, user_id, action, table_name, record_id, old_value, new_value
  ) values (
    coalesce(new.museum_id, old.museum_id),
    auth.uid(),
    tg_op,
    'employees',
    coalesce(new.id, old.id),
    case when tg_op = 'INSERT' then null else to_jsonb(old) - 'medical_condition' end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) - 'medical_condition' end
  );
  return coalesce(new, old);
end
$$;

drop trigger if exists employees_audit on public.employees;

drop policy if exists employee_private_read on storage.objects;
create policy employee_private_read on storage.objects
for select to authenticated
using (
  bucket_id = 'employee-private'
  and (storage.foldername(name))[1] = public.current_user_museum_id()::text
  and (
    public.has_permission('employees.read.all')
    or exists (
      select 1
      from public.employees e
      where e.profile_id = auth.uid()
        and e.museum_id = public.current_user_museum_id()
        and e.id::text = (storage.foldername(name))[2]
    )
  )
);

create trigger employees_audit
after insert or update or delete on public.employees
for each row execute function public.audit_employee_changes();
