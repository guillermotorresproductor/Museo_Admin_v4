-- Harden table privileges on public.finance_records.
-- Removes inherited/default grants; restores only SELECT, INSERT, UPDATE for authenticated.
-- Does not alter RLS policies, schema, data, service_role, or RBAC permissions.

revoke all on table public.finance_records from anon;
revoke all on table public.finance_records from authenticated;

grant select, insert, update on table public.finance_records to authenticated;
