-- Explicit overtime decisions. Does not rewrite record_employee_attendance.
-- Does not grant attendance.overtime.approve and does not replace has_permission.

insert into public.permissions(code, description, sensitivity)
values ('attendance.overtime.decide', 'Aprobar o rechazar horas extra del museo', 'critical')
on conflict (code) do update set description = excluded.description, sensitivity = excluded.sensitivity;

do $patch$
declare src text; patched text; pos integer;
  grant_sql text := $grant$
 if requested_permission = 'attendance.overtime.decide'
    and not exists(
      select 1 from public.user_permissions u
      join public.permissions p on p.id = u.permission_id
      where u.user_id = auth.uid()
        and u.museum_id = public.current_user_museum_id()
        and p.code = 'attendance.overtime.decide'
        and u.effect = 'deny'
        and (u.valid_until is null or u.valid_until > now())
    )
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
  if position('attendance.overtime.decide' in src) > 0 then
    return;
  end if;
  pos := position(E'\nbegin' in src);
  if pos = 0 then
    raise exception 'HAS_PERMISSION_PATCH_FAILED';
  end if;
  patched := overlay(src placing E'\nbegin' || grant_sql from pos for 6);
  if patched = src or position('attendance.overtime.decide' in patched) = 0 then
    raise exception 'HAS_PERMISSION_PATCH_FAILED';
  end if;
  execute patched;
end
$patch$;

create or replace function public.list_overtime_reviews()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  museum uuid := public.current_user_museum_id();
begin
  if auth.uid() is null or museum is null or not public.has_permission('attendance.overtime.decide') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'pending', coalesce((
      select jsonb_agg(row_to_json(x) order by x.clock_out)
      from (
        select r.id, e.first_name || ' ' || e.last_name as name, s.starts_at, s.ends_at,
               ev.occurred_at as clock_out, r.additional_minutes, r.status, r.approved_minutes,
               r.decided_at, r.decision_reason, decider.full_name as decided_by_name
        from public.attendance_overtime_reviews r
        join public.employees e on e.id = r.employee_id and e.museum_id = r.museum_id
        join public.employee_shifts s on s.id = r.shift_id and s.museum_id = r.museum_id
        join public.attendance_events ev on ev.id = r.clock_out_event_id
        left join public.profiles decider on decider.id = r.decided_by
        where r.museum_id = museum and r.status = 'pending'
      ) x
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(row_to_json(x) order by x.decided_at desc)
      from (
        select r.id, e.first_name || ' ' || e.last_name as name, s.starts_at, s.ends_at,
               ev.occurred_at as clock_out, r.additional_minutes, r.status, r.approved_minutes,
               r.decided_at, r.decision_reason, decider.full_name as decided_by_name
        from public.attendance_overtime_reviews r
        join public.employees e on e.id = r.employee_id and e.museum_id = r.museum_id
        join public.employee_shifts s on s.id = r.shift_id and s.museum_id = r.museum_id
        join public.attendance_events ev on ev.id = r.clock_out_event_id
        left join public.profiles decider on decider.id = r.decided_by
        where r.museum_id = museum and r.status <> 'pending'
        order by r.decided_at desc nulls last
        limit 30
      ) x
    ), '[]'::jsonb)
  );
end
$$;

create or replace function public.decide_overtime_review(
  p_review_id uuid,
  p_decision text,
  p_approved_minutes integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  museum uuid := public.current_user_museum_id();
  detected integer;
  approved integer;
  new_status text;
  updated_id uuid;
begin
  if auth.uid() is null or museum is null or not public.has_permission('attendance.overtime.decide') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_decision not in ('approve_all','approve_partial','reject') then
    raise exception 'INVALID_DECISION' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 1 then
    raise exception 'DECISION_REASON_REQUIRED' using errcode = '22023';
  end if;
  select additional_minutes into detected
  from public.attendance_overtime_reviews
  where id = p_review_id and museum_id = museum;
  if detected is null then
    raise exception 'OVERTIME_REVIEW_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_decision = 'approve_all' then
    approved := detected;
    new_status := 'approved';
  elsif p_decision = 'reject' then
    approved := 0;
    new_status := 'rejected';
  else
    if p_approved_minutes is null or p_approved_minutes <= 0 then
      raise exception 'PARTIAL_MINUTES_INVALID' using errcode = '22023';
    end if;
    if p_approved_minutes > detected then
      raise exception 'MINUTES_EXCEED_DETECTED' using errcode = '22023';
    end if;
    if p_approved_minutes = detected then
      raise exception 'USE_FULL_APPROVAL' using errcode = '22023';
    end if;
    approved := p_approved_minutes;
    new_status := 'partially_approved';
  end if;

  update public.attendance_overtime_reviews
     set status = new_status,
         approved_minutes = approved,
         decided_by = auth.uid(),
         decided_at = now(),
         decision_reason = trim(p_reason)
   where id = p_review_id
     and museum_id = museum
     and status = 'pending'
  returning id into updated_id;
  if updated_id is null then
    raise exception 'OVERTIME_ALREADY_DECIDED' using errcode = 'P0001';
  end if;

  insert into public.audit_logs(museum_id, actor_user_id, action, table_name, record_id, new_value)
  values (museum, auth.uid(), 'OVERTIME_REVIEW_DECIDED', 'attendance_overtime_reviews', updated_id,
    jsonb_build_object('decision', new_status, 'detected_minutes', detected, 'approved_minutes', approved, 'reason', trim(p_reason)));
  return public.list_overtime_reviews();
end
$$;

revoke all on function public.list_overtime_reviews() from public, anon;
revoke all on function public.decide_overtime_review(uuid, text, integer, text) from public, anon;
grant execute on function public.list_overtime_reviews() to authenticated;
grant execute on function public.decide_overtime_review(uuid, text, integer, text) to authenticated;
