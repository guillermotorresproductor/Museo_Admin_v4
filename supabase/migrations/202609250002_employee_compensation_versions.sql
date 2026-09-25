-- Historical employee compensation. One row is one effective date.
-- Does not install 202607210006. Does not grant pay access by administrator role.
-- Production had no employee_compensation rows, so nothing is copied or backdated.

insert into public.permissions(code, description, sensitivity) values
  ('compensation.read', 'Consultar la compensación de los empleados del museo', 'critical'),
  ('compensation.manage', 'Establecer una nueva vigencia de compensación', 'critical')
on conflict (code) do update set description = excluded.description, sensitivity = excluded.sensitivity;

do $role_grant_cleanup$
begin
  if to_regclass('public.role_permissions') is null then
    return;
  end if;
  execute $cleanup$
    delete from public.role_permissions rp
    using public.permissions p
    where rp.permission_id = p.id
      and p.code in ('compensation.read', 'compensation.manage')
  $cleanup$;
end
$role_grant_cleanup$;

do $patch$
declare src text; patched text; pos integer;
  grant_sql text := $grant$
 -- employee_compensation_access
 if requested_permission in ('compensation.read', 'compensation.manage')
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
 if requested_permission in ('compensation.read', 'compensation.manage')
    and exists(
      select 1 from public.profiles pr
      where pr.id = auth.uid()
        and pr.museum_id = public.current_user_museum_id()
        and pr.status in ('active','activo')
    )
    and public.current_employee_module_profile() in ('director_ejecutivo','gerente_administrativo') then
   return true;
 end if;
$grant$;
begin
  src := pg_get_functiondef('public.has_permission(text)'::regprocedure);
  if position('employee_compensation_access' in src) > 0 then
    return;
  end if;
  pos := position(E'\nbegin' in src);
  if pos = 0 then raise exception 'HAS_PERMISSION_PATCH_FAILED'; end if;
  patched := overlay(src placing E'\nbegin' || grant_sql from pos for 6);
  if patched = src or position('employee_compensation_access' in patched) = 0 then
    raise exception 'HAS_PERMISSION_PATCH_FAILED';
  end if;
  execute patched;
end
$patch$;

create table public.employee_compensation (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  compensation_type text not null default 'unconfigured' check (compensation_type in ('unconfigured','hourly','salary','commission','mixed','stipend','other')),
  hourly_rate numeric(12,2) check (hourly_rate is null or hourly_rate >= 0),
  salary_amount numeric(12,2) check (salary_amount is null or salary_amount >= 0),
  salary_period text check (salary_period is null or salary_period in ('weekly','biweekly','semimonthly','monthly','annual')),
  pay_frequency text check (pay_frequency is null or pay_frequency in ('weekly','biweekly','semimonthly','monthly')),
  standard_hours_week numeric(5,2) check (standard_hours_week is null or standard_hours_week between 0 and 168),
  overtime_eligible boolean not null default true,
  bonus_type text check (bonus_type is null or bonus_type in ('fixed','percentage','discretionary','statutory','none')),
  bonus_amount numeric(12,2) check (bonus_amount is null or bonus_amount >= 0),
  bonus_percent numeric(7,4) check (bonus_percent is null or bonus_percent between 0 and 100),
  other_description text,
  effective_from date not null,
  currency text not null default 'USD' check (currency = 'USD'),
  intuit_employee_id text,
  sync_status text not null default 'not_configured' check (sync_status in ('not_configured','pending','synced','error')),
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (museum_id, employee_id, effective_from)
);

create index employee_compensation_employee_date_idx
  on public.employee_compensation (museum_id, employee_id, effective_from desc);

alter table public.employee_compensation enable row level security;
revoke all on public.employee_compensation from public, anon, authenticated;
grant select on public.employee_compensation to authenticated;

create policy employee_compensation_read on public.employee_compensation
  for select to authenticated
  using (museum_id = public.current_user_museum_id() and public.has_permission('compensation.read'));

create or replace function public.prevent_employee_compensation_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'COMPENSATION_HISTORY_IMMUTABLE' using errcode = 'P0001';
end $$;

create trigger employee_compensation_no_update_delete
  before update or delete on public.employee_compensation
  for each row execute function public.prevent_employee_compensation_mutation();

create or replace function public.resolve_employee_compensation(p_museum_id uuid, p_employee_id uuid, p_on date)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(c) from public.employee_compensation c
  where c.museum_id = p_museum_id and c.employee_id = p_employee_id and c.effective_from <= p_on
  order by c.effective_from desc
  limit 1;
$$;

revoke all on function public.resolve_employee_compensation(uuid, uuid, date) from public, anon, authenticated;

create or replace function public.get_employee_compensation(p_employee_id uuid, p_on date default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare museum uuid := public.current_user_museum_id(); on_date date;
begin
  if auth.uid() is null or museum is null or not public.has_permission('compensation.read') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.employees e where e.id = p_employee_id and e.museum_id = museum) then
    raise exception 'EMPLOYEE_NOT_FOUND' using errcode = 'P0001';
  end if;
  on_date := coalesce(p_on, (now() at time zone 'America/Puerto_Rico')::date);
  return public.resolve_employee_compensation(museum, p_employee_id, on_date);
end $$;

create or replace function public.save_employee_compensation(
  p_employee_id uuid,
  p_compensation_type text,
  p_hourly_rate numeric,
  p_salary_amount numeric,
  p_salary_period text,
  p_pay_frequency text,
  p_standard_hours_week numeric,
  p_overtime_eligible boolean,
  p_bonus_type text,
  p_bonus_amount numeric,
  p_bonus_percent numeric,
  p_other_description text,
  p_effective_from date
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  museum uuid := public.current_user_museum_id();
  employee_profile uuid;
  previous jsonb;
  saved public.employee_compensation;
begin
  if auth.uid() is null or museum is null or not public.has_permission('compensation.manage') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_effective_from is null then raise exception 'EFFECTIVE_FROM_REQUIRED' using errcode = 'P0001'; end if;
  if p_compensation_type not in ('unconfigured','hourly','salary','commission','mixed','stipend','other') then
    raise exception 'INVALID_COMPENSATION_TYPE' using errcode = '22023';
  end if;
  select e.profile_id into employee_profile from public.employees e where e.id = p_employee_id and e.museum_id = museum;
  if not found then raise exception 'EMPLOYEE_NOT_FOUND' using errcode = 'P0001'; end if;
  if employee_profile = auth.uid() then raise exception 'SELF_COMPENSATION_FORBIDDEN' using errcode = 'P0001'; end if;
  previous := public.resolve_employee_compensation(museum, p_employee_id, p_effective_from - 1);
  insert into public.employee_compensation(
    museum_id, employee_id, compensation_type, hourly_rate, salary_amount, salary_period, pay_frequency,
    standard_hours_week, overtime_eligible, bonus_type, bonus_amount, bonus_percent, other_description,
    effective_from, created_by, updated_by
  ) values (
    museum, p_employee_id, p_compensation_type, p_hourly_rate, p_salary_amount, nullif(p_salary_period,''), nullif(p_pay_frequency,''),
    p_standard_hours_week, coalesce(p_overtime_eligible, true), nullif(p_bonus_type,''), p_bonus_amount, p_bonus_percent, nullif(p_other_description,''),
    p_effective_from, auth.uid(), auth.uid()
  ) returning * into saved;
  insert into public.audit_logs(museum_id, user_id, action, table_name, record_id, old_value, new_value)
  values (museum, auth.uid(), 'EMPLOYEE_COMPENSATION_CREATED', 'employee_compensation', saved.id, previous,
    jsonb_build_object('employee_id', p_employee_id, 'compensation_type', saved.compensation_type, 'hourly_rate', saved.hourly_rate,
      'salary_amount', saved.salary_amount, 'salary_period', saved.salary_period, 'effective_from', saved.effective_from));
  return to_jsonb(saved);
exception when unique_violation then
  raise exception 'COMPENSATION_DATE_EXISTS' using errcode = 'P0001';
end $$;

revoke all on function public.get_employee_compensation(uuid, date) from public, anon;
revoke all on function public.save_employee_compensation(uuid, text, numeric, numeric, text, text, numeric, boolean, text, numeric, numeric, text, date) from public, anon;
grant execute on function public.get_employee_compensation(uuid, date) to authenticated;
grant execute on function public.save_employee_compensation(uuid, text, numeric, numeric, text, text, numeric, boolean, text, numeric, numeric, text, date) to authenticated;
