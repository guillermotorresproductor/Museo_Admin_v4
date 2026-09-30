-- Correct the void contract after 202609300001 was already applied.
-- A repeated void with the same reason returns the stored row.
-- A repeated void with a different reason raises VOID_ALREADY_COMPLETED.
-- No new column. The movement id remains the void identity.

begin;

create or replace function public.void_finance_movement(
  p_movement_id uuid,
  p_void_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  museum uuid;
  reason text;
  existing public.finance_movements;
  audit_id uuid;
begin
  museum := public.finance_movement_require_museum();
  if p_movement_id is null then
    raise exception 'Invalid movement' using errcode = '22023';
  end if;
  reason := public.finance_movement_validate_reason(p_void_reason);

  select * into existing
  from public.finance_movements
  where id = p_movement_id
    and museum_id = museum
  for update;
  if not found then
    raise exception 'Finance movement not found' using errcode = '42501';
  end if;
  if existing.voided_at is not null then
    if existing.void_reason = reason then
      return public.finance_movement_payload(existing, null);
    end if;
    raise exception 'VOID_ALREADY_COMPLETED' using errcode = 'P0001';
  end if;

  update public.finance_movements
  set voided_at = now(),
      voided_by = auth.uid(),
      void_reason = reason
  where id = existing.id
    and museum_id = museum
    and voided_at is null
  returning * into existing;

  audit_id := public.finance_movement_audit(
    museum,
    'finance_movement_void',
    existing.id,
    jsonb_build_object(
      'budget_line_id', existing.budget_line_id,
      'occurred_on', existing.occurred_on,
      'amount', existing.amount,
      'description', existing.description
    ),
    jsonb_build_object(
      'void_reason', existing.void_reason,
      'voided_at', existing.voided_at
    )
  );
  return public.finance_movement_payload(existing, audit_id);
end
$$;

commit;
