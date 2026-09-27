-- Exclude or restore a punch or a whole shift without deleting evidence.
-- attendance_exclusions is the only authority. employee_time_entries.excluded_at
-- is an operational projection written by set_attendance_exclusion and by the
-- punch function when the shift is already excluded.

insert into public.permissions(code, description, sensitivity)
values ('attendance.exclusions.manage', 'Excluir o restaurar ponches y jornadas del museo', 'critical')
on conflict (code) do update set description = excluded.description, sensitivity = excluded.sensitivity;

do $patch$
declare src text; patched text; pos integer;
  grant_sql text := $grant$
 -- attendance_exclusions_manage: deny wins, then only two profiles.
 if requested_permission = 'attendance.exclusions.manage'
    and exists(
      select 1 from public.user_permissions u
      join public.permissions p on p.id = u.permission_id
      where u.user_id = auth.uid()
        and u.museum_id = public.current_user_museum_id()
        and p.code = 'attendance.exclusions.manage'
        and u.effect = 'deny'
        and (u.valid_until is null or u.valid_until > now())
    ) then
   return false;
 end if;
 if requested_permission = 'attendance.exclusions.manage'
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
  src := replace(pg_get_functiondef('public.has_permission(text)'::regprocedure), E'\r\n', E'\n');
  if position('attendance_exclusions_manage' in src) > 0 then
    return;
  end if;
  pos := position(E'\nbegin' in src);
  if pos = 0 then raise exception 'HAS_PERMISSION_PATCH_FAILED'; end if;
  patched := overlay(src placing E'\nbegin' || grant_sql from pos for 6);
  if patched = src or position('attendance_exclusions_manage' in patched) = 0 then
    raise exception 'HAS_PERMISSION_PATCH_FAILED';
  end if;
  execute patched;
end
$patch$;

create table if not exists public.attendance_exclusions (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  shift_id uuid not null references public.employee_shifts(id) on delete restrict,
  event_id uuid references public.attendance_events(id) on delete restrict,
  scope text not null check (scope in ('event','shift')),
  action text not null check (action in ('exclude','restore')),
  motive text not null check (motive in (
    'system_test','duplicate_punch','mistaken_punch','incorrect_admin_record','other'
  )),
  explanation text,
  acted_by uuid not null references public.profiles(id),
  acted_at timestamptz not null default clock_timestamp(),
  check ((scope = 'shift' and event_id is null) or (scope = 'event' and event_id is not null)),
  check (motive is distinct from 'other' or length(trim(coalesce(explanation, ''))) > 0)
);

create index if not exists attendance_exclusions_shift_idx
  on public.attendance_exclusions(shift_id, scope, acted_at desc, id desc);
create index if not exists attendance_exclusions_event_idx
  on public.attendance_exclusions(event_id, acted_at desc, id desc)
  where event_id is not null;

alter table public.attendance_exclusions
  alter column acted_at set default clock_timestamp();

create or replace function public.prevent_attendance_exclusion_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'ATTENDANCE_EXCLUSION_HISTORY_IMMUTABLE' using errcode = 'P0001';
end
$$;

drop trigger if exists attendance_exclusions_no_change on public.attendance_exclusions;
create trigger attendance_exclusions_no_change
before update or delete on public.attendance_exclusions
for each row execute function public.prevent_attendance_exclusion_change();

alter table public.attendance_exclusions enable row level security;
revoke all on public.attendance_exclusions from public, anon, authenticated;
revoke all on function public.prevent_attendance_exclusion_change() from public, anon, authenticated;

alter table public.employee_time_entries
  add column if not exists excluded_at timestamptz;

comment on column public.employee_time_entries.excluded_at is
  'Projection of attendance_exclusions. Not an independent source of truth.';

drop index if exists public.employee_time_entries_one_open;
create unique index employee_time_entries_one_open
  on public.employee_time_entries(employee_id)
  where clock_out is null and excluded_at is null;

do $overtime_status$
declare cname text;
begin
  select con.conname into cname
  from pg_constraint con
  where con.conrelid = 'public.attendance_overtime_reviews'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%pending%'
    and pg_get_constraintdef(con.oid) ilike '%rejected%';
  if cname is not null and position('cancelled_by_exclusion' in pg_get_constraintdef((
    select oid from pg_constraint where conname = cname and conrelid = 'public.attendance_overtime_reviews'::regclass
  ))) = 0 then
    execute format('alter table public.attendance_overtime_reviews drop constraint %I', cname);
    alter table public.attendance_overtime_reviews
      add constraint attendance_overtime_reviews_status_check
      check (status in (
        'pending','approved','partially_approved','rejected','cancelled_by_correction','cancelled_by_exclusion'
      ));
  end if;
end
$overtime_status$;

create or replace function public.attendance_is_excluded(p_shift_id uuid, p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select x.action = 'exclude'
    from public.attendance_exclusions x
    where x.shift_id = p_shift_id and x.scope = 'shift'
    order by x.acted_at desc, x.id desc
    limit 1
  ), false)
  or (
    p_event_id is not null and coalesce((
      select x.action = 'exclude'
      from public.attendance_exclusions x
      where x.event_id = p_event_id and x.scope = 'event'
      order by x.acted_at desc, x.id desc
      limit 1
    ), false)
  );
$$;

revoke all on function public.attendance_is_excluded(uuid, uuid) from public, anon, authenticated;

create or replace function public.attendance_remaining_sequence_inconsistent(p_shift_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with ev as (
    select e.event_type, e.occurred_at
    from public.attendance_events e
    where e.shift_id = p_shift_id
      and not exists (
        select 1 from public.attendance_events newer
        where newer.supersedes_event_id = e.id
      )
      and not public.attendance_is_excluded(e.shift_id, e.id)
  ),
  picked as (
    select
      max(occurred_at) filter (where event_type = 'clock_in') as clock_in,
      max(occurred_at) filter (where event_type = 'lunch_out') as lunch_out,
      max(occurred_at) filter (where event_type = 'lunch_in') as lunch_in,
      max(occurred_at) filter (where event_type = 'clock_out') as clock_out,
      count(*) filter (where event_type = 'clock_in') as clock_in_count,
      count(*) filter (where event_type = 'lunch_out') as lunch_out_count,
      count(*) filter (where event_type = 'lunch_in') as lunch_in_count,
      count(*) filter (where event_type = 'clock_out') as clock_out_count,
      count(*) filter (where event_type not in ('clock_in','lunch_out','lunch_in','clock_out')) as unknown_count
    from ev
  )
  select
    clock_in_count > 1 or lunch_out_count > 1 or lunch_in_count > 1 or clock_out_count > 1
    or unknown_count > 0
    or (lunch_out is not null and clock_in is null)
    or (lunch_in is not null and lunch_out is null)
    or (clock_out is not null and clock_in is null)
    or (lunch_out is not null and clock_in is not null and lunch_out < clock_in)
    or (lunch_in is not null and lunch_out is not null and lunch_in < lunch_out)
    or (clock_out is not null and lunch_out is not null and lunch_in is null)
    or (clock_out is not null and lunch_in is not null and clock_out < lunch_in)
    or (clock_out is not null and lunch_out is null and clock_in is not null and clock_out < clock_in)
  from picked;
$$;

revoke all on function public.attendance_remaining_sequence_inconsistent(uuid) from public, anon, authenticated;

create or replace function public.set_attendance_exclusion(
  p_shift_id uuid,
  p_event_id uuid,
  p_action text,
  p_motive text,
  p_explanation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  museum uuid := public.current_user_museum_id();
  shift_row public.employee_shifts;
  action text := trim(coalesce(p_action, ''));
  motive text := trim(coalesce(p_motive, ''));
  explanation text := nullif(trim(coalesce(p_explanation, '')), '');
  scope text;
  event_row public.attendance_events;
  shift_excluded boolean;
  event_excluded boolean;
  affects_overtime boolean := false;
  review_id uuid;
  review_status text;
  threshold integer := 0;
  cin_id uuid;
  cin_at timestamptz;
  cout_id uuid;
  cout_at timestamptz;
  entry_id uuid;
  entry_out timestamptz;
  entry_excluded timestamptz;
  entry_count integer;
  hide_entry boolean;
  extra_minutes integer;
  exclusion_id uuid;
  audit_actor text;
begin
  if auth.uid() is null or museum is null or not public.has_permission('attendance.exclusions.manage') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if action not in ('exclude','restore') then
    raise exception 'INVALID_ACTION' using errcode = '22023';
  end if;
  if motive = '' then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;
  if motive not in ('system_test','duplicate_punch','mistaken_punch','incorrect_admin_record','other') then
    raise exception 'REASON_NOT_ALLOWED' using errcode = '22023';
  end if;
  if motive = 'other' and explanation is null then
    raise exception 'EXPLANATION_REQUIRED' using errcode = '22023';
  end if;

  select * into shift_row from public.employee_shifts
   where id = p_shift_id and museum_id = museum
   for update;
  if not found then
    raise exception 'SHIFT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.employees e
    where e.id = shift_row.employee_id and e.museum_id = museum and e.status = 'activo'
  ) then
    raise exception 'EMPLOYEE_NOT_FOUND' using errcode = 'P0001';
  end if;

  scope := case when p_event_id is null then 'shift' else 'event' end;
  shift_excluded := public.attendance_is_excluded(shift_row.id, null);

  if scope = 'event' then
    select * into event_row from public.attendance_events ev
     where ev.id = p_event_id and ev.shift_id = shift_row.id and ev.museum_id = museum
     for update;
    if not found then
      raise exception 'ATTENDANCE_CHANGED_RELOAD' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.attendance_events newer where newer.supersedes_event_id = event_row.id
    ) then
      raise exception 'ATTENDANCE_CHANGED_RELOAD' using errcode = 'P0001';
    end if;
    if shift_excluded then
      raise exception 'SHIFT_EXCLUDED' using errcode = 'P0001';
    end if;
    event_excluded := public.attendance_is_excluded(shift_row.id, event_row.id);
    if action = 'exclude' and event_excluded then
      raise exception 'ALREADY_EXCLUDED' using errcode = 'P0001';
    end if;
    if action = 'restore' and not event_excluded then
      raise exception 'NOT_EXCLUDED' using errcode = 'P0001';
    end if;
    affects_overtime := event_row.event_type = 'clock_out';
  else
    if action = 'exclude' and shift_excluded then
      raise exception 'ALREADY_EXCLUDED' using errcode = 'P0001';
    end if;
    if action = 'restore' and not shift_excluded then
      raise exception 'NOT_EXCLUDED' using errcode = 'P0001';
    end if;
    affects_overtime := true;
  end if;

  if action = 'exclude' and exists (
    select 1 from public.attendance_correction_requests r
    where r.shift_id = shift_row.id and r.museum_id = museum and r.status = 'pending'
  ) then
    raise exception 'PENDING_CORRECTION' using errcode = 'P0001';
  end if;

  if to_regclass('public.attendance_overtime_reviews') is not null then
    select r.id, r.status into review_id, review_status
      from public.attendance_overtime_reviews r
     where r.shift_id = shift_row.id and r.museum_id = museum
     for update;
    if action = 'exclude' and affects_overtime and review_status in ('approved','partially_approved','rejected') then
      raise exception 'OVERTIME_DECISION_CONFLICT' using errcode = 'P0001';
    end if;
  end if;

  insert into public.attendance_exclusions(
    museum_id, employee_id, shift_id, event_id, scope, action, motive, explanation, acted_by, acted_at
  ) values (
    museum, shift_row.employee_id, shift_row.id, case when scope = 'event' then p_event_id else null end,
    scope, action, motive, explanation, auth.uid(), clock_timestamp()
  ) returning id into exclusion_id;

  if public.attendance_remaining_sequence_inconsistent(shift_row.id) then
    raise exception 'INVALID_EXCLUSION_SEQUENCE' using errcode = '22023';
  end if;

  select ev.id, ev.occurred_at into cin_id, cin_at
    from public.attendance_events ev
   where ev.shift_id = shift_row.id and ev.museum_id = museum and ev.event_type = 'clock_in'
     and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id)
   order by ev.occurred_at desc
   limit 1;
  select ev.id, ev.occurred_at into cout_id, cout_at
    from public.attendance_events ev
   where ev.shift_id = shift_row.id and ev.museum_id = museum and ev.event_type = 'clock_out'
     and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id)
   order by ev.occurred_at desc
   limit 1;

  if cin_id is not null then
    select count(*) into entry_count from public.employee_time_entries t
     where t.museum_id = museum and t.employee_id = shift_row.employee_id and t.clock_in = cin_at;
    if entry_count = 0 then
      raise exception 'TIME_ENTRY_NOT_RECONCILABLE' using errcode = 'P0001';
    elsif entry_count > 1 then
      raise exception 'TIME_ENTRY_AMBIGUOUS' using errcode = 'P0001';
    end if;
    select t.id, t.clock_out, t.excluded_at into entry_id, entry_out, entry_excluded
      from public.employee_time_entries t
     where t.museum_id = museum and t.employee_id = shift_row.employee_id and t.clock_in = cin_at
     for update;
    hide_entry := public.attendance_is_excluded(shift_row.id, cin_id)
      or (cout_id is not null and public.attendance_is_excluded(shift_row.id, cout_id));
    if hide_entry then
      update public.employee_time_entries
         set excluded_at = coalesce(excluded_at, now()), updated_at = now()
       where id = entry_id;
    elsif entry_out is null and entry_excluded is not null and exists (
      select 1 from public.employee_time_entries t
      where t.employee_id = shift_row.employee_id and t.id <> entry_id
        and t.clock_out is null and t.excluded_at is null
    ) then
      raise exception 'TIME_ENTRY_OPEN_CONFLICT' using errcode = 'P0001';
    else
      update public.employee_time_entries
         set excluded_at = null, updated_at = now()
       where id = entry_id and excluded_at is not null;
    end if;
  end if;

  if review_id is not null then
    select coalesce(overtime_review_threshold_minutes, 0) into threshold
      from public.attendance_settings where museum_id = museum;
    if action = 'exclude' and affects_overtime and review_status = 'pending' then
      update public.attendance_overtime_reviews
         set status = 'cancelled_by_exclusion',
             decided_at = now(),
             decision_reason = 'La jornada o la salida quedó excluida.'
       where id = review_id and status = 'pending';
    elsif action = 'restore' and review_status = 'cancelled_by_exclusion'
      and cout_id is not null
      and not public.attendance_is_excluded(shift_row.id, null)
      and not public.attendance_is_excluded(shift_row.id, cout_id) then
      extra_minutes := greatest(0, floor(extract(epoch from (cout_at - shift_row.ends_at)) / 60)::integer);
      if extra_minutes > coalesce(threshold, 0) then
        update public.attendance_overtime_reviews
           set status = 'pending',
               additional_minutes = extra_minutes,
               clock_out_event_id = cout_id,
               approved_minutes = null,
               decided_by = null,
               decided_at = null,
               decision_reason = null
         where id = review_id and status = 'cancelled_by_exclusion';
      end if;
    end if;
  end if;

  if to_regprocedure('public.reconcile_shift_attendance_alerts(uuid)') is not null then
    execute 'select public.reconcile_shift_attendance_alerts($1)' using shift_row.id;
  end if;

  select case
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'user_id'
    ) then 'user_id' else 'actor_user_id' end
  into audit_actor;
  execute format(
    'insert into public.audit_logs(museum_id,%I,action,table_name,record_id,new_value) values($1,$2,$3,$4,$5,$6)',
    audit_actor
  ) using museum, auth.uid(), 'ATTENDANCE_EXCLUSION_RECORDED', 'attendance_exclusions', exclusion_id,
    jsonb_build_object(
      'employee_id', shift_row.employee_id,
      'shift_id', shift_row.id,
      'event_id', p_event_id,
      'scope', scope,
      'action', action,
      'motive', motive,
      'explanation', explanation
    );

  return jsonb_build_object(
    'id', exclusion_id,
    'shift_id', shift_row.id,
    'event_id', p_event_id,
    'scope', scope,
    'action', action
  );
end
$$;

revoke all on function public.set_attendance_exclusion(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.set_attendance_exclusion(uuid, uuid, text, text, text) to authenticated;

create or replace function public.list_attendance_history(p_from date, p_to date)
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
            when c.clock_in is null then 'SIN PONCHAR'
            when c.incomplete then 'INCOMPLETA'
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
          ) order by t.shift_date) as day_rows,
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
      join public.employees e on e.id = d.employee_id and e.museum_id = museum and e.status = 'activo'
    ), '[]'::jsonb)
  );
end
$$;

revoke all on function public.list_attendance_history(date, date) from public, anon;
grant execute on function public.list_attendance_history(date, date) to authenticated;

create or replace function public.list_shift_punch_editor(p_employee_id uuid, p_shift_date date)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  museum uuid := public.current_user_museum_id();
  target_shift uuid;
begin
  if auth.uid() is null or museum is null
     or not (public.has_permission('attendance.punches.correct') or public.has_permission('attendance.exclusions.manage')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select s.id into target_shift
  from public.employee_shifts s
  where s.museum_id = museum and s.employee_id = p_employee_id and s.status = 'scheduled'
    and (s.starts_at at time zone 'America/Puerto_Rico')::date = p_shift_date
  order by s.starts_at limit 1;
  if target_shift is null then raise exception 'SHIFT_NOT_FOUND' using errcode = 'P0001'; end if;
  return (
    select jsonb_build_object(
      'shift_id', s.id,
      'starts_at', s.starts_at,
      'ends_at', s.ends_at,
      'shift_excluded', public.attendance_is_excluded(s.id, null),
      'events', coalesce(jsonb_object_agg(ev.event_type, jsonb_build_object(
        'id', ev.id,
        'occurred_at', ev.occurred_at,
        'excluded', public.attendance_is_excluded(s.id, ev.id)
      )) filter (where ev.id is not null), '{}'::jsonb),
      'history', public.list_shift_punch_history(s.id)
    )
    from public.employee_shifts s
    left join public.attendance_events ev on ev.shift_id = s.id and ev.museum_id = museum
      and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id)
      and ev.event_type in ('clock_in','lunch_out','lunch_in','clock_out')
    where s.id = target_shift
    group by s.id, s.starts_at, s.ends_at, public.attendance_is_excluded(s.id, null)
  );
end $$;

revoke all on function public.list_shift_punch_editor(uuid, date) from public, anon;
grant execute on function public.list_shift_punch_editor(uuid, date) to authenticated;

do $readers$
declare src text; patched text;
begin
  if to_regprocedure('public.list_today_staff_status()') is not null then
    src := replace(pg_get_functiondef('public.list_today_staff_status()'::regprocedure), E'\r\n', E'\n');
    if position('attendance_is_excluded' in src) = 0 then
      patched := replace(src,
        E'        and not exists (\n          select 1 from public.attendance_events newer\n          where newer.supersedes_event_id = ev.id\n        )',
        E'        and not exists (\n          select 1 from public.attendance_events newer\n          where newer.supersedes_event_id = ev.id\n        )\n        and not public.attendance_is_excluded(ev.shift_id, ev.id)');
      if patched = src then raise exception 'PATCH_FAILED_TODAY'; end if;
      execute patched;
    end if;
  end if;

  if to_regprocedure('public.sync_attendance_operational_alerts()') is not null then
    src := replace(pg_get_functiondef('public.sync_attendance_operational_alerts()'::regprocedure), E'\r\n', E'\n');
    if position('attendance_is_excluded' in src) = 0 then
      patched := replace(src,
        E'      and not exists (\n        select 1 from public.attendance_events newer\n        where newer.supersedes_event_id = ev.id\n      )',
        E'      and not exists (\n        select 1 from public.attendance_events newer\n        where newer.supersedes_event_id = ev.id\n      )\n      and not public.attendance_is_excluded(ev.shift_id, ev.id)');
      patched := replace(patched,
        E'    where\n      (v.alert_type = ''late''',
        E'    where not public.attendance_is_excluded(c.id, null)\n      and (\n      (v.alert_type = ''late''');
      patched := replace(patched,
        E'      or (v.alert_type = ''inconsistent_sequence'' and c.inconsistent)\n  ),',
        E'      or (v.alert_type = ''inconsistent_sequence'' and c.inconsistent)\n      )\n  ),');
      if patched = src
         or (length(patched) - length(replace(patched, 'attendance_is_excluded', ''))) / length('attendance_is_excluded') < 2 then
        raise exception 'PATCH_FAILED_SYNC';
      end if;
      execute patched;
    end if;
  end if;

  if to_regprocedure('public.reconcile_shift_attendance_alerts(uuid)') is not null then
    src := replace(pg_get_functiondef('public.reconcile_shift_attendance_alerts(uuid)'::regprocedure), E'\r\n', E'\n');
    if position('attendance_is_excluded' in src) = 0 then
      patched := replace(src,
        'and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id)',
        'and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id) and not public.attendance_is_excluded(ev.shift_id, ev.id)');
      patched := replace(patched,
        'where (v.alert_type = ''late''',
        'where not public.attendance_is_excluded(c.id, null) and ((v.alert_type = ''late''');
      patched := replace(patched,
        'or (v.alert_type = ''inconsistent_sequence'' and c.inconsistent)',
        'or (v.alert_type = ''inconsistent_sequence'' and c.inconsistent))');
      if patched = src
         or (length(patched) - length(replace(patched, 'attendance_is_excluded', ''))) / length('attendance_is_excluded') < 2 then
        raise exception 'PATCH_FAILED_RECONCILE';
      end if;
      execute patched;
    end if;
  end if;
end
$readers$;

do $guards$
declare src text; patched text; old text; new text;
begin
  if to_regprocedure('public.correct_shift_attendance_punches(uuid,text,text,uuid,jsonb)') is not null then
    src := replace(pg_get_functiondef('public.correct_shift_attendance_punches(uuid,text,text,uuid,jsonb)'::regprocedure), E'\r\n', E'\n');
    if position('EXCLUSION_ACTIVE' in src) = 0 then
      old := E'  if not found then raise exception ''SHIFT_NOT_FOUND'' using errcode = ''P0001''; end if;\n';
      new := old || E'  if public.attendance_is_excluded(shift_row.id, null) then raise exception ''EXCLUSION_ACTIVE'' using errcode = ''P0001''; end if;\n';
      patched := replace(src, old, new);
      old := E'    if current_id is distinct from expected_id then\n      raise exception ''ATTENDANCE_CHANGED_RELOAD'' using errcode = ''P0001'';\n    end if;\n';
      new := old || E'    if current_id is not null and public.attendance_is_excluded(shift_row.id, current_id) then raise exception ''EXCLUSION_ACTIVE'' using errcode = ''P0001''; end if;\n';
      patched := replace(patched, old, new);
      if (length(patched) - length(replace(patched, 'EXCLUSION_ACTIVE', ''))) / length('EXCLUSION_ACTIVE') < 2 then
        raise exception 'PATCH_FAILED_CORRECT';
      end if;
      execute patched;
    end if;
  end if;

  if to_regprocedure('public.request_own_attendance_correction(uuid,text,timestamptz,text)') is not null then
    src := replace(pg_get_functiondef('public.request_own_attendance_correction(uuid,text,timestamptz,text)'::regprocedure), E'\r\n', E'\n');
    if position('EXCLUSION_ACTIVE' in src) = 0 then
      old := E'  if not found then raise exception ''SHIFT_NOT_AVAILABLE'' using errcode = ''P0001''; end if;\n';
      new := old || E'  if public.attendance_is_excluded(shift_row.id, null) then raise exception ''EXCLUSION_ACTIVE'' using errcode = ''P0001''; end if;\n';
      patched := replace(src, old, new);
      old := E'   order by ev.occurred_at desc\n   limit 1;\n  insert into public.attendance_correction_requests(';
      new := E'   order by ev.occurred_at desc\n   limit 1;\n  if original_id is not null and public.attendance_is_excluded(shift_row.id, original_id) then raise exception ''EXCLUSION_ACTIVE'' using errcode = ''P0001''; end if;\n  insert into public.attendance_correction_requests(';
      patched := replace(patched, old, new);
      if (length(patched) - length(replace(patched, 'EXCLUSION_ACTIVE', ''))) / length('EXCLUSION_ACTIVE') < 2 then
        raise exception 'PATCH_FAILED_REQUEST';
      end if;
      execute patched;
    end if;
  end if;

  if to_regprocedure('public.decide_attendance_correction(uuid,text,text)') is not null then
    src := replace(pg_get_functiondef('public.decide_attendance_correction(uuid,text,text)'::regprocedure), E'\r\n', E'\n');
    if position('EXCLUSION_ACTIVE' in src) = 0 then
      old := E'  if request_row.requested_by = auth.uid() then raise exception ''SELF_APPROVAL_FORBIDDEN'' using errcode = ''42501''; end if;\n';
      new := old || $guard$
  if p_decision = 'approved' and (
    public.attendance_is_excluded(request_row.shift_id, null)
    or (request_row.original_event_id is not null and public.attendance_is_excluded(request_row.shift_id, request_row.original_event_id))
    or exists (
      select 1 from public.attendance_events ev
      where ev.shift_id = request_row.shift_id
        and ev.museum_id = museum
        and ev.event_type = request_row.requested_event_type
        and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id)
        and public.attendance_is_excluded(ev.shift_id, ev.id)
    )
  ) then
    raise exception 'EXCLUSION_ACTIVE' using errcode = 'P0001';
  end if;
$guard$;
      patched := replace(src, old, new);
      if position('EXCLUSION_ACTIVE' in patched) = 0 then raise exception 'PATCH_FAILED_DECIDE'; end if;
      execute patched;
    end if;
  end if;

  if to_regprocedure('public.decide_attendance_correction(uuid,uuid,uuid,text,text)') is not null then
    src := replace(pg_get_functiondef('public.decide_attendance_correction(uuid,uuid,uuid,text,text)'::regprocedure), E'\r\n', E'\n');
    if position('EXCLUSION_ACTIVE' in src) = 0 then
      old := E'  if decision=''approved'' then\n    select * into shift_row from public.employee_shifts where id=request_row.shift_id;';
      new := $guard$  if decision='approved' and (
    public.attendance_is_excluded(request_row.shift_id, null)
    or (request_row.original_event_id is not null and public.attendance_is_excluded(request_row.shift_id, request_row.original_event_id))
    or exists (
      select 1 from public.attendance_events ev
      where ev.shift_id = request_row.shift_id
        and ev.museum_id = actor_museum_id
        and ev.event_type = request_row.requested_event_type
        and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id)
        and public.attendance_is_excluded(ev.shift_id, ev.id)
    )
  ) then
    raise exception 'EXCLUSION_ACTIVE' using errcode = 'P0001';
  end if;

  if decision='approved' then
    select * into shift_row from public.employee_shifts where id=request_row.shift_id;$guard$;
      patched := replace(src, old, new);
      if position('EXCLUSION_ACTIVE' in patched) = 0
         or (length(patched) - length(replace(patched, 'if decision=''approved'' then', ''))) / length('if decision=''approved'' then') < 1 then
        raise exception 'PATCH_FAILED_DECIDE_LEGACY';
      end if;
      execute patched;
    end if;
  end if;

  if to_regprocedure('public.record_employee_attendance(uuid,uuid,text,jsonb)') is not null then
    src := replace(pg_get_functiondef('public.record_employee_attendance(uuid,uuid,text,jsonb)'::regprocedure), E'\r\n', E'\n');
    if position('excluded_at' in src) = 0 then
      patched := replace(src,
        'select * into s from public.employee_shifts where museum_id=actor_museum_id and employee_id=e.id and status=''scheduled'' and now_at between starts_at-interval ''24 hours'' and ends_at+interval ''16 hours'' order by abs(extract(epoch from(now_at-starts_at))) limit 1;',
        'select * into s from public.employee_shifts where museum_id=actor_museum_id and employee_id=e.id and status=''scheduled'' and now_at between starts_at-interval ''24 hours'' and ends_at+interval ''16 hours'' order by abs(extract(epoch from(now_at-starts_at))) limit 1 for update;');
      patched := replace(patched,
        'insert into public.employee_time_entries(museum_id,employee_id,clock_in,source,sync_status,created_by) values(actor_museum_id,e.id,now_at,''instituva'',''not_configured'',actor_user_id);',
        'insert into public.employee_time_entries(museum_id,employee_id,clock_in,source,sync_status,created_by,excluded_at) values(actor_museum_id,e.id,now_at,''instituva'',''not_configured'',actor_user_id, case when public.attendance_is_excluded(s.id, null) then now() else null end);');
      patched := replace(patched,
        'update public.employee_time_entries set clock_out=now_at,updated_at=now_at where museum_id=actor_museum_id and employee_id=e.id and clock_out is null;',
        'update public.employee_time_entries set clock_out=now_at,updated_at=now_at where museum_id=actor_museum_id and employee_id=e.id and clock_out is null and excluded_at is null;');
      patched := replace(patched,
        'if extra_minutes>cfg.overtime_review_threshold_minutes then insert into public.attendance_overtime_reviews',
        'if extra_minutes>cfg.overtime_review_threshold_minutes and not public.attendance_is_excluded(s.id, null) then insert into public.attendance_overtime_reviews');
      if position('excluded_at is null' in patched) = 0
         or position('limit 1 for update' in patched) = 0
         or position('not public.attendance_is_excluded(s.id, null) then insert into public.attendance_overtime_reviews' in patched) = 0 then
        raise exception 'PATCH_FAILED_RECORD';
      end if;
      execute patched;
    end if;
  end if;
end
$guards$;
