-- Server-authoritative control for rental approvals and municipal receipts.
-- Apply in a controlled Supabase environment before deploying the matching frontend branch.

create table if not exists public.rental_approval_controls (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null,
  request_key text not null,
  municipal_receipt_number text,
  internal_production boolean not null default false,
  approval_status text not null default 'Pendiente'
    check (approval_status in ('Pendiente', 'Aprobada')),
  receipt_registered_by uuid,
  receipt_registered_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (museum_id, request_key),
  check (
    approval_status <> 'Aprobada'
    or internal_production
    or nullif(btrim(municipal_receipt_number), '') is not null
  )
);

create unique index if not exists rental_receipt_unique_per_museum_idx
  on public.rental_approval_controls (museum_id, municipal_receipt_number)
  where municipal_receipt_number is not null
    and nullif(btrim(municipal_receipt_number), '') is not null;

create table if not exists public.rental_approval_audit_logs (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null,
  request_key text not null,
  actor_user_id uuid,
  action text not null,
  result text not null check (result in ('success', 'blocked', 'failed')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create or replace function public.prevent_rental_approval_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'rental_approval_audit_logs are append-only.';
end;
$$;

drop trigger if exists prevent_rental_approval_audit_update on public.rental_approval_audit_logs;
create trigger prevent_rental_approval_audit_update
before update or delete on public.rental_approval_audit_logs
for each row execute function public.prevent_rental_approval_audit_mutation();

create or replace function public.current_rental_admin_museum()
returns uuid
language sql stable security definer set search_path = public, auth as $$
  select museum_id
  from public.profiles
  where id = auth.uid()
    and lower(role) in ('administrador', 'ejecutivo')
  limit 1;
$$;

create or replace function public.record_rental_municipal_receipt(
  p_request_key text,
  p_receipt_number text,
  p_internal_production boolean default false
)
returns public.rental_approval_controls
language plpgsql security definer set search_path = public, auth as $$
declare
  target_museum_id uuid;
  saved public.rental_approval_controls;
begin
  target_museum_id := public.current_rental_admin_museum();
  if target_museum_id is null then
    raise exception 'Administrative rental permission is required.';
  end if;
  if nullif(btrim(p_request_key), '') is null then
    raise exception 'Rental request key is required.';
  end if;
  insert into public.rental_approval_controls (
    museum_id, request_key, municipal_receipt_number, internal_production,
    receipt_registered_by, receipt_registered_at, updated_at
  ) values (
    target_museum_id, btrim(p_request_key), nullif(btrim(p_receipt_number), ''),
    coalesce(p_internal_production, false), auth.uid(),
    case when nullif(btrim(p_receipt_number), '') is null then null else now() end,
    now()
  )
  on conflict (museum_id, request_key) do update set
    municipal_receipt_number = excluded.municipal_receipt_number,
    internal_production = excluded.internal_production,
    receipt_registered_by = excluded.receipt_registered_by,
    receipt_registered_at = excluded.receipt_registered_at,
    approval_status = case
      when rental_approval_controls.approval_status = 'Aprobada'
       and not excluded.internal_production
       and excluded.municipal_receipt_number is null then 'Pendiente'
      else rental_approval_controls.approval_status
    end,
    approved_by = case
      when rental_approval_controls.approval_status = 'Aprobada'
       and not excluded.internal_production
       and excluded.municipal_receipt_number is null then null
      else rental_approval_controls.approved_by
    end,
    approved_at = case
      when rental_approval_controls.approval_status = 'Aprobada'
       and not excluded.internal_production
       and excluded.municipal_receipt_number is null then null
      else rental_approval_controls.approved_at
    end,
    updated_at = now()
  returning * into saved;

  insert into public.rental_approval_audit_logs
    (museum_id, request_key, actor_user_id, action, result, details)
  values (
    target_museum_id, saved.request_key, auth.uid(), 'rental.receipt.registered',
    'success', jsonb_build_object('internal_production', saved.internal_production)
  );
  return saved;
exception when unique_violation then
  insert into public.rental_approval_audit_logs
    (museum_id, request_key, actor_user_id, action, result, details)
  values (
    target_museum_id, coalesce(p_request_key, ''), auth.uid(),
    'rental.receipt.duplicate', 'blocked', '{}'::jsonb
  );
  raise exception 'This municipal receipt is already assigned to another rental.';
end;
$$;

create or replace function public.set_rental_approval(
  p_request_key text,
  p_approved boolean,
  p_internal_production boolean default false
)
returns public.rental_approval_controls
language plpgsql security definer set search_path = public, auth as $$
declare
  target_museum_id uuid;
  saved public.rental_approval_controls;
begin
  target_museum_id := public.current_rental_admin_museum();
  if target_museum_id is null then
    raise exception 'Administrative rental permission is required.';
  end if;

  insert into public.rental_approval_controls
    (museum_id, request_key, internal_production)
  values (target_museum_id, btrim(p_request_key), coalesce(p_internal_production, false))
  on conflict (museum_id, request_key) do update
    set internal_production = excluded.internal_production, updated_at = now();

  select * into saved
  from public.rental_approval_controls
  where museum_id = target_museum_id and request_key = btrim(p_request_key)
  for update;

  if p_approved and not saved.internal_production
     and nullif(btrim(saved.municipal_receipt_number), '') is null then
    insert into public.rental_approval_audit_logs
      (museum_id, request_key, actor_user_id, action, result, details)
    values (
      target_museum_id, saved.request_key, auth.uid(),
      'rental.approval.blocked_missing_receipt', 'blocked', '{}'::jsonb
    );
    raise exception 'Municipal receipt number is required before approval.';
  end if;

  update public.rental_approval_controls set
    approval_status = case when p_approved then 'Aprobada' else 'Pendiente' end,
    approved_by = case when p_approved then auth.uid() else null end,
    approved_at = case when p_approved then now() else null end,
    updated_at = now()
  where id = saved.id
  returning * into saved;

  insert into public.rental_approval_audit_logs
    (museum_id, request_key, actor_user_id, action, result, details)
  values (
    target_museum_id, saved.request_key, auth.uid(),
    case when p_approved then 'rental.approved' else 'rental.approval.withdrawn' end,
    'success', jsonb_build_object('internal_production', saved.internal_production)
  );
  return saved;
end;
$$;

alter table public.rental_approval_controls enable row level security;
alter table public.rental_approval_audit_logs enable row level security;

create policy rental_controls_admin_read
on public.rental_approval_controls for select to authenticated
using (museum_id = public.current_rental_admin_museum());

create policy rental_approval_audit_admin_read
on public.rental_approval_audit_logs for select to authenticated
using (museum_id = public.current_rental_admin_museum());

revoke all on function public.current_rental_admin_museum() from public;
revoke all on function public.record_rental_municipal_receipt(text, text, boolean) from public;
revoke all on function public.set_rental_approval(text, boolean, boolean) from public;
grant execute on function public.record_rental_municipal_receipt(text, text, boolean) to authenticated;
grant execute on function public.set_rental_approval(text, boolean, boolean) to authenticated;
