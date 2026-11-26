-- INSTITUVA AI - isolated initial production bootstrap.
-- NOT auto-applied. Execute only against verified project kfokfjngozgcwjpzxcsu
-- through an approved, scoped, recorded change window.
-- Never use supabase db push or run unrelated staging migrations.
-- The assistant remains OFF in the UI and Edge allowlist until separately approved.
-- No museum operational tables, policies, employee data or Storage are modified.

-- Fail closed rather than replace an existing service or usage ledger.
do $preflight$
begin
  if to_regclass('public.ai_assistant_usage') is not null
     or to_regprocedure('public.ai_assistant_claim_internal_v1(uuid,uuid)') is not null then
    raise exception 'INSTITUVA_AI_BOOTSTRAP_ALREADY_PRESENT';
  end if;
  if to_regclass('public.museums') is null
     or to_regclass('public.profiles') is null then
    raise exception 'INSTITUVA_AI_MISSING_CORE_DEPENDENCY';
  end if;
end;
$preflight$;

create table public.ai_assistant_usage (
  museum_id uuid not null references public.museums(id),
  user_id uuid not null references auth.users(id),
  usage_month date not null,
  requests_count integer not null default 0 check(requests_count >= 0),
  last_requested_at timestamptz,
  primary key (museum_id,user_id,usage_month)
);
alter table public.ai_assistant_usage enable row level security;
revoke all on table public.ai_assistant_usage from public,anon,authenticated;
-- No client-side RLS policies: only service_role may update the quota ledger.

create function public.ai_assistant_claim_internal_v1(
  p_museum_id uuid, p_user_id uuid
) returns boolean
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  mon date := pg_catalog.date_trunc('month',
    pg_catalog.timezone('America/Puerto_Rico',pg_catalog.now()))::date;
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
  then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'instituva-ai:'||p_museum_id::text||':'||mon::text,0)
  );
  select pg_catalog.coalesce(pg_catalog.sum(requests_count),0)
    into month_count from public.ai_assistant_usage
    where museum_id=p_museum_id and usage_month=mon;
  select pg_catalog.coalesce(requests_count,0) into user_count
    from public.ai_assistant_usage
    where museum_id=p_museum_id and user_id=p_user_id and usage_month=mon;
  if month_count>=500 or user_count>=100 then return false; end if;

  insert into public.ai_assistant_usage
    (museum_id,user_id,usage_month,requests_count,last_requested_at)
  values(p_museum_id,p_user_id,mon,1,pg_catalog.now())
  on conflict(museum_id,user_id,usage_month)
  do update set requests_count=public.ai_assistant_usage.requests_count+1,
    last_requested_at=pg_catalog.now();
  return true;
end;
$function$;

revoke all on function public.ai_assistant_claim_internal_v1(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.ai_assistant_claim_internal_v1(uuid,uuid)
  to service_role;
