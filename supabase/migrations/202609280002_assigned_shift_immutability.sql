-- A shift is frozen once it has started or once attendance activity exists
-- for that shift_id. Attempts alone do not freeze it. Time entries are not
-- matched by proximity. The trigger runs before the contract trigger.

create or replace function public.attendance_shift_has_activity(p_shift_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.attendance_events where shift_id = p_shift_id)
      or exists (select 1 from public.attendance_operational_alerts where shift_id = p_shift_id)
      or exists (select 1 from public.attendance_correction_requests where shift_id = p_shift_id)
      or exists (select 1 from public.attendance_overtime_reviews where shift_id = p_shift_id)
      or exists (select 1 from public.attendance_exclusions where shift_id = p_shift_id);
$$;

create or replace function public.employee_shifts_protect_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tz text;
begin
  if new.museum_id is not distinct from old.museum_id
     and new.employee_id is not distinct from old.employee_id
     and new.starts_at is not distinct from old.starts_at
     and new.ends_at is not distinct from old.ends_at
     and new.shift_date is not distinct from old.shift_date
     and new.expected_lunch_minutes is not distinct from old.expected_lunch_minutes
     and new.status is not distinct from old.status
     and new.shift_type is not distinct from old.shift_type then
    return new;
  end if;
  if public.attendance_shift_has_activity(old.id) then
    raise exception 'SHIFT_LOCKED' using errcode = 'P0001';
  end if;
  if old.starts_at is not null then
    if old.starts_at <= now() then
      raise exception 'SHIFT_LOCKED' using errcode = 'P0001';
    end if;
  else
    tz := public.attendance_shift_timezone(old.museum_id);
    if (old.shift_date::timestamp at time zone tz) <= now() then
      raise exception 'SHIFT_LOCKED' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists employee_shifts_protect_history on public.employee_shifts;
create trigger employee_shifts_protect_history
  before update on public.employee_shifts
  for each row execute function public.employee_shifts_protect_history();

revoke all on function public.attendance_shift_has_activity(uuid) from public;
revoke all on function public.employee_shifts_protect_history() from public;
