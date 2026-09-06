\set ON_ERROR_STOP on
-- Run after the fixture in the same disposable local database.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select set_config('request.jwt.claim.role','authenticated',false);
do $$ declare before_state jsonb; point text; failed boolean; begin
 foreach point in array array['profile','delete','insert','employee','audit'] loop
  perform set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
  before_state:=public.test_access_snapshot();
  perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
  perform set_config('test.access_fault',point,true);
  failed:=false;
  begin
   perform public.replace_employee_access_level('40000000-0000-4000-8000-000000000001','ejecutivo','empleado');
  exception when others then
   if sqlerrm <> 'INJECTED:'||point then raise; end if;
   failed:=true;
  end;
  if not failed then raise exception 'Injection did not execute: %',point; end if;
  perform set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
  if public.test_access_snapshot() is distinct from before_state then raise exception 'Rollback mismatch: %',point; end if;
  raise notice 'PASS real PostgreSQL rollback after % (including exact prior effective permissions)',point;
 end loop;
end $$;
select set_config('test.access_fault','',false);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$ declare before_state jsonb; failed boolean:=false; begin
 before_state:=public.test_access_snapshot();
 perform set_config('test.access_fault','audit',true);
 begin
  perform public.replace_employee_access_level('40000000-0000-4000-8000-000000000004','ejecutivo','empleado');
 exception when others then
  if sqlerrm <> 'INJECTED:audit' then raise; end if;
  failed:=true;
 end;
 if not failed or public.test_access_snapshot() is distinct from before_state then raise exception 'Unlinked employee audit rollback failed'; end if;
end $$;
-- Test the real authenticated SQL role: direct profile mutation remains denied.
set role authenticated;
do $$ begin
 begin
  update public.profiles set role='administrador' where id='20000000-0000-4000-8000-000000000001';
  raise exception 'Direct role update unexpectedly allowed';
 exception when insufficient_privilege then null; end;
 perform public.replace_employee_access_level('40000000-0000-4000-8000-000000000001','ejecutivo','empleado');
end $$;
reset role;
do $$ begin
 if (select role from public.profiles where id='20000000-0000-4000-8000-000000000001') <> 'ejecutivo'
 or (select status from public.profiles where id='20000000-0000-4000-8000-000000000001') <> 'active'
 or (select access_level from public.employees where id='40000000-0000-4000-8000-000000000001') <> 'ejecutivo'
 or (select count(*) from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id='20000000-0000-4000-8000-000000000001' and r.code in ('empleado','ejecutivo','administrador')) <> 1
 or not exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where r.code='finanzas')
 or not exists(select 1 from public.user_permissions where effect='deny')
 or not exists(select 1 from public.audit_logs where action='ACCESS_LEVEL_CHANGED') then raise exception 'Successful replacement mismatch'; end if;
 begin
  perform public.replace_employee_access_level('40000000-0000-4000-8000-000000000001','administrador','empleado');
  raise exception 'Stale level accepted'; exception when serialization_failure then null; end;
 begin
  perform public.replace_employee_access_level('40000000-0000-4000-8000-000000000002','empleado','administrador');
  raise exception 'Self change accepted'; exception when insufficient_privilege then null; end;
 begin
  perform public.replace_employee_access_level('40000000-0000-4000-8000-000000000003','ejecutivo','empleado');
  raise exception 'Cross museum accepted'; exception when insufficient_privilege then null; end;
 begin
  perform public.replace_employee_access_level('40000000-0000-4000-8000-000000000001','director','ejecutivo');
  raise exception 'Invalid level accepted'; exception when invalid_parameter_value then null; end;
 perform set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
 begin
  perform public.replace_employee_access_level('40000000-0000-4000-8000-000000000004','ejecutivo','empleado');
  raise exception 'Unauthorized caller accepted'; exception when insufficient_privilege then null; end;
end $$;
-- Return to the baseline level for the two-session concurrency test.
select public.replace_employee_access_level('40000000-0000-4000-8000-000000000001','empleado','ejecutivo');
