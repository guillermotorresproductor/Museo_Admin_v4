-- Real economic movements. finance_records stays the budget and is not written.
-- A posted movement is immutable. Void is the only transition, and it happens once.
-- Void retries use the movement id. There is no second idempotency column:
-- the post key is immutable, and a movement cannot be voided twice.

begin;

create table public.finance_movements (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete restrict,
  budget_line_id uuid not null references public.finance_budget_lines(id) on delete restrict,
  occurred_on date not null,
  amount numeric(14,2) not null,
  description text not null default '',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  idempotency_key uuid not null,
  voided_at timestamptz,
  voided_by uuid references public.profiles(id) on delete restrict,
  void_reason text,
  constraint finance_movements_amount_check check (amount > 0),
  constraint finance_movements_description_length_check check (char_length(description) <= 500),
  constraint finance_movements_void_reason_check check (
    void_reason is null
    or (char_length(void_reason) <= 500 and btrim(void_reason) <> '')
  ),
  constraint finance_movements_void_complete_check check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and voided_by is not null and void_reason is not null)
  ),
  constraint finance_movements_museum_idempotency_key unique (museum_id, idempotency_key)
);

create index finance_movements_museum_occurred_idx
  on public.finance_movements (museum_id, occurred_on);

create index finance_movements_open_line_idx
  on public.finance_movements (museum_id, budget_line_id, occurred_on)
  where voided_at is null;

comment on table public.finance_movements is
  'Confirmed economic movements. Budget cells stay in finance_records. Void is the only mutation.';

create or replace function public.finance_movements_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  line_museum uuid;
begin
  if tg_op = 'DELETE' then
    raise exception 'MOVEMENT_DELETE_FORBIDDEN' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    select museum_id into line_museum
    from public.finance_budget_lines
    where id = new.budget_line_id;
    if line_museum is distinct from new.museum_id then
      raise exception 'BUDGET_LINE_MUSEUM_MISMATCH' using errcode = '23514';
    end if;
    if new.voided_at is not null or new.voided_by is not null or new.void_reason is not null then
      raise exception 'MOVEMENT_VOID_ON_INSERT' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.museum_id is distinct from old.museum_id
     or new.budget_line_id is distinct from old.budget_line_id
     or new.occurred_on is distinct from old.occurred_on
     or new.amount is distinct from old.amount
     or new.description is distinct from old.description
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or new.idempotency_key is distinct from old.idempotency_key then
    raise exception 'MOVEMENT_IMMUTABLE' using errcode = 'P0001';
  end if;

  if old.voided_at is not null then
    if new.voided_at is distinct from old.voided_at
       or new.voided_by is distinct from old.voided_by
       or new.void_reason is distinct from old.void_reason then
      raise exception 'MOVEMENT_VOID_IMMUTABLE' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.voided_at is null or new.voided_by is null or new.void_reason is null
     or btrim(new.void_reason) = '' then
    raise exception 'MOVEMENT_VOID_INCOMPLETE' using errcode = 'P0001';
  end if;
  return new;
end
$$;

create trigger finance_movements_guard
before insert or update or delete on public.finance_movements
for each row execute function public.finance_movements_guard();

create or replace function public.finance_movement_require_museum()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  museum uuid := public.current_user_museum_id();
begin
  if auth.uid() is null
     or museum is null
     or not public.has_permission('finance.read')
     or not public.has_permission('finance.write')
     or not public.module_profile_allows('administration') then
    raise exception 'Missing financial authorization' using errcode = '42501';
  end if;
  return museum;
end
$$;

create or replace function public.finance_movement_validate_amount(p_amount numeric)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_amount is null
     or p_amount <= 0
     or round(p_amount, 2) <> p_amount
     or p_amount >= power(10::numeric, 12)
     or p_amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Invalid amount' using errcode = '22023';
  end if;
end
$$;

create or replace function public.finance_movement_validate_description(p_description text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_description is null then
    return '';
  end if;
  if char_length(p_description) > 500 then
    raise exception 'Invalid description' using errcode = '22023';
  end if;
  return p_description;
end
$$;

create or replace function public.finance_movement_validate_reason(p_reason text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_reason is null or btrim(p_reason) = '' or char_length(p_reason) > 500 then
    raise exception 'Invalid void reason' using errcode = '22023';
  end if;
  return p_reason;
end
$$;

create or replace function public.finance_movement_assert_line(p_museum uuid, p_budget_line_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_budget_line_id is null or not exists (
    select 1
    from public.finance_budget_lines
    where id = p_budget_line_id
      and museum_id = p_museum
  ) then
    raise exception 'Budget line not found' using errcode = '42501';
  end if;
end
$$;

create or replace function public.finance_movement_same_economics(
  p_row public.finance_movements,
  p_budget_line_id uuid,
  p_occurred_on date,
  p_amount numeric,
  p_description text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_row.budget_line_id is not distinct from p_budget_line_id
     and p_row.occurred_on is not distinct from p_occurred_on
     and p_row.amount is not distinct from p_amount
     and p_row.description is not distinct from p_description;
$$;

create or replace function public.finance_movement_payload(
  p_row public.finance_movements,
  p_audit_id uuid
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_row.id,
    'museum_id', p_row.museum_id,
    'budget_line_id', p_row.budget_line_id,
    'occurred_on', p_row.occurred_on,
    'amount', p_row.amount,
    'description', p_row.description,
    'created_by', p_row.created_by,
    'created_at', p_row.created_at,
    'idempotency_key', p_row.idempotency_key,
    'voided_at', p_row.voided_at,
    'voided_by', p_row.voided_by,
    'void_reason', p_row.void_reason,
    'audit_id', p_audit_id
  );
$$;

create or replace function public.finance_movement_audit(
  p_museum uuid,
  p_action text,
  p_record_id uuid,
  p_old jsonb,
  p_new jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_column text;
  audit_id uuid;
begin
  select a.attname into actor_column
  from pg_attribute a
  where a.attrelid = 'public.audit_logs'::regclass
    and not a.attisdropped
    and a.attname in ('user_id', 'actor_user_id')
  order by case a.attname when 'user_id' then 0 else 1 end
  limit 1;
  if actor_column is null then
    raise exception 'Audit schema unavailable' using errcode = '55000';
  end if;
  execute format(
    'insert into public.audit_logs (museum_id, %I, action, table_name, record_id, old_value, new_value)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id',
    actor_column
  )
  into audit_id
  using p_museum, auth.uid(), p_action, 'finance_movements', p_record_id, p_old, p_new;
  return audit_id;
end
$$;

create or replace function public.post_finance_movement(
  p_budget_line_id uuid,
  p_occurred_on date,
  p_amount numeric,
  p_description text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  museum uuid;
  description text;
  existing public.finance_movements;
  created public.finance_movements;
  audit_id uuid;
begin
  museum := public.finance_movement_require_museum();
  if p_occurred_on is null or p_idempotency_key is null then
    raise exception 'Invalid movement' using errcode = '22023';
  end if;
  perform public.finance_movement_validate_amount(p_amount);
  description := public.finance_movement_validate_description(p_description);
  perform public.finance_movement_assert_line(museum, p_budget_line_id);

  select * into existing
  from public.finance_movements
  where museum_id = museum
    and idempotency_key = p_idempotency_key
  for update;
  if found then
    if public.finance_movement_same_economics(existing, p_budget_line_id, p_occurred_on, p_amount, description) then
      return public.finance_movement_payload(existing, null);
    end if;
    raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
  end if;

  begin
    insert into public.finance_movements (
      museum_id, budget_line_id, occurred_on, amount, description, created_by, idempotency_key
    ) values (
      museum, p_budget_line_id, p_occurred_on, p_amount, description, auth.uid(), p_idempotency_key
    )
    returning * into created;
  exception
    when unique_violation then
      if sqlerrm not like '%finance_movements_museum_idempotency_key%' then
        raise;
      end if;
      select * into existing
      from public.finance_movements
      where museum_id = museum
        and idempotency_key = p_idempotency_key;
      if found and public.finance_movement_same_economics(existing, p_budget_line_id, p_occurred_on, p_amount, description) then
        return public.finance_movement_payload(existing, null);
      end if;
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
  end;

  audit_id := public.finance_movement_audit(
    museum,
    'finance_movement_post',
    created.id,
    null,
    jsonb_build_object(
      'budget_line_id', created.budget_line_id,
      'occurred_on', created.occurred_on,
      'amount', created.amount,
      'description', created.description
    )
  );
  return public.finance_movement_payload(created, audit_id);
end
$$;

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
    return public.finance_movement_payload(existing, null);
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

create or replace function public.correct_finance_movement(
  p_movement_id uuid,
  p_void_reason text,
  p_budget_line_id uuid,
  p_occurred_on date,
  p_amount numeric,
  p_description text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  museum uuid;
  reason text;
  description text;
  original public.finance_movements;
  created public.finance_movements;
  audit_id uuid;
begin
  museum := public.finance_movement_require_museum();
  if p_movement_id is null or p_occurred_on is null or p_idempotency_key is null then
    raise exception 'Invalid movement' using errcode = '22023';
  end if;
  reason := public.finance_movement_validate_reason(p_void_reason);
  perform public.finance_movement_validate_amount(p_amount);
  description := public.finance_movement_validate_description(p_description);
  perform public.finance_movement_assert_line(museum, p_budget_line_id);

  select * into original
  from public.finance_movements
  where id = p_movement_id
    and museum_id = museum
  for update;
  if not found then
    raise exception 'Finance movement not found' using errcode = '42501';
  end if;

  select * into created
  from public.finance_movements
  where museum_id = museum
    and idempotency_key = p_idempotency_key
  for update;
  if found then
    if public.finance_movement_same_economics(created, p_budget_line_id, p_occurred_on, p_amount, description)
       and original.voided_at is not null
       and original.void_reason = reason
       and exists (
         select 1
         from public.audit_logs audit_row
         where audit_row.museum_id = museum
           and audit_row.action = 'finance_movement_correct'
           and audit_row.record_id = original.id
           and audit_row.new_value->>'movement_id' = created.id::text
       ) then
      return jsonb_build_object(
        'voided_id', original.id,
        'movement_id', created.id,
        'voided', public.finance_movement_payload(original, null),
        'movement', public.finance_movement_payload(created, null),
        'audit_id', null
      );
    end if;
    raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
  end if;

  if original.voided_at is not null then
    raise exception 'ALREADY_VOIDED' using errcode = 'P0001';
  end if;

  update public.finance_movements
  set voided_at = now(),
      voided_by = auth.uid(),
      void_reason = reason
  where id = original.id
    and museum_id = museum
    and voided_at is null
  returning * into original;

  insert into public.finance_movements (
    museum_id, budget_line_id, occurred_on, amount, description, created_by, idempotency_key
  ) values (
    museum, p_budget_line_id, p_occurred_on, p_amount, description, auth.uid(), p_idempotency_key
  )
  returning * into created;

  audit_id := public.finance_movement_audit(
    museum,
    'finance_movement_correct',
    original.id,
    jsonb_build_object(
      'budget_line_id', original.budget_line_id,
      'occurred_on', original.occurred_on,
      'amount', original.amount,
      'description', original.description,
      'void_reason', original.void_reason
    ),
    jsonb_build_object(
      'voided_movement_id', original.id,
      'movement_id', created.id,
      'void_reason', original.void_reason,
      'budget_line_id', created.budget_line_id,
      'occurred_on', created.occurred_on,
      'amount', created.amount,
      'description', created.description
    )
  );

  return jsonb_build_object(
    'voided_id', original.id,
    'movement_id', created.id,
    'voided', public.finance_movement_payload(original, null),
    'movement', public.finance_movement_payload(created, null),
    'audit_id', audit_id
  );
end
$$;

alter table public.finance_movements enable row level security;

drop policy if exists finance_movements_read on public.finance_movements;
create policy finance_movements_read on public.finance_movements
  for select to authenticated
  using (museum_id = public.current_user_museum_id() and public.has_permission('finance.read'));

drop policy if exists finance_movements_explicit_read on public.finance_movements;
create policy finance_movements_explicit_read on public.finance_movements
  as restrictive for select to authenticated
  using (museum_id = public.current_user_museum_id() and public.has_permission('finance.read'));

drop policy if exists finance_movements_module_boundary on public.finance_movements;
create policy finance_movements_module_boundary on public.finance_movements
  as restrictive for select to authenticated
  using (public.module_profile_allows('administration'));

revoke all on public.finance_movements from anon;
revoke insert, update, delete, truncate, references, trigger on public.finance_movements from authenticated;
grant select on public.finance_movements to authenticated;

revoke all on function public.finance_movements_guard() from public, anon, authenticated;
revoke all on function public.finance_movement_require_museum() from public, anon, authenticated;
revoke all on function public.finance_movement_validate_amount(numeric) from public, anon, authenticated;
revoke all on function public.finance_movement_validate_description(text) from public, anon, authenticated;
revoke all on function public.finance_movement_validate_reason(text) from public, anon, authenticated;
revoke all on function public.finance_movement_assert_line(uuid, uuid) from public, anon, authenticated;
revoke all on function public.finance_movement_same_economics(public.finance_movements, uuid, date, numeric, text) from public, anon, authenticated;
revoke all on function public.finance_movement_payload(public.finance_movements, uuid) from public, anon, authenticated;
revoke all on function public.finance_movement_audit(uuid, text, uuid, jsonb, jsonb) from public, anon, authenticated;

revoke all on function public.post_finance_movement(uuid, date, numeric, text, uuid) from public, anon;
revoke all on function public.void_finance_movement(uuid, text) from public, anon;
revoke all on function public.correct_finance_movement(uuid, text, uuid, date, numeric, text, uuid) from public, anon;
grant execute on function public.post_finance_movement(uuid, date, numeric, text, uuid) to authenticated;
grant execute on function public.void_finance_movement(uuid, text) to authenticated;
grant execute on function public.correct_finance_movement(uuid, text, uuid, date, numeric, text, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
