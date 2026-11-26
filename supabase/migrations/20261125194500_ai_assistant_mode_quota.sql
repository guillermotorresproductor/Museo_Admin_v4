-- AI assistant quota v2: isolated from the legacy procedure and business records.
-- OFF unless the Edge Function explicitly enables the museum.
-- Reads current authenticated user and effective DB permissions at claim time.
create or replace function public.ai_assistant_claim_slot_v2(
  p_museum_id uuid, p_mode text
) returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  mon date := date_trunc('month',timezone('America/Puerto_Rico',now()))::date;
  month_count integer;
  user_count integer;
begin
  if me is null
    or p_museum_id is null
    or p_museum_id is distinct from public.current_user_museum_id()
    or not exists (
      select 1 from public.profiles pr
      where pr.id=me and pr.museum_id=p_museum_id
        and pr.status in ('active','activo')
    )
  then raise exception 'FORBIDDEN' using errcode='42501'; end if;

  if p_mode = 'finance' then
    if public.has_permission('finance.read') is distinct from true
    then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  elsif p_mode = 'attendance' then
    if public.has_permission('attendance.history.read') is distinct from true
      or public.has_permission('finance.read') is distinct from true
    then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  elsif p_mode is distinct from 'product' then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  -- Shared atomic cap across both versions: 500 per museum / 100 per user.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instituva-ai:'||p_museum_id::text||':'||mon::text,0)
  );
  select coalesce(sum(requests_count),0) into month_count
    from public.ai_assistant_usage
    where museum_id=p_museum_id and usage_month=mon;
  select coalesce(requests_count,0) into user_count
    from public.ai_assistant_usage
    where museum_id=p_museum_id and user_id=me and usage_month=mon;
  if month_count>=500 or user_count>=100 then return false; end if;

  insert into public.ai_assistant_usage(museum_id,user_id,usage_month,requests_count,last_requested_at)
  values (p_museum_id,me,mon,1,now())
  on conflict (museum_id,user_id,usage_month)
  do update set requests_count=public.ai_assistant_usage.requests_count+1,last_requested_at=now();
  return true;
end;
$$;
revoke all on function public.ai_assistant_claim_slot_v2(uuid,text) from public,anon;
grant execute on function public.ai_assistant_claim_slot_v2(uuid,text) to authenticated;
