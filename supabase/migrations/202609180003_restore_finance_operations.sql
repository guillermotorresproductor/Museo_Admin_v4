-- Restore the existing transactional amount/audit contract (f52045f) to production.
-- No financial data, defaults, roles, organization links or payroll versions change.
begin;
create or replace function public.update_finance_record_amount(p_record_id uuid,p_new_amount numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 m uuid:=public.current_user_museum_id(); r public.finance_records; previous numeric;
 audit_id uuid; actor_column text; amount_precision integer;
begin
 if auth.uid() is null or m is null or not public.has_permission('finance.read') or not public.has_permission('finance.write') then
  raise exception 'Missing financial authorization' using errcode='42501';
 end if;
 if p_record_id is null or p_new_amount is null or p_new_amount<0 or round(p_new_amount,2)<>p_new_amount
    or p_new_amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid amount' using errcode='22023'; end if;
 select numeric_precision-numeric_scale into amount_precision from information_schema.columns
  where table_schema='public' and table_name='finance_records' and column_name='amount';
 if p_new_amount>=power(10::numeric,coalesce(amount_precision,10)) then raise exception 'Amount out of range' using errcode='22023'; end if;
 select * into r from public.finance_records where id=p_record_id and museum_id=m for update;
 if not found then raise exception 'Finance record not found' using errcode='42501'; end if;
 previous:=r.amount;
 update public.finance_records set amount=p_new_amount,updated_at=now() where id=r.id and museum_id=m returning * into r;
 select attname into actor_column from pg_attribute where attrelid='public.audit_logs'::regclass and not attisdropped
  and attname in ('actor_user_id','user_id') order by case attname when 'actor_user_id' then 0 else 1 end limit 1;
 if actor_column is null then raise exception 'Audit schema unavailable'; end if;
 execute format('insert into public.audit_logs(museum_id,%I,action,table_name,record_id,old_value,new_value) values($1,$2,$3,$4,$5,$6,$7) returning id',actor_column)
 into audit_id using m,auth.uid(),'update_finance_record','finance_records',r.id,
 jsonb_build_object('amount',previous),jsonb_build_object('amount',r.amount,'record_type',r.record_type,'category',r.category,'concept',r.concept,'month',r.month,'year',r.year);
 return jsonb_build_object('record_id',r.id,'amount',r.amount,'updated_at',r.updated_at,'audit_id',audit_id);
end $$;
revoke all on function public.update_finance_record_amount(uuid,numeric) from public,anon;
grant execute on function public.update_finance_record_amount(uuid,numeric) to authenticated;

-- Read only the financial audit for the current museum, regardless of the legacy
-- actor column name. Broader administrative audit visibility is not changed.
create function public.finance_audit_history(p_year integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.has_permission('finance.read') then raise exception 'Missing finance.read' using errcode='42501'; end if;
 select coalesce(jsonb_agg(item order by at desc),'[]'::jsonb) into result from (
  select a.created_at at,jsonb_build_object('id',a.id,'created_at',a.created_at,'user_name',coalesce(p.full_name,'Usuario'),
   'concept',f.concept,'month',f.month,'old_amount',a.old_value->'amount','new_amount',a.new_value->'amount') item
  from public.audit_logs a join public.finance_records f on f.id=a.record_id and f.museum_id=a.museum_id
  left join public.profiles p on p.id::text=coalesce(to_jsonb(a)->>'actor_user_id',to_jsonb(a)->>'user_id') and p.museum_id=a.museum_id
  where a.museum_id=public.current_user_museum_id() and a.table_name='finance_records'
   and a.action='update_finance_record' and f.year=p_year
  order by a.created_at desc limit 250
 ) logs;
 return result;
end $$;
revoke all on function public.finance_audit_history(integer) from public,anon;
grant execute on function public.finance_audit_history(integer) to authenticated;

-- Preserve existing module-profile policies; enforce financial permissions even
-- when an older permissive policy authorizes users by technical role alone.
create policy finance_explicit_read on public.finance_records as restrictive for select to authenticated
 using(museum_id=public.current_user_museum_id() and public.has_permission('finance.read'));
create policy finance_permission_read on public.finance_records for select to authenticated
 using(museum_id=public.current_user_museum_id() and public.has_permission('finance.read'));
revoke all on public.finance_records from anon;
revoke insert,update,delete,truncate,references,trigger on public.finance_records from authenticated;
grant select on public.finance_records to authenticated;
notify pgrst,'reload schema';
commit;
