-- Transactional finance amount update + audit.
-- Revokes direct UPDATE from authenticated; edits go through this RPC only.
-- Does not alter RLS policies, service_role, or record_security_audit_event.

create or replace function public.update_finance_record_amount(
  p_record_id uuid,
  p_new_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_museum_id uuid;
  v_row public.finance_records%rowtype;
  v_old_amount numeric(14, 2);
  v_new_amount numeric(14, 2);
  v_audit_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  v_museum_id := public.current_user_museum_id();
  if v_museum_id is null then
    raise exception 'No active museum membership' using errcode = '42501';
  end if;

  if not public.has_permission('finance.write') then
    raise exception 'Missing finance.write' using errcode = '42501';
  end if;

  if p_record_id is null then
    raise exception 'record_id required' using errcode = '22023';
  end if;

  if p_new_amount is null then
    raise exception 'amount required' using errcode = '22023';
  end if;

  if p_new_amount < 0 then
    raise exception 'amount must be >= 0' using errcode = '22023';
  end if;

  if round(p_new_amount, 2) <> p_new_amount then
    raise exception 'amount must have at most 2 decimal places' using errcode = '22023';
  end if;

  -- numeric(14,2) max absolute value is 10^12 - 0.01
  if abs(p_new_amount) >= power(10::numeric, 12) then
    raise exception 'amount out of numeric(14,2) range' using errcode = '22023';
  end if;

  v_new_amount := round(p_new_amount, 2)::numeric(14, 2);

  select *
  into v_row
  from public.finance_records fr
  where fr.id = p_record_id
    and fr.museum_id = v_museum_id
  for update;

  if not found then
    raise exception 'Finance record not found' using errcode = '42501';
  end if;

  v_old_amount := v_row.amount;

  update public.finance_records
  set amount = v_new_amount
  where id = v_row.id
    and museum_id = v_museum_id
  returning * into v_row;

  insert into public.audit_logs (
    museum_id,
    actor_user_id,
    action,
    table_name,
    record_id,
    old_value,
    new_value
  ) values (
    v_museum_id,
    auth.uid(),
    'update_finance_record',
    'finance_records',
    v_row.id,
    jsonb_build_object('amount', v_old_amount),
    jsonb_build_object(
      'amount', v_row.amount,
      'record_type', v_row.record_type,
      'category', v_row.category,
      'concept', v_row.concept,
      'month', v_row.month,
      'year', v_row.year
    )
  )
  returning id into v_audit_id;

  return jsonb_build_object(
    'record_id', v_row.id,
    'amount', v_row.amount,
    'updated_at', v_row.updated_at,
    'audit_id', v_audit_id
  );
end;
$$;
revoke all on function public.update_finance_record_amount(uuid, numeric) from public;
revoke all on function public.update_finance_record_amount(uuid, numeric) from anon;
revoke all on function public.update_finance_record_amount(uuid, numeric) from authenticated;
grant execute on function public.update_finance_record_amount(uuid, numeric) to authenticated;
revoke update on table public.finance_records from authenticated;
grant select, insert on table public.finance_records to authenticated;
