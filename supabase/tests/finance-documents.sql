-- Rolls back. Does not keep museums, documents, storage objects, or movements.
begin;

select set_config('request.jwt.claim.role', 'service_role', true);

create temporary table finance_document_guard (
  record_rows bigint,
  record_hash text,
  line_rows bigint,
  movement_rows bigint,
  assignment_rows bigint,
  post_hash text,
  void_hash text,
  correct_hash text,
  payroll_hash text
);

insert into finance_document_guard
select
  (select count(*) from public.finance_records),
  (select md5(string_agg(r.id::text || ':' || r.amount::text, ',' order by r.id)) from public.finance_records r),
  (select count(*) from public.finance_budget_lines),
  (select count(*) from public.finance_movements),
  (select count(*) from public.employee_budget_assignments),
  (select md5(pg_get_functiondef('public.post_finance_movement(uuid,date,numeric,text,uuid)'::regprocedure))),
  (select md5(pg_get_functiondef('public.void_finance_movement(uuid,text)'::regprocedure))),
  (select md5(pg_get_functiondef('public.correct_finance_movement(uuid,text,uuid,date,numeric,text,uuid)'::regprocedure))),
  (select md5(pg_get_functiondef('public.payroll_actual(date,date)'::regprocedure)));

insert into public.museums (id, name, slug, fiscal_year_start_month)
values
  ('fd100000-0000-4000-8000-0000000000a1', 'TEST DOCUMENT A', 'test-finance-document-a', 9),
  ('fd100000-0000-4000-8000-0000000000b1', 'TEST DOCUMENT B', 'test-finance-document-b', 9);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('fd100000-0000-4000-8000-0000000000a2', 'document-reader-a@example.invalid', '{}'),
  ('fd100000-0000-4000-8000-0000000000a3', 'document-plain-a@example.invalid', '{}'),
  ('fd100000-0000-4000-8000-0000000000a4', 'document-limited-a@example.invalid', '{}'),
  ('fd100000-0000-4000-8000-0000000000a5', 'document-none-a@example.invalid', '{}'),
  ('fd100000-0000-4000-8000-0000000000b2', 'document-reader-b@example.invalid', '{}');

update public.profiles
set museum_id = 'fd100000-0000-4000-8000-0000000000a1'
where id in (
  'fd100000-0000-4000-8000-0000000000a2',
  'fd100000-0000-4000-8000-0000000000a3',
  'fd100000-0000-4000-8000-0000000000a4',
  'fd100000-0000-4000-8000-0000000000a5'
);
update public.profiles
set museum_id = 'fd100000-0000-4000-8000-0000000000b1'
where id = 'fd100000-0000-4000-8000-0000000000b2';

insert into public.user_permissions (museum_id, user_id, permission_id, effect)
select pr.museum_id, pr.id, p.id, 'allow'
from public.profiles pr
cross join public.permissions p
where (
    pr.id in (
      'fd100000-0000-4000-8000-0000000000a2',
      'fd100000-0000-4000-8000-0000000000a4'
    )
    and p.code in ('finance.read', 'finance.write')
  ) or (
    pr.id in (
      'fd100000-0000-4000-8000-0000000000a3',
      'fd100000-0000-4000-8000-0000000000b2'
    )
    and p.code = 'finance.read'
  );

insert into public.finance_budget_lines (
  id, museum_id, record_type, category, name, sort_order, counts_in_operating_balance
) values
  ('fd100000-0000-4000-8000-0000000000a6', 'fd100000-0000-4000-8000-0000000000a1', 'expense', 'Servicios Contratados', 'Prueba', 1, true),
  ('fd100000-0000-4000-8000-0000000000a7', 'fd100000-0000-4000-8000-0000000000a1', 'expense', 'Nómina', 'Plaza prueba', 2, true),
  ('fd100000-0000-4000-8000-0000000000a8', 'fd100000-0000-4000-8000-0000000000a1', 'income', 'Otros Ingresos', 'Ingreso prueba', 3, true),
  ('fd100000-0000-4000-8000-0000000000b6', 'fd100000-0000-4000-8000-0000000000b1', 'expense', 'Servicios Contratados', 'Prueba ajena', 1, true);

alter table public.employees disable trigger protect_employee_module_profile;
insert into public.employees (
  id, museum_id, profile_id, first_name, last_name, position, department, email, status, access_profile
) values (
  'fd100000-0000-4000-8000-0000000000a9',
  'fd100000-0000-4000-8000-0000000000a1',
  'fd100000-0000-4000-8000-0000000000a4',
  'Modulo', 'Ajeno', 'Mantenimiento', 'Operaciones',
  'document-limited-a@example.invalid', 'activo', 'mantenimiento'
);
alter table public.employees enable trigger protect_employee_module_profile;

create function pg_temp.must_fail(statement text) returns void
language plpgsql
as $$
begin
  execute statement;
  raise exception 'EXPECTED_FAILURE';
exception
  when others then
    if sqlerrm = 'EXPECTED_FAILURE' then
      raise;
    end if;
end
$$;

insert into public.finance_documents (
  id, museum_id, status, original_path, original_mime, original_byte_size, original_sha256,
  original_filename, uploaded_by
) values (
  'fd100000-0000-4000-8000-0000000000d1',
  'fd100000-0000-4000-8000-0000000000a1',
  'pending_review',
  'fd100000-0000-4000-8000-0000000000a1/fd100000-0000-4000-8000-0000000000d1/original',
  'application/pdf',
  1200,
  repeat('a', 64),
  'factura.pdf',
  'fd100000-0000-4000-8000-0000000000a2'
);

insert into public.finance_documents (
  id, museum_id, status, original_path, original_mime, original_byte_size, original_sha256,
  original_filename, uploaded_by
) values (
  'fd100000-0000-4000-8000-0000000000d5',
  'fd100000-0000-4000-8000-0000000000a1',
  'pending_review',
  'fd100000-0000-4000-8000-0000000000a1/fd100000-0000-4000-8000-0000000000d5/original',
  'image/jpeg',
  15728640,
  repeat('b', 64),
  'foto.jpg',
  'fd100000-0000-4000-8000-0000000000a2'
);

insert into public.finance_documents (
  id, museum_id, status, original_path, original_mime, original_byte_size, original_sha256,
  original_filename, vendor_name, invoice_number, invoice_date, total, description,
  budget_line_id, uploaded_by
) values (
  'fd100000-0000-4000-8000-0000000000d6',
  'fd100000-0000-4000-8000-0000000000a1',
  'pending_review',
  'fd100000-0000-4000-8000-0000000000a1/fd100000-0000-4000-8000-0000000000d6/original',
  'image/png',
  4000,
  repeat('c', 64),
  'factura.png',
  'Proveedor',
  'A-100',
  date '2026-09-15',
  12.50,
  'Servicio contratado',
  'fd100000-0000-4000-8000-0000000000a6',
  'fd100000-0000-4000-8000-0000000000a2'
);

select pg_temp.must_fail($$
  insert into public.finance_documents (
    id, museum_id, status, original_path, original_mime, original_byte_size, original_sha256,
    original_filename, uploaded_by
  ) values (
    'fd100000-0000-4000-8000-0000000000d2',
    'fd100000-0000-4000-8000-0000000000a1',
    'processing',
    'fd100000-0000-4000-8000-0000000000a1/fd100000-0000-4000-8000-0000000000d2/original',
    'application/pdf', 10, repeat('d', 64), 'x.pdf',
    'fd100000-0000-4000-8000-0000000000a2'
  )
$$);

select pg_temp.must_fail($$
  insert into public.finance_documents (
    id, museum_id, status, original_path, original_mime, original_byte_size, original_sha256,
    original_filename, total, uploaded_by
  ) values (
    'fd100000-0000-4000-8000-0000000000d2',
    'fd100000-0000-4000-8000-0000000000a1',
    'pending_review',
    'fd100000-0000-4000-8000-0000000000a1/fd100000-0000-4000-8000-0000000000d2/original',
    'application/pdf', 10, repeat('d', 64), 'x.pdf', 0,
    'fd100000-0000-4000-8000-0000000000a2'
  )
$$);

select pg_temp.must_fail($$
  insert into public.finance_documents (
    id, museum_id, status, original_path, original_mime, original_byte_size, original_sha256,
    original_filename, total, uploaded_by
  ) values (
    'fd100000-0000-4000-8000-0000000000d2',
    'fd100000-0000-4000-8000-0000000000a1',
    'pending_review',
    'fd100000-0000-4000-8000-0000000000a1/fd100000-0000-4000-8000-0000000000d2/original',
    'application/pdf', 10, repeat('d', 64), 'x.pdf', -5,
    'fd100000-0000-4000-8000-0000000000a2'
  )
$$);

select pg_temp.must_fail($$
  insert into public.finance_documents (
    id, museum_id, status, original_path, original_mime, original_byte_size, original_sha256,
    original_filename, total, uploaded_by
  ) values (
    'fd100000-0000-4000-8000-0000000000d2',
    'fd100000-0000-4000-8000-0000000000a1',
    'pending_review',
    'fd100000-0000-4000-8000-0000000000a1/fd100000-0000-4000-8000-0000000000d2/original',
    'application/pdf', 10, repeat('d', 64), 'x.pdf', 1.239,
    'fd100000-0000-4000-8000-0000000000a2'
  )
$$);

select pg_temp.must_fail($$
  insert into public.finance_documents (
    id, museum_id, status, original_path, original_mime, original_byte_size, original_sha256,
    original_filename, uploaded_by
  ) values (
    'fd100000-0000-4000-8000-0000000000d2',
    'fd100000-0000-4000-8000-0000000000a1',
    'pending_review',
    'fd100000-0000-4000-8000-0000000000a1/fd100000-0000-4000-8000-0000000000d2/original',
    'image/webp', 10, repeat('d', 64), 'x.webp',
    'fd100000-0000-4000-8000-0000000000a2'
  )
$$);

select pg_temp.must_fail($$
  insert into public.finance_documents (
    id, museum_id, status, original_path, original_mime, original_byte_size, original_sha256,
    original_filename, uploaded_by
  ) values (
    'fd100000-0000-4000-8000-0000000000d2',
    'fd100000-0000-4000-8000-0000000000a1',
    'pending_review',
    'fd100000-0000-4000-8000-0000000000a1/fd100000-0000-4000-8000-0000000000d2/original',
    'application/pdf', 0, repeat('d', 64), 'x.pdf',
    'fd100000-0000-4000-8000-0000000000a2'
  )
$$);

select pg_temp.must_fail($$
  insert into public.finance_documents (
    id, museum_id, status, original_path, original_mime, original_byte_size, original_sha256,
    original_filename, uploaded_by
  ) values (
    'fd100000-0000-4000-8000-0000000000d2',
    'fd100000-0000-4000-8000-0000000000a1',
    'pending_review',
    'fd100000-0000-4000-8000-0000000000a1/fd100000-0000-4000-8000-0000000000d2/original',
    'application/pdf', 15728641, repeat('d', 64), 'x.pdf',
    'fd100000-0000-4000-8000-0000000000a2'
  )
$$);

select pg_temp.must_fail($$
  insert into public.finance_documents (
    id, museum_id, status, original_path, original_mime, original_byte_size, original_sha256,
    original_filename, uploaded_by
  ) values (
    'fd100000-0000-4000-8000-0000000000d2',
    'fd100000-0000-4000-8000-0000000000a1',
    'pending_review',
    'fd100000-0000-4000-8000-0000000000a1/fd100000-0000-4000-8000-0000000000d2/original',
    'application/pdf', 10, repeat('a', 64), 'otra.pdf',
    'fd100000-0000-4000-8000-0000000000a2'
  )
$$);

insert into public.finance_documents (
  id, museum_id, status, original_path, original_mime, original_byte_size, original_sha256,
  original_filename, uploaded_by
) values (
  'fd100000-0000-4000-8000-0000000000d3',
  'fd100000-0000-4000-8000-0000000000b1',
  'pending_review',
  'fd100000-0000-4000-8000-0000000000b1/fd100000-0000-4000-8000-0000000000d3/original',
  'application/pdf',
  10,
  repeat('a', 64),
  'misma.pdf',
  'fd100000-0000-4000-8000-0000000000b2'
);

select pg_temp.must_fail($$
  update public.finance_documents
  set original_sha256 = repeat('e', 64)
  where id = 'fd100000-0000-4000-8000-0000000000d5'
$$);

select pg_temp.must_fail($$
  update public.finance_documents
  set original_path = 'fd100000-0000-4000-8000-0000000000a1/fd100000-0000-4000-8000-0000000000d5/replaced'
  where id = 'fd100000-0000-4000-8000-0000000000d5'
$$);

update public.finance_documents
set vendor_name = 'Proveedor editado'
where id = 'fd100000-0000-4000-8000-0000000000d5';

select pg_temp.must_fail($$
  update public.finance_documents
  set budget_line_id = 'fd100000-0000-4000-8000-0000000000a7'
  where id = 'fd100000-0000-4000-8000-0000000000d5'
$$);

select pg_temp.must_fail($$
  update public.finance_documents
  set budget_line_id = 'fd100000-0000-4000-8000-0000000000a8'
  where id = 'fd100000-0000-4000-8000-0000000000d5'
$$);

select pg_temp.must_fail($$
  update public.finance_documents
  set budget_line_id = 'fd100000-0000-4000-8000-0000000000b6'
  where id = 'fd100000-0000-4000-8000-0000000000d5'
$$);

select pg_temp.must_fail($$
  update public.finance_documents
  set status = 'confirmed',
      confirmed_by = 'fd100000-0000-4000-8000-0000000000a2',
      confirmed_at = now()
  where id = 'fd100000-0000-4000-8000-0000000000d6'
$$);

select pg_temp.must_fail($$
  update public.finance_documents
  set status = 'rejected', rejected_by = 'fd100000-0000-4000-8000-0000000000a2', rejected_at = now()
  where id = 'fd100000-0000-4000-8000-0000000000d5'
$$);

select pg_temp.must_fail($$
  update public.finance_documents
  set status = 'confirmed',
      confirmed_by = 'fd100000-0000-4000-8000-0000000000a2',
      confirmed_at = now(),
      movement_id = 'fd100000-0000-4000-8000-0000000000c1',
      rejected_by = 'fd100000-0000-4000-8000-0000000000a2',
      rejected_at = now(),
      rejection_reason = 'No puede ser ambos'
  where id = 'fd100000-0000-4000-8000-0000000000d6'
$$);

insert into public.finance_movements (
  id, museum_id, budget_line_id, occurred_on, amount, description, created_by, idempotency_key
) values (
  'fd100000-0000-4000-8000-0000000000c1',
  'fd100000-0000-4000-8000-0000000000a1',
  'fd100000-0000-4000-8000-0000000000a6',
  date '2026-09-15',
  12.50,
  'Servicio contratado',
  'fd100000-0000-4000-8000-0000000000a2',
  'fd100000-0000-4000-8000-0000000000c1'
);

update public.finance_documents
set status = 'confirmed',
    confirmed_by = 'fd100000-0000-4000-8000-0000000000a2',
    confirmed_at = now(),
    movement_id = 'fd100000-0000-4000-8000-0000000000c1'
where id = 'fd100000-0000-4000-8000-0000000000d6';

select pg_temp.must_fail($$
  update public.finance_documents
  set vendor_name = 'Cambiado'
  where id = 'fd100000-0000-4000-8000-0000000000d6'
$$);

select pg_temp.must_fail($$
  update public.finance_documents
  set status = 'pending_review', confirmed_by = null, confirmed_at = null, movement_id = null
  where id = 'fd100000-0000-4000-8000-0000000000d6'
$$);

update public.finance_documents
set status = 'rejected',
    rejected_by = 'fd100000-0000-4000-8000-0000000000a2',
    rejected_at = now(),
    rejection_reason = 'Documento de prueba rechazado'
where id = 'fd100000-0000-4000-8000-0000000000d1';

select pg_temp.must_fail($$
  update public.finance_documents
  set vendor_name = 'Cambiado'
  where id = 'fd100000-0000-4000-8000-0000000000d1'
$$);

insert into public.finance_documents (
  id, museum_id, status, original_path, original_mime, original_byte_size, original_sha256,
  original_filename, uploaded_by
) values (
  'fd100000-0000-4000-8000-0000000000d4',
  'fd100000-0000-4000-8000-0000000000a1',
  'pending_review',
  'fd100000-0000-4000-8000-0000000000a1/fd100000-0000-4000-8000-0000000000d4/original',
  'application/pdf',
  10,
  repeat('a', 64),
  'reintento.pdf',
  'fd100000-0000-4000-8000-0000000000a2'
);

select pg_temp.must_fail($$
  delete from public.finance_documents
  where id = 'fd100000-0000-4000-8000-0000000000d5'
$$);

insert into storage.objects (bucket_id, name, owner_id, metadata)
values (
  'finance-documents',
  'fd100000-0000-4000-8000-0000000000a1/fd100000-0000-4000-8000-0000000000d5/original',
  'fd100000-0000-4000-8000-0000000000a2',
  '{"mimetype":"image/jpeg","size":15728640}'::jsonb
);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'fd100000-0000-4000-8000-0000000000a2', true);
select set_config('request.jwt.claims', '{"sub":"fd100000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  seen integer;
begin
  select count(*) into seen
  from public.finance_documents
  where museum_id = 'fd100000-0000-4000-8000-0000000000a1';
  if seen <> 4 then
    raise exception 'SAME_MUSEUM_READ %', seen;
  end if;
  select count(*) into seen
  from storage.objects
  where bucket_id = 'finance-documents'
    and name = 'fd100000-0000-4000-8000-0000000000a1/fd100000-0000-4000-8000-0000000000d5/original';
  if seen <> 1 then
    raise exception 'STORAGE_READ %', seen;
  end if;
  begin
    insert into public.finance_documents (
      id, museum_id, status, original_path, original_mime, original_byte_size, original_sha256,
      original_filename, uploaded_by
    ) values (
      'fd100000-0000-4000-8000-0000000000da',
      'fd100000-0000-4000-8000-0000000000a1',
      'pending_review',
      'fd100000-0000-4000-8000-0000000000a1/fd100000-0000-4000-8000-0000000000da/original',
      'application/pdf', 10, repeat('f', 64), 'cliente.pdf',
      'fd100000-0000-4000-8000-0000000000a2'
    );
    raise exception 'CLIENT_INSERT';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.finance_documents set vendor_name = 'Cliente' where id = 'fd100000-0000-4000-8000-0000000000d5';
    raise exception 'CLIENT_UPDATE';
  exception when insufficient_privilege then
    null;
  end;
  begin
    delete from public.finance_documents where id = 'fd100000-0000-4000-8000-0000000000d5';
    raise exception 'CLIENT_DELETE';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values (
      'finance-documents',
      'fd100000-0000-4000-8000-0000000000a1/fd100000-0000-4000-8000-0000000000d5/derived',
      'fd100000-0000-4000-8000-0000000000a2',
      '{"mimetype":"image/jpeg","size":10}'::jsonb
    );
    raise exception 'CLIENT_STORAGE_INSERT';
  exception when insufficient_privilege then
    null;
  end;
  update storage.objects
  set metadata = '{"size":1}'::jsonb
  where bucket_id = 'finance-documents'
    and name = 'fd100000-0000-4000-8000-0000000000a1/fd100000-0000-4000-8000-0000000000d5/original';
  if found then
    raise exception 'CLIENT_STORAGE_UPDATE';
  end if;
  begin
    delete from storage.objects
    where bucket_id = 'finance-documents'
      and name = 'fd100000-0000-4000-8000-0000000000a1/fd100000-0000-4000-8000-0000000000d5/original';
    if found then
      raise exception 'CLIENT_STORAGE_DELETE';
    end if;
  exception
    when others then
      if sqlerrm = 'CLIENT_STORAGE_DELETE' or sqlerrm not like '%Direct deletion from storage tables is not allowed%' then
        raise;
      end if;
  end;
  select count(*) into seen
  from storage.objects
  where bucket_id = 'finance-documents'
    and name = 'fd100000-0000-4000-8000-0000000000a1/fd100000-0000-4000-8000-0000000000d5/original'
    and metadata->>'size' = '15728640';
  if seen <> 1 then
    raise exception 'STORAGE_MUTATED %', seen;
  end if;
end
$$;

select set_config('request.jwt.claim.sub', 'fd100000-0000-4000-8000-0000000000b2', true);
select set_config('request.jwt.claims', '{"sub":"fd100000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);

do $$
declare
  seen integer;
begin
  select count(*) into seen from public.finance_documents;
  if seen <> 1 then
    raise exception 'CROSS_MUSEUM_READ %', seen;
  end if;
  if (select museum_id from public.finance_documents) <> 'fd100000-0000-4000-8000-0000000000b1' then
    raise exception 'CROSS_MUSEUM_ROW';
  end if;
end
$$;

select set_config('request.jwt.claim.sub', 'fd100000-0000-4000-8000-0000000000a5', true);
select set_config('request.jwt.claims', '{"sub":"fd100000-0000-4000-8000-0000000000a5","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.finance_documents) <> 0 then
    raise exception 'MISSING_PERMISSION_READ';
  end if;
end
$$;

select set_config('request.jwt.claim.sub', 'fd100000-0000-4000-8000-0000000000a4', true);
select set_config('request.jwt.claims', '{"sub":"fd100000-0000-4000-8000-0000000000a4","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.finance_documents) <> 0 then
    raise exception 'MODULE_BOUNDARY_READ';
  end if;
  if public.module_profile_allows('administration') then
    raise exception 'MODULE_PROFILE_UNEXPECTED';
  end if;
end
$$;

reset role;

set local role anon;

do $$
begin
  perform 1 from public.finance_documents;
  raise exception 'ANON_READ';
exception when insufficient_privilege then
  null;
end
$$;

reset role;

do $$
declare
  guard finance_document_guard;
begin
  select * into guard from finance_document_guard;
  if to_regclass('public.finance_documents') is null then
    raise exception 'TABLE_MISSING';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.finance_documents'::regclass) then
    raise exception 'RLS_OFF';
  end if;
  if has_table_privilege('authenticated', 'public.finance_documents', 'insert')
     or has_table_privilege('authenticated', 'public.finance_documents', 'update')
     or has_table_privilege('authenticated', 'public.finance_documents', 'delete')
     or not has_table_privilege('authenticated', 'public.finance_documents', 'select')
     or has_table_privilege('anon', 'public.finance_documents', 'select')
     or has_table_privilege('anon', 'public.finance_documents', 'insert') then
    raise exception 'DOCUMENT_GRANTS';
  end if;
  if guard.record_rows is distinct from (
       select count(*) from public.finance_records
       where museum_id not in (
         'fd100000-0000-4000-8000-0000000000a1',
         'fd100000-0000-4000-8000-0000000000b1'
       )
     ) or guard.record_hash is distinct from (
       select md5(string_agg(r.id::text || ':' || r.amount::text, ',' order by r.id))
       from public.finance_records r
       where r.museum_id not in (
         'fd100000-0000-4000-8000-0000000000a1',
         'fd100000-0000-4000-8000-0000000000b1'
       )
     ) then
    raise exception 'FINANCE_RECORDS_TOUCHED';
  end if;
  if guard.line_rows is distinct from (
    select count(*) from public.finance_budget_lines
    where museum_id not in (
      'fd100000-0000-4000-8000-0000000000a1',
      'fd100000-0000-4000-8000-0000000000b1'
    )
  ) then
    raise exception 'BUDGET_LINES_TOUCHED';
  end if;
  if guard.assignment_rows is distinct from (select count(*) from public.employee_budget_assignments) then
    raise exception 'ASSIGNMENTS_TOUCHED';
  end if;
  if guard.payroll_hash is distinct from (select md5(pg_get_functiondef('public.payroll_actual(date,date)'::regprocedure))) then
    raise exception 'PAYROLL_TOUCHED';
  end if;
  if guard.post_hash is distinct from (select md5(pg_get_functiondef('public.post_finance_movement(uuid,date,numeric,text,uuid)'::regprocedure)))
     or guard.void_hash is distinct from (select md5(pg_get_functiondef('public.void_finance_movement(uuid,text)'::regprocedure)))
     or guard.correct_hash is distinct from (select md5(pg_get_functiondef('public.correct_finance_movement(uuid,text,uuid,date,numeric,text,uuid)'::regprocedure))) then
    raise exception 'MOVEMENT_CONTRACT_TOUCHED';
  end if;
  if (
    select count(*) from public.finance_movements existing
    where not exists (
      select 1 from public.museums m
      where m.id = existing.museum_id and m.slug like 'test-finance-document-%'
    )
  ) is distinct from guard.movement_rows then
    raise exception 'REAL_MOVEMENTS_TOUCHED';
  end if;
  if (
    select confirmed_by is not null and confirmed_at is not null and movement_id is not null and status = 'confirmed'
    from public.finance_documents
    where id = 'fd100000-0000-4000-8000-0000000000d6'
  ) is not true then
    raise exception 'CONFIRM_TRIPLE';
  end if;
  if (
    select rejected_by is not null and rejected_at is not null and rejection_reason is not null and status = 'rejected'
    from public.finance_documents
    where id = 'fd100000-0000-4000-8000-0000000000d1'
  ) is not true then
    raise exception 'REJECT_TRIPLE';
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
  if (
    select count(*) from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage' and c.relname = 'objects'
      and pol.polname::text in (
        'finance_documents_storage_read',
        'finance_documents_storage_read_guard',
        'finance_documents_storage_no_insert',
        'finance_documents_storage_no_update',
        'finance_documents_storage_no_delete'
      )
  ) <> 5 then
    raise exception 'STORAGE_POLICIES';
  end if;
end
$$;

select 'FINANCE_DOCUMENTS_PASS' as result;

rollback;
