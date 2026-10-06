-- Phase 2: one granted create operation for a new collection piece.
-- Allocates the inventory number and the ingress file inside the same transaction
-- as the collection_items and collection_accessions inserts.
-- Applying this file does not update, delete, renumber, or rewrite existing collection_items,
-- collection_photos, collection_history, storage paths, or historical accession numbers.
-- A later call to collection_attach_photo_role updates only the version of the piece that receives a new photograph.
-- Does not call the allocator while this migration runs.
begin;

alter table public.collection_accessions
  add column if not exists client_request_id uuid;

create unique index if not exists collection_accessions_client_request
  on public.collection_accessions (museum_id, client_request_id)
  where client_request_id is not null;

comment on column public.collection_accessions.client_request_id is
  'Idempotency key for collection_create_catalog_entry. A repeated call returns the piece already created and does not allocate another inventory number.';

create or replace function public.collection_accession_request_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.client_request_id is distinct from old.client_request_id then
    raise exception 'ACCESSION_IDENTITY_IMMUTABLE' using errcode = '42501';
  end if;
  return new;
end
$$;

drop trigger if exists collection_accession_request_guard on public.collection_accessions;
create trigger collection_accession_request_guard
  before update on public.collection_accessions
  for each row execute function public.collection_accession_request_guard();

create or replace function public.collection_measure(p_raw text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_raw, ''));
begin
  if v = '' then
    return null;
  end if;
  if v !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' then
    raise exception 'INVALID_MEASUREMENT' using errcode = '22023';
  end if;
  return v::numeric;
end
$$;

create or replace function public.collection_intake_date(p_raw text)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_raw, ''));
begin
  if v = '' then
    return null;
  end if;
  if v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'INVALID_DATE' using errcode = '22023';
  end if;
  return v::date;
end
$$;

create or replace function public.collection_create_catalog_entry(
  p_item jsonb,
  p_accession jsonb,
  p_reason text,
  p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m uuid := public.current_user_museum_id();
  existing public.collection_accessions;
  existing_item public.collection_items;
  saved_item public.collection_items;
  saved_accession public.collection_accessions;
  d jsonb := coalesce(p_item->'details', '{}'::jsonb);
  k text;
  v_modality text;
  v_status text;
  v_ownership text;
  v_custody text;
  v_number text;
  v_file text;
  v_actor text;
  v_title text;
  v_description text;
  v_category text;
  v_location text;
  v_condition text;
  v_item_status text;
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
  if p_request_id is null then
    raise exception 'REQUEST_ID_REQUIRED' using errcode = '22023';
  end if;

  select * into existing
  from public.collection_accessions
  where museum_id = m and client_request_id = p_request_id;
  if found then
    select * into existing_item
    from public.collection_items
    where id = existing.collection_item_id and museum_id = m;
    return jsonb_build_object(
      'item', to_jsonb(existing_item),
      'accession', to_jsonb(existing),
      'replayed', true
    );
  end if;

  if p_item is null or jsonb_typeof(p_item) <> 'object' or p_accession is null or jsonb_typeof(p_accession) <> 'object' then
    raise exception 'INVALID_ACCESSION' using errcode = '22023';
  end if;
  if p_accession ? 'contract_snapshot' and p_accession->'contract_snapshot' is not null
     and jsonb_typeof(p_accession->'contract_snapshot') <> 'null' then
    raise exception 'CONTRACT_SNAPSHOT_LATER' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 2000 then
    raise exception 'CHANGE_REASON_REQUIRED' using errcode = '22023';
  end if;
  if jsonb_typeof(d) <> 'object' then
    raise exception 'INVALID_DETAILS' using errcode = '22023';
  end if;
  for k in select jsonb_object_keys(d) loop
    if k not in (
      'author','dating','materials','dimensions','provenance','owner','acquisition','custody','donor',
      'owner_phone','owner_email','owner_address','lender','received_date','fmv','currency','loan_reference',
      'notes','cultural_history','personal_object_description','object_type_specification'
    ) or jsonb_typeof(d->k) not in ('string', 'null') then
      raise exception 'INVALID_DETAILS' using errcode = '22023';
    end if;
  end loop;

  v_modality := btrim(coalesce(p_accession->>'modality', ''));
  if v_modality not in ('catalogacion_directa', 'prestamo_temporal', 'donacion_permanente') then
    raise exception 'INVALID_MODALITY' using errcode = '22023';
  end if;
  v_status := coalesce(nullif(btrim(coalesce(p_accession->>'status', '')), ''), 'borrador');
  if v_status <> 'borrador' then
    raise exception 'FORMALIZATION_LATER' using errcode = '22023';
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

  if v_modality = 'prestamo_temporal' then
    if v_party is null or v_email is null or v_phone is null or v_address is null then
      raise exception 'PARTY_REQUIRED' using errcode = '22023';
    end if;
    if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'PARTY_EMAIL_INVALID' using errcode = '22023';
    end if;
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
    v_ownership := 'externa';
    v_custody := 'pendiente';
    v_purpose := nullif(array_to_string(array(select jsonb_array_elements_text(v_purposes)), ', '), '');
  elsif v_modality = 'donacion_permanente' then
    if v_party is null or v_email is null or v_phone is null or v_address is null then
      raise exception 'PARTY_REQUIRED' using errcode = '22023';
    end if;
    if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'PARTY_EMAIL_INVALID' using errcode = '22023';
    end if;
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
    v_ownership := 'pendiente';
    v_custody := 'pendiente';
  else
    v_purposes := '[]'::jsonb;
    v_purpose := null;
    v_purpose_details := null;
    v_activity_name := null;
    v_activity_on := null;
    v_activity_location := null;
    v_party := null;
    v_entity := null;
    v_email := null;
    v_phone := null;
    v_address := null;
    v_started := null;
    v_return := null;
    v_ownership := 'museo';
    v_custody := 'museo';
    if coalesce(btrim(d->>'owner'), '') = '' then
      d := jsonb_set(d, '{owner}', to_jsonb('Museo'::text));
    end if;
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
  elsif coalesce(d->>'fmv', '') <> '' and ((d->>'fmv')::numeric < 0 or (d->>'fmv')::numeric > 999999999999.99) then
    raise exception 'INVALID_FMV' using errcode = '22023';
  end if;
  if v_conservation is not null and coalesce(btrim(d->>'notes'), '') = '' then
    d := jsonb_set(d, '{notes}', to_jsonb(v_conservation));
  end if;
  if v_modality = 'prestamo_temporal' then
    d := jsonb_set(d, '{lender}', to_jsonb(v_party));
    d := jsonb_set(d, '{owner}', to_jsonb('Propiedad externa'::text));
    d := jsonb_set(d, '{acquisition}', to_jsonb('Préstamo temporal'::text));
    d := jsonb_set(d, '{owner_email}', to_jsonb(v_email));
    d := jsonb_set(d, '{owner_phone}', to_jsonb(v_phone));
    d := jsonb_set(d, '{owner_address}', to_jsonb(v_address));
    if v_started is not null then
      d := jsonb_set(d, '{received_date}', to_jsonb(to_char(v_started, 'YYYY-MM-DD')));
    end if;
  elsif v_modality = 'donacion_permanente' then
    d := jsonb_set(d, '{donor}', to_jsonb(v_party));
    d := jsonb_set(d, '{owner}', to_jsonb('Pendiente de formalización'::text));
    d := jsonb_set(d, '{acquisition}', to_jsonb('Donación permanente'::text));
    d := jsonb_set(d, '{owner_email}', to_jsonb(v_email));
    d := jsonb_set(d, '{owner_phone}', to_jsonb(v_phone));
    d := jsonb_set(d, '{owner_address}', to_jsonb(v_address));
    d := jsonb_set(d, '{received_date}', to_jsonb(to_char(v_started, 'YYYY-MM-DD')));
  elsif coalesce(btrim(d->>'acquisition'), '') = '' then
    d := jsonb_set(d, '{acquisition}', to_jsonb('Catalogación directa'::text));
  end if;
  if coalesce(d->>'received_date', '') <> '' then
    perform (d->>'received_date')::date;
  end if;

  v_actor := coalesce((select full_name from public.profiles where id = auth.uid()), 'Catalogador');

  begin
    v_number := public.collection_allocate_inventory_number();
    insert into public.collection_items (
      museum_id, accession_number, title, description, category, location, condition, details, status, created_by, updated_by
    ) values (
      m, v_number, v_title, v_description, v_category, v_location, v_condition, d, v_item_status, auth.uid(), auth.uid()
    ) returning * into saved_item;

    insert into public.collection_history (
      museum_id, item_id, actor_id, actor_name, action, reason, before_value, after_value
    ) values (
      m, saved_item.id, auth.uid(), v_actor, 'registro', btrim(p_reason), null, to_jsonb(saved_item)
    );

    v_file := public.collection_allocate_ingress_file_number();
    insert into public.collection_accessions (
      museum_id, collection_item_id, file_number, modality, status, ownership_status, custody_status,
      party_name, party_entity, party_email, party_phone, party_address, started_on, expected_return_on, returned_on,
      purpose, purpose_details, purposes, activity_name, activity_on, activity_location,
      height, height_unit, width, width_unit, depth, depth_unit, weight, weight_unit, other_measurements,
      physical_condition, conservation_notes, estimated_value, currency, created_by, updated_by, client_request_id
    ) values (
      m, saved_item.id, v_file, v_modality, 'borrador', v_ownership, v_custody,
      v_party, v_entity, v_email, v_phone, v_address, v_started, v_return, null,
      v_purpose, v_purpose_details, v_purposes, v_activity_name, v_activity_on, v_activity_location,
      v_height, v_height_unit, v_width, v_width_unit, v_depth, v_depth_unit, v_weight, v_weight_unit, v_other,
      v_condition, v_conservation, v_value, 'USD', auth.uid(), auth.uid(), p_request_id
    ) returning * into saved_accession;

    insert into public.collection_accession_events (
      museum_id, accession_id, item_id, actor_id, actor_name, action, reason, after_value
    ) values (
      m, saved_accession.id, saved_item.id, auth.uid(), v_actor, 'expediente_creado',
      'Expediente de ingreso creado.', to_jsonb(saved_accession)
    );
  exception
    when unique_violation then
      select * into existing
      from public.collection_accessions
      where museum_id = m and client_request_id = p_request_id;
      if not found then
        raise;
      end if;
      select * into existing_item
      from public.collection_items
      where id = existing.collection_item_id and museum_id = m;
      return jsonb_build_object(
        'item', to_jsonb(existing_item),
        'accession', to_jsonb(existing),
        'replayed', true
      );
  end;

  return jsonb_build_object(
    'item', to_jsonb(saved_item),
    'accession', to_jsonb(saved_accession),
    'replayed', false
  );
end
$$;

comment on function public.collection_create_catalog_entry(jsonb, jsonb, text, uuid) is
  'Creates one collection item and its ingress record. The inventory number comes from collection_allocate_inventory_number in the same transaction. The client-supplied accession number is ignored. A repeated request id returns the original piece.';

create or replace function public.collection_attach_photo_role(
  p_id uuid,
  p_expected_version bigint,
  p_photo_id uuid,
  p_path text,
  p_caption text,
  p_role text
) returns public.collection_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.collection_items;
  photo public.collection_photos;
  v_role text := btrim(coalesce(p_role, ''));
begin
  if public.collection_can_write() is not true or not public.collection_photo_allowed(p_path, true) then
    raise exception 'COLLECTION_FORBIDDEN' using errcode = '42501';
  end if;
  if v_role not in ('frontal', 'posterior', 'lateral', 'adicional') then
    raise exception 'INVALID_PHOTO_ROLE' using errcode = '22023';
  end if;
  select * into i from public.collection_items where id = p_id and museum_id = public.current_user_museum_id() for update;
  if not found then
    raise exception 'COLLECTION_NOT_FOUND' using errcode = '42501';
  end if;
  if i.version is distinct from p_expected_version then
    raise exception 'COLLECTION_CONFLICT' using errcode = 'PT409';
  end if;
  if (select count(*) from public.collection_active_photos where item_id = i.id) >= 4 then
    raise exception 'COLLECTION_PHOTO_LIMIT' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.collection_photo_roles r
    join public.collection_active_photos p on p.id = r.photo_id
    where r.item_id = i.id and r.role = v_role
  ) then
    raise exception 'PHOTO_ROLE_IN_USE' using errcode = '22023';
  end if;
  if (storage.foldername(p_path))[2] <> p_id::text
     or split_part(storage.filename(p_path), '.', 1) <> p_photo_id::text
     or not exists (select 1 from storage.objects where bucket_id = 'collection-photos' and name = p_path) then
    raise exception 'PHOTO_NOT_FOUND' using errcode = '22023';
  end if;
  insert into public.collection_photos (id, museum_id, item_id, path, caption, created_by)
  values (p_photo_id, i.museum_id, i.id, p_path, coalesce(p_caption, ''), auth.uid())
  returning * into photo;
  insert into public.collection_photo_roles (photo_id, museum_id, item_id, role, created_by)
  values (photo.id, i.museum_id, i.id, v_role, auth.uid());
  update public.collection_items
  set version = version + 1, updated_at = now(), updated_by = auth.uid()
  where id = i.id
  returning * into i;
  insert into public.collection_history (museum_id, item_id, actor_id, actor_name, action, reason, after_value)
  values (
    i.museum_id, i.id, auth.uid(),
    coalesce((select full_name from public.profiles where id = auth.uid()), 'Catalogador'),
    'fotografia', 'Fotografía añadida; se conserva la evidencia anterior.', to_jsonb(photo)
  );
  return i;
end
$$;

comment on function public.collection_attach_photo_role(uuid, bigint, uuid, text, text, text) is
  'Attaches one new collection_photos row and records its role. Does not update existing photograph rows or historical roles.';

create table if not exists public.collection_accession_signatures (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete restrict,
  accession_id uuid not null,
  signer_name text not null check (length(btrim(signer_name)) between 1 and 300),
  signer_role text not null check (signer_role in ('propietario', 'donante', 'representante_museo', 'director', 'testigo', 'otro')),
  signed_at timestamptz,
  capture_method text not null check (capture_method in ('wacom-stu-540', 'pointer', 'touch', 'stylus', 'mouse')),
  visual jsonb not null default '{}'::jsonb check (jsonb_typeof(visual) = 'object' and octet_length(visual::text) <= 500000),
  integrity jsonb not null default '{}'::jsonb check (jsonb_typeof(integrity) = 'object' and octet_length(integrity::text) <= 50000),
  status text not null default 'pendiente' check (status in ('pendiente', 'capturada', 'rechazada')),
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (museum_id, accession_id) references public.collection_accessions (museum_id, id) on delete restrict
);

comment on table public.collection_accession_signatures is
  'Prepared signature record. visual may hold strokes, a vector trace, or an image and is not limited to PNG. Phase 2 does not grant inserts.';

comment on column public.collection_accession_signatures.capture_method is
  'wacom-stu-540 is the institutional pad. pointer, touch, stylus, and mouse are the software fallback.';

create or replace function public.collection_signature_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Signature records cannot be rewritten in this phase.' using errcode = '42501';
end
$$;

drop trigger if exists collection_signature_no_rewrite on public.collection_accession_signatures;
create trigger collection_signature_no_rewrite
  before update or delete on public.collection_accession_signatures
  for each row execute function public.collection_signature_guard();

alter table public.collection_accession_signatures enable row level security;
revoke all on public.collection_accession_signatures from public, anon, authenticated;
grant select on public.collection_accession_signatures to authenticated;

drop policy if exists collection_accession_signatures_read on public.collection_accession_signatures;
create policy collection_accession_signatures_read on public.collection_accession_signatures
  for select to authenticated
  using (museum_id = public.current_user_museum_id() and public.collection_can_read());
drop policy if exists collection_accession_signatures_boundary on public.collection_accession_signatures;
create policy collection_accession_signatures_boundary on public.collection_accession_signatures
  as restrictive for all to authenticated
  using (public.module_profile_allows('collections'))
  with check (public.module_profile_allows('collections'));

revoke all on function public.collection_measure(text) from public, anon, authenticated;
revoke all on function public.collection_intake_date(text) from public, anon, authenticated;
revoke all on function public.collection_accession_request_guard() from public, anon, authenticated;
revoke all on function public.collection_signature_guard() from public, anon, authenticated;
revoke all on function public.collection_allocate_inventory_number() from public, anon, authenticated;
revoke all on function public.collection_allocate_ingress_file_number() from public, anon, authenticated;
revoke all on function public.collection_accession_save(uuid, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.collection_create_catalog_entry(jsonb, jsonb, text, uuid) from public, anon;
revoke all on function public.collection_attach_photo_role(uuid, bigint, uuid, text, text, text) from public, anon;
revoke all on function public.collection_attach_accession_file(uuid, uuid, text, text, text) from public, anon;

grant execute on function public.collection_create_catalog_entry(jsonb, jsonb, text, uuid) to authenticated;
grant execute on function public.collection_attach_photo_role(uuid, bigint, uuid, text, text, text) to authenticated;
grant execute on function public.collection_attach_accession_file(uuid, uuid, text, text, text) to authenticated;

insert into supabase_migrations.schema_migrations (version, name)
select '202610050002', 'collection_intake_create'
where not exists (
  select 1 from supabase_migrations.schema_migrations where version = '202610050002'
);

notify pgrst, 'reload schema';
commit;
