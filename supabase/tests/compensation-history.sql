-- Staging rehearsal for the HR compensation RPCs. Rolls back.
begin;

create function pg_temp.compensation_complete_shift(
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
  in_attempt uuid := ('c22a0000-0000-4000-8000-' || suffix)::uuid;
  out_attempt uuid := ('c32a0000-0000-4000-8000-' || suffix)::uuid;
  in_event uuid := ('d22a0000-0000-4000-8000-' || suffix)::uuid;
  out_event uuid := ('d32a0000-0000-4000-8000-' || suffix)::uuid;
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
  subject uuid := 'e22a0000-0000-4000-8000-000000000001';
  outsider uuid := 'e22a0000-0000-4000-8000-000000000002';
  current_row jsonb;
  early_row jsonb;
  later_row jsonb;
  payroll jsonb;
  person jsonb;
  day jsonb;
  audits integer;
  rows_before integer;
  rows_after integer;
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);
  museum := public.current_user_museum_id();
  if museum is null then raise exception 'ACTOR_MUSEUM_MISSING'; end if;
  update public.museums set fiscal_year_start_month = 9 where id = museum and fiscal_year_start_month is null;

  create temp table finance_snapshot as select id, amount from public.finance_records;

  alter table public.employees disable trigger protect_employee_module_profile;
  update public.employees set access_profile = 'director_ejecutivo' where profile_id = actor and museum_id = museum;
  alter table public.employees enable trigger protect_employee_module_profile;

  select id into other_museum from public.museums where id <> museum limit 1;
  if other_museum is null then raise exception 'OTHER_MUSEUM_MISSING'; end if;
  insert into public.attendance_settings (museum_id, timezone, updated_by)
  values (museum, 'America/Puerto_Rico', actor)
  on conflict (museum_id) do update set timezone = 'America/Puerto_Rico'
  where nullif(trim(public.attendance_settings.timezone), '') is null;

  insert into public.employees (id, museum_id, first_name, last_name, position, department, email, status)
  values
    (subject, museum, 'Tarifa', 'Historia', 'Técnico', 'Producción', 'compensation-history@example.invalid', 'activo'),
    (outsider, other_museum, 'Otro', 'Museo', 'Técnico', 'Producción', 'compensation-outsider@example.invalid', 'activo');

  perform public.save_employee_compensation(subject, 'hourly', 18, null, null, 'semimonthly', 20, true, null, null, null, null, date '2026-09-01');
  current_row := public.get_employee_compensation(subject, null);
  if (current_row->>'hourly_rate')::numeric is distinct from 18
     or current_row->>'effective_from' is distinct from '2026-09-01'
     or (current_row->>'standard_hours_week')::numeric is distinct from 20 then
    raise exception 'PROFILE_DOES_NOT_SHOW_18 %', current_row;
  end if;

  perform public.save_employee_compensation(subject, 'hourly', 20, null, null, 'semimonthly', null, true, null, null, null, null, date '2026-09-16');
  current_row := public.get_employee_compensation(subject, null);
  if (current_row->>'hourly_rate')::numeric is distinct from 20
     or current_row->>'effective_from' is distinct from '2026-09-16'
     or (current_row->>'standard_hours_week')::numeric is distinct from 20 then
    raise exception 'PROFILE_DOES_NOT_SHOW_20 %', current_row;
  end if;
  early_row := public.get_employee_compensation(subject, date '2026-09-15');
  later_row := public.get_employee_compensation(subject, date '2026-09-16');
  if (early_row->>'hourly_rate')::numeric is distinct from 18
     or (later_row->>'hourly_rate')::numeric is distinct from 20
     or (select count(*) from public.employee_compensation where employee_id = subject) is distinct from 2 then
    raise exception 'HISTORY_NOT_PRESERVED';
  end if;

  perform pg_temp.compensation_complete_shift(museum, subject, actor, 'b22a0000-0000-4000-8000-000000000001', timestamptz '2026-09-02 08:00:00-04', timestamptz '2026-09-02 16:00:00-04');
  perform pg_temp.compensation_complete_shift(museum, subject, actor, 'b22a0000-0000-4000-8000-000000000007', timestamptz '2026-09-07 08:00:00-04', timestamptz '2026-09-07 16:00:00-04');
  perform pg_temp.compensation_complete_shift(museum, subject, actor, 'b22a0000-0000-4000-8000-000000000008', timestamptz '2026-09-08 08:00:00-04', timestamptz '2026-09-08 16:00:00-04');
  perform pg_temp.compensation_complete_shift(museum, subject, actor, 'b22a0000-0000-4000-8000-000000000009', timestamptz '2026-09-09 08:00:00-04', timestamptz '2026-09-09 16:00:00-04');
  perform pg_temp.compensation_complete_shift(museum, subject, actor, 'b22a0000-0000-4000-8000-000000000010', timestamptz '2026-09-10 08:00:00-04', timestamptz '2026-09-10 16:00:00-04');
  perform pg_temp.compensation_complete_shift(museum, subject, actor, 'b22a0000-0000-4000-8000-000000000016', timestamptz '2026-09-16 08:00:00-04', timestamptz '2026-09-16 16:00:00-04');

  payroll := public.payroll_actual(date '2026-09-01', date '2026-09-15');
  select value into person from jsonb_array_elements(payroll->'employees') value where value->>'employee_id' = subject::text;
  select value into day from jsonb_array_elements(person->'days') value where value->>'shift_date' = '2026-09-02';
  if (day->>'hourly_rate')::numeric is distinct from 18 or (day->>'amount')::numeric is distinct from 144 then
    raise exception 'PAYROLL_BEFORE_RATE_CHANGE %', day;
  end if;

  payroll := public.payroll_actual(date '2026-09-16', date '2026-09-30');
  select value into person from jsonb_array_elements(payroll->'employees') value where value->>'employee_id' = subject::text;
  select value into day from jsonb_array_elements(person->'days') value where value->>'shift_date' = '2026-09-16';
  if (day->>'hourly_rate')::numeric is distinct from 20 or (day->>'amount')::numeric is distinct from 160 then
    raise exception 'PAYROLL_AFTER_RATE_CHANGE %', day;
  end if;

  payroll := public.payroll_actual(date '2026-09-07', date '2026-09-13');
  select value into person from jsonb_array_elements(payroll->'employees') value where value->>'employee_id' = subject::text;
  if (person->>'worked_minutes')::integer is distinct from 1920
     or (person->>'payable_minutes')::integer is distinct from 1920
     or (person->>'over_limit_minutes')::integer is distinct from 0
     or (person->>'actual_amount')::numeric is distinct from 576
     or (person->>'monthly_equivalent')::numeric is distinct from 1560
     or (person->>'hourly_rate')::numeric is distinct from 18 then
    raise exception 'REFERENCE_HOURS_CHANGED_PAYABLE_CAP %', person;
  end if;

  begin
    perform public.save_employee_compensation(subject, 'hourly', 25, null, null, 'semimonthly', 20, true, null, null, null, null, date '2026-09-16');
    raise exception 'DUPLICATE_DATE_WAS_ACCEPTED';
  exception when sqlstate 'P0001' then
    if sqlerrm is distinct from 'Ya existe una compensación para esa fecha de vigencia.' then
      raise exception 'DUPLICATE_DATE_MESSAGE %', sqlerrm;
    end if;
  end;
  if (select count(*) from public.employee_compensation where employee_id = subject) is distinct from 2
     or (select hourly_rate from public.employee_compensation where employee_id = subject and effective_from = date '2026-09-16') is distinct from 20
     or (select hourly_rate from public.employee_compensation where employee_id = subject and effective_from = date '2026-09-01') is distinct from 18 then
    raise exception 'DUPLICATE_DATE_CORRUPTED_HISTORY';
  end if;

  select count(*) into audits
  from public.audit_logs
  where actor_user_id = actor
    and action = 'EMPLOYEE_COMPENSATION_CREATED'
    and table_name = 'employee_compensation'
    and new_value->>'employee_id' = subject::text;
  if audits is distinct from 2 then raise exception 'AUDIT_COUNT %', audits; end if;

  insert into public.user_permissions (museum_id, user_id, permission_id, effect)
  select museum, actor, p.id, 'deny'
  from public.permissions p
  where p.code = 'compensation.manage'
  on conflict (museum_id, user_id, permission_id) do update set effect = 'deny';
  current_row := public.get_employee_compensation(subject, date '2026-09-16');
  if (current_row->>'hourly_rate')::numeric is distinct from 20 then raise exception 'READER_CANNOT_READ'; end if;
  begin
    perform public.save_employee_compensation(subject, 'hourly', 30, null, null, 'semimonthly', 20, true, null, null, null, null, date '2026-10-01');
    raise exception 'READER_WAS_ALLOWED_TO_SAVE';
  exception when sqlstate '42501' then null;
  end;
  delete from public.user_permissions up
  using public.permissions p
  where up.permission_id = p.id and up.user_id = actor and up.museum_id = museum and p.code = 'compensation.manage';

  perform set_config('request.jwt.claim.sub', other_actor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', other_actor, 'role', 'authenticated')::text, true);
  begin
    perform public.get_employee_compensation(subject, date '2026-09-16');
    raise exception 'UNREAD_USER_SAW_COMPENSATION';
  exception when sqlstate '42501' then null;
  end;

  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);
  begin
    perform public.get_employee_compensation(outsider, date '2026-09-16');
    raise exception 'OTHER_MUSEUM_WAS_READABLE';
  exception when sqlstate 'P0001' then
    if sqlerrm is distinct from 'EMPLOYEE_NOT_FOUND' then raise exception 'OTHER_MUSEUM_READ %', sqlerrm; end if;
  end;
  begin
    perform public.save_employee_compensation(outsider, 'hourly', 99, null, null, 'semimonthly', 40, true, null, null, null, null, date '2026-09-01');
    raise exception 'OTHER_MUSEUM_WAS_WRITABLE';
  exception when sqlstate 'P0001' then
    if sqlerrm is distinct from 'EMPLOYEE_NOT_FOUND' then raise exception 'OTHER_MUSEUM_WRITE %', sqlerrm; end if;
  end;

  insert into public.user_permissions (museum_id, user_id, permission_id, effect)
  select museum, actor, p.id, 'allow'
  from public.permissions p
  where p.code = 'emergency_contact.manage'
  on conflict (museum_id, user_id, permission_id) do update set effect = 'allow';
  if not public.has_permission('emergency_contact.manage') then
    raise exception 'EMERGENCY_PERMISSION_NOT_HONORED';
  end if;
  rows_before := (select count(*) from public.employee_compensation where employee_id = subject);
  perform public.save_employee_sensitive_details(subject, '{"hourly_rate":"99","effective_from":"2026-09-01"}'::jsonb, '{"full_name":"Contacto Prueba"}'::jsonb);
  rows_after := (select count(*) from public.employee_compensation where employee_id = subject);
  if rows_before is distinct from rows_after
     or (select hourly_rate from public.employee_compensation where employee_id = subject and effective_from = date '2026-09-01') is distinct from 18 then
    raise exception 'SENSITIVE_DETAILS_CHANGED_COMPENSATION';
  end if;

  if has_function_privilege('authenticated', 'public.resolve_employee_compensation(uuid,uuid,date)', 'execute') then
    raise exception 'RESOLVE_IS_EXECUTABLE';
  end if;

  execute 'set local role authenticated';
  begin
    insert into public.employee_compensation (museum_id, employee_id, compensation_type, hourly_rate, effective_from, created_by, updated_by)
    values (museum, subject, 'hourly', 1, date '2026-11-01', actor, actor);
    raise exception 'DIRECT_INSERT_ALLOWED';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.employee_compensation set hourly_rate = 1 where employee_id = subject;
    raise exception 'DIRECT_UPDATE_ALLOWED';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.employee_compensation where employee_id = subject;
    raise exception 'DIRECT_DELETE_ALLOWED';
  exception when insufficient_privilege then null;
  end;
  begin
    truncate public.employee_compensation;
    raise exception 'DIRECT_TRUNCATE_ALLOWED';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.employee_compensation where employee_id = outsider) is distinct from 0 then
    raise exception 'RLS_SHOWS_OTHER_MUSEUM';
  end if;
  if (select count(*) from public.employee_compensation where employee_id = subject) is distinct from 2 then
    raise exception 'RLS_HID_OWN_COMPENSATION';
  end if;
  execute 'reset role';

  if (select count(*) from finance_snapshot s join public.finance_records r on r.id = s.id where r.amount is distinct from s.amount) <> 0 then
    raise exception 'FINANCE_AMOUNT_CHANGED';
  end if;

  raise exception 'COMPENSATION_HISTORY_PASS';
end
$test$;

rollback;
