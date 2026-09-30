-- Storage evidence guard. Does not change finance_documents rows, movements,
-- budget, or payroll. protect_delete stays the statement gate: the Storage
-- API sets storage.allow_delete_query and then deletes the row. This row
-- trigger runs after that gate and rejects only an original that a
-- finance_documents row already names.

begin;

create or replace function public.finance_document_original_referenced(
  p_bucket text,
  p_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_bucket = 'finance-documents'
    and p_name is not null
    and exists (
      select 1
      from public.finance_documents document
      where document.original_path = p_name
        and document.museum_id::text = (storage.foldername(p_name))[1]
        and document.id::text = (storage.foldername(p_name))[2]
    );
$$;

create or replace function public.finance_documents_storage_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if public.finance_document_original_referenced(old.bucket_id, old.name) then
      raise exception 'ORIGINAL_OBJECT_IMMUTABLE' using errcode = 'P0001';
    end if;
    return old;
  end if;

  if public.finance_document_original_referenced(old.bucket_id, old.name)
     or public.finance_document_original_referenced(new.bucket_id, new.name) then
    raise exception 'ORIGINAL_OBJECT_IMMUTABLE' using errcode = 'P0001';
  end if;
  return new;
end
$$;

drop trigger if exists finance_documents_storage_original_update on storage.objects;
create trigger finance_documents_storage_original_update
before update on storage.objects
for each row
when (old.bucket_id = 'finance-documents' or new.bucket_id = 'finance-documents')
execute function public.finance_documents_storage_guard();

drop trigger if exists finance_documents_storage_original_delete on storage.objects;
create trigger finance_documents_storage_original_delete
before delete on storage.objects
for each row
when (old.bucket_id = 'finance-documents')
execute function public.finance_documents_storage_guard();

revoke all on function public.finance_document_original_referenced(text, text) from public, anon, authenticated;
revoke all on function public.finance_documents_storage_guard() from public, anon, authenticated;

drop policy if exists finance_documents_storage_read on storage.objects;
create policy finance_documents_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'finance-documents'
    and (storage.foldername(name))[1] = public.current_user_museum_id()::text
    and public.has_permission('finance.read')
    and public.module_profile_allows('administration')
    and exists (
      select 1
      from public.finance_documents document
      where document.museum_id = public.current_user_museum_id()
        and document.museum_id::text = (storage.foldername(name))[1]
        and document.id::text = (storage.foldername(name))[2]
        and (
          (storage.filename(name) = 'original' and document.original_path = name)
          or (storage.filename(name) = 'derived' and document.derived_path = name)
        )
    )
  );

drop policy if exists finance_documents_storage_read_guard on storage.objects;
create policy finance_documents_storage_read_guard on storage.objects
  as restrictive for select to authenticated
  using (
    bucket_id <> 'finance-documents'
    or (
      (storage.foldername(name))[1] = public.current_user_museum_id()::text
      and public.has_permission('finance.read')
      and public.module_profile_allows('administration')
      and exists (
        select 1
        from public.finance_documents document
        where document.museum_id = public.current_user_museum_id()
          and document.museum_id::text = (storage.foldername(name))[1]
          and document.id::text = (storage.foldername(name))[2]
          and (
            (storage.filename(name) = 'original' and document.original_path = name)
            or (storage.filename(name) = 'derived' and document.derived_path = name)
          )
      )
    )
  );

notify pgrst, 'reload schema';

commit;
