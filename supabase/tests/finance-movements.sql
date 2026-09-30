-- Rolls back. Does not keep museums, users, budget rows, or movements.
begin;

select set_config('request.jwt.claim.role', 'service_role', true);

create temporary table finance_movement_guard (
  real_cells bigint,
  real_sum numeric,
  real_hash text,
  assignments bigint,
  payroll_hash text
);

insert into finance_movement_guard
select
  (select count(*) from public.finance_records r join public.museums m on m.id = r.museum_id where m.slug = 'museo-musica-pr'),
  (select coalesce(sum(r.amount), 0) from public.finance_records r join public.museums m on m.id = r.museum_id where m.slug = 'museo-musica-pr'),
  (select md5(string_agg(r.id::text || ':' || r.amount::text, ',' order by r.id)) from public.finance_records r join public.museums m on m.id = r.museum_id where m.slug = 'museo-musica-pr'),
  (select count(*) from public.employee_budget_assignments),
  (select md5(pg_get_functiondef('public.payroll_actual(date,date)'::regprocedure)));

insert into public.museums (id, name, slug, fiscal_year_start_month)
values
  ('f2d00000-0000-4000-8000-0000000000a1', 'TEST MOVEMENT A', 'test-movement-a', 9),
  ('f2d00000-0000-4000-8000-0000000000b1', 'TEST MOVEMENT B', 'test-movement-b', 1);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('f2d00000-0000-4000-8000-0000000000a2', 'movement-writer-a@example.invalid', '{}'),
  ('f2d00000-0000-4000-8000-0000000000b2', 'movement-writer-b@example.invalid', '{}'),
  ('f2d00000-0000-4000-8000-0000000000a3', 'movement-reader-a@example.invalid', '{}'),
  ('f2d00000-0000-4000-8000-0000000000a4', 'movement-limited-a@example.invalid', '{}');

update public.profiles
set museum_id = 'f2d00000-0000-4000-8000-0000000000a1'
where id in (
  'f2d00000-0000-4000-8000-0000000000a2',
  'f2d00000-0000-4000-8000-0000000000a3',
  'f2d00000-0000-4000-8000-0000000000a4'
);
update public.profiles
set museum_id = 'f2d00000-0000-4000-8000-0000000000b1'
where id = 'f2d00000-0000-4000-8000-0000000000b2';

insert into public.user_permissions (museum_id, user_id, permission_id, effect)
select pr.museum_id, pr.id, p.id, 'allow'
from public.profiles pr
cross join public.permissions p
where (
    pr.id in (
      'f2d00000-0000-4000-8000-0000000000b2',
      'f2d00000-0000-4000-8000-0000000000a4'
    )
    and p.code in ('finance.read', 'finance.write')
  ) or (
    pr.id = 'f2d00000-0000-4000-8000-0000000000a2'
    and p.code in ('finance.read', 'finance.write', 'audit.read')
  );

insert into public.user_permissions (museum_id, user_id, permission_id, effect)
select pr.museum_id, pr.id, p.id, 'allow'
from public.profiles pr
cross join public.permissions p
where pr.id = 'f2d00000-0000-4000-8000-0000000000a3'
  and p.code = 'finance.read';

insert into public.finance_budget_lines (
  id, museum_id, record_type, category, name, sort_order, counts_in_operating_balance
) values
  ('f2d00000-0000-4000-8000-0000000000a5', 'f2d00000-0000-4000-8000-0000000000a1', 'expense', 'Nómina', 'Plaza prueba', 1, true),
  ('f2d00000-0000-4000-8000-0000000000a6', 'f2d00000-0000-4000-8000-0000000000a1', 'expense', 'Otros Gastos', 'Contingencia', 2, false),
  ('f2d00000-0000-4000-8000-0000000000b5', 'f2d00000-0000-4000-8000-0000000000b1', 'expense', 'Nómina', 'Plaza ajena', 1, true);

insert into public.finance_records (
  museum_id, budget_line_id, record_type, category, concept, month, year, amount
) values (
  'f2d00000-0000-4000-8000-0000000000a1',
  'f2d00000-0000-4000-8000-0000000000a5',
  'expense', 'Nómina', 'Plaza prueba', 'Septiembre', 2026, 10.00
);

alter table public.employees disable trigger protect_employee_module_profile;
insert into public.employees (
  id, museum_id, profile_id, first_name, last_name, position, department, email, status, access_profile
) values (
  'f2d00000-0000-4000-8000-0000000000a7',
  'f2d00000-0000-4000-8000-0000000000a1',
  'f2d00000-0000-4000-8000-0000000000a4',
  'Modulo', 'Ajeno', 'Mantenimiento', 'Operaciones',
  'movement-limited-a@example.invalid', 'activo', 'mantenimiento'
);
alter table public.employees enable trigger protect_employee_module_profile;

grant all on finance_movement_guard to authenticated;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'f2d00000-0000-4000-8000-0000000000a2', true);
select set_config('request.jwt.claims', '{"sub":"f2d00000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  posted jsonb;
  replay jsonb;
  voided jsonb;
  again jsonb;
  corrected jsonb;
  replayed jsonb;
  blocked boolean;
  seen integer;
  audits integer;
  void_stamp timestamptz;
  movement_id uuid := 'f2d00000-0000-4000-8000-0000000000c1';
begin
  posted := public.post_finance_movement(
    'f2d00000-0000-4000-8000-0000000000a5',
    date '2026-09-15',
    12.50,
    'Compra de materiales',
    'f2d00000-0000-4000-8000-0000000000c1'
  );
  if posted->>'audit_id' is null
     or (posted->>'amount')::numeric <> 12.50
     or posted->>'created_by' <> 'f2d00000-0000-4000-8000-0000000000a2'
     or posted->>'museum_id' <> 'f2d00000-0000-4000-8000-0000000000a1' then
    raise exception 'POST_CONTRACT';
  end if;
  movement_id := (posted->>'id')::uuid;

  if (select count(*) from public.finance_movements where id = movement_id) <> 1 then
    raise exception 'SAME_MUSEUM_READ';
  end if;

  perform set_config('request.jwt.claim.sub', 'f2d00000-0000-4000-8000-0000000000b2', true);
  perform set_config('request.jwt.claims', '{"sub":"f2d00000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
  if (select count(*) from public.finance_movements where id = movement_id) <> 0 then
    raise exception 'CROSS_MUSEUM_READ';
  end if;
  blocked := false;
  begin
    perform public.post_finance_movement(
      'f2d00000-0000-4000-8000-0000000000a5', date '2026-09-15', 4, 'Ajena', 'f2d00000-0000-4000-8000-0000000000d1'
    );
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked then
    raise exception 'CROSS_MUSEUM_LINE';
  end if;

  perform set_config('request.jwt.claim.sub', 'f2d00000-0000-4000-8000-0000000000a3', true);
  perform set_config('request.jwt.claims', '{"sub":"f2d00000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
  if (select count(*) from public.finance_movements where id = movement_id) <> 1 then
    raise exception 'READER_CANNOT_READ';
  end if;
  blocked := false;
  begin
    perform public.post_finance_movement(
      'f2d00000-0000-4000-8000-0000000000a5', date '2026-09-15', 4, 'Lector', 'f2d00000-0000-4000-8000-0000000000d2'
    );
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked then
    raise exception 'READER_CAN_POST';
  end if;

  perform set_config('request.jwt.claim.sub', 'f2d00000-0000-4000-8000-0000000000a4', true);
  perform set_config('request.jwt.claims', '{"sub":"f2d00000-0000-4000-8000-0000000000a4","role":"authenticated"}', true);
  blocked := false;
  begin
    perform public.post_finance_movement(
      'f2d00000-0000-4000-8000-0000000000a5', date '2026-09-15', 4, 'Modulo', 'f2d00000-0000-4000-8000-0000000000d3'
    );
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked then
    raise exception 'MODULE_BOUNDARY_IGNORED';
  end if;

  perform set_config('request.jwt.claim.sub', 'f2d00000-0000-4000-8000-0000000000a2', true);
  perform set_config('request.jwt.claims', '{"sub":"f2d00000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);

  blocked := false;
  begin
    perform public.post_finance_movement(
      'f2d00000-0000-4000-8000-0000000000a5', date '2026-09-15', 0, 'Cero', 'f2d00000-0000-4000-8000-0000000000d4'
    );
  exception when invalid_parameter_value then
    blocked := true;
  end;
  if not blocked then raise exception 'ZERO_AMOUNT_ALLOWED'; end if;

  blocked := false;
  begin
    perform public.post_finance_movement(
      'f2d00000-0000-4000-8000-0000000000a5', date '2026-09-15', -1, 'Negativo', 'f2d00000-0000-4000-8000-0000000000d5'
    );
  exception when invalid_parameter_value then
    blocked := true;
  end;
  if not blocked then raise exception 'NEGATIVE_AMOUNT_ALLOWED'; end if;

  blocked := false;
  begin
    perform public.post_finance_movement(
      'f2d00000-0000-4000-8000-0000000000a5', date '2026-09-15', 1.001, 'Decimales', 'f2d00000-0000-4000-8000-0000000000d6'
    );
  exception when invalid_parameter_value then
    blocked := true;
  end;
  if not blocked then raise exception 'EXTRA_DECIMALS_ALLOWED'; end if;

  replay := public.post_finance_movement(
    'f2d00000-0000-4000-8000-0000000000a5',
    date '2026-09-15',
    12.50,
    'Compra de materiales',
    'f2d00000-0000-4000-8000-0000000000c1'
  );
  select count(*) into audits
  from public.audit_logs
  where museum_id = 'f2d00000-0000-4000-8000-0000000000a1'
    and action = 'finance_movement_post'
    and record_id = movement_id;
  if replay->>'id' <> movement_id::text or replay->>'audit_id' is not null or audits <> 1 then
    raise exception 'POST_IDEMPOTENCY';
  end if;

  blocked := false;
  begin
    perform public.post_finance_movement(
      'f2d00000-0000-4000-8000-0000000000a5', date '2026-09-16', 12.50, 'Compra de materiales', 'f2d00000-0000-4000-8000-0000000000c1'
    );
  exception when raise_exception then
    blocked := sqlerrm = 'IDEMPOTENCY_CONFLICT';
  end;
  if not blocked or (select occurred_on from public.finance_movements where id = movement_id) <> date '2026-09-15' then
    raise exception 'IDEMPOTENCY_CONFLICT_MUTATED';
  end if;

  blocked := false;
  begin
    perform public.void_finance_movement(movement_id, '   ');
  exception when invalid_parameter_value then
    blocked := true;
  end;
  if not blocked or (select voided_at from public.finance_movements where id = movement_id) is not null then
    raise exception 'BLANK_REASON_ALLOWED';
  end if;

  voided := public.void_finance_movement(movement_id, 'Factura duplicada');
  void_stamp := (voided->>'voided_at')::timestamptz;
  if voided->>'audit_id' is null or voided->>'void_reason' <> 'Factura duplicada' or void_stamp is null then
    raise exception 'VOID_CONTRACT';
  end if;
  again := public.void_finance_movement(movement_id, 'Factura duplicada');
  select count(*) into audits
  from public.audit_logs
  where action = 'finance_movement_void'
    and record_id = movement_id;
  if again->>'void_reason' <> 'Factura duplicada'
     or (again->>'voided_at')::timestamptz <> void_stamp
     or again->>'voided_by' <> voided->>'voided_by'
     or again->>'audit_id' is not null
     or audits <> 1 then
    raise exception 'VOID_RETRY_SAME';
  end if;

  blocked := false;
  begin
    perform public.void_finance_movement(movement_id, 'Importe incorrecto');
  exception when raise_exception then
    blocked := sqlerrm = 'VOID_ALREADY_COMPLETED';
  end;
  if not blocked
     or (select void_reason from public.finance_movements where id = movement_id) <> 'Factura duplicada'
     or (select voided_at from public.finance_movements where id = movement_id) <> void_stamp
     or (select voided_by::text from public.finance_movements where id = movement_id) <> voided->>'voided_by'
     or (
       select count(*)
       from public.audit_logs
       where action = 'finance_movement_void'
         and record_id = movement_id
     ) <> 1 then
    raise exception 'VOID_RETRY_CHANGED';
  end if;

  blocked := false;
  begin
    perform public.correct_finance_movement(
      movement_id, 'No aplica', 'f2d00000-0000-4000-8000-0000000000a5',
      date '2026-09-20', 8, 'Tarde', 'f2d00000-0000-4000-8000-0000000000c9'
    );
  exception when raise_exception then
    blocked := sqlerrm = 'ALREADY_VOIDED';
  end;
  if not blocked then raise exception 'CORRECT_AFTER_VOID'; end if;

  posted := public.post_finance_movement(
    'f2d00000-0000-4000-8000-0000000000a5', date '2026-10-01', 20, 'Original', 'f2d00000-0000-4000-8000-0000000000c2'
  );
  corrected := public.correct_finance_movement(
    (posted->>'id')::uuid,
    'Clasificación equivocada',
    'f2d00000-0000-4000-8000-0000000000a6',
    date '2026-10-02',
    18.75,
    'Corregido',
    'f2d00000-0000-4000-8000-0000000000c3'
  );
  if corrected->>'audit_id' is null
     or (corrected->'voided'->>'void_reason') <> 'Clasificación equivocada'
     or (corrected->'movement'->>'amount')::numeric <> 18.75
     or (corrected->'movement'->>'budget_line_id') <> 'f2d00000-0000-4000-8000-0000000000a6' then
    raise exception 'CORRECT_CONTRACT';
  end if;
  if (select counts_in_operating_balance from public.finance_budget_lines where id = 'f2d00000-0000-4000-8000-0000000000a6') is distinct from false then
    raise exception 'CONTINGENCY_FLAG_CHANGED';
  end if;
  select count(*) into audits
  from public.audit_logs
  where action = 'finance_movement_correct'
    and record_id = (posted->>'id')::uuid
    and new_value->>'movement_id' = corrected->>'movement_id'
    and new_value->>'voided_movement_id' = corrected->>'voided_id';
  if audits <> 1 then raise exception 'CORRECT_AUDIT'; end if;
  if exists (
    select 1 from public.audit_logs
    where record_id in ((posted->>'id')::uuid, (corrected->>'movement_id')::uuid)
      and action in ('finance_movement_post', 'finance_movement_void')
      and record_id = (corrected->>'movement_id')::uuid
  ) then
    raise exception 'CORRECT_REDUNDANT_AUDIT';
  end if;

  replayed := public.correct_finance_movement(
    (posted->>'id')::uuid,
    'Clasificación equivocada',
    'f2d00000-0000-4000-8000-0000000000a6',
    date '2026-10-02',
    18.75,
    'Corregido',
    'f2d00000-0000-4000-8000-0000000000c3'
  );
  select count(*) into audits
  from public.audit_logs
  where action = 'finance_movement_correct'
    and record_id = (posted->>'id')::uuid;
  if replayed->>'audit_id' is not null
     or replayed->>'movement_id' <> corrected->>'movement_id'
     or audits <> 1 then
    raise exception 'CORRECT_IDEMPOTENCY';
  end if;

  perform public.post_finance_movement(
    'f2d00000-0000-4000-8000-0000000000a5', date '2026-11-01', 4, 'Ocupa clave', 'f2d00000-0000-4000-8000-0000000000c4'
  );
  posted := public.post_finance_movement(
    'f2d00000-0000-4000-8000-0000000000a5', date '2026-11-02', 9, 'Sigue vigente', 'f2d00000-0000-4000-8000-0000000000c5'
  );
  blocked := false;
  begin
    perform public.correct_finance_movement(
      (posted->>'id')::uuid, 'Choque', 'f2d00000-0000-4000-8000-0000000000a5',
      date '2026-11-03', 5, 'Otra cosa', 'f2d00000-0000-4000-8000-0000000000c4'
    );
  exception when raise_exception then
    blocked := sqlerrm = 'IDEMPOTENCY_CONFLICT';
  end;
  if not blocked or (select voided_at from public.finance_movements where id = (posted->>'id')::uuid) is not null then
    raise exception 'CORRECT_CONFLICT_VOIDED';
  end if;

  if (select amount from public.finance_records where budget_line_id = 'f2d00000-0000-4000-8000-0000000000a5') <> 10.00 then
    raise exception 'BUDGET_CELL_CHANGED';
  end if;
  select count(*) into seen from public.finance_movements where museum_id = 'f2d00000-0000-4000-8000-0000000000a1';
  if seen <> 5 then
    raise exception 'MOVEMENT_COUNT %', seen;
  end if;
end
$$;

reset role;

do $$
declare
  movement_id uuid;
  blocked boolean;
begin
  select id into movement_id
  from public.finance_movements
  where idempotency_key = 'f2d00000-0000-4000-8000-0000000000c1';

  blocked := false;
  begin
    delete from public.finance_movements where id = movement_id;
  exception when raise_exception then
    blocked := sqlerrm = 'MOVEMENT_DELETE_FORBIDDEN';
  end;
  if not blocked then raise exception 'DELETE_ALLOWED'; end if;

  blocked := false;
  begin
    update public.finance_movements set amount = 99 where id = movement_id;
  exception when raise_exception then
    blocked := sqlerrm = 'MOVEMENT_IMMUTABLE';
  end;
  if not blocked or (select amount from public.finance_movements where id = movement_id) <> 12.50 then
    raise exception 'ECONOMIC_EDIT_ALLOWED';
  end if;

  blocked := false;
  begin
    update public.finance_movements
    set voided_at = null, voided_by = null, void_reason = null
    where id = movement_id;
  exception when raise_exception then
    blocked := sqlerrm = 'MOVEMENT_VOID_IMMUTABLE';
  end;
  if not blocked or (select void_reason from public.finance_movements where id = movement_id) <> 'Factura duplicada' then
    raise exception 'VOID_REVERSED';
  end if;
end
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f2d00000-0000-4000-8000-0000000000a2', true);

do $$
declare
  blocked boolean;
begin
  blocked := false;
  begin
    insert into public.finance_movements (
      museum_id, budget_line_id, occurred_on, amount, description, created_by, idempotency_key
    ) values (
      'f2d00000-0000-4000-8000-0000000000a1',
      'f2d00000-0000-4000-8000-0000000000a5',
      date '2026-09-01', 1, 'Directo', 'f2d00000-0000-4000-8000-0000000000a2',
      'f2d00000-0000-4000-8000-0000000000d7'
    );
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked then raise exception 'DIRECT_INSERT_ALLOWED'; end if;
end
$$;

reset role;

create function pg_temp.fail_correct_audit()
returns trigger
language plpgsql
as $$
begin
  if new.action = 'finance_movement_correct' then
    raise exception 'TEST_AUDIT_FAILURE';
  end if;
  return new;
end
$$;

-- The atomicity probe uses a fresh movement id captured below.
do $$
declare
  posted jsonb;
  blocked boolean;
begin
  perform set_config('request.jwt.claim.sub', 'f2d00000-0000-4000-8000-0000000000a2', true);
  perform set_config('request.jwt.claims', '{"sub":"f2d00000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
  posted := public.post_finance_movement(
    'f2d00000-0000-4000-8000-0000000000a5', date '2026-12-01', 6, 'Auditar falla', 'f2d00000-0000-4000-8000-0000000000c6'
  );
  create temporary table finance_movement_atomic (id uuid);
  insert into finance_movement_atomic values ((posted->>'id')::uuid);
end
$$;

create trigger finance_movement_test_audit
before insert on public.audit_logs
for each row execute function pg_temp.fail_correct_audit();

do $$
declare
  source_id uuid;
  blocked boolean := false;
begin
  select id into source_id from finance_movement_atomic;
  perform set_config('request.jwt.claim.sub', 'f2d00000-0000-4000-8000-0000000000a2', true);
  begin
    perform public.correct_finance_movement(
      source_id, 'Debe revertir', 'f2d00000-0000-4000-8000-0000000000a5',
      date '2026-12-02', 7, 'No debe quedar', 'f2d00000-0000-4000-8000-0000000000c7'
    );
  exception when others then
    if sqlerrm <> 'TEST_AUDIT_FAILURE' then
      raise;
    end if;
    blocked := true;
  end;
  if not blocked
     or (select voided_at from public.finance_movements where id = source_id) is not null
     or exists (
       select 1 from public.finance_movements
       where idempotency_key = 'f2d00000-0000-4000-8000-0000000000c7'
     ) then
    raise exception 'CORRECT_NOT_ATOMIC';
  end if;
end
$$;

drop trigger finance_movement_test_audit on public.audit_logs;

do $$
declare
  guard finance_movement_guard;
begin
  select * into guard from finance_movement_guard;
  if guard.real_cells is distinct from (
       select count(*) from public.finance_records r
       join public.museums m on m.id = r.museum_id
       where m.slug = 'museo-musica-pr'
     )
     or guard.real_sum is distinct from (
       select coalesce(sum(r.amount), 0) from public.finance_records r
       join public.museums m on m.id = r.museum_id
       where m.slug = 'museo-musica-pr'
     )
     or guard.real_hash is distinct from (
       select md5(string_agg(r.id::text || ':' || r.amount::text, ',' order by r.id))
       from public.finance_records r
       join public.museums m on m.id = r.museum_id
       where m.slug = 'museo-musica-pr'
     )
     or guard.assignments is distinct from (select count(*) from public.employee_budget_assignments)
     or guard.payroll_hash is distinct from (select md5(pg_get_functiondef('public.payroll_actual(date,date)'::regprocedure))) then
    raise exception 'REAL_MUSEUM_OR_PAYROLL_TOUCHED';
  end if;
  if has_table_privilege('authenticated', 'public.finance_movements', 'insert')
     or has_table_privilege('authenticated', 'public.finance_movements', 'update')
     or has_table_privilege('authenticated', 'public.finance_movements', 'delete')
     or not has_table_privilege('authenticated', 'public.finance_movements', 'select')
     or has_table_privilege('anon', 'public.finance_movements', 'select') then
    raise exception 'MOVEMENT_GRANTS';
  end if;
end
$$;

select 'FINANCE_MOVEMENTS_PASS' as result;

rollback;
