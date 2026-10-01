-- Rolls back every fixture. Does not keep museums, documents, movements, audits, or storage rows.
begin;

create temporary table finance_document_confirm_baseline (
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
  movement_guard_hash text,
  review_hash text,
  reject_hash text,
  require_hash text
);

insert into finance_document_confirm_baseline
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
  (select md5(pg_get_functiondef('public.finance_movements_guard()'::regprocedure))),
  (select md5(pg_get_functiondef('public.update_finance_document_review(uuid,text,text,date,numeric,text,uuid,text,text,date,numeric,text,uuid)'::regprocedure))),
  (select md5(pg_get_functiondef('public.reject_finance_document(uuid,text)'::regprocedure))),
  (select md5(pg_get_functiondef('public.finance_movement_require_museum()'::regprocedure)));

insert into public.museums (id, name, slug)
values
  ('fd300009-0000-4000-8000-0000000000a1', 'TEST CONFIRM A', 'test-finance-confirm-a'),
  ('fd300009-0000-4000-8000-0000000000b1', 'TEST CONFIRM B', 'test-finance-confirm-b');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('fd300009-0000-4000-8000-0000000000a2', 'confirm-writer-a@example.invalid', '{}'),
  ('fd300009-0000-4000-8000-0000000000a3', 'confirm-none-a@example.invalid', '{}'),
  ('fd300009-0000-4000-8000-0000000000a4', 'confirm-limited-a@example.invalid', '{}'),
  ('fd300009-0000-4000-8000-0000000000a5', 'confirm-reader-a@example.invalid', '{}'),
  ('fd300009-0000-4000-8000-0000000000a7', 'confirm-writeonly-a@example.invalid', '{}'),
  ('fd300009-0000-4000-8000-0000000000a8', 'confirm-inactive-a@example.invalid', '{}'),
  ('fd300009-0000-4000-8000-0000000000a9', 'confirm-activo-a@example.invalid', '{}'),
  ('fd300009-0000-4000-8000-0000000000aa', 'confirm-activo-none-a@example.invalid', '{}'),
  ('fd300009-0000-4000-8000-0000000000ab', 'confirm-writer-2-a@example.invalid', '{}'),
  ('fd300009-0000-4000-8000-0000000000b2', 'confirm-writer-b@example.invalid', '{}');

update public.profiles
set museum_id = 'fd300009-0000-4000-8000-0000000000a1', role = 'empleado', status = 'active'
where id in (
  'fd300009-0000-4000-8000-0000000000a2',
  'fd300009-0000-4000-8000-0000000000a3',
  'fd300009-0000-4000-8000-0000000000a4',
  'fd300009-0000-4000-8000-0000000000a5',
  'fd300009-0000-4000-8000-0000000000a7',
  'fd300009-0000-4000-8000-0000000000a9',
  'fd300009-0000-4000-8000-0000000000aa',
  'fd300009-0000-4000-8000-0000000000ab'
);
update public.profiles
set museum_id = 'fd300009-0000-4000-8000-0000000000a1', role = 'empleado', status = 'inactive'
where id = 'fd300009-0000-4000-8000-0000000000a8';
update public.profiles
set museum_id = 'fd300009-0000-4000-8000-0000000000b1', role = 'empleado', status = 'active'
where id = 'fd300009-0000-4000-8000-0000000000b2';

insert into public.user_permissions (museum_id, user_id, permission_id, effect)
select profile.museum_id, profile.id, permission.id, 'allow'
from public.profiles profile
cross join public.permissions permission
where (
  profile.id in (
    'fd300009-0000-4000-8000-0000000000a2',
    'fd300009-0000-4000-8000-0000000000a4',
    'fd300009-0000-4000-8000-0000000000a8',
    'fd300009-0000-4000-8000-0000000000a9',
    'fd300009-0000-4000-8000-0000000000ab',
    'fd300009-0000-4000-8000-0000000000b2'
  )
  and permission.code in ('finance.read', 'finance.write')
) or (
  profile.id = 'fd300009-0000-4000-8000-0000000000a5'
  and permission.code = 'finance.read'
) or (
  profile.id = 'fd300009-0000-4000-8000-0000000000a7'
  and permission.code = 'finance.write'
);

insert into public.finance_budget_lines (
  id, museum_id, record_type, category, name, sort_order, counts_in_operating_balance
) values
  ('fd300009-0000-4000-8000-0000000000c1', 'fd300009-0000-4000-8000-0000000000a1', 'expense', 'Gastos Operacionales', 'Luz', 1, true),
  ('fd300009-0000-4000-8000-0000000000c2', 'fd300009-0000-4000-8000-0000000000a1', 'expense', 'Servicios Contratados', 'Limpieza', 2, true),
  ('fd300009-0000-4000-8000-0000000000c3', 'fd300009-0000-4000-8000-0000000000a1', 'expense', 'Otros Gastos', 'Varios', 3, true),
  ('fd300009-0000-4000-8000-0000000000c4', 'fd300009-0000-4000-8000-0000000000a1', 'expense', 'Beneficios', 'Medico', 4, true),
  ('fd300009-0000-4000-8000-0000000000c5', 'fd300009-0000-4000-8000-0000000000a1', 'expense', 'Nómina', 'Director', 5, true),
  ('fd300009-0000-4000-8000-0000000000c6', 'fd300009-0000-4000-8000-0000000000a1', 'income', 'Ingresos', 'Taquilla', 6, true),
  ('fd300009-0000-4000-8000-0000000000c7', 'fd300009-0000-4000-8000-0000000000a1', 'income', 'Entradas al Museo', 'General', 7, true),
  ('fd300009-0000-4000-8000-0000000000c8', 'fd300009-0000-4000-8000-0000000000b1', 'expense', 'Gastos Operacionales', 'Luz', 1, true);

alter table public.employees disable trigger protect_employee_module_profile;
insert into public.employees (
  id, museum_id, profile_id, first_name, last_name, position, department, email, status, access_profile
) values (
  'fd300009-0000-4000-8000-0000000000f1',
  'fd300009-0000-4000-8000-0000000000a1',
  'fd300009-0000-4000-8000-0000000000a4',
  'Modulo', 'Ajeno', 'Mantenimiento', 'Operaciones',
  'confirm-limited-a@example.invalid', 'activo', 'mantenimiento'
);
alter table public.employees enable trigger protect_employee_module_profile;

insert into public.finance_documents (
  id, museum_id, status, original_path, original_mime, original_byte_size, original_sha256,
  original_filename, vendor_name, invoice_number, invoice_date, total, description,
  budget_line_id, suggestion, uploaded_by
) values (
  'fd300009-0000-4000-8000-0000000000d1',
  'fd300009-0000-4000-8000-0000000000a1',
  'pending_review',
  'fd300009-0000-4000-8000-0000000000a1/fd300009-0000-4000-8000-0000000000d1/original',
  'application/pdf',
  128,
  md5('fd300009-d1') || md5('fd300009-d1-sha'),
  'pendiente.pdf',
  'Proveedor E2E',
  'FAC-9',
  date '2026-09-20',
  48.25,
  'Servicio de sonido',
  'fd300009-0000-4000-8000-0000000000c1',
  '{"keep":true}'::jsonb,
  'fd300009-0000-4000-8000-0000000000a2'
);

insert into storage.objects (bucket_id, name, owner_id, metadata)
values (
  'finance-documents',
  'fd300009-0000-4000-8000-0000000000a1/fd300009-0000-4000-8000-0000000000d1/original',
  'fd300009-0000-4000-8000-0000000000a2',
  '{"mimetype":"application/pdf","size":128}'::jsonb
);

insert into public.finance_documents (
  id, museum_id, status, original_path, original_mime, original_byte_size, original_sha256,
  original_filename, invoice_date, total, description, budget_line_id, uploaded_by
) values
  (
    'fd300009-0000-4000-8000-0000000000d2',
    'fd300009-0000-4000-8000-0000000000b1',
    'pending_review',
    'fd300009-0000-4000-8000-0000000000b1/fd300009-0000-4000-8000-0000000000d2/original',
    'image/jpeg', 20, md5('fd300009-d2') || md5('fd300009-d2-sha'), 'ajena.jpg',
    date '2026-09-02', 12.00, 'Factura del otro museo',
    'fd300009-0000-4000-8000-0000000000c8',
    'fd300009-0000-4000-8000-0000000000b2'
  ),
  (
    'fd300009-0000-4000-8000-0000000000d3',
    'fd300009-0000-4000-8000-0000000000a1',
    'pending_review',
    'fd300009-0000-4000-8000-0000000000a1/fd300009-0000-4000-8000-0000000000d3/original',
    'application/pdf', 10, md5('fd300009-d3') || md5('fd300009-d3-sha'), 'confirmada.pdf',
    date '2026-09-01', 20.00, 'Ya confirmada',
    'fd300009-0000-4000-8000-0000000000c1',
    'fd300009-0000-4000-8000-0000000000a2'
  ),
  (
    'fd300009-0000-4000-8000-0000000000d5',
    'fd300009-0000-4000-8000-0000000000a1',
    'pending_review',
    'fd300009-0000-4000-8000-0000000000a1/fd300009-0000-4000-8000-0000000000d5/original',
    'application/pdf', 10, md5('fd300009-d5') || md5('fd300009-d5-sha'), 'incompleta.pdf',
    null, null, null, null,
    'fd300009-0000-4000-8000-0000000000a2'
  ),
  (
    'fd300009-0000-4000-8000-0000000000d6',
    'fd300009-0000-4000-8000-0000000000a1',
    'pending_review',
    'fd300009-0000-4000-8000-0000000000a1/fd300009-0000-4000-8000-0000000000d6/original',
    'application/pdf', 10, md5('fd300009-d6') || md5('fd300009-d6-sha'), 'blanco.pdf',
    date '2026-04-01', 4.00, '   ',
    'fd300009-0000-4000-8000-0000000000c1',
    'fd300009-0000-4000-8000-0000000000a2'
  ),
  (
    'fd300009-0000-4000-8000-0000000000d7',
    'fd300009-0000-4000-8000-0000000000a1',
    'pending_review',
    'fd300009-0000-4000-8000-0000000000a1/fd300009-0000-4000-8000-0000000000d7/original',
    'application/pdf', 10, md5('fd300009-d7') || md5('fd300009-d7-sha'), 'servicio.pdf',
    date '2026-08-01', 10.00, 'Servicio contratado',
    'fd300009-0000-4000-8000-0000000000c2',
    'fd300009-0000-4000-8000-0000000000a2'
  ),
  (
    'fd300009-0000-4000-8000-0000000000d8',
    'fd300009-0000-4000-8000-0000000000a1',
    'pending_review',
    'fd300009-0000-4000-8000-0000000000a1/fd300009-0000-4000-8000-0000000000d8/original',
    'application/pdf', 10, md5('fd300009-d8') || md5('fd300009-d8-sha'), 'otros.pdf',
    date '2026-07-15', 15.50, '  Texto revisado  ',
    'fd300009-0000-4000-8000-0000000000c3',
    'fd300009-0000-4000-8000-0000000000a2'
  ),
  (
    'fd300009-0000-4000-8000-0000000000d9',
    'fd300009-0000-4000-8000-0000000000a1',
    'pending_review',
    'fd300009-0000-4000-8000-0000000000a1/fd300009-0000-4000-8000-0000000000d9/original',
    'application/pdf', 10, md5('fd300009-d9') || md5('fd300009-d9-sha'), 'beneficio.pdf',
    date '2026-03-01', 5.00, 'Beneficio',
    'fd300009-0000-4000-8000-0000000000c4',
    'fd300009-0000-4000-8000-0000000000a2'
  ),
  (
    'fd300009-0000-4000-8000-0000000000da',
    'fd300009-0000-4000-8000-0000000000a1',
    'pending_review',
    'fd300009-0000-4000-8000-0000000000a1/fd300009-0000-4000-8000-0000000000da/original',
    'application/pdf', 10, md5('fd300009-d10') || md5('fd300009-d10-sha'), 'nomina.pdf',
    date '2026-03-02', 6.00, 'Nomina',
    'fd300009-0000-4000-8000-0000000000c1',
    'fd300009-0000-4000-8000-0000000000a2'
  ),
  (
    'fd300009-0000-4000-8000-0000000000db',
    'fd300009-0000-4000-8000-0000000000a1',
    'pending_review',
    'fd300009-0000-4000-8000-0000000000a1/fd300009-0000-4000-8000-0000000000db/original',
    'application/pdf', 10, md5('fd300009-d11') || md5('fd300009-d11-sha'), 'ingreso.pdf',
    date '2026-03-03', 7.00, 'Ingreso',
    'fd300009-0000-4000-8000-0000000000c1',
    'fd300009-0000-4000-8000-0000000000a2'
  ),
  (
    'fd300009-0000-4000-8000-0000000000dc',
    'fd300009-0000-4000-8000-0000000000a1',
    'pending_review',
    'fd300009-0000-4000-8000-0000000000a1/fd300009-0000-4000-8000-0000000000dc/original',
    'application/pdf', 10, md5('fd300009-d12') || md5('fd300009-d12-sha'), 'entrada.pdf',
    date '2026-03-04', 8.00, 'Entrada',
    'fd300009-0000-4000-8000-0000000000c1',
    'fd300009-0000-4000-8000-0000000000a2'
  ),
  (
    'fd300009-0000-4000-8000-0000000000dd',
    'fd300009-0000-4000-8000-0000000000a1',
    'pending_review',
    'fd300009-0000-4000-8000-0000000000a1/fd300009-0000-4000-8000-0000000000dd/original',
    'application/pdf', 10, md5('fd300009-d13') || md5('fd300009-d13-sha'), 'clave.pdf',
    date '2026-05-01', 9.00, 'Clave ajena',
    'fd300009-0000-4000-8000-0000000000c1',
    'fd300009-0000-4000-8000-0000000000a2'
  ),
  (
    'fd300009-0000-4000-8000-0000000000de',
    'fd300009-0000-4000-8000-0000000000a1',
    'pending_review',
    'fd300009-0000-4000-8000-0000000000a1/fd300009-0000-4000-8000-0000000000de/original',
    'application/pdf', 10, md5('fd300009-d14') || md5('fd300009-d14-sha'), 'activo.pdf',
    date '2026-06-01', 33.10, 'Gasto activo',
    'fd300009-0000-4000-8000-0000000000c1',
    'fd300009-0000-4000-8000-0000000000a2'
  );

insert into public.finance_documents (
  id, museum_id, status, original_path, original_mime, original_byte_size, original_sha256,
  original_filename, uploaded_by
) values (
  'fd300009-0000-4000-8000-0000000000d4',
  'fd300009-0000-4000-8000-0000000000a1',
  'pending_review',
  'fd300009-0000-4000-8000-0000000000a1/fd300009-0000-4000-8000-0000000000d4/original',
  'image/png',
  10,
  md5('fd300009-d4') || md5('fd300009-d4-sha'),
  'rechazada.png',
  'fd300009-0000-4000-8000-0000000000a2'
);

insert into public.finance_movements (
  id, museum_id, budget_line_id, occurred_on, amount, description, created_by, idempotency_key
) values
  (
    'fd300009-0000-4000-8000-0000000000e1',
    'fd300009-0000-4000-8000-0000000000a1',
    'fd300009-0000-4000-8000-0000000000c1',
    date '2026-09-01', 20.00, 'Ya confirmada',
    'fd300009-0000-4000-8000-0000000000a2',
    'fd300009-0000-4000-8000-0000000000e1'
  ),
  (
    'fd300009-0000-4000-8000-0000000000e2',
    'fd300009-0000-4000-8000-0000000000a1',
    'fd300009-0000-4000-8000-0000000000c1',
    date '2026-05-01', 9.00, 'Clave ajena',
    'fd300009-0000-4000-8000-0000000000a2',
    'fd300009-0000-4000-8000-0000000000dd'
  );

update public.finance_documents
set status = 'confirmed',
    confirmed_by = 'fd300009-0000-4000-8000-0000000000a2',
    confirmed_at = now(),
    movement_id = 'fd300009-0000-4000-8000-0000000000e1'
where id = 'fd300009-0000-4000-8000-0000000000d3';

update public.finance_documents
set status = 'rejected',
    rejected_by = 'fd300009-0000-4000-8000-0000000000a2',
    rejected_at = now(),
    rejection_reason = 'Documento de prueba'
where id = 'fd300009-0000-4000-8000-0000000000d4';

alter table public.finance_documents disable trigger finance_documents_guard;
update public.finance_documents
set budget_line_id = 'fd300009-0000-4000-8000-0000000000c5'
where id = 'fd300009-0000-4000-8000-0000000000da';
update public.finance_documents
set budget_line_id = 'fd300009-0000-4000-8000-0000000000c6'
where id = 'fd300009-0000-4000-8000-0000000000db';
update public.finance_documents
set budget_line_id = 'fd300009-0000-4000-8000-0000000000c7'
where id = 'fd300009-0000-4000-8000-0000000000dc';
alter table public.finance_documents enable trigger finance_documents_guard;

create temporary table finance_document_confirm_anchor (
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
  closed_confirmed_at timestamptz,
  closed_movement uuid
);

insert into finance_document_confirm_anchor
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
  (select confirmed_at from public.finance_documents where id = 'fd300009-0000-4000-8000-0000000000d3'),
  (select movement_id from public.finance_documents where id = 'fd300009-0000-4000-8000-0000000000d3')
from public.finance_documents document
where document.id = 'fd300009-0000-4000-8000-0000000000d1';

create function pg_temp.confirm(p_actor uuid, p_document uuid) returns jsonb
language plpgsql
as $$
declare
  result jsonb;
begin
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', p_actor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_actor, 'role', 'authenticated')::text, true);
  select public.confirm_finance_document(p_document) into result;
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

create function pg_temp.assert_posted(
  p_document uuid,
  p_actor uuid,
  p_line uuid,
  p_amount numeric,
  p_description text,
  p_date date
) returns void
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.finance_documents document
    join public.finance_movements movement on movement.id = document.movement_id
    where document.id = p_document
      and document.status = 'confirmed'
      and document.confirmed_by = p_actor
      and document.confirmed_at = movement.created_at
      and document.invoice_date = p_date
      and document.total = p_amount
      and document.description = p_description
      and document.budget_line_id = p_line
      and movement.museum_id = document.museum_id
      and movement.budget_line_id = p_line
      and movement.occurred_on = p_date
      and movement.amount = p_amount
      and movement.description = p_description
      and movement.created_by = p_actor
      and movement.idempotency_key = document.id
      and movement.voided_at is null
      and (
        select count(*) from public.finance_movements keyed
        where keyed.idempotency_key = document.id
          and keyed.museum_id = document.museum_id
      ) = 1
      and (
        select count(*) from public.finance_documents linked
        where linked.movement_id = movement.id
      ) = 1
      and (
        select count(*) from public.audit_logs audit_row
        where audit_row.action = 'finance_document_confirm'
          and audit_row.record_id = document.id
          and audit_row.table_name = 'finance_documents'
          and audit_row.new_value->>'movement_id' = movement.id::text
          and audit_row.new_value->>'status' = 'confirmed'
          and audit_row.old_value->>'status' = 'pending_review'
      ) = 1
      and (
        select count(*) from public.audit_logs audit_row
        where audit_row.action = 'finance_movement_post'
          and audit_row.record_id = movement.id
          and audit_row.table_name = 'finance_movements'
          and audit_row.new_value->>'document_id' = document.id::text
          and audit_row.new_value->>'description' = p_description
          and (audit_row.new_value->>'amount')::numeric = p_amount
          and audit_row.new_value->>'occurred_on' = p_date::text
          and audit_row.new_value->>'budget_line_id' = p_line::text
      ) = 1
  ) then
    raise exception 'POSTED_MISMATCH %', p_document;
  end if;
end
$$;

do $$
declare
  saved jsonb;
  repeated jsonb;
  actor_column text;
  actor uuid;
  anchor finance_document_confirm_anchor;
  kept_at timestamptz;
  kept_movement uuid;
  def text;
  status_name text;
  status_def text;
begin
  if to_regprocedure('public.confirm_finance_document(uuid)') is null then
    raise exception 'CONFIRM_FUNCTION_MISSING';
  end if;
  def := pg_get_functiondef('public.confirm_finance_document(uuid)'::regprocedure);
  if strpos(def, 'for update') = 0
     or strpos(def, 'for update') > strpos(def, 'DOCUMENT_NOT_PENDING') then
    raise exception 'LOCK_ORDER';
  end if;
  if strpos(def, 'post_finance_movement') > 0
     or strpos(def, 'finance_movement_validate_amount') = 0
     or strpos(def, 'finance_movement_audit') = 0 then
    raise exception 'MOVEMENT_STRATEGY';
  end if;
  if not exists (
    select 1
    from pg_proc proc
    join pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname = 'confirm_finance_document'
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
    $sql$select pg_temp.confirm('fd300009-0000-4000-8000-0000000000a2', null)$sql$,
    'PROFILE_REQUIRED'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.confirm('fd300009-0000-4000-8000-0000000000b2', 'fd300009-0000-4000-8000-0000000000d1')$sql$,
    'Finance document not found'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.confirm('fd300009-0000-4000-8000-0000000000a2', 'fd300009-0000-4000-8000-0000000000d2')$sql$,
    'Finance document not found'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.confirm('fd300009-0000-4000-8000-0000000000a3', 'fd300009-0000-4000-8000-0000000000d1')$sql$,
    'Missing financial authorization'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.confirm('fd300009-0000-4000-8000-0000000000a5', 'fd300009-0000-4000-8000-0000000000d1')$sql$,
    'Missing financial authorization'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.confirm('fd300009-0000-4000-8000-0000000000a7', 'fd300009-0000-4000-8000-0000000000d1')$sql$,
    'Missing financial authorization'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.confirm('fd300009-0000-4000-8000-0000000000a8', 'fd300009-0000-4000-8000-0000000000d1')$sql$,
    'PROFILE_REQUIRED'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.confirm('fd300009-0000-4000-8000-0000000000a4', 'fd300009-0000-4000-8000-0000000000d1')$sql$,
    'Missing financial authorization'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.confirm('fd300009-0000-4000-8000-0000000000a2', 'fd300009-0000-4000-8000-0000000000d4')$sql$,
    'DOCUMENT_NOT_PENDING'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.confirm('fd300009-0000-4000-8000-0000000000a2', 'fd300009-0000-4000-8000-0000000000d5')$sql$,
    'DOCUMENT_NOT_READY'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.confirm('fd300009-0000-4000-8000-0000000000a2', 'fd300009-0000-4000-8000-0000000000d6')$sql$,
    'DOCUMENT_NOT_READY'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.confirm('fd300009-0000-4000-8000-0000000000a2', 'fd300009-0000-4000-8000-0000000000d9')$sql$,
    'BUDGET_LINE_NOT_INVOICE_ELIGIBLE'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.confirm('fd300009-0000-4000-8000-0000000000a2', 'fd300009-0000-4000-8000-0000000000da')$sql$,
    'BUDGET_LINE_NOT_INVOICE_ELIGIBLE'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.confirm('fd300009-0000-4000-8000-0000000000a2', 'fd300009-0000-4000-8000-0000000000db')$sql$,
    'BUDGET_LINE_NOT_INVOICE_ELIGIBLE'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.confirm('fd300009-0000-4000-8000-0000000000a2', 'fd300009-0000-4000-8000-0000000000dc')$sql$,
    'BUDGET_LINE_NOT_INVOICE_ELIGIBLE'
  );
  perform pg_temp.must_raise(
    $sql$select pg_temp.confirm('fd300009-0000-4000-8000-0000000000a2', 'fd300009-0000-4000-8000-0000000000dd')$sql$,
    'IDEMPOTENCY_CONFLICT'
  );

  saved := pg_temp.confirm(
    'fd300009-0000-4000-8000-0000000000a2',
    'fd300009-0000-4000-8000-0000000000d3'
  );
  if saved->>'idempotent' is distinct from 'true'
     or saved->>'movement_id' is distinct from 'fd300009-0000-4000-8000-0000000000e1'
     or saved->>'status' is distinct from 'confirmed'
     or saved->>'audit_id' is not null
     or saved->>'movement_audit_id' is not null
     or saved->>'confirmed_by' is distinct from 'fd300009-0000-4000-8000-0000000000a2' then
    raise exception 'ALREADY_CONFIRMED %', saved;
  end if;

  select * into anchor from finance_document_confirm_anchor;
  if (select count(*) from public.finance_movements) is distinct from anchor.movement_rows
     or (select status from public.finance_documents where id = 'fd300009-0000-4000-8000-0000000000d1')
        is distinct from 'pending_review'
     or (select movement_id from public.finance_documents where id = 'fd300009-0000-4000-8000-0000000000d1') is not null
     or (select status from public.finance_documents where id = 'fd300009-0000-4000-8000-0000000000d2')
        is distinct from 'pending_review'
     or (select status from public.finance_documents where id = 'fd300009-0000-4000-8000-0000000000d4')
        is distinct from 'rejected'
     or (select status from public.finance_documents where id = 'fd300009-0000-4000-8000-0000000000d9')
        is distinct from 'pending_review'
     or (select status from public.finance_documents where id = 'fd300009-0000-4000-8000-0000000000dd')
        is distinct from 'pending_review'
     or (select movement_id from public.finance_documents where id = 'fd300009-0000-4000-8000-0000000000dd') is not null
     or (select count(*) from public.audit_logs where action = 'finance_document_confirm') <> 0
     or (select count(*) from public.audit_logs
          where action = 'finance_movement_post'
            and museum_id = 'fd300009-0000-4000-8000-0000000000a1') <> 0
     or (select confirmed_at from public.finance_documents where id = 'fd300009-0000-4000-8000-0000000000d3')
        is distinct from anchor.closed_confirmed_at
     or (select movement_id from public.finance_documents where id = 'fd300009-0000-4000-8000-0000000000d3')
        is distinct from anchor.closed_movement then
    raise exception 'FAILED_CALLS_MUTATED';
  end if;

  saved := pg_temp.confirm(
    'fd300009-0000-4000-8000-0000000000a2',
    'fd300009-0000-4000-8000-0000000000d1'
  );
  if saved->>'status' is distinct from 'confirmed'
     or saved->>'idempotent' is distinct from 'false'
     or saved->>'document_id' is distinct from 'fd300009-0000-4000-8000-0000000000d1'
     or saved->>'amount' is distinct from '48.25'
     or saved->>'occurred_on' is distinct from '2026-09-20'
     or saved->>'description' is distinct from 'Servicio de sonido'
     or saved->>'budget_line_id' is distinct from 'fd300009-0000-4000-8000-0000000000c1'
     or saved->>'confirmed_by' is distinct from 'fd300009-0000-4000-8000-0000000000a2'
     or saved->>'audit_id' is null
     or saved->>'movement_audit_id' is null
     or saved->>'movement_id' is null then
    raise exception 'CONFIRM_RESULT %', saved;
  end if;

  perform pg_temp.assert_posted(
    'fd300009-0000-4000-8000-0000000000d1',
    'fd300009-0000-4000-8000-0000000000a2',
    'fd300009-0000-4000-8000-0000000000c1',
    48.25,
    'Servicio de sonido',
    date '2026-09-20'
  );

  select a.attname into actor_column
  from pg_attribute a
  where a.attrelid = 'public.audit_logs'::regclass
    and not a.attisdropped
    and a.attname in ('user_id', 'actor_user_id')
  order by case a.attname when 'user_id' then 0 else 1 end
  limit 1;
  execute format('select %I from public.audit_logs where id = $1', actor_column)
    into actor using (saved->>'audit_id')::uuid;
  if actor is distinct from 'fd300009-0000-4000-8000-0000000000a2'::uuid then
    raise exception 'AUDIT_ACTOR %', actor;
  end if;
  execute format('select %I from public.audit_logs where id = $1', actor_column)
    into actor using (saved->>'movement_audit_id')::uuid;
  if actor is distinct from 'fd300009-0000-4000-8000-0000000000a2'::uuid then
    raise exception 'MOVEMENT_AUDIT_ACTOR %', actor;
  end if;

  if (
    select vendor_name = 'Proveedor E2E'
       and invoice_number = 'FAC-9'
       and suggestion = '{"keep":true}'::jsonb
       and original_path = anchor.original_path
       and original_mime = anchor.original_mime
       and original_byte_size = anchor.original_byte_size
       and original_sha256 = anchor.original_sha
       and original_filename = anchor.original_filename
       and uploaded_by = anchor.uploaded_by
       and uploaded_at = anchor.uploaded_at
       and rejected_by is null
       and rejection_reason is null
    from public.finance_documents
    where id = 'fd300009-0000-4000-8000-0000000000d1'
  ) is not true then
    raise exception 'DOCUMENT_FIELDS';
  end if;
  if position(
       'Proveedor E2E' in (
         select movement.description
         from public.finance_movements movement
         where movement.idempotency_key = 'fd300009-0000-4000-8000-0000000000d1'
       )
     ) > 0
     or position(
       'FAC-9' in (
         select movement.description
         from public.finance_movements movement
         where movement.idempotency_key = 'fd300009-0000-4000-8000-0000000000d1'
       )
     ) > 0 then
    raise exception 'VENDOR_COPIED';
  end if;
  if (select to_jsonb(object) from storage.objects object
      where object.bucket_id = 'finance-documents' and object.name = anchor.original_path)
     is distinct from anchor.storage_row then
    raise exception 'STORAGE_CHANGED';
  end if;

  select document.confirmed_at, document.movement_id
    into kept_at, kept_movement
  from public.finance_documents document
  where document.id = 'fd300009-0000-4000-8000-0000000000d1';
  repeated := pg_temp.confirm(
    'fd300009-0000-4000-8000-0000000000a2',
    'fd300009-0000-4000-8000-0000000000d1'
  );
  if repeated->>'idempotent' is distinct from 'true'
     or repeated->>'movement_id' is distinct from kept_movement::text
     or repeated->>'audit_id' is not null then
    raise exception 'RETRY %', repeated;
  end if;
  repeated := pg_temp.confirm(
    'fd300009-0000-4000-8000-0000000000ab',
    'fd300009-0000-4000-8000-0000000000d1'
  );
  if repeated->>'idempotent' is distinct from 'true'
     or repeated->>'movement_id' is distinct from kept_movement::text
     or repeated->>'confirmed_by' is distinct from 'fd300009-0000-4000-8000-0000000000a2'
     or (select confirmed_at from public.finance_documents where id = 'fd300009-0000-4000-8000-0000000000d1')
        is distinct from kept_at
     or (select count(*) from public.finance_movements
          where idempotency_key = 'fd300009-0000-4000-8000-0000000000d1') <> 1
     or (select count(*) from public.audit_logs
          where record_id = 'fd300009-0000-4000-8000-0000000000d1'
            and action = 'finance_document_confirm') <> 1 then
    raise exception 'SECOND_ACTOR_DUPLICATED %', repeated;
  end if;

  perform pg_temp.confirm(
    'fd300009-0000-4000-8000-0000000000a2',
    'fd300009-0000-4000-8000-0000000000d7'
  );
  perform pg_temp.assert_posted(
    'fd300009-0000-4000-8000-0000000000d7',
    'fd300009-0000-4000-8000-0000000000a2',
    'fd300009-0000-4000-8000-0000000000c2',
    10.00,
    'Servicio contratado',
    date '2026-08-01'
  );
  perform pg_temp.confirm(
    'fd300009-0000-4000-8000-0000000000a2',
    'fd300009-0000-4000-8000-0000000000d8'
  );
  perform pg_temp.assert_posted(
    'fd300009-0000-4000-8000-0000000000d8',
    'fd300009-0000-4000-8000-0000000000a2',
    'fd300009-0000-4000-8000-0000000000c3',
    15.50,
    '  Texto revisado  ',
    date '2026-07-15'
  );

  select conname, pg_get_constraintdef(oid)
    into status_name, status_def
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%suspended%';
  if status_name is null then
    raise exception 'PROFILE_STATUS_CHECK_MISSING';
  end if;
  execute format('alter table public.profiles drop constraint %I', status_name);
  alter table public.profiles disable trigger profiles_protect_security;
  update public.profiles
  set status = 'activo'
  where id in (
    'fd300009-0000-4000-8000-0000000000a9',
    'fd300009-0000-4000-8000-0000000000aa'
  );
  alter table public.profiles enable trigger profiles_protect_security;
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', 'fd300009-0000-4000-8000-0000000000a9', true);
  perform set_config('request.jwt.claims', '{"sub":"fd300009-0000-4000-8000-0000000000a9","role":"authenticated"}', true);
  if public.current_user_museum_id() is not null then
    raise exception 'ACTIVO_STILL_RESOLVES';
  end if;
  perform pg_temp.must_raise(
    $sql$select pg_temp.confirm('fd300009-0000-4000-8000-0000000000aa', 'fd300009-0000-4000-8000-0000000000de')$sql$,
    'Missing financial authorization'
  );
  saved := pg_temp.confirm(
    'fd300009-0000-4000-8000-0000000000a9',
    'fd300009-0000-4000-8000-0000000000de'
  );
  if saved->>'idempotent' is distinct from 'false'
     or saved->>'confirmed_by' is distinct from 'fd300009-0000-4000-8000-0000000000a9' then
    raise exception 'ACTIVO_CONFIRM %', saved;
  end if;
  perform pg_temp.assert_posted(
    'fd300009-0000-4000-8000-0000000000de',
    'fd300009-0000-4000-8000-0000000000a9',
    'fd300009-0000-4000-8000-0000000000c1',
    33.10,
    'Gasto activo',
    date '2026-06-01'
  );
  alter table public.profiles disable trigger profiles_protect_security;
  update public.profiles
  set status = 'active'
  where id in (
    'fd300009-0000-4000-8000-0000000000a9',
    'fd300009-0000-4000-8000-0000000000aa'
  );
  alter table public.profiles enable trigger profiles_protect_security;
  execute format('alter table public.profiles add constraint %I ', status_name) || status_def;

  if (select count(*) from public.finance_movements) is distinct from anchor.movement_rows + 4
     or (select count(*) from public.finance_documents where status = 'confirmed' and movement_id is null) <> 0
     or (select count(*) from public.finance_documents document
          join public.finance_movements movement on movement.id = document.movement_id
          where document.museum_id = 'fd300009-0000-4000-8000-0000000000a1'
            and (
              movement.museum_id is distinct from document.museum_id
              or movement.amount is distinct from document.total
              or movement.occurred_on is distinct from document.invoice_date
              or movement.description is distinct from document.description
              or movement.budget_line_id is distinct from document.budget_line_id
            )) <> 0 then
    raise exception 'ONE_MOVEMENT_RULE';
  end if;
end
$$;

set local role anon;
do $$
begin
  perform public.confirm_finance_document('fd300009-0000-4000-8000-0000000000d1');
  raise exception 'ANON_EXECUTED';
exception
  when insufficient_privilege then
    null;
end
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'fd300009-0000-4000-8000-0000000000a2', true);
select set_config('request.jwt.claims', '{"sub":"fd300009-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
do $$
begin
  update public.finance_documents
  set description = 'Cliente directo'
  where id = 'fd300009-0000-4000-8000-0000000000d1';
  raise exception 'CLIENT_UPDATE';
exception
  when insufficient_privilege then
    null;
end
$$;
do $$
begin
  insert into public.finance_movements (
    museum_id, budget_line_id, occurred_on, amount, description, created_by, idempotency_key
  ) values (
    'fd300009-0000-4000-8000-0000000000a1',
    'fd300009-0000-4000-8000-0000000000c1',
    date '2026-01-01',
    1.00,
    'Cliente directo',
    'fd300009-0000-4000-8000-0000000000a2',
    'fd300009-0000-4000-8000-0000000000ee'
  );
  raise exception 'CLIENT_INSERT';
exception
  when insufficient_privilege then
    null;
end
$$;
reset role;

do $$
declare
  baseline finance_document_confirm_baseline;
  anchor finance_document_confirm_anchor;
begin
  select * into baseline from finance_document_confirm_baseline;
  select * into anchor from finance_document_confirm_anchor;
  if has_function_privilege('anon', 'public.confirm_finance_document(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.confirm_finance_document(uuid)', 'execute')
     or has_table_privilege('authenticated', 'public.finance_documents', 'update')
     or has_table_privilege('authenticated', 'public.finance_documents', 'delete')
     or has_table_privilege('authenticated', 'public.finance_movements', 'insert')
     or has_table_privilege('authenticated', 'public.finance_movements', 'update')
     or has_table_privilege('authenticated', 'public.finance_movements', 'delete') then
    raise exception 'GRANTS';
  end if;
  if (select description from public.finance_documents where id = 'fd300009-0000-4000-8000-0000000000d1')
     is distinct from 'Servicio de sonido' then
    raise exception 'DIRECT_UPDATE_STUCK';
  end if;
  if (select count(*) from public.finance_records) is distinct from baseline.record_rows
     or (select md5(string_agg(r.id::text || ':' || r.amount::text, ',' order by r.id)) from public.finance_records r) is distinct from baseline.record_hash
     or (select coalesce(sum(amount), 0) from public.finance_records) is distinct from baseline.record_sum
     or (select count(*) from public.finance_budget_lines where museum_id not in (
          'fd300009-0000-4000-8000-0000000000a1',
          'fd300009-0000-4000-8000-0000000000b1'
        )) is distinct from baseline.line_rows
     or (select count(*) from public.finance_budget_lines where category = 'Nómina' and museum_id not in (
          'fd300009-0000-4000-8000-0000000000a1',
          'fd300009-0000-4000-8000-0000000000b1'
        )) is distinct from baseline.nomina_rows
     or (select count(*) from public.finance_movements where museum_id not in (
          'fd300009-0000-4000-8000-0000000000a1',
          'fd300009-0000-4000-8000-0000000000b1'
        )) is distinct from baseline.movement_rows
     or (select count(*) from public.employee_budget_assignments) is distinct from baseline.assignment_rows
     or (select count(*) from public.finance_documents where museum_id not in (
          'fd300009-0000-4000-8000-0000000000a1',
          'fd300009-0000-4000-8000-0000000000b1'
        )) is distinct from baseline.document_rows
     or (select count(*) from storage.objects
          where bucket_id = 'finance-documents'
            and name <> anchor.original_path) is distinct from baseline.object_rows
     or (select to_jsonb(object) from storage.objects object
          where object.bucket_id = 'finance-documents' and object.name = anchor.original_path)
        is distinct from anchor.storage_row
     or (select to_jsonb(document) from public.finance_documents document where id = 'e9707e13-6b81-46bd-9054-796378366d49') is distinct from baseline.e2e
     or (select md5(pg_get_functiondef('public.post_finance_movement(uuid,date,numeric,text,uuid)'::regprocedure))) is distinct from baseline.post_hash
     or (select md5(pg_get_functiondef('public.void_finance_movement(uuid,text)'::regprocedure))) is distinct from baseline.void_hash
     or (select md5(pg_get_functiondef('public.correct_finance_movement(uuid,text,uuid,date,numeric,text,uuid)'::regprocedure))) is distinct from baseline.correct_hash
     or (select md5(pg_get_functiondef('public.payroll_actual(date,date)'::regprocedure))) is distinct from baseline.payroll_hash
     or (select md5(pg_get_functiondef('public.finance_documents_guard()'::regprocedure))) is distinct from baseline.guard_hash
     or (select md5(pg_get_functiondef('public.finance_movements_guard()'::regprocedure))) is distinct from baseline.movement_guard_hash
     or (select md5(pg_get_functiondef('public.update_finance_document_review(uuid,text,text,date,numeric,text,uuid,text,text,date,numeric,text,uuid)'::regprocedure))) is distinct from baseline.review_hash
     or (select md5(pg_get_functiondef('public.reject_finance_document(uuid,text)'::regprocedure))) is distinct from baseline.reject_hash
     or (select md5(pg_get_functiondef('public.finance_movement_require_museum()'::regprocedure))) is distinct from baseline.require_hash then
    raise exception 'BASELINE_TOUCHED';
  end if;
end
$$;

select 'FINANCE_DOCUMENT_CONFIRM_PASS' as result;

rollback;
