-- INSTITUVA AI v1: operational records remain READ ONLY.
-- This separate table holds only the number of assistant queries, no prompts,
-- employee names, salary, responses, or attendance records.
create table if not exists public.ai_assistant_usage (
 museum_id uuid not null references public.museums(id),
 user_id uuid not null references auth.users(id),
 usage_month date not null,
 requests_count integer not null default 0 check (requests_count >= 0),
 last_requested_at timestamptz,
 primary key (museum_id,user_id,usage_month)
);
alter table public.ai_assistant_usage enable row level security;
revoke all on public.ai_assistant_usage from anon,authenticated;
-- Intentionally no direct client-side policies. The only mutation is the
-- fixed quota claim function; it cannot alter museum operational tables.

create or replace function public.ai_assistant_claim_slot(
  p_museum_id uuid, p_monthly_limit integer default 500, p_per_user_limit integer default 100
)
returns boolean
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
  if me is null or p_museum_id is null or p_museum_id is distinct from public.current_user_museum_id()
     or not public.has_permission('attendance.history.read')
     or not public.has_permission('finance.read')
  then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  -- Caller cannot increase quota via function arguments.
  if p_monthly_limit is distinct from 500 or p_per_user_limit is distinct from 100 then
    raise exception 'INVALID_QUOTA' using errcode='22023'; end if;
  -- Serializes quota checks per museum/month across all function instances.
  perform pg_advisory_xact_lock(hashtextextended('instituva-ai:'||p_museum_id::text||':'||mon::text,0));
  select coalesce(sum(requests_count),0) into month_count from public.ai_assistant_usage
    where museum_id=p_museum_id and usage_month=mon;
  select coalesce(requests_count,0) into user_count from public.ai_assistant_usage
    where museum_id=p_museum_id and user_id=me and usage_month=mon;
  if month_count>=500 or user_count>=100 then return false; end if;
  insert into public.ai_assistant_usage(museum_id,user_id,usage_month,requests_count,last_requested_at)
  values(p_museum_id,me,mon,1,now())
  on conflict (museum_id,user_id,usage_month)
  do update set requests_count=public.ai_assistant_usage.requests_count+1,last_requested_at=now();
  return true;
end;
$$;
revoke all on function public.ai_assistant_claim_slot(uuid,integer,integer) from public,anon;
grant execute on function public.ai_assistant_claim_slot(uuid,integer,integer) to authenticated;
