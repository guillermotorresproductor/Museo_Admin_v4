-- INSTITUVA AI schedules: existing time.read.all authorization and shared quota.
-- No changes to schedules, attendance, payroll or existing permission policies.
create or replace function public.ai_assistant_claim_schedules_slot_v1(
  p_museum_id uuid
) returns boolean
language plpgsql
security invoker
set search_path to ''
as $$
begin
  if auth.uid() is null
    or p_museum_id is null
    or p_museum_id is distinct from public.current_user_museum_id()
    or public.has_permission('time.read.all') is distinct from true
  then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  return public.ai_assistant_claim_slot_v2(p_museum_id,'product');
end;
$$;
revoke all on function public.ai_assistant_claim_schedules_slot_v1(uuid) from public,anon;
grant execute on function public.ai_assistant_claim_schedules_slot_v1(uuid) to authenticated;
