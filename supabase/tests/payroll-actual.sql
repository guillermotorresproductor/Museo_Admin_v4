-- Staging rehearsal. Rolls back. Does not keep employees, punches, or budget rows.
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
  in_attempt uuid := ('c11a0000-0000-4000-8000-' || suffix)::uuid;
  out_attempt uuid := ('c21a0000-0000-4000-8000-' || suffix)::uuid;
  in_event uuid := ('d11a0000-0000-4000-8000-' || suffix)::uuid;
  out_event uuid := ('d21a0000-0000-4000-8000-' || suffix)::uuid;
begin
  insert into public.employee_shifts (id, museum_id, employee_id, starts_at, ends_at, shift_date, status, created_by)
  values (p_shift, p_museum, p_employee, p_start, p_end, (p_start at time zone 'America/Puerto_Rico')::date, 'scheduled', p_actor);
  insert into public.attendance_attempts (id, museum_id, employee_id, shift_id, actor_user_id, requested_event, result)
  values
    (in_attempt, p_museum, p_employee, p_shift, p_actor, 'clock_in', 'accepted'),
    (out_attempt, p_museum, p_employee, p_shift, p_actor, 'clock_out', 'accepted');
  insert into public.attendance_events (id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by)
  values
    (in_event, p_museum, p_employee, p_shift, in_attempt, 'clock_in', p_start, 'on_time', 1, p_actor),
    (out_event, p_museum, p_employee, p_shift, out_attempt, 'clock_out', p_end, 'standard', 1, p_actor);
end
$$;

do $test$
declare
  actor uuid := 'ca3d0682-662b-4fb5-b859-8e150beb07e6';
  other_actor uuid := 'cc2a33ee-6267-4cb0-8b63-1c5ede309d9e';
  museum uuid;
  other_museum uuid;
  line_guides uuid := 'a11a0000-0000-4000-8000-000000000001';
  line_a uuid := 'a11a0000-0000-4000-8000-000000000002';
  line_b uuid := 'a11a0000-0000-4000-8000-000000000003';
  guia_a uuid := 'e11a0000-0000-4000-8000-000000000001';
  guia_b uuid := 'e11a0000-0000-4000-8000-000000000002';
  guia_c uuid := 'e11a0000-0000-4000-8000-000000000003';
  mover uuid := 'e11a0000-0000-4000-8000-000000000004';
  short_week uuid := 'e11a0000-0000-4000-8000-000000000005';
  long_week uuid := 'e11a0000-0000-4000-8000-000000000006';
  crosser uuid := 'e11a0000-0000-4000-8000-000000000007';
  pending uuid := 'e11a0000-0000-4000-8000-000000000008';
  former uuid := 'e11a0000-0000-4000-8000-000000000009';
  lone uuid := 'e11a0000-0000-4000-8000-00000000000a';
  excluded_emp uuid := 'e11a0000-0000-4000-8000-00000000000b';
  outsider uuid := 'e11a0000-0000-4000-8000-00000000000c';
  result jsonb;
  history jsonb;
  person jsonb;
  plaza jsonb;
  day jsonb;
  changed integer;
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
  if public.current_employee_module_profile() <> 'director_ejecutivo' then
    raise exception 'ACTOR_PROFILE_NOT_DIRECTOR';
  end if;

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
  values
    (line_guides, museum, 'expense', 'Nómina', 'Plaza Guías Prueba', 9001, true),
    (line_a, museum, 'expense', 'Nómina', 'Plaza A Prueba', 9002, true),
    (line_b, museum, 'expense', 'Nómina', 'Plaza B Prueba', 9003, true);

  insert into public.finance_records (museum_id, budget_line_id, month, year, amount)
  values (museum, line_guides, 'Septiembre', 2026, 8000);

  insert into public.employees (id, museum_id, first_name, last_name, position, department, email, status)
  values
    (guia_a, museum, 'Guia', 'A', 'Guía', 'Experiencia', 'payroll-guia-a@example.invalid', 'activo'),
    (guia_b, museum, 'Guia', 'B', 'Guía', 'Experiencia', 'payroll-guia-b@example.invalid', 'activo'),
    (guia_c, museum, 'Guia', 'C', 'Guía', 'Experiencia', 'payroll-guia-c@example.invalid', 'activo'),
    (mover, museum, 'Mueve', 'Plaza', 'Técnico', 'Producción', 'payroll-mover@example.invalid', 'activo'),
    (short_week, museum, 'Corta', 'Semana', 'Técnico', 'Producción', 'payroll-short@example.invalid', 'activo'),
    (long_week, museum, 'Larga', 'Semana', 'Técnico', 'Producción', 'payroll-long@example.invalid', 'activo'),
    (crosser, museum, 'Cruza', 'Semana', 'Técnico', 'Producción', 'payroll-cross@example.invalid', 'activo'),
    (pending, museum, 'Pendiente', 'Correccion', 'Técnico', 'Producción', 'payroll-pending@example.invalid', 'activo'),
    (former, museum, 'Termino', 'Mitad', 'Técnico', 'Producción', 'payroll-former@example.invalid', 'terminado'),
    (lone, museum, 'Sin', 'Plaza', 'Técnico', 'Producción', 'payroll-lone@example.invalid', 'activo'),
    (excluded_emp, museum, 'Excluye', 'Turno', 'Técnico', 'Producción', 'payroll-excluded@example.invalid', 'activo'),
    (outsider, other_museum, 'Otro', 'Museo', 'Técnico', 'Producción', 'payroll-outsider@example.invalid', 'activo');

  insert into public.employee_compensation (
    museum_id, employee_id, compensation_type, hourly_rate, standard_hours_week, effective_from, created_by, updated_by
  )
  select museum, e, 'hourly', 18, case when e = short_week then 20 else 40 end, date '2026-08-01', actor, actor
  from unnest(array[guia_a, guia_b, guia_c, mover, short_week, long_week, crosser, pending, former, lone, excluded_emp]) e;
  insert into public.employee_compensation (
    museum_id, employee_id, compensation_type, hourly_rate, standard_hours_week, effective_from, created_by, updated_by
  ) values (museum, mover, 'hourly', 20, 40, date '2026-09-16', actor, actor);
  insert into public.employee_compensation (
    museum_id, employee_id, compensation_type, hourly_rate, standard_hours_week, effective_from, created_by, updated_by
  ) values (other_museum, outsider, 'hourly', 99, 40, date '2026-08-01', actor, actor);

  perform public.assign_employee_budget_line(guia_a, line_guides, date '2026-09-01');
  perform public.assign_employee_budget_line(guia_b, line_guides, date '2026-09-01');
  perform public.assign_employee_budget_line(guia_c, line_guides, date '2026-09-01');
  perform public.assign_employee_budget_line(mover, line_a, date '2026-09-01');
  perform public.assign_employee_budget_line(mover, line_b, date '2026-09-16');
  perform public.assign_employee_budget_line(short_week, line_a, date '2026-08-01');
  perform public.assign_employee_budget_line(long_week, line_a, date '2026-08-01');
  perform public.assign_employee_budget_line(crosser, line_a, date '2026-08-01');
  perform public.assign_employee_budget_line(pending, line_a, date '2026-09-01');
  perform public.assign_employee_budget_line(former, line_a, date '2026-09-01');
  perform public.assign_employee_budget_line(excluded_emp, line_a, date '2026-09-01');

  begin
    insert into public.employee_budget_assignments (museum_id, employee_id, budget_line_id, effective_from, created_by)
    values (museum, mover, line_guides, date '2026-09-20', actor);
    raise exception 'OVERLAP_NOT_BLOCKED';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%EMPLOYEE_PLAZA_OVERLAP%' then raise; end if;
  end;

  perform pg_temp.payroll_complete_shift(museum, guia_a, actor, 'b11a0000-0000-4000-8000-000000000001', timestamptz '2026-09-02 08:00:00-04', timestamptz '2026-09-02 16:00:00-04');
  perform pg_temp.payroll_complete_shift(museum, guia_b, actor, 'b11a0000-0000-4000-8000-000000000002', timestamptz '2026-09-03 08:00:00-04', timestamptz '2026-09-03 16:00:00-04');
  perform pg_temp.payroll_complete_shift(museum, guia_c, actor, 'b11a0000-0000-4000-8000-000000000003', timestamptz '2026-09-04 08:00:00-04', timestamptz '2026-09-04 16:00:00-04');
  perform pg_temp.payroll_complete_shift(museum, mover, actor, 'b11a0000-0000-4000-8000-000000000004', timestamptz '2026-09-02 08:00:00-04', timestamptz '2026-09-02 16:00:00-04');
  perform pg_temp.payroll_complete_shift(museum, mover, actor, 'b11a0000-0000-4000-8000-000000000005', timestamptz '2026-09-16 08:00:00-04', timestamptz '2026-09-16 16:00:00-04');
  perform pg_temp.payroll_complete_shift(museum, short_week, actor, 'b11a0000-0000-4000-8000-000000000011', timestamptz '2026-08-10 08:00:00-04', timestamptz '2026-08-10 16:00:00-04');
  perform pg_temp.payroll_complete_shift(museum, short_week, actor, 'b11a0000-0000-4000-8000-000000000012', timestamptz '2026-08-11 08:00:00-04', timestamptz '2026-08-11 16:00:00-04');
  perform pg_temp.payroll_complete_shift(museum, short_week, actor, 'b11a0000-0000-4000-8000-000000000013', timestamptz '2026-08-12 08:00:00-04', timestamptz '2026-08-12 16:00:00-04');
  perform pg_temp.payroll_complete_shift(museum, short_week, actor, 'b11a0000-0000-4000-8000-000000000014', timestamptz '2026-08-13 08:00:00-04', timestamptz '2026-08-13 16:00:00-04');
  perform pg_temp.payroll_complete_shift(museum, long_week, actor, 'b11a0000-0000-4000-8000-000000000021', timestamptz '2026-08-03 08:00:00-04', timestamptz '2026-08-03 16:00:00-04');
  perform pg_temp.payroll_complete_shift(museum, long_week, actor, 'b11a0000-0000-4000-8000-000000000022', timestamptz '2026-08-04 08:00:00-04', timestamptz '2026-08-04 16:00:00-04');
  perform pg_temp.payroll_complete_shift(museum, long_week, actor, 'b11a0000-0000-4000-8000-000000000023', timestamptz '2026-08-05 08:00:00-04', timestamptz '2026-08-05 16:00:00-04');
  perform pg_temp.payroll_complete_shift(museum, long_week, actor, 'b11a0000-0000-4000-8000-000000000024', timestamptz '2026-08-06 08:00:00-04', timestamptz '2026-08-06 16:00:00-04');
  perform pg_temp.payroll_complete_shift(museum, long_week, actor, 'b11a0000-0000-4000-8000-000000000025', timestamptz '2026-08-07 08:00:00-04', timestamptz '2026-08-07 16:00:00-04');
  perform pg_temp.payroll_complete_shift(museum, long_week, actor, 'b11a0000-0000-4000-8000-000000000026', timestamptz '2026-08-08 08:00:00-04', timestamptz '2026-08-08 12:00:00-04');
  perform pg_temp.payroll_complete_shift(museum, crosser, actor, 'b11a0000-0000-4000-8000-000000000031', timestamptz '2026-08-31 08:00:00-04', timestamptz '2026-08-31 16:00:00-04');
  perform pg_temp.payroll_complete_shift(museum, crosser, actor, 'b11a0000-0000-4000-8000-000000000032', timestamptz '2026-09-01 08:00:00-04', timestamptz '2026-09-01 16:00:00-04');
  perform pg_temp.payroll_complete_shift(museum, crosser, actor, 'b11a0000-0000-4000-8000-000000000033', timestamptz '2026-09-02 08:00:00-04', timestamptz '2026-09-02 16:00:00-04');
  perform pg_temp.payroll_complete_shift(museum, crosser, actor, 'b11a0000-0000-4000-8000-000000000034', timestamptz '2026-09-03 08:00:00-04', timestamptz '2026-09-03 16:00:00-04');
  perform pg_temp.payroll_complete_shift(museum, crosser, actor, 'b11a0000-0000-4000-8000-000000000035', timestamptz '2026-09-04 08:00:00-04', timestamptz '2026-09-04 18:00:00-04');
  perform pg_temp.payroll_complete_shift(museum, former, actor, 'b11a0000-0000-4000-8000-000000000041', timestamptz '2026-09-10 08:00:00-04', timestamptz '2026-09-10 16:00:00-04');
  perform pg_temp.payroll_complete_shift(museum, lone, actor, 'b11a0000-0000-4000-8000-000000000042', timestamptz '2026-09-11 08:00:00-04', timestamptz '2026-09-11 16:00:00-04');
  perform pg_temp.payroll_complete_shift(museum, excluded_emp, actor, 'b11a0000-0000-4000-8000-000000000043', timestamptz '2026-09-09 08:00:00-04', timestamptz '2026-09-09 16:00:00-04');
  perform pg_temp.payroll_complete_shift(other_museum, outsider, actor, 'b11a0000-0000-4000-8000-000000000044', timestamptz '2026-09-02 08:00:00-04', timestamptz '2026-09-02 16:00:00-04');

  insert into public.employee_shifts (id, museum_id, employee_id, starts_at, ends_at, shift_date, status, created_by)
  values ('b11a0000-0000-4000-8000-000000000051', museum, pending, timestamptz '2026-09-08 08:00:00-04', timestamptz '2026-09-08 16:00:00-04', date '2026-09-08', 'scheduled', actor);
  insert into public.attendance_attempts (id, museum_id, employee_id, shift_id, actor_user_id, requested_event, result)
  values ('c11a0000-0000-4000-8000-0000000000a1', museum, pending, 'b11a0000-0000-4000-8000-000000000051', actor, 'clock_in', 'accepted');
  insert into public.attendance_events (id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by)
  values ('d11a0000-0000-4000-8000-0000000000a1', museum, pending, 'b11a0000-0000-4000-8000-000000000051', 'c11a0000-0000-4000-8000-0000000000a1', 'clock_in', timestamptz '2026-09-08 08:00:00-04', 'on_time', 1, actor);

  insert into public.attendance_overtime_reviews (museum_id, employee_id, shift_id, clock_out_event_id, additional_minutes, approved_minutes, status)
  values (museum, short_week, 'b11a0000-0000-4000-8000-000000000011', 'd21a0000-0000-4000-8000-000000000011', 60, 60, 'approved');

  insert into public.attendance_exclusions (museum_id, employee_id, shift_id, scope, action, motive, acted_by)
  values (museum, excluded_emp, 'b11a0000-0000-4000-8000-000000000043', 'shift', 'exclude', 'system_test', actor);

  perform set_config('request.jwt.claim.sub', other_actor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', other_actor, 'role', 'authenticated')::text, true);
  begin
    perform public.payroll_actual(date '2026-09-01', date '2026-09-30');
    raise exception 'PAYROLL_SHOULD_BE_FORBIDDEN';
  exception when sqlstate '42501' then null;
  end;

  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);

  history := public.list_attendance_history(date '2026-09-01', date '2026-09-30');
  if history::text like '%' || former::text || '%' then
    raise exception 'FORMER_VISIBLE_BY_DEFAULT';
  end if;

  result := public.payroll_actual(date '2026-09-01', date '2026-09-30');
  if result::text like '%' || outsider::text || '%' then
    raise exception 'OTHER_MUSEUM_VISIBLE';
  end if;

  select value into plaza
  from jsonb_array_elements(result->'plazas') value
  where value->>'budget_line_id' = line_guides::text;
  if plaza is null
     or (plaza->>'budget_amount')::numeric is distinct from 8000
     or (plaza->>'actual_amount')::numeric is distinct from 432
     or (plaza->>'difference')::numeric is distinct from 7568
     or jsonb_array_length(plaza->'employees') is distinct from 3 then
    raise exception 'GUIDES_PLAZA_MISMATCH %', plaza;
  end if;

  select value into person from jsonb_array_elements(result->'employees') value where value->>'employee_id' = mover::text;
  if person is null or (person->>'actual_amount')::numeric is distinct from 304 or person->>'plaza_name' is distinct from 'Varias plazas' then
    raise exception 'MOVER_MISMATCH %', person;
  end if;
  if not exists (
    select 1 from jsonb_array_elements(person->'days') d
    where d->>'shift_date' = '2026-09-02' and (d->>'amount')::numeric = 144 and d->>'plaza_name' = 'Plaza A Prueba' and (d->>'hourly_rate')::numeric = 18
  ) or not exists (
    select 1 from jsonb_array_elements(person->'days') d
    where d->>'shift_date' = '2026-09-16' and (d->>'amount')::numeric = 160 and d->>'plaza_name' = 'Plaza B Prueba' and (d->>'hourly_rate')::numeric = 20
  ) then
    raise exception 'RATE_OR_PLAZA_DAY_MISMATCH %', person->'days';
  end if;

  select value into person from jsonb_array_elements(result->'employees') value where value->>'employee_id' = former::text;
  if person is null or (person->>'actual_amount')::numeric <> 144 or person->>'employment_status' <> 'terminado' then
    raise exception 'FORMER_MISSING %', person;
  end if;

  select value into person from jsonb_array_elements(result->'employees') value where value->>'employee_id' = lone::text;
  if person is null or person->>'plaza_name' is not null or (person->>'actual_amount')::numeric <> 144 then
    raise exception 'UNASSIGNED_MISMATCH %', person;
  end if;
  if not exists (
    select 1 from jsonb_array_elements(result->'unassigned'->'employees') e
    where e->>'employee_id' = lone::text and (e->>'actual_amount')::numeric = 144
  ) then
    raise exception 'UNASSIGNED_GROUP_MISSING';
  end if;

  select value into person from jsonb_array_elements(result->'employees') value where value->>'employee_id' = pending::text;
  if person is null or person->>'state' is distinct from 'PENDIENTE DE CORRECCIÓN' or (person->>'actual_amount')::numeric is distinct from 0 then
    raise exception 'PENDING_MISMATCH %', person;
  end if;

  select value into person from jsonb_array_elements(result->'employees') value where value->>'employee_id' = excluded_emp::text;
  if person is null or person->>'state' is distinct from 'EXCLUIDA' or (person->>'actual_amount')::numeric is distinct from 0 then
    raise exception 'EXCLUDED_MISMATCH %', person;
  end if;

  insert into public.attendance_attempts (id, museum_id, employee_id, shift_id, actor_user_id, requested_event, result)
  values ('c11a0000-0000-4000-8000-0000000000a2', museum, pending, 'b11a0000-0000-4000-8000-000000000051', actor, 'clock_out', 'accepted');
  insert into public.attendance_events (id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by)
  values ('d11a0000-0000-4000-8000-0000000000a2', museum, pending, 'b11a0000-0000-4000-8000-000000000051', 'c11a0000-0000-4000-8000-0000000000a2', 'clock_out', timestamptz '2026-09-08 16:00:00-04', 'standard', 1, actor);
  result := public.payroll_actual(date '2026-09-01', date '2026-09-30');
  select value into person from jsonb_array_elements(result->'employees') value where value->>'employee_id' = pending::text;
  if person is null or (person->>'actual_amount')::numeric is distinct from 144 or person->>'state' is distinct from 'CALCULADA' then
    raise exception 'CORRECTION_NOT_REFLECTED %', person;
  end if;

  result := public.payroll_actual(date '2026-08-10', date '2026-08-16');
  select value into person from jsonb_array_elements(result->'employees') value where value->>'employee_id' = short_week::text;
  if person is null
     or (person->>'worked_minutes')::integer is distinct from 1920
     or (person->>'payable_minutes')::integer is distinct from 1920
     or (person->>'over_limit_minutes')::integer is distinct from 0
     or (person->>'actual_amount')::numeric is distinct from 576
     or (person->>'monthly_equivalent')::numeric is distinct from 1560 then
    raise exception 'SHORT_WEEK_MISMATCH %', person;
  end if;

  result := public.payroll_actual(date '2026-08-03', date '2026-08-09');
  select value into person from jsonb_array_elements(result->'employees') value where value->>'employee_id' = long_week::text;
  if person is null
     or (person->>'worked_minutes')::integer is distinct from 2640
     or (person->>'payable_minutes')::integer is distinct from 2400
     or (person->>'over_limit_minutes')::integer is distinct from 240
     or (person->>'actual_amount')::numeric is distinct from 720 then
    raise exception 'LONG_WEEK_MISMATCH %', person;
  end if;

  result := public.payroll_actual(date '2026-09-01', date '2026-09-15');
  select value into person from jsonb_array_elements(result->'employees') value where value->>'employee_id' = crosser::text;
  if person is null
     or (person->>'worked_minutes')::integer is distinct from 2040
     or (person->>'payable_minutes')::integer is distinct from 1920
     or (person->>'over_limit_minutes')::integer is distinct from 120
     or (person->>'actual_amount')::numeric is distinct from 576 then
    raise exception 'CROSSING_WEEK_MISMATCH %', person;
  end if;
  if result->>'full_month' <> 'false' then
    raise exception 'HALF_MONTH_MARKED_FULL';
  end if;

  select count(*) into changed
  from finance_snapshot s
  join public.finance_records r on r.id = s.id
  where r.amount is distinct from s.amount;
  if changed <> 0 then raise exception 'FINANCE_AMOUNT_CHANGED'; end if;
  if (select count(*) from finance_snapshot s join public.finance_records r on r.id = s.id) <> (select count(*) from finance_snapshot) then
    raise exception 'FINANCE_ROW_LOST';
  end if;

  insert into public.employee_budget_assignments (museum_id, employee_id, budget_line_id, effective_from, created_by)
  values (other_museum, outsider, line_guides, date '2026-09-01', actor);

  execute 'set local role authenticated';
  begin
    insert into public.employee_budget_assignments (museum_id, employee_id, budget_line_id, effective_from, created_by)
    values (museum, lone, line_guides, date '2026-09-01', actor);
    raise exception 'DIRECT_WRITE_ALLOWED';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.employee_budget_assignments where budget_line_id = line_guides) <> 3 then
    raise exception 'RLS_HID_OWN_PLAZA';
  end if;
  if exists (select 1 from public.employee_budget_assignments where employee_id = outsider) then
    raise exception 'RLS_SHOWS_OTHER_MUSEUM';
  end if;
  execute 'reset role';

  raise exception 'PAYROLL_REHEARSAL_PASS';
end
$test$;

rollback;
