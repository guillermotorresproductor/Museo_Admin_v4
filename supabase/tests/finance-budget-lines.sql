-- Staging rehearsal. Builds a synthetic chart, proves 2B/2C, then rolls back.
-- Does not keep fixture rows. The final exception is the success signal.

begin;

do $rehearsal$
declare
  v_real uuid;
  v_fixture uuid := 'f2bc0000-0000-4000-8000-0000000000a1';
  v_other uuid := 'f2bc0000-0000-4000-8000-0000000000b1';
  v_months text[] := array['Septiembre','Octubre','Noviembre','Diciembre','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto'];
  v_checksum text;
  v_checksum_after text;
  v_cells integer;
  v_lines integer;
  v_orphans integer;
  v_ids_before integer;
  v_ids_after integer;
  v_amount_before numeric;
  v_amount_after numeric;
  v_director_id uuid;
  v_created timestamptz;
  v_created_after timestamptz;
  v_audits integer;
  v_null_actor integer;
  v_employees integer;
  v_employees_after integer;
  v_blocked boolean;
  n integer;
  v_type text;
  v_category text;
  v_concept text;
  v_balance boolean;
begin
  select id into v_real from public.museums where slug = 'museo-musica-pr';
  if v_real is null then
    raise exception 'REAL_MUSEUM_MISSING';
  end if;
  select md5(string_agg(id::text || '|' || amount::text || '|' || month || '|' || year::text, E'\n' order by id)),
         count(*),
         coalesce(sum(amount), 0)
    into v_checksum, v_cells, v_amount_before
  from public.finance_records
  where museum_id = v_real;
  select count(*) into v_employees from public.employees;

  if (select fiscal_year_start_month from public.museums where id = v_real) <> 9 then
    raise exception 'MMDPR_FISCAL_MONTH';
  end if;

  insert into public.museums (id, name, slug, fiscal_year_start_month)
  values (v_other, 'Otro museo fiscal', 'fiscal-other-2bc', 4);
  if (select fiscal_year_start_month from public.museums where id = v_real) <> 9 then
    raise exception 'OTHER_MUSEUM_CHANGED_MMDPR';
  end if;
  v_blocked := false;
  begin
    update public.museums set fiscal_year_start_month = 0 where id = v_other;
  exception when check_violation then
    v_blocked := true;
  end;
  if not v_blocked or (select fiscal_year_start_month from public.museums where id = v_other) <> 4 then
    raise exception 'FISCAL_MONTH_ZERO_ALLOWED';
  end if;
  v_blocked := false;
  begin
    update public.museums set fiscal_year_start_month = 13 where id = v_other;
  exception when check_violation then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'FISCAL_MONTH_THIRTEEN_ALLOWED';
  end if;
  update public.museums set fiscal_year_start_month = 1 where id = v_other;
  if (select fiscal_year_start_month from public.museums where id = v_other) <> 1
     or (select fiscal_year_start_month from public.museums where id = v_real) <> 9 then
    raise exception 'FISCAL_ISOLATION';
  end if;

  insert into public.museums (id, name, slug) values (v_fixture, 'Fixture presupuesto', 'fixture-presupuesto-2bc');

  alter table public.finance_records disable trigger finance_records_copy_budget_line;
  alter table public.finance_records alter column budget_line_id drop not null;

  for n in 1..56 loop
    if n = 1 then
      v_type := 'expense'; v_category := 'Nómina'; v_concept := 'Director'; v_balance := true;
    elsif n = 2 then
      v_type := 'expense'; v_category := 'Nómina'; v_concept := 'Artegrafiko'; v_balance := true;
    elsif n <= 24 then
      v_type := 'expense'; v_category := 'Nómina'; v_concept := 'Plaza ' || n::text; v_balance := true;
    elsif n <= 28 then
      v_type := 'expense'; v_category := 'Beneficios'; v_concept := 'Beneficio ' || n::text; v_balance := true;
    elsif n <= 39 then
      v_type := 'expense'; v_category := 'Gastos Operacionales'; v_concept := 'Operación ' || n::text; v_balance := true;
    elsif n <= 52 then
      v_type := 'income'; v_category := 'Ingresos'; v_concept := 'Ingreso ' || n::text; v_balance := true;
    elsif n = 53 then
      v_type := 'expense'; v_category := 'Otros Gastos'; v_concept := 'Misceláneos'; v_balance := true;
    elsif n = 54 then
      v_type := 'expense'; v_category := 'Otros Gastos'; v_concept := 'Gastos de representación'; v_balance := true;
    elsif n = 55 then
      v_type := 'expense'; v_category := 'Otros Gastos'; v_concept := 'Contingencia'; v_balance := false;
    else
      v_type := 'expense'; v_category := 'Otros Gastos'; v_concept := 'Ahorros'; v_balance := false;
    end if;
    insert into public.finance_records (museum_id, record_type, category, concept, month, year, amount)
    select v_fixture, v_type, v_category, v_concept, month_name, 2026,
           case when v_concept = 'Director' and month_name = 'Septiembre' then 10.00
                when v_concept = 'Artegrafiko' and month_name = 'Enero' then 4.50
                else 0 end
    from unnest(v_months) as month_name;
  end loop;

  alter table public.finance_records enable trigger finance_records_copy_budget_line;

  select count(*), coalesce(sum(amount), 0) into v_ids_before, v_amount_before
  from public.finance_records where museum_id = v_fixture;
  select id, created_at into v_director_id, v_created
  from public.finance_records
  where museum_id = v_fixture and concept = 'Director' and month = 'Septiembre';

  perform public.finance_attach_budget_lines(v_fixture);

  v_blocked := false;
  begin
    perform public.finance_reclassify_contracted_services(v_fixture);
  exception when others then
    if sqlerrm <> 'RECLASSIFY_MUSEUM_NOT_APPROVED' then
      raise;
    end if;
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'RECLASSIFY_WITHOUT_SLUG';
  end if;
  if exists (
    select 1 from public.finance_budget_lines
    where museum_id = v_fixture and category = 'Servicios Contratados'
  ) then
    raise exception 'OTHER_MUSEUM_RECLASSIFIED';
  end if;

  update public.museums set slug = 'museo-musica-pr-rehearsal-hold' where id = v_real;
  update public.museums set slug = 'museo-musica-pr' where id = v_fixture;
  if public.finance_reclassify_contracted_services(v_fixture) <> 24 then
    raise exception 'RECLASSIFY_AUDIT';
  end if;
  update public.museums set slug = 'fixture-presupuesto-2bc' where id = v_fixture;
  update public.museums set slug = 'museo-musica-pr' where id = v_real;

  select count(*) into v_lines from public.finance_budget_lines where museum_id = v_fixture;
  select count(*) into v_cells from public.finance_records where museum_id = v_fixture;
  select count(*) into v_orphans from public.finance_records where museum_id = v_fixture and budget_line_id is null;
  if v_lines <> 56 or v_cells <> 672 or v_orphans <> 0 then
    raise exception 'LINE_LINK lines=% cells=% orphans=%', v_lines, v_cells, v_orphans;
  end if;
  if exists (
    select 1 from public.finance_records
    where museum_id = v_fixture
    group by budget_line_id
    having count(*) <> 12
  ) then
    raise exception 'CELLS_PER_LINE';
  end if;
  if exists (
    select 1 from public.finance_records
    where museum_id = v_fixture and (year <> 2026 or month <> all (v_months))
  ) then
    raise exception 'PERIOD_CHANGED';
  end if;
  select created_at into v_created_after from public.finance_records where id = v_director_id;
  if v_created_after is distinct from v_created then
    raise exception 'CREATED_AT_CHANGED';
  end if;
  if (select amount from public.finance_records where id = v_director_id) <> 10.00 then
    raise exception 'AMOUNT_CHANGED';
  end if;
  if (select amount from public.finance_records
      where museum_id = v_fixture and concept = 'ArteGrafiko' and month = 'Enero') <> 4.50 then
    raise exception 'ARTE_AMOUNT_CHANGED';
  end if;
  select coalesce(sum(amount), 0) into v_amount_after from public.finance_records where museum_id = v_fixture;
  if v_amount_after <> 14.50 then
    raise exception 'AMOUNT_SUM';
  end if;
  select count(*) into v_ids_after
  from public.finance_records where museum_id = v_fixture and id = v_director_id;
  if v_ids_after <> 1 then
    raise exception 'ID_LOST';
  end if;

  if (select count(*) from public.finance_budget_lines
      where museum_id = v_fixture and category = 'Servicios Contratados' and name = 'ArtBiz' and counts_in_operating_balance) <> 1
     or (select count(*) from public.finance_records
         where museum_id = v_fixture and category = 'Servicios Contratados' and concept = 'ArtBiz') <> 12 then
    raise exception 'ARTBIZ';
  end if;
  if (select count(*) from public.finance_budget_lines
      where museum_id = v_fixture and category = 'Servicios Contratados' and name = 'ArteGrafiko' and counts_in_operating_balance) <> 1
     or (select count(*) from public.finance_records
         where museum_id = v_fixture and category = 'Servicios Contratados' and concept = 'ArteGrafiko') <> 12 then
    raise exception 'ARTEGRAFIKO';
  end if;
  if exists (
    select 1 from public.finance_budget_lines
    where museum_id = v_fixture and category = 'Nómina' and name in ('Director', 'Artegrafiko')
  ) then
    raise exception 'OLD_PAYROLL_LINE';
  end if;
  if exists (
    select 1 from public.finance_budget_lines
    where museum_id = v_fixture and name in ('Guillermo Torres', 'Director Ejecutivo')
  ) then
    raise exception 'PERSON_LINE';
  end if;
  if (select counts_in_operating_balance from public.finance_budget_lines
      where museum_id = v_fixture and name = 'Contingencia') is distinct from false
     or (select counts_in_operating_balance from public.finance_budget_lines
         where museum_id = v_fixture and name = 'Ahorros') is distinct from false then
    raise exception 'RESERVES_IN_BALANCE';
  end if;

  update public.finance_budget_lines
  set name = 'Reserva renombrada'
  where museum_id = v_fixture and name = 'Contingencia';
  if (select counts_in_operating_balance from public.finance_budget_lines
      where museum_id = v_fixture and name = 'Reserva renombrada') is distinct from false
     or (select concept from public.finance_records where budget_line_id = (
           select id from public.finance_budget_lines where museum_id = v_fixture and name = 'Reserva renombrada'
         ) limit 1) is distinct from 'Reserva renombrada' then
    raise exception 'RENAME_DIVERGED';
  end if;

  select count(*) into v_audits
  from public.audit_logs
  where museum_id = v_fixture and action = 'finance_budget_line_reclassify';
  if v_audits <> 24 then
    raise exception 'AUDIT_ROWS %', v_audits;
  end if;
  select count(*) into v_null_actor
  from public.audit_logs
  where museum_id = v_fixture
    and action = 'finance_budget_line_reclassify'
    and coalesce(to_jsonb(audit_logs)->>'user_id', to_jsonb(audit_logs)->>'actor_user_id') is null
    and new_value->>'actor' = 'system_migration'
    and old_value->>'category' = 'Nómina'
    and new_value->>'category' = 'Servicios Contratados';
  if v_null_actor <> 24 then
    raise exception 'AUDIT_ACTOR %', v_null_actor;
  end if;

  if has_table_privilege('authenticated', 'public.finance_budget_lines', 'insert')
     or has_table_privilege('authenticated', 'public.finance_budget_lines', 'update')
     or not has_table_privilege('authenticated', 'public.finance_budget_lines', 'select') then
    raise exception 'LINE_GRANTS';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.finance_budget_lines'::regclass) then
    raise exception 'LINE_RLS';
  end if;

  select md5(string_agg(id::text || '|' || amount::text || '|' || month || '|' || year::text, E'\n' order by id)),
         coalesce(sum(amount), 0)
    into v_checksum_after, v_amount_after
  from public.finance_records
  where museum_id = v_real;
  select count(*) into v_employees_after from public.employees;
  if v_checksum_after is distinct from v_checksum or v_employees_after is distinct from v_employees then
    raise exception 'REAL_MUSEUM_TOUCHED';
  end if;
  if to_regclass('public.finance_movements') is not null then
    raise exception 'MOVEMENTS_CREATED';
  end if;

  raise exception 'REHEARSAL_PASS';
end
$rehearsal$;

rollback;
