-- Operational alert list is the current Puerto Rico day only.
-- Does not update, resolve, or delete existing alert rows.

create or replace function public.list_attendance_operational_alerts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  museum uuid := public.current_user_museum_id();
begin
  if auth.uid() is null or museum is null or not public.has_permission('attendance.alerts.read') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'employee_id', a.employee_id,
      'name', e.first_name || ' ' || e.last_name,
      'shift_id', a.shift_id,
      'alert_date', a.alert_date,
      'alert_type', a.alert_type,
      'status', a.status,
      'detected_at', a.detected_at,
      'resolved_at', a.resolved_at,
      'resolution_type', a.resolution_type,
      'details', a.details,
      'reviewed_by', a.reviewed_by,
      'reviewed_at', a.reviewed_at,
      'review_comment', a.review_comment
    ) order by case a.status when 'active' then 0 when 'auto_resolved' then 1 else 2 end, e.last_name, e.first_name, a.alert_type)
    from public.attendance_operational_alerts a
    join public.employees e on e.id = a.employee_id and e.museum_id = a.museum_id
    where a.museum_id = museum
      and a.alert_date = (now() at time zone 'America/Puerto_Rico')::date
  ), '[]'::jsonb);
end
$$;
