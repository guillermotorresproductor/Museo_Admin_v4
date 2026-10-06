-- Phase 5: a contractual change after a signature stops that signature from
-- validating the new text. The signature row stays. Only its status moves
-- from capturada to revocada, and the expediente records firmas_revocadas.
-- Formalized files are skipped. This does not insert pieces or allocate numbers.
begin;

do $signature_status$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  where con.conrelid = 'public.collection_accession_signatures'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%rechazada%'
    and pg_get_constraintdef(con.oid) not like '%propietario%'
    and pg_get_constraintdef(con.oid) not like '%contractual%';
  if cname is not null then
    execute format('alter table public.collection_accession_signatures drop constraint %I', cname);
  end if;
  alter table public.collection_accession_signatures
    add constraint collection_accession_signatures_status_check
    check (status in ('pendiente', 'capturada', 'rechazada', 'revocada'));

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
      'expediente_creado', 'expediente_corregido', 'firma_registrada', 'firmas_revocadas', 'formalizado',
      'pieza_recibida', 'ubicacion_inicial', 'devolucion', 'cierre', 'vinculo_pieza', 'anexo'
    ));
end
$signature_status$;

create or replace function public.collection_signature_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op <> 'UPDATE' then
    raise exception 'SIGNATURE_IMMUTABLE' using errcode = '42501';
  end if;
  if old.signature_type = 'contractual'
     and old.status = 'capturada'
     and new.status = 'revocada'
     and new.id is not distinct from old.id
     and new.museum_id is not distinct from old.museum_id
     and new.accession_id is not distinct from old.accession_id
     and new.signer_name is not distinct from old.signer_name
     and new.signer_role is not distinct from old.signer_role
     and new.signed_at is not distinct from old.signed_at
     and new.capture_method is not distinct from old.capture_method
     and new.visual is not distinct from old.visual
     and new.integrity is not distinct from old.integrity
     and new.content_hash is not distinct from old.content_hash
     and new.created_by is not distinct from old.created_by
     and new.created_at is not distinct from old.created_at
     and new.signature_type is not distinct from old.signature_type
  then
    return new;
  end if;
  raise exception 'SIGNATURE_IMMUTABLE' using errcode = '42501';
end
$$;

create or replace function public.collection_revoke_stale_contract_signatures(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  acc public.collection_accessions;
  v_hash text;
  v_ids uuid[];
  v_actor text;
begin
  if p_item_id is null or auth.uid() is null then
    return;
  end if;
  if not exists (
    select 1
    from public.collection_accessions open_accession
    where open_accession.collection_item_id = p_item_id
      and open_accession.contract_snapshot is null
      and open_accession.status in ('borrador', 'pendiente_firmas')
  ) then
    return;
  end if;
  for acc in
    select *
    from public.collection_accessions open_accession
    where open_accession.collection_item_id = p_item_id
      and open_accession.contract_snapshot is null
      and open_accession.status in ('borrador', 'pendiente_firmas')
  loop
    v_hash := public.collection_contract_digest(public.collection_contract_body(acc.id)::text);
    select array_agg(signature.id) into v_ids
    from public.collection_accession_signatures signature
    where signature.accession_id = acc.id
      and signature.museum_id = acc.museum_id
      and signature.signature_type = 'contractual'
      and signature.status = 'capturada'
      and signature.content_hash is distinct from v_hash;
    if v_ids is null then
      continue;
    end if;
    update public.collection_accession_signatures
    set status = 'revocada'
    where id = any (v_ids)
      and museum_id = acc.museum_id
      and status = 'capturada'
      and signature_type = 'contractual';
    v_actor := coalesce(nullif(btrim((select full_name from public.profiles where id = auth.uid())), ''), 'Catalogador');
    insert into public.collection_accession_events (
      museum_id, accession_id, item_id, actor_id, actor_name, action, reason, after_value
    ) values (
      acc.museum_id, acc.id, acc.collection_item_id, auth.uid(), v_actor, 'firmas_revocadas',
      'Una corrección posterior dejó sin efecto las firmas contractuales. Hay que firmar otra vez.',
      jsonb_build_object('signature_ids', to_jsonb(v_ids), 'content_hash', v_hash)
    );
  end loop;
end
$$;

create or replace function public.collection_accession_signature_freshness()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item uuid;
begin
  if tg_table_name = 'collection_items' then
    v_item := new.id;
  elsif tg_table_name = 'collection_accessions' then
    if new.contract_snapshot is not null or new.status not in ('borrador', 'pendiente_firmas') then
      return new;
    end if;
    v_item := new.collection_item_id;
  elsif tg_table_name = 'collection_accession_attachments' then
    select open_accession.collection_item_id into v_item
    from public.collection_accessions open_accession
    where open_accession.id = new.accession_id;
  else
    return new;
  end if;
  perform public.collection_revoke_stale_contract_signatures(v_item);
  return new;
end
$$;

drop trigger if exists collection_item_signature_freshness on public.collection_items;
create constraint trigger collection_item_signature_freshness
  after update on public.collection_items
  deferrable initially deferred
  for each row execute function public.collection_accession_signature_freshness();

drop trigger if exists collection_accession_signature_freshness on public.collection_accessions;
create constraint trigger collection_accession_signature_freshness
  after update on public.collection_accessions
  deferrable initially deferred
  for each row execute function public.collection_accession_signature_freshness();

drop trigger if exists collection_attachment_signature_freshness on public.collection_accession_attachments;
create constraint trigger collection_attachment_signature_freshness
  after insert on public.collection_accession_attachments
  deferrable initially deferred
  for each row execute function public.collection_accession_signature_freshness();

revoke all on function public.collection_revoke_stale_contract_signatures(uuid) from public, anon, authenticated;
revoke all on function public.collection_accession_signature_freshness() from public, anon;
grant execute on function public.collection_accession_signature_freshness() to authenticated;

insert into supabase_migrations.schema_migrations (version, name)
select '202610050005', 'collection_signature_revocation'
where not exists (
  select 1 from supabase_migrations.schema_migrations where version = '202610050005'
);

notify pgrst, 'reload schema';
commit;
