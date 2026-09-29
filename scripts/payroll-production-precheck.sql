-- READ ONLY. Abort when a production precondition no longer holds.
-- Do not deploy if this script raises.
begin;
set transaction read only;

do $precheck$
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
  compensation_fingerprint text;
  nomina_lines bigint;
begin
  select m.id, m.fiscal_year_start_month into museum, fiscal
  from public.museums m
  where m.slug = 'museo-musica-pr';
  if museum is distinct from 'a1f597f7-44a2-44b2-9214-93364c2a12ff'::uuid then
    raise exception 'PRECHECK_FAILED museum';
  end if;
  if fiscal is distinct from 9 then
    raise exception 'PRECHECK_FAILED fiscal_year_start_month';
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
    raise exception 'PRECHECK_FAILED finance_records';
  end if;

  select count(*), count(distinct employee_id)
    into compensation_rows, compensation_employees
  from public.employee_compensation;
  if compensation_rows is distinct from 5 or compensation_employees is distinct from 5 then
    raise exception 'PRECHECK_FAILED compensation_count';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employee_compensation'
      and column_name = 'id' and is_nullable = 'NO'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employee_compensation'
      and column_name = 'effective_from' and is_nullable = 'NO'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employee_compensation'::regclass and contype = 'p'
      and pg_get_constraintdef(oid) = 'PRIMARY KEY (id)'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employee_compensation'::regclass and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (museum_id, employee_id, effective_from)'
  ) or exists (
    select 1 from public.employee_compensation
    group by employee_id having count(*) > 1
  ) then
    raise exception 'PRECHECK_FAILED compensation_history';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_logs'
      and column_name = 'user_id'
  ) then
    raise exception 'PRECHECK_FAILED audit_logs.user_id';
  end if;

  select count(*) into nomina_lines
  from public.finance_budget_lines
  where museum_id = museum and category = 'Nómina' and record_type = 'expense';
  if nomina_lines is distinct from 22 then
    raise exception 'PRECHECK_FAILED nomina_lines';
  end if;

  if to_regclass('public.employee_budget_assignments') is not null then
    raise exception 'PRECHECK_FAILED assignments_already_exist';
  end if;
  if to_regprocedure('public.payroll_actual(date,date)') is not null then
    raise exception 'PRECHECK_FAILED payroll_actual_already_exists';
  end if;

  if to_regprocedure('public.list_attendance_history(date,date)') is null
     or to_regprocedure('public.list_attendance_history(date,date,boolean)') is not null
     or (
       select p.pronargs
       from pg_proc p
       where p.oid = to_regprocedure('public.list_attendance_history(date,date)')
     ) is distinct from 2 then
    raise exception 'PRECHECK_FAILED attendance_signature';
  end if;

  if to_regprocedure('public.get_employee_compensation(uuid,date)') is null
     or to_regprocedure('public.resolve_employee_compensation(uuid,uuid,date)') is null
     or to_regprocedure('public.save_employee_compensation(uuid,text,numeric,numeric,text,text,numeric,boolean,text,numeric,numeric,text,date)') is null then
    raise exception 'PRECHECK_FAILED compensation_rpc';
  end if;

  if not has_table_privilege('authenticated', 'public.employee_compensation', 'SELECT')
     or has_table_privilege('authenticated', 'public.employee_compensation', 'INSERT')
     or has_table_privilege('authenticated', 'public.employee_compensation', 'UPDATE')
     or has_table_privilege('authenticated', 'public.employee_compensation', 'DELETE')
     or has_table_privilege('authenticated', 'public.employee_compensation', 'TRUNCATE') then
    raise exception 'PRECHECK_FAILED compensation_privileges';
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
end
$precheck$;

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
)) as compensation_fingerprint
from public.employee_compensation c;

rollback;
