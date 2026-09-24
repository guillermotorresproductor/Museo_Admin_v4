-- Phase 1A. Labor flag is independent of access_profile, access_level and roles.
-- Names appear only in this one-time assignment. The punch function reads the flag.

alter table public.employees
  add column if not exists attendance_required boolean not null default true;

update public.employees
set attendance_required = false
where status = 'activo'
  and first_name = 'Guillermo'
  and last_name = 'Torres'
  and position = 'Director Ejecutivo';

update public.employees
set attendance_required = false
where status = 'activo'
  and first_name = 'Alberto'
  and last_name = 'Soto'
  and position = 'Administrador General';

do $$
begin
  if (select count(*) from public.employees where status = 'activo' and attendance_required = false) <> 2 then
    raise exception 'ATTENDANCE_EXEMPTION_ASSIGNMENT_FAILED';
  end if;
end $$;

insert into public.attendance_settings (
  museum_id, presence_required, presence_validation_mode,
  latitude, longitude, geofence_radius_meters, timezone
)
select distinct e.museum_id, true, 'geolocation',
  18.359183, -66.110339, 100, 'America/Puerto_Rico'
from public.employees e
where not exists (
  select 1 from public.attendance_settings s where s.museum_id = e.museum_id
);

insert into public.employee_shifts (
  museum_id, employee_id, starts_at, ends_at, shift_type,
  expected_lunch_minutes, status, created_by
)
select e.museum_id, e.id,
  ((d::date + time '08:00') at time zone 'America/Puerto_Rico'),
  ((d::date + time '17:00') at time zone 'America/Puerto_Rico'),
  'regular', 60, 'scheduled',
  (select profile_id from public.employees creator
    where creator.profile_id is not null and creator.status = 'activo'
    order by creator.created_at limit 1)
from public.employees e
cross join generate_series(
  (now() at time zone 'America/Puerto_Rico')::date,
  (now() at time zone 'America/Puerto_Rico')::date + 90,
  interval '1 day'
) as d
where e.status = 'activo'
  and e.attendance_required
  and extract(isodow from d::date) between 1 and 5
  and not exists (
    select 1 from public.employee_shifts existing_shift
    where existing_shift.employee_id = e.id
  );

create or replace function public.record_employee_attendance(actor_user_id uuid, actor_museum_id uuid, requested_event text, presence jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 e public.employees; s public.employee_shifts; cfg public.attendance_settings; a public.attendance_attempts; ev public.attendance_events;
 now_at timestamptz:=now(); prior text; class text:='standard'; method text:=coalesce(presence->>'method',''); valid_presence boolean:=false; extra_minutes integer; audit_actor text;
begin
 if requested_event not in ('clock_in','lunch_out','lunch_in','clock_out') then raise exception 'INVALID_CLOCK_ACTION' using errcode='22023'; end if;
 select * into e from public.employees where museum_id=actor_museum_id and profile_id=actor_user_id and status='activo';
 if not found then raise exception 'ACTIVE_EMPLOYEE_REQUIRED' using errcode='P0001'; end if;
 if not e.attendance_required then
   return jsonb_build_object('ok',false,'code','ATTENDANCE_NOT_REQUIRED');
 end if;
 select * into cfg from public.attendance_settings where museum_id=actor_museum_id;
 if not found then
   insert into public.attendance_attempts(museum_id,employee_id,actor_user_id,requested_event,result,reason_code) values(actor_museum_id,e.id,actor_user_id,requested_event,'presence_not_configured','ATTENDANCE_SETTINGS_REQUIRED');
   return jsonb_build_object('ok',false,'code','PRESENCE_NOT_CONFIGURED');
 end if;
 select * into s from public.employee_shifts where museum_id=actor_museum_id and employee_id=e.id and status='scheduled' and now_at between starts_at-interval '24 hours' and ends_at+interval '16 hours' order by abs(extract(epoch from(now_at-starts_at))) limit 1;
 if not found then
   insert into public.attendance_attempts(museum_id,employee_id,actor_user_id,requested_event,result,settings_version,reason_code) values(actor_museum_id,e.id,actor_user_id,requested_event,'no_assigned_shift',cfg.version,'NO_ASSIGNED_SHIFT');
   return jsonb_build_object('ok',false,'code','NO_ASSIGNED_SHIFT');
 end if;
 if requested_event='clock_in' and now_at<s.starts_at-make_interval(mins=>cfg.early_clock_in_minutes) then
   insert into public.attendance_attempts(museum_id,employee_id,shift_id,actor_user_id,requested_event,result,settings_version,reason_code) values(actor_museum_id,e.id,s.id,actor_user_id,requested_event,'too_early',cfg.version,'CLOCK_WINDOW_NOT_OPEN');
   return jsonb_build_object('ok',false,'code','TOO_EARLY','available_at',s.starts_at-make_interval(mins=>cfg.early_clock_in_minutes));
 end if;
 if not cfg.presence_required then valid_presence:=true;
 elsif method='geolocation' and cfg.presence_validation_mode in ('geolocation','any') and cfg.latitude is not null and cfg.geofence_radius_meters is not null and presence ? 'latitude' and presence ? 'longitude' then
   valid_presence:=public.attendance_distance_meters(cfg.latitude,cfg.longitude,(presence->>'latitude')::double precision,(presence->>'longitude')::double precision)<=cfg.geofence_radius_meters;
 elsif method='wifi' and cfg.presence_validation_mode in ('wifi','any') and presence ? 'network_hash' then valid_presence:=(presence->>'network_hash')=any(cfg.allowed_wifi_hashes);
 end if;
 if not valid_presence then
   insert into public.attendance_attempts(museum_id,employee_id,shift_id,actor_user_id,requested_event,result,presence_method,presence_evidence,settings_version,reason_code)
   values(actor_museum_id,e.id,s.id,actor_user_id,requested_event,'presence_validation_failed',nullif(method,''),presence-'network_hash',cfg.version,'PHYSICAL_PRESENCE_REQUIRED');
   return jsonb_build_object('ok',false,'code','PRESENCE_VALIDATION_FAILED');
 end if;
 select event_type into prior from public.attendance_events where shift_id=s.id order by occurred_at desc limit 1;
 if (requested_event='clock_in' and prior is not null) or (requested_event='lunch_out' and prior is distinct from 'clock_in') or (requested_event='lunch_in' and prior is distinct from 'lunch_out') or (requested_event='clock_out' and prior not in ('clock_in','lunch_in')) then
   insert into public.attendance_attempts(museum_id,employee_id,shift_id,actor_user_id,requested_event,result,presence_method,settings_version,reason_code) values(actor_museum_id,e.id,s.id,actor_user_id,requested_event,'invalid_sequence',nullif(method,''),cfg.version,'INVALID_EVENT_SEQUENCE');
   return jsonb_build_object('ok',false,'code','INVALID_EVENT_SEQUENCE');
 end if;
 if requested_event='clock_in' then
   if now_at<=s.starts_at then class:='on_time'; elsif now_at<=s.starts_at+make_interval(mins=>cfg.late_tolerance_minutes) then class:='tolerance'; elsif now_at<=s.starts_at+make_interval(mins=>cfg.partial_absence_minutes) then class:='late'; else class:='partial_absence'; end if;
 elsif requested_event='clock_out' and now_at>s.ends_at+make_interval(mins=>cfg.overtime_review_threshold_minutes) then class:='overtime_pending'; end if;
 insert into public.attendance_attempts(museum_id,employee_id,shift_id,actor_user_id,requested_event,result,presence_method,presence_evidence,settings_version)
 values(actor_museum_id,e.id,s.id,actor_user_id,requested_event,'accepted',nullif(method,''),presence-'network_hash',cfg.version) returning * into a;
 insert into public.attendance_events(museum_id,employee_id,shift_id,attempt_id,event_type,occurred_at,classification,settings_version,created_by)
 values(actor_museum_id,e.id,s.id,a.id,requested_event,now_at,class,cfg.version,actor_user_id) returning * into ev;
 if requested_event='clock_in' then
   insert into public.employee_time_entries(museum_id,employee_id,clock_in,source,sync_status,created_by) values(actor_museum_id,e.id,now_at,'instituva','not_configured',actor_user_id);
 elsif requested_event='clock_out' then
   update public.employee_time_entries set clock_out=now_at,updated_at=now_at where museum_id=actor_museum_id and employee_id=e.id and clock_out is null;
   extra_minutes:=greatest(0,floor(extract(epoch from(now_at-s.ends_at))/60));
   if extra_minutes>cfg.overtime_review_threshold_minutes then insert into public.attendance_overtime_reviews(museum_id,employee_id,shift_id,clock_out_event_id,additional_minutes) values(actor_museum_id,e.id,s.id,ev.id,extra_minutes); end if;
 end if;
 select case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='actor_user_id') then 'actor_user_id' else 'user_id' end into audit_actor;
 execute format('insert into public.audit_logs(museum_id,%I,action,table_name,record_id,new_value) values($1,$2,$3,$4,$5,$6)',audit_actor)
 using actor_museum_id,actor_user_id,'ATTENDANCE_EVENT_RECORDED','attendance_events',ev.id,jsonb_build_object('employee_id',e.id,'shift_id',s.id,'event_type',requested_event,'occurred_at',now_at,'classification',class,'settings_version',cfg.version);
 return jsonb_build_object('ok',true,'event',to_jsonb(ev),'next_action',case requested_event when 'clock_in' then 'lunch_out' when 'lunch_out' then 'lunch_in' when 'lunch_in' then 'clock_out' else 'clock_in' end);
end $$;

revoke all on function public.record_employee_attendance(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_employee_attendance(uuid,uuid,text,jsonb) to service_role;
