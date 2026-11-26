-- Collections read-only quota gate; preserves the existing global AI quota.
-- It uses the existing v2 shared quota counter, without widening its modes.
create or replace function public.ai_assistant_claim_collections_slot_v1(
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
    or public.has_permission('collections.read') is distinct from true
    or public.collection_can_read() is distinct from true
  then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  -- Shared, atomic 500/museum and 100/user counter. No collection writes.
  return public.ai_assistant_claim_slot_v2(p_museum_id,'product');
end;
$$;
revoke all on function public.ai_assistant_claim_collections_slot_v1(uuid) from public,anon;
grant execute on function public.ai_assistant_claim_collections_slot_v1(uuid) to authenticated;
