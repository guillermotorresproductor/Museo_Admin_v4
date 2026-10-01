-- Confirm one pending invoice as exactly one finance movement.
-- Amount, date, description, and budget line come from the stored document.
-- The original, its storage object, and the review text stay.
-- Authorization matches update_finance_document_review and reject_finance_document.

begin;

create or replace function public.confirm_finance_document(
  p_document_id uuid
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
  chosen text;
  legacy_role text;
  doc public.finance_documents;
  saved public.finance_documents;
  existing public.finance_movements;
  created public.finance_movements;
  line_museum uuid;
  line_type text;
  line_category text;
  read_granted boolean;
  write_granted boolean;
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

  -- Same authorization as update_finance_document_review.
  -- active profiles, and any activo profile whose museum function already
  -- accepts that spelling, use the existing permission functions.
  -- Staging's current_user_museum_id() only matches status = 'active', so an
  -- activo profile is checked here against the same grants and Administración.
  if public.current_user_museum_id() is not distinct from actor_museum then
    if not public.has_permission('finance.read')
       or not public.has_permission('finance.write')
       or not public.module_profile_allows('administration') then
      raise exception 'Missing financial authorization' using errcode = '42501';
    end if;
  elsif actor_status = 'activo' then
    if exists (
      select 1
      from public.user_permissions grant_row
      join public.permissions permission on permission.id = grant_row.permission_id
      where grant_row.user_id = auth.uid()
        and grant_row.museum_id = actor_museum
        and permission.code in ('finance.read', 'finance.write')
        and grant_row.effect = 'deny'
        and (grant_row.valid_until is null or grant_row.valid_until > pg_catalog.now())
    ) then
      raise exception 'Missing financial authorization' using errcode = '42501';
    end if;

    select exists (
      select 1
      from public.user_permissions grant_row
      join public.permissions permission on permission.id = grant_row.permission_id
      where grant_row.user_id = auth.uid()
        and grant_row.museum_id = actor_museum
        and permission.code = 'finance.read'
        and grant_row.effect = 'allow'
        and (grant_row.valid_until is null or grant_row.valid_until > pg_catalog.now())
    ) or exists (
      select 1
      from public.user_roles assignment
      join public.role_permissions role_permission on role_permission.role_id = assignment.role_id
      join public.permissions permission on permission.id = role_permission.permission_id
      where assignment.user_id = auth.uid()
        and assignment.museum_id = actor_museum
        and permission.code = 'finance.read'
        and (assignment.valid_until is null or assignment.valid_until > pg_catalog.now())
    )
      into read_granted;

    select exists (
      select 1
      from public.user_permissions grant_row
      join public.permissions permission on permission.id = grant_row.permission_id
      where grant_row.user_id = auth.uid()
        and grant_row.museum_id = actor_museum
        and permission.code = 'finance.write'
        and grant_row.effect = 'allow'
        and (grant_row.valid_until is null or grant_row.valid_until > pg_catalog.now())
    ) or exists (
      select 1
      from public.user_roles assignment
      join public.role_permissions role_permission on role_permission.role_id = assignment.role_id
      join public.permissions permission on permission.id = role_permission.permission_id
      where assignment.user_id = auth.uid()
        and assignment.museum_id = actor_museum
        and permission.code = 'finance.write'
        and (assignment.valid_until is null or assignment.valid_until > pg_catalog.now())
    )
      into write_granted;

    if not read_granted or not write_granted then
      select pg_catalog.lower(role) into legacy_role
      from public.profiles
      where id = auth.uid();
      if legacy_role in ('administrador', 'finanzas') then
        read_granted := true;
        write_granted := true;
      end if;
    end if;
    if not read_granted or not write_granted then
      raise exception 'Missing financial authorization' using errcode = '42501';
    end if;

    select case
             when count(*) = 1 then max(employee.access_profile)
             when bool_or(employee.access_profile is not null) then '__invalid_link__'
           end
      into chosen
    from public.employees employee
    join public.profiles profile
      on profile.id = employee.profile_id
     and profile.museum_id = employee.museum_id
    where profile.id = auth.uid()
      and employee.museum_id = actor_museum;
    if chosen is not null and not exists (
      select 1
      from public.employee_module_profiles module_profile
      where module_profile.code = chosen
        and 'administration' = any (module_profile.modules)
    ) then
      raise exception 'Missing financial authorization' using errcode = '42501';
    end if;
  else
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
$$;

revoke all on function public.confirm_finance_document(uuid) from public, anon;
grant execute on function public.confirm_finance_document(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
