-- Phase 4: loan return, file closure, and the structural print document.
-- devuelto and cerrado stay distinct. The return records the handover and its
-- signature. The close seals the file and does not ask for another signature.
-- Applying this file does not insert or rewrite collection_items, photos,
-- historical history rows, or storage paths, and it does not allocate a number.
-- A piece may later receive another accession. Closing a loan does not release
-- its inventory number.
begin;

alter table public.collection_accessions
  add column if not exists return_condition text,
  add column if not exists return_notes text,
  add column if not exists delivered_by uuid,
  add column if not exists delivered_by_name text,
  add column if not exists return_received_by text,
  add column if not exists returned_at timestamptz;

do $return_constraints$
declare
  cname text;
begin
  if not exists (select 1 from pg_constraint where conname = 'collection_accessions_delivered_by_fkey') then
    alter table public.collection_accessions
      add constraint collection_accessions_delivered_by_fkey
      foreign key (delivered_by) references public.profiles(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'collection_accessions_return_condition_check') then
    alter table public.collection_accessions
      add constraint collection_accessions_return_condition_check
      check (return_condition is null or return_condition in ('Excelente', 'Buena', 'Regular', 'Mala', 'Requiere evaluación'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'collection_accessions_return_notes_check') then
    alter table public.collection_accessions
      add constraint collection_accessions_return_notes_check
      check (return_notes is null or length(return_notes) <= 10000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'collection_accessions_return_received_by_check') then
    alter table public.collection_accessions
      add constraint collection_accessions_return_received_by_check
      check (return_received_by is null or length(btrim(return_received_by)) between 1 and 300);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'collection_accessions_delivered_by_name_check') then
    alter table public.collection_accessions
      add constraint collection_accessions_delivered_by_name_check
      check (delivered_by_name is null or length(btrim(delivered_by_name)) between 1 and 300);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'collection_accessions_return_state_check') then
    alter table public.collection_accessions
      add constraint collection_accessions_return_state_check
      check (
        status not in ('devuelto', 'cerrado')
        or (
          modality = 'prestamo_temporal'
          and returned_at is not null
          and return_condition is not null
          and return_received_by is not null
        )
      );
  end if;

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
      'propietario', 'donante', 'representante_museo', 'director', 'testigo', 'otro', 'receptor', 'receptor_devolucion'
    ));

  alter table public.collection_accession_signatures
    drop constraint if exists collection_accession_signatures_signature_type_check;
  alter table public.collection_accession_signatures
    add constraint collection_accession_signatures_signature_type_check
    check (signature_type in ('contractual', 'recepcion', 'devolucion'));
end
$return_constraints$;

create unique index if not exists collection_accession_return_signature
  on public.collection_accession_signatures (accession_id)
  where signature_type = 'devolucion' and status = 'capturada';

comment on column public.collection_accessions.collection_item_id is
  'One piece may have several ingress acts. Return and closure do not release the inventory number or prevent a later accession for the same item.';

comment on column public.collection_accessions.return_condition is
  'Condition observed when a temporary loan is returned. It does not replace physical_condition or the contract snapshot.';

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
    'author', item.details->>'author',
    'category', item.category,
    'conservation_notes', acc.conservation_notes,
    'currency', acc.currency,
    'dating', item.details->>'dating',
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
    'materials', item.details->>'materials',
    'modality', acc.modality,
    'object_type', item.details->>'object_type_specification',
    'other_measurements', acc.other_measurements,
    'party_address', acc.party_address,
    'party_email', acc.party_email,
    'party_entity', acc.party_entity,
    'party_name', acc.party_name,
    'party_phone', acc.party_phone,
    'personal_object_description', item.details->>'personal_object_description',
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', photo.id,
        'role', photo_role.role,
        'path', photo.path
      ) order by photo_role.role, photo.id)
      from public.collection_photo_roles photo_role
      join public.collection_photos photo
        on photo.id = photo_role.photo_id
       and photo.museum_id = photo_role.museum_id
       and photo.item_id = photo_role.item_id
      where photo_role.museum_id = item.museum_id
        and photo_role.item_id = item.id
        and not exists (
          select 1 from public.collection_photo_replacements replaced
          where replaced.old_photo_id = photo.id
        )
    ), '[]'::jsonb),
    'physical_condition', acc.physical_condition,
    'provenance', item.details->>'provenance',
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
  if old.contract_snapshot is not null and new.status is distinct from old.status then
    if old.status = 'formalizado' and new.status = 'recibido' then
      null;
    elsif old.modality = 'prestamo_temporal' and old.status = 'recibido' and new.status = 'devuelto' then
      null;
    elsif old.modality = 'prestamo_temporal' and old.status = 'devuelto' and new.status = 'cerrado' then
      null;
    else
      raise exception 'CONTRACT_LOCKED' using errcode = '42501';
    end if;
  end if;
  if old.received_at is not null and (
    new.initial_location is distinct from old.initial_location
    or new.received_at is distinct from old.received_at
    or new.received_by is distinct from old.received_by
    or new.reception_notes is distinct from old.reception_notes
  ) then
    raise exception 'RECEPTION_IMMUTABLE' using errcode = '42501';
  end if;
  if old.received_at is not null and new.custody_status is distinct from old.custody_status then
    if not (
      old.modality = 'prestamo_temporal'
      and old.status = 'recibido'
      and new.status = 'devuelto'
      and old.custody_status = 'museo'
      and new.custody_status = 'externa'
    ) then
      raise exception 'RECEPTION_IMMUTABLE' using errcode = '42501';
    end if;
  end if;
  if old.returned_at is not null and (
    new.returned_at is distinct from old.returned_at
    or new.returned_on is distinct from old.returned_on
    or new.return_condition is distinct from old.return_condition
    or new.return_notes is distinct from old.return_notes
    or new.delivered_by is distinct from old.delivered_by
    or new.delivered_by_name is distinct from old.delivered_by_name
    or new.return_received_by is distinct from old.return_received_by
    or new.custody_status is distinct from old.custody_status
  ) then
    raise exception 'RETURN_IMMUTABLE' using errcode = '42501';
  end if;
  if old.returned_at is not null and new.status is distinct from old.status
     and not (old.status = 'devuelto' and new.status = 'cerrado' and old.modality = 'prestamo_temporal') then
    raise exception 'RETURN_IMMUTABLE' using errcode = '42501';
  end if;
  return new;
end
$$;

create or replace function public.collection_return_accession(
  p_id uuid,
  p_expected_version bigint,
  p_returned_on text,
  p_condition text,
  p_notes text,
  p_return_received_by text,
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
  signature_row public.collection_accession_signatures;
  v_date date;
  v_condition text := btrim(coalesce(p_condition, ''));
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_receiver text := nullif(btrim(coalesce(p_return_received_by, '')), '');
  v_method text := btrim(coalesce(p_capture_method, ''));
  v_visual jsonb;
  v_actor text;
  v_hash text;
  v_today date;
begin
  if m is null or public.collection_can_write() is not true then
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
  if acc.modality <> 'prestamo_temporal' then
    raise exception 'RETURN_LOAN_ONLY' using errcode = '22023';
  end if;
  if acc.status <> 'recibido' or acc.contract_snapshot is null then
    raise exception 'RETURN_REQUIRES_RECEIVED' using errcode = '22023';
  end if;
  if p_expected_version is null or p_expected_version <> acc.version then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  v_date := public.collection_intake_date(p_returned_on);
  if v_date is null then
    raise exception 'RETURN_DATE_REQUIRED' using errcode = '22023';
  end if;
  if acc.started_on is not null and v_date < acc.started_on then
    raise exception 'RETURN_DATE_BEFORE_INTAKE' using errcode = '22023';
  end if;
  v_today := (now() at time zone 'America/Puerto_Rico')::date;
  if v_date > v_today then
    raise exception 'RETURN_DATE_IN_FUTURE' using errcode = '22023';
  end if;
  if v_condition not in ('Excelente', 'Buena', 'Regular', 'Mala', 'Requiere evaluación') then
    raise exception 'RETURN_CONDITION_REQUIRED' using errcode = '22023';
  end if;
  if v_receiver is null or length(v_receiver) > 300 then
    raise exception 'RETURN_RECEIVER_REQUIRED' using errcode = '22023';
  end if;
  if v_notes is not null and length(v_notes) > 10000 then
    raise exception 'RETURN_NOTES_TOO_LONG' using errcode = '22023';
  end if;
  select * into item
  from public.collection_items
  where id = acc.collection_item_id and museum_id = m;
  if not found then
    raise exception 'ITEM_NOT_FOUND' using errcode = '42501';
  end if;
  v_actor := nullif(btrim((select full_name from public.profiles where id = auth.uid() and museum_id = m)), '');
  if v_actor is null then
    raise exception 'RETURN_DELIVERER_REQUIRED' using errcode = '22023';
  end if;
  v_visual := public.collection_signature_visual(p_visual);
  v_hash := public.collection_contract_digest(concat_ws(E'\n',
    'devolucion',
    acc.id::text,
    item.accession_number,
    v_date::text,
    v_condition,
    coalesce(v_notes, ''),
    v_receiver,
    v_actor
  ));
  insert into public.collection_accession_signatures (
    museum_id, accession_id, signer_name, signer_role, signature_type, signed_at,
    capture_method, visual, integrity, content_hash, status, created_by
  ) values (
    m, acc.id, v_receiver, 'receptor_devolucion', 'devolucion', now(),
    v_method, v_visual, v_visual->'integrity', v_hash, 'capturada', auth.uid()
  ) returning * into signature_row;
  update public.collection_accessions
  set status = 'devuelto',
      custody_status = 'externa',
      returned_on = v_date,
      returned_at = now(),
      return_condition = v_condition,
      return_notes = v_notes,
      delivered_by = auth.uid(),
      delivered_by_name = v_actor,
      return_received_by = v_receiver,
      version = version + 1,
      updated_by = auth.uid()
  where id = acc.id and museum_id = m
  returning * into saved;
  insert into public.collection_accession_events (
    museum_id, accession_id, item_id, actor_id, actor_name, action, reason, before_value, after_value
  ) values (
    m, saved.id, saved.collection_item_id, auth.uid(), v_actor, 'devolucion',
    'Pieza devuelta al prestamista.',
    jsonb_build_object('status', acc.status, 'physical_condition', acc.physical_condition, 'custody_status', acc.custody_status),
    jsonb_build_object(
      'status', saved.status,
      'ingress_condition', acc.physical_condition,
      'return_condition', saved.return_condition,
      'returned_on', saved.returned_on,
      'returned_at', saved.returned_at,
      'return_notes', saved.return_notes,
      'delivered_by', saved.delivered_by,
      'delivered_by_name', saved.delivered_by_name,
      'return_received_by', saved.return_received_by,
      'signature_id', signature_row.id,
      'custody_status', saved.custody_status
    )
  );
  return jsonb_build_object('accession', to_jsonb(saved), 'signature', to_jsonb(signature_row), 'item', to_jsonb(item));
end
$$;

create or replace function public.collection_close_accession(
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
  saved public.collection_accessions;
  v_actor text;
  v_signature uuid;
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
  if acc.modality <> 'prestamo_temporal' then
    raise exception 'RETURN_LOAN_ONLY' using errcode = '22023';
  end if;
  if acc.status <> 'devuelto' or acc.returned_at is null or acc.contract_snapshot is null then
    raise exception 'CLOSE_REQUIRES_RETURN' using errcode = '22023';
  end if;
  if p_expected_version is null or p_expected_version <> acc.version then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  select signature.id into v_signature
  from public.collection_accession_signatures signature
  where signature.museum_id = m
    and signature.accession_id = acc.id
    and signature.signature_type = 'devolucion'
    and signature.signer_role = 'receptor_devolucion'
    and signature.status = 'capturada'
  order by signature.signed_at desc, signature.id desc
  limit 1;
  if v_signature is null then
    raise exception 'RETURN_SIGNATURE_REQUIRED' using errcode = '22023';
  end if;
  v_actor := coalesce(nullif(btrim((select full_name from public.profiles where id = auth.uid())), ''), acc.delivered_by_name);
  update public.collection_accessions
  set status = 'cerrado',
      version = version + 1,
      updated_by = auth.uid()
  where id = acc.id and museum_id = m
  returning * into saved;
  insert into public.collection_accession_events (
    museum_id, accession_id, item_id, actor_id, actor_name, action, reason, before_value, after_value
  ) values (
    m, saved.id, saved.collection_item_id, auth.uid(), v_actor, 'cierre',
    'Expediente de préstamo cerrado.',
    jsonb_build_object('status', acc.status),
    jsonb_build_object('status', saved.status, 'return_signature_id', v_signature, 'closed_at', now())
  );
  return jsonb_build_object('accession', to_jsonb(saved));
end
$$;

revoke all on function public.collection_return_accession(uuid, bigint, text, text, text, text, text, jsonb) from public, anon;
revoke all on function public.collection_close_accession(uuid, bigint) from public, anon;
grant execute on function public.collection_return_accession(uuid, bigint, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.collection_close_accession(uuid, bigint) to authenticated;

insert into supabase_migrations.schema_migrations (version, name)
select '202610050004', 'collection_return_print'
where not exists (
  select 1 from supabase_migrations.schema_migrations where version = '202610050004'
);

notify pgrst, 'reload schema';
commit;
