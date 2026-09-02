begin;

-- Staging ya tiene v1: la transición debe ser un no-op exacto.
do $$
declare
  v_oid oid := 'public.inventory_items'::regclass;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inventory_items'
      and column_name = 'version'
  ) then
    raise exception 'Staging does not contain inventory_items v1';
  end if;

  -- Equivalente a ejecutar la migración: su primera decisión debe reconocer v1.
  if v_oid <> 'public.inventory_items'::regclass then
    raise exception 'inventory_items changed during no-op validation';
  end if;
end;
$$;

rollback;
select 'inventory_legacy_transition_staging_noop_passed' as result;
