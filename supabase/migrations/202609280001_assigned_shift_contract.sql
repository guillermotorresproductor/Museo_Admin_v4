-- Assigned shifts: administrative date, nullable hours for day_off, and
-- constraints that allow several non-overlapping shifts on the same date.
-- Existing hours are not rewritten. shift_date is derived from each museum's
-- attendance_settings.timezone. A missing timezone aborts the migration.

create or replace function public.attendance_shift_timezone(p_museum uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz text;
begin
  select nullif(trim(timezone), '') into tz
    from public.attendance_settings
   where museum_id = p_museum;
  if tz is null then
    raise exception 'SHIFT_TIMEZONE_NOT_CONFIGURED' using errcode = 'P0001';
  end if;
  return tz;
end $$;

revoke all on function public.attendance_shift_timezone(uuid) from public;

alter table public.employee_shifts
  add column if not exists shift_date date;

update public.employee_shifts s
   set shift_date = (s.starts_at at time zone public.attendance_shift_timezone(s.museum_id))::date
 where s.shift_date is null
   and s.starts_at is not null;

do $backfill$
begin
  if exists (select 1 from public.employee_shifts where shift_date is null) then
    raise exception 'SHIFT_TIMEZONE_NOT_CONFIGURED' using errcode = 'P0001';
  end if;
  if exists (
    select 1
      from public.employee_shifts s
     where s.starts_at is not null
       and s.shift_date is distinct from (s.starts_at at time zone public.attendance_shift_timezone(s.museum_id))::date
  ) then
    raise exception 'SHIFT_DATE_BACKFILL_FAILED' using errcode = 'P0001';
  end if;
end
$backfill$;

alter table public.employee_shifts
  alter column shift_date set not null;

alter table public.employee_shifts alter column starts_at drop not null;
alter table public.employee_shifts alter column ends_at drop not null;

do $checks$
declare
  constraint_row record;
  definition text;
begin
  for constraint_row in
    select con.conname, pg_get_constraintdef(con.oid) as definition
      from pg_constraint con
     where con.conrelid = 'public.employee_shifts'::regclass
       and con.contype = 'c'
  loop
    definition := constraint_row.definition;
    if definition not ilike '%day_off%'
       and (
         definition ilike '%ends_at > starts_at%'
         or (
           definition ilike '%scheduled%'
           and definition ilike '%cancelled%'
           and definition not ilike '%starts_at%'
         )
       ) then
      execute format('alter table public.employee_shifts drop constraint %I', constraint_row.conname);
    end if;
  end loop;
end
$checks$;

alter table public.employee_shifts
  drop constraint if exists employee_shifts_time_contract_check;
alter table public.employee_shifts
  add constraint employee_shifts_time_contract_check check (
    (
      status in ('scheduled', 'cancelled', 'completed')
      and starts_at is not null
      and ends_at is not null
      and ends_at > starts_at
    )
    or (
      status = 'day_off'
      and starts_at is null
      and ends_at is null
      and expected_lunch_minutes is null
    )
  );

alter table public.employee_shifts
  drop constraint if exists employee_shifts_status_check;
alter table public.employee_shifts
  add constraint employee_shifts_status_check check (
    status in ('scheduled', 'cancelled', 'completed', 'day_off')
  );

-- Staging applied an unpublished unique (employee_id, starts_at). A cancelled
-- row would keep occupying that start and block a new shift. Production does
-- not have the index. Dropping it only when present keeps the approved rule:
-- cancelling preserves the hours and does not block a later assignment.
drop index if exists public.employee_shifts_employee_start_unique;

create unique index if not exists employee_shifts_one_day_off
  on public.employee_shifts (employee_id, shift_date)
  where status = 'day_off';

do $gist$
begin
  if not exists (select 1 from pg_extension where extname = 'btree_gist') then
    create extension btree_gist with schema extensions;
  end if;
end
$gist$;

alter table public.employee_shifts
  drop constraint if exists employee_shifts_no_scheduled_overlap;
alter table public.employee_shifts
  add constraint employee_shifts_no_scheduled_overlap
  exclude using gist (
    employee_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'scheduled');

create index if not exists employee_shifts_museum_employee_date_idx
  on public.employee_shifts (museum_id, employee_id, shift_date);

create or replace function public.employee_shifts_enforce_contract()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tz text;
begin
  tz := public.attendance_shift_timezone(new.museum_id);
  if new.shift_date is null and new.starts_at is not null then
    new.shift_date := (new.starts_at at time zone tz)::date;
  end if;
  if new.status in ('scheduled', 'cancelled', 'completed')
     and new.starts_at is not null
     and new.shift_date is distinct from (new.starts_at at time zone tz)::date then
    raise exception 'SHIFT_DATE_MISMATCH' using errcode = '22023';
  end if;
  if new.status = 'scheduled' and exists (
    select 1
      from public.employee_shifts other
     where other.employee_id = new.employee_id
       and other.shift_date = new.shift_date
       and other.status = 'day_off'
       and other.id is distinct from new.id
  ) then
    raise exception 'DAY_OFF_CONFLICT' using errcode = 'P0001';
  end if;
  if new.status = 'day_off' and exists (
    select 1
      from public.employee_shifts other
     where other.employee_id = new.employee_id
       and other.shift_date = new.shift_date
       and other.status = 'scheduled'
       and other.id is distinct from new.id
  ) then
    raise exception 'DAY_OFF_CONFLICT' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists employee_shifts_z_contract on public.employee_shifts;
create trigger employee_shifts_z_contract
  before insert or update on public.employee_shifts
  for each row execute function public.employee_shifts_enforce_contract();

revoke all on function public.employee_shifts_enforce_contract() from public;

comment on column public.employee_shifts.shift_date is
  'Local administrative date when the shift starts, taken from attendance_settings.timezone.';
