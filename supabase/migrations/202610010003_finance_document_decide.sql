-- Invoice decisions belong to three administrative profiles.
-- Uploading a file stays on the existing finance gate.

begin;

create function public.finance_document_can_decide()
returns boolean
language sql
stable
security definer
set search_path = ''
as $decide$
  select auth.uid() is not null
    and exists (
      select 1
      from public.profiles profile
      where profile.id = auth.uid()
        and profile.museum_id is not null
        and profile.status in ('active', 'activo')
        and (
          select count(*)
          from public.employees employee
          where employee.profile_id = profile.id
            and employee.museum_id = profile.museum_id
        ) = 1
        and exists (
          select 1
          from public.employees employee
          where employee.profile_id = profile.id
            and employee.museum_id = profile.museum_id
            and employee.access_profile in (
              'director_ejecutivo',
              'gerente_administrativo',
              'administrador_general'
            )
        )
    );
$decide$;

revoke all on function public.finance_document_can_decide() from public, anon;
grant execute on function public.finance_document_can_decide() to authenticated;

CREATE OR REPLACE FUNCTION public.update_finance_document_review(p_document_id uuid, p_expected_vendor_name text, p_expected_invoice_number text, p_expected_invoice_date date, p_expected_total numeric, p_expected_description text, p_expected_budget_line_id uuid, p_vendor_name text, p_invoice_number text, p_invoice_date date, p_total numeric, p_description text, p_budget_line_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_museum uuid;
  actor_status text;
  actor_column text;
  doc public.finance_documents;
  saved public.finance_documents;
  line_museum uuid;
  line_type text;
  line_category text;
  v_vendor text;
  v_invoice_number text;
  v_description text;
  audit_id uuid;
begin
  if auth.uid() is null or p_document_id is null then
    raise exception 'PROFILE_REQUIRED' using errcode = 'P0001';
  end if;

  select museum_id, status
    into actor_museum, actor_status
  from public.profiles
  where id = auth.uid();

  if actor_status is null or actor_status not in ('active', 'activo') then
    raise exception 'PROFILE_REQUIRED' using errcode = 'P0001';
  end if;
  if actor_museum is null then
    raise exception 'MUSEUM_MISMATCH' using errcode = 'P0001';
  end if;

  if not public.finance_document_can_decide() then
    raise exception 'Missing financial authorization' using errcode = '42501';
  end if;

  select *
    into doc
  from public.finance_documents
  where id = p_document_id
    and museum_id = actor_museum
  for update;
  if not found then
    raise exception 'Finance document not found' using errcode = '42501';
  end if;
  if doc.status is distinct from 'pending_review' then
    raise exception 'DOCUMENT_NOT_PENDING' using errcode = 'P0001';
  end if;

  if p_expected_vendor_name is distinct from doc.vendor_name
     or p_expected_invoice_number is distinct from doc.invoice_number
     or p_expected_invoice_date is distinct from doc.invoice_date
     or p_expected_total is distinct from doc.total
     or p_expected_description is distinct from doc.description
     or p_expected_budget_line_id is distinct from doc.budget_line_id then
    raise exception 'DOCUMENT_REVIEW_STALE' using errcode = 'P0001';
  end if;

  v_vendor := pg_catalog.btrim(p_vendor_name);
  if v_vendor is not null and pg_catalog.char_length(v_vendor) = 0 then
    v_vendor := null;
  end if;
  v_invoice_number := pg_catalog.btrim(p_invoice_number);
  if v_invoice_number is not null and pg_catalog.char_length(v_invoice_number) = 0 then
    v_invoice_number := null;
  end if;
  v_description := pg_catalog.btrim(p_description);
  if v_description is not null and pg_catalog.char_length(v_description) = 0 then
    v_description := null;
  end if;

  if v_vendor is not null and pg_catalog.char_length(v_vendor) > 200 then
    raise exception 'Invalid vendor' using errcode = '22023';
  end if;
  if v_invoice_number is not null and pg_catalog.char_length(v_invoice_number) > 80 then
    raise exception 'Invalid invoice number' using errcode = '22023';
  end if;
  if v_description is not null and pg_catalog.char_length(v_description) > 500 then
    raise exception 'Invalid description' using errcode = '22023';
  end if;
  if p_total is not null then
    perform public.finance_movement_validate_amount(p_total);
  end if;

  if p_budget_line_id is not null then
    select museum_id, record_type, category
      into line_museum, line_type, line_category
    from public.finance_budget_lines
    where id = p_budget_line_id;
    if line_museum is null then
      raise exception 'BUDGET_LINE_NOT_FOUND' using errcode = 'P0001';
    end if;
    if line_museum is distinct from actor_museum then
      raise exception 'BUDGET_LINE_MUSEUM_MISMATCH' using errcode = '23514';
    end if;
    if line_type is distinct from 'expense'
       or line_category not in ('Gastos Operacionales', 'Servicios Contratados', 'Otros Gastos') then
      raise exception 'BUDGET_LINE_NOT_INVOICE_ELIGIBLE' using errcode = '23514';
    end if;
  end if;

  if v_vendor is not distinct from doc.vendor_name
     and v_invoice_number is not distinct from doc.invoice_number
     and p_invoice_date is not distinct from doc.invoice_date
     and p_total is not distinct from doc.total
     and v_description is not distinct from doc.description
     and p_budget_line_id is not distinct from doc.budget_line_id then
    return pg_catalog.jsonb_build_object(
      'document_id', doc.id,
      'status', doc.status,
      'vendor_name', doc.vendor_name,
      'invoice_number', doc.invoice_number,
      'invoice_date', doc.invoice_date,
      'total', doc.total,
      'description', doc.description,
      'budget_line_id', doc.budget_line_id,
      'changed', false,
      'audit_id', null
    );
  end if;

  update public.finance_documents as document
  set vendor_name = v_vendor,
      invoice_number = v_invoice_number,
      invoice_date = p_invoice_date,
      total = p_total,
      description = v_description,
      budget_line_id = p_budget_line_id
  where document.id = doc.id
    and document.museum_id = actor_museum
    and document.status = 'pending_review'
    and document.vendor_name is not distinct from p_expected_vendor_name
    and document.invoice_number is not distinct from p_expected_invoice_number
    and document.invoice_date is not distinct from p_expected_invoice_date
    and document.total is not distinct from p_expected_total
    and document.description is not distinct from p_expected_description
    and document.budget_line_id is not distinct from p_expected_budget_line_id
  returning * into saved;
  if not found then
    raise exception 'DOCUMENT_REVIEW_STALE' using errcode = 'P0001';
  end if;

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
    'insert into public.audit_logs (museum_id, %I, action, table_name, record_id, old_value, new_value)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id',
    actor_column
  )
  into audit_id
  using actor_museum, auth.uid(), 'finance_document_update', 'finance_documents', saved.id,
    pg_catalog.jsonb_build_object(
      'vendor_name', doc.vendor_name,
      'invoice_number', doc.invoice_number,
      'invoice_date', doc.invoice_date,
      'total', doc.total,
      'description', doc.description,
      'budget_line_id', doc.budget_line_id
    ),
    pg_catalog.jsonb_build_object(
      'vendor_name', saved.vendor_name,
      'invoice_number', saved.invoice_number,
      'invoice_date', saved.invoice_date,
      'total', saved.total,
      'description', saved.description,
      'budget_line_id', saved.budget_line_id
    );

  return pg_catalog.jsonb_build_object(
    'document_id', saved.id,
    'status', saved.status,
    'vendor_name', saved.vendor_name,
    'invoice_number', saved.invoice_number,
    'invoice_date', saved.invoice_date,
    'total', saved.total,
    'description', saved.description,
    'budget_line_id', saved.budget_line_id,
    'changed', true,
    'audit_id', audit_id
  );
end
$function$;

CREATE OR REPLACE FUNCTION public.reject_finance_document(p_document_id uuid, p_rejection_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_museum uuid;
  actor_status text;
  actor_column text;
  doc public.finance_documents;
  saved public.finance_documents;
  v_reason text;
  audit_id uuid;
begin
  if auth.uid() is null or p_document_id is null then
    raise exception 'PROFILE_REQUIRED' using errcode = 'P0001';
  end if;

  select museum_id, status
    into actor_museum, actor_status
  from public.profiles
  where id = auth.uid();

  if actor_status is null or actor_status not in ('active', 'activo') then
    raise exception 'PROFILE_REQUIRED' using errcode = 'P0001';
  end if;
  if actor_museum is null then
    raise exception 'MUSEUM_MISMATCH' using errcode = 'P0001';
  end if;

  if not public.finance_document_can_decide() then
    raise exception 'Missing financial authorization' using errcode = '42501';
  end if;

  select *
    into doc
  from public.finance_documents
  where id = p_document_id
    and museum_id = actor_museum
  for update;
  if not found then
    raise exception 'Finance document not found' using errcode = '42501';
  end if;
  if doc.status is distinct from 'pending_review' then
    raise exception 'DOCUMENT_NOT_PENDING' using errcode = 'P0001';
  end if;

  v_reason := pg_catalog.btrim(p_rejection_reason);
  if v_reason is null
     or pg_catalog.char_length(v_reason) = 0
     or pg_catalog.char_length(v_reason) > 500 then
    raise exception 'INVALID_REJECTION_REASON' using errcode = 'P0001';
  end if;

  update public.finance_documents as document
  set status = 'rejected',
      rejected_by = auth.uid(),
      rejected_at = pg_catalog.now(),
      rejection_reason = v_reason
  where document.id = doc.id
    and document.museum_id = actor_museum
    and document.status = 'pending_review'
  returning * into saved;
  if not found then
    raise exception 'DOCUMENT_NOT_PENDING' using errcode = 'P0001';
  end if;

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
    'insert into public.audit_logs (museum_id, %I, action, table_name, record_id, old_value, new_value)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id',
    actor_column
  )
  into audit_id
  using actor_museum, auth.uid(), 'finance_document_reject', 'finance_documents', saved.id,
    pg_catalog.jsonb_build_object('status', doc.status),
    pg_catalog.jsonb_build_object(
      'status', saved.status,
      'rejection_reason', saved.rejection_reason
    );

  return pg_catalog.jsonb_build_object(
    'document_id', saved.id,
    'status', saved.status,
    'rejection_reason', saved.rejection_reason,
    'audit_id', audit_id
  );
end
$function$;

CREATE OR REPLACE FUNCTION public.confirm_finance_document(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_museum uuid;
  actor_status text;
  actor_column text;
  doc public.finance_documents;
  saved public.finance_documents;
  existing public.finance_movements;
  created public.finance_movements;
  line_museum uuid;
  line_type text;
  line_category text;
  audit_id uuid;
  movement_audit_id uuid;
begin
  if auth.uid() is null or p_document_id is null then
    raise exception 'PROFILE_REQUIRED' using errcode = 'P0001';
  end if;

  select museum_id, status
    into actor_museum, actor_status
  from public.profiles
  where id = auth.uid();

  if actor_status is null or actor_status not in ('active', 'activo') then
    raise exception 'PROFILE_REQUIRED' using errcode = 'P0001';
  end if;
  if actor_museum is null then
    raise exception 'MUSEUM_MISMATCH' using errcode = 'P0001';
  end if;

  if not public.finance_document_can_decide() then
    raise exception 'Missing financial authorization' using errcode = '42501';
  end if;

  select *
    into doc
  from public.finance_documents
  where id = p_document_id
    and museum_id = actor_museum
  for update;
  if not found then
    raise exception 'Finance document not found' using errcode = '42501';
  end if;

  if doc.status = 'confirmed' then
    if doc.movement_id is null
       or doc.confirmed_by is null
       or doc.confirmed_at is null then
      raise exception 'DOCUMENT_CONFIRM_INCOMPLETE' using errcode = 'P0001';
    end if;
    select *
      into existing
    from public.finance_movements
    where id = doc.movement_id
      and museum_id = actor_museum;
    if not found then
      raise exception 'DOCUMENT_CONFIRM_INCOMPLETE' using errcode = 'P0001';
    end if;
    return pg_catalog.jsonb_build_object(
      'document_id', doc.id,
      'status', doc.status,
      'movement_id', doc.movement_id,
      'confirmed_by', doc.confirmed_by,
      'confirmed_at', doc.confirmed_at,
      'budget_line_id', existing.budget_line_id,
      'occurred_on', existing.occurred_on,
      'amount', existing.amount,
      'description', existing.description,
      'audit_id', null,
      'movement_audit_id', null,
      'idempotent', true
    );
  end if;

  if doc.status is distinct from 'pending_review' then
    raise exception 'DOCUMENT_NOT_PENDING' using errcode = 'P0001';
  end if;

  if doc.invoice_date is null
     or doc.total is null
     or doc.description is null
     or pg_catalog.btrim(doc.description) = ''
     or pg_catalog.char_length(doc.description) > 500
     or doc.budget_line_id is null then
    raise exception 'DOCUMENT_NOT_READY' using errcode = 'P0001';
  end if;
  perform public.finance_movement_validate_amount(doc.total);

  select museum_id, record_type, category
    into line_museum, line_type, line_category
  from public.finance_budget_lines
  where id = doc.budget_line_id;
  if line_museum is null then
    raise exception 'BUDGET_LINE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if line_museum is distinct from doc.museum_id then
    raise exception 'BUDGET_LINE_MUSEUM_MISMATCH' using errcode = '23514';
  end if;
  if line_type is distinct from 'expense'
     or line_category not in ('Gastos Operacionales', 'Servicios Contratados', 'Otros Gastos') then
    raise exception 'BUDGET_LINE_NOT_INVOICE_ELIGIBLE' using errcode = '23514';
  end if;

  select *
    into existing
  from public.finance_movements
  where museum_id = doc.museum_id
    and idempotency_key = doc.id
  for update;
  if found then
    raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
  end if;

  begin
    insert into public.finance_movements (
      museum_id, budget_line_id, occurred_on, amount, description, created_by, idempotency_key
    ) values (
      doc.museum_id,
      doc.budget_line_id,
      doc.invoice_date,
      doc.total,
      doc.description,
      auth.uid(),
      doc.id
    )
    returning * into created;
  exception
    when unique_violation then
      if sqlerrm not like '%finance_movements_museum_idempotency_key%' then
        raise;
      end if;
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
  end;

  update public.finance_documents as document
  set status = 'confirmed',
      confirmed_by = auth.uid(),
      confirmed_at = pg_catalog.now(),
      movement_id = created.id
  where document.id = doc.id
    and document.museum_id = actor_museum
    and document.status = 'pending_review'
    and document.movement_id is null
  returning * into saved;
  if not found then
    raise exception 'DOCUMENT_NOT_PENDING' using errcode = 'P0001';
  end if;

  movement_audit_id := public.finance_movement_audit(
    actor_museum,
    'finance_movement_post',
    created.id,
    null,
    pg_catalog.jsonb_build_object(
      'budget_line_id', created.budget_line_id,
      'occurred_on', created.occurred_on,
      'amount', created.amount,
      'description', created.description,
      'document_id', saved.id
    )
  );

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
    'insert into public.audit_logs (museum_id, %I, action, table_name, record_id, old_value, new_value)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id',
    actor_column
  )
  into audit_id
  using actor_museum, auth.uid(), 'finance_document_confirm', 'finance_documents', saved.id,
    pg_catalog.jsonb_build_object('status', doc.status),
    pg_catalog.jsonb_build_object(
      'status', saved.status,
      'movement_id', saved.movement_id,
      'budget_line_id', saved.budget_line_id,
      'invoice_date', saved.invoice_date,
      'total', saved.total,
      'description', saved.description
    );

  return pg_catalog.jsonb_build_object(
    'document_id', saved.id,
    'status', saved.status,
    'movement_id', saved.movement_id,
    'confirmed_by', saved.confirmed_by,
    'confirmed_at', saved.confirmed_at,
    'budget_line_id', created.budget_line_id,
    'occurred_on', created.occurred_on,
    'amount', created.amount,
    'description', created.description,
    'audit_id', audit_id,
    'movement_audit_id', movement_audit_id,
    'idempotent', false
  );
end
$function$;

notify pgrst, 'reload schema';

commit;
