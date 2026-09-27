-- Read-only. Run against production before applying 202609280004.
-- Aborts when the approved empty chart has drifted. Does not update anything.
-- Do not run this file on staging: that database is not the production chart.

do $precheck$
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
  v_column boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'finance_records' and column_name = 'budget_line_id'
  ) into v_column;
  if v_column then
    raise exception 'ALREADY_MIGRATED';
  end if;
  select count(*) into v_cells
  from public.finance_records r
  join public.museums m on m.id = r.museum_id
  where m.slug = 'museo-musica-pr';
  select count(distinct r.record_type || '|' || r.category || '|' || r.concept),
         count(*) filter (where r.amount <> 0),
         count(distinct r.year), min(r.year), count(distinct r.month),
         count(*) filter (where r.record_type = 'expense' and r.category = 'Nómina' and r.concept = 'Director'),
         count(*) filter (where r.record_type = 'expense' and r.category = 'Nómina' and r.concept = 'Artegrafiko'),
         coalesce(sum(r.amount), 0)
    into v_lines, v_nonzero, v_years, v_year, v_months, v_director, v_arte, v_sum
  from public.finance_records r
  join public.museums m on m.id = r.museum_id
  where m.slug = 'museo-musica-pr';
  select count(distinct museum_id) into v_museums from public.finance_records;
  if v_cells <> 672 or v_lines <> 56 or v_nonzero <> 0 or v_years <> 1 or v_year <> 2026
     or v_months <> 12 or v_director <> 12 or v_arte <> 12 or v_sum <> 0 or v_museums <> 1 then
    raise exception 'SNAPSHOT_MISMATCH cells=% lines=% nonzero=% year=% months=% director=% arte=% sum=% museums=%',
      v_cells, v_lines, v_nonzero, v_year, v_months, v_director, v_arte, v_sum, v_museums;
  end if;
end
$precheck$;

select 'PRODUCTION_SNAPSHOT_OK' as result,
       count(*) as cells
from public.finance_records r
join public.museums m on m.id = r.museum_id
where m.slug = 'museo-musica-pr';
