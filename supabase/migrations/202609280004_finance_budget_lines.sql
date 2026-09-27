-- Fiscal start is per museum. Budget line identity is canonical.
-- finance_records.category, concept and record_type stay as a denormalized
-- copy kept equal to the line by trigger. They are not a second authority.
-- This migration does not change amounts, cell ids, months or the fiscal label year.
-- A system audit uses a null actor column. It does not invent a person.

begin;

do $actor$
declare
  v_name text;
  v_notnull boolean;
begin
  select a.attname, a.attnotnull into v_name, v_notnull
  from pg_attribute a
  where a.attrelid = 'public.audit_logs'::regclass
    and a.attname = 'user_id' and not a.attisdropped;
  if v_name is null then
    select a.attname, a.attnotnull into v_name, v_notnull
    from pg_attribute a
    where a.attrelid = 'public.audit_logs'::regclass
      and a.attname = 'actor_user_id' and not a.attisdropped;
  end if;
  if v_name is null then
    raise exception 'AUDIT_ACTOR_COLUMN_MISSING';
  end if;
  if v_notnull then
    raise exception 'AUDIT_ACTOR_NOT_NULLABLE';
  end if;
end
$actor$;

do $snapshot$
declare
  v_cells integer;
  v_lines integer;
  v_nonzero integer;
  v_years integer;
  v_year integer;
  v_months integer;
  v_director integer;
  v_arte integer;
  v_sum numeric;
  v_museums integer;
  v_linked boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'finance_records' and column_name = 'budget_line_id'
  ) into v_linked;
  if v_linked then
    if not exists (select 1 from public.finance_records where budget_line_id is null)
       and exists (
         select 1 from public.finance_budget_lines l
         join public.museums m on m.id = l.museum_id
         where m.slug = 'museo-musica-pr' and l.category = 'Servicios Contratados' and l.name = 'ArtBiz'
       ) then
      return;
    end if;
  end if;
  select count(*) into v_cells
  from public.finance_records r
  join public.museums m on m.id = r.museum_id
  where m.slug = 'museo-musica-pr';
  if v_cells = 0 then
    return;
  end if;
  select count(distinct r.record_type || '|' || r.category || '|' || r.concept),
         count(*) filter (where r.amount <> 0),
         count(distinct r.year),
         min(r.year),
         count(distinct r.month),
         count(*) filter (where r.record_type = 'expense' and r.category = 'Nómina' and r.concept = 'Director'),
         count(*) filter (where r.record_type = 'expense' and r.category = 'Nómina' and r.concept = 'Artegrafiko'),
         coalesce(sum(r.amount), 0)
    into v_lines, v_nonzero, v_years, v_year, v_months, v_director, v_arte, v_sum
  from public.finance_records r
  join public.museums m on m.id = r.museum_id
  where m.slug = 'museo-musica-pr';
  select count(distinct museum_id) into v_museums from public.finance_records;
  if v_cells = 672 or v_nonzero = 0 then
    if v_cells <> 672 or v_lines <> 56 or v_nonzero <> 0 or v_years <> 1 or v_year <> 2026
       or v_months <> 12 or v_director <> 12 or v_arte <> 12 or v_sum <> 0 or v_museums <> 1 then
      raise exception 'SNAPSHOT_MISMATCH';
    end if;
  end if;
end
$snapshot$;

do $duplicates$
begin
  if exists (
    select 1 from public.finance_records
    group by museum_id, record_type, category, concept, month, year
    having count(*) > 1
  ) then
    raise exception 'DUPLICATE_BUDGET_CELLS';
  end if;
end
$duplicates$;

alter table public.museums
  add column if not exists fiscal_year_start_month smallint;

do $check$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'museums_fiscal_year_start_month_check'
      and conrelid = 'public.museums'::regclass
  ) then
    alter table public.museums
      add constraint museums_fiscal_year_start_month_check
      check (fiscal_year_start_month between 1 and 12);
  end if;
end
$check$;

update public.museums
set fiscal_year_start_month = 9
where slug = 'museo-musica-pr'
  and fiscal_year_start_month is null;

create table if not exists public.finance_budget_lines (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete cascade,
  record_type text not null check (record_type in ('income', 'expense')),
  category text not null,
  name text not null,
  sort_order integer not null default 0,
  counts_in_operating_balance boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (museum_id, record_type, category, name)
);

create index if not exists finance_budget_lines_museum_idx
  on public.finance_budget_lines (museum_id);

alter table public.finance_records
  add column if not exists budget_line_id uuid;

do $fk$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'finance_records_budget_line_id_fkey'
      and conrelid = 'public.finance_records'::regclass
  ) then
    alter table public.finance_records
      add constraint finance_records_budget_line_id_fkey
      foreign key (budget_line_id) references public.finance_budget_lines(id);
  end if;
end
$fk$;

comment on column public.finance_records.budget_line_id is
  'Canonical budget line. category, concept and record_type on this row are a denormalized copy.';
comment on column public.finance_records.category is
  'Legacy denormalized copy of finance_budget_lines.category. The line is the authority.';
comment on column public.finance_records.concept is
  'Legacy denormalized copy of finance_budget_lines.name. The line is the authority.';
comment on column public.finance_records.record_type is
  'Legacy denormalized copy of finance_budget_lines.record_type. The line is the authority.';
comment on column public.finance_budget_lines.counts_in_operating_balance is
  'When false, the line stays out of the operating balance even if it is renamed.';

create or replace function public.finance_records_copy_budget_line()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  line public.finance_budget_lines;
begin
  if new.budget_line_id is null then
    raise exception 'budget_line_id required' using errcode = '23502';
  end if;
  select * into line from public.finance_budget_lines where id = new.budget_line_id;
  if not found or line.museum_id is distinct from new.museum_id then
    raise exception 'budget line museum mismatch' using errcode = '23514';
  end if;
  new.record_type := line.record_type;
  new.category := line.category;
  new.concept := line.name;
  return new;
end
$$;

drop trigger if exists finance_records_copy_budget_line on public.finance_records;
create trigger finance_records_copy_budget_line
  before insert or update on public.finance_records
  for each row execute function public.finance_records_copy_budget_line();

create or replace function public.finance_budget_lines_sync_records()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.finance_records
  set record_type = new.record_type,
      category = new.category,
      concept = new.name
  where budget_line_id = new.id
    and (record_type is distinct from new.record_type
      or category is distinct from new.category
      or concept is distinct from new.name);
  return new;
end
$$;

drop trigger if exists finance_budget_lines_sync_records on public.finance_budget_lines;
create trigger finance_budget_lines_sync_records
  after update of record_type, category, name on public.finance_budget_lines
  for each row execute function public.finance_budget_lines_sync_records();

create or replace function public.finance_budget_lines_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists finance_budget_lines_touch_updated_at on public.finance_budget_lines;
create trigger finance_budget_lines_touch_updated_at
  before update on public.finance_budget_lines
  for each row execute function public.finance_budget_lines_touch_updated_at();

create or replace function public.finance_refresh_budget_line_order(p_museum_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.finance_budget_lines line
  set sort_order = ranked.n
  from (
    select id,
           row_number() over (
             partition by museum_id
             order by case category
                        when 'Entradas al Museo' then 1
                        when 'Ingresos' then 2
                        when 'Gastos Operacionales' then 3
                        when 'Servicios Contratados' then 4
                        when 'Nómina' then 5
                        when 'Beneficios' then 6
                        when 'Otros Gastos' then 7
                        else 9
                      end,
                      regexp_replace(name, '[0-9]+', lpad(coalesce(substring(name from '[0-9]+'), ''), 3, '0'), 'g'),
                      name
           ) as n
    from public.finance_budget_lines
    where museum_id = p_museum_id
  ) ranked
  where line.id = ranked.id
    and line.sort_order is distinct from ranked.n;
end
$$;

create or replace function public.finance_attach_budget_lines(p_museum_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.finance_budget_lines (
    museum_id, record_type, category, name, sort_order, counts_in_operating_balance
  )
  select p_museum_id,
         r.record_type,
         r.category,
         r.concept,
         0,
         not (r.record_type = 'expense' and r.category = 'Otros Gastos' and r.concept in ('Contingencia', 'Ahorros'))
  from public.finance_records r
  where r.museum_id = p_museum_id
    and r.budget_line_id is null
  group by r.record_type, r.category, r.concept;

  update public.finance_records record
  set budget_line_id = line.id
  from public.finance_budget_lines line
  where record.museum_id = p_museum_id
    and record.budget_line_id is null
    and line.museum_id = record.museum_id
    and line.record_type = record.record_type
    and line.category = record.category
    and line.name = record.concept;

  perform public.finance_refresh_budget_line_order(p_museum_id);
end
$$;

create or replace function public.finance_reclassify_contracted_services(p_museum_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
  v_actor text;
  v_notnull boolean;
  v_count integer;
  v_audited integer := 0;
begin
  select slug into v_slug from public.museums where id = p_museum_id;
  if v_slug is distinct from 'museo-musica-pr' then
    raise exception 'RECLASSIFY_MUSEUM_NOT_APPROVED';
  end if;

  select a.attname, a.attnotnull into v_actor, v_notnull
  from pg_attribute a
  where a.attrelid = 'public.audit_logs'::regclass
    and a.attname = 'user_id' and not a.attisdropped;
  if v_actor is null then
    select a.attname, a.attnotnull into v_actor, v_notnull
    from pg_attribute a
    where a.attrelid = 'public.audit_logs'::regclass
      and a.attname = 'actor_user_id' and not a.attisdropped;
  end if;
  if v_actor is null then
    raise exception 'AUDIT_ACTOR_COLUMN_MISSING';
  end if;
  if v_notnull then
    raise exception 'AUDIT_ACTOR_NOT_NULLABLE';
  end if;

  create temp table if not exists finance_reclass_before (
    id uuid, museum_id uuid, record_type text, category text, concept text,
    month text, year integer, amount numeric, budget_line_id uuid
  ) on commit drop;
  truncate pg_temp.finance_reclass_before;

  insert into pg_temp.finance_reclass_before
  select r.id, r.museum_id, r.record_type, r.category, r.concept, r.month, r.year, r.amount, r.budget_line_id
  from public.finance_records r
  join public.finance_budget_lines l on l.id = r.budget_line_id
  where l.museum_id = p_museum_id
    and l.record_type = 'expense'
    and l.category = 'Nómina'
    and l.name in ('Director', 'Artegrafiko');

  select count(*) into v_count from pg_temp.finance_reclass_before;
  if v_count = 0 then
    return 0;
  end if;
  if v_count <> 24
     or (select count(*) from pg_temp.finance_reclass_before where concept = 'Director') <> 12
     or (select count(*) from pg_temp.finance_reclass_before where concept = 'Artegrafiko') <> 12
     or (select count(*) from public.finance_budget_lines where museum_id = p_museum_id and record_type = 'expense' and category = 'Nómina' and name = 'Director') <> 1
     or (select count(*) from public.finance_budget_lines where museum_id = p_museum_id and record_type = 'expense' and category = 'Nómina' and name = 'Artegrafiko') <> 1 then
    raise exception 'RECLASSIFY_CELL_COUNT';
  end if;

  update public.finance_budget_lines
  set category = 'Servicios Contratados', name = 'ArtBiz'
  where museum_id = p_museum_id
    and record_type = 'expense'
    and category = 'Nómina'
    and name = 'Director';
  if not found then
    raise exception 'RECLASSIFY_DIRECTOR_MISSING';
  end if;

  update public.finance_budget_lines
  set category = 'Servicios Contratados', name = 'ArteGrafiko'
  where museum_id = p_museum_id
    and record_type = 'expense'
    and category = 'Nómina'
    and name = 'Artegrafiko';
  if not found then
    raise exception 'RECLASSIFY_ARTEGRAFIKO_MISSING';
  end if;

  execute format(
    'insert into public.audit_logs (museum_id, %I, action, table_name, record_id, old_value, new_value)
     select b.museum_id, null, ''finance_budget_line_reclassify'', ''finance_records'', b.id,
            jsonb_build_object(''record_type'', b.record_type, ''category'', b.category, ''concept'', b.concept, ''month'', b.month, ''year'', b.year, ''amount'', b.amount),
            jsonb_build_object(''actor'', ''system_migration'', ''migration'', ''202609280004_finance_budget_lines'', ''record_type'', r.record_type, ''category'', r.category, ''concept'', r.concept, ''month'', r.month, ''year'', r.year, ''amount'', r.amount)
     from pg_temp.finance_reclass_before b
     join public.finance_records r on r.id = b.id
     where r.amount is not distinct from b.amount
       and r.month is not distinct from b.month
       and r.year is not distinct from b.year
       and r.id is not distinct from b.id',
    v_actor
  );
  get diagnostics v_audited = row_count;
  if v_audited <> 24 then
    raise exception 'RECLASSIFY_AUDIT_COUNT';
  end if;

  perform public.finance_refresh_budget_line_order(p_museum_id);
  return v_audited;
end
$$;

do $backfill$
declare
  v_museum uuid;
  v_orphan integer;
begin
  for v_museum in
    select distinct museum_id from public.finance_records where budget_line_id is null
  loop
    perform public.finance_attach_budget_lines(v_museum);
  end loop;

  select id into v_museum from public.museums where slug = 'museo-musica-pr';
  if v_museum is not null then
    perform public.finance_reclassify_contracted_services(v_museum);
  end if;

  select count(*) into v_orphan from public.finance_records where budget_line_id is null;
  if v_orphan <> 0 then
    raise exception 'ORPHAN_BUDGET_CELLS';
  end if;
end
$backfill$;

alter table public.finance_records
  alter column budget_line_id set not null;

create unique index if not exists finance_records_line_period_idx
  on public.finance_records (museum_id, budget_line_id, month, year);

alter table public.finance_budget_lines enable row level security;

drop policy if exists finance_budget_lines_read on public.finance_budget_lines;
create policy finance_budget_lines_read on public.finance_budget_lines
  for select to authenticated
  using (museum_id = public.current_user_museum_id() and public.has_permission('finance.read'));

drop policy if exists finance_budget_lines_explicit_read on public.finance_budget_lines;
create policy finance_budget_lines_explicit_read on public.finance_budget_lines
  as restrictive for select to authenticated
  using (museum_id = public.current_user_museum_id() and public.has_permission('finance.read'));

drop policy if exists finance_budget_lines_module_boundary on public.finance_budget_lines;
create policy finance_budget_lines_module_boundary on public.finance_budget_lines
  as restrictive for select to authenticated
  using (public.module_profile_allows('administration'));

revoke all on public.finance_budget_lines from anon;
revoke insert, update, delete, truncate, references, trigger on public.finance_budget_lines from authenticated;
grant select on public.finance_budget_lines to authenticated;

revoke all on function public.finance_records_copy_budget_line() from public, anon, authenticated;
revoke all on function public.finance_budget_lines_sync_records() from public, anon, authenticated;
revoke all on function public.finance_budget_lines_touch_updated_at() from public, anon, authenticated;
revoke all on function public.finance_refresh_budget_line_order(uuid) from public, anon, authenticated;
revoke all on function public.finance_attach_budget_lines(uuid) from public, anon, authenticated;
revoke all on function public.finance_reclassify_contracted_services(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
