-- Invoice payment methods are the four authorized options.
-- Existing rows with no method stay null. A stored value outside the list stops this change.

do $payment_method_four$
declare
  src text;
  patched text;
  permission_before text;
  movements_before text;
  review_name text := 'public.update_finance_document_review(uuid,text,text,date,numeric,text,uuid,text,text,date,numeric,text,uuid,text,text)';
  old_list text := '(''cash'', ''credit_card'', ''ath_movil'', ''check'', ''museum_credit'')';
  new_list text := '(''cash'', ''credit_card'', ''ath_movil'', ''check'')';
begin
  permission_before := md5(pg_get_functiondef('public.has_permission(text)'::regprocedure));
  movements_before := md5(pg_get_functiondef('public.finance_movements_guard()'::regprocedure));

  if exists (
    select 1
    from public.finance_documents
    where payment_method is not null
      and payment_method not in ('cash', 'credit_card', 'ath_movil', 'check')
  ) then
    raise exception 'PAYMENT_METHOD_UNEXPECTED_VALUE';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.finance_documents'::regclass
      and conname = 'finance_documents_payment_method_check'
      and pg_get_constraintdef(oid) like '%museum_credit%'
  ) then
    alter table public.finance_documents drop constraint finance_documents_payment_method_check;
    alter table public.finance_documents
      add constraint finance_documents_payment_method_check
      check (
        payment_method is null
        or payment_method in ('cash', 'credit_card', 'ath_movil', 'check')
      );
  end if;

  src := replace(pg_get_functiondef(review_name::regprocedure), E'\r\n', E'\n');
  if position('museum_credit' in src) > 0 then
    if (length(src) - length(replace(src, old_list, ''))) / length(old_list) <> 1 then
      raise exception 'PAYMENT_METHOD_FOUR_MARKER';
    end if;
    patched := replace(src, old_list, new_list);
    if position('museum_credit' in patched) > 0 or patched = src then
      raise exception 'PAYMENT_METHOD_FOUR_INCOMPLETE';
    end if;
    execute patched;
  end if;

  if position('museum_credit' in pg_get_functiondef(review_name::regprocedure)) > 0
     or exists (
       select 1
       from pg_constraint
       where conrelid = 'public.finance_documents'::regclass
         and conname = 'finance_documents_payment_method_check'
         and pg_get_constraintdef(oid) like '%museum_credit%'
     ) then
    raise exception 'PAYMENT_METHOD_FOUR_STILL_PRESENT';
  end if;
  if md5(pg_get_functiondef('public.has_permission(text)'::regprocedure)) is distinct from permission_before
     or md5(pg_get_functiondef('public.finance_movements_guard()'::regprocedure)) is distinct from movements_before then
    raise exception 'PAYMENT_METHOD_FOUR_UNRELATED';
  end if;

  notify pgrst, 'reload schema';
end
$payment_method_four$;
