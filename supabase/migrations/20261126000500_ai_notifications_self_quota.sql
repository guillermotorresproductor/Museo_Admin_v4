-- Per-user notifications diagnostics. Never expand access to another employee's inbox.
-- Reuse the global atomic v2 usage cap. No operational notification writes.
create or replace function public.ai_assistant_claim_notifications_slot_v1(
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
    or public.has_permission('notifications.read.self') is distinct from true
  then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  return public.ai_assistant_claim_slot_v2(p_museum_id,'product');
end;
$$;
revoke all on function public.ai_assistant_claim_notifications_slot_v1(uuid) from public,anon;
grant execute on function public.ai_assistant_claim_notifications_slot_v1(uuid) to authenticated;
