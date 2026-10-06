-- Additive ingress architecture for the existing collection catalog.
-- Does not update, delete, renumber, or reload collection_items, collection_photos,
-- collection_history, app_records, or the collection-photos bucket.
-- The institutional sequence continues forward from the highest parsed consecutive.
-- It does not fill gaps. The calendar year is part of the visible number and does
-- not restart the consecutive.
begin;

create or replace function public.collection_parse_inventory_sequence(p_number text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_number is null then null
    when btrim(p_number) ~ '^(MMPR|MMPE)- ?[0-9]+-[0-9]{4}$'
      then (regexp_match(btrim(p_number), '^(?:MMPR|MMPE)- ?([0-9]+)-[0-9]{4}$'))[1]::integer
    else null
  end
$$;

create or replace function public.collection_format_inventory_number(p_sequence integer, p_year integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_sequence between 1 and 9999 and p_year between 1000 and 9999
      then 'MMPR-' || lpad(p_sequence::text, 4, '0') || '-' || p_year::text
    else null
  end
$$;

comment on function public.collection_parse_inventory_sequence(text) is
  'Reads an institutional consecutive, including the historical forms MMPR- 0040-2026, MMPR-0144-2016 and MMPE-0166-2026. Does not rewrite the stored number.';

comment on function public.collection_format_inventory_number(integer, integer) is
  'Formats MMPR-0000-0000. The year argument is display only; callers must not reset the sequence when the year changes.';

create table if not exists public.collection_number_state (
  museum_id uuid primary key references public.museums(id) on delete restrict,
  inventory_sequence integer not null check (inventory_sequence between 0 and 9999),
  ingress_sequence integer not null default 0 check (ingress_sequence between 0 and 9999),
  updated_at timestamptz not null default now()
);

create table if not exists public.collection_accessions (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete restrict,
  collection_item_id uuid references public.collection_items(id) on delete restrict,
  file_number text not null check (file_number ~ '^ING-[0-9]{4}-[0-9]{4}$'),
  modality text not null check (modality in ('catalogacion_directa', 'prestamo_temporal', 'donacion_permanente')),
  status text not null default 'borrador' check (status in ('borrador', 'pendiente_firmas', 'formalizado', 'recibido', 'devuelto', 'cerrado')),
  ownership_status text not null default 'pendiente' check (ownership_status in ('pendiente', 'externa', 'museo')),
  custody_status text not null default 'pendiente' check (custody_status in ('pendiente', 'externa', 'museo')),
  party_name text check (party_name is null or length(party_name) <= 1000),
  party_entity text check (party_entity is null or length(party_entity) <= 1000),
  party_email text check (party_email is null or length(party_email) <= 300),
  party_phone text check (party_phone is null or length(party_phone) <= 100),
  party_address text check (party_address is null or length(party_address) <= 2000),
  started_on date,
  expected_return_on date,
  returned_on date,
  purpose text check (purpose is null or length(purpose) <= 2000),
  purpose_details text check (purpose_details is null or length(purpose_details) <= 10000),
  purposes jsonb not null default '[]'::jsonb check (jsonb_typeof(purposes) = 'array' and octet_length(purposes::text) <= 10000),
  activity_name text check (activity_name is null or length(activity_name) <= 1000),
  activity_on date,
  activity_location text check (activity_location is null or length(activity_location) <= 1000),
  terms_reference text check (terms_reference is null or length(terms_reference) <= 500),
  terms_version text check (terms_version is null or length(terms_version) <= 100),
  contract_snapshot jsonb,
  contract_snapshot_at timestamptz,
  height numeric check (height is null or height >= 0),
  height_unit text check (height_unit is null or height_unit in ('cm', 'pulg.')),
  width numeric check (width is null or width >= 0),
  width_unit text check (width_unit is null or width_unit in ('cm', 'pulg.')),
  depth numeric check (depth is null or depth >= 0),
  depth_unit text check (depth_unit is null or depth_unit in ('cm', 'pulg.')),
  weight numeric check (weight is null or weight >= 0),
  weight_unit text check (weight_unit is null or weight_unit in ('lb', 'kg')),
  other_measurements text check (other_measurements is null or length(other_measurements) <= 10000),
  physical_condition text check (physical_condition is null or physical_condition in ('Excelente', 'Buena', 'Regular', 'Mala', 'Requiere evaluación')),
  conservation_notes text check (conservation_notes is null or length(conservation_notes) <= 10000),
  estimated_value numeric check (estimated_value is null or (estimated_value >= 0 and estimated_value <= 999999999999.99)),
  currency text not null default 'USD' check (currency = 'USD'),
  notes text check (notes is null or length(notes) <= 10000),
  version bigint not null default 1,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (museum_id, file_number),
  check (contract_snapshot is null or jsonb_typeof(contract_snapshot) = 'object'),
  check ((contract_snapshot is null and contract_snapshot_at is null) or (contract_snapshot is not null and contract_snapshot_at is not null)),
  check (octet_length(coalesce(contract_snapshot, '{}'::jsonb)::text) <= 200000),
  check (modality <> 'prestamo_temporal' or ownership_status in ('pendiente', 'externa')),
  check (modality <> 'donacion_permanente' or ownership_status <> 'museo' or contract_snapshot is not null),
  check (expected_return_on is null or modality = 'prestamo_temporal'),
  check (returned_on is null or modality = 'prestamo_temporal'),
  check (status <> 'devuelto' or modality = 'prestamo_temporal'),
  check (expected_return_on is null or started_on is null or expected_return_on >= started_on),
  check (returned_on is null or started_on is null or returned_on >= started_on)
);

comment on table public.collection_accessions is
  'Ingress act for a collection piece. Distinct from collection_items.status and from the permanent inventory number. A donation does not become museum ownership until a contract snapshot exists.';

comment on column public.collection_accessions.file_number is
  'Ingress file identifier ING-YYYY-####. Not the permanent inventory number.';

comment on column public.collection_accessions.contract_snapshot is
  'Immutable copy of the formalized agreement. Later edits to the museographic item must not rewrite this document.';

create index if not exists collection_accessions_item
  on public.collection_accessions (museum_id, collection_item_id);

do $accession_key$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'collection_accessions_museum_id_key'
      and conrelid = 'public.collection_accessions'::regclass
  ) then
    alter table public.collection_accessions
      add constraint collection_accessions_museum_id_key unique (museum_id, id);
  end if;
end
$accession_key$;

create table if not exists public.collection_accession_events (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete restrict,
  accession_id uuid not null references public.collection_accessions(id) on delete restrict,
  item_id uuid references public.collection_items(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  actor_name text not null,
  occurred_at timestamptz not null default now(),
  action text not null check (action in (
    'expediente_creado', 'formalizado', 'pieza_recibida', 'ubicacion_inicial',
    'devolucion', 'cierre', 'vinculo_pieza', 'anexo'
  )),
  reason text not null check (length(btrim(reason)) between 3 and 2000),
  before_value jsonb,
  after_value jsonb not null
);

create index if not exists collection_accession_events_accession
  on public.collection_accession_events (accession_id, occurred_at, id);

create table if not exists public.collection_accession_attachments (
  id uuid primary key,
  museum_id uuid not null references public.museums(id) on delete restrict,
  accession_id uuid not null references public.collection_accessions(id) on delete restrict,
  kind text not null check (kind in ('inventario_adicional', 'seguro', 'tasacion', 'otro')),
  description text not null default '' check (length(description) <= 2000),
  path text not null unique,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (kind <> 'otro' or length(btrim(description)) between 1 and 2000),
  check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$'),
  foreign key (museum_id, accession_id) references public.collection_accessions (museum_id, id) on delete restrict
);

create table if not exists public.collection_photo_roles (
  photo_id uuid primary key,
  museum_id uuid not null,
  item_id uuid not null,
  role text not null check (role in ('frontal', 'posterior', 'lateral', 'adicional')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (museum_id, item_id, photo_id)
    references public.collection_photos (museum_id, item_id, id) on delete restrict
);

comment on table public.collection_photo_roles is
  'Optional role for a new collection photo. Does not alter collection_photos paths, bytes, or historical rows.';

comment on table public.collection_accession_attachments is
  'Documents of an ingress act. Museographic photographs stay in collection_photos and are not stored here.';

create or replace function public.collection_accession_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Patrimonial records and evidence cannot be deleted or rewritten.' using errcode = '42501';
  end if;
  if new.museum_id is distinct from old.museum_id
     or new.file_number is distinct from old.file_number
     or new.modality is distinct from old.modality
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or new.id is distinct from old.id
  then
    raise exception 'ACCESSION_IDENTITY_IMMUTABLE' using errcode = '42501';
  end if;
  if old.collection_item_id is not null and new.collection_item_id is distinct from old.collection_item_id then
    raise exception 'ACCESSION_ITEM_LINK_IMMUTABLE' using errcode = '42501';
  end if;
  if old.contract_snapshot is not null and (
    new.contract_snapshot is distinct from old.contract_snapshot
    or new.contract_snapshot_at is distinct from old.contract_snapshot_at
    or new.ownership_status is distinct from old.ownership_status
    or new.party_name is distinct from old.party_name
    or new.party_entity is distinct from old.party_entity
    or new.party_email is distinct from old.party_email
    or new.party_phone is distinct from old.party_phone
    or new.party_address is distinct from old.party_address
    or new.started_on is distinct from old.started_on
    or new.expected_return_on is distinct from old.expected_return_on
    or new.purpose is distinct from old.purpose
    or new.purpose_details is distinct from old.purpose_details
    or new.purposes is distinct from old.purposes
    or new.activity_name is distinct from old.activity_name
    or new.activity_on is distinct from old.activity_on
    or new.activity_location is distinct from old.activity_location
    or new.terms_reference is distinct from old.terms_reference
    or new.terms_version is distinct from old.terms_version
    or new.height is distinct from old.height
    or new.height_unit is distinct from old.height_unit
    or new.width is distinct from old.width
    or new.width_unit is distinct from old.width_unit
    or new.depth is distinct from old.depth
    or new.depth_unit is distinct from old.depth_unit
    or new.weight is distinct from old.weight
    or new.weight_unit is distinct from old.weight_unit
    or new.other_measurements is distinct from old.other_measurements
    or new.physical_condition is distinct from old.physical_condition
    or new.conservation_notes is distinct from old.conservation_notes
    or new.estimated_value is distinct from old.estimated_value
    or new.currency is distinct from old.currency
  ) then
    raise exception 'CONTRACT_SNAPSHOT_IMMUTABLE' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists collection_accession_guard on public.collection_accessions;
create trigger collection_accession_guard
  before update or delete on public.collection_accessions
  for each row execute function public.collection_accession_guard();

drop trigger if exists collection_accession_events_immutable on public.collection_accession_events;
create trigger collection_accession_events_immutable
  before update or delete on public.collection_accession_events
  for each row execute function public.collection_immutable();

drop trigger if exists collection_accession_attachments_immutable on public.collection_accession_attachments;
create trigger collection_accession_attachments_immutable
  before update or delete on public.collection_accession_attachments
  for each row execute function public.collection_immutable();

drop trigger if exists collection_photo_roles_immutable on public.collection_photo_roles;
create trigger collection_photo_roles_immutable
  before update or delete on public.collection_photo_roles
  for each row execute function public.collection_immutable();

create or replace function public.collection_allocate_inventory_number()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  m uuid := public.current_user_museum_id();
  scanned integer;
  current_value integer;
  allocated integer;
  yr integer;
  result text;
begin
  if m is null or public.collection_can_write() is not true then
    raise exception 'COLLECTION_FORBIDDEN' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(814201, hashtext(m::text));
  select coalesce(max(public.collection_parse_inventory_sequence(accession_number)), 0)
    into scanned
  from public.collection_items
  where museum_id = m;
  insert into public.collection_number_state (museum_id, inventory_sequence, ingress_sequence)
  values (m, scanned, 0)
  on conflict (museum_id) do nothing;
  select inventory_sequence into current_value
  from public.collection_number_state
  where museum_id = m
  for update;
  allocated := greatest(current_value, scanned) + 1;
  if allocated > 9999 then
    raise exception 'INVENTORY_SEQUENCE_EXHAUSTED' using errcode = '22023';
  end if;
  yr := extract(year from (now() at time zone 'America/Puerto_Rico'))::integer;
  result := public.collection_format_inventory_number(allocated, yr);
  if result is null then
    raise exception 'INVENTORY_NUMBER_INVALID' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.collection_items
    where museum_id = m and lower(btrim(accession_number)) = lower(result)
  ) then
    raise exception 'INVENTORY_NUMBER_COLLISION' using errcode = '23505';
  end if;
  update public.collection_number_state
  set inventory_sequence = allocated, updated_at = now()
  where museum_id = m;
  return result;
end
$$;

comment on function public.collection_allocate_inventory_number() is
  'Atomically reserves the next inventory number after the highest parsed consecutive. Does not look for gaps and does not reset the consecutive on 1 January. The visible year is America/Puerto_Rico at allocation. Does not insert a collection item.';

create or replace function public.collection_allocate_ingress_file_number()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  m uuid := public.current_user_museum_id();
  allocated integer;
  yr integer;
  result text;
begin
  if m is null or public.collection_can_write() is not true then
    raise exception 'COLLECTION_FORBIDDEN' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(814202, hashtext(m::text));
  insert into public.collection_number_state (museum_id, inventory_sequence, ingress_sequence)
  values (m, 0, 0)
  on conflict (museum_id) do nothing;
  select ingress_sequence + 1 into allocated
  from public.collection_number_state
  where museum_id = m
  for update;
  if allocated > 9999 then
    raise exception 'INGRESS_SEQUENCE_EXHAUSTED' using errcode = '22023';
  end if;
  yr := extract(year from (now() at time zone 'America/Puerto_Rico'))::integer;
  result := 'ING-' || yr::text || '-' || lpad(allocated::text, 4, '0');
  update public.collection_number_state
  set ingress_sequence = allocated, updated_at = now()
  where museum_id = m;
  return result;
end
$$;

comment on function public.collection_allocate_ingress_file_number() is
  'Atomically reserves ING-YYYY-####. This sequence is independent of the inventory number and does not restart when the year changes.';

create or replace function public.collection_accession_file_allowed(object_name text, writing boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and case when writing then public.collection_can_write() else public.collection_can_read() end
    and object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$'
    and (storage.foldername(object_name))[1] = public.current_user_museum_id()::text
    and exists (
      select 1 from public.collection_accessions a
      where a.museum_id = public.current_user_museum_id()
        and a.id::text = (storage.foldername(object_name))[2]
    )
$$;

create or replace function public.collection_accession_save(p_id uuid, p_expected_version bigint, p_accession jsonb)
returns public.collection_accessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  m uuid := public.current_user_museum_id();
  saved public.collection_accessions;
  prev public.collection_accessions;
  v_modality text;
  v_status text;
  v_ownership text;
  v_custody text;
  v_item uuid;
  v_purposes jsonb;
  purpose_key text;
begin
  if m is null or public.collection_can_write() is not true then
    raise exception 'COLLECTION_FORBIDDEN' using errcode = '42501';
  end if;
  if p_accession is null or jsonb_typeof(p_accession) <> 'object' then
    raise exception 'INVALID_ACCESSION' using errcode = '22023';
  end if;
  if p_accession ? 'contract_snapshot' and p_accession->'contract_snapshot' is not null
     and jsonb_typeof(p_accession->'contract_snapshot') <> 'null' then
    raise exception 'CONTRACT_SNAPSHOT_LATER' using errcode = '22023';
  end if;
  v_modality := btrim(coalesce(p_accession->>'modality', ''));
  if v_modality not in ('catalogacion_directa', 'prestamo_temporal', 'donacion_permanente') then
    raise exception 'INVALID_MODALITY' using errcode = '22023';
  end if;
  v_status := coalesce(nullif(btrim(coalesce(p_accession->>'status', '')), ''), 'borrador');
  if v_status not in ('borrador', 'pendiente_firmas', 'formalizado', 'recibido', 'devuelto', 'cerrado') then
    raise exception 'INVALID_ACCESSION_STATUS' using errcode = '22023';
  end if;
  v_ownership := coalesce(nullif(btrim(coalesce(p_accession->>'ownership_status', '')), ''), 'pendiente');
  v_custody := coalesce(nullif(btrim(coalesce(p_accession->>'custody_status', '')), ''), 'pendiente');
  if v_modality = 'prestamo_temporal' and v_ownership = 'museo' then
    raise exception 'LOAN_DOES_NOT_TRANSFER_OWNERSHIP' using errcode = '22023';
  end if;
  if v_modality = 'prestamo_temporal' and v_ownership = 'pendiente' then
    v_ownership := 'externa';
  end if;
  if v_modality = 'donacion_permanente' and v_ownership = 'museo' then
    raise exception 'DONATION_OWNERSHIP_REQUIRES_FORMALIZATION' using errcode = '22023';
  end if;
  if v_modality <> 'prestamo_temporal' and v_status = 'devuelto' then
    raise exception 'RETURN_STATUS_REQUIRES_LOAN' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_accession->>'collection_item_id', '')), '') is null then
    v_item := null;
  else
    v_item := (p_accession->>'collection_item_id')::uuid;
    if not exists (select 1 from public.collection_items i where i.id = v_item and i.museum_id = m) then
      raise exception 'COLLECTION_NOT_FOUND' using errcode = '42501';
    end if;
  end if;
  v_purposes := coalesce(p_accession->'purposes', '[]'::jsonb);
  if jsonb_typeof(v_purposes) <> 'array' then
    raise exception 'INVALID_PURPOSES' using errcode = '22023';
  end if;
  for purpose_key in select jsonb_array_elements_text(v_purposes) loop
    if length(purpose_key) > 200 then
      raise exception 'INVALID_PURPOSES' using errcode = '22023';
    end if;
  end loop;
  if p_id is null then
    if p_expected_version is not null then
      raise exception 'INVALID_VERSION' using errcode = '22023';
    end if;
    insert into public.collection_accessions (
      museum_id, collection_item_id, file_number, modality, status, ownership_status, custody_status,
      party_name, party_entity, party_email, party_phone, party_address, started_on, expected_return_on, returned_on,
      purpose, purpose_details, purposes, activity_name, activity_on, activity_location, terms_reference, terms_version,
      height, height_unit, width, width_unit, depth, depth_unit, weight, weight_unit, other_measurements,
      physical_condition, conservation_notes, estimated_value, currency, notes, created_by, updated_by
    ) values (
      m, v_item, public.collection_allocate_ingress_file_number(), v_modality, v_status, v_ownership, v_custody,
      nullif(btrim(coalesce(p_accession->>'party_name', '')), ''),
      nullif(btrim(coalesce(p_accession->>'party_entity', '')), ''),
      nullif(btrim(coalesce(p_accession->>'party_email', '')), ''),
      nullif(btrim(coalesce(p_accession->>'party_phone', '')), ''),
      nullif(btrim(coalesce(p_accession->>'party_address', '')), ''),
      nullif(btrim(coalesce(p_accession->>'started_on', '')), '')::date,
      case when v_modality = 'prestamo_temporal' then nullif(btrim(coalesce(p_accession->>'expected_return_on', '')), '')::date else null end,
      case when v_modality = 'prestamo_temporal' then nullif(btrim(coalesce(p_accession->>'returned_on', '')), '')::date else null end,
      nullif(btrim(coalesce(p_accession->>'purpose', '')), ''),
      nullif(btrim(coalesce(p_accession->>'purpose_details', '')), ''),
      v_purposes,
      nullif(btrim(coalesce(p_accession->>'activity_name', '')), ''),
      nullif(btrim(coalesce(p_accession->>'activity_on', '')), '')::date,
      nullif(btrim(coalesce(p_accession->>'activity_location', '')), ''),
      nullif(btrim(coalesce(p_accession->>'terms_reference', '')), ''),
      nullif(btrim(coalesce(p_accession->>'terms_version', '')), ''),
      nullif(btrim(coalesce(p_accession->>'height', '')), '')::numeric,
      nullif(btrim(coalesce(p_accession->>'height_unit', '')), ''),
      nullif(btrim(coalesce(p_accession->>'width', '')), '')::numeric,
      nullif(btrim(coalesce(p_accession->>'width_unit', '')), ''),
      nullif(btrim(coalesce(p_accession->>'depth', '')), '')::numeric,
      nullif(btrim(coalesce(p_accession->>'depth_unit', '')), ''),
      nullif(btrim(coalesce(p_accession->>'weight', '')), '')::numeric,
      nullif(btrim(coalesce(p_accession->>'weight_unit', '')), ''),
      nullif(btrim(coalesce(p_accession->>'other_measurements', '')), ''),
      nullif(btrim(coalesce(p_accession->>'physical_condition', '')), ''),
      nullif(btrim(coalesce(p_accession->>'conservation_notes', '')), ''),
      nullif(btrim(coalesce(p_accession->>'estimated_value', '')), '')::numeric,
      'USD',
      nullif(btrim(coalesce(p_accession->>'notes', '')), ''),
      auth.uid(), auth.uid()
    ) returning * into saved;
    insert into public.collection_accession_events (
      museum_id, accession_id, item_id, actor_id, actor_name, action, reason, after_value
    ) values (
      m, saved.id, saved.collection_item_id, auth.uid(),
      coalesce((select full_name from public.profiles where id = auth.uid()), 'Catalogador'),
      'expediente_creado', 'Expediente de ingreso creado.', to_jsonb(saved)
    );
    return saved;
  end if;
  select * into prev
  from public.collection_accessions
  where id = p_id and museum_id = m
  for update;
  if not found then
    raise exception 'ACCESSION_NOT_FOUND' using errcode = '42501';
  end if;
  if p_expected_version is distinct from prev.version then
    raise exception 'ACCESSION_CONFLICT' using errcode = 'PT409';
  end if;
  if prev.contract_snapshot is not null then
    raise exception 'CONTRACT_SNAPSHOT_IMMUTABLE' using errcode = '42501';
  end if;
  if v_modality is distinct from prev.modality then
    raise exception 'ACCESSION_IDENTITY_IMMUTABLE' using errcode = '42501';
  end if;
  update public.collection_accessions set
    collection_item_id = v_item,
    status = v_status,
    ownership_status = v_ownership,
    custody_status = v_custody,
    party_name = nullif(btrim(coalesce(p_accession->>'party_name', '')), ''),
    party_entity = nullif(btrim(coalesce(p_accession->>'party_entity', '')), ''),
    party_email = nullif(btrim(coalesce(p_accession->>'party_email', '')), ''),
    party_phone = nullif(btrim(coalesce(p_accession->>'party_phone', '')), ''),
    party_address = nullif(btrim(coalesce(p_accession->>'party_address', '')), ''),
    started_on = nullif(btrim(coalesce(p_accession->>'started_on', '')), '')::date,
    expected_return_on = case when v_modality = 'prestamo_temporal' then nullif(btrim(coalesce(p_accession->>'expected_return_on', '')), '')::date else null end,
    returned_on = case when v_modality = 'prestamo_temporal' then nullif(btrim(coalesce(p_accession->>'returned_on', '')), '')::date else null end,
    purpose = nullif(btrim(coalesce(p_accession->>'purpose', '')), ''),
    purpose_details = nullif(btrim(coalesce(p_accession->>'purpose_details', '')), ''),
    purposes = v_purposes,
    activity_name = nullif(btrim(coalesce(p_accession->>'activity_name', '')), ''),
    activity_on = nullif(btrim(coalesce(p_accession->>'activity_on', '')), '')::date,
    activity_location = nullif(btrim(coalesce(p_accession->>'activity_location', '')), ''),
    terms_reference = nullif(btrim(coalesce(p_accession->>'terms_reference', '')), ''),
    terms_version = nullif(btrim(coalesce(p_accession->>'terms_version', '')), ''),
    height = nullif(btrim(coalesce(p_accession->>'height', '')), '')::numeric,
    height_unit = nullif(btrim(coalesce(p_accession->>'height_unit', '')), ''),
    width = nullif(btrim(coalesce(p_accession->>'width', '')), '')::numeric,
    width_unit = nullif(btrim(coalesce(p_accession->>'width_unit', '')), ''),
    depth = nullif(btrim(coalesce(p_accession->>'depth', '')), '')::numeric,
    depth_unit = nullif(btrim(coalesce(p_accession->>'depth_unit', '')), ''),
    weight = nullif(btrim(coalesce(p_accession->>'weight', '')), '')::numeric,
    weight_unit = nullif(btrim(coalesce(p_accession->>'weight_unit', '')), ''),
    other_measurements = nullif(btrim(coalesce(p_accession->>'other_measurements', '')), ''),
    physical_condition = nullif(btrim(coalesce(p_accession->>'physical_condition', '')), ''),
    conservation_notes = nullif(btrim(coalesce(p_accession->>'conservation_notes', '')), ''),
    estimated_value = nullif(btrim(coalesce(p_accession->>'estimated_value', '')), '')::numeric,
    currency = 'USD',
    notes = nullif(btrim(coalesce(p_accession->>'notes', '')), ''),
    version = version + 1,
    updated_by = auth.uid()
  where id = p_id
  returning * into saved;
  if prev.collection_item_id is null and saved.collection_item_id is not null then
    insert into public.collection_accession_events (
      museum_id, accession_id, item_id, actor_id, actor_name, action, reason, before_value, after_value
    ) values (
      m, saved.id, saved.collection_item_id, auth.uid(),
      coalesce((select full_name from public.profiles where id = auth.uid()), 'Catalogador'),
      'vinculo_pieza', 'Ingreso vinculado a una pieza existente.', to_jsonb(prev), to_jsonb(saved)
    );
  end if;
  return saved;
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

alter table public.collection_number_state enable row level security;
alter table public.collection_accessions enable row level security;
alter table public.collection_accession_events enable row level security;
alter table public.collection_accession_attachments enable row level security;
alter table public.collection_photo_roles enable row level security;

revoke all on public.collection_number_state, public.collection_accessions, public.collection_accession_events,
  public.collection_accession_attachments, public.collection_photo_roles
  from public, anon, authenticated;
grant select on public.collection_number_state, public.collection_accessions, public.collection_accession_events,
  public.collection_accession_attachments, public.collection_photo_roles
  to authenticated;

drop policy if exists collection_number_state_read on public.collection_number_state;
create policy collection_number_state_read on public.collection_number_state
  for select to authenticated
  using (museum_id = public.current_user_museum_id() and public.collection_can_read());
drop policy if exists collection_number_state_boundary on public.collection_number_state;
create policy collection_number_state_boundary on public.collection_number_state
  as restrictive for all to authenticated
  using (public.module_profile_allows('collections'))
  with check (public.module_profile_allows('collections'));

drop policy if exists collection_accessions_read on public.collection_accessions;
create policy collection_accessions_read on public.collection_accessions
  for select to authenticated
  using (museum_id = public.current_user_museum_id() and public.collection_can_read());
drop policy if exists collection_accessions_boundary on public.collection_accessions;
create policy collection_accessions_boundary on public.collection_accessions
  as restrictive for all to authenticated
  using (public.module_profile_allows('collections'))
  with check (public.module_profile_allows('collections'));

drop policy if exists collection_accession_events_read on public.collection_accession_events;
create policy collection_accession_events_read on public.collection_accession_events
  for select to authenticated
  using (museum_id = public.current_user_museum_id() and public.collection_can_read());
drop policy if exists collection_accession_events_boundary on public.collection_accession_events;
create policy collection_accession_events_boundary on public.collection_accession_events
  as restrictive for all to authenticated
  using (public.module_profile_allows('collections'))
  with check (public.module_profile_allows('collections'));

drop policy if exists collection_accession_attachments_read on public.collection_accession_attachments;
create policy collection_accession_attachments_read on public.collection_accession_attachments
  for select to authenticated
  using (museum_id = public.current_user_museum_id() and public.collection_can_read());
drop policy if exists collection_accession_attachments_boundary on public.collection_accession_attachments;
create policy collection_accession_attachments_boundary on public.collection_accession_attachments
  as restrictive for all to authenticated
  using (public.module_profile_allows('collections'))
  with check (public.module_profile_allows('collections'));

drop policy if exists collection_photo_roles_read on public.collection_photo_roles;
create policy collection_photo_roles_read on public.collection_photo_roles
  for select to authenticated
  using (museum_id = public.current_user_museum_id() and public.collection_can_read());
drop policy if exists collection_photo_roles_boundary on public.collection_photo_roles;
create policy collection_photo_roles_boundary on public.collection_photo_roles
  as restrictive for all to authenticated
  using (public.module_profile_allows('collections'))
  with check (public.module_profile_allows('collections'));

revoke all on function public.collection_parse_inventory_sequence(text) from public, anon, authenticated;
revoke all on function public.collection_format_inventory_number(integer, integer) from public, anon, authenticated;
revoke all on function public.collection_allocate_inventory_number() from public, anon, authenticated;
revoke all on function public.collection_allocate_ingress_file_number() from public, anon, authenticated;
revoke all on function public.collection_accession_file_allowed(text, boolean) from public, anon, authenticated;
revoke all on function public.collection_accession_save(uuid, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.collection_attach_accession_file(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.collection_accession_guard() from public, anon, authenticated;
grant execute on function public.collection_parse_inventory_sequence(text) to authenticated;
grant execute on function public.collection_format_inventory_number(integer, integer) to authenticated;
grant execute on function public.collection_accession_file_allowed(text, boolean) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'collection-accession-files', 'collection-accession-files', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists collection_accession_files_read on storage.objects;
create policy collection_accession_files_read on storage.objects
  for select to authenticated
  using (bucket_id = 'collection-accession-files' and public.collection_accession_file_allowed(name, false));
drop policy if exists collection_accession_files_insert on storage.objects;
create policy collection_accession_files_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'collection-accession-files' and public.collection_accession_file_allowed(name, true));
drop policy if exists collection_accession_files_read_guard on storage.objects;
create policy collection_accession_files_read_guard on storage.objects
  as restrictive for select to authenticated
  using (bucket_id <> 'collection-accession-files' or public.collection_accession_file_allowed(name, false));
drop policy if exists collection_accession_files_insert_guard on storage.objects;
create policy collection_accession_files_insert_guard on storage.objects
  as restrictive for insert to authenticated
  with check (bucket_id <> 'collection-accession-files' or public.collection_accession_file_allowed(name, true));
drop policy if exists collection_accession_files_no_update on storage.objects;
create policy collection_accession_files_no_update on storage.objects
  as restrictive for update to authenticated
  using (bucket_id <> 'collection-accession-files')
  with check (bucket_id <> 'collection-accession-files');
drop policy if exists collection_accession_files_no_delete on storage.objects;
create policy collection_accession_files_no_delete on storage.objects
  as restrictive for delete to authenticated
  using (bucket_id <> 'collection-accession-files');

-- First deployment only: refuse to seed if the live catalog is not the audited snapshot.
-- This block only reads collection_items. It does not update them.
do $guard$
declare
  seeded boolean;
  item_count integer;
  max_sequence integer;
  anomaly_0040 text;
  anomaly_0144 text;
  anomaly_0166 text;
  summit text;
begin
  select exists(select 1 from public.collection_number_state) into seeded;
  if not seeded then
  select count(*) into item_count from public.collection_items;
  select coalesce(max(public.collection_parse_inventory_sequence(accession_number)), 0)
    into max_sequence from public.collection_items;
  select accession_number into anomaly_0040 from public.collection_items where id = '69abcb2e-a821-49db-84a1-5e2b65e6940e';
  select accession_number into anomaly_0144 from public.collection_items where id = '8fa64b51-34cc-4d31-b44c-2b5a3972e254';
  select accession_number into anomaly_0166 from public.collection_items where id = 'bfc7c937-e4e9-490c-b315-e76afde6e080';
  select accession_number into summit from public.collection_items where id = '7cda4c5d-049f-49ba-beb4-636beea54677';
  if item_count <> 178 or max_sequence <> 178
     or anomaly_0040 is distinct from 'MMPR- 0040-2026'
     or anomaly_0144 is distinct from 'MMPR-0144-2016'
     or anomaly_0166 is distinct from 'MMPE-0166-2026'
     or summit is distinct from 'MMPR-0178-2026'
     or exists (select 1 from public.collection_items where accession_number = 'MMPR-0179-2026')
  then
    raise exception 'PHASE1_ABORT_CATALOG_SNAPSHOT_CHANGED';
  end if;
  end if;
end
$guard$;

insert into public.collection_number_state (museum_id, inventory_sequence, ingress_sequence)
select i.museum_id, coalesce(max(public.collection_parse_inventory_sequence(i.accession_number)), 0), 0
from public.collection_items i
group by i.museum_id
on conflict (museum_id) do update
set inventory_sequence = greatest(public.collection_number_state.inventory_sequence, excluded.inventory_sequence),
    updated_at = now()
where public.collection_number_state.inventory_sequence < excluded.inventory_sequence;

insert into supabase_migrations.schema_migrations (version, name)
select '202610050001', 'collection_accessions'
where not exists (
  select 1 from supabase_migrations.schema_migrations where version = '202610050001'
);

notify pgrst, 'reload schema';
commit;
