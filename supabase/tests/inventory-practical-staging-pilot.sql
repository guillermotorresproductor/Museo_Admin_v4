-- Ejecutar únicamente en Staging después de aplicar 202609020003.
-- Los cinco objetos deben sustituirse por filas verificadas del Excel fuente.
-- La transacción revierte toda la prueba y no carga fotografías.
begin;

create temporary table inventory_practical_pilot (
  ordinal integer primary key,
  record_type text not null,
  quantity integer not null,
  asset_tag text not null,
  serial_number text,
  name text not null,
  location text not null
) on commit drop;

-- Guardia intencional: nunca ejecutar con datos de ejemplo o sin cinco filas fuente.
do $$
begin
  if (select count(*) from inventory_practical_pilot) <> 5 then
    raise exception 'PILOT_SOURCE_REQUIRED: load exactly 3 individual and 2 lot rows verified from the workbook';
  end if;
end;
$$;

do $$
declare
  v_duplicates integer;
begin
  select count(*) into v_duplicates
  from (
    select lower(asset_tag) from inventory_practical_pilot group by lower(asset_tag) having count(*) > 1
    union all
    select lower(serial_number) from inventory_practical_pilot where serial_number is not null
    group by lower(serial_number) having count(*) > 1
  ) duplicates;
  if v_duplicates <> 0 then raise exception 'PILOT_DUPLICATE: duplicate seal or serial in source'; end if;

  if (select count(*) from inventory_practical_pilot where record_type = 'individual' and quantity = 1) <> 3
     or (select count(*) from inventory_practical_pilot where record_type = 'lot' and quantity >= 1) <> 2 then
    raise exception 'PILOT_DISTRIBUTION_MISMATCH: expected 3 individual and 2 lot records';
  end if;
end;
$$;

-- La carga y las verificaciones RPC/RLS/auditoría se habilitan solamente después
-- de poblar la tabla temporal desde el Excel validado. No hay operación de fotos.
rollback;
