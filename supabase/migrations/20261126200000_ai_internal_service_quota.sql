-- INSTITUVA AI: service-only quota. No operational tables or RLS modified.
-- The Edge Function validates caller JWT, grants, module profile and museum
-- before invoking this internal RPC using its server-only service credential.
create or replace function public.ai_assistant_claim_internal_v1(
  p_museum_id uuid, p_user_id uuid
) returns boolean
language plpgsql
security invoker
set search_path to ''
as $$
declare
  mon date := date_trunc('month',timezone('America/Puerto_Rico',now()))::date;
  month_count integer;
  user_count integer;
begin
  if current_user <> 'service_role'
    or p_museum_id is null or p_user_id is null
    or not exists (
      select 1 from public.profiles pr
       where pr.id=p_user_id and pr.museum_id=p_museum_id
         and pr.status in ('active','activo')
    )
  then raise exception 'FORBIDDEN' using errcode='42501'; end if;

  -- Preserve the existing shared 500/museum and 100/user monthly cap.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instituva-ai:'||p_museum_id::text||':'||mon::text,0)
  );
  select coalesce(sum(requests_count),0) into month_count
    from public.ai_assistant_usage
    where museum_id=p_museum_id and usage_month=mon;
  select coalesce(requests_count,0) into user_count
    from public.ai_assistant_usage
    where museum_id=p_museum_id and user_id=p_user_id and usage_month=mon;
  if month_count>=500 or user_count>=100 then return false; end if;

  insert into public.ai_assistant_usage
    (museum_id,user_id,usage_month,requests_count,last_requested_at)
  values(p_museum_id,p_user_id,mon,1,now())
  on conflict(museum_id,user_id,usage_month)
  do update set requests_count=public.ai_assistant_usage.requests_count+1,
    last_requested_at=now();
  return true;
end;
$$;

-- Prevent browsers from burning another account's/museum's AI allowance by
-- calling old public RPCs directly. Only INSTITUVA AI used these helpers.
revoke all on function public.ai_assistant_claim_internal_v1(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.ai_assistant_claim_internal_v1(uuid,uuid)
  to service_role;

revoke execute on function public.ai_assistant_claim_slot(uuid,integer,integer)
  from public,anon,authenticated;
revoke execute on function public.ai_assistant_claim_slot_v2(uuid,text)
  from public,anon,authenticated;
revoke execute on function public.ai_assistant_claim_collections_slot_v1(uuid)
  from public,anon,authenticated;
revoke execute on function public.ai_assistant_claim_inventory_slot_v1(uuid)
  from public,anon,authenticated;
revoke execute on function public.ai_assistant_claim_schedules_slot_v1(uuid)
  from public,anon,authenticated;
revoke execute on function public.ai_assistant_claim_notifications_slot_v1(uuid)
  from public,anon,authenticated;
