-- Production deploy for Nómina real. Do not register this file as a migration.
-- Does not write finance_records. Does not update the existing compensation rows.
-- Audit inserts use audit_logs.user_id.
begin;

do $deploy_guard$
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
begin
  select m.id, m.fiscal_year_start_month into museum, fiscal
  from public.museums m
  where m.slug = 'museo-musica-pr';
  if museum is distinct from 'a1f597f7-44a2-44b2-9214-93364c2a12ff'::uuid then
    raise exception 'DEPLOY_ABORT museum';
  end if;
  if fiscal is distinct from 9 then
    raise exception 'DEPLOY_ABORT fiscal_year_start_month';
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
    raise exception 'DEPLOY_ABORT finance_records';
  end if;

  select count(*), count(distinct employee_id)
    into compensation_rows, compensation_employees
  from public.employee_compensation;
  if compensation_rows is distinct from 5 or compensation_employees is distinct from 5 then
    raise exception 'DEPLOY_ABORT compensation_count';
  end if;

  if to_regprocedure('public.payroll_actual(date,date)') is not null then
    raise exception 'DEPLOY_ABORT payroll_actual_already_exists';
  end if;
  if to_regclass('public.employee_budget_assignments') is not null then
    raise exception 'DEPLOY_ABORT assignments_already_exist';
  end if;
end
$deploy_guard$;

drop function if exists public.list_attendance_history(date, date);

create function public.list_attendance_history(
  p_from date,
  p_to date,
  p_include_former boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  museum uuid := public.current_user_museum_id();
begin
  if auth.uid() is null or museum is null or not public.has_permission('attendance.history.read') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'INVALID_PERIOD' using errcode = '22023';
  end if;
  if (p_to - p_from) > 365 then
    raise exception 'RANGE_TOO_LONG' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'employees', coalesce((
      with shifts as (
        select s.id, s.employee_id, s.starts_at, s.ends_at,
               (s.starts_at at time zone 'America/Puerto_Rico')::date as shift_date
        from public.employee_shifts s
        where s.museum_id = museum
          and s.status = 'scheduled'
          and (s.starts_at at time zone 'America/Puerto_Rico')::date between p_from and p_to
      ),
      effective as (
        select ev.shift_id, ev.event_type, ev.occurred_at, ev.classification,
               public.attendance_is_excluded(ev.shift_id, ev.id) as is_excluded
        from public.attendance_events ev
        join shifts s on s.id = ev.shift_id
        where ev.museum_id = museum
          and not exists (
            select 1 from public.attendance_events newer
            where newer.supersedes_event_id = ev.id
          )
      ),
      corrected as (
        select distinct ev.shift_id
        from public.attendance_events ev
        join shifts s on s.id = ev.shift_id
        where ev.museum_id = museum
          and (ev.correction_request_id is not null or ev.supersedes_event_id is not null)
      ),
      picked as (
        select
          s.id as shift_id,
          s.employee_id,
          s.shift_date,
          s.starts_at,
          s.ends_at,
          max(ev.occurred_at) filter (where ev.event_type = 'clock_in' and not ev.is_excluded) as clock_in,
          max(ev.occurred_at) filter (where ev.event_type = 'lunch_out' and not ev.is_excluded) as lunch_out,
          max(ev.occurred_at) filter (where ev.event_type = 'lunch_in' and not ev.is_excluded) as lunch_in,
          max(ev.occurred_at) filter (where ev.event_type = 'clock_out' and not ev.is_excluded) as clock_out,
          max(ev.occurred_at) filter (where ev.event_type = 'clock_in') as visible_clock_in,
          max(ev.occurred_at) filter (where ev.event_type = 'lunch_out') as visible_lunch_out,
          max(ev.occurred_at) filter (where ev.event_type = 'lunch_in') as visible_lunch_in,
          max(ev.occurred_at) filter (where ev.event_type = 'clock_out') as visible_clock_out,
          coalesce(bool_or(ev.is_excluded) filter (where ev.event_type = 'clock_in'), false) as clock_in_excluded,
          coalesce(bool_or(ev.is_excluded) filter (where ev.event_type = 'lunch_out'), false) as lunch_out_excluded,
          coalesce(bool_or(ev.is_excluded) filter (where ev.event_type = 'lunch_in'), false) as lunch_in_excluded,
          coalesce(bool_or(ev.is_excluded) filter (where ev.event_type = 'clock_out'), false) as clock_out_excluded,
          public.attendance_is_excluded(s.id, null) as shift_excluded,
          (array_agg(ev.classification order by ev.occurred_at desc) filter (where ev.event_type = 'clock_in' and not ev.is_excluded))[1] as clock_in_classification,
          count(*) filter (where ev.event_type = 'clock_in' and not ev.is_excluded) as clock_in_count,
          count(*) filter (where ev.event_type = 'lunch_out' and not ev.is_excluded) as lunch_out_count,
          count(*) filter (where ev.event_type = 'lunch_in' and not ev.is_excluded) as lunch_in_count,
          count(*) filter (where ev.event_type = 'clock_out' and not ev.is_excluded) as clock_out_count,
          count(*) filter (where ev.event_type not in ('clock_in','lunch_out','lunch_in','clock_out') and not ev.is_excluded) as unknown_count,
          exists(select 1 from corrected c where c.shift_id = s.id) as corrected
        from shifts s
        left join effective ev on ev.shift_id = s.id
        group by s.id, s.employee_id, s.shift_date, s.starts_at, s.ends_at, public.attendance_is_excluded(s.id, null)
      ),
      classified as (
        select
          p.*,
          (
            p.clock_in_count > 1 or p.lunch_out_count > 1 or p.lunch_in_count > 1 or p.clock_out_count > 1
            or p.unknown_count > 0
            or (p.lunch_out is not null and p.clock_in is null)
            or (p.lunch_in is not null and p.lunch_out is null)
            or (p.clock_out is not null and p.clock_in is null)
            or (p.lunch_out is not null and p.clock_in is not null and p.lunch_out < p.clock_in)
            or (p.lunch_in is not null and p.lunch_out is not null and p.lunch_in < p.lunch_out)
            or (p.clock_out is not null and p.lunch_out is not null and p.lunch_in is null)
            or (p.clock_out is not null and p.lunch_in is not null and p.clock_out < p.lunch_in)
            or (p.clock_out is not null and p.lunch_out is null and p.clock_in is not null and p.clock_out < p.clock_in)
          ) as inconsistent,
          (
            p.ends_at <= now()
            and p.clock_in is not null
            and (
              p.clock_out is null
              or (p.lunch_out is not null and p.lunch_in is null)
              or (p.lunch_in is not null and p.lunch_out is null)
            )
          ) as incomplete,
          case when p.shift_excluded then 0 else coalesce(ot.approved_minutes, 0) end as approved_overtime_minutes
        from picked p
        left join public.attendance_overtime_reviews ot
          on ot.shift_id = p.shift_id
         and ot.museum_id = museum
         and ot.status in ('approved','partially_approved')
         and not p.shift_excluded
         and not public.attendance_is_excluded(p.shift_id, ot.clock_out_event_id)
      ),
      timed as (
        select
          c.*,
          case
            when c.inconsistent then 'INCONSISTENCIA'
            when c.incomplete then 'INCONSISTENCIA'
            when c.clock_in is null
             and c.ends_at <= now()
             and c.visible_clock_in is not null
             and (
               c.visible_clock_out is null
               or (c.visible_lunch_out is not null and c.visible_lunch_in is null)
               or (c.visible_lunch_in is not null and c.visible_lunch_out is null)
             ) then 'INCONSISTENCIA'
            when c.clock_in is null then 'SIN PONCHAR'
            when c.clock_out is null and c.ends_at > now() then 'EN CURSO'
            else 'COMPLETA'
          end as status,
          case
            when c.inconsistent or c.clock_in is null then 0
            when c.clock_out is null and c.ends_at <= now() then
              case
                when c.lunch_out is null then 0
                else greatest(0, floor(extract(epoch from (least(c.lunch_out, c.ends_at) - greatest(c.clock_in, c.starts_at))) / 60))::integer
              end
            else
              greatest(0, floor(extract(epoch from (
                least(coalesce(c.lunch_out, coalesce(c.clock_out, now())), coalesce(c.clock_out, now()), c.ends_at)
                - greatest(c.clock_in, c.starts_at)
              )) / 60))::integer
              + case
                  when c.lunch_in is null or c.lunch_in >= c.ends_at then 0
                  else greatest(0, floor(extract(epoch from (
                    least(coalesce(c.clock_out, now()), c.ends_at) - greatest(c.lunch_in, c.starts_at)
                  )) / 60))::integer
                end
          end as regular_minutes
        from classified c
      ),
      days as (
        select
          t.employee_id,
          jsonb_agg(jsonb_build_object(
            'shift_id', t.shift_id,
            'shift_date', t.shift_date,
            'shift_excluded', t.shift_excluded,
            'clock_in', t.visible_clock_in,
            'lunch_out', t.visible_lunch_out,
            'lunch_in', t.visible_lunch_in,
            'clock_out', t.visible_clock_out,
            'clock_in_excluded', t.clock_in_excluded,
            'lunch_out_excluded', t.lunch_out_excluded,
            'lunch_in_excluded', t.lunch_in_excluded,
            'clock_out_excluded', t.clock_out_excluded,
            'regular_minutes', t.regular_minutes,
            'approved_overtime_minutes', t.approved_overtime_minutes,
            'status', t.status,
            'corrected', t.corrected,
            'late', t.clock_in_classification in ('late','partial_absence')
          ) order by t.shift_date, t.starts_at) as day_rows,
          count(*)::integer as scheduled_days,
          count(*) filter (where t.clock_in is not null or t.lunch_out is not null or t.lunch_in is not null or t.clock_out is not null)::integer as days_with_punches,
          coalesce(sum(t.regular_minutes), 0)::integer as regular_minutes,
          coalesce(sum(t.approved_overtime_minutes), 0)::integer as approved_overtime_minutes,
          count(*) filter (where t.clock_in_classification in ('late','partial_absence'))::integer as late_days,
          count(*) filter (where t.inconsistent or t.incomplete)::integer as incident_days,
          count(*) filter (where t.corrected)::integer as corrected_days
        from timed t
        group by t.employee_id
      )
      select jsonb_agg(jsonb_build_object(
        'employee_id', e.id,
        'name', e.first_name || ' ' || e.last_name,
        'scheduled_days', d.scheduled_days,
        'days_with_punches', d.days_with_punches,
        'regular_minutes', d.regular_minutes,
        'approved_overtime_minutes', d.approved_overtime_minutes,
        'late_days', d.late_days,
        'incident_days', d.incident_days,
        'corrected_days', d.corrected_days,
        'days', d.day_rows
      ) order by e.last_name, e.first_name)
      from days d
      join public.employees e on e.id = d.employee_id and e.museum_id = museum
        and (p_include_former or e.status = 'activo')
    ), '[]'::jsonb)
  );
end
$$;


revoke all on function public.list_attendance_history(date, date, boolean) from public, anon;
grant execute on function public.list_attendance_history(date, date, boolean) to authenticated;

create table public.employee_budget_assignments (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  budget_line_id uuid not null references public.finance_budget_lines(id) on delete restrict,
  effective_from date not null,
  effective_until date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (effective_until is null or effective_until >= effective_from)
);

create index employee_budget_assignments_employee_idx
  on public.employee_budget_assignments (museum_id, employee_id, effective_from);

create index employee_budget_assignments_line_idx
  on public.employee_budget_assignments (museum_id, budget_line_id, effective_from);

create or replace function public.employee_budget_assignments_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'ASSIGNMENT_HISTORY_IMMUTABLE' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then
    if new.employee_id is distinct from old.employee_id
       or new.budget_line_id is distinct from old.budget_line_id
       or new.effective_from is distinct from old.effective_from
       or new.museum_id is distinct from old.museum_id
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at
       or new.id is distinct from old.id then
      raise exception 'ASSIGNMENT_HISTORY_IMMUTABLE' using errcode = 'P0001';
    end if;
    if old.effective_until is not null and new.effective_until is distinct from old.effective_until then
      raise exception 'ASSIGNMENT_ALREADY_CLOSED' using errcode = 'P0001';
    end if;
  end if;
  if exists (
    select 1
    from public.employee_budget_assignments other
    where other.employee_id = new.employee_id
      and other.id is distinct from new.id
      and daterange(other.effective_from, coalesce(other.effective_until, '9999-12-31'::date), '[]')
          && daterange(new.effective_from, coalesce(new.effective_until, '9999-12-31'::date), '[]')
  ) then
    raise exception 'EMPLOYEE_PLAZA_OVERLAP' using errcode = 'P0001';
  end if;
  return new;
end
$$;

create trigger employee_budget_assignments_guard
before insert or update or delete on public.employee_budget_assignments
for each row execute function public.employee_budget_assignments_guard();

alter table public.employee_budget_assignments enable row level security;
revoke all on public.employee_budget_assignments from public, anon, authenticated;
grant select on public.employee_budget_assignments to authenticated;

create policy employee_budget_assignments_read
on public.employee_budget_assignments
for select
to authenticated
using (
  museum_id = public.current_user_museum_id()
  and public.has_permission('compensation.read')
  and public.has_permission('attendance.history.read')
);

revoke all on function public.employee_budget_assignments_guard() from public, anon, authenticated;

create or replace function public.assign_employee_budget_line(
  p_employee_id uuid,
  p_budget_line_id uuid,
  p_effective_from date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  museum uuid := public.current_user_museum_id();
  saved public.employee_budget_assignments;
begin
  if auth.uid() is null or museum is null or not public.has_permission('compensation.manage') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_effective_from is null then
    raise exception 'EFFECTIVE_FROM_REQUIRED' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.employees e
    where e.id = p_employee_id and e.museum_id = museum
  ) then
    raise exception 'EMPLOYEE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.finance_budget_lines l
    where l.id = p_budget_line_id
      and l.museum_id = museum
      and l.record_type = 'expense'
      and l.category = 'Nómina'
  ) then
    raise exception 'PAYROLL_LINE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.employee_budget_assignments a
    where a.museum_id = museum
      and a.employee_id = p_employee_id
      and daterange(a.effective_from, coalesce(a.effective_until, '9999-12-31'::date), '[]')
          && daterange(p_effective_from, '9999-12-31'::date, '[]')
  ) then
    raise exception 'EMPLOYEE_PLAZA_OVERLAP' using errcode = 'P0001';
  end if;

  insert into public.employee_budget_assignments (
    museum_id, employee_id, budget_line_id, effective_from, created_by
  ) values (
    museum, p_employee_id, p_budget_line_id, p_effective_from, auth.uid()
  ) returning * into saved;

  insert into public.audit_logs (museum_id, user_id, action, table_name, record_id, new_value)
  values (
    museum, auth.uid(), 'EMPLOYEE_BUDGET_LINE_ASSIGNED', 'employee_budget_assignments', saved.id,
    jsonb_build_object('employee_id', p_employee_id, 'budget_line_id', p_budget_line_id, 'effective_from', p_effective_from)
  );

  return to_jsonb(saved);
end
$$;

create or replace function public.close_employee_budget_assignment(
  p_employee_id uuid,
  p_effective_until date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  museum uuid := public.current_user_museum_id();
  saved public.employee_budget_assignments;
begin
  if auth.uid() is null or museum is null or not public.has_permission('compensation.manage') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_effective_until is null then
    raise exception 'EFFECTIVE_UNTIL_REQUIRED' using errcode = 'P0001';
  end if;
  update public.employee_budget_assignments
  set effective_until = p_effective_until
  where museum_id = museum
    and employee_id = p_employee_id
    and effective_until is null
    and effective_from <= p_effective_until
  returning * into saved;
  if saved.id is null then
    raise exception 'OPEN_ASSIGNMENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  return to_jsonb(saved);
end
$$;

revoke all on function public.assign_employee_budget_line(uuid, uuid, date) from public, anon;
revoke all on function public.close_employee_budget_assignment(uuid, date) from public, anon;
grant execute on function public.assign_employee_budget_line(uuid, uuid, date) to authenticated;
grant execute on function public.close_employee_budget_assignment(uuid, date) to authenticated;

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
    and d.hourly_rate is null;

  update payroll_shift_days d
  set amount = round(d.payable_minutes * d.hourly_rate / 60.0, 2)
  where d.shift_date between p_from and p_to
    and d.state = 'COMPLETA'
    and d.hourly_rate is not null;

  update payroll_shift_days d
  set amount = 0
  where d.shift_date between p_from and p_to
    and d.amount is null;

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
        'actual_amount', coalesce((select sum(d.amount) from payroll_shift_days d where d.employee_id = h.employee_id and d.shift_date between p_from and p_to), 0),
        'state', case
          when exists (select 1 from payroll_shift_days d where d.employee_id = h.employee_id and d.shift_date between p_from and p_to and d.state = 'PENDIENTE DE CORRECCIÓN') then 'PENDIENTE DE CORRECCIÓN'
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
        'actual_amount', coalesce((select sum(t.actual_amount) from totals t where t.plaza_id = l.id), 0),
        'difference', case
          when full_month then coalesce((
            select r.amount
            from public.finance_records r
            where r.museum_id = museum
              and r.budget_line_id = l.id
              and r.month = budget_month
              and r.year = budget_year
          ), 0) - coalesce((select sum(t.actual_amount) from totals t where t.plaza_id = l.id), 0)
          else null
        end,
        'employees', coalesce((
          select jsonb_agg(jsonb_build_object(
            'employee_id', e.id,
            'name', e.first_name || ' ' || e.last_name,
            'actual_amount', coalesce(t.actual_amount, 0)
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
      ), 0),
      'employees', coalesce((
        select jsonb_agg(jsonb_build_object(
          'employee_id', e.id,
          'name', e.first_name || ' ' || e.last_name,
          'actual_amount', s.actual_amount
        ) order by e.last_name, e.first_name)
        from (
          select d.employee_id, sum(d.amount) as actual_amount
          from payroll_shift_days d
          where d.shift_date between p_from and p_to
            and d.plaza_id is null
          group by d.employee_id
        ) s
        join public.employees e on e.id = s.employee_id and e.museum_id = museum
      ), '[]'::jsonb)
    )
  );
end
$$;

revoke all on function public.payroll_actual(date, date) from public, anon;
grant execute on function public.payroll_actual(date, date) to authenticated;


-- Production already has compensation history. Refuse to alter those rows.
do $compensation_history_guard$
begin
  if exists (
    select 1 from pg_constraint
    where confrelid = 'public.employee_compensation'::regclass
  ) then
    raise exception 'COMPENSATION_REFERENCED';
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
    where conrelid = 'public.employee_compensation'::regclass
      and contype = 'p'
      and pg_get_constraintdef(oid) = 'PRIMARY KEY (id)'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employee_compensation'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (museum_id, employee_id, effective_from)'
  ) then
    raise exception 'COMPENSATION_HISTORY_REQUIRED';
  end if;
end
$compensation_history_guard$;

create or replace function public.resolve_employee_compensation(p_museum_id uuid, p_employee_id uuid, p_on date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(c)
  from public.employee_compensation c
  where c.museum_id = p_museum_id
    and c.employee_id = p_employee_id
    and c.effective_from <= p_on
  order by c.effective_from desc
  limit 1;
$$;

revoke all on function public.resolve_employee_compensation(uuid, uuid, date) from public, anon, authenticated;

do $compensation_access$
declare
  src text;
  patched text;
  pos integer;
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
  if pos = 0 then
    raise exception 'HAS_PERMISSION_PATCH_FAILED';
  end if;
  patched := overlay(src placing E'\nbegin' || grant_sql from pos for 6);
  if patched = src or position('employee_compensation_access' in patched) = 0 then
    raise exception 'HAS_PERMISSION_PATCH_FAILED';
  end if;
  execute patched;
end
$compensation_access$;

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

  insert into public.audit_logs (museum_id, user_id, action, table_name, record_id, old_value, new_value)
  values (
    museum, auth.uid(), 'EMPLOYEE_COMPENSATION_CREATED', 'employee_compensation', saved.id,
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
    )
  );

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
commit;

