-- Compensation history for the HR screen.
-- A repeated effective_from is rejected. It does not replace or alter any other row.
-- standard_hours_week is inherited from the previous version when the new call omits it.

create or replace function public.get_employee_compensation(p_employee_id uuid, p_on date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  museum uuid := public.current_user_museum_id();
  on_date date;
begin
  if auth.uid() is null or museum is null or not public.has_permission('compensation.read') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.employees e
    where e.id = p_employee_id and e.museum_id = museum
  ) then
    raise exception 'EMPLOYEE_NOT_FOUND' using errcode = 'P0001';
  end if;
  on_date := coalesce(p_on, (now() at time zone 'America/Puerto_Rico')::date);
  return public.resolve_employee_compensation(museum, p_employee_id, on_date);
end
$$;

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
language plpgsql
security definer
set search_path = ''
as $$
declare
  museum uuid := public.current_user_museum_id();
  employee_profile uuid;
  previous jsonb;
  saved public.employee_compensation;
  hours numeric := p_standard_hours_week;
  actor_column text;
begin
  if auth.uid() is null or museum is null or not public.has_permission('compensation.manage') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_effective_from is null then
    raise exception 'EFFECTIVE_FROM_REQUIRED' using errcode = 'P0001';
  end if;
  if p_compensation_type not in ('unconfigured', 'hourly', 'salary', 'commission', 'mixed', 'stipend', 'other') then
    raise exception 'INVALID_COMPENSATION_TYPE' using errcode = '22023';
  end if;
  select e.profile_id into employee_profile
  from public.employees e
  where e.id = p_employee_id and e.museum_id = museum;
  if not found then
    raise exception 'EMPLOYEE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if employee_profile = auth.uid() then
    raise exception 'SELF_COMPENSATION_FORBIDDEN' using errcode = 'P0001';
  end if;
  if hours is not null and (hours < 0 or hours > 168) then
    raise exception 'INVALID_STANDARD_HOURS' using errcode = '22023';
  end if;

  previous := public.resolve_employee_compensation(museum, p_employee_id, p_effective_from - 1);
  if hours is null and previous is not null then
    hours := nullif(previous->>'standard_hours_week', '')::numeric;
  end if;

  insert into public.employee_compensation (
    museum_id, employee_id, compensation_type, hourly_rate, salary_amount, salary_period, pay_frequency,
    standard_hours_week, overtime_eligible, bonus_type, bonus_amount, bonus_percent, other_description,
    effective_from, created_by, updated_by
  ) values (
    museum, p_employee_id, p_compensation_type, p_hourly_rate, p_salary_amount,
    nullif(p_salary_period, ''), nullif(p_pay_frequency, ''),
    hours, coalesce(p_overtime_eligible, true), nullif(p_bonus_type, ''),
    p_bonus_amount, p_bonus_percent, nullif(p_other_description, ''),
    p_effective_from, auth.uid(), auth.uid()
  ) returning * into saved;

  select a.attname into actor_column
  from pg_attribute a
  where a.attrelid = 'public.audit_logs'::regclass
    and a.attname in ('user_id', 'actor_user_id')
    and not a.attisdropped
  order by case a.attname when 'actor_user_id' then 0 else 1 end
  limit 1;
  if actor_column is not null then
    execute format(
      'insert into public.audit_logs (museum_id, %I, action, table_name, record_id, old_value, new_value)
       values ($1, $2, $3, $4, $5, $6, $7)',
      actor_column
    ) using museum, auth.uid(), 'EMPLOYEE_COMPENSATION_CREATED', 'employee_compensation', saved.id,
      case when previous is null then null else jsonb_build_object(
        'employee_id', previous->>'employee_id',
        'effective_from', previous->>'effective_from',
        'compensation_type', previous->>'compensation_type',
        'hourly_rate', previous->>'hourly_rate',
        'standard_hours_week', previous->>'standard_hours_week'
      ) end,
      jsonb_build_object(
        'operation', 'create',
        'employee_id', p_employee_id,
        'effective_from', saved.effective_from,
        'compensation_type', saved.compensation_type,
        'hourly_rate', saved.hourly_rate,
        'salary_amount', saved.salary_amount,
        'standard_hours_week', saved.standard_hours_week
      );
  end if;

  return to_jsonb(saved);
exception
  when unique_violation then
    raise exception 'Ya existe una compensación para esa fecha de vigencia.' using errcode = 'P0001';
end
$$;

revoke all on function public.get_employee_compensation(uuid, date) from public, anon;
revoke all on function public.save_employee_compensation(uuid, text, numeric, numeric, text, text, numeric, boolean, text, numeric, numeric, text, date) from public, anon;
revoke all on function public.resolve_employee_compensation(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.get_employee_compensation(uuid, date) to authenticated;
grant execute on function public.save_employee_compensation(uuid, text, numeric, numeric, text, text, numeric, boolean, text, numeric, numeric, text, date) to authenticated;

create or replace function public.save_employee_sensitive_details(
  target_employee_id uuid,
  compensation jsonb,
  emergency_contact jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_museum uuid;
  actor uuid := auth.uid();
  emergency_id uuid;
begin
  if actor is null
     or not public.has_permission('compensation.manage')
     or not public.has_permission('emergency_contact.manage') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  select e.museum_id into target_museum
  from public.employees e
  where e.id = target_employee_id and e.museum_id = public.current_user_museum_id();
  if target_museum is null then
    raise exception 'employee_not_found' using errcode = 'P0001';
  end if;

  insert into public.employee_emergency_contacts (
    employee_id, museum_id, full_name, relationship, primary_phone, alternate_phone, email, notes, updated_by, updated_at
  ) values (
    target_employee_id, target_museum,
    coalesce(emergency_contact->>'full_name', ''),
    nullif(emergency_contact->>'relationship', ''),
    nullif(emergency_contact->>'primary_phone', ''),
    nullif(emergency_contact->>'alternate_phone', ''),
    nullif(emergency_contact->>'email', ''),
    nullif(emergency_contact->>'notes', ''),
    actor, now()
  )
  on conflict (employee_id) do update set
    full_name = excluded.full_name,
    relationship = excluded.relationship,
    primary_phone = excluded.primary_phone,
    alternate_phone = excluded.alternate_phone,
    email = excluded.email,
    notes = excluded.notes,
    updated_by = actor,
    updated_at = now()
  returning employee_id into emergency_id;

  insert into public.audit_logs (museum_id, actor_user_id, action, table_name, record_id, old_value, new_value)
  values (
    target_museum, actor, 'UPDATE_SENSITIVE_EMPLOYEE_DETAILS', 'employee_sensitive_details', target_employee_id,
    null, jsonb_build_object('compensation_updated', false, 'emergency_contact_updated', true)
  );
  return jsonb_build_object('employee_id', target_employee_id, 'saved', true, 'compensation_updated', false);
end
$$;

create or replace function public.prevent_employee_compensation_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'COMPENSATION_HISTORY_IMMUTABLE' using errcode = 'P0001';
end
$$;

drop trigger if exists employee_compensation_no_update_delete on public.employee_compensation;
create trigger employee_compensation_no_update_delete
before update or delete on public.employee_compensation
for each row execute function public.prevent_employee_compensation_mutation();

revoke all on public.employee_compensation from public, anon, authenticated;
grant select on public.employee_compensation to authenticated;

notify pgrst, 'reload schema';
