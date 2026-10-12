-- Names of active employees for the equipment registration form.
-- The caller's museum comes from the authenticated profile. No client parameter.
-- Does not widen the employee directory and does not change employee policies.

begin;

create or replace function public.inventory_active_employee_names()
returns table (full_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_museum_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authorized to list inventory responsibles.' using errcode = '42501';
  end if;

  select pr.museum_id into v_museum_id
  from public.profiles pr
  where pr.id = auth.uid()
    and pr.status in ('active', 'activo');
  if v_museum_id is null then
    raise exception 'Not authorized to list inventory responsibles.' using errcode = '42501';
  end if;

  if not (public.has_permission('inventory.manage') or public.has_permission('inventory.create')) then
    raise exception 'Not authorized to list inventory responsibles.' using errcode = '42501';
  end if;

  return query
  select names.full_name
  from (
    select distinct btrim(concat_ws(' ', nullif(btrim(e.first_name), ''), nullif(btrim(e.last_name), ''))) as full_name
    from public.employees e
    where e.museum_id = v_museum_id
      and e.status = 'activo'
  ) names
  where names.full_name <> ''
  order by names.full_name;
end;
$$;

revoke all on function public.inventory_active_employee_names() from public, anon;
grant execute on function public.inventory_active_employee_names() to authenticated;

commit;
