-- Rolls back every fixture. Does not keep museums, documents, movements, audits, or storage rows.
begin;

create temporary table finance_document_decide_baseline (
  record_rows bigint,
  record_sum numeric,
  line_rows bigint,
  nomina_rows bigint,
  movement_rows bigint,
  document_rows bigint,
  object_rows bigint,
  inventory_rows bigint,
  compensation_rows bigint,
  assignment_rows bigint,
  museografica_modules text[],
  permission_hash text,
  post_hash text,
  void_hash text,
  correct_hash text,
  payroll_hash text,
  guard_hash text,
  movement_guard_hash text,
  require_hash text
);

insert into finance_document_decide_baseline
select
  (select count(*) from public.finance_records),
  (select coalesce(sum(amount), 0) from public.finance_records),
  (select count(*) from public.finance_budget_lines),
  (select count(*) from public.finance_budget_lines where category = 'Nómina'),
  (select count(*) from public.finance_movements),
  (select count(*) from public.finance_documents),
  (select count(*) from storage.objects where bucket_id = 'finance-documents'),
  (select count(*) from public.inventory_items),
  (select count(*) from public.employee_compensation),
  (select count(*) from public.employee_budget_assignments),
  (select modules from public.employee_module_profiles where code = 'gerente_museografica'),
  md5(pg_get_functiondef('public.has_permission(text)'::regprocedure)),
  md5(pg_get_functiondef('public.post_finance_movement(uuid,date,numeric,text,uuid)'::regprocedure)),
  md5(pg_get_functiondef('public.void_finance_movement(uuid,text)'::regprocedure)),
  md5(pg_get_functiondef('public.correct_finance_movement(uuid,text,uuid,date,numeric,text,uuid)'::regprocedure)),
  md5(pg_get_functiondef('public.payroll_actual(date,date)'::regprocedure)),
  md5(pg_get_functiondef('public.finance_documents_guard()'::regprocedure)),
  md5(pg_get_functiondef('public.finance_movements_guard()'::regprocedure)),
  md5(pg_get_functiondef('public.finance_movement_require_museum()'::regprocedure));

insert into public.museums (id, name, slug) values
  ('fd30000c-0000-4000-8000-0000000000a1', 'TEST DECIDE A', 'test-finance-decide-a'),
  ('fd30000c-0000-4000-8000-0000000000b1', 'TEST DECIDE B', 'test-finance-decide-b');

insert into auth.users (id, email, raw_user_meta_data) values
  ('fd30000c-0000-4000-8000-000000000001', 'decide-director@example.invalid', '{}'),
  ('fd30000c-0000-4000-8000-000000000002', 'decide-geradmin@example.invalid', '{}'),
  ('fd30000c-0000-4000-8000-000000000003', 'decide-admingeneral@example.invalid', '{}'),
  ('fd30000c-0000-4000-8000-000000000004', 'decide-museografica@example.invalid', '{}'),
  ('fd30000c-0000-4000-8000-000000000005', 'decide-asistente@example.invalid', '{}'),
  ('fd30000c-0000-4000-8000-000000000006', 'decide-it@example.invalid', '{}'),
  ('fd30000c-0000-4000-8000-000000000007', 'decide-mantenimiento@example.invalid', '{}'),
  ('fd30000c-0000-4000-8000-000000000008', 'decide-marketing@example.invalid', '{}'),
  ('fd30000c-0000-4000-8000-000000000009', 'decide-coordinadora@example.invalid', '{}'),
  ('fd30000c-0000-4000-8000-00000000000a', 'decide-tecnico@example.invalid', '{}'),
  ('fd30000c-0000-4000-8000-00000000000b', 'decide-finanzas@example.invalid', '{}'),
  ('fd30000c-0000-4000-8000-00000000000c', 'decide-administrador@example.invalid', '{}'),
  ('fd30000c-0000-4000-8000-00000000000d', 'decide-null-profile@example.invalid', '{}'),
  ('fd30000c-0000-4000-8000-00000000000e', 'decide-other-museum@example.invalid', '{}'),
  ('fd30000c-0000-4000-8000-00000000000f', 'decide-ambiguous@example.invalid', '{}'),
  ('fd30000c-0000-4000-8000-000000000010', 'decide-activo@example.invalid', '{}');

update public.profiles
set museum_id = 'fd30000c-0000-4000-8000-0000000000a1', role = 'empleado', status = 'active'
where id in (
  'fd30000c-0000-4000-8000-000000000001',
  'fd30000c-0000-4000-8000-000000000002',
  'fd30000c-0000-4000-8000-000000000003',
  'fd30000c-0000-4000-8000-000000000004',
  'fd30000c-0000-4000-8000-000000000005',
  'fd30000c-0000-4000-8000-000000000006',
  'fd30000c-0000-4000-8000-000000000007',
  'fd30000c-0000-4000-8000-000000000008',
  'fd30000c-0000-4000-8000-000000000009',
  'fd30000c-0000-4000-8000-00000000000a',
  'fd30000c-0000-4000-8000-00000000000b',
  'fd30000c-0000-4000-8000-00000000000c',
  'fd30000c-0000-4000-8000-00000000000d',
  'fd30000c-0000-4000-8000-00000000000f',
  'fd30000c-0000-4000-8000-000000000010'
);
update public.profiles
set museum_id = 'fd30000c-0000-4000-8000-0000000000b1', role = 'empleado', status = 'active'
where id = 'fd30000c-0000-4000-8000-00000000000e';
update public.profiles set role = 'finanzas' where id = 'fd30000c-0000-4000-8000-00000000000b';
update public.profiles set role = 'administrador' where id = 'fd30000c-0000-4000-8000-00000000000c';

insert into public.user_roles (museum_id, user_id, role_id)
select profile.museum_id, profile.id, role.id
from public.profiles profile
join public.roles role on role.code = profile.role
where profile.id in (
  'fd30000c-0000-4000-8000-00000000000b',
  'fd30000c-0000-4000-8000-00000000000c'
);

insert into public.user_permissions (museum_id, user_id, permission_id, effect)
select profile.museum_id, profile.id, permission.id, 'allow'
from public.profiles profile
cross join public.permissions permission
where profile.id in (
  'fd30000c-0000-4000-8000-000000000004',
  'fd30000c-0000-4000-8000-000000000005',
  'fd30000c-0000-4000-8000-000000000006',
  'fd30000c-0000-4000-8000-000000000007',
  'fd30000c-0000-4000-8000-000000000008',
  'fd30000c-0000-4000-8000-000000000009',
  'fd30000c-0000-4000-8000-00000000000a',
  'fd30000c-0000-4000-8000-00000000000d'
)
and permission.code in ('finance.read', 'finance.write');

insert into public.finance_budget_lines (
  id, museum_id, record_type, category, name, sort_order, counts_in_operating_balance
) values (
  'fd30000c-0000-4000-8000-0000000000c1',
  'fd30000c-0000-4000-8000-0000000000a1',
  'expense', 'Gastos Operacionales', 'Produccion', 1, true
);

alter table public.employees disable trigger protect_employee_module_profile;
insert into public.employees (
  id, museum_id, profile_id, first_name, last_name, position, department, email, status, access_profile
) values
  ('fd30000c-0000-4000-8000-0000000000f1', 'fd30000c-0000-4000-8000-0000000000a1', 'fd30000c-0000-4000-8000-000000000001', 'Director', 'Ejecutivo', 'Director', 'Direccion', 'decide-director@example.invalid', 'activo', 'director_ejecutivo'),
  ('fd30000c-0000-4000-8000-0000000000f2', 'fd30000c-0000-4000-8000-0000000000a1', 'fd30000c-0000-4000-8000-000000000002', 'Gerente', 'Administrativo', 'Gerente', 'Administracion', 'decide-geradmin@example.invalid', 'activo', 'gerente_administrativo'),
  ('fd30000c-0000-4000-8000-0000000000f3', 'fd30000c-0000-4000-8000-0000000000a1', 'fd30000c-0000-4000-8000-000000000003', 'Administrador', 'General', 'Administrador', 'Administracion', 'decide-admingeneral@example.invalid', 'activo', 'administrador_general'),
  ('fd30000c-0000-4000-8000-0000000000f4', 'fd30000c-0000-4000-8000-0000000000a1', 'fd30000c-0000-4000-8000-000000000004', 'Gerente', 'Museografica', 'Gerente', 'Museografia', 'decide-museografica@example.invalid', 'activo', 'gerente_museografica'),
  ('fd30000c-0000-4000-8000-0000000000f5', 'fd30000c-0000-4000-8000-0000000000a1', 'fd30000c-0000-4000-8000-000000000005', 'Asistente', 'Administrativa', 'Asistente', 'Administracion', 'decide-asistente@example.invalid', 'activo', 'asistente_administrativa'),
  ('fd30000c-0000-4000-8000-0000000000f6', 'fd30000c-0000-4000-8000-0000000000a1', 'fd30000c-0000-4000-8000-000000000006', 'Programa', 'Sistema', 'IT', 'Sistemas', 'decide-it@example.invalid', 'activo', 'it_programador'),
  ('fd30000c-0000-4000-8000-0000000000f7', 'fd30000c-0000-4000-8000-0000000000a1', 'fd30000c-0000-4000-8000-000000000007', 'Tecnico', 'Planta', 'Mantenimiento', 'Planta', 'decide-mantenimiento@example.invalid', 'activo', 'mantenimiento'),
  ('fd30000c-0000-4000-8000-0000000000f8', 'fd30000c-0000-4000-8000-0000000000a1', 'fd30000c-0000-4000-8000-000000000008', 'Contenido', 'Marketing', 'Contenido', 'Comunicaciones', 'decide-marketing@example.invalid', 'activo', 'contenido_marketing'),
  ('fd30000c-0000-4000-8000-0000000000f9', 'fd30000c-0000-4000-8000-0000000000a1', 'fd30000c-0000-4000-8000-000000000009', 'Coordina', 'Experiencia', 'Coordinadora', 'Experiencia', 'decide-coordinadora@example.invalid', 'activo', 'coordinadora_experiencia'),
  ('fd30000c-0000-4000-8000-0000000000fa', 'fd30000c-0000-4000-8000-0000000000a1', 'fd30000c-0000-4000-8000-00000000000a', 'Tecnico', 'Produccion', 'Tecnico', 'Produccion', 'decide-tecnico@example.invalid', 'activo', 'tecnico_produccion'),
  ('fd30000c-0000-4000-8000-0000000000fb', 'fd30000c-0000-4000-8000-0000000000a1', 'fd30000c-0000-4000-8000-00000000000b', 'Rol', 'Finanzas', 'Finanzas', 'Finanzas', 'decide-finanzas@example.invalid', 'activo', null),
  ('fd30000c-0000-4000-8000-0000000000fc', 'fd30000c-0000-4000-8000-0000000000a1', 'fd30000c-0000-4000-8000-00000000000c', 'Rol', 'Administrador', 'Administrador', 'Administracion', 'decide-administrador@example.invalid', 'activo', null),
  ('fd30000c-0000-4000-8000-0000000000fd', 'fd30000c-0000-4000-8000-0000000000a1', 'fd30000c-0000-4000-8000-00000000000d', 'Sin', 'Perfil', 'Asistente', 'Administracion', 'decide-null-profile@example.invalid', 'activo', null),
  ('fd30000c-0000-4000-8000-0000000000fe', 'fd30000c-0000-4000-8000-0000000000b1', 'fd30000c-0000-4000-8000-00000000000e', 'Otro', 'Museo', 'Director', 'Direccion', 'decide-other-museum@example.invalid', 'activo', 'director_ejecutivo'),
  ('fd30000c-0000-4000-8000-0000000000ff', 'fd30000c-0000-4000-8000-0000000000a1', 'fd30000c-0000-4000-8000-00000000000f', 'Doble', 'Uno', 'Director', 'Direccion', 'decide-ambiguous@example.invalid', 'activo', 'director_ejecutivo'),
  ('fd30000c-0000-4000-8000-0000000000e1', 'fd30000c-0000-4000-8000-0000000000a1', 'fd30000c-0000-4000-8000-00000000000f', 'Doble', 'Dos', 'Director', 'Direccion', 'decide-ambiguous-2@example.invalid', 'activo', 'director_ejecutivo'),
  ('fd30000c-0000-4000-8000-0000000000e2', 'fd30000c-0000-4000-8000-0000000000a1', 'fd30000c-0000-4000-8000-000000000010', 'Activo', 'Director', 'Director', 'Direccion', 'decide-activo@example.invalid', 'activo', 'director_ejecutivo');
alter table public.employees enable trigger protect_employee_module_profile;

insert into public.finance_documents (
  id, museum_id, status, original_path, original_mime, original_byte_size, original_sha256,
  original_filename, uploaded_by, invoice_date, total, description, budget_line_id
)
select
  document_id,
  'fd30000c-0000-4000-8000-0000000000a1',
  'pending_review',
  'fd30000c-0000-4000-8000-0000000000a1/' || document_id::text || '/original',
  'application/pdf',
  64,
  md5(document_id::text) || md5(document_id::text || '-sha'),
  'factura.pdf',
  'fd30000c-0000-4000-8000-000000000001',
  case when ready then date '2026-10-01' end,
  case when ready then 20.00 end,
  case when ready then 'Servicio listo' end,
  case when ready then 'fd30000c-0000-4000-8000-0000000000c1'::uuid end
from (values
  ('fd30000c-0000-4000-8000-0000000000d1'::uuid, false),
  ('fd30000c-0000-4000-8000-0000000000d2'::uuid, false),
  ('fd30000c-0000-4000-8000-0000000000d3'::uuid, true),
  ('fd30000c-0000-4000-8000-0000000000d4'::uuid, false),
  ('fd30000c-0000-4000-8000-0000000000d5'::uuid, false),
  ('fd30000c-0000-4000-8000-0000000000d6'::uuid, true),
  ('fd30000c-0000-4000-8000-0000000000d7'::uuid, false),
  ('fd30000c-0000-4000-8000-0000000000d8'::uuid, false),
  ('fd30000c-0000-4000-8000-0000000000d9'::uuid, true),
  ('fd30000c-0000-4000-8000-0000000000da'::uuid, false),
  ('fd30000c-0000-4000-8000-0000000000db'::uuid, true)
) as seed(document_id, ready);

insert into storage.objects (bucket_id, name, owner_id, metadata)
select
  'finance-documents',
  'fd30000c-0000-4000-8000-0000000000a1/' || document.id::text || '/original',
  'fd30000c-0000-4000-8000-000000000001',
  jsonb_build_object('mimetype', 'application/pdf', 'size', 64)
from public.finance_documents document
where document.museum_id = 'fd30000c-0000-4000-8000-0000000000a1'
  and document.id::text like 'fd30000c-0000-4000-8000-0000000000d%';

create function pg_temp.act(actor uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.must_raise(statement text, expected text) returns void
language plpgsql as $$
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
end $$;

create function pg_temp.save_review(actor uuid, doc uuid) returns jsonb
language plpgsql as $$
declare result jsonb;
begin
  perform pg_temp.act(actor);
  result := public.update_finance_document_review(
    doc, null, null, null, null, null, null,
    'Proveedor', 'N-1', date '2026-10-01', 10.00, 'Revision guardada',
    'fd30000c-0000-4000-8000-0000000000c1'
  );
  return result;
end $$;

create function pg_temp.reject_one(actor uuid, doc uuid) returns jsonb
language plpgsql as $$
declare result jsonb;
begin
  perform pg_temp.act(actor);
  result := public.reject_finance_document(doc, 'No corresponde');
  return result;
end $$;

create function pg_temp.confirm_one(actor uuid, doc uuid) returns jsonb
language plpgsql as $$
declare result jsonb;
begin
  perform pg_temp.act(actor);
  result := public.confirm_finance_document(doc);
  return result;
end $$;

create function pg_temp.deny_all(actor uuid) returns void
language plpgsql as $$
begin
  perform pg_temp.must_raise(
    format($q$select pg_temp.save_review('%s', 'fd30000c-0000-4000-8000-0000000000da')$q$, actor),
    'Missing financial authorization'
  );
  perform pg_temp.must_raise(
    format($q$select pg_temp.reject_one('%s', 'fd30000c-0000-4000-8000-0000000000da')$q$, actor),
    'Missing financial authorization'
  );
  perform pg_temp.must_raise(
    format($q$select pg_temp.confirm_one('%s', 'fd30000c-0000-4000-8000-0000000000da')$q$, actor),
    'Missing financial authorization'
  );
end $$;

do $$
declare
  baseline finance_document_decide_baseline%rowtype;
  saved jsonb;
  again jsonb;
  posted_id uuid;
  confirm_sha text;
  confirm_storage jsonb;
  reject_sha text;
  reject_storage jsonb;
  status_name text;
  status_def text;
begin
  select * into baseline from finance_document_decide_baseline;
  if baseline.museografica_modules is null
     or 'administration' = any (baseline.museografica_modules) then
    raise exception 'MUSEOGRAFICA_MODULES %', baseline.museografica_modules;
  end if;
  if position('gerente_museografica' in pg_get_functiondef('public.finance_document_can_decide()'::regprocedure)) > 0
     or position('director_ejecutivo' in pg_get_functiondef('public.finance_document_can_decide()'::regprocedure)) = 0
     or position('gerente_administrativo' in pg_get_functiondef('public.finance_document_can_decide()'::regprocedure)) = 0
     or position('administrador_general' in pg_get_functiondef('public.finance_document_can_decide()'::regprocedure)) = 0 then
    raise exception 'HELPER_LIST';
  end if;

  select original_sha256 into confirm_sha from public.finance_documents where id = 'fd30000c-0000-4000-8000-0000000000d3';
  select to_jsonb(object) - 'id' into confirm_storage from storage.objects object
  where bucket_id = 'finance-documents'
    and name = 'fd30000c-0000-4000-8000-0000000000a1/fd30000c-0000-4000-8000-0000000000d3/original';
  select original_sha256 into reject_sha from public.finance_documents where id = 'fd30000c-0000-4000-8000-0000000000d2';
  select to_jsonb(object) - 'id' into reject_storage from storage.objects object
  where bucket_id = 'finance-documents'
    and name = 'fd30000c-0000-4000-8000-0000000000a1/fd30000c-0000-4000-8000-0000000000d2/original';

  saved := pg_temp.save_review('fd30000c-0000-4000-8000-000000000001', 'fd30000c-0000-4000-8000-0000000000d1');
  if saved->>'changed' is distinct from 'true' or saved->>'status' is distinct from 'pending_review' then
    raise exception 'DIRECTOR_SAVE %', saved;
  end if;
  saved := pg_temp.reject_one('fd30000c-0000-4000-8000-000000000001', 'fd30000c-0000-4000-8000-0000000000d2');
  if saved->>'status' is distinct from 'rejected'
     or (select count(*) from public.finance_movements where idempotency_key = 'fd30000c-0000-4000-8000-0000000000d2') <> 0 then
    raise exception 'DIRECTOR_REJECT %', saved;
  end if;
  saved := pg_temp.confirm_one('fd30000c-0000-4000-8000-000000000001', 'fd30000c-0000-4000-8000-0000000000d3');
  again := pg_temp.confirm_one('fd30000c-0000-4000-8000-000000000001', 'fd30000c-0000-4000-8000-0000000000d3');
  posted_id := (saved->>'movement_id')::uuid;
  if saved->>'idempotent' is distinct from 'false'
     or again->>'idempotent' is distinct from 'true'
     or again->>'movement_id' is distinct from saved->>'movement_id'
     or (select count(*) from public.finance_movements where idempotency_key = 'fd30000c-0000-4000-8000-0000000000d3') <> 1
     or (select count(*) from public.finance_documents where finance_documents.movement_id = posted_id) <> 1
     or (select amount from public.finance_movements where id = posted_id) <> 20.00
     or (select created_by from public.finance_movements where id = posted_id) <> 'fd30000c-0000-4000-8000-000000000001'
     or (select count(*) from public.audit_logs where action = 'finance_document_confirm' and record_id = 'fd30000c-0000-4000-8000-0000000000d3') <> 1
     or (select count(*) from public.audit_logs where action = 'finance_movement_post' and record_id = posted_id) <> 1
     or (select count(*) from public.audit_logs where action = 'finance_document_reject' and record_id = 'fd30000c-0000-4000-8000-0000000000d2') <> 1 then
    raise exception 'DIRECTOR_CONFIRM % %', saved, again;
  end if;

  saved := pg_temp.save_review('fd30000c-0000-4000-8000-000000000002', 'fd30000c-0000-4000-8000-0000000000d4');
  if saved->>'status' is distinct from 'pending_review' then raise exception 'GERADMIN_SAVE %', saved; end if;
  saved := pg_temp.reject_one('fd30000c-0000-4000-8000-000000000002', 'fd30000c-0000-4000-8000-0000000000d5');
  if saved->>'status' is distinct from 'rejected'
     or (select count(*) from public.finance_movements where idempotency_key = 'fd30000c-0000-4000-8000-0000000000d5') <> 0 then
    raise exception 'GERADMIN_REJECT %', saved;
  end if;
  saved := pg_temp.confirm_one('fd30000c-0000-4000-8000-000000000002', 'fd30000c-0000-4000-8000-0000000000d6');
  again := pg_temp.confirm_one('fd30000c-0000-4000-8000-000000000002', 'fd30000c-0000-4000-8000-0000000000d6');
  if again->>'movement_id' is distinct from saved->>'movement_id'
     or (select count(*) from public.finance_movements where idempotency_key = 'fd30000c-0000-4000-8000-0000000000d6') <> 1 then
    raise exception 'GERADMIN_CONFIRM % %', saved, again;
  end if;

  saved := pg_temp.save_review('fd30000c-0000-4000-8000-000000000003', 'fd30000c-0000-4000-8000-0000000000d7');
  if saved->>'status' is distinct from 'pending_review' then raise exception 'ADMINGENERAL_SAVE %', saved; end if;
  saved := pg_temp.reject_one('fd30000c-0000-4000-8000-000000000003', 'fd30000c-0000-4000-8000-0000000000d8');
  if saved->>'status' is distinct from 'rejected'
     or (select count(*) from public.finance_movements where idempotency_key = 'fd30000c-0000-4000-8000-0000000000d8') <> 0 then
    raise exception 'ADMINGENERAL_REJECT %', saved;
  end if;
  saved := pg_temp.confirm_one('fd30000c-0000-4000-8000-000000000003', 'fd30000c-0000-4000-8000-0000000000d9');
  again := pg_temp.confirm_one('fd30000c-0000-4000-8000-000000000003', 'fd30000c-0000-4000-8000-0000000000d9');
  if again->>'movement_id' is distinct from saved->>'movement_id'
     or (select count(*) from public.finance_movements where idempotency_key = 'fd30000c-0000-4000-8000-0000000000d9') <> 1 then
    raise exception 'ADMINGENERAL_CONFIRM % %', saved, again;
  end if;

  perform pg_temp.act('fd30000c-0000-4000-8000-000000000004');
  if public.finance_document_can_decide()
     or public.has_permission('finance.read')
     or public.has_permission('finance.write')
     or public.has_permission('modules.administration.read') then
    raise exception 'MUSEOGRAFICA_GAINED_ACCESS';
  end if;
  perform pg_temp.deny_all('fd30000c-0000-4000-8000-000000000004');
  perform pg_temp.deny_all('fd30000c-0000-4000-8000-000000000005');
  perform pg_temp.deny_all('fd30000c-0000-4000-8000-000000000006');
  perform pg_temp.deny_all('fd30000c-0000-4000-8000-000000000007');
  perform pg_temp.deny_all('fd30000c-0000-4000-8000-000000000008');
  perform pg_temp.deny_all('fd30000c-0000-4000-8000-000000000009');
  perform pg_temp.deny_all('fd30000c-0000-4000-8000-00000000000a');

  perform pg_temp.act('fd30000c-0000-4000-8000-00000000000b');
  if public.finance_document_can_decide() or not public.has_permission('finance.write') then
    raise exception 'FINANZAS_ROLE';
  end if;
  perform pg_temp.deny_all('fd30000c-0000-4000-8000-00000000000b');

  perform pg_temp.act('fd30000c-0000-4000-8000-00000000000c');
  if public.finance_document_can_decide() or not public.has_permission('finance.write') then
    raise exception 'ADMINISTRADOR_ROLE';
  end if;
  perform pg_temp.deny_all('fd30000c-0000-4000-8000-00000000000c');

  perform pg_temp.act('fd30000c-0000-4000-8000-00000000000d');
  if public.finance_document_can_decide() or not public.has_permission('finance.write') then
    raise exception 'NULL_PROFILE';
  end if;
  perform pg_temp.deny_all('fd30000c-0000-4000-8000-00000000000d');

  perform pg_temp.act('fd30000c-0000-4000-8000-00000000000f');
  if public.finance_document_can_decide() then
    raise exception 'AMBIGUOUS_EMPLOYEE';
  end if;

  perform pg_temp.must_raise(
    $q$select pg_temp.confirm_one('fd30000c-0000-4000-8000-00000000000e', 'fd30000c-0000-4000-8000-0000000000db')$q$,
    'Finance document not found'
  );
  if (select status from public.finance_documents where id = 'fd30000c-0000-4000-8000-0000000000db') is distinct from 'pending_review'
     or (select status from public.finance_documents where id = 'fd30000c-0000-4000-8000-0000000000da') is distinct from 'pending_review'
     or (select description from public.finance_documents where id = 'fd30000c-0000-4000-8000-0000000000da') is not null then
    raise exception 'DENIAL_MUTATED';
  end if;

  if (select original_sha256 from public.finance_documents where id = 'fd30000c-0000-4000-8000-0000000000d3') is distinct from confirm_sha
     or (select original_sha256 from public.finance_documents where id = 'fd30000c-0000-4000-8000-0000000000d2') is distinct from reject_sha
     or (select to_jsonb(object) - 'id' from storage.objects object
          where bucket_id = 'finance-documents'
            and name = 'fd30000c-0000-4000-8000-0000000000a1/fd30000c-0000-4000-8000-0000000000d3/original')
        is distinct from confirm_storage
     or (select to_jsonb(object) - 'id' from storage.objects object
          where bucket_id = 'finance-documents'
            and name = 'fd30000c-0000-4000-8000-0000000000a1/fd30000c-0000-4000-8000-0000000000d2/original')
        is distinct from reject_storage then
    raise exception 'ORIGINAL_TOUCHED';
  end if;

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
  update public.profiles set status = 'activo' where id = 'fd30000c-0000-4000-8000-000000000010';
  alter table public.profiles enable trigger profiles_protect_security;
  perform pg_temp.act('fd30000c-0000-4000-8000-000000000010');
  if not public.finance_document_can_decide() then
    raise exception 'ACTIVO_DENIED';
  end if;
  alter table public.profiles disable trigger profiles_protect_security;
  update public.profiles set status = 'active' where id = 'fd30000c-0000-4000-8000-000000000010';
  alter table public.profiles enable trigger profiles_protect_security;
  execute format('alter table public.profiles add constraint %I ', status_name) || status_def;

  if (select count(*) from public.finance_records) is distinct from baseline.record_rows
     or (select coalesce(sum(amount), 0) from public.finance_records) is distinct from baseline.record_sum
     or (select count(*) from public.finance_budget_lines where museum_id not in (
          'fd30000c-0000-4000-8000-0000000000a1',
          'fd30000c-0000-4000-8000-0000000000b1'
        )) is distinct from baseline.line_rows
     or (select count(*) from public.finance_budget_lines where category = 'Nómina') is distinct from baseline.nomina_rows
     or (select count(*) from public.finance_movements where museum_id not in (
          'fd30000c-0000-4000-8000-0000000000a1',
          'fd30000c-0000-4000-8000-0000000000b1'
        )) is distinct from baseline.movement_rows
     or (select count(*) from public.finance_documents where museum_id not in (
          'fd30000c-0000-4000-8000-0000000000a1',
          'fd30000c-0000-4000-8000-0000000000b1'
        )) is distinct from baseline.document_rows
     or (select count(*) from storage.objects where bucket_id = 'finance-documents' and name not like 'fd30000c-0000-4000-8000-0000000000a1/%') is distinct from baseline.object_rows
     or (select count(*) from public.inventory_items) is distinct from baseline.inventory_rows
     or (select count(*) from public.employee_compensation) is distinct from baseline.compensation_rows
     or (select count(*) from public.employee_budget_assignments) is distinct from baseline.assignment_rows
     or (select modules from public.employee_module_profiles where code = 'gerente_museografica') is distinct from baseline.museografica_modules
     or md5(pg_get_functiondef('public.has_permission(text)'::regprocedure)) is distinct from baseline.permission_hash
     or md5(pg_get_functiondef('public.post_finance_movement(uuid,date,numeric,text,uuid)'::regprocedure)) is distinct from baseline.post_hash
     or md5(pg_get_functiondef('public.void_finance_movement(uuid,text)'::regprocedure)) is distinct from baseline.void_hash
     or md5(pg_get_functiondef('public.correct_finance_movement(uuid,text,uuid,date,numeric,text,uuid)'::regprocedure)) is distinct from baseline.correct_hash
     or md5(pg_get_functiondef('public.payroll_actual(date,date)'::regprocedure)) is distinct from baseline.payroll_hash
     or md5(pg_get_functiondef('public.finance_documents_guard()'::regprocedure)) is distinct from baseline.guard_hash
     or md5(pg_get_functiondef('public.finance_movements_guard()'::regprocedure)) is distinct from baseline.movement_guard_hash
     or md5(pg_get_functiondef('public.finance_movement_require_museum()'::regprocedure)) is distinct from baseline.require_hash then
    raise exception 'BASELINE_TOUCHED';
  end if;
end
$$;

select 'FINANCE_DOCUMENT_DECIDE_PASS' as result;

rollback;
