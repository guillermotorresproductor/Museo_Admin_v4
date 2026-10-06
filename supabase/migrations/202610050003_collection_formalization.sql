-- Phase 3: pre-signature edits, signatures, formalization, and physical reception.
-- Applying this file does not insert, update, delete, renumber, or rewrite
-- collection_items, collection_photos, collection_history, or storage paths.
-- It does not call an allocator and does not create the next inventory number.
begin;

insert into public.permissions (code, description, sensitivity)
values (
  'collections.sign.director',
  'Firmar un ingreso de colección como Director del Museo',
  'critical'
)
on conflict (code) do update
set description = excluded.description,
    sensitivity = excluded.sensitivity;

do $director_sign$
declare
  src text;
  insertion text := $ins$
 if requested_permission = 'collections.sign.director' then
   if exists (
     select 1 from public.user_permissions u
     join public.permissions p on p.id = u.permission_id
     where u.user_id = auth.uid()
       and u.museum_id = public.current_user_museum_id()
       and p.code = 'collections.sign.director'
       and u.effect = 'allow'
       and (u.valid_until is null or u.valid_until > now())
   ) then
     return true;
   end if;
   return chosen = 'director_ejecutivo';
 end if;
$ins$;
begin
  src := replace(pg_get_functiondef('public.has_permission(text)'::regprocedure), E'\r\n', E'\n');
  if position('collections.sign.director' in src) = 0 then
    if position('if requested_permission = ''modules.'' || target_module || ''.read''' in src) = 0 then
      raise exception 'DIRECTOR_PERMISSION_ANCHOR_MISSING' using errcode = '55000';
    end if;
    src := replace(
      src,
      'if requested_permission = ''modules.'' || target_module || ''.read''',
      insertion || 'if requested_permission = ''modules.'' || target_module || ''.read'''
    );
    execute src;
  end if;
  if position('collections.sign.director' in pg_get_functiondef('public.has_permission(text)'::regprocedure)) = 0
     or position('finance.write' in pg_get_functiondef('public.has_permission(text)'::regprocedure)) = 0 then
    raise exception 'DIRECTOR_PERMISSION_PATCH_FAILED' using errcode = '55000';
  end if;
end
$director_sign$;

alter table public.collection_accessions
  add column if not exists contract_hash text,
  add column if not exists initial_location text,
  add column if not exists received_at timestamptz,
  add column if not exists received_by uuid,
  add column if not exists reception_notes text;

alter table public.collection_accession_signatures
  add column if not exists signature_type text not null default 'contractual',
  add column if not exists content_hash text;

do $phase3_constraints$
declare
  cname text;
begin
  if not exists (select 1 from pg_constraint where conname = 'collection_accessions_received_by_fkey') then
    alter table public.collection_accessions
      add constraint collection_accessions_received_by_fkey
      foreign key (received_by) references public.profiles(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'collection_accessions_contract_hash_check') then
    alter table public.collection_accessions
      add constraint collection_accessions_contract_hash_check
      check (contract_hash is null or contract_hash ~ '^[0-9a-f]{64}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'collection_accessions_contract_hash_pair_check') then
    alter table public.collection_accessions
      add constraint collection_accessions_contract_hash_pair_check
      check (
        (contract_snapshot is null and contract_hash is null)
        or (contract_snapshot is not null and contract_hash is not null)
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'collection_accessions_initial_location_check') then
    alter table public.collection_accessions
      add constraint collection_accessions_initial_location_check
      check (initial_location is null or length(btrim(initial_location)) between 1 and 300);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'collection_accessions_reception_notes_check') then
    alter table public.collection_accessions
      add constraint collection_accessions_reception_notes_check
      check (reception_notes is null or length(reception_notes) <= 10000);
  end if;

  select con.conname into cname
  from pg_constraint con
  where con.conrelid = 'public.collection_accession_events'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%expediente_creado%';
  if cname is not null then
    execute format('alter table public.collection_accession_events drop constraint %I', cname);
  end if;
  alter table public.collection_accession_events
    add constraint collection_accession_events_action_check
    check (action in (
      'expediente_creado', 'expediente_corregido', 'firma_registrada', 'formalizado',
      'pieza_recibida', 'ubicacion_inicial', 'devolucion', 'cierre', 'vinculo_pieza', 'anexo'
    ));

  select con.conname into cname
  from pg_constraint con
  where con.conrelid = 'public.collection_accession_signatures'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%propietario%';
  if cname is not null then
    execute format('alter table public.collection_accession_signatures drop constraint %I', cname);
  end if;
  alter table public.collection_accession_signatures
    add constraint collection_accession_signatures_signer_role_check
    check (signer_role in (
      'propietario', 'donante', 'representante_museo', 'director', 'testigo', 'otro', 'receptor'
    ));
  if not exists (
    select 1 from pg_constraint where conname = 'collection_accession_signatures_signature_type_check'
  ) then
    alter table public.collection_accession_signatures
      add constraint collection_accession_signatures_signature_type_check
      check (signature_type in ('contractual', 'recepcion'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'collection_accession_signatures_content_hash_check'
  ) then
    alter table public.collection_accession_signatures
      add constraint collection_accession_signatures_content_hash_check
      check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$');
  end if;
end
$phase3_constraints$;

comment on column public.collection_accessions.contract_hash is
  'SHA-256 of the stored contract_snapshot text. Integrity control; it does not replace the signatures.';

comment on column public.collection_accession_signatures.signature_type is
  'contractual covers the lender or donor and the director. recepcion is the operational certification and is not a third contractual signature.';

comment on column public.collection_accession_signatures.content_hash is
  'Fingerprint of the contractual document the person signed, or of the reception certification. Not a biometric template.';

create or replace function public.collection_contract_acceptance()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'Mediante la firma del presente formulario, las partes reconocen y aceptan las condiciones aquí establecidas.'::text;
$$;

create or replace function public.collection_reception_certification()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'Certifico que la información contenida en este formulario es correcta y que la pieza fue recibida conforme a las condiciones descritas.'::text;
$$;

create or replace function public.collection_contract_digest(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(p_text, 'UTF8'), 'sha256'), 'hex');
$$;

create or replace function public.collection_contract_body(p_accession_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  acc public.collection_accessions;
  item public.collection_items;
  v_dimensions text;
  v_body jsonb;
begin
  select * into acc
  from public.collection_accessions
  where id = p_accession_id and museum_id = public.current_user_museum_id();
  if not found then
    raise exception 'ACCESSION_NOT_FOUND' using errcode = '42501';
  end if;
  select * into item
  from public.collection_items
  where id = acc.collection_item_id and museum_id = acc.museum_id;
  if not found then
    raise exception 'ITEM_NOT_FOUND' using errcode = '42501';
  end if;
  v_dimensions := nullif(btrim(concat_ws('; ',
    case when acc.height is not null then 'Alto: ' || trim(to_char(acc.height, 'FM999999990.99')) || ' ' || acc.height_unit end,
    case when acc.width is not null then 'Ancho: ' || trim(to_char(acc.width, 'FM999999990.99')) || ' ' || acc.width_unit end,
    case when acc.depth is not null then 'Profundidad: ' || trim(to_char(acc.depth, 'FM999999990.99')) || ' ' || acc.depth_unit end,
    case when acc.weight is not null then 'Peso: ' || trim(to_char(acc.weight, 'FM999999990.99')) || ' ' || acc.weight_unit end,
    case when acc.other_measurements is not null then 'Otras medidas: ' || acc.other_measurements end
  )), '');
  v_body := jsonb_build_object(
    'acceptance', public.collection_contract_acceptance(),
    'accession_id', acc.id,
    'activity_location', acc.activity_location,
    'activity_name', acc.activity_name,
    'activity_on', acc.activity_on,
    'attachments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', attachment.id,
        'kind', attachment.kind,
        'path', attachment.path,
        'description', attachment.description
      ) order by attachment.id)
      from public.collection_accession_attachments attachment
      where attachment.museum_id = acc.museum_id and attachment.accession_id = acc.id
    ), '[]'::jsonb),
    'category', item.category,
    'currency', acc.currency,
    'depth', acc.depth,
    'depth_unit', acc.depth_unit,
    'description', item.description,
    'dimensions', v_dimensions,
    'estimated_value', acc.estimated_value,
    'expected_return_on', acc.expected_return_on,
    'file_number', acc.file_number,
    'height', acc.height,
    'height_unit', acc.height_unit,
    'inventory_number', item.accession_number,
    'item_id', item.id,
    'location', item.location,
    'modality', acc.modality,
    'other_measurements', acc.other_measurements,
    'party_address', acc.party_address,
    'party_email', acc.party_email,
    'party_entity', acc.party_entity,
    'party_name', acc.party_name,
    'party_phone', acc.party_phone,
    'physical_condition', acc.physical_condition,
    'conservation_notes', acc.conservation_notes,
    'purpose', acc.purpose,
    'purpose_details', acc.purpose_details,
    'purposes', acc.purposes,
    'started_on', acc.started_on,
    'title', item.title,
    'weight', acc.weight,
    'weight_unit', acc.weight_unit,
    'width', acc.width,
    'width_unit', acc.width_unit
  );
  return v_body::text::jsonb;
end
$$;

create or replace function public.collection_accession_phase3_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.contract_hash is not null and new.contract_hash is distinct from old.contract_hash then
    raise exception 'CONTRACT_SNAPSHOT_IMMUTABLE' using errcode = '42501';
  end if;
  if old.contract_snapshot is not null and new.status is distinct from old.status
     and not (old.status = 'formalizado' and new.status = 'recibido') then
    raise exception 'CONTRACT_LOCKED' using errcode = '42501';
  end if;
  if old.received_at is not null and (
    new.initial_location is distinct from old.initial_location
    or new.received_at is distinct from old.received_at
    or new.received_by is distinct from old.received_by
    or new.reception_notes is distinct from old.reception_notes
    or new.custody_status is distinct from old.custody_status
    or new.status is distinct from old.status
  ) then
    raise exception 'RECEPTION_IMMUTABLE' using errcode = '42501';
  end if;
  return new;
end
$$;

drop trigger if exists collection_accession_phase3_guard on public.collection_accessions;
create trigger collection_accession_phase3_guard
  before update on public.collection_accessions
  for each row execute function public.collection_accession_phase3_guard();

create or replace function public.collection_signature_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'SIGNATURE_IMMUTABLE' using errcode = '42501';
end
$$;

create or replace function public.collection_signature_visual(p_visual jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_visual jsonb;
  v_points int;
begin
  if p_visual is null or jsonb_typeof(p_visual) <> 'object' then
    raise exception 'SIGNATURE_EMPTY' using errcode = '22023';
  end if;
  if jsonb_typeof(p_visual->'strokes') <> 'array' or jsonb_array_length(p_visual->'strokes') < 1 then
    raise exception 'SIGNATURE_EMPTY' using errcode = '22023';
  end if;
  select coalesce(sum(jsonb_array_length(stroke->'points')), 0)::int into v_points
  from jsonb_array_elements(p_visual->'strokes') stroke
  where jsonb_typeof(stroke->'points') = 'array';
  if v_points < 1 then
    raise exception 'SIGNATURE_EMPTY' using errcode = '22023';
  end if;
  if octet_length(p_visual::text) > 400000 then
    raise exception 'SIGNATURE_TOO_LARGE' using errcode = '22023';
  end if;
  v_visual := jsonb_build_object(
    'representation', 'strokes',
    'strokes', p_visual->'strokes',
    'integrity', jsonb_build_object(
      'adapter', coalesce(p_visual->'integrity'->>'adapter', 'PointerCanvasAdapter'),
      'strokeCount', jsonb_array_length(p_visual->'strokes'),
      'pointCount', v_points,
      'canvasWidth', coalesce((p_visual->'integrity'->>'canvasWidth')::int, 0),
      'canvasHeight', coalesce((p_visual->'integrity'->>'canvasHeight')::int, 0)
    )
  );
  if jsonb_typeof(p_visual->'raster') = 'object'
     and coalesce(p_visual->'raster'->>'format', '') = 'image/png'
     and left(coalesce(p_visual->'raster'->>'dataUrl', ''), 22) = 'data:image/png;base64,'
     and octet_length((v_visual || jsonb_build_object('raster', p_visual->'raster'))::text) <= 400000 then
    v_visual := v_visual || jsonb_build_object('raster', jsonb_build_object(
      'format', 'image/png',
      'dataUrl', p_visual->'raster'->>'dataUrl'
    ));
  end if;
  return v_visual;
end
$$;

create or replace function public.collection_update_ingress_draft(
  p_id uuid,
  p_expected_version bigint,
  p_item jsonb,
  p_accession jsonb,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m uuid := public.current_user_museum_id();
  acc public.collection_accessions;
  item public.collection_items;
  saved_item public.collection_items;
  saved public.collection_accessions;
  d jsonb;
  v_actor text;
  v_title text;
  v_description text;
  v_category text;
  v_location text;
  v_condition text;
  v_item_status text;
  v_modality text;
  v_party text;
  v_entity text;
  v_email text;
  v_phone text;
  v_address text;
  v_purposes jsonb;
  purpose_key text;
  v_purpose text;
  v_purpose_details text;
  v_activity_name text;
  v_activity_on date;
  v_activity_location text;
  v_started date;
  v_return date;
  v_height numeric;
  v_width numeric;
  v_depth numeric;
  v_weight numeric;
  v_height_unit text;
  v_width_unit text;
  v_depth_unit text;
  v_weight_unit text;
  v_other text;
  v_value numeric;
  v_conservation text;
  v_dimensions text;
begin
  if m is null or public.collection_can_write() is not true then
    raise exception 'COLLECTION_FORBIDDEN' using errcode = '42501';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 3 and 2000 then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;
  select * into acc
  from public.collection_accessions
  where id = p_id and museum_id = m
  for update;
  if not found then
    raise exception 'ACCESSION_NOT_FOUND' using errcode = '42501';
  end if;
  if acc.modality not in ('prestamo_temporal', 'donacion_permanente') then
    raise exception 'NOT_CONTRACT_INTAKE' using errcode = '22023';
  end if;
  if acc.contract_snapshot is not null or acc.status not in ('borrador', 'pendiente_firmas') then
    raise exception 'CONTRACT_LOCKED' using errcode = '42501';
  end if;
  if p_expected_version is null or p_expected_version <> acc.version then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  if coalesce(p_accession->>'modality', acc.modality) <> acc.modality
     or coalesce(p_accession->>'status', acc.status) not in ('borrador', 'pendiente_firmas') then
    raise exception 'MODALITY_IMMUTABLE' using errcode = '22023';
  end if;
  select * into item
  from public.collection_items
  where id = acc.collection_item_id and museum_id = m
  for update;
  if not found then
    raise exception 'ITEM_NOT_FOUND' using errcode = '42501';
  end if;

  v_modality := acc.modality;
  d := case
    when jsonb_typeof(item.details) = 'object' then item.details
    else '{}'::jsonb
  end;
  if jsonb_typeof(p_item->'details') = 'object' then
    d := d || (p_item->'details');
  end if;
  v_title := btrim(coalesce(p_item->>'title', ''));
  v_description := btrim(coalesce(p_item->>'description', ''));
  v_category := btrim(coalesce(p_item->>'category', ''));
  v_location := btrim(coalesce(p_item->>'location', ''));
  v_condition := btrim(coalesce(p_accession->>'physical_condition', p_item->>'condition', ''));
  v_item_status := coalesce(nullif(btrim(coalesce(p_item->>'status', '')), ''), 'ingreso');
  if length(v_title) not between 1 and 300
     or length(v_description) not between 1 and 10000
     or length(v_location) not between 1 and 300 then
    raise exception 'INVALID_ITEM' using errcode = '22023';
  end if;
  if v_category not in (
    'Instrumento musical', 'Documento', 'Fotografía', 'Objeto personal', 'Partitura', 'Vestuario',
    'Obra de arte', 'Disco de vinilo', 'Casete', '8-Track', 'CD de Audio', 'DVD', 'Otro'
  ) then
    raise exception 'INVALID_CATEGORY' using errcode = '22023';
  end if;
  if v_item_status not in ('ingreso', 'catalogada', 'conservacion', 'restauracion') then
    raise exception 'INVALID_ITEM_STATUS' using errcode = '22023';
  end if;
  if v_condition not in ('Excelente', 'Buena', 'Regular', 'Mala', 'Requiere evaluación') then
    raise exception 'PHYSICAL_CONDITION_REQUIRED' using errcode = '22023';
  end if;
  if length(coalesce(d->>'personal_object_description', '')) > 1000
     or length(coalesce(d->>'object_type_specification', '')) > 1000 then
    raise exception 'INVALID_DETAILS' using errcode = '22023';
  end if;
  if v_category = 'Objeto personal' and length(btrim(coalesce(d->>'personal_object_description', ''))) < 1 then
    raise exception 'PERSONAL_OBJECT_DESCRIPTION_REQUIRED' using errcode = '22023';
  end if;
  if v_category = 'Otro' and length(btrim(coalesce(d->>'object_type_specification', ''))) < 1 then
    raise exception 'OBJECT_TYPE_SPECIFICATION_REQUIRED' using errcode = '22023';
  end if;

  v_party := nullif(btrim(coalesce(p_accession->>'party_name', '')), '');
  v_entity := nullif(btrim(coalesce(p_accession->>'party_entity', '')), '');
  v_email := nullif(btrim(coalesce(p_accession->>'party_email', '')), '');
  v_phone := nullif(btrim(coalesce(p_accession->>'party_phone', '')), '');
  v_address := nullif(btrim(coalesce(p_accession->>'party_address', '')), '');
  v_purposes := coalesce(p_accession->'purposes', '[]'::jsonb);
  if jsonb_typeof(v_purposes) <> 'array' then
    raise exception 'INVALID_PURPOSES' using errcode = '22023';
  end if;
  v_purpose_details := nullif(btrim(coalesce(p_accession->>'purpose_details', '')), '');
  v_activity_name := nullif(btrim(coalesce(p_accession->>'activity_name', '')), '');
  v_activity_on := public.collection_intake_date(p_accession->>'activity_on');
  v_activity_location := nullif(btrim(coalesce(p_accession->>'activity_location', '')), '');
  v_started := public.collection_intake_date(p_accession->>'started_on');
  v_return := public.collection_intake_date(p_accession->>'expected_return_on');
  v_height := public.collection_measure(p_accession->>'height');
  v_width := public.collection_measure(p_accession->>'width');
  v_depth := public.collection_measure(p_accession->>'depth');
  v_weight := public.collection_measure(p_accession->>'weight');
  v_height_unit := nullif(btrim(coalesce(p_accession->>'height_unit', '')), '');
  v_width_unit := nullif(btrim(coalesce(p_accession->>'width_unit', '')), '');
  v_depth_unit := nullif(btrim(coalesce(p_accession->>'depth_unit', '')), '');
  v_weight_unit := nullif(btrim(coalesce(p_accession->>'weight_unit', '')), '');
  v_other := nullif(btrim(coalesce(p_accession->>'other_measurements', '')), '');
  v_conservation := nullif(btrim(coalesce(p_accession->>'conservation_notes', '')), '');
  v_value := public.collection_measure(p_accession->>'estimated_value');
  if v_value is not null and v_value > 999999999999.99 then
    raise exception 'INVALID_FMV' using errcode = '22023';
  end if;
  if (v_height is null) <> (v_height_unit is null) or (v_height_unit is not null and v_height_unit not in ('cm', 'pulg.'))
     or (v_width is null) <> (v_width_unit is null) or (v_width_unit is not null and v_width_unit not in ('cm', 'pulg.'))
     or (v_depth is null) <> (v_depth_unit is null) or (v_depth_unit is not null and v_depth_unit not in ('cm', 'pulg.'))
     or (v_weight is null) <> (v_weight_unit is null) or (v_weight_unit is not null and v_weight_unit not in ('lb', 'kg')) then
    raise exception 'INVALID_MEASUREMENT' using errcode = '22023';
  end if;
  if v_party is null or v_email is null or v_phone is null or v_address is null then
    raise exception 'PARTY_REQUIRED' using errcode = '22023';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'PARTY_EMAIL_INVALID' using errcode = '22023';
  end if;
  if v_modality = 'prestamo_temporal' then
    if v_started is null or v_return is null then
      raise exception 'LOAN_DATES_REQUIRED' using errcode = '22023';
    end if;
    if v_return < v_started then
      raise exception 'RETURN_BEFORE_START' using errcode = '22023';
    end if;
    if jsonb_array_length(v_purposes) < 1 then
      raise exception 'LOAN_PURPOSE_REQUIRED' using errcode = '22023';
    end if;
    for purpose_key in select jsonb_array_elements_text(v_purposes) loop
      if purpose_key not in ('Exhibición', 'Investigación', 'Conservación', 'Documentación', 'Otros') then
        raise exception 'INVALID_PURPOSES' using errcode = '22023';
      end if;
    end loop;
    if v_purposes ? 'Exhibición' and v_activity_name is null then
      raise exception 'EXHIBITION_NAME_REQUIRED' using errcode = '22023';
    end if;
    if v_purposes ? 'Otros' and v_purpose_details is null then
      raise exception 'PURPOSE_DETAILS_REQUIRED' using errcode = '22023';
    end if;
    if not (v_purposes ? 'Exhibición') then
      v_activity_name := null;
      v_activity_on := null;
      v_activity_location := null;
    end if;
    v_purpose := nullif(array_to_string(array(select jsonb_array_elements_text(v_purposes)), ', '), '');
  else
    if v_started is null then
      raise exception 'DONATION_DATE_REQUIRED' using errcode = '22023';
    end if;
    v_purposes := '[]'::jsonb;
    v_purpose := null;
    v_purpose_details := null;
    v_activity_name := null;
    v_activity_on := null;
    v_activity_location := null;
    v_return := null;
  end if;

  v_dimensions := nullif(btrim(concat_ws('; ',
    case when v_height is not null then 'Alto: ' || trim(to_char(v_height, 'FM999999990.99')) || ' ' || v_height_unit end,
    case when v_width is not null then 'Ancho: ' || trim(to_char(v_width, 'FM999999990.99')) || ' ' || v_width_unit end,
    case when v_depth is not null then 'Profundidad: ' || trim(to_char(v_depth, 'FM999999990.99')) || ' ' || v_depth_unit end,
    case when v_weight is not null then 'Peso: ' || trim(to_char(v_weight, 'FM999999990.99')) || ' ' || v_weight_unit end,
    case when v_other is not null then 'Otras medidas: ' || v_other end
  )), '');
  if v_dimensions is not null then
    if length(v_dimensions) > 1000 then
      raise exception 'MEASUREMENTS_TOO_LONG' using errcode = '22023';
    end if;
    d := jsonb_set(d, '{dimensions}', to_jsonb(v_dimensions));
  end if;
  d := jsonb_set(d, '{currency}', to_jsonb('USD'::text));
  if v_value is not null then
    d := jsonb_set(d, '{fmv}', to_jsonb(trim(to_char(v_value, 'FM999999999999.99'))));
  end if;
  if v_modality = 'prestamo_temporal' then
    d := jsonb_set(d, '{lender}', to_jsonb(v_party));
    d := jsonb_set(d, '{owner}', to_jsonb('Propiedad externa'::text));
    d := jsonb_set(d, '{acquisition}', to_jsonb('Préstamo temporal'::text));
    d := jsonb_set(d, '{owner_email}', to_jsonb(v_email));
    d := jsonb_set(d, '{owner_phone}', to_jsonb(v_phone));
    d := jsonb_set(d, '{owner_address}', to_jsonb(v_address));
    d := jsonb_set(d, '{received_date}', to_jsonb(to_char(v_started, 'YYYY-MM-DD')));
  else
    d := jsonb_set(d, '{donor}', to_jsonb(v_party));
    d := jsonb_set(d, '{owner}', to_jsonb('Pendiente de formalización'::text));
    d := jsonb_set(d, '{acquisition}', to_jsonb('Donación permanente'::text));
    d := jsonb_set(d, '{owner_email}', to_jsonb(v_email));
    d := jsonb_set(d, '{owner_phone}', to_jsonb(v_phone));
    d := jsonb_set(d, '{owner_address}', to_jsonb(v_address));
    d := jsonb_set(d, '{received_date}', to_jsonb(to_char(v_started, 'YYYY-MM-DD')));
  end if;

  v_actor := coalesce(nullif(btrim((select full_name from public.profiles where id = auth.uid())), ''), 'Catalogador');
  update public.collection_items
  set title = v_title,
      description = v_description,
      category = v_category,
      location = v_location,
      condition = v_condition,
      details = d,
      status = v_item_status,
      version = version + 1,
      updated_at = now(),
      updated_by = auth.uid()
  where id = item.id and museum_id = m
  returning * into saved_item;
  insert into public.collection_history (
    museum_id, item_id, actor_id, actor_name, action, reason, before_value, after_value
  ) values (
    m, saved_item.id, auth.uid(), v_actor, 'edicion', btrim(p_reason), to_jsonb(item), to_jsonb(saved_item)
  );
  update public.collection_accessions
  set party_name = v_party,
      party_entity = v_entity,
      party_email = v_email,
      party_phone = v_phone,
      party_address = v_address,
      started_on = v_started,
      expected_return_on = v_return,
      purpose = v_purpose,
      purpose_details = v_purpose_details,
      purposes = v_purposes,
      activity_name = v_activity_name,
      activity_on = v_activity_on,
      activity_location = v_activity_location,
      height = v_height,
      height_unit = v_height_unit,
      width = v_width,
      width_unit = v_width_unit,
      depth = v_depth,
      depth_unit = v_depth_unit,
      weight = v_weight,
      weight_unit = v_weight_unit,
      other_measurements = v_other,
      physical_condition = v_condition,
      conservation_notes = v_conservation,
      estimated_value = v_value,
      currency = 'USD',
      ownership_status = case when v_modality = 'prestamo_temporal' then 'externa' else 'pendiente' end,
      version = version + 1,
      updated_by = auth.uid()
  where id = acc.id and museum_id = m
  returning * into saved;
  insert into public.collection_accession_events (
    museum_id, accession_id, item_id, actor_id, actor_name, action, reason, before_value, after_value
  ) values (
    m, saved.id, saved.collection_item_id, auth.uid(), v_actor, 'expediente_corregido',
    btrim(p_reason), to_jsonb(acc), to_jsonb(saved)
  );
  return jsonb_build_object('item', to_jsonb(saved_item), 'accession', to_jsonb(saved));
end
$$;

create or replace function public.collection_record_signature(
  p_id uuid,
  p_expected_version bigint,
  p_signer_role text,
  p_capture_method text,
  p_visual jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m uuid := public.current_user_museum_id();
  acc public.collection_accessions;
  saved public.collection_accessions;
  signature_row public.collection_accession_signatures;
  v_role text := btrim(coalesce(p_signer_role, ''));
  v_method text := btrim(coalesce(p_capture_method, ''));
  v_name text;
  v_visual jsonb;
  v_hash text;
  v_actor text;
  v_integrity jsonb;
  v_party_role text;
begin
  if m is null or public.collection_can_read() is not true then
    raise exception 'COLLECTION_FORBIDDEN' using errcode = '42501';
  end if;
  if v_method not in ('wacom-stu-540', 'pointer', 'touch', 'stylus', 'mouse') then
    raise exception 'INVALID_CAPTURE_METHOD' using errcode = '22023';
  end if;
  select * into acc
  from public.collection_accessions
  where id = p_id and museum_id = m
  for update;
  if not found then
    raise exception 'ACCESSION_NOT_FOUND' using errcode = '42501';
  end if;
  if acc.contract_snapshot is not null or acc.status not in ('borrador', 'pendiente_firmas') then
    raise exception 'CONTRACT_LOCKED' using errcode = '42501';
  end if;
  if p_expected_version is null or p_expected_version <> acc.version then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  if acc.modality = 'donacion_permanente' then
    v_party_role := 'donante';
  else
    v_party_role := 'propietario';
  end if;
  if v_role = 'director' then
    if public.has_permission('collections.sign.director') is not true then
      raise exception 'DIRECTOR_SIGNATURE_FORBIDDEN' using errcode = '42501';
    end if;
    v_name := nullif(btrim((select full_name from public.profiles where id = auth.uid() and museum_id = m)), '');
    if v_name is null then
      raise exception 'DIRECTOR_NAME_REQUIRED' using errcode = '22023';
    end if;
  elsif v_role = v_party_role and acc.modality in ('prestamo_temporal', 'donacion_permanente') then
    if public.collection_can_write() is not true then
      raise exception 'COLLECTION_FORBIDDEN' using errcode = '42501';
    end if;
    v_name := nullif(btrim(acc.party_name), '');
    if v_name is null then
      raise exception 'PARTY_REQUIRED' using errcode = '22023';
    end if;
  else
    raise exception 'SIGNATURE_ROLE' using errcode = '22023';
  end if;
  v_visual := public.collection_signature_visual(p_visual);
  v_integrity := v_visual->'integrity';
  if v_role = 'director' then
    v_integrity := v_integrity || jsonb_build_object('cargo', 'Director del Museo');
    v_visual := jsonb_set(v_visual, '{integrity}', v_integrity);
  end if;
  v_hash := public.collection_contract_digest(public.collection_contract_body(acc.id)::text);
  v_actor := coalesce(nullif(btrim((select full_name from public.profiles where id = auth.uid())), ''), 'Catalogador');
  insert into public.collection_accession_signatures (
    museum_id, accession_id, signer_name, signer_role, signature_type, signed_at,
    capture_method, visual, integrity, content_hash, status, created_by
  ) values (
    m, acc.id, v_name, v_role, 'contractual', now(),
    v_method, v_visual, v_integrity, v_hash, 'capturada', auth.uid()
  ) returning * into signature_row;
  update public.collection_accessions
  set status = 'pendiente_firmas',
      version = version + 1,
      updated_by = auth.uid()
  where id = acc.id and museum_id = m
  returning * into saved;
  insert into public.collection_accession_events (
    museum_id, accession_id, item_id, actor_id, actor_name, action, reason, after_value
  ) values (
    m, saved.id, saved.collection_item_id, auth.uid(), v_actor, 'firma_registrada',
    'Firma contractual registrada.',
    jsonb_build_object('signature_id', signature_row.id, 'signer_role', signature_row.signer_role, 'capture_method', signature_row.capture_method)
  );
  return jsonb_build_object('accession', to_jsonb(saved), 'signature', to_jsonb(signature_row));
end
$$;

create or replace function public.collection_formalize_accession(
  p_id uuid,
  p_expected_version bigint
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m uuid := public.current_user_museum_id();
  acc public.collection_accessions;
  item public.collection_items;
  saved public.collection_accessions;
  saved_item public.collection_items;
  party_signature public.collection_accession_signatures;
  director_signature public.collection_accession_signatures;
  v_body jsonb;
  v_hash text;
  v_snapshot jsonb;
  v_package text;
  v_role text;
  v_ownership text;
  v_custody text;
  v_actor text;
begin
  if m is null or public.collection_can_write() is not true then
    raise exception 'COLLECTION_FORBIDDEN' using errcode = '42501';
  end if;
  select * into acc
  from public.collection_accessions
  where id = p_id and museum_id = m
  for update;
  if not found then
    raise exception 'ACCESSION_NOT_FOUND' using errcode = '42501';
  end if;
  if acc.modality not in ('prestamo_temporal', 'donacion_permanente') then
    raise exception 'NOT_CONTRACT_INTAKE' using errcode = '22023';
  end if;
  if acc.contract_snapshot is not null or acc.status not in ('borrador', 'pendiente_firmas') then
    raise exception 'CONTRACT_LOCKED' using errcode = '42501';
  end if;
  if p_expected_version is null or p_expected_version <> acc.version then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  if acc.modality = 'donacion_permanente' then
    v_role := 'donante';
  else
    v_role := 'propietario';
  end if;
  v_body := public.collection_contract_body(acc.id);
  v_hash := public.collection_contract_digest(v_body::text);
  select * into party_signature
  from public.collection_accession_signatures
  where museum_id = m and accession_id = acc.id and signature_type = 'contractual'
    and signer_role = v_role and status = 'capturada'
  order by signed_at desc, id desc
  limit 1;
  if not found then
    raise exception 'PARTY_SIGNATURE_REQUIRED' using errcode = '22023';
  end if;
  select * into director_signature
  from public.collection_accession_signatures
  where museum_id = m and accession_id = acc.id and signature_type = 'contractual'
    and signer_role = 'director' and status = 'capturada'
  order by signed_at desc, id desc
  limit 1;
  if not found then
    raise exception 'DIRECTOR_SIGNATURE_REQUIRED' using errcode = '22023';
  end if;
  if party_signature.content_hash is distinct from v_hash
     or director_signature.content_hash is distinct from v_hash then
    raise exception 'SIGNATURE_STALE' using errcode = '22023';
  end if;
  if acc.modality = 'donacion_permanente' then
    v_ownership := 'museo';
    v_custody := 'pendiente';
  else
    v_ownership := 'externa';
    v_custody := 'museo';
  end if;
  v_snapshot := jsonb_build_object(
    'document', v_body,
    'ownership_status', v_ownership,
    'custody_status', v_custody,
    'signatures', jsonb_build_array(
      jsonb_build_object(
        'id', party_signature.id,
        'signer_name', party_signature.signer_name,
        'signer_role', party_signature.signer_role,
        'capture_method', party_signature.capture_method,
        'signed_at', party_signature.signed_at,
        'content_hash', party_signature.content_hash
      ),
      jsonb_build_object(
        'id', director_signature.id,
        'signer_name', director_signature.signer_name,
        'signer_role', director_signature.signer_role,
        'cargo', 'Director del Museo',
        'capture_method', director_signature.capture_method,
        'signed_at', director_signature.signed_at,
        'content_hash', director_signature.content_hash
      )
    ),
    'formalized_at', now()
  );
  v_snapshot := v_snapshot::text::jsonb;
  v_package := public.collection_contract_digest(v_snapshot::text);
  v_actor := coalesce(nullif(btrim((select full_name from public.profiles where id = auth.uid())), ''), 'Catalogador');
  update public.collection_accessions
  set status = 'formalizado',
      ownership_status = v_ownership,
      custody_status = v_custody,
      terms_reference = public.collection_contract_acceptance(),
      terms_version = 'aceptacion-1',
      contract_snapshot = v_snapshot,
      contract_snapshot_at = now(),
      contract_hash = v_package,
      version = version + 1,
      updated_by = auth.uid()
  where id = acc.id and museum_id = m
  returning * into saved;
  if public.collection_contract_digest(saved.contract_snapshot::text) is distinct from saved.contract_hash then
    raise exception 'CONTRACT_HASH_MISMATCH' using errcode = '55000';
  end if;
  select * into item
  from public.collection_items
  where id = acc.collection_item_id and museum_id = m
  for update;
  saved_item := item;
  if acc.modality = 'donacion_permanente' then
    update public.collection_items
    set details = jsonb_set(coalesce(details, '{}'::jsonb), '{owner}', to_jsonb('Museo'::text)),
        version = version + 1,
        updated_at = now(),
        updated_by = auth.uid()
    where id = item.id and museum_id = m
    returning * into saved_item;
    insert into public.collection_history (
      museum_id, item_id, actor_id, actor_name, action, reason, before_value, after_value
    ) values (
      m, saved_item.id, auth.uid(), v_actor, 'edicion',
      'La formalización transfiere la titularidad de la donación al Museo.',
      to_jsonb(item), to_jsonb(saved_item)
    );
  end if;
  insert into public.collection_accession_events (
    museum_id, accession_id, item_id, actor_id, actor_name, action, reason, before_value, after_value
  ) values (
    m, saved.id, saved.collection_item_id, auth.uid(), v_actor, 'formalizado',
    'Ingreso formalizado con las dos firmas contractuales.',
    to_jsonb(acc), to_jsonb(saved)
  );
  return jsonb_build_object('item', to_jsonb(saved_item), 'accession', to_jsonb(saved));
end
$$;

create or replace function public.collection_receive_accession(
  p_id uuid,
  p_expected_version bigint,
  p_location text,
  p_notes text,
  p_capture_method text,
  p_visual jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m uuid := public.current_user_museum_id();
  acc public.collection_accessions;
  item public.collection_items;
  saved public.collection_accessions;
  saved_item public.collection_items;
  signature_row public.collection_accession_signatures;
  v_location text := nullif(btrim(coalesce(p_location, '')), '');
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_method text := btrim(coalesce(p_capture_method, ''));
  v_name text;
  v_visual jsonb;
  v_hash text;
  v_actor text;
begin
  if m is null or public.collection_can_write() is not true then
    raise exception 'COLLECTION_FORBIDDEN' using errcode = '42501';
  end if;
  if v_location is null or length(v_location) > 300 then
    raise exception 'RECEPTION_LOCATION_REQUIRED' using errcode = '22023';
  end if;
  if v_notes is not null and length(v_notes) > 10000 then
    raise exception 'RECEPTION_NOTES_TOO_LONG' using errcode = '22023';
  end if;
  if v_method not in ('wacom-stu-540', 'pointer', 'touch', 'stylus', 'mouse') then
    raise exception 'INVALID_CAPTURE_METHOD' using errcode = '22023';
  end if;
  select * into acc
  from public.collection_accessions
  where id = p_id and museum_id = m
  for update;
  if not found then
    raise exception 'ACCESSION_NOT_FOUND' using errcode = '42501';
  end if;
  if acc.status <> 'formalizado' or acc.contract_snapshot is null then
    raise exception 'RECEPTION_REQUIRES_FORMALIZATION' using errcode = '22023';
  end if;
  if p_expected_version is null or p_expected_version <> acc.version then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  select * into item
  from public.collection_items
  where id = acc.collection_item_id and museum_id = m
  for update;
  if not found then
    raise exception 'ITEM_NOT_FOUND' using errcode = '42501';
  end if;
  v_name := nullif(btrim((select full_name from public.profiles where id = auth.uid() and museum_id = m)), '');
  if v_name is null then
    raise exception 'RECEPTION_NAME_REQUIRED' using errcode = '22023';
  end if;
  v_visual := public.collection_signature_visual(p_visual);
  v_hash := public.collection_contract_digest(concat_ws(E'\n',
    public.collection_reception_certification(),
    item.accession_number,
    v_location,
    coalesce(v_notes, '')
  ));
  v_actor := v_name;
  insert into public.collection_accession_signatures (
    museum_id, accession_id, signer_name, signer_role, signature_type, signed_at,
    capture_method, visual, integrity, content_hash, status, created_by
  ) values (
    m, acc.id, v_name, 'receptor', 'recepcion', now(),
    v_method, v_visual,
    (v_visual->'integrity') || jsonb_build_object('certification', public.collection_reception_certification()),
    v_hash, 'capturada', auth.uid()
  ) returning * into signature_row;
  update public.collection_accessions
  set status = 'recibido',
      custody_status = 'museo',
      initial_location = v_location,
      reception_notes = v_notes,
      received_at = now(),
      received_by = auth.uid(),
      version = version + 1,
      updated_by = auth.uid()
  where id = acc.id and museum_id = m
  returning * into saved;
  update public.collection_items
  set location = v_location,
      version = version + 1,
      updated_at = now(),
      updated_by = auth.uid()
  where id = item.id and museum_id = m
  returning * into saved_item;
  insert into public.collection_history (
    museum_id, item_id, actor_id, actor_name, action, reason, before_value, after_value
  ) values (
    m, saved_item.id, auth.uid(), v_actor, 'edicion',
    'Ubicación inicial al recibir la pieza.',
    to_jsonb(item), to_jsonb(saved_item)
  );
  insert into public.collection_accession_events (
    museum_id, accession_id, item_id, actor_id, actor_name, action, reason, after_value
  ) values (
    m, saved.id, saved.collection_item_id, auth.uid(), v_actor, 'pieza_recibida',
    'Pieza recibida en el Museo.',
    jsonb_build_object(
      'received_at', saved.received_at,
      'received_by', saved.received_by,
      'initial_location', saved.initial_location,
      'reception_notes', saved.reception_notes,
      'signature_id', signature_row.id
    )
  );
  return jsonb_build_object(
    'item', to_jsonb(saved_item),
    'accession', to_jsonb(saved),
    'signature', to_jsonb(signature_row)
  );
end
$$;

create or replace function public.collection_contract_document(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  acc public.collection_accessions;
begin
  if public.current_user_museum_id() is null or public.collection_can_read() is not true then
    raise exception 'COLLECTION_FORBIDDEN' using errcode = '42501';
  end if;
  select * into acc
  from public.collection_accessions
  where id = p_id and museum_id = public.current_user_museum_id();
  if not found then
    raise exception 'ACCESSION_NOT_FOUND' using errcode = '42501';
  end if;
  if acc.contract_snapshot is null then
    raise exception 'CONTRACT_NOT_FORMALIZED' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'contract_snapshot', acc.contract_snapshot,
    'contract_hash', acc.contract_hash,
    'contract_snapshot_at', acc.contract_snapshot_at,
    'integrity_ok', public.collection_contract_digest(acc.contract_snapshot::text) = acc.contract_hash
  );
end
$$;

create or replace function public.collection_attach_accession_file(
  p_accession_id uuid, p_file_id uuid, p_path text, p_kind text, p_description text
) returns public.collection_accession_attachments
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.collection_accessions;
  saved public.collection_accession_attachments;
  v_kind text := btrim(coalesce(p_kind, ''));
  v_description text := coalesce(p_description, '');
begin
  if public.collection_can_write() is not true or public.collection_accession_file_allowed(p_path, true) is not true then
    raise exception 'COLLECTION_FORBIDDEN' using errcode = '42501';
  end if;
  if v_kind not in ('inventario_adicional', 'seguro', 'tasacion', 'otro') then
    raise exception 'INVALID_ATTACHMENT_KIND' using errcode = '22023';
  end if;
  select * into a
  from public.collection_accessions
  where id = p_accession_id and museum_id = public.current_user_museum_id()
  for update;
  if not found then
    raise exception 'ACCESSION_NOT_FOUND' using errcode = '42501';
  end if;
  if a.contract_snapshot is not null or a.status not in ('borrador', 'pendiente_firmas') then
    raise exception 'CONTRACT_LOCKED' using errcode = '42501';
  end if;
  if (storage.foldername(p_path))[2] <> a.id::text
     or split_part(storage.filename(p_path), '.', 1) <> p_file_id::text
     or not exists (select 1 from storage.objects where bucket_id = 'collection-accession-files' and name = p_path)
  then
    raise exception 'ATTACHMENT_NOT_FOUND' using errcode = '22023';
  end if;
  insert into public.collection_accession_attachments (
    id, museum_id, accession_id, kind, description, path, created_by
  ) values (
    p_file_id, a.museum_id, a.id, v_kind, v_description, p_path, auth.uid()
  ) returning * into saved;
  insert into public.collection_accession_events (
    museum_id, accession_id, item_id, actor_id, actor_name, action, reason, after_value
  ) values (
    a.museum_id, a.id, a.collection_item_id, auth.uid(),
    coalesce((select full_name from public.profiles where id = auth.uid()), 'Catalogador'),
    'anexo', 'Documento asociado al ingreso.', to_jsonb(saved)
  );
  return saved;
end
$$;

revoke all on function public.collection_contract_acceptance() from public, anon, authenticated;
revoke all on function public.collection_reception_certification() from public, anon, authenticated;
revoke all on function public.collection_contract_digest(text) from public, anon, authenticated;
revoke all on function public.collection_contract_body(uuid) from public, anon, authenticated;
revoke all on function public.collection_accession_phase3_guard() from public, anon, authenticated;
revoke all on function public.collection_signature_visual(jsonb) from public, anon, authenticated;
revoke all on function public.collection_update_ingress_draft(uuid, bigint, jsonb, jsonb, text) from public, anon;
revoke all on function public.collection_record_signature(uuid, bigint, text, text, jsonb) from public, anon;
revoke all on function public.collection_formalize_accession(uuid, bigint) from public, anon;
revoke all on function public.collection_receive_accession(uuid, bigint, text, text, text, jsonb) from public, anon;
revoke all on function public.collection_contract_document(uuid) from public, anon;

grant execute on function public.collection_update_ingress_draft(uuid, bigint, jsonb, jsonb, text) to authenticated;
grant execute on function public.collection_record_signature(uuid, bigint, text, text, jsonb) to authenticated;
grant execute on function public.collection_formalize_accession(uuid, bigint) to authenticated;
grant execute on function public.collection_receive_accession(uuid, bigint, text, text, text, jsonb) to authenticated;
grant execute on function public.collection_contract_document(uuid) to authenticated;

insert into supabase_migrations.schema_migrations (version, name)
select '202610050003', 'collection_formalization'
where not exists (
  select 1 from supabase_migrations.schema_migrations where version = '202610050003'
);

notify pgrst, 'reload schema';
commit;
