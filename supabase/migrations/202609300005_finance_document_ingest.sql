-- Pending invoice intake. The edge function validates bytes and uploads the
-- original. This function inserts the row and its audit entry in one
-- transaction. It does not post a movement.

begin;

create or replace function public.create_finance_document_pending(
  p_actor uuid,
  p_museum uuid,
  p_document_id uuid,
  p_filename text,
  p_mime text,
  p_byte_size integer,
  p_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_museum uuid;
  actor_status text;
  actor_column text;
  created public.finance_documents;
  existing_id uuid;
begin
  if p_actor is null or p_museum is null or p_document_id is null then
    raise exception 'PROFILE_REQUIRED' using errcode = 'P0001';
  end if;

  select museum_id, status
    into actor_museum, actor_status
  from public.profiles
  where id = p_actor;

  if actor_status is distinct from 'active' then
    raise exception 'PROFILE_REQUIRED' using errcode = 'P0001';
  end if;
  if actor_museum is null or actor_museum is distinct from p_museum then
    raise exception 'MUSEUM_MISMATCH' using errcode = 'P0001';
  end if;

  insert into public.finance_documents (
    id,
    museum_id,
    status,
    original_path,
    original_mime,
    original_byte_size,
    original_sha256,
    original_filename,
    uploaded_by
  ) values (
    p_document_id,
    p_museum,
    'pending_review',
    p_museum::text || '/' || p_document_id::text || '/original',
    p_mime,
    p_byte_size,
    p_sha256,
    p_filename,
    p_actor
  )
  returning * into created;

  select a.attname into actor_column
  from pg_catalog.pg_attribute a
  where a.attrelid = 'public.audit_logs'::regclass
    and not a.attisdropped
    and a.attname in ('user_id', 'actor_user_id')
  order by case a.attname when 'user_id' then 0 else 1 end
  limit 1;
  if actor_column is null then
    raise exception 'AUDIT_SCHEMA_UNAVAILABLE' using errcode = '55000';
  end if;

  execute pg_catalog.format(
    'insert into public.audit_logs (museum_id, %I, action, table_name, record_id, new_value)
     values ($1, $2, $3, $4, $5, $6)',
    actor_column
  )
  using p_museum, p_actor, 'finance_document_upload', 'finance_documents', created.id,
    pg_catalog.jsonb_build_object(
      'status', created.status,
      'original_filename', created.original_filename,
      'original_mime', created.original_mime,
      'original_byte_size', created.original_byte_size,
      'original_sha256', created.original_sha256
    );

  return pg_catalog.jsonb_build_object(
    'document_id', created.id,
    'status', created.status,
    'original_filename', created.original_filename,
    'original_mime', created.original_mime,
    'original_byte_size', created.original_byte_size,
    'uploaded_at', created.uploaded_at
  );
exception
  when unique_violation then
    select document.id into existing_id
    from public.finance_documents document
    where document.museum_id = p_museum
      and document.original_sha256 = p_sha256
      and document.status in ('pending_review', 'confirmed')
    limit 1;
    return pg_catalog.jsonb_build_object(
      'code', 'DUPLICATE_DOCUMENT',
      'document_id', existing_id
    );
end
$$;

revoke all on function public.create_finance_document_pending(uuid, uuid, uuid, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.create_finance_document_pending(uuid, uuid, uuid, text, text, integer, text) to service_role;

notify pgrst, 'reload schema';

commit;
