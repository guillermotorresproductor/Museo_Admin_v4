-- Monthly salary rehearsal. Rolls back. Does not keep employees, punches, or amounts.
begin;

create function pg_temp.payroll_complete_shift(
  p_museum uuid,
  p_employee uuid,
  p_actor uuid,
  p_shift uuid,
  p_start timestamptz,
  p_end timestamptz
) returns void
language plpgsql
as $$
declare
  suffix text := substring(p_shift::text from 25);
begin
  insert into public.employee_shifts (id, museum_id, employee_id, starts_at, ends_at, shift_date, status, created_by)
  values (p_shift, p_museum, p_employee, p_start, p_end, (p_start at time zone 'America/Puerto_Rico')::date, 'scheduled', p_actor);
  insert into public.attendance_attempts (id, museum_id, employee_id, shift_id, actor_user_id, requested_event, result)
  values
    (('c12a0000-0000-4000-8000-' || suffix)::uuid, p_museum, p_employee, p_shift, p_actor, 'clock_in', 'accepted'),
    (('c22a0000-0000-4000-8000-' || suffix)::uuid, p_museum, p_employee, p_shift, p_actor, 'clock_out', 'accepted');
  insert into public.attendance_events (id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by)
  values
    (('d12a0000-0000-4000-8000-' || suffix)::uuid, p_museum, p_employee, p_shift, ('c12a0000-0000-4000-8000-' || suffix)::uuid, 'clock_in', p_start, 'on_time', 1, p_actor),
    (('d22a0000-0000-4000-8000-' || suffix)::uuid, p_museum, p_employee, p_shift, ('c22a0000-0000-4000-8000-' || suffix)::uuid, 'clock_out', p_end, 'standard', 1, p_actor);
end
$$;

do $test$
declare
  actor uuid := 'ca3d0682-662b-4fb5-b859-8e150beb07e6';
  museum uuid;
  other_museum uuid;
  today date := (now() at time zone 'America/Puerto_Rico')::date;
  current_start date := date_trunc('month', today)::date;
  previous_start date := (current_start - interval '1 month')::date;
  next_start date := (current_start + interval '1 month')::date;
  previous_end date := (current_start - interval '1 day')::date;
  current_end date := (next_start - interval '1 day')::date;
  next_end date := (next_start + interval '1 month' - interval '1 day')::date;
  line_salary uuid := 'a12a0000-0000-4000-8000-000000000001';
  salaried uuid := 'e12a0000-0000-4000-8000-000000000001';
  punched uuid := 'e12a0000-0000-4000-8000-000000000002';
  hourly uuid := 'e12a0000-0000-4000-8000-000000000003';
  outsider uuid := 'e12a0000-0000-4000-8000-000000000004';
  changed uuid := 'e12a0000-0000-4000-8000-000000000005';
  hired uuid := 'e12a0000-0000-4000-8000-000000000006';
  incomplete uuid := 'e12a0000-0000-4000-8000-000000000007';
  weekly uuid := 'e12a0000-0000-4000-8000-000000000008';
  later_hire uuid := 'e12a0000-0000-4000-8000-000000000009';
  inactive uuid := 'e12a0000-0000-4000-8000-00000000000a';
  result jsonb;
  person jsonb;
  plaza jsonb;
  unchanged integer;
  shift_day date;
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);
  museum := public.current_user_museum_id();
  if museum is null then raise exception 'ACTOR_MUSEUM_MISSING'; end if;
  update public.museums
  set fiscal_year_start_month = 9
  where id = museum and fiscal_year_start_month is null;

  create temp table finance_snapshot as
  select id, amount from public.finance_records;

  insert into public.user_permissions (museum_id, user_id, permission_id, effect)
  select museum, actor, p.id, 'allow'
  from public.permissions p
  where p.code in ('compensation.read', 'compensation.manage', 'attendance.history.read')
  on conflict (museum_id, user_id, permission_id) do update set effect = 'allow';

  alter table public.employees disable trigger protect_employee_module_profile;
  update public.employees
  set access_profile = 'director_ejecutivo'
  where profile_id = actor and museum_id = museum;
  alter table public.employees enable trigger protect_employee_module_profile;

  select id into other_museum from public.museums where id <> museum limit 1;
  if other_museum is null then raise exception 'OTHER_MUSEUM_MISSING'; end if;

  insert into public.attendance_settings (museum_id, timezone, updated_by)
  values (museum, 'America/Puerto_Rico', actor)
  on conflict (museum_id) do update
  set timezone = 'America/Puerto_Rico'
  where nullif(trim(public.attendance_settings.timezone), '') is null;
  insert into public.attendance_settings (museum_id, timezone, updated_by)
  values (other_museum, 'America/Puerto_Rico', actor)
  on conflict (museum_id) do update
  set timezone = 'America/Puerto_Rico'
  where nullif(trim(public.attendance_settings.timezone), '') is null;

  insert into public.finance_budget_lines (id, museum_id, record_type, category, name, sort_order, counts_in_operating_balance)
  values (line_salary, museum, 'expense', 'Nómina', 'Plaza Sueldo Mensual Prueba', 9101, true);
  insert into public.finance_records (museum_id, budget_line_id, month, year, amount)
  values (
    museum,
    line_salary,
    (array['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'])[extract(month from current_start)::integer],
    case when extract(month from current_start)::integer >= 9 then extract(year from current_start)::integer else extract(year from current_start)::integer - 1 end,
    4000
  );

  insert into public.employees (id, museum_id, first_name, last_name, position, department, email, status, hire_date)
  values
    (salaried, museum, 'Sueldo', 'Mensual', 'Director', 'Dirección', 'payroll-monthly-salaried@example.invalid', 'activo', previous_start),
    (punched, museum, 'Sueldo', 'ConPonche', 'Gerencia', 'Dirección', 'payroll-monthly-punched@example.invalid', 'activo', previous_start),
    (hourly, museum, 'Por', 'Hora', 'Guía', 'Experiencia', 'payroll-monthly-hourly@example.invalid', 'activo', previous_start),
    (outsider, other_museum, 'Otro', 'Museo', 'Director', 'Dirección', 'payroll-monthly-outsider@example.invalid', 'activo', previous_start),
    (inactive, museum, 'Inactivo', 'Mensual', 'Director', 'Dirección', 'payroll-monthly-inactive@example.invalid', 'inactivo', previous_start),
    (later_hire, museum, 'Contrato', 'Futuro', 'Director', 'Dirección', 'payroll-monthly-later@example.invalid', 'activo', next_start);

  insert into public.employee_compensation (
    museum_id, employee_id, compensation_type, salary_amount, salary_period, effective_from, created_by, updated_by
  ) values
    (museum, salaried, 'salary', 3333.33, 'monthly', previous_start, actor, actor),
    (museum, inactive, 'salary', 1111.11, 'monthly', previous_start, actor, actor),
    (museum, later_hire, 'salary', 2222.22, 'monthly', previous_start, actor, actor),
    (other_museum, outsider, 'salary', 9999.99, 'monthly', previous_start, actor, actor);
  insert into public.employee_compensation (
    museum_id, employee_id, compensation_type, hourly_rate, salary_amount, salary_period, effective_from, created_by, updated_by
  ) values
    (museum, punched, 'salary', 18, 2500.50, 'monthly', previous_start, actor, actor),
    (museum, hourly, 'hourly', 18, null, null, previous_start, actor, actor);

  perform public.assign_employee_budget_line(salaried, line_salary, previous_start);

  shift_day := previous_start + 2;
  perform pg_temp.payroll_complete_shift(
    museum, punched, actor, 'b12a0000-0000-4000-8000-000000000001',
    (shift_day::text || ' 08:00:00-04')::timestamptz,
    (shift_day::text || ' 16:00:00-04')::timestamptz
  );
  perform pg_temp.payroll_complete_shift(
    museum, hourly, actor, 'b12a0000-0000-4000-8000-000000000002',
    (shift_day::text || ' 08:00:00-04')::timestamptz,
    (shift_day::text || ' 16:00:00-04')::timestamptz
  );
  shift_day := current_start + 2;
  perform pg_temp.payroll_complete_shift(
    museum, punched, actor, 'b12a0000-0000-4000-8000-000000000003',
    (shift_day::text || ' 08:00:00-04')::timestamptz,
    (shift_day::text || ' 16:00:00-04')::timestamptz
  );

  result := public.payroll_actual(current_start, current_end);
  if result::text like '%' || outsider::text || '%' then
    raise exception 'OTHER_MUSEUM_VISIBLE';
  end if;
  select value into person from jsonb_array_elements(result->'employees') value where value->>'employee_id' = salaried::text;
  if person is null
     or (person->>'actual_amount')::numeric is distinct from 3333.33
     or (person->>'worked_minutes')::integer is distinct from 0
     or person->>'state' is distinct from 'CALCULADA'
     or jsonb_array_length(person->'days') is distinct from 0 then
    raise exception 'ZERO_PUNCH_MONTH_MISMATCH %', person;
  end if;
  select value into plaza from jsonb_array_elements(result->'plazas') value where value->>'budget_line_id' = line_salary::text;
  if plaza is null or (plaza->>'actual_amount')::numeric is distinct from 3333.33 then
    raise exception 'PLAZA_SALARY_MISMATCH %', plaza;
  end if;
  if (select sum((value->>'actual_amount')::numeric) from jsonb_array_elements(result->'employees') value where value->>'employee_id' in (salaried::text, punched::text, inactive::text))
     is distinct from (
       coalesce((plaza->>'actual_amount')::numeric, 0)
       + coalesce((select (value->>'actual_amount')::numeric from jsonb_array_elements(result->'unassigned'->'employees') value where value->>'employee_id' = punched::text), 0)
       + coalesce((select (value->>'actual_amount')::numeric from jsonb_array_elements(result->'unassigned'->'employees') value where value->>'employee_id' = inactive::text), 0)
     ) then
    raise exception 'SALARY_TOTAL_NOT_CONSISTENT';
  end if;

  select value into person from jsonb_array_elements(result->'employees') value where value->>'employee_id' = punched::text;
  if person is null
     or (person->>'actual_amount')::numeric is distinct from 2500.50
     or (person->>'worked_minutes')::integer is distinct from 480 then
    raise exception 'PUNCHED_SALARY_DOUBLED %', person;
  end if;
  select value into person from jsonb_array_elements(result->'employees') value where value->>'employee_id' = hourly::text;
  if person is not null then
    raise exception 'HOURLY_LEAKED_INTO_OTHER_MONTH %', person;
  end if;
  -- Observed behavior only. status is a current flag, and terminated_at is not a pay date.
  -- This is not approval to pay months after a departure. The executive summary must block.
  select value into person from jsonb_array_elements(result->'employees') value where value->>'employee_id' = inactive::text;
  if person is null
     or (person->>'actual_amount')::numeric is distinct from 1111.11
     or person->>'employment_status' is distinct from 'inactivo' then
    raise exception 'INACTIVE_STATUS_MISMATCH %', person;
  end if;
  select value into person from jsonb_array_elements(result->'employees') value where value->>'employee_id' = later_hire::text;
  if person is not null then
    raise exception 'FUTURE_HIRE_PAID %', person;
  end if;

  result := public.payroll_actual(previous_start, previous_end);
  select value into person from jsonb_array_elements(result->'employees') value where value->>'employee_id' = salaried::text;
  if person is null or (person->>'actual_amount')::numeric is distinct from 3333.33 then
    raise exception 'PREVIOUS_FULL_MONTH_MISMATCH %', person;
  end if;
  select value into person from jsonb_array_elements(result->'employees') value where value->>'employee_id' = hourly::text;
  if person is null
     or (person->>'actual_amount')::numeric is distinct from 144
     or (person->>'hourly_rate')::numeric is distinct from 18
     or (person->>'worked_minutes')::integer is distinct from 480 then
    raise exception 'HOURLY_REGRESSION %', person;
  end if;

  result := public.payroll_actual(previous_start, current_end);
  select value into person from jsonb_array_elements(result->'employees') value where value->>'employee_id' = salaried::text;
  if person is null or (person->>'actual_amount')::numeric is distinct from 6666.66 then
    raise exception 'TWO_MONTHS_DUPLICATED %', person;
  end if;
  select value into person from jsonb_array_elements(result->'employees') value where value->>'employee_id' = punched::text;
  if person is null or (person->>'actual_amount')::numeric is distinct from 5001.00 then
    raise exception 'PUNCHED_TWO_MONTHS_DOUBLED %', person;
  end if;

  result := public.payroll_actual(previous_start, next_end);
  select value into person from jsonb_array_elements(result->'employees') value where value->>'employee_id' = salaried::text;
  if person is null or (person->>'actual_amount')::numeric is distinct from 6666.66 then
    raise exception 'FUTURE_MONTH_COUNTED %', person;
  end if;

  result := public.payroll_actual(next_start, next_end);
  select value into person from jsonb_array_elements(result->'employees') value where value->>'employee_id' = salaried::text;
  if person is not null and (person->>'actual_amount')::numeric is distinct from 0 then
    raise exception 'FUTURE_ONLY_MONTH_PAID %', person;
  end if;

  result := public.payroll_actual(current_start, current_start + 14);
  select value into person from jsonb_array_elements(result->'employees') value where value->>'employee_id' = salaried::text;
  if person is not null and (
       (person->>'actual_amount')::numeric is distinct from 0
       or person->>'state' is distinct from 'PERIODO PARCIAL'
     ) then
    raise exception 'PARTIAL_MONTH_INVENTED %', person;
  end if;
  select value into person from jsonb_array_elements(result->'employees') value where value->>'employee_id' = punched::text;
  if person is null
     or person->>'state' is distinct from 'PERIODO PARCIAL'
     or (person->>'actual_amount')::numeric is distinct from 0
     or (person->>'worked_minutes')::integer is distinct from 480 then
    raise exception 'PARTIAL_PERIOD_MISMATCH %', person;
  end if;
  select value into person from jsonb_array_elements(result->'employees') value where value->>'employee_id' = hourly::text;
  if person is not null and (person->>'actual_amount')::numeric is distinct from 0 then
    raise exception 'HOURLY_PARTIAL_UNEXPECTED %', person;
  end if;

  insert into public.employees (id, museum_id, first_name, last_name, position, department, email, status, hire_date)
  values (changed, museum, 'Cambio', 'Mitad', 'Director', 'Dirección', 'payroll-monthly-changed@example.invalid', 'activo', previous_start);
  insert into public.employee_compensation (
    museum_id, employee_id, compensation_type, salary_amount, salary_period, effective_from, created_by, updated_by
  ) values
    (museum, changed, 'salary', 1000.00, 'monthly', previous_start, actor, actor),
    (museum, changed, 'salary', 1800.00, 'monthly', previous_start + 14, actor, actor);
  begin
    perform public.payroll_actual(previous_start, previous_end);
    raise exception 'CHANGE_SHOULD_FAIL';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%SALARY_CHANGE_UNDEFINED%' then raise; end if;
  end;

  insert into public.employees (id, museum_id, first_name, last_name, position, department, email, status, hire_date)
  values (hired, museum, 'Alta', 'Mitad', 'Director', 'Dirección', 'payroll-monthly-hired@example.invalid', 'activo', current_start + 10);
  insert into public.employee_compensation (
    museum_id, employee_id, compensation_type, salary_amount, salary_period, effective_from, created_by, updated_by
  ) values (museum, hired, 'salary', 1500.00, 'monthly', previous_start, actor, actor);
  begin
    perform public.payroll_actual(current_start, current_end);
    raise exception 'HIRE_SHOULD_FAIL';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%SALARY_HIRE_DATE_PARTIAL%' then raise; end if;
  end;

  insert into public.employees (id, museum_id, first_name, last_name, position, department, email, status, hire_date)
  values (weekly, museum, 'Sueldo', 'Semanal', 'Director', 'Dirección', 'payroll-monthly-weekly@example.invalid', 'activo', previous_start - interval '1 month');
  insert into public.employee_compensation (
    museum_id, employee_id, compensation_type, salary_amount, salary_period, effective_from, created_by, updated_by
  ) values (museum, weekly, 'salary', 400.00, 'weekly', (previous_start - interval '1 month')::date, actor, actor);
  begin
    perform public.payroll_actual((previous_start - interval '1 month')::date, (previous_start - interval '1 day')::date);
    raise exception 'WEEKLY_SHOULD_FAIL';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%SALARY_PERIOD_UNSUPPORTED%' then raise; end if;
  end;

  insert into public.employees (id, museum_id, first_name, last_name, position, department, email, status, hire_date)
  values (incomplete, museum, 'Sin', 'Importe', 'Director', 'Dirección', 'payroll-monthly-incomplete@example.invalid', 'activo', previous_start - interval '2 months');
  insert into public.employee_compensation (
    museum_id, employee_id, compensation_type, salary_amount, salary_period, effective_from, created_by, updated_by
  ) values (museum, incomplete, 'salary', null, 'monthly', (previous_start - interval '2 months')::date, actor, actor);
  begin
    perform public.payroll_actual((previous_start - interval '2 months')::date, (previous_start - interval '1 month' - interval '1 day')::date);
    raise exception 'INCOMPLETE_SHOULD_FAIL';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%SALARY_CONFIGURATION_INCOMPLETE%' then raise; end if;
  end;

  select count(*) into unchanged
  from finance_snapshot s
  join public.finance_records r on r.id = s.id
  where r.amount is distinct from s.amount;
  if unchanged <> 0 then raise exception 'FINANCE_AMOUNT_CHANGED'; end if;
  if (select count(*) from public.finance_records) < (select count(*) from finance_snapshot) then
    raise exception 'FINANCE_ROW_LOST';
  end if;

  raise notice 'PAYROLL_MONTHLY_SALARY_PASS';
end
$test$;

rollback;
