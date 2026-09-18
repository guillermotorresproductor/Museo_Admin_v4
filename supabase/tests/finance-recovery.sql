-- Staging only. All synthetic financial records, identities and grants roll back.
begin;
select set_config('request.jwt.claim.role','service_role',true);
insert into public.museums(id,name,slug) values ('f5180000-0000-4000-8000-000000000002','TEST FINANCE ISOLATION','test-finance-rollback');
insert into auth.users(id,email,raw_user_meta_data) values
 ('f5180000-0000-4000-8000-000000000001','finance-rollback@example.invalid','{}'),
 ('f5180000-0000-4000-8000-000000000002','finance-other@example.invalid','{}'),
 ('f5180000-0000-4000-8000-000000000003','finance-reader@example.invalid','{}');
update public.profiles set museum_id='f5180000-0000-4000-8000-000000000002' where id='f5180000-0000-4000-8000-000000000002';
insert into public.user_permissions(museum_id,user_id,permission_id,effect)
 select pr.museum_id,pr.id,p.id,'allow' from public.profiles pr cross join public.permissions p
 where pr.id in ('f5180000-0000-4000-8000-000000000001','f5180000-0000-4000-8000-000000000002') and p.code in ('finance.read','finance.write','finance.export');
insert into public.user_permissions(museum_id,user_id,permission_id,effect)
 select pr.museum_id,pr.id,p.id,'allow' from public.profiles pr cross join public.permissions p
 where pr.id='f5180000-0000-4000-8000-000000000003' and p.code='finance.read';
insert into public.finance_records(id,museum_id,record_type,category,concept,month,year,amount)
 select id,museum_id,'income','TEST ONLY','ROLLBACK TEST','Septiembre',2026,123.45 from public.profiles
 where id in ('f5180000-0000-4000-8000-000000000001','f5180000-0000-4000-8000-000000000002');
create temporary table finance_test_results(check_name text,passed boolean);
grant all on finance_test_results to authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','f5180000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare result jsonb; blocked boolean; begin
 if (select count(*) from public.finance_records where concept='ROLLBACK TEST')<>1 then raise exception 'Cross-museum read leak'; end if;
 result:=public.update_finance_record_amount('f5180000-0000-4000-8000-000000000001',456.78);
 if result->>'audit_id' is null or (result->>'amount')::numeric<>456.78 then raise exception 'Save contract incomplete'; end if;
 if (select amount from public.finance_records where id='f5180000-0000-4000-8000-000000000001')<>456.78 then raise exception 'Saved amount missing'; end if;
 if not exists(select 1 from jsonb_array_elements(public.finance_audit_history(2026)) e where (e->>'old_amount')::numeric=123.45 and (e->>'new_amount')::numeric=456.78) then raise exception 'Durable audit missing'; end if;
 insert into finance_test_results values('save+read+durable_audit',true);
 blocked:=false;begin perform public.update_finance_record_amount('f5180000-0000-4000-8000-000000000002',999);exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Cross-museum write leak';end if;
 blocked:=false;begin update public.finance_records set amount=999 where id='f5180000-0000-4000-8000-000000000001';exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Direct PATCH bypass';end if;
 blocked:=false;begin perform public.update_finance_record_amount('f5180000-0000-4000-8000-000000000001',1.001);exception when invalid_parameter_value then blocked:=true;end;
 if not blocked then raise exception 'Extra decimals allowed';end if;
 insert into finance_test_results values('museum_boundary+RPC_only+currency_precision',true);
 perform set_config('request.jwt.claim.sub','f5180000-0000-4000-8000-000000000002',true);
 if jsonb_array_length(public.finance_audit_history(2026))<>0 then raise exception 'Other museum audit exposed';end if;
 perform set_config('request.jwt.claim.sub','f5180000-0000-4000-8000-000000000003',true);
 if (select count(*) from public.finance_records where concept='ROLLBACK TEST')<>1 then raise exception 'Read permission ignored';end if;
 blocked:=false;begin perform public.update_finance_record_amount('f5180000-0000-4000-8000-000000000001',999);exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Reader can write';end if;
 perform set_config('request.jwt.claim.sub','',true);
 if exists(select 1 from public.finance_records) then raise exception 'Unauthenticated read';end if;
 insert into finance_test_results values('reader_no_write+audit_isolation+unauthenticated',true);
end $$;
reset role;
create function pg_temp.fail_finance_test_audit() returns trigger language plpgsql as $$begin
 if new.record_id='f5180000-0000-4000-8000-000000000001'::uuid then raise exception 'TEST_AUDIT_FAILURE';end if;return new;end $$;
create trigger finance_test_audit_failure before insert on public.audit_logs for each row execute function pg_temp.fail_finance_test_audit();
select set_config('request.jwt.claim.sub','f5180000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare blocked boolean:=false;begin
 begin perform public.update_finance_record_amount('f5180000-0000-4000-8000-000000000001',999);
 exception when others then if sqlerrm<>'TEST_AUDIT_FAILURE' then raise;end if;blocked:=true;end;
 if not blocked or (select amount from public.finance_records where id='f5180000-0000-4000-8000-000000000001')<>456.78 then raise exception 'Audit failure did not roll back amount';end if;
 insert into finance_test_results values('atomic_rollback_on_audit_failure',true);
end $$;
reset role;
select * from finance_test_results;
rollback;
