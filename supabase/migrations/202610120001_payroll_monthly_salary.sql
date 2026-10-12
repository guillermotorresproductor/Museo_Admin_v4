-- Monthly salary is recognized once per complete calendar month already started.
-- It does not prorate, convert the salary to an hourly rate, or invent hours.
-- Revert by restoring the previous payroll_actual definition.

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
    clock_out timestamptz
  ) on commit drop;
  truncate payroll_shift_days;

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
        payable_minutes, over_limit_minutes, state, clock_in, lunch_out, lunch_in, clock_out
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
        nullif(day->>'clock_out', '')::timestamptz
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

  update payroll_shift_days d
  set hourly_rate = nullif(public.resolve_employee_compensation(museum, d.employee_id, d.shift_date)->>'hourly_rate', '')::numeric,
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
  set amount = round(d.payable_minutes * d.hourly_rate / 60.0, 2)
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
