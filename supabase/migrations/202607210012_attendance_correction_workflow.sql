-- Complete the correction workflow introduced with attendance governance.
-- Original attendance events remain immutable; approved corrections append a
-- linked event and never overwrite or delete historical evidence.

alter table public.attendance_events
  add column correction_request_id uuid
  references public.attendance_correction_requests(id) on delete restrict;

create unique index attendance_events_correction_request_unique
  on public.attendance_events(correction_request_id)
  where correction_request_id is not null;

create unique index attendance_corrections_one_pending_event
  on public.attendance_correction_requests(employee_id,shift_id,requested_event_type)
  where status='pending';

create index attendance_corrections_pending_idx
  on public.attendance_correction_requests(museum_id,requested_at)
  where status='pending';

create or replace function public.request_attendance_correction(
  actor_user_id uuid,
  actor_museum_id uuid,
  target_shift_id uuid,
  target_original_event_id uuid,
  target_event_type text,
  proposed_occurred_at timestamptz,
  request_reason text
)
returns public.attendance_correction_requests
language plpgsql
security definer
set search_path=''
as $$
declare
  employee_row public.employees;
  shift_row public.employee_shifts;
  original_row public.attendance_events;
  settings_row public.attendance_settings;
  request_row public.attendance_correction_requests;
begin
  if not public.has_permission_for_user(actor_user_id,actor_museum_id,'attendance.corrections.request') then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if target_event_type not in ('clock_in','lunch_out','lunch_in','clock_out') then
    raise exception 'INVALID_EVENT_TYPE' using errcode='22023';
  end if;
  if length(trim(coalesce(request_reason,'')))<5 then
    raise exception 'REASON_REQUIRED' using errcode='22023';
  end if;

  select * into employee_row
    from public.employees
   where museum_id=actor_museum_id
     and auth_user_id=actor_user_id
     and status='activo';
  if not found then raise exception 'ACTIVE_EMPLOYEE_REQUIRED' using errcode='P0001'; end if;

  select * into shift_row
    from public.employee_shifts
   where id=target_shift_id
     and museum_id=actor_museum_id
     and employee_id=employee_row.id;
  if not found then raise exception 'SHIFT_NOT_AVAILABLE' using errcode='P0001'; end if;

  if proposed_occurred_at<shift_row.starts_at-interval '24 hours'
     or proposed_occurred_at>shift_row.ends_at+interval '24 hours' then
    raise exception 'PROPOSED_TIME_OUTSIDE_SHIFT' using errcode='22023';
  end if;

  select * into settings_row
    from public.attendance_settings
   where museum_id=actor_museum_id;
  if settings_row.correction_submission_days is not null
     and proposed_occurred_at<now()-make_interval(days=>settings_row.correction_submission_days) then
    raise exception 'CORRECTION_WINDOW_EXPIRED' using errcode='22023';
  end if;

  if target_original_event_id is not null then
    select * into original_row
      from public.attendance_events
     where id=target_original_event_id
       and museum_id=actor_museum_id
       and employee_id=employee_row.id
       and shift_id=shift_row.id
       and event_type=target_event_type;
    if not found then raise exception 'ORIGINAL_EVENT_MISMATCH' using errcode='22023'; end if;
  elsif exists(
    select 1 from public.attendance_events e
     where e.shift_id=shift_row.id
       and e.event_type=target_event_type
       and e.supersedes_event_id is null
  ) then
    raise exception 'ORIGINAL_EVENT_REQUIRED' using errcode='22023';
  end if;

  insert into public.attendance_correction_requests(
    museum_id,employee_id,shift_id,original_event_id,requested_event_type,
    requested_occurred_at,reason,requested_by
  ) values(
    actor_museum_id,employee_row.id,shift_row.id,target_original_event_id,
    target_event_type,proposed_occurred_at,trim(request_reason),actor_user_id
  ) returning * into request_row;

  insert into public.audit_logs(museum_id,actor_user_id,action,table_name,record_id,new_value)
  values(actor_museum_id,actor_user_id,'ATTENDANCE_CORRECTION_REQUESTED',
    'attendance_correction_requests',request_row.id,
    jsonb_build_object(
      'employee_id',employee_row.id,
      'shift_id',shift_row.id,
      'original_event_id',target_original_event_id,
      'requested_event_type',target_event_type,
      'requested_occurred_at',proposed_occurred_at,
      'reason',trim(request_reason)
    ));

  return request_row;
exception
  when unique_violation then
    raise exception 'PENDING_CORRECTION_EXISTS' using errcode='23505';
end
$$;

create or replace function public.decide_attendance_correction(
  actor_user_id uuid,
  actor_museum_id uuid,
  target_request_id uuid,
  decision text,
  decision_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  request_row public.attendance_correction_requests;
  shift_row public.employee_shifts;
  settings_row public.attendance_settings;
  attempt_row public.attendance_attempts;
  corrected_row public.attendance_events;
  event_classification text:='standard';
begin
  if decision not in ('approved','rejected') then
    raise exception 'INVALID_DECISION' using errcode='22023';
  end if;
  if length(trim(coalesce(decision_reason,'')))<3 then
    raise exception 'DECISION_REASON_REQUIRED' using errcode='22023';
  end if;
  if not public.has_permission_for_user(actor_user_id,actor_museum_id,'attendance.corrections.approve') then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select * into request_row
    from public.attendance_correction_requests
   where id=target_request_id
     and museum_id=actor_museum_id
   for update;
  if not found or request_row.status<>'pending' then
    raise exception 'PENDING_REQUEST_REQUIRED' using errcode='P0001';
  end if;
  if request_row.requested_by=actor_user_id then
    raise exception 'SELF_APPROVAL_FORBIDDEN' using errcode='42501';
  end if;
  if not (
    public.has_permission_for_user(actor_user_id,actor_museum_id,'time.read.all')
    or exists(
      select 1
        from public.employee_supervisors es
        join public.employees supervisor on supervisor.id=es.supervisor_employee_id
       where es.employee_id=request_row.employee_id
         and es.museum_id=actor_museum_id
         and supervisor.auth_user_id=actor_user_id
         and (es.valid_until is null or es.valid_until>now())
    )
  ) then
    raise exception 'EMPLOYEE_SCOPE_FORBIDDEN' using errcode='42501';
  end if;

  if decision='approved' then
    select * into shift_row from public.employee_shifts where id=request_row.shift_id;
    select * into settings_row from public.attendance_settings where museum_id=actor_museum_id;

    if request_row.requested_event_type='clock_in' then
      if request_row.requested_occurred_at<=shift_row.starts_at then event_classification:='on_time';
      elsif request_row.requested_occurred_at<=shift_row.starts_at+make_interval(mins=>settings_row.late_tolerance_minutes) then event_classification:='tolerance';
      elsif request_row.requested_occurred_at<=shift_row.starts_at+make_interval(mins=>settings_row.partial_absence_minutes) then event_classification:='late';
      else event_classification:='partial_absence'; end if;
    elsif request_row.requested_event_type='clock_out'
      and request_row.requested_occurred_at>shift_row.ends_at+make_interval(mins=>settings_row.overtime_review_threshold_minutes) then
      event_classification:='overtime_pending';
    end if;

    insert into public.attendance_attempts(
      museum_id,employee_id,shift_id,actor_user_id,requested_event,occurred_at,
      result,presence_method,presence_evidence,reason_code,settings_version
    ) values(
      actor_museum_id,request_row.employee_id,request_row.shift_id,actor_user_id,
      request_row.requested_event_type,now(),'accepted','administrative_correction',
      jsonb_build_object('correction_request_id',request_row.id),
      'APPROVED_CORRECTION',settings_row.version
    ) returning * into attempt_row;

    insert into public.attendance_events(
      museum_id,employee_id,shift_id,attempt_id,event_type,occurred_at,
      classification,settings_version,supersedes_event_id,correction_request_id,created_by
    ) values(
      actor_museum_id,request_row.employee_id,request_row.shift_id,attempt_row.id,
      request_row.requested_event_type,request_row.requested_occurred_at,
      event_classification,settings_row.version,request_row.original_event_id,
      request_row.id,actor_user_id
    ) returning * into corrected_row;
  end if;

  update public.attendance_correction_requests
     set status=decision,
         decided_by=actor_user_id,
         decided_at=now(),
         decision_reason=trim(decision_reason),
         corrected_event_id=corrected_row.id
   where id=request_row.id;

  insert into public.audit_logs(museum_id,actor_user_id,action,table_name,record_id,old_value,new_value)
  values(actor_museum_id,actor_user_id,
    case when decision='approved' then 'ATTENDANCE_CORRECTION_APPROVED' else 'ATTENDANCE_CORRECTION_REJECTED' end,
    'attendance_correction_requests',request_row.id,to_jsonb(request_row),
    jsonb_build_object(
      'status',decision,
      'decision_reason',trim(decision_reason),
      'corrected_event_id',corrected_row.id
    ));

  return jsonb_build_object(
    'request_id',request_row.id,
    'status',decision,
    'corrected_event',case when corrected_row.id is null then null else to_jsonb(corrected_row) end
  );
end
$$;

revoke all on function public.request_attendance_correction(uuid,uuid,uuid,uuid,text,timestamptz,text)
  from public,anon,authenticated;
revoke all on function public.decide_attendance_correction(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.request_attendance_correction(uuid,uuid,uuid,uuid,text,timestamptz,text)
  to service_role;
grant execute on function public.decide_attendance_correction(uuid,uuid,uuid,text,text)
  to service_role;

create or replace function public.prevent_attendance_correction_delete()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  raise exception 'ATTENDANCE_CORRECTION_HISTORY_IMMUTABLE' using errcode='P0001';
end
$$;

create trigger attendance_correction_requests_no_delete
before delete on public.attendance_correction_requests
for each row execute function public.prevent_attendance_correction_delete();
