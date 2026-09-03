begin;

create schema inventory_transition_test;
create table inventory_transition_test.inventory_items (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null,
  name text not null,
  description text,
  asset_tag text,
  location text,
  condition_status text,
  contact_or_donor text,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table inventory_transition_test.inventory_items enable row level security;
create policy synthetic_legacy_read on inventory_transition_test.inventory_items for select using (true);

do $$
declare
  v_count bigint;
begin
  select count(*) into v_count from inventory_transition_test.inventory_items;
  if v_count <> 0 then
    raise exception 'Synthetic legacy table must be empty';
  end if;
  alter table inventory_transition_test.inventory_items rename to inventory_items_pre_v1;
  revoke all on table inventory_transition_test.inventory_items_pre_v1 from public, anon, authenticated;
  comment on table inventory_transition_test.inventory_items_pre_v1 is
    'Synthetic rollback validation of inventory legacy transition.';
end;
$$;

do $$
begin
  if to_regclass('inventory_transition_test.inventory_items') is not null
     or to_regclass('inventory_transition_test.inventory_items_pre_v1') is null then
    raise exception 'Synthetic legacy transition did not preserve the renamed table';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'inventory_transition_test'
      and tablename = 'inventory_items_pre_v1'
      and policyname = 'synthetic_legacy_read'
  ) then
    raise exception 'Synthetic legacy policy was not preserved';
  end if;
end;
$$;

rollback;
select 'inventory_legacy_transition_synthetic_rollback_passed' as result;
