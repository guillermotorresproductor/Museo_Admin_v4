-- PR31 targeted installation. Definitions reused from 202607210004, 007 and 012.
-- No schedules/settings or employee data seeded; profile_id is the canonical identity.
begin;
do $install$ begin
 if to_regclass('public.employee_time_entries') is null then
 create table public.employee_time_entries (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id),
  employee_id uuid not null references public.employees(id) on delete restrict,
  clock_in timestamptz not null,
  clock_out timestamptz,
  source text not null default 'instituva' check(source in ('instituva','quickbooks')),
  sync_status text not null default 'not_configured' check(sync_status in ('not_configured','pending','synced','error')),
  quickbooks_time_activity_id text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_time_order check(clock_out is null or clock_out >= clock_in)
);
 alter table public.employee_time_entries enable row level security;
 create policy employee_time_entries_own_read on public.employee_time_entries for select to authenticated using(museum_id=public.current_user_museum_id() and exists(select 1 from public.employees e where e.id=employee_time_entries.employee_id and e.museum_id=employee_time_entries.museum_id and e.profile_id=auth.uid() and e.status='activo') and public.has_permission('time.read.self'));
 grant select on public.employee_time_entries to authenticated;
 revoke insert,update,delete on public.employee_time_entries from authenticated;
 grant all on public.employee_time_entries to service_role;
 end if;
end $install$;
do $install$ begin
 if to_regclass('public.employee_notifications') is null then
 create table public.employee_notifications (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  category text not null default 'general',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
 alter table public.employee_notifications enable row level security;
 create policy employee_notifications_own_read on public.employee_notifications for select to authenticated using(museum_id=public.current_user_museum_id() and recipient_user_id=auth.uid() and public.has_permission('notifications.read.self'));
 grant select on public.employee_notifications to authenticated;
 revoke insert,update,delete on public.employee_notifications from authenticated;
 grant all on public.employee_notifications to service_role;
 end if;
end $install$;
do $install$ begin
 if to_regclass('public.attendance_settings') is null then
 create table public.attendance_settings (
  museum_id uuid primary key references public.museums(id) on delete restrict,
  early_clock_in_minutes integer not null default 15 check(early_clock_in_minutes>=0),
  late_tolerance_minutes integer not null default 5 check(late_tolerance_minutes>=0),
  partial_absence_minutes integer not null default 30 check(partial_absence_minutes>late_tolerance_minutes),
  overtime_review_threshold_minutes integer not null default 0 check(overtime_review_threshold_minutes>=0),
  presence_required boolean not null default true,
  presence_validation_mode text not null default 'geolocation' check(presence_validation_mode in ('geolocation','wifi','qr','kiosk','any','all')),
  latitude double precision,
  longitude double precision,
  geofence_radius_meters integer check(geofence_radius_meters between 10 and 5000),
  allowed_wifi_hashes text[] not null default '{}',
  timezone text not null default 'America/Puerto_Rico',
  correction_submission_days integer check(correction_submission_days is null or correction_submission_days>0),
  version integer not null default 1,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  check((latitude is null)=(longitude is null))
);
 alter table public.attendance_settings enable row level security;
 create policy attendance_settings_own_read on public.attendance_settings for select to authenticated using(museum_id=public.current_user_museum_id());
 grant select on public.attendance_settings to authenticated;
 revoke insert,update,delete on public.attendance_settings from authenticated;
 grant all on public.attendance_settings to service_role;
 end if;
end $install$;
do $install$ begin
 if to_regclass('public.employee_shifts') is null then
 create table public.employee_shifts (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  shift_type text not null default 'regular' check(shift_type in ('regular','night','special_activity','weekend','extraordinary')),
  expected_lunch_minutes integer check(expected_lunch_minutes is null or expected_lunch_minutes>=0),
  status text not null default 'scheduled' check(status in ('scheduled','cancelled','completed')),
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_at>starts_at)
);
 alter table public.employee_shifts enable row level security;
 create policy employee_shifts_own_read on public.employee_shifts for select to authenticated using(museum_id=public.current_user_museum_id() and exists(select 1 from public.employees e where e.id=employee_shifts.employee_id and e.museum_id=employee_shifts.museum_id and e.profile_id=auth.uid() and e.status='activo') and public.has_permission('schedules.read.self'));
 grant select on public.employee_shifts to authenticated;
 revoke insert,update,delete on public.employee_shifts from authenticated;
 grant all on public.employee_shifts to service_role;
 end if;
end $install$;
do $install$ begin
 if to_regclass('public.attendance_attempts') is null then
 create table public.attendance_attempts (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete restrict,
  employee_id uuid references public.employees(id) on delete restrict,
  shift_id uuid references public.employee_shifts(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  requested_event text not null check(requested_event in ('clock_in','lunch_out','lunch_in','clock_out')),
  occurred_at timestamptz not null default now(),
  result text not null check(result in ('accepted','too_early','presence_validation_failed','presence_not_configured','no_assigned_shift','invalid_sequence','inactive_employee','permission_denied','duplicate_event','system_error')),
  presence_method text,
  presence_evidence jsonb not null default '{}',
  reason_code text,
  settings_version integer,
  created_at timestamptz not null default now()
);
 alter table public.attendance_attempts enable row level security;
 create policy attendance_attempts_own_read on public.attendance_attempts for select to authenticated using(museum_id=public.current_user_museum_id() and exists(select 1 from public.employees e where e.id=attendance_attempts.employee_id and e.museum_id=attendance_attempts.museum_id and e.profile_id=auth.uid() and e.status='activo'));
 grant select on public.attendance_attempts to authenticated;
 revoke insert,update,delete on public.attendance_attempts from authenticated;
 grant all on public.attendance_attempts to service_role;
 end if;
end $install$;
do $install$ begin
 if to_regclass('public.attendance_events') is null then
 create table public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  shift_id uuid not null references public.employee_shifts(id) on delete restrict,
  attempt_id uuid not null unique references public.attendance_attempts(id) on delete restrict,
  event_type text not null check(event_type in ('clock_in','lunch_out','lunch_in','clock_out')),
  occurred_at timestamptz not null,
  classification text not null check(classification in ('on_time','tolerance','late','partial_absence','standard','overtime_pending')),
  settings_version integer not null,
  supersedes_event_id uuid references public.attendance_events(id) on delete restrict,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
 alter table public.attendance_events enable row level security;
 create policy attendance_events_own_read on public.attendance_events for select to authenticated using(museum_id=public.current_user_museum_id() and exists(select 1 from public.employees e where e.id=attendance_events.employee_id and e.museum_id=attendance_events.museum_id and e.profile_id=auth.uid() and e.status='activo') and public.has_permission('time.read.self'));
 grant select on public.attendance_events to authenticated;
 revoke insert,update,delete on public.attendance_events from authenticated;
 grant all on public.attendance_events to service_role;
 end if;
end $install$;
do $install$ begin
 if to_regclass('public.attendance_correction_requests') is null then
 create table public.attendance_correction_requests (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  shift_id uuid not null references public.employee_shifts(id) on delete restrict,
  original_event_id uuid references public.attendance_events(id) on delete restrict,
  requested_event_type text not null check(requested_event_type in ('clock_in','lunch_out','lunch_in','clock_out')),
  requested_occurred_at timestamptz not null,
  reason text not null check(length(trim(reason))>=5),
  status text not null default 'pending' check(status in ('pending','approved','partially_approved','rejected','cancelled_by_requester')),
  requested_by uuid not null references public.profiles(id),
  requested_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  decision_reason text,
  corrected_event_id uuid references public.attendance_events(id) on delete restrict,
  check(decided_by is null or decided_by<>requested_by)
);
 alter table public.attendance_correction_requests enable row level security;
 create policy attendance_correction_requests_own_read on public.attendance_correction_requests for select to authenticated using(museum_id=public.current_user_museum_id() and exists(select 1 from public.employees e where e.id=attendance_correction_requests.employee_id and e.museum_id=attendance_correction_requests.museum_id and e.profile_id=auth.uid() and e.status='activo'));
 grant select on public.attendance_correction_requests to authenticated;
 revoke insert,update,delete on public.attendance_correction_requests from authenticated;
 grant all on public.attendance_correction_requests to service_role;
 end if;
end $install$;
do $install$ begin
 if to_regclass('public.attendance_overtime_reviews') is null then
 create table public.attendance_overtime_reviews (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  shift_id uuid not null unique references public.employee_shifts(id) on delete restrict,
  clock_out_event_id uuid not null references public.attendance_events(id) on delete restrict,
  additional_minutes integer not null check(additional_minutes>0),
  status text not null default 'pending' check(status in ('pending','approved','partially_approved','rejected')),
  approved_minutes integer check(approved_minutes is null or approved_minutes>=0),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now()
);
 alter table public.attendance_overtime_reviews enable row level security;
 create policy attendance_overtime_reviews_own_read on public.attendance_overtime_reviews for select to authenticated using(museum_id=public.current_user_museum_id() and exists(select 1 from public.employees e where e.id=attendance_overtime_reviews.employee_id and e.museum_id=attendance_overtime_reviews.museum_id and e.profile_id=auth.uid() and e.status='activo') and public.has_permission('time.read.self'));
 grant select on public.attendance_overtime_reviews to authenticated;
 revoke insert,update,delete on public.attendance_overtime_reviews from authenticated;
 grant all on public.attendance_overtime_reviews to service_role;
 end if;
end $install$;
create index if not exists employee_time_entries_employee_clock_idx on public.employee_time_entries(employee_id,clock_in desc);
create index if not exists employee_time_entries_museum_clock_idx on public.employee_time_entries(museum_id,clock_in desc);
create unique index if not exists employee_time_entries_one_open on public.employee_time_entries(employee_id) where clock_out is null;
create index if not exists employee_notifications_recipient_idx on public.employee_notifications(recipient_user_id,created_at desc);
create index if not exists employee_shifts_lookup_idx on public.employee_shifts(employee_id,starts_at,ends_at) where status='scheduled';
create index if not exists attendance_attempts_museum_time_idx on public.attendance_attempts(museum_id,occurred_at desc);
create index if not exists attendance_events_shift_idx on public.attendance_events(shift_id,occurred_at);
create unique index if not exists attendance_events_original_type_idx on public.attendance_events(shift_id,event_type) where supersedes_event_id is null;
alter table public.attendance_events add column if not exists correction_request_id uuid references public.attendance_correction_requests(id) on delete restrict;
create unique index if not exists attendance_events_correction_request_unique on public.attendance_events(correction_request_id) where correction_request_id is not null;
do $install$ begin
 if not exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='attendance_distance_meters') then
 execute $definition$create or replace function public.attendance_distance_meters(lat1 double precision,lon1 double precision,lat2 double precision,lon2 double precision)
returns double precision language sql immutable set search_path='' as $$
 select 6371000*2*asin(sqrt(power(sin(radians(lat2-lat1)/2),2)+cos(radians(lat1))*cos(radians(lat2))*power(sin(radians(lon2-lon1)/2),2)))
$$;$definition$;
 end if;
end $install$;
do $install$ begin
 if not exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='record_employee_attendance') then
 execute $definition$create or replace function public.record_employee_attendance(actor_user_id uuid,actor_museum_id uuid,requested_event text,presence jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 e public.employees; s public.employee_shifts; cfg public.attendance_settings; a public.attendance_attempts; ev public.attendance_events;
 now_at timestamptz:=now(); prior text; class text:='standard'; method text:=coalesce(presence->>'method',''); valid_presence boolean:=false; extra_minutes integer; audit_actor text;
begin
 if requested_event not in ('clock_in','lunch_out','lunch_in','clock_out') then raise exception 'INVALID_CLOCK_ACTION' using errcode='22023'; end if;
 select * into e from public.employees where museum_id=actor_museum_id and profile_id=actor_user_id and status='activo';
 if not found then raise exception 'ACTIVE_EMPLOYEE_REQUIRED' using errcode='P0001'; end if;
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
 -- QR and kiosk evidence must be validated by a dedicated trusted server flow;
 -- a browser-supplied boolean is intentionally never accepted here.
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
end $$;$definition$;
 end if;
end $install$;
do $install$ begin
 if not exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='prevent_attendance_history_mutation') then
 execute $definition$create or replace function public.prevent_attendance_history_mutation() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'ATTENDANCE_HISTORY_IMMUTABLE' using errcode='P0001'; end $$;$definition$;
 end if;
end $install$;

revoke all on function public.record_employee_attendance(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_employee_attendance(uuid,uuid,text,jsonb) to service_role;
do $$ begin
 if not exists(select 1 from pg_trigger where tgrelid='public.attendance_events'::regclass and tgname='attendance_events_immutable') then
 create trigger attendance_events_immutable before update or delete on public.attendance_events for each row execute function public.prevent_attendance_history_mutation(); end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.attendance_attempts'::regclass and tgname='attendance_attempts_immutable') then
 create trigger attendance_attempts_immutable before update or delete on public.attendance_attempts for each row execute function public.prevent_attendance_history_mutation(); end if;
end $$;
-- Restrictive SELECT applies AND to every coexisting permissive SELECT/ALL policy.
-- This closes both the named broad read policy and role-only ALL policies for reads.
drop policy if exists "users can read employees in museum" on public.employees;
drop policy if exists employee_record_read_boundary on public.employees;
create policy employee_record_read_boundary on public.employees as restrictive for select to authenticated
 using(museum_id=public.current_user_museum_id() and
 (public.has_permission('employees.read.all') or (profile_id=auth.uid() and public.has_permission('employees.read.self'))));
commit;
