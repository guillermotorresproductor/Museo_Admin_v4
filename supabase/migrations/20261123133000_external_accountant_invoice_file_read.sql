-- Allow external accountants to read ONLY the source file of a finance document
-- belonging to their assigned museum. All original write/delete policies remain.
create policy finance_documents_external_accountant_read
on storage.objects for select to authenticated
using (
  bucket_id = 'finance-documents'
  and public.current_employee_module_profile() = '__external_accountant__'
  and public.has_permission('finance.read')
  and (storage.foldername(name))[1] = public.current_user_museum_id()::text
  and exists (
    select 1 from public.finance_documents d
    where d.museum_id = public.current_user_museum_id()
      and d.museum_id::text = (storage.foldername(name))[1]
      and d.id::text = (storage.foldername(name))[2]
      and (
        (storage.filename(name) = 'original' and d.original_path = name)
        or (storage.filename(name) = 'derived' and d.derived_path = name)
      )
  )
);
