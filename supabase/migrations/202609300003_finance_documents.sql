-- Invoice evidence. A document is not a financial movement.
-- Confirmation is a later phase: it will post exactly one finance_movements row.
-- This migration does not write finance_records, finance_budget_lines,
-- finance_movements, or payroll.
--
-- original_sha256 is lowercase hex, 64 characters, of the original bytes.
-- Unconstrained numeric keeps extra decimal places visible so they can be
-- rejected. An accepted total assigns exactly onto finance_movements.amount
-- numeric(14,2): positive, scale <= 2, and below 10^12.
-- The original object is evidence. Client writes to the bucket stay closed
-- until an authenticated server ingests the bytes.

begin;

create table public.finance_documents (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete restrict,
  status text not null,
  original_path text not null,
  original_mime text not null,
  original_byte_size integer not null,
  original_sha256 text not null,
  original_filename text not null,
  derived_path text,
  derived_mime text,
  derived_updated_at timestamptz,
  vendor_name text,
  invoice_number text,
  invoice_date date,
  total numeric,
  description text,
  budget_line_id uuid references public.finance_budget_lines(id) on delete restrict,
  suggestion jsonb,
  extraction_error text,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  confirmed_by uuid references public.profiles(id) on delete restrict,
  confirmed_at timestamptz,
  movement_id uuid unique references public.finance_movements(id) on delete restrict,
  rejected_by uuid references public.profiles(id) on delete restrict,
  rejected_at timestamptz,
  rejection_reason text,
  constraint finance_documents_status_check check (
    status in ('pending_review', 'confirmed', 'rejected')
  ),
  constraint finance_documents_path_check check (
    original_path = museum_id::text || '/' || id::text || '/original'
  ),
  constraint finance_documents_mime_check check (
    original_mime in ('application/pdf', 'image/jpeg', 'image/png')
  ),
  constraint finance_documents_byte_size_check check (
    original_byte_size > 0 and original_byte_size <= 15728640
  ),
  constraint finance_documents_sha256_check check (
    original_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint finance_documents_filename_check check (
    char_length(original_filename) between 1 and 200
    and original_filename !~ '[\\/]'
    and original_filename <> '.'
    and original_filename <> '..'
  ),
  constraint finance_documents_derived_check check (
    (
      derived_path is null
      and derived_mime is null
      and derived_updated_at is null
    )
    or (
      derived_path = museum_id::text || '/' || id::text || '/derived'
      and derived_mime in ('application/pdf', 'image/jpeg', 'image/png')
      and derived_updated_at is not null
    )
  ),
  constraint finance_documents_vendor_check check (
    vendor_name is null or char_length(vendor_name) between 1 and 200
  ),
  constraint finance_documents_invoice_number_check check (
    invoice_number is null or char_length(invoice_number) between 1 and 80
  ),
  constraint finance_documents_total_check check (
    total is null
    or (
      total > 0
      and total < pg_catalog.power(10::numeric, 12)
      and pg_catalog.scale(total) <= 2
      and total::text not in ('NaN', 'Infinity', '-Infinity')
    )
  ),
  constraint finance_documents_description_check check (
    description is null or char_length(description) <= 500
  ),
  constraint finance_documents_suggestion_check check (
    suggestion is null
    or (
      pg_catalog.jsonb_typeof(suggestion) = 'object'
      and pg_catalog.octet_length(suggestion::text) <= 8000
    )
  ),
  constraint finance_documents_extraction_error_check check (
    extraction_error is null or char_length(extraction_error) between 1 and 500
  ),
  constraint finance_documents_state_check check (
    (
      status = 'pending_review'
      and confirmed_by is null
      and confirmed_at is null
      and movement_id is null
      and rejected_by is null
      and rejected_at is null
      and rejection_reason is null
    )
    or (
      status = 'confirmed'
      and confirmed_by is not null
      and confirmed_at is not null
      and movement_id is not null
      and budget_line_id is not null
      and invoice_date is not null
      and total is not null
      and description is not null
      and rejected_by is null
      and rejected_at is null
      and rejection_reason is null
    )
    or (
      status = 'rejected'
      and rejected_by is not null
      and rejected_at is not null
      and rejection_reason is not null
      and char_length(rejection_reason) between 1 and 500
      and btrim(rejection_reason) <> ''
      and confirmed_by is null
      and confirmed_at is null
      and movement_id is null
    )
  )
);

create unique index finance_documents_active_sha256_uidx
  on public.finance_documents (museum_id, original_sha256)
  where status in ('pending_review', 'confirmed');

create index finance_documents_museum_status_uploaded_idx
  on public.finance_documents (museum_id, status, uploaded_at desc);

comment on table public.finance_documents is
  'Invoice evidence for one museum. Not a budget cell and not a movement until a later confirmation. Future audit actions: finance_document_upload, finance_document_update, finance_document_derived_replace, finance_document_confirm, finance_document_reject.';

comment on column public.finance_documents.original_sha256 is
  'Lowercase hex SHA-256 of the immutable original bytes. Unique per museum while the document is pending_review or confirmed. A rejected document does not block the same bytes.';

comment on column public.finance_documents.original_filename is
  'Display label only. Never used as the storage path.';

comment on column public.finance_documents.suggestion is
  'Non-authoritative extraction suggestion. It cannot post a movement.';

comment on column public.finance_documents.total is
  'Positive amount with at most two decimal places, compatible with finance_movements.amount. Null until a person enters it.';

create or replace function public.finance_documents_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  line_museum uuid;
  line_type text;
  line_category text;
  movement_museum uuid;
begin
  if tg_op = 'DELETE' then
    raise exception 'DOCUMENT_DELETE_FORBIDDEN' using errcode = 'P0001';
  end if;

  if new.total is not null then
    perform public.finance_movement_validate_amount(new.total);
  end if;
  if new.description is not null then
    perform public.finance_movement_validate_description(new.description);
  end if;

  if new.budget_line_id is not null then
    select museum_id, record_type, category
      into line_museum, line_type, line_category
    from public.finance_budget_lines
    where id = new.budget_line_id;
    if line_museum is distinct from new.museum_id then
      raise exception 'BUDGET_LINE_MUSEUM_MISMATCH' using errcode = '23514';
    end if;
    if line_type is distinct from 'expense' or line_category = 'Nómina' then
      raise exception 'BUDGET_LINE_NOT_INVOICE_ELIGIBLE' using errcode = '23514';
    end if;
  end if;

  if new.movement_id is not null then
    select museum_id into movement_museum
    from public.finance_movements
    where id = new.movement_id;
    if movement_museum is distinct from new.museum_id then
      raise exception 'MOVEMENT_MUSEUM_MISMATCH' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'pending_review' then
      raise exception 'DOCUMENT_INSERT_STATUS' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.museum_id is distinct from old.museum_id
     or new.original_path is distinct from old.original_path
     or new.original_mime is distinct from old.original_mime
     or new.original_byte_size is distinct from old.original_byte_size
     or new.original_sha256 is distinct from old.original_sha256
     or new.original_filename is distinct from old.original_filename
     or new.uploaded_by is distinct from old.uploaded_by
     or new.uploaded_at is distinct from old.uploaded_at then
    raise exception 'DOCUMENT_ORIGINAL_IMMUTABLE' using errcode = 'P0001';
  end if;

  if old.status = 'confirmed' or old.status = 'rejected' then
    if new is distinct from old then
      raise exception 'DOCUMENT_CLOSED_IMMUTABLE' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if old.status is distinct from 'pending_review' then
    raise exception 'DOCUMENT_STATUS_INVALID' using errcode = 'P0001';
  end if;

  if new.status = 'pending_review' then
    if new.movement_id is not null
       or new.confirmed_by is not null
       or new.confirmed_at is not null
       or new.rejected_by is not null
       or new.rejected_at is not null
       or new.rejection_reason is not null then
      raise exception 'DOCUMENT_REVIEW_FIELDS' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.status = 'confirmed' then
    if old.movement_id is not null and new.movement_id is distinct from old.movement_id then
      raise exception 'DOCUMENT_MOVEMENT_IMMUTABLE' using errcode = 'P0001';
    end if;
    if new.movement_id is null
       or new.confirmed_by is null
       or new.confirmed_at is null
       or new.budget_line_id is null
       or new.invoice_date is null
       or new.total is null
       or new.description is null
       or new.rejected_by is not null
       or new.rejected_at is not null
       or new.rejection_reason is not null then
      raise exception 'DOCUMENT_CONFIRM_INCOMPLETE' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.status = 'rejected' then
    if new.rejected_by is null
       or new.rejected_at is null
       or new.rejection_reason is null
       or btrim(new.rejection_reason) = ''
       or new.confirmed_by is not null
       or new.confirmed_at is not null
       or new.movement_id is not null then
      raise exception 'DOCUMENT_REJECT_INCOMPLETE' using errcode = 'P0001';
    end if;
    return new;
  end if;

  raise exception 'DOCUMENT_STATUS_INVALID' using errcode = 'P0001';
end
$$;

create trigger finance_documents_guard
before insert or update or delete on public.finance_documents
for each row execute function public.finance_documents_guard();

alter table public.finance_documents enable row level security;

drop policy if exists finance_documents_read on public.finance_documents;
create policy finance_documents_read on public.finance_documents
  for select to authenticated
  using (
    museum_id = public.current_user_museum_id()
    and public.has_permission('finance.read')
  );

drop policy if exists finance_documents_explicit_read on public.finance_documents;
create policy finance_documents_explicit_read on public.finance_documents
  as restrictive for select to authenticated
  using (
    museum_id = public.current_user_museum_id()
    and public.has_permission('finance.read')
  );

drop policy if exists finance_documents_module_boundary on public.finance_documents;
create policy finance_documents_module_boundary on public.finance_documents
  as restrictive for select to authenticated
  using (public.module_profile_allows('administration'));

revoke all on public.finance_documents from public, anon;
revoke insert, update, delete, truncate, references, trigger on public.finance_documents from authenticated;
grant select on public.finance_documents to authenticated;

revoke all on function public.finance_documents_guard() from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'finance-documents',
  'finance-documents',
  false,
  15728640,
  array['application/pdf', 'image/jpeg', 'image/png']
);

create policy finance_documents_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'finance-documents'
    and (storage.foldername(name))[1] = public.current_user_museum_id()::text
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(original|derived)$'
    and public.has_permission('finance.read')
    and public.module_profile_allows('administration')
  );

create policy finance_documents_storage_read_guard on storage.objects
  as restrictive for select to authenticated
  using (
    bucket_id <> 'finance-documents'
    or (
      (storage.foldername(name))[1] = public.current_user_museum_id()::text
      and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(original|derived)$'
      and public.has_permission('finance.read')
      and public.module_profile_allows('administration')
    )
  );

create policy finance_documents_storage_no_insert on storage.objects
  as restrictive for insert to authenticated
  with check (bucket_id <> 'finance-documents');

create policy finance_documents_storage_no_update on storage.objects
  as restrictive for update to authenticated
  using (bucket_id <> 'finance-documents')
  with check (bucket_id <> 'finance-documents');

create policy finance_documents_storage_no_delete on storage.objects
  as restrictive for delete to authenticated
  using (bucket_id <> 'finance-documents');

notify pgrst, 'reload schema';

commit;
