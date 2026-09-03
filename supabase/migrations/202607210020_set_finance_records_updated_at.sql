-- Keep finance_records.updated_at current on row updates.
-- Does not backfill existing rows, alter created_at, or change grants/RLS/data.

create or replace function public.set_finance_records_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.set_finance_records_updated_at() from public;
drop trigger if exists finance_records_set_updated_at on public.finance_records;
create trigger finance_records_set_updated_at
before update on public.finance_records
for each row
execute function public.set_finance_records_updated_at();
