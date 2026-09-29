-- READ ONLY. Abort when production no longer matches the expected result.
begin;
set transaction read only;

do $postcheck$
declare
  museum uuid;
  fiscal integer;
  cells bigint;
  total numeric;
  nonzero bigint;
  nulls bigint;
  id_hash text;
  pair_hash text;
  compensation_rows bigint;
  compensation_employees bigint;
  expected_compensation_fingerprint text;
  compensation_fingerprint text;
  assignment_rows bigint;
  history_args text;
begin
  select m.id, m.fiscal_year_start_month into museum, fiscal
  from public.museums m
  where m.slug = 'museo-musica-pr';
  if museum is distinct from 'a1f597f7-44a2-44b2-9214-93364c2a12ff'::uuid or fiscal is distinct from 9 then
    raise exception 'POSTCHECK_FAILED museum';
  end if;

  select count(*), sum(amount), count(*) filter (where amount <> 0),
         count(*) filter (where amount is null),
         md5(string_agg(id::text, ',' order by id)),
         md5(string_agg(id::text || ':' || amount::text, ',' order by id))
    into cells, total, nonzero, nulls, id_hash, pair_hash
  from public.finance_records;
  if cells is distinct from 672 or total is distinct from 0 or nonzero is distinct from 0
     or nulls is distinct from 0
     or id_hash is distinct from 'da1680107fc6d6c388ec50b962dbd81a'
     or pair_hash is distinct from '8c8cb3dc1e77b9ea59494360b01af5e4' then
    raise exception 'POSTCHECK_FAILED finance_records';
  end if;

  select count(*), count(distinct employee_id)
    into compensation_rows, compensation_employees
  from public.employee_compensation;
  if compensation_rows is distinct from 5 or compensation_employees is distinct from 5 then
    raise exception 'POSTCHECK_FAILED compensation_count';
  end if;
  if exists (
    select 1 from public.employee_compensation
    group by employee_id having count(*) > 1
  ) or exists (
    select 1 from public.employee_compensation
    where effective_from is distinct from date '2026-09-15'
       or compensation_type is distinct from 'hourly'
       or hourly_rate is null
       or salary_amount is not null
       or standard_hours_week is not null
       or employee_id not in (
         '19054839-4e00-4a1d-816e-c6c69e07506d'::uuid,
         '6b83bedb-89ae-4412-8bc2-a73c1b2f4a35'::uuid,
         '946adc70-a10b-49a7-8749-182150f83498'::uuid,
         'a0d1e396-f34c-4f33-8b1b-3b20dbaa2751'::uuid,
         'c49e0812-f6fc-4e9b-9cc3-43f230977b3a'::uuid
       )
  ) then
    raise exception 'POSTCHECK_FAILED compensation_rows';
  end if;

  select md5(string_agg(
    md5(
      c.id::text || '|' ||
      c.museum_id::text || '|' ||
      c.employee_id::text || '|' ||
      c.compensation_type || '|' ||
      coalesce(c.hourly_rate::text, '') || '|' ||
      coalesce(c.salary_amount::text, '') || '|' ||
      coalesce(c.salary_period, '') || '|' ||
      coalesce(c.pay_frequency, '') || '|' ||
      coalesce(c.standard_hours_week::text, '') || '|' ||
      c.overtime_eligible::text || '|' ||
      coalesce(c.bonus_type, '') || '|' ||
      coalesce(c.bonus_amount::text, '') || '|' ||
      coalesce(c.bonus_percent::text, '') || '|' ||
      coalesce(c.other_description, '') || '|' ||
      c.effective_from::text || '|' ||
      c.currency || '|' ||
      coalesce(c.intuit_employee_id, '') || '|' ||
      c.sync_status || '|' ||
      c.created_by::text || '|' ||
      c.updated_by::text || '|' ||
      to_char(c.created_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') || '|' ||
      to_char(c.updated_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.US')
    ),
    ',' order by c.employee_id, c.effective_from, c.id
  ))
  into compensation_fingerprint
  from public.employee_compensation c;
  raise notice 'COMPENSATION_FINGERPRINT %', compensation_fingerprint;
  expected_compensation_fingerprint := nullif(btrim(current_setting('payroll.expected_compensation_fingerprint', true)), '');
  if expected_compensation_fingerprint is null
     or compensation_fingerprint is distinct from expected_compensation_fingerprint then
    raise exception 'POSTCHECK_FAILED compensation_fingerprint';
  end if;

  if to_regprocedure('public.payroll_actual(date,date)') is null then
    raise exception 'POSTCHECK_FAILED payroll_actual';
  end if;
  if to_regclass('public.employee_budget_assignments') is null then
    raise exception 'POSTCHECK_FAILED assignments_missing';
  end if;
  select count(*) into assignment_rows from public.employee_budget_assignments;
  if assignment_rows is distinct from 0 then
    raise exception 'POSTCHECK_FAILED assignments_not_empty';
  end if;

  -- Structural signature only. This does not call list_attendance_history.
  select pg_get_function_arguments(p.oid) into history_args
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'list_attendance_history';
  if history_args is distinct from 'p_from date, p_to date, p_include_former boolean DEFAULT false' then
    raise exception 'POSTCHECK_FAILED attendance_signature';
  end if;
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_attendance_history'
    group by p.proname having count(*) <> 1
  ) then
    raise exception 'POSTCHECK_FAILED attendance_overloads';
  end if;

  if not has_table_privilege('authenticated', 'public.employee_compensation', 'SELECT')
     or has_table_privilege('authenticated', 'public.employee_compensation', 'INSERT')
     or has_table_privilege('authenticated', 'public.employee_compensation', 'UPDATE')
     or has_table_privilege('authenticated', 'public.employee_compensation', 'DELETE')
     or has_table_privilege('authenticated', 'public.employee_compensation', 'TRUNCATE')
     or not has_table_privilege('authenticated', 'public.employee_budget_assignments', 'SELECT')
     or has_table_privilege('authenticated', 'public.employee_budget_assignments', 'INSERT')
     or has_table_privilege('authenticated', 'public.employee_budget_assignments', 'UPDATE')
     or has_table_privilege('authenticated', 'public.employee_budget_assignments', 'DELETE')
     or has_table_privilege('authenticated', 'public.employee_budget_assignments', 'TRUNCATE') then
    raise exception 'POSTCHECK_FAILED table_privileges';
  end if;

  if to_regprocedure('public.payroll_actual(date,date)') is null
     or to_regprocedure('public.assign_employee_budget_line(uuid,uuid,date)') is null
     or to_regprocedure('public.close_employee_budget_assignment(uuid,date)') is null
     or to_regprocedure('public.get_employee_compensation(uuid,date)') is null
     or to_regprocedure('public.save_employee_compensation(uuid,text,numeric,numeric,text,text,numeric,boolean,text,numeric,numeric,text,date)') is null
     or to_regprocedure('public.resolve_employee_compensation(uuid,uuid,date)') is null
     or not has_function_privilege('authenticated', 'public.payroll_actual(date,date)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.assign_employee_budget_line(uuid,uuid,date)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.close_employee_budget_assignment(uuid,date)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_employee_compensation(uuid,date)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.save_employee_compensation(uuid,text,numeric,numeric,text,text,numeric,boolean,text,numeric,numeric,text,date)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.resolve_employee_compensation(uuid,uuid,date)', 'EXECUTE') then
    raise exception 'POSTCHECK_FAILED function_privileges';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'save_employee_sensitive_details'
  ) then
    raise exception 'POSTCHECK_FAILED sensitive_details';
  end if;
end
$postcheck$;

rollback;
