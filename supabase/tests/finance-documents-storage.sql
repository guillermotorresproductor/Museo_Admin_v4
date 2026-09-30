-- Rolls back documents, users, and storage rows. Policies and triggers stay.
begin;

select set_config('request.jwt.claim.role', 'service_role', true);

create temporary table finance_document_storage_guard (
  record_rows bigint,
  record_hash text,
  line_rows bigint,
  movement_rows bigint,
  assignment_rows bigint,
  document_rows bigint,
  post_hash text,
  void_hash text,
  correct_hash text,
  payroll_hash text,
  guard_hash text
);

insert into finance_document_storage_guard
select
  (select count(*) from public.finance_records),
  (select md5(string_agg(r.id::text || ':' || r.amount::text, ',' order by r.id)) from public.finance_records r),
  (select count(*) from public.finance_budget_lines),
  (select count(*) from public.finance_movements),
  (select count(*) from public.employee_budget_assignments),
  (select count(*) from public.finance_documents),
  (select md5(pg_get_functiondef('public.post_finance_movement(uuid,date,numeric,text,uuid)'::regprocedure))),
  (select md5(pg_get_functiondef('public.void_finance_movement(uuid,text)'::regprocedure))),
  (select md5(pg_get_functiondef('public.correct_finance_movement(uuid,text,uuid,date,numeric,text,uuid)'::regprocedure))),
  (select md5(pg_get_functiondef('public.payroll_actual(date,date)'::regprocedure))),
  (select md5(pg_get_functiondef('public.finance_documents_guard()'::regprocedure)));

insert into public.museums (id, name, slug, fiscal_year_start_month)
values
  ('fd200000-0000-4000-8000-0000000000a1', 'TEST STORAGE A', 'test-finance-storage-a', 9),
  ('fd200000-0000-4000-8000-0000000000b1', 'TEST STORAGE B', 'test-finance-storage-b', 9);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('fd200000-0000-4000-8000-0000000000a2', 'storage-reader-a@example.invalid', '{}'),
  ('fd200000-0000-4000-8000-0000000000a4', 'storage-limited-a@example.invalid', '{}'),
  ('fd200000-0000-4000-8000-0000000000b2', 'storage-reader-b@example.invalid', '{}');

update public.profiles
set museum_id = 'fd200000-0000-4000-8000-0000000000a1'
where id in (
  'fd200000-0000-4000-8000-0000000000a2',
  'fd200000-0000-4000-8000-0000000000a4'
);
update public.profiles
set museum_id = 'fd200000-0000-4000-8000-0000000000b1'
where id = 'fd200000-0000-4000-8000-0000000000b2';

insert into public.user_permissions (museum_id, user_id, permission_id, effect)
select pr.museum_id, pr.id, p.id, 'allow'
from public.profiles pr
cross join public.permissions p
where pr.id in (
    'fd200000-0000-4000-8000-0000000000a2',
    'fd200000-0000-4000-8000-0000000000a4',
    'fd200000-0000-4000-8000-0000000000b2'
  )
  and p.code = 'finance.read';

alter table public.employees disable trigger protect_employee_module_profile;
insert into public.employees (
  id, museum_id, profile_id, first_name, last_name, position, department, email, status, access_profile
) values (
  'fd200000-0000-4000-8000-0000000000a9',
  'fd200000-0000-4000-8000-0000000000a1',
  'fd200000-0000-4000-8000-0000000000a4',
  'Modulo', 'Ajeno', 'Mantenimiento', 'Operaciones',
  'storage-limited-a@example.invalid', 'activo', 'mantenimiento'
);
alter table public.employees enable trigger protect_employee_module_profile;

insert into public.finance_documents (
  id, museum_id, status, original_path, original_mime, original_byte_size, original_sha256,
  original_filename, uploaded_by
) values (
  'fd200000-0000-4000-8000-0000000000d1',
  'fd200000-0000-4000-8000-0000000000a1',
  'pending_review',
  'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d1/original',
  'application/pdf',
  1200,
  repeat('a', 64),
  'factura.pdf',
  'fd200000-0000-4000-8000-0000000000a2'
);

insert into storage.objects (bucket_id, name, owner_id, metadata)
values
  (
    'finance-documents',
    'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d1/original',
    'fd200000-0000-4000-8000-0000000000a2',
    '{"mimetype":"application/pdf","size":1200}'::jsonb
  ),
  (
    'finance-documents',
    'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d2/original',
    'fd200000-0000-4000-8000-0000000000a2',
    '{"mimetype":"application/pdf","size":10}'::jsonb
  ),
  (
    'finance-documents',
    'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d1/derived',
    'fd200000-0000-4000-8000-0000000000a2',
    '{"mimetype":"image/jpeg","size":20}'::jsonb
  ),
  (
    'finance-documents',
    'fd200000-0000-4000-8000-0000000000b1/fd200000-0000-4000-8000-0000000000d1/original',
    'fd200000-0000-4000-8000-0000000000b2',
    '{"mimetype":"application/pdf","size":10}'::jsonb
  );

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

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'fd200000-0000-4000-8000-0000000000a2', true);
select set_config('request.jwt.claims', '{"sub":"fd200000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  seen integer;
begin
  select count(*) into seen
  from storage.objects
  where bucket_id = 'finance-documents'
    and name = 'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d1/original';
  if seen <> 1 then
    raise exception 'LINKED_ORIGINAL_READ %', seen;
  end if;

  select count(*) into seen
  from storage.objects
  where bucket_id = 'finance-documents'
    and name = 'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d2/original';
  if seen <> 0 then
    raise exception 'ORPHAN_STILL_VISIBLE %', seen;
  end if;

  select count(*) into seen
  from storage.objects
  where bucket_id = 'finance-documents'
    and name = 'fd200000-0000-4000-8000-0000000000b1/fd200000-0000-4000-8000-0000000000d1/original';
  if seen <> 0 then
    raise exception 'PATH_MUSEUM_MISMATCH_VISIBLE %', seen;
  end if;

  select count(*) into seen
  from storage.objects
  where bucket_id = 'finance-documents'
    and name = 'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d1/derived';
  if seen <> 0 then
    raise exception 'UNLINKED_DERIVED_VISIBLE %', seen;
  end if;

  begin
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values (
      'finance-documents',
      'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d9/original',
      'fd200000-0000-4000-8000-0000000000a2',
      '{"size":1}'::jsonb
    );
    raise exception 'CLIENT_STORAGE_INSERT';
  exception when insufficient_privilege then
    null;
  end;

  update storage.objects
  set metadata = '{"size":1}'::jsonb
  where bucket_id = 'finance-documents'
    and name = 'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d1/derived';
  if found then
    raise exception 'CLIENT_STORAGE_UPDATE';
  end if;

  begin
    delete from storage.objects
    where bucket_id = 'finance-documents'
      and name = 'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d1/derived';
    raise exception 'CLIENT_STORAGE_DELETE';
  exception
    when insufficient_privilege then
      null;
    when others then
      if sqlerrm not like '%Direct deletion from storage tables is not allowed%'
         and sqlerrm <> 'CLIENT_STORAGE_DELETE' then
        raise;
      end if;
      if sqlerrm = 'CLIENT_STORAGE_DELETE' then
        raise;
      end if;
  end;
end
$$;

select set_config('request.jwt.claim.sub', 'fd200000-0000-4000-8000-0000000000b2', true);
select set_config('request.jwt.claims', '{"sub":"fd200000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);

do $$
begin
  if (
    select count(*) from storage.objects
    where bucket_id = 'finance-documents'
      and name = 'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d1/original'
  ) <> 0 then
    raise exception 'CROSS_MUSEUM_OBJECT_READ';
  end if;
  if (
    select count(*) from storage.objects
    where bucket_id = 'finance-documents'
      and name = 'fd200000-0000-4000-8000-0000000000b1/fd200000-0000-4000-8000-0000000000d1/original'
  ) <> 0 then
    raise exception 'FOREIGN_PATH_WITH_REAL_ID';
  end if;
end
$$;

select set_config('request.jwt.claim.sub', 'fd200000-0000-4000-8000-0000000000a4', true);
select set_config('request.jwt.claims', '{"sub":"fd200000-0000-4000-8000-0000000000a4","role":"authenticated"}', true);

do $$
begin
  if public.module_profile_allows('administration') then
    raise exception 'MODULE_PROFILE_UNEXPECTED';
  end if;
  if (
    select count(*) from storage.objects
    where name = 'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d1/original'
  ) <> 0 then
    raise exception 'MODULE_BOUNDARY_OBJECT_READ';
  end if;
end
$$;

reset role;

do $$
begin
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'finance-documents'
      and name = 'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d2/original'
  ) then
    raise exception 'ORPHAN_MISSING_BEFORE_CLEANUP';
  end if;
end
$$;

select pg_temp.must_raise($$
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values (
    'finance-documents',
    'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d1/original',
    'fd200000-0000-4000-8000-0000000000a2',
    '{"mimetype":"application/pdf","size":1}'::jsonb
  )
$$, 'duplicate key');

select pg_temp.must_raise($$
  update storage.objects
  set metadata = '{"mimetype":"application/pdf","size":1}'::jsonb
  where bucket_id = 'finance-documents'
    and name = 'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d1/original'
$$, 'ORIGINAL_OBJECT_IMMUTABLE');

select set_config('storage.allow_delete_query', 'true', true);

select pg_temp.must_raise($$
  delete from storage.objects
  where bucket_id = 'finance-documents'
    and name = 'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d1/original'
$$, 'ORIGINAL_OBJECT_IMMUTABLE');

delete from storage.objects
where bucket_id = 'finance-documents'
  and name = 'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d2/original';

update storage.objects
set metadata = '{"mimetype":"image/jpeg","size":21,"replaced":true}'::jsonb
where bucket_id = 'finance-documents'
  and name = 'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d1/derived';

update public.finance_documents
set derived_path = 'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d1/derived',
    derived_mime = 'image/jpeg',
    derived_updated_at = now()
where id = 'fd200000-0000-4000-8000-0000000000d1';

update storage.objects
set metadata = '{"mimetype":"image/jpeg","size":22,"replaced":true}'::jsonb
where bucket_id = 'finance-documents'
  and name = 'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d1/derived';

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'fd200000-0000-4000-8000-0000000000a2', true);
select set_config('request.jwt.claims', '{"sub":"fd200000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  if (
    select count(*) from storage.objects
    where bucket_id = 'finance-documents'
      and name = 'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d1/derived'
  ) <> 1 then
    raise exception 'LINKED_DERIVED_READ';
  end if;
end
$$;

reset role;

do $$
declare
  guard finance_document_storage_guard;
begin
  if exists (
    select 1 from storage.objects
    where bucket_id = 'finance-documents'
      and name = 'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d2/original'
  ) then
    raise exception 'ORPHAN_NOT_REMOVED';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'finance-documents'
      and name = 'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d1/original'
      and metadata->>'size' = '1200'
  ) then
    raise exception 'REFERENCED_ORIGINAL_CHANGED';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'finance-documents'
      and name = 'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d1/derived'
      and metadata->>'size' = '22'
  ) then
    raise exception 'DERIVED_NOT_REPLACEABLE';
  end if;

  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects
  where bucket_id = 'finance-documents'
    and name = 'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d1/derived';
  if exists (
    select 1 from storage.objects
    where bucket_id = 'finance-documents'
      and name = 'fd200000-0000-4000-8000-0000000000a1/fd200000-0000-4000-8000-0000000000d1/derived'
  ) then
    raise exception 'DERIVED_DELETE_BLOCKED';
  end if;

  select * into guard from finance_document_storage_guard;
  if guard.document_rows is distinct from (
       select count(*) from public.finance_documents
       where museum_id not in (
         'fd200000-0000-4000-8000-0000000000a1',
         'fd200000-0000-4000-8000-0000000000b1'
       )
     )
     or guard.record_rows is distinct from (
       select count(*) from public.finance_records
       where museum_id not in (
         'fd200000-0000-4000-8000-0000000000a1',
         'fd200000-0000-4000-8000-0000000000b1'
       )
     )
     or guard.record_hash is distinct from (
       select md5(string_agg(r.id::text || ':' || r.amount::text, ',' order by r.id))
       from public.finance_records r
       where r.museum_id not in (
         'fd200000-0000-4000-8000-0000000000a1',
         'fd200000-0000-4000-8000-0000000000b1'
       )
     )
     or guard.line_rows is distinct from (
       select count(*) from public.finance_budget_lines
       where museum_id not in (
         'fd200000-0000-4000-8000-0000000000a1',
         'fd200000-0000-4000-8000-0000000000b1'
       )
     )
     or guard.movement_rows is distinct from (select count(*) from public.finance_movements)
     or guard.assignment_rows is distinct from (select count(*) from public.employee_budget_assignments)
     or guard.post_hash is distinct from (select md5(pg_get_functiondef('public.post_finance_movement(uuid,date,numeric,text,uuid)'::regprocedure)))
     or guard.void_hash is distinct from (select md5(pg_get_functiondef('public.void_finance_movement(uuid,text)'::regprocedure)))
     or guard.correct_hash is distinct from (select md5(pg_get_functiondef('public.correct_finance_movement(uuid,text,uuid,date,numeric,text,uuid)'::regprocedure)))
     or guard.payroll_hash is distinct from (select md5(pg_get_functiondef('public.payroll_actual(date,date)'::regprocedure)))
     or guard.guard_hash is distinct from (select md5(pg_get_functiondef('public.finance_documents_guard()'::regprocedure))) then
    raise exception 'BASELINE_TOUCHED';
  end if;
  if not exists (
    select 1 from storage.buckets
    where id = 'finance-documents'
      and public = false
      and file_size_limit = 15728640
      and allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
  ) then
    raise exception 'BUCKET';
  end if;
  if has_table_privilege('authenticated', 'public.finance_documents', 'insert')
     or has_table_privilege('authenticated', 'public.finance_documents', 'update')
     or has_table_privilege('authenticated', 'public.finance_documents', 'delete') then
    raise exception 'DOCUMENT_WRITE_GRANT';
  end if;
end
$$;

select 'FINANCE_DOCUMENTS_STORAGE_PASS' as result;

rollback;
