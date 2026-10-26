-- Legal overtime for non-exempt hourly pay. Daily time over 8 hours is
-- extraordinary even when the week is under 40. Weekly time over 40 ordinary
-- hours is extraordinary too. The same minute is not in both. Already counted
-- regular minutes are split, not added again. Approved minutes are only the
-- reviewed excess. A monthly salary is not converted into an hourly rate.
-- The 40-hour museum limit blocks new schedules unless the reason records an
-- exceptional authorization. It does not delete punches or zero legal pay.
-- This does not rewrite punches, reviews, or finance records.

create or replace function public.classify_approved_additional_minutes(
  p_day_regular_before integer,
  p_shift_regular_minutes integer,
  p_week_ordinary_before integer,
  p_approved_minutes integer
) returns jsonb
language sql
immutable
set search_path = ''
as $$
  with input as (
    select
      greatest(0, coalesce(p_day_regular_before, 0)) as day_before,
      greatest(0, coalesce(p_shift_regular_minutes, 0)) as shift_regular,
      greatest(0, coalesce(p_week_ordinary_before, 0)) as week_before,
      greatest(0, coalesce(p_approved_minutes, 0)) as approved_minutes
  ),
  regular as (
    select
      *,
      least(shift_regular, greatest(0, 480 - day_before)) as shift_daily_ordinary,
      shift_regular - least(shift_regular, greatest(0, 480 - day_before)) as shift_daily_extra
    from input
  ),
  capped as (
    select
      *,
      least(shift_daily_ordinary, greatest(0, 2400 - week_before)) as regular_ordinary,
      shift_daily_ordinary - least(shift_daily_ordinary, greatest(0, 2400 - week_before)) as regular_weekly_extra,
      week_before + least(shift_daily_ordinary, greatest(0, 2400 - week_before)) as week_after_regular,
      day_before + shift_regular as day_total
    from regular
  ),
  approved as (
    select
      *,
      least(
        approved_minutes,
        greatest(0, 480 - day_total),
        greatest(0, 2400 - week_after_regular)
      ) as ordinary_minutes
    from capped
  )
  select jsonb_build_object(
    'ordinary_minutes', ordinary_minutes,
    'extraordinary_minutes', approved_minutes - ordinary_minutes,
    'regular_ordinary_minutes', regular_ordinary,
    'regular_extraordinary_minutes', shift_daily_extra + regular_weekly_extra,
    'week_ordinary_after', week_after_regular + ordinary_minutes,
    'day_regular_after', day_total
  )
  from approved;
$$;

revoke all on function public.classify_approved_additional_minutes(integer, integer, integer, integer) from public, anon;
grant execute on function public.classify_approved_additional_minutes(integer, integer, integer, integer) to authenticated;

create or replace function public.payroll_actual(p_from date, p_to date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_temp
as $$
declare
  museum uuid := public.current_user_museum_id();
  fiscal_start integer;
  expanded_from date;
  expanded_to date;
  history jsonb;
  budget_month text;
  budget_year integer;
  full_month boolean;
  person jsonb;
  day jsonb;
  rec record;
  remaining integer;
  payable integer;
  last_employee uuid;
  last_week date;
  week_start date;
  rate numeric;
  comp jsonb;
  amount numeric;
  state text;
  worked integer;
  plaza uuid;
  today date;
  month_cursor date;
  month_end date;
  salary_employee record;
  comp_end jsonb;
  week_ordinary integer;
  day_regular integer;
  current_day date;
  split jsonb;
begin
  if auth.uid() is null or museum is null
     or not public.has_permission('compensation.read')
     or not public.has_permission('attendance.history.read') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'INVALID_PERIOD' using errcode = '22023';
  end if;
  if (p_to - p_from) > 370 then
    raise exception 'RANGE_TOO_LONG' using errcode = '22023';
  end if;

  select m.fiscal_year_start_month into fiscal_start
  from public.museums m
  where m.id = museum;
  if fiscal_start is null or fiscal_start < 1 or fiscal_start > 12 then
    raise exception 'FISCAL_START_MISSING' using errcode = 'P0001';
  end if;

  expanded_from := p_from - (extract(isodow from p_from)::integer - 1);
  expanded_to := p_to + (7 - extract(isodow from p_to)::integer);
  history := public.list_attendance_history(expanded_from, expanded_to, true);

  budget_month := (array['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'])[extract(month from p_from)::integer];
  budget_year := case
    when extract(month from p_from)::integer >= fiscal_start then extract(year from p_from)::integer
    else extract(year from p_from)::integer - 1
  end;
  full_month := p_from = date_trunc('month', p_from)::date
    and p_to = (date_trunc('month', p_from) + interval '1 month' - interval '1 day')::date;

  create temp table if not exists payroll_shift_days (
    employee_id uuid,
    shift_id uuid,
    shift_date date,
    week_start date,
    sort_at timestamptz,
    worked_minutes integer,
    payable_minutes integer,
    over_limit_minutes integer,
    state text,
    hourly_rate numeric,
    amount numeric,
    plaza_id uuid,
    clock_in timestamptz,
    lunch_out timestamptz,
    lunch_in timestamptz,
    clock_out timestamptz,
    approved_minutes integer default 0,
    ordinary_approved_minutes integer default 0,
    extraordinary_approved_minutes integer default 0,
    regular_ordinary_minutes integer default 0,
    regular_extraordinary_minutes integer default 0,
    overtime_eligible boolean default true
  ) on commit drop;
  truncate payroll_shift_days;
  alter table payroll_shift_days add column if not exists approved_minutes integer default 0;
  alter table payroll_shift_days add column if not exists ordinary_approved_minutes integer default 0;
  alter table payroll_shift_days add column if not exists extraordinary_approved_minutes integer default 0;
  alter table payroll_shift_days add column if not exists regular_ordinary_minutes integer default 0;
  alter table payroll_shift_days add column if not exists regular_extraordinary_minutes integer default 0;
  alter table payroll_shift_days add column if not exists overtime_eligible boolean default true;

  create temp table if not exists payroll_monthly_salary (
    employee_id uuid,
    month_start date,
    amount numeric(12,2),
    plaza_id uuid,
    primary key (employee_id, month_start)
  ) on commit drop;
  truncate payroll_monthly_salary;

  for person in select value from jsonb_array_elements(history->'employees')
  loop
    for day in select value from jsonb_array_elements(person->'days')
    loop
      week_start := (day->>'shift_date')::date - (extract(isodow from (day->>'shift_date')::date)::integer - 1);
      if coalesce((day->>'shift_excluded')::boolean, false) then
        state := 'EXCLUIDA';
        worked := 0;
      elsif day->>'status' = 'INCONSISTENCIA' then
        state := 'PENDIENTE DE CORRECCIÓN';
        worked := 0;
      elsif day->>'status' = 'EN CURSO' then
        state := 'EN CURSO';
        worked := 0;
      elsif day->>'status' = 'SIN PONCHAR' then
        state := 'SIN PONCHAR';
        worked := 0;
      elsif day->>'status' = 'COMPLETA' then
        state := 'COMPLETA';
        worked := coalesce((day->>'regular_minutes')::integer, 0);
      else
        state := 'PENDIENTE DE CORRECCIÓN';
        worked := 0;
      end if;
      insert into payroll_shift_days (
        employee_id, shift_id, shift_date, week_start, sort_at, worked_minutes,
        payable_minutes, over_limit_minutes, state, clock_in, lunch_out, lunch_in, clock_out,
        approved_minutes
      ) values (
        (person->>'employee_id')::uuid,
        (day->>'shift_id')::uuid,
        (day->>'shift_date')::date,
        week_start,
        nullif(day->>'clock_in', '')::timestamptz,
        worked,
        0,
        0,
        state,
        nullif(day->>'clock_in', '')::timestamptz,
        nullif(day->>'lunch_out', '')::timestamptz,
        nullif(day->>'lunch_in', '')::timestamptz,
        nullif(day->>'clock_out', '')::timestamptz,
        case
          when state = 'COMPLETA' then coalesce((day->>'approved_overtime_minutes')::integer, 0)
          else 0
        end
      );
    end loop;
  end loop;

  remaining := 2400;
  last_employee := null;
  last_week := null;
  for rec in
    select d.employee_id, d.shift_id, d.week_start, d.worked_minutes
    from payroll_shift_days d
    where d.state = 'COMPLETA'
    order by d.employee_id, d.week_start, d.shift_date, d.sort_at nulls last, d.shift_id
  loop
    if last_employee is distinct from rec.employee_id or last_week is distinct from rec.week_start then
      remaining := 2400;
      last_employee := rec.employee_id;
      last_week := rec.week_start;
    end if;
    payable := least(rec.worked_minutes, remaining);
    remaining := remaining - payable;
    update payroll_shift_days
    set payable_minutes = payable,
        over_limit_minutes = rec.worked_minutes - payable
    where shift_id = rec.shift_id;
  end loop;

  week_ordinary := 0;
  day_regular := 0;
  current_day := null;
  last_employee := null;
  last_week := null;
  for rec in
    select d.employee_id, d.shift_id, d.shift_date, d.week_start, d.state, d.worked_minutes, d.approved_minutes
    from payroll_shift_days d
    order by d.employee_id, d.week_start, d.shift_date, d.sort_at nulls last, d.shift_id
  loop
    if last_employee is distinct from rec.employee_id or last_week is distinct from rec.week_start then
      week_ordinary := 0;
      day_regular := 0;
      current_day := null;
      last_employee := rec.employee_id;
      last_week := rec.week_start;
    end if;
    if current_day is distinct from rec.shift_date then
      day_regular := 0;
      current_day := rec.shift_date;
    end if;
    if rec.state is distinct from 'COMPLETA' then
      continue;
    end if;
    split := public.classify_approved_additional_minutes(day_regular, rec.worked_minutes, week_ordinary, rec.approved_minutes);
    week_ordinary := (split->>'week_ordinary_after')::integer;
    day_regular := (split->>'day_regular_after')::integer;
    update payroll_shift_days
    set ordinary_approved_minutes = (split->>'ordinary_minutes')::integer,
        extraordinary_approved_minutes = (split->>'extraordinary_minutes')::integer,
        regular_ordinary_minutes = (split->>'regular_ordinary_minutes')::integer,
        regular_extraordinary_minutes = (split->>'regular_extraordinary_minutes')::integer
    where shift_id = rec.shift_id;
  end loop;

  update payroll_shift_days d
  set hourly_rate = nullif(public.resolve_employee_compensation(museum, d.employee_id, d.shift_date)->>'hourly_rate', '')::numeric,
      overtime_eligible = coalesce((public.resolve_employee_compensation(museum, d.employee_id, d.shift_date)->>'overtime_eligible')::boolean, true),
      plaza_id = (
        select a.budget_line_id
        from public.employee_budget_assignments a
        where a.museum_id = museum
          and a.employee_id = d.employee_id
          and a.effective_from <= d.shift_date
          and (a.effective_until is null or a.effective_until >= d.shift_date)
      )
  where d.shift_date between p_from and p_to;

  update payroll_shift_days d
  set state = 'SIN TARIFA',
      amount = 0
  where d.shift_date between p_from and p_to
    and d.state = 'COMPLETA'
    and d.hourly_rate is null
    and not coalesce((
      select resolved.comp->>'compensation_type' = 'salary'
         and resolved.comp->>'salary_period' = 'monthly'
         and nullif(resolved.comp->>'salary_amount', '') is not null
      from (select public.resolve_employee_compensation(museum, d.employee_id, d.shift_date) as comp) resolved
    ), false);

  update payroll_shift_days d
  set amount = round((
    case
      when d.overtime_eligible then
        (d.regular_ordinary_minutes + d.ordinary_approved_minutes) * d.hourly_rate
        + (d.regular_extraordinary_minutes + d.extraordinary_approved_minutes) * d.hourly_rate * 1.5
      else (d.worked_minutes + d.approved_minutes) * d.hourly_rate
    end
  ) / 60.0, 2)
  where d.shift_date between p_from and p_to
    and d.state = 'COMPLETA'
    and d.hourly_rate is not null
    and not coalesce((
      select resolved.comp->>'compensation_type' = 'salary'
         and resolved.comp->>'salary_period' = 'monthly'
         and nullif(resolved.comp->>'salary_amount', '') is not null
      from (select public.resolve_employee_compensation(museum, d.employee_id, d.shift_date) as comp) resolved
    ), false);

  update payroll_shift_days d
  set amount = 0
  where d.shift_date between p_from and p_to
    and d.amount is null;

  today := (now() at time zone 'America/Puerto_Rico')::date;
  month_cursor := date_trunc('month', p_from)::date;
  if month_cursor < p_from then
    month_cursor := (month_cursor + interval '1 month')::date;
  end if;
  while month_cursor <= p_to loop
    month_end := (month_cursor + interval '1 month' - interval '1 day')::date;
    exit when month_end > p_to;
    if month_cursor <= today then
      for salary_employee in
        select e.id, e.hire_date
        from public.employees e
        where e.museum_id = museum
      loop
        comp := public.resolve_employee_compensation(museum, salary_employee.id, month_cursor);
        comp_end := public.resolve_employee_compensation(museum, salary_employee.id, month_end);
        if coalesce(comp->>'compensation_type', '') <> 'salary'
           and coalesce(comp_end->>'compensation_type', '') <> 'salary' then
          continue;
        end if;
        if comp is null or comp_end is null or (comp->>'id') is distinct from (comp_end->>'id') then
          raise exception 'SALARY_CHANGE_UNDEFINED' using errcode = 'P0001';
        end if;
        if comp->>'compensation_type' <> 'salary' then
          continue;
        end if;
        if nullif(comp->>'salary_period', '') is null or nullif(comp->>'salary_amount', '') is null then
          raise exception 'SALARY_CONFIGURATION_INCOMPLETE' using errcode = 'P0001';
        end if;
        if comp->>'salary_period' <> 'monthly' then
          raise exception 'SALARY_PERIOD_UNSUPPORTED' using errcode = 'P0001';
        end if;
        if salary_employee.hire_date is not null and salary_employee.hire_date > month_end then
          continue;
        end if;
        if salary_employee.hire_date is not null and salary_employee.hire_date > month_cursor then
          raise exception 'SALARY_HIRE_DATE_PARTIAL' using errcode = 'P0001';
        end if;
        insert into payroll_monthly_salary (employee_id, month_start, amount, plaza_id)
        values (
          salary_employee.id,
          month_cursor,
          (comp->>'salary_amount')::numeric(12,2),
          (
            select a.budget_line_id
            from public.employee_budget_assignments a
            where a.museum_id = museum
              and a.employee_id = salary_employee.id
              and a.effective_from <= month_end
              and (a.effective_until is null or a.effective_until >= month_end)
          )
        );
      end loop;
    end if;
    month_cursor := (month_cursor + interval '1 month')::date;
  end loop;

  update payroll_shift_days d
  set amount = 0
  from payroll_monthly_salary s
  where s.employee_id = d.employee_id
    and d.shift_date >= s.month_start
    and d.shift_date < (s.month_start + interval '1 month')::date;

  return jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'full_month', full_month,
    'budget_month', budget_month,
    'budget_year', budget_year,
    'fiscal_year_start_month', fiscal_start,
    'employees', coalesce((
      with people as (
        select d.employee_id
        from payroll_shift_days d
        where d.shift_date between p_from and p_to
        union
        select a.employee_id
        from public.employee_budget_assignments a
        where a.museum_id = museum
          and a.effective_from <= p_to
          and (a.effective_until is null or a.effective_until >= p_from)
        union
        select s.employee_id
        from payroll_monthly_salary s
      ),
      headers as (
        select
          p.employee_id,
          e.first_name || ' ' || e.last_name as name,
          e.position,
          e.status,
          nullif(public.resolve_employee_compensation(museum, p.employee_id, p_to)->>'hourly_rate', '')::numeric as hourly_rate,
          public.resolve_employee_compensation(museum, p.employee_id, p_to)->>'compensation_type' as compensation_type,
          nullif(public.resolve_employee_compensation(museum, p.employee_id, p_to)->>'standard_hours_week', '')::numeric as standard_hours_week,
          (
            select l.name
            from public.employee_budget_assignments a
            join public.finance_budget_lines l on l.id = a.budget_line_id
            where a.museum_id = museum
              and a.employee_id = p.employee_id
              and a.effective_from <= p_to
              and (a.effective_until is null or a.effective_until >= p_to)
          ) as plaza_on_last_day,
          (
            select count(distinct d.plaza_id)
            from payroll_shift_days d
            where d.employee_id = p.employee_id
              and d.shift_date between p_from and p_to
              and d.plaza_id is not null
              and d.amount <> 0
          ) as paid_plazas
        from people p
        join public.employees e on e.id = p.employee_id and e.museum_id = museum
      )
      select jsonb_agg(jsonb_build_object(
        'employee_id', h.employee_id,
        'name', h.name,
        'position', h.position,
        'employment_status', h.status,
        'plaza_name', case
          when h.paid_plazas > 1 then 'Varias plazas'
          else h.plaza_on_last_day
        end,
        'compensation_type', h.compensation_type,
        'hourly_rate', h.hourly_rate,
        'monthly_equivalent', case
          when h.hourly_rate is null then null
          else round(h.hourly_rate * coalesce(h.standard_hours_week, 40) * 52 / 12, 2)
        end,
        'worked_minutes', coalesce((select sum(d.worked_minutes) from payroll_shift_days d where d.employee_id = h.employee_id and d.shift_date between p_from and p_to), 0),
        'payable_minutes', coalesce((select sum(d.payable_minutes) from payroll_shift_days d where d.employee_id = h.employee_id and d.shift_date between p_from and p_to), 0),
        'over_limit_minutes', coalesce((select sum(d.over_limit_minutes) from payroll_shift_days d where d.employee_id = h.employee_id and d.shift_date between p_from and p_to), 0),
        'approved_minutes', coalesce((select sum(d.approved_minutes) from payroll_shift_days d where d.employee_id = h.employee_id and d.shift_date between p_from and p_to), 0),
        'ordinary_approved_minutes', coalesce((select sum(d.ordinary_approved_minutes) from payroll_shift_days d where d.employee_id = h.employee_id and d.shift_date between p_from and p_to), 0),
        'extraordinary_approved_minutes', coalesce((select sum(d.extraordinary_approved_minutes) from payroll_shift_days d where d.employee_id = h.employee_id and d.shift_date between p_from and p_to), 0),
        'regular_ordinary_minutes', coalesce((select sum(d.regular_ordinary_minutes) from payroll_shift_days d where d.employee_id = h.employee_id and d.shift_date between p_from and p_to), 0),
        'regular_extraordinary_minutes', coalesce((select sum(d.regular_extraordinary_minutes) from payroll_shift_days d where d.employee_id = h.employee_id and d.shift_date between p_from and p_to), 0),
        'actual_amount', coalesce((select sum(d.amount) from payroll_shift_days d where d.employee_id = h.employee_id and d.shift_date between p_from and p_to), 0) + coalesce((select sum(s.amount) from payroll_monthly_salary s where s.employee_id = h.employee_id), 0),
        'state', case
          when exists (select 1 from payroll_shift_days d where d.employee_id = h.employee_id and d.shift_date between p_from and p_to and d.state = 'PENDIENTE DE CORRECCIÓN') then 'PENDIENTE DE CORRECCIÓN'
          when exists (select 1 from payroll_monthly_salary s where s.employee_id = h.employee_id) then 'CALCULADA'
          when not exists (select 1 from payroll_monthly_salary s where s.employee_id = h.employee_id)
           and p_from <= (now() at time zone 'America/Puerto_Rico')::date
           and coalesce((
             select resolved.comp->>'compensation_type' = 'salary'
                and resolved.comp->>'salary_period' = 'monthly'
                and nullif(resolved.comp->>'salary_amount', '') is not null
             from (select public.resolve_employee_compensation(museum, h.employee_id, p_to) as comp) resolved
           ), false) then 'PERIODO PARCIAL'
          when exists (select 1 from payroll_shift_days d where d.employee_id = h.employee_id and d.shift_date between p_from and p_to and d.state = 'SIN TARIFA') then 'SIN TARIFA'
          when exists (select 1 from payroll_shift_days d where d.employee_id = h.employee_id and d.shift_date between p_from and p_to and d.state = 'EN CURSO') then 'EN CURSO'
          when exists (select 1 from payroll_shift_days d where d.employee_id = h.employee_id and d.shift_date between p_from and p_to and d.state = 'COMPLETA') then 'CALCULADA'
          when exists (select 1 from payroll_shift_days d where d.employee_id = h.employee_id and d.shift_date between p_from and p_to and d.state = 'EXCLUIDA') then 'EXCLUIDA'
          when exists (select 1 from payroll_shift_days d where d.employee_id = h.employee_id and d.shift_date between p_from and p_to and d.state = 'SIN PONCHAR') then 'SIN PONCHAR'
          else 'SIN TURNO'
        end,
        'days', coalesce((
          select jsonb_agg(jsonb_build_object(
            'shift_date', d.shift_date,
            'clock_in', d.clock_in,
            'lunch_out', d.lunch_out,
            'lunch_in', d.lunch_in,
            'clock_out', d.clock_out,
            'worked_minutes', d.worked_minutes,
            'payable_minutes', d.payable_minutes,
            'over_limit_minutes', d.over_limit_minutes,
            'approved_minutes', d.approved_minutes,
            'ordinary_approved_minutes', d.ordinary_approved_minutes,
            'extraordinary_approved_minutes', d.extraordinary_approved_minutes,
            'regular_ordinary_minutes', d.regular_ordinary_minutes,
            'regular_extraordinary_minutes', d.regular_extraordinary_minutes,
            'hourly_rate', d.hourly_rate,
            'amount', d.amount,
            'plaza_id', d.plaza_id,
            'plaza_name', l.name,
            'state', d.state
          ) order by d.shift_date, d.sort_at nulls last)
          from payroll_shift_days d
          left join public.finance_budget_lines l on l.id = d.plaza_id
          where d.employee_id = h.employee_id
            and d.shift_date between p_from and p_to
        ), '[]'::jsonb)
      ) order by h.name)
      from headers h
    ), '[]'::jsonb),
    'plazas', coalesce((
      with lines as (
        select l.id, l.name
        from public.finance_budget_lines l
        where l.museum_id = museum
          and l.record_type = 'expense'
          and l.category = 'Nómina'
      ),
      totals as (
        select d.plaza_id, d.employee_id, sum(d.amount) as actual_amount
        from payroll_shift_days d
        where d.shift_date between p_from and p_to
          and d.plaza_id is not null
        group by d.plaza_id, d.employee_id
      )
      select jsonb_agg(jsonb_build_object(
        'budget_line_id', l.id,
        'name', l.name,
        'budget_amount', coalesce((
          select r.amount
          from public.finance_records r
          where r.museum_id = museum
            and r.budget_line_id = l.id
            and r.month = budget_month
            and r.year = budget_year
        ), 0),
        'actual_amount', coalesce((select sum(t.actual_amount) from totals t where t.plaza_id = l.id), 0) + coalesce((select sum(s.amount) from payroll_monthly_salary s where s.plaza_id = l.id), 0),
        'difference', case
          when full_month then coalesce((
            select r.amount
            from public.finance_records r
            where r.museum_id = museum
              and r.budget_line_id = l.id
              and r.month = budget_month
              and r.year = budget_year
          ), 0) - coalesce((select sum(t.actual_amount) from totals t where t.plaza_id = l.id), 0) - coalesce((select sum(s.amount) from payroll_monthly_salary s where s.plaza_id = l.id), 0)
          else null
        end,
        'employees', coalesce((
          select jsonb_agg(jsonb_build_object(
            'employee_id', e.id,
            'name', e.first_name || ' ' || e.last_name,
            'actual_amount', coalesce(t.actual_amount, 0) + coalesce((select sum(s.amount) from payroll_monthly_salary s where s.employee_id = e.id and s.plaza_id = l.id), 0)
          ) order by e.last_name, e.first_name)
          from public.employees e
          left join totals t on t.employee_id = e.id and t.plaza_id = l.id
          where e.museum_id = museum
            and (
              t.employee_id is not null
              or exists (
                select 1 from public.employee_budget_assignments a
                where a.museum_id = museum
                  and a.budget_line_id = l.id
                  and a.employee_id = e.id
                  and a.effective_from <= p_to
                  and (a.effective_until is null or a.effective_until >= p_from)
              )
              or exists (
                select 1 from payroll_monthly_salary s
                where s.employee_id = e.id and s.plaza_id = l.id
              )
            )
        ), '[]'::jsonb)
      ) order by l.name)
      from lines l
    ), '[]'::jsonb),
    'unassigned', jsonb_build_object(
      'actual_amount', coalesce((
        select sum(d.amount)
        from payroll_shift_days d
        where d.shift_date between p_from and p_to
          and d.plaza_id is null
      ), 0) + coalesce((
        select sum(s.amount)
        from payroll_monthly_salary s
        where s.plaza_id is null
      ), 0),
      'employees', coalesce((
        select jsonb_agg(jsonb_build_object(
          'employee_id', e.id,
          'name', e.first_name || ' ' || e.last_name,
          'actual_amount', coalesce(days.day_amount, 0) + coalesce(salaries.salary_amount, 0)
        ) order by e.last_name, e.first_name)
        from public.employees e
        left join (
          select d.employee_id, sum(d.amount) as day_amount
          from payroll_shift_days d
          where d.shift_date between p_from and p_to
            and d.plaza_id is null
          group by d.employee_id
        ) days on days.employee_id = e.id
        left join (
          select s.employee_id, sum(s.amount) as salary_amount
          from payroll_monthly_salary s
          where s.plaza_id is null
          group by s.employee_id
        ) salaries on salaries.employee_id = e.id
        where e.museum_id = museum
          and (days.employee_id is not null or salaries.employee_id is not null)
      ), '[]'::jsonb)
    )
  );
end
$$;

revoke all on function public.payroll_actual(date, date) from public, anon;
grant execute on function public.payroll_actual(date, date) to authenticated;


create or replace function public.attendance_week_schedule_guard(
  p_museum uuid,
  p_employee uuid,
  p_shift_date date,
  p_shift_id uuid,
  p_starts timestamptz,
  p_ends timestamptz,
  p_lunch integer,
  p_reason text
) returns void
language plpgsql
set search_path = ''
as $$
declare
  week_start date := p_shift_date - (extract(isodow from p_shift_date)::integer - 1);
  added integer := greatest(0, floor(extract(epoch from (p_ends - p_starts)) / 60)::integer - greatest(coalesce(p_lunch, 0), 0));
  existing integer;
begin
  select coalesce(sum(greatest(0, floor(extract(epoch from (s.ends_at - s.starts_at)) / 60)::integer - greatest(coalesce(s.expected_lunch_minutes, 0), 0))), 0)
    into existing
  from public.employee_shifts s
  where s.museum_id = p_museum
    and s.employee_id = p_employee
    and s.status = 'scheduled'
    and s.shift_date between week_start and week_start + 6
    and s.id is distinct from p_shift_id;
  if existing + added > 2400
     and coalesce(p_reason, '') !~* 'autorizaci[oÃ³]n excepcional' then
    raise exception 'WEEKLY_SCHEDULE_LIMIT' using errcode = 'P0001';
  end if;
end
$$;

revoke all on function public.attendance_week_schedule_guard(uuid, uuid, date, uuid, timestamptz, timestamptz, integer, text) from public, anon, authenticated;

create or replace function public.list_weekly_hour_warnings(
  p_on date default null,
  p_employee_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  museum uuid := public.current_user_museum_id();
  anchor date := coalesce(p_on, (now() at time zone 'America/Puerto_Rico')::date);
  week_start date := anchor - (extract(isodow from anchor)::integer - 1);
begin
  if auth.uid() is null or museum is null
     or not (public.has_permission('schedules.manage') or public.has_permission('attendance.history.read')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return coalesce((
    with minutes as (
      select s.employee_id,
        coalesce(sum(greatest(0, floor(extract(epoch from (s.ends_at - s.starts_at)) / 60)::integer - greatest(coalesce(s.expected_lunch_minutes, 0), 0))), 0)::integer as scheduled_minutes
      from public.employee_shifts s
      where s.museum_id = museum
        and s.status = 'scheduled'
        and s.shift_date between week_start and week_start + 6
        and (p_employee_id is null or s.employee_id = p_employee_id)
      group by s.employee_id
    )
    select jsonb_agg(jsonb_build_object(
      'employee_id', e.id,
      'name', e.first_name || ' ' || e.last_name,
      'week_start', week_start,
      'scheduled_minutes', m.scheduled_minutes,
      'level', case when m.scheduled_minutes >= 2400 then 'limit' else 'approaching' end
    ) order by e.last_name, e.first_name)
    from minutes m
    join public.employees e on e.id = m.employee_id and e.museum_id = museum
    where m.scheduled_minutes >= 1920
  ), '[]'::jsonb);
end
$$;

revoke all on function public.list_weekly_hour_warnings(date, uuid) from public, anon;
grant execute on function public.list_weekly_hour_warnings(date, uuid) to authenticated;


create or replace function public.schedule_employee_shift(
  p_employee_id uuid,
  p_shift_date date,
  p_starts_local time,
  p_ends_local time,
  p_shift_id uuid default null,
  p_expected_lunch_minutes integer default null,
  p_set_lunch boolean default false,
  p_shift_type text default null,
  p_expected_updated_at timestamptz default null,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  museum uuid;
  employee_row public.employees;
  shift_row public.employee_shifts;
  tz text;
  v_start timestamptz;
  v_end timestamptz;
  v_lunch integer;
  v_type text;
  v_reason text;
  changed boolean;
  was_day_off boolean;
  old_value jsonb;
begin
  if auth.uid() is null or not public.has_permission('schedules.manage') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  museum := public.current_user_museum_id();
  if museum is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into employee_row
    from public.employees
   where id = p_employee_id and museum_id = museum;
  if not found or employee_row.status <> 'activo' then
    raise exception 'EMPLOYEE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if employee_row.profile_id is not distinct from auth.uid() then
    raise exception 'SHIFT_SELF_FORBIDDEN' using errcode = '42501';
  end if;
  if p_shift_date is null or p_starts_local is null or p_ends_local is null or p_ends_local = p_starts_local then
    raise exception 'INVALID_SHIFT_HOURS' using errcode = '22023';
  end if;
  if p_shift_type is not null and p_shift_type not in ('regular', 'night', 'special_activity', 'weekend', 'extraordinary') then
    raise exception 'INVALID_SHIFT_TYPE' using errcode = '22023';
  end if;
  if coalesce(p_set_lunch, false) and p_expected_lunch_minutes is not null and p_expected_lunch_minutes < 0 then
    raise exception 'INVALID_LUNCH' using errcode = '22023';
  end if;
  tz := public.attendance_shift_timezone(museum);
  v_start := (p_shift_date + p_starts_local) at time zone tz;
  if p_ends_local > p_starts_local then
    v_end := (p_shift_date + p_ends_local) at time zone tz;
  else
    v_end := ((p_shift_date + 1) + p_ends_local) at time zone tz;
  end if;
  if v_start <= now() then
    raise exception 'SHIFT_LOCKED' using errcode = 'P0001';
  end if;
  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  perform public.attendance_lock_shift_date(p_employee_id, p_shift_date);

  if p_shift_id is null then
    if exists (
      select 1 from public.employee_shifts
       where museum_id = museum and employee_id = p_employee_id
         and shift_date = p_shift_date and status = 'day_off'
    ) then
      raise exception 'SHIFT_CHANGED_RELOAD' using errcode = 'P0001';
    end if;
    v_lunch := case
      when coalesce(p_set_lunch, false) then p_expected_lunch_minutes
      else public.attendance_inherit_lunch(museum, p_employee_id)
    end;
    v_type := coalesce(p_shift_type, 'regular');
    perform public.attendance_week_schedule_guard(museum, p_employee_id, p_shift_date, null, v_start, v_end, v_lunch, v_reason);
    begin
      insert into public.employee_shifts(
        museum_id, employee_id, shift_date, starts_at, ends_at, shift_type,
        expected_lunch_minutes, status, created_by
      ) values (
        museum, p_employee_id, p_shift_date, v_start, v_end, v_type,
        v_lunch, 'scheduled', auth.uid()
      ) returning * into shift_row;
    exception
      when exclusion_violation then
        raise exception 'SHIFT_OVERLAP' using errcode = '23P01';
      when unique_violation then
        if sqlerrm ilike '%employee_shifts_one_day_off%' then
          raise exception 'DAY_OFF_EXISTS' using errcode = '23505';
        end if;
        raise;
    end;
    perform public.attendance_write_shift_audit(
      museum, 'SHIFT_SCHEDULED', shift_row.id, null,
      public.attendance_shift_value(
        p_employee_id, shift_row.id, shift_row.shift_date, shift_row.status,
        shift_row.starts_at, shift_row.ends_at, shift_row.expected_lunch_minutes, shift_row.shift_type, v_reason
      )
    );
  else
    select * into shift_row
      from public.employee_shifts
     where id = p_shift_id and museum_id = museum and employee_id = p_employee_id
     for update;
    if not found then
      raise exception 'SHIFT_NOT_FOUND' using errcode = 'P0002';
    end if;
    if shift_row.updated_at is distinct from p_expected_updated_at then
      raise exception 'SHIFT_CHANGED_RELOAD' using errcode = 'P0001';
    end if;
    if shift_row.status = 'day_off' and shift_row.shift_date is distinct from p_shift_date then
      raise exception 'SHIFT_DATE_MISMATCH' using errcode = '22023';
    end if;
    if shift_row.status not in ('scheduled', 'day_off') then
      raise exception 'SHIFT_LOCKED' using errcode = 'P0001';
    end if;
    if shift_row.status = 'scheduled' and shift_row.shift_date is distinct from p_shift_date then
      perform public.attendance_lock_shift_date(p_employee_id, shift_row.shift_date);
    end if;
    was_day_off := shift_row.status = 'day_off';
    v_type := coalesce(p_shift_type, shift_row.shift_type);
    if coalesce(p_set_lunch, false) then
      v_lunch := p_expected_lunch_minutes;
    elsif shift_row.status = 'scheduled' then
      v_lunch := shift_row.expected_lunch_minutes;
    else
      v_lunch := public.attendance_inherit_lunch(museum, p_employee_id);
    end if;
    changed := was_day_off
      or shift_row.starts_at is distinct from v_start
      or shift_row.ends_at is distinct from v_end
      or shift_row.shift_date is distinct from p_shift_date
      or shift_row.expected_lunch_minutes is distinct from v_lunch
      or shift_row.shift_type is distinct from v_type;
    if not was_day_off and changed and v_reason is null then
      raise exception 'REASON_REQUIRED' using errcode = '22023';
    end if;
    if not changed then
      return public.attendance_shift_json(
        shift_row.id, shift_row.status, shift_row.shift_date, shift_row.starts_at, shift_row.ends_at,
        shift_row.expected_lunch_minutes, shift_row.shift_type, shift_row.updated_at, tz
      );
    end if;
    perform public.attendance_week_schedule_guard(museum, p_employee_id, p_shift_date, p_shift_id, v_start, v_end, v_lunch, v_reason);
    old_value := public.attendance_shift_value(
      shift_row.employee_id, shift_row.id, shift_row.shift_date, shift_row.status,
      shift_row.starts_at, shift_row.ends_at, shift_row.expected_lunch_minutes, shift_row.shift_type, v_reason
    );
    begin
      update public.employee_shifts
         set starts_at = v_start,
             ends_at = v_end,
             shift_date = p_shift_date,
             status = 'scheduled',
             shift_type = v_type,
             expected_lunch_minutes = v_lunch,
             updated_at = now()
       where id = shift_row.id
       returning * into shift_row;
    exception
      when exclusion_violation then
        raise exception 'SHIFT_OVERLAP' using errcode = '23P01';
    end;
    perform public.attendance_write_shift_audit(
      museum,
      case when was_day_off then 'SHIFT_SCHEDULED' else 'SHIFT_HOURS_CHANGED' end,
      shift_row.id,
      old_value,
      public.attendance_shift_value(
        shift_row.employee_id, shift_row.id, shift_row.shift_date, shift_row.status,
        shift_row.starts_at, shift_row.ends_at, shift_row.expected_lunch_minutes, shift_row.shift_type, v_reason
      )
    );
  end if;

  return public.attendance_shift_json(
    shift_row.id, shift_row.status, shift_row.shift_date, shift_row.starts_at, shift_row.ends_at,
    shift_row.expected_lunch_minutes, shift_row.shift_type, shift_row.updated_at, tz
  );
end $$;


