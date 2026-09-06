
\set ON_ERROR_STOP on
-- Runs only in the disposable fixture database after existing transaction tests.
do $$ begin
 if current_database() !~ '^instituva_access_test_[0-9a-f]+$' then raise exception 'LOCAL_FIXTURE_REQUIRED'; end if;
 if (select count(*) from pg_trigger where tgrelid='public.profiles'::regclass and tgname='profiles_protect_security')<>1 then raise exception 'TRIGGER_NOT_UNIQUE'; end if;
end $$;
select set_config('request.jwt.claim.sub','',false);
select set_config('request.jwt.claim.role','service_role',false);
update profiles set status='activo' where id='20000000-0000-4000-8000-000000000001';
-- Normalized roles: all three levels get only the requested catalog additions.
do $$ declare lvl text; perm text; begin
 foreach lvl in array array['empleado','ejecutivo','administrador'] loop
  delete from user_roles where user_id='20000000-0000-4000-8000-000000000001';
  insert into user_roles(museum_id,user_id,role_id) select '00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',id from roles where code=lvl;
  update profiles set role=lvl where id='20000000-0000-4000-8000-000000000001';
  perform set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
  foreach perm in array array['schedules.read.self','time.clock','time.read.self'] loop
   if not has_permission(perm) then raise exception 'MISSING_PERSONAL_PERMISSION:%:%',lvl,perm; end if;
  end loop;
  perform set_config('request.jwt.claim.sub','',false);
 end loop;
end $$;
-- Same-museum deny wins; a different museum's exception cannot change this user.
insert into user_permissions(museum_id,user_id,permission_id,effect) select '00000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',id,'deny' from permissions where code='time.clock';
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
do $$ begin if not has_permission('time.clock') then raise exception 'CROSS_MUSEUM_DENY_LEAK'; end if; end $$;
insert into user_permissions(museum_id,user_id,permission_id,effect) select '00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',id,'deny' from permissions where code='time.clock';
do $$ begin if has_permission('time.clock') then raise exception 'DENY_IGNORED'; end if; end $$;
-- Authenticated clients cannot edit role/status, while service-role writes above succeeded.
select set_config('request.jwt.claim.role','authenticated',false);
set role authenticated;
do $$ begin
 begin update profiles set role='empleado' where id=auth.uid(); raise exception 'ROLE_WRITE_ACCEPTED'; exception when insufficient_privilege then null; end;
 begin update profiles set status='inactive' where id=auth.uid(); raise exception 'STATUS_WRITE_ACCEPTED'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',false);
select set_config('request.jwt.claim.role','service_role',false);
-- Production's legacy schema: remove only disposable normalized fixture tables.
drop table user_roles,role_permissions,roles;
\ir ../migrations/202609060002_personal_access_compatibility.sql
\ir ../migrations/202609060002_personal_access_compatibility.sql
do $$ declare lvl text; perm text; begin
 foreach lvl in array array['empleado','ejecutivo','administrador'] loop
  update profiles set role=lvl where id='20000000-0000-4000-8000-000000000001';
  perform set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
  if has_permission('time.clock') then raise exception 'LEGACY_DENY_IGNORED'; end if;
  foreach perm in array array['schedules.read.self','time.read.self'] loop
   if not has_permission(perm) then raise exception 'LEGACY_MISSING:%:%',lvl,perm; end if;
  end loop;
  if lvl='empleado' and has_permission('finance.read') then raise exception 'UNRELATED_GRANT'; end if;
  perform set_config('request.jwt.claim.sub','',false);
 end loop;
end $$;
select 'PASS: normalized/legacy personal permissions, deny precedence, museum scoping, trigger idempotence and protected writes';
