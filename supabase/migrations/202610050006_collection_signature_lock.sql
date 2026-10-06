-- Phase 5 correction: after the first contractual signature, the contract stays
-- locked. A later edit does not silently revoke that signature. Reopening is
-- explicit, keeps the signature row, marks it revocada, and records the event.
-- This does not insert pieces or allocate numbers.
begin;

create or replace function public.collection_revoke_stale_contract_signatures(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  acc public.collection_accessions;
  v_hash text;
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
    if exists (
      select 1
      from public.collection_accession_signatures signature
      where signature.accession_id = acc.id
        and signature.museum_id = acc.museum_id
        and signature.signature_type = 'contractual'
        and signature.status = 'capturada'
        and signature.content_hash is distinct from v_hash
    ) then
      raise exception 'CONTRACT_SIGNED_LOCKED' using errcode = '42501';
    end if;
  end loop;
end
$$;

create or replace function public.collection_reopen_ingress_correction(
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
  v_ids uuid[];
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
  if acc.contract_snapshot is not null or acc.status not in ('borrador', 'pendiente_firmas') then
    raise exception 'CONTRACT_LOCKED' using errcode = '42501';
  end if;
  if p_expected_version is null or p_expected_version <> acc.version then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  select array_agg(signature.id) into v_ids
  from public.collection_accession_signatures signature
  where signature.accession_id = acc.id
    and signature.museum_id = acc.museum_id
    and signature.signature_type = 'contractual'
    and signature.status = 'capturada';
  if v_ids is null then
    return jsonb_build_object('accession', to_jsonb(acc), 'reopened', false);
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
    m, acc.id, acc.collection_item_id, auth.uid(), v_actor, 'firmas_revocadas',
    'Reapertura para corrección. Las firmas contractuales dejaron de validar el expediente.',
    jsonb_build_object('signature_ids', to_jsonb(v_ids))
  );
  update public.collection_accessions
  set version = version + 1,
      updated_by = auth.uid()
  where id = acc.id and museum_id = m
  returning * into saved;
  return jsonb_build_object('accession', to_jsonb(saved), 'reopened', true);
end
$$;

revoke all on function public.collection_reopen_ingress_correction(uuid, bigint) from public, anon;
grant execute on function public.collection_reopen_ingress_correction(uuid, bigint) to authenticated;

insert into supabase_migrations.schema_migrations (version, name)
select '202610050006', 'collection_signature_lock'
where not exists (
  select 1 from supabase_migrations.schema_migrations where version = '202610050006'
);

notify pgrst, 'reload schema';
commit;
