-- Rolls back every fixture. Does not keep museums, documents, audits, or storage rows.
begin;

create temporary table finance_document_reject_baseline (
  record_rows bigint,
  record_hash text,
  record_sum numeric,
  line_rows bigint,
  nomina_rows bigint,
  movement_rows bigint,
  assignment_rows bigint,
  document_rows bigint,
  object_rows bigint,
  e2e jsonb,
  post_hash text,
  void_hash text,
  correct_hash text,
  payroll_hash text,
  guard_hash text,
  review_hash text
);

insert into finance_document_reject_baseline
select
  (select count(*) from public.finance_records),
  (select md5(string_agg(r.id::text || ':' || r.amount::text, ',' order by r.id)) from public.finance_records r),
  (select coalesce(sum(amount), 0) from public.finance_records),
  (select count(*) from public.finance_budget_lines),
  (select count(*) from public.finance_budget_lines where category = 'Nómina'),
  (select count(*) from public.finance_movements),
  (select count(*) from public.employee_budget_assignments),
  (select count(*) from public.finance_documents),
  (select count(*) from storage.objects where bucket_id = 'finance-documents'),
  (select to_jsonb(document) from public.finance_documents document where id = 'e9707e13-6b81-46bd-9054-796378366d49'),
  (select md5(pg_get_functiondef('public.post_finance_movement(uuid,date,numeric,text,uuid)'::regprocedure))),
  (select md5(pg_get_functiondef('public.void_finance_movement(uuid,text)'::regprocedure))),
  (select md5(pg_get_functiondef('public.correct_finance_movement(uuid,text,uuid,date,numeric,text,uuid)'::regprocedure))),
  (select md5(pg_get_functiondef('public.payroll_actual(date,date)'::regprocedure))),
  (select md5(pg_get_functiondef('public.finance_documents_guard()'::regprocedure))),
  (select md5(pg_get_functiondef('public.update_finance_document_review(uuid,text,text,date,numeric,text,uuid,text,text,date,numeric,text,uuid)'::regprocedure)));

insert into public.museums (id, name, slug)
values
  ('fd300008-0000-4000-8000-0000000000a1', 'TEST REJECT A', 'test-finance-reject-a'),
  ('fd300008-0000-4000-8000-0000000000b1', 'TEST REJECT B', 'test-finance-reject-b');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('fd300008-0000-4000-8000-0000000000a2', 'reject-writer-a@example.invalid', '{}'),
  ('fd300008-0000-4000-8000-0000000000a3', 'reject-none-a@example.invalid', '{}'),
  ('fd300008-0000-4000-8000-0000000000a4', 'reject-limited-a@example.invalid', '{}'),
  ('fd300008-0000-4000-8000-0000000000a5', 'reject-reader-a@example.invalid', '{}'),
  ('fd300008-0000-4000-8000-0000000000a7', 'reject-writeonly-a@example.invalid', '{}'),
  ('fd300008-0000-4000-8000-0000000000a8', 'reject-inactive-a@example.invalid', '{}'),
  ('fd300008-0000-4000-8000-0000000000b2', 'reject-writer-b@example.invalid', '{}');

update public.profiles
set museum_id = 'fd300008-0000-4000-8000-0000000000a1', role = 'empleado', status = 'active'
where id in (
  'fd300008-0000-4000-8000-0000000000a2',
  'fd300008-0000-4000-8000-0000000000a3',
  'fd300008-0000-4000-8000-0000000000a4',
  'fd300008-0000-4000-8000-0000000000a5',
  'fd300008-0000-4000-8000-0000000000a7'
);
update public.profiles
set museum_id = 'fd300008-0000-4000-8000-0000000000a1', role = 'empleado', status = 'inactive'
where id = 'fd300008-0000-4000-8000-0000000000a8';
update public.profiles
set museum_id = 'fd300008-0000-4000-8000-0000000000b1', role = 'empleado', status = 'active'
where id = 'fd300008-0000-4000-8000-0000000000b2';

insert into public.user_permissions (museum_id, user_id, permission_id, effect)
select profile.museum_id, profile.id, permission.id, 'allow'
from public.profiles profile
cross join public.permissions permission
where (
  profile.id in (
    'fd300008-0000-4000-8000-0000000000a2',
    'fd300008-0000-4000-8000-0000000000a4',
    'fd300008-0000-4000-8000-0000000000a8',
    'fd300008-0000-4000-8000-0000000000b2'
  )
  and permission.code in ('finance.read', 'finance.write')
) or (
  profile.id = 'fd300008-0000-4000-8000-0000000000a5'
  and permission.code = 'finance.read'
) or (
  profile.id = 'fd300008-0000-4000-8000-0000000000a7'
  and permission.code = 'finance.write'
);

insert into public.finance_budget_lines (
  id, museum_id, record_type, category, name, sort_order, counts_in_operating_balance
) values (
  'fd300008-0000-4000-8000-0000000000c1',
  'fd300008-0000-4000-8000-0000000000a1',
  'expense',
  'Gastos Operacionales',
  'Luz',
  1,
  true
);

alter table public.employees disable trigger protect_employee_module_profile;
insert into public.employees (
  id, museum_id, profile_id, first_name, last_name, position, department, email, status, access_profile
) values (
  'fd300008-0000-4000-8000-0000000000f1',
  'fd300008-0000-4000-8000-0000000000a1',
  'fd300008-0000-4000-8000-0000000000a4',
  'Modulo', 'Ajeno', 'Mantenimiento', 'Operaciones',
  'reject-limited-a@example.invalid', 'activo', 'mantenimiento'
);
alter table public.employees enable trigger protect_employee_module_profile;

insert into public.finance_documents (
  id, museum_id, status, original_path, original_mime, original_byte_size, original_sha256,
  original_filename, vendor_name, invoice_number, invoice_date, total, description,
  budget_line_id, suggestion, uploaded_by
) values (
  'fd300008-0000-4000-8000-0000000000d1',
  'fd300008-0000-4000-8000-0000000000a1',
  'pending_review',
  'fd300008-0000-4000-8000-0000000000a1/fd300008-0000-4000-8000-0000000000d1/original',
  'application/pdf',
  128,
  repeat('d', 64),
  'pendiente.pdf',
  'Proveedor E2E',
  'FAC-9',
  date '2026-09-20',
  48.25,
  'Servicio de sonido',
  'fd300008-0000-4000-8000-0000000000c1',
  '{"keep":true}'::jsonb,
  'fd300008-0000-4000-8000-0000000000a2'
);

insert into storage.objects (bucket_id, name, owner_id, metadata)
values (
  'finance-documents',
  'fd300008-0000-4000-8000-0000000000a1/fd300008-0000-4000-8000-0000000000d1/original',
  'fd300008-0000-4000-8000-0000000000a2',
  '{"mimetype":"application/pdf","size":128}'::jsonb
);

insert into public.finance_documents (
  id, museum_id, status, original_path, original_mime, original_byte_size, original_sha256,
  original_filename, uploaded_by
) values (
  'fd300008-0000-4000-8000-0000000000d2',
  'fd300008-0000-4000-8000-0000000000b1',
  'pending_review',
  'fd300008-0000-4000-8000-0000000000b1/fd300008-0000-4000-8000-0000000000d2/original',
  'image/jpeg',
  20,
  repeat('e', 64),
  'ajena.jpg',
  'fd300008-0000-4000-8000-0000000000b2'
);

insert into public.finance_documents (
  id, museum_id, status, original_path, original_mime, original_byte_size, original_sha256,
  original_filename, vendor_name, invoice_date, total, description, budget_line_id, uploaded_by
) values (
  'fd300008-0000-4000-8000-0000000000d3',
  'fd300008-0000-4000-8000-0000000000a1',
  'pending_review',
  'fd300008-0000-4000-8000-0000000000a1/fd300008-0000-4000-8000-0000000000d3/original',
  'application/pdf',
  10,
  repeat('f', 64),
  'confirmada.pdf',
  'Cerrada',
  date '2026-09-01',
  20.00,
  'Ya confirmada',
  'fd300008-0000-4000-8000-0000000000c1',
  'fd300008-0000-4000-8000-0000000000a2'
);

insert into public.finance_documents (
  id, museum_id, status, original_path, original_mime, original_byte_size, original_sha256,
  original_filename, uploaded_by
) values (
  'fd300008-0000-4000-8000-0000000000d4',
  'fd300008-0000-4000-8000-0000000000a1',
  'pending_review',
  'fd300008-0000-4000-8000-0000000000a1/fd300008-0000-4000-8000-0000000000d4/original',
  'image/png',
  10,
  repeat('a', 64),
  'rechazada.png',
  'fd300008-0000-4000-8000-0000000000a2'
);

insert into public.finance_movements (
  id, museum_id, budget_line_id, occurred_on, amount, description, created_by, idempotency_key
) values (
  'fd300008-0000-4000-8000-0000000000e1',
  'fd300008-0000-4000-8000-0000000000a1',
  'fd300008-0000-4000-8000-0000000000c1',
  date '2026-09-01',
  20.00,
  'Ya confirmada',
  'fd300008-0000-4000-8000-0000000000a2',
  'fd300008-0000-4000-8000-0000000000e1'
);

update public.finance_documents
set status = 'confirmed',
    confirmed_by = 'fd300008-0000-4000-8000-0000000000a2',
    confirmed_at = now(),
    movement_id = 'fd300008-0000-4000-8000-0000000000e1'
where id = 'fd300008-0000-4000-8000-0000000000d3';

update public.finance_documents
set status = 'rejected',
    rejected_by = 'fd300008-0000-4000-8000-0000000000a2',
    rejected_at = now(),
    rejection_reason = 'Documento de prueba'
where id = 'fd300008-0000-4000-8000-0000000000d4';

create temporary table finance_document_reject_anchor (
  uploaded_at timestamptz,
  uploaded_by uuid,
  original_path text,
  original_mime text,
  original_byte_size integer,
  original_sha text,
  original_filename text,
  vendor_name text,
  invoice_number text,
  invoice_date date,
  total numeric,
  description text,
  budget_line_id uuid,
  suggestion jsonb,
  storage_row jsonb,
  movement_rows bigint,
  closed_rejected_at timestamptz,
  closed_reason text
);

insert into finance_document_reject_anchor
select
  document.uploaded_at,
  document.uploaded_by,
  document.original_path,
  document.original_mime,
  document.original_byte_size,
  document.original_sha256,
  document.original_filename,
  document.vendor_name,
  document.invoice_number,
  document.invoice_date,
  document.total,
  document.description,
  document.budget_line_id,
  document.suggestion,
  (select to_jsonb(object) from storage.objects object
    where object.bucket_id = 'finance-documents'
      and object.name = document.original_path),
  (select count(*) from public.finance_movements),
  (select rejected_at from public.finance_documents where id = 'fd300008-0000-4000-8000-0000000000d4'),
  (select rejection_reason from public.finance_documents where id = 'fd300008-0000-4000-8000-0000000000d4')
from public.finance_documents document
where document.id = 'fd300008-0000-4000-8000-0000000000d1';

create function pg_temp.reject(p_actor uuid, p_document uuid, p_reason text) returns jsonb
language plpgsql
as $$
declare
  result jsonb;
begin
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', p_actor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_actor, 'role', 'authenticated')::text, true);
  select public.reject_finance_document(p_document, p_reason) into result;
  return result;
end
$$;

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
  saved jsonb;
  actor_column text;
  actor uuid;
  anchor finance_document_reject_anchor;
  kept_at timestamptz;
  def text;
begin
  if to_regprocedure('public.reject_finance_document(uuid,text)') is null then
    raise exception 'REJECT_FUNCTION_MISSING';
  end if;
  def := pg_get_functiondef('public.reject_finance_document(uuid,text)'::regprocedure);
  if strpos(def, 'for update') = 0
     or strpos(def, 'for update') > strpos(def, 'DOCUMENT_NOT_PENDING') then
    raise exception 'LOCK_ORDER';
  end if;
  if not exists (
    select 1
    from pg_proc proc
    join pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname = 'reject_finance_document'
      and proc.prosecdef
      and exists (
        select 1
        from unnest(coalesce(proc.proconfig, array[]::text[])) as item
        where item like 'search_path=%'
      )
  ) then
    raise exception 'SECURITY_DEFINER';
  end if;

  perform pg_temp.must_raise(
    $sql$select pg_temp.reject('fd300008-0000-4000-8000-0000000000a2', 'fd300008-0000-4000-8000-0000000000d1', null)$sql$,
    'INVALID_REJECTION_REASON'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.reject('fd300008-0000-4000-8000-0000000000a2', 'fd300008-0000-4000-8000-0000000000d1', '   ')$sql$,
    'INVALID_REJECTION_REASON'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.reject('fd300008-0000-4000-8000-0000000000a2', 'fd300008-0000-4000-8000-0000000000d1', '')$sql$,
    'INVALID_REJECTION_REASON'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.reject('fd300008-0000-4000-8000-0000000000a2', 'fd300008-0000-4000-8000-0000000000d1', repeat('x', 501))$sql$,
    'INVALID_REJECTION_REASON'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.reject('fd300008-0000-4000-8000-0000000000b2', 'fd300008-0000-4000-8000-0000000000d1', 'Otro museo')$sql$,
    'Finance document not found'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.reject('fd300008-0000-4000-8000-0000000000a2', 'fd300008-0000-4000-8000-0000000000d2', 'Otro museo')$sql$,
    'Finance document not found'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.reject('fd300008-0000-4000-8000-0000000000a3', 'fd300008-0000-4000-8000-0000000000d1', 'Sin permiso')$sql$,
    'Missing financial authorization'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.reject('fd300008-0000-4000-8000-0000000000a5', 'fd300008-0000-4000-8000-0000000000d1', 'Solo lectura')$sql$,
    'Missing financial authorization'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.reject('fd300008-0000-4000-8000-0000000000a7', 'fd300008-0000-4000-8000-0000000000d1', 'Solo escritura')$sql$,
    'Missing financial authorization'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.reject('fd300008-0000-4000-8000-0000000000a8', 'fd300008-0000-4000-8000-0000000000d1', 'Inactivo')$sql$,
    'PROFILE_REQUIRED'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.reject('fd300008-0000-4000-8000-0000000000a4', 'fd300008-0000-4000-8000-0000000000d1', 'Sin administracion')$sql$,
    'Missing financial authorization'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.reject('fd300008-0000-4000-8000-0000000000a2', 'fd300008-0000-4000-8000-0000000000d3', 'Ya confirmada')$sql$,
    'DOCUMENT_NOT_PENDING'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.reject('fd300008-0000-4000-8000-0000000000a2', 'fd300008-0000-4000-8000-0000000000d4', 'Otro motivo')$sql$,
    'DOCUMENT_NOT_PENDING'
  );

  if (select status from public.finance_documents where id = 'fd300008-0000-4000-8000-0000000000d1')
     is distinct from 'pending_review'
     or (select rejection_reason from public.finance_documents where id = 'fd300008-0000-4000-8000-0000000000d1') is not null
     or (select count(*) from public.audit_logs where record_id = 'fd300008-0000-4000-8000-0000000000d1' and action = 'finance_document_reject') <> 0
     or (select status from public.finance_documents where id = 'fd300008-0000-4000-8000-0000000000d2') is distinct from 'pending_review'
     or (select status from public.finance_documents where id = 'fd300008-0000-4000-8000-0000000000d3') is distinct from 'confirmed'
     or (select movement_id from public.finance_documents where id = 'fd300008-0000-4000-8000-0000000000d3')
        is distinct from 'fd300008-0000-4000-8000-0000000000e1'
     or (select rejected_by from public.finance_documents where id = 'fd300008-0000-4000-8000-0000000000d3') is not null then
    raise exception 'FAILED_CALLS_MUTATED';
  end if;
  select * into anchor from finance_document_reject_anchor;
  if (select rejected_at from public.finance_documents where id = 'fd300008-0000-4000-8000-0000000000d4')
     is distinct from anchor.closed_rejected_at
     or (select rejection_reason from public.finance_documents where id = 'fd300008-0000-4000-8000-0000000000d4')
        is distinct from anchor.closed_reason
     or (select rejected_by from public.finance_documents where id = 'fd300008-0000-4000-8000-0000000000d4')
        is distinct from 'fd300008-0000-4000-8000-0000000000a2' then
    raise exception 'CLOSED_REJECT_OVERWRITTEN';
  end if;

  saved := pg_temp.reject(
    'fd300008-0000-4000-8000-0000000000a2',
    'fd300008-0000-4000-8000-0000000000d1',
    '  Motivo de prueba  '
  );
  if saved->>'status' is distinct from 'rejected'
     or saved->>'rejection_reason' is distinct from 'Motivo de prueba'
     or saved->>'document_id' is distinct from 'fd300008-0000-4000-8000-0000000000d1'
     or saved->>'audit_id' is null then
    raise exception 'REJECT_RESULT %', saved;
  end if;

  select a.attname into actor_column
  from pg_attribute a
  where a.attrelid = 'public.audit_logs'::regclass
    and not a.attisdropped
    and a.attname in ('user_id', 'actor_user_id')
  order by case a.attname when 'user_id' then 0 else 1 end
  limit 1;
  execute format('select %I from public.audit_logs where id = $1', actor_column)
    into actor using (saved->>'audit_id')::uuid;
  if actor is distinct from 'fd300008-0000-4000-8000-0000000000a2'::uuid then
    raise exception 'AUDIT_ACTOR %', actor;
  end if;
  if (
    select count(*) = 1
       and bool_and(
         museum_id = 'fd300008-0000-4000-8000-0000000000a1'
         and table_name = 'finance_documents'
         and record_id = 'fd300008-0000-4000-8000-0000000000d1'
         and action = 'finance_document_reject'
         and old_value->>'status' = 'pending_review'
         and new_value->>'status' = 'rejected'
         and new_value->>'rejection_reason' = 'Motivo de prueba'
       )
    from public.audit_logs
    where record_id = 'fd300008-0000-4000-8000-0000000000d1'
      and action = 'finance_document_reject'
  ) is not true then
    raise exception 'AUDIT_VALUES';
  end if;

  if (
    select status = 'rejected'
       and rejected_by = 'fd300008-0000-4000-8000-0000000000a2'
       and rejected_at is not null
       and rejection_reason = 'Motivo de prueba'
       and vendor_name = 'Proveedor E2E'
       and invoice_number = 'FAC-9'
       and invoice_date = date '2026-09-20'
       and total = 48.25
       and description = 'Servicio de sonido'
       and budget_line_id = 'fd300008-0000-4000-8000-0000000000c1'
       and suggestion = '{"keep":true}'::jsonb
       and original_path = anchor.original_path
       and original_mime = anchor.original_mime
       and original_byte_size = anchor.original_byte_size
       and original_sha256 = anchor.original_sha
       and original_filename = anchor.original_filename
       and uploaded_by = anchor.uploaded_by
       and uploaded_at = anchor.uploaded_at
       and confirmed_by is null
       and confirmed_at is null
       and movement_id is null
    from public.finance_documents
    where id = 'fd300008-0000-4000-8000-0000000000d1'
  ) is not true then
    raise exception 'DOCUMENT_FIELDS';
  end if;
  if (select to_jsonb(object) from storage.objects object
      where object.bucket_id = 'finance-documents' and object.name = anchor.original_path)
     is distinct from anchor.storage_row then
    raise exception 'STORAGE_CHANGED';
  end if;
  if (select count(*) from public.finance_movements) is distinct from anchor.movement_rows
     or (select count(*) from public.finance_movements where museum_id = 'fd300008-0000-4000-8000-0000000000a1') <> 1 then
    raise exception 'MOVEMENT_CREATED';
  end if;

  select document.rejected_at into kept_at
  from public.finance_documents document
  where document.id = 'fd300008-0000-4000-8000-0000000000d1';
  perform pg_temp.must_raise(
    $sql$select pg_temp.reject('fd300008-0000-4000-8000-0000000000a2', 'fd300008-0000-4000-8000-0000000000d1', 'Segundo motivo')$sql$,
    'DOCUMENT_NOT_PENDING'
  );
  if (select count(*) from public.audit_logs
      where record_id = 'fd300008-0000-4000-8000-0000000000d1'
        and action = 'finance_document_reject') <> 1
     or (select rejection_reason from public.finance_documents where id = 'fd300008-0000-4000-8000-0000000000d1')
        is distinct from 'Motivo de prueba'
     or (select rejected_by from public.finance_documents where id = 'fd300008-0000-4000-8000-0000000000d1')
        is distinct from 'fd300008-0000-4000-8000-0000000000a2'
     or (select document.rejected_at from public.finance_documents document where document.id = 'fd300008-0000-4000-8000-0000000000d1')
        is distinct from kept_at then
    raise exception 'REPEAT_OVERWROTE';
  end if;
end
$$;

set local role anon;
do $$
begin
  perform public.reject_finance_document(
    'fd300008-0000-4000-8000-0000000000d1',
    'Anonimo'
  );
  raise exception 'ANON_EXECUTED';
exception
  when insufficient_privilege then
    null;
end
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'fd300008-0000-4000-8000-0000000000a2', true);
select set_config('request.jwt.claims', '{"sub":"fd300008-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
do $$
begin
  update public.finance_documents
  set rejection_reason = 'Cliente directo'
  where id = 'fd300008-0000-4000-8000-0000000000d1';
  raise exception 'CLIENT_UPDATE';
exception
  when insufficient_privilege then
    null;
end
$$;
reset role;

do $$
declare
  baseline finance_document_reject_baseline;
  anchor finance_document_reject_anchor;
begin
  select * into baseline from finance_document_reject_baseline;
  select * into anchor from finance_document_reject_anchor;
  if has_function_privilege('anon', 'public.reject_finance_document(uuid,text)', 'execute')
     or not has_function_privilege('authenticated', 'public.reject_finance_document(uuid,text)', 'execute')
     or has_table_privilege('authenticated', 'public.finance_documents', 'update')
     or has_table_privilege('authenticated', 'public.finance_documents', 'delete') then
    raise exception 'GRANTS';
  end if;
  if (select rejection_reason from public.finance_documents where id = 'fd300008-0000-4000-8000-0000000000d1')
     is distinct from 'Motivo de prueba' then
    raise exception 'DIRECT_UPDATE_STUCK';
  end if;
  if (select count(*) from public.finance_records) is distinct from baseline.record_rows
     or (select md5(string_agg(r.id::text || ':' || r.amount::text, ',' order by r.id)) from public.finance_records r) is distinct from baseline.record_hash
     or (select coalesce(sum(amount), 0) from public.finance_records) is distinct from baseline.record_sum
     or (select count(*) from public.finance_budget_lines where museum_id not in (
          'fd300008-0000-4000-8000-0000000000a1',
          'fd300008-0000-4000-8000-0000000000b1'
        )) is distinct from baseline.line_rows
     or (select count(*) from public.finance_budget_lines where category = 'Nómina' and museum_id not in (
          'fd300008-0000-4000-8000-0000000000a1',
          'fd300008-0000-4000-8000-0000000000b1'
        )) is distinct from baseline.nomina_rows
     or (select count(*) from public.finance_movements where museum_id not in (
          'fd300008-0000-4000-8000-0000000000a1',
          'fd300008-0000-4000-8000-0000000000b1'
        )) is distinct from baseline.movement_rows
     or (select count(*) from public.employee_budget_assignments) is distinct from baseline.assignment_rows
     or (select count(*) from public.finance_documents where museum_id not in (
          'fd300008-0000-4000-8000-0000000000a1',
          'fd300008-0000-4000-8000-0000000000b1'
        )) is distinct from baseline.document_rows
     or (select count(*) from storage.objects
          where bucket_id = 'finance-documents'
            and name <> anchor.original_path) is distinct from baseline.object_rows
     or (select to_jsonb(document) from public.finance_documents document where id = 'e9707e13-6b81-46bd-9054-796378366d49') is distinct from baseline.e2e
     or (select md5(pg_get_functiondef('public.post_finance_movement(uuid,date,numeric,text,uuid)'::regprocedure))) is distinct from baseline.post_hash
     or (select md5(pg_get_functiondef('public.void_finance_movement(uuid,text)'::regprocedure))) is distinct from baseline.void_hash
     or (select md5(pg_get_functiondef('public.correct_finance_movement(uuid,text,uuid,date,numeric,text,uuid)'::regprocedure))) is distinct from baseline.correct_hash
     or (select md5(pg_get_functiondef('public.payroll_actual(date,date)'::regprocedure))) is distinct from baseline.payroll_hash
     or (select md5(pg_get_functiondef('public.finance_documents_guard()'::regprocedure))) is distinct from baseline.guard_hash
     or (select md5(pg_get_functiondef('public.update_finance_document_review(uuid,text,text,date,numeric,text,uuid,text,text,date,numeric,text,uuid)'::regprocedure))) is distinct from baseline.review_hash then
    raise exception 'BASELINE_TOUCHED';
  end if;
end
$$;

select 'FINANCE_DOCUMENT_REJECT_PASS' as result;

rollback;
