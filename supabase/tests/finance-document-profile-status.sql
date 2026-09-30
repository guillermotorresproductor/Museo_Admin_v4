-- Rolls back synthetic profiles, documents, and the temporary constraint drop.
begin;

create temporary table finance_profile_status_baseline (
  record_rows bigint,
  record_hash text,
  record_sum numeric,
  line_rows bigint,
  movement_rows bigint,
  assignment_rows bigint,
  document_rows bigint,
  e2e_status text,
  e2e_sha text,
  e2e_bytes integer,
  post_hash text,
  void_hash text,
  correct_hash text,
  payroll_hash text,
  guard_hash text,
  status_check text
);

insert into finance_profile_status_baseline
select
  (select count(*) from public.finance_records),
  (select md5(string_agg(r.id::text || ':' || r.amount::text, ',' order by r.id)) from public.finance_records r),
  (select coalesce(sum(amount), 0) from public.finance_records),
  (select count(*) from public.finance_budget_lines),
  (select count(*) from public.finance_movements),
  (select count(*) from public.employee_budget_assignments),
  (select count(*) from public.finance_documents),
  (select status from public.finance_documents where id = 'e9707e13-6b81-46bd-9054-796378366d49'),
  (select original_sha256 from public.finance_documents where id = 'e9707e13-6b81-46bd-9054-796378366d49'),
  (select original_byte_size from public.finance_documents where id = 'e9707e13-6b81-46bd-9054-796378366d49'),
  (select md5(pg_get_functiondef('public.post_finance_movement(uuid,date,numeric,text,uuid)'::regprocedure))),
  (select md5(pg_get_functiondef('public.void_finance_movement(uuid,text)'::regprocedure))),
  (select md5(pg_get_functiondef('public.correct_finance_movement(uuid,text,uuid,date,numeric,text,uuid)'::regprocedure))),
  (select md5(pg_get_functiondef('public.payroll_actual(date,date)'::regprocedure))),
  (select md5(pg_get_functiondef('public.finance_documents_guard()'::regprocedure))),
  (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_status_check');

insert into public.museums (id, name, slug, fiscal_year_start_month)
values
  ('fd300006-0000-4000-8000-0000000000a1', 'TEST PROFILE STATUS A', 'test-finance-profile-status-a', 9),
  ('fd300006-0000-4000-8000-0000000000b1', 'TEST PROFILE STATUS B', 'test-finance-profile-status-b', 9);

insert into auth.users (id, email, raw_user_meta_data)
values ('fd300006-0000-4000-8000-0000000000a2', 'profile-status-a@example.invalid', '{}');

update public.profiles
set museum_id = 'fd300006-0000-4000-8000-0000000000a1',
    status = 'active'
where id = 'fd300006-0000-4000-8000-0000000000a2';

create function pg_temp.must_raise(statement text, expected text) returns void
language plpgsql
as $$
begin
  execute statement;
  raise exception 'EXPECTED_FAILURE %', expected;
exception
  when others then
    if sqlerrm like 'EXPECTED_FAILURE%' then
      raise;
    end if;
    if sqlerrm <> expected and sqlerrm not like '%' || expected || '%' then
      raise exception 'WRONG_FAILURE expected % got %', expected, sqlerrm;
    end if;
end
$$;

do $$
declare
  created jsonb;
  actor_column text;
  actor uuid;
begin
  if (select status from public.profiles where id = 'fd300006-0000-4000-8000-0000000000a2') is distinct from 'active' then
    raise exception 'ACTIVE_FIXTURE';
  end if;

  created := public.create_finance_document_pending(
    'fd300006-0000-4000-8000-0000000000a2',
    'fd300006-0000-4000-8000-0000000000a1',
    'fd300006-0000-4000-8000-0000000000d1',
    'active.pdf',
    'application/pdf',
    8,
    repeat('a1', 32)
  );
  if created->>'status' is distinct from 'pending_review'
     or created->>'document_id' is distinct from 'fd300006-0000-4000-8000-0000000000d1' then
    raise exception 'ACTIVE_REJECTED %', created;
  end if;

  select a.attname into actor_column
  from pg_attribute a
  where a.attrelid = 'public.audit_logs'::regclass
    and not a.attisdropped
    and a.attname in ('user_id', 'actor_user_id')
  order by case a.attname when 'user_id' then 0 else 1 end
  limit 1;
  execute format(
    'select %I from public.audit_logs where record_id = $1 and action = $2',
    actor_column
  ) into actor using 'fd300006-0000-4000-8000-0000000000d1'::uuid, 'finance_document_upload';
  if actor is distinct from 'fd300006-0000-4000-8000-0000000000a2'::uuid then
    raise exception 'ACTIVE_AUDIT %', actor;
  end if;
end
$$;

select pg_temp.must_raise($$
  select public.create_finance_document_pending(
    'fd300006-0000-4000-8000-0000000000a2',
    'fd300006-0000-4000-8000-0000000000b1',
    'fd300006-0000-4000-8000-0000000000d9',
    'otro-museo.pdf',
    'application/pdf',
    8,
    repeat('b2', 32)
  )
$$, 'MUSEUM_MISMATCH');

update public.profiles
set status = 'inactive'
where id = 'fd300006-0000-4000-8000-0000000000a2';

select pg_temp.must_raise($$
  select public.create_finance_document_pending(
    'fd300006-0000-4000-8000-0000000000a2',
    'fd300006-0000-4000-8000-0000000000a1',
    'fd300006-0000-4000-8000-0000000000d3',
    'inactive.pdf',
    'application/pdf',
    8,
    repeat('c3', 32)
  )
$$, 'PROFILE_REQUIRED');

update public.profiles
set status = 'suspended'
where id = 'fd300006-0000-4000-8000-0000000000a2';

select pg_temp.must_raise($$
  select public.create_finance_document_pending(
    'fd300006-0000-4000-8000-0000000000a2',
    'fd300006-0000-4000-8000-0000000000a1',
    'fd300006-0000-4000-8000-0000000000d4',
    'suspended.pdf',
    'application/pdf',
    8,
    repeat('d4', 32)
  )
$$, 'PROFILE_REQUIRED');

alter table public.profiles drop constraint profiles_status_check;

update public.profiles
set status = 'activo'
where id = 'fd300006-0000-4000-8000-0000000000a2';

do $$
declare
  created jsonb;
  duplicate jsonb;
  actor_column text;
  actor uuid;
begin
  created := public.create_finance_document_pending(
    'fd300006-0000-4000-8000-0000000000a2',
    'fd300006-0000-4000-8000-0000000000a1',
    'fd300006-0000-4000-8000-0000000000d2',
    'activo.pdf',
    'application/pdf',
    8,
    repeat('e5', 32)
  );
  if created->>'status' is distinct from 'pending_review'
     or created->>'document_id' is distinct from 'fd300006-0000-4000-8000-0000000000d2' then
    raise exception 'ACTIVO_REJECTED %', created;
  end if;

  duplicate := public.create_finance_document_pending(
    'fd300006-0000-4000-8000-0000000000a2',
    'fd300006-0000-4000-8000-0000000000a1',
    'fd300006-0000-4000-8000-0000000000d8',
    'activo-duplicado.pdf',
    'application/pdf',
    8,
    repeat('e5', 32)
  );
  if duplicate->>'code' is distinct from 'DUPLICATE_DOCUMENT'
     or duplicate->>'document_id' is distinct from 'fd300006-0000-4000-8000-0000000000d2' then
    raise exception 'ACTIVO_DUPLICATE %', duplicate;
  end if;

  select a.attname into actor_column
  from pg_attribute a
  where a.attrelid = 'public.audit_logs'::regclass
    and not a.attisdropped
    and a.attname in ('user_id', 'actor_user_id')
  order by case a.attname when 'user_id' then 0 else 1 end
  limit 1;
  execute format(
    'select %I from public.audit_logs where record_id = $1 and action = $2',
    actor_column
  ) into actor using 'fd300006-0000-4000-8000-0000000000d2'::uuid, 'finance_document_upload';
  if actor is distinct from 'fd300006-0000-4000-8000-0000000000a2'::uuid then
    raise exception 'ACTIVO_AUDIT %', actor;
  end if;
end
$$;

update public.profiles
set status = 'inactivo'
where id = 'fd300006-0000-4000-8000-0000000000a2';

select pg_temp.must_raise($$
  select public.create_finance_document_pending(
    'fd300006-0000-4000-8000-0000000000a2',
    'fd300006-0000-4000-8000-0000000000a1',
    'fd300006-0000-4000-8000-0000000000d5',
    'inactivo.pdf',
    'application/pdf',
    8,
    repeat('f6', 32)
  )
$$, 'PROFILE_REQUIRED');

update public.profiles
set status = 'pending'
where id = 'fd300006-0000-4000-8000-0000000000a2';

select pg_temp.must_raise($$
  select public.create_finance_document_pending(
    'fd300006-0000-4000-8000-0000000000a2',
    'fd300006-0000-4000-8000-0000000000a1',
    'fd300006-0000-4000-8000-0000000000d6',
    'pending.pdf',
    'application/pdf',
    8,
    repeat('a7', 32)
  )
$$, 'PROFILE_REQUIRED');

set local role authenticated;
do $$
begin
  perform public.create_finance_document_pending(
    'fd300006-0000-4000-8000-0000000000a2',
    'fd300006-0000-4000-8000-0000000000a1',
    'fd300006-0000-4000-8000-0000000000d7',
    'cliente.pdf',
    'application/pdf',
    8,
    repeat('b8', 32)
  );
  raise exception 'CLIENT_RPC';
exception
  when insufficient_privilege then
    null;
end
$$;
reset role;

do $$
declare baseline finance_profile_status_baseline;
begin
  select * into baseline from finance_profile_status_baseline;
  if (select count(*) from public.finance_documents where id in (
       'fd300006-0000-4000-8000-0000000000d3',
       'fd300006-0000-4000-8000-0000000000d4',
       'fd300006-0000-4000-8000-0000000000d5',
       'fd300006-0000-4000-8000-0000000000d6',
       'fd300006-0000-4000-8000-0000000000d7',
       'fd300006-0000-4000-8000-0000000000d8',
       'fd300006-0000-4000-8000-0000000000d9'
     )) <> 0 then
    raise exception 'REJECTED_STATUS_CREATED_ROW';
  end if;
  if (select count(*) from public.finance_records) is distinct from baseline.record_rows
     or (select md5(string_agg(r.id::text || ':' || r.amount::text, ',' order by r.id)) from public.finance_records r) is distinct from baseline.record_hash
     or (select coalesce(sum(amount), 0) from public.finance_records) is distinct from baseline.record_sum
     or (select count(*) from public.finance_budget_lines) is distinct from baseline.line_rows
     or (select count(*) from public.finance_movements) is distinct from baseline.movement_rows
     or (select count(*) from public.employee_budget_assignments) is distinct from baseline.assignment_rows
     or (select md5(pg_get_functiondef('public.post_finance_movement(uuid,date,numeric,text,uuid)'::regprocedure))) is distinct from baseline.post_hash
     or (select md5(pg_get_functiondef('public.void_finance_movement(uuid,text)'::regprocedure))) is distinct from baseline.void_hash
     or (select md5(pg_get_functiondef('public.correct_finance_movement(uuid,text,uuid,date,numeric,text,uuid)'::regprocedure))) is distinct from baseline.correct_hash
     or (select md5(pg_get_functiondef('public.payroll_actual(date,date)'::regprocedure))) is distinct from baseline.payroll_hash
     or (select md5(pg_get_functiondef('public.finance_documents_guard()'::regprocedure))) is distinct from baseline.guard_hash
     or (select status from public.finance_documents where id = 'e9707e13-6b81-46bd-9054-796378366d49') is distinct from baseline.e2e_status
     or (select original_sha256 from public.finance_documents where id = 'e9707e13-6b81-46bd-9054-796378366d49') is distinct from baseline.e2e_sha
     or (select original_byte_size from public.finance_documents where id = 'e9707e13-6b81-46bd-9054-796378366d49') is distinct from baseline.e2e_bytes then
    raise exception 'BASELINE_TOUCHED';
  end if;
end
$$;

select 'PROFILE_STATUS_PASS' as result;

rollback;
