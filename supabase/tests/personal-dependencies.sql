
\set ON_ERROR_STOP on
\ir employee-access-transaction.fixture.sql
-- Reproduce legacy Production: no normalized roles, no attendance objects,
-- Spanish status values, user_id audit column, canonical profile_id only.
drop table public.user_roles,public.role_permissions,public.roles;
alter table public.audit_logs rename column actor_user_id to user_id;
create table public.museums(id uuid primary key);
insert into public.museums values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
create table auth.users(id uuid primary key);
insert into auth.users select id from profiles;
update profiles set status='activo';
alter table profiles add constraint production_status check(status in ('activo','inactivo'));
drop trigger profiles_protect_security on profiles;
\ir ../migrations/202609060001_transactional_employee_access_level.sql
\ir ../migrations/202609060002_personal_access_compatibility.sql
alter table employees enable row level security;
create policy "users can read employees in museum" on employees for select to authenticated using(museum_id=public.current_user_museum_id());
create policy legacy_coexisting_all on employees for all to authenticated using(museum_id=public.current_user_museum_id());
grant select on employees to authenticated;
\ir ../migrations/202609060003_personal_attendance_dependencies.sql
\ir ../migrations/202609060003_personal_attendance_dependencies.sql
begin;
insert into employee_shifts(id,museum_id,employee_id,starts_at,ends_at,created_by)
 select id,museum_id,id,now()-interval '1 minute',now()+interval '1 hour',profile_id from employees where profile_id is not null;
insert into employee_time_entries(museum_id,employee_id,clock_in,created_by)
 select museum_id,id,now(),profile_id from employees where profile_id is not null;
insert into attendance_attempts(id,museum_id,employee_id,shift_id,actor_user_id,requested_event,result)
 select id,museum_id,id,id,profile_id,'clock_in','accepted' from employees where profile_id is not null;
insert into attendance_events(museum_id,employee_id,shift_id,attempt_id,event_type,occurred_at,classification,settings_version,created_by)
 select museum_id,id,id,id,'clock_in',now(),'on_time',1,profile_id from employees where profile_id is not null;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$ declare n int; begin
 select count(*) into n from employees; if n<>1 then raise exception 'EMPLOYEE_READ_LEAK:%',n; end if;
 select count(*) into n from employee_shifts; if n<>1 then raise exception 'SHIFT_READ_LEAK:%',n; end if;
 select count(*) into n from employee_time_entries; if n<>1 then raise exception 'TIME_READ_LEAK:%',n; end if;
 select count(*) into n from attendance_events; if n<>1 then raise exception 'EVENT_READ_LEAK:%',n; end if;
 begin perform record_employee_attendance(auth.uid(),current_user_museum_id(),'clock_in'); raise exception 'CLIENT_CLOCK_RPC_ALLOWED'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin if (select count(*) from employees)<>3 then raise exception 'INSTITUTIONAL_READ_BROKEN'; end if; end $$;
reset role;
insert into user_permissions(museum_id,user_id,permission_id,effect) select '00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',id,'deny' from permissions where code='employees.read.all';
set local role authenticated;
do $$ begin if (select count(*) from employees)<>1 then raise exception 'INSTITUTIONAL_DENY_IGNORED'; end if; end $$;
reset role;
rollback;
-- Exercise actual existing attendance implementation against legacy shape.
do $$ declare result jsonb; begin
 result:=record_employee_attendance('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','clock_in');
 if result->>'code'<>'PRESENCE_NOT_CONFIGURED' then raise exception 'UNCONFIGURED_NOT_FAIL_CLOSED'; end if;
end $$;
insert into attendance_settings(museum_id,presence_required) values('00000000-0000-4000-8000-000000000001',false);
insert into employee_shifts(museum_id,employee_id,starts_at,ends_at,created_by) values('00000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',now()-interval '1 minute',now()+interval '1 hour','10000000-0000-4000-8000-000000000001');
do $$ declare result jsonb; begin
 result:=record_employee_attendance('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','clock_in');
 if result->>'ok'<>'true' then raise exception 'CLOCK_IN_FAILED:%',result; end if;
 result:=record_employee_attendance('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','clock_out');
 if result->>'ok'<>'true' then raise exception 'CLOCK_OUT_FAILED:%',result; end if;
 if (select count(*) from audit_logs where action='ATTENDANCE_EVENT_RECORDED')<>2 then raise exception 'AUDIT_MISSING'; end if;
 begin update attendance_events set event_type='lunch_in'; raise exception 'IMMUTABILITY_BROKEN'; exception when raise_exception then if sqlerrm<>'ATTENDANCE_HISTORY_IMMUTABLE' then raise; end if; end;
end $$;
