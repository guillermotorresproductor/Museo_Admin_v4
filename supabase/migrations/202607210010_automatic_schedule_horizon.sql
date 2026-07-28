-- Keep the rolling attendance horizon populated without manual intervention.
-- The existing unique index makes materialization idempotent; the advisory lock
-- prevents overlapping scheduler executions from doing duplicate work.

create extension if not exists pg_cron with schema extensions;

create table public.attendance_schedule_job_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  horizon_days integer not null check(horizon_days between 1 and 180),
  active_rules integer not null default 0,
  generated_shifts integer not null default 0,
  failed_rules integer not null default 0,
  status text not null default 'running' check(status in ('running','completed','partial_failure','skipped')),
  error_details jsonb not null default '[]'::jsonb,
  check(jsonb_typeof(error_details)='array')
);

create index attendance_schedule_job_runs_started_idx
  on public.attendance_schedule_job_runs(started_at desc);

alter table public.attendance_schedule_job_runs enable row level security;

create policy attendance_schedule_job_runs_admin_read
  on public.attendance_schedule_job_runs
  for select
  to authenticated
  using(
    public.has_permission('schedules.manage')
    or public.has_permission('audit.read')
  );

grant select on public.attendance_schedule_job_runs to authenticated;
revoke insert,update,delete on public.attendance_schedule_job_runs from authenticated;

create or replace function public.refresh_attendance_schedule_horizon(horizon_days integer default 90)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  run_id uuid;
  rule_row record;
  rule_count integer:=0;
  generated_count integer:=0;
  failed_count integer:=0;
  rule_generated integer:=0;
  errors jsonb:='[]'::jsonb;
  final_status text;
begin
  if horizon_days<1 or horizon_days>180 then
    raise exception 'INVALID_HORIZON' using errcode='22023';
  end if;

  insert into public.attendance_schedule_job_runs(horizon_days)
  values(horizon_days)
  returning id into run_id;

  if not pg_try_advisory_xact_lock(487352901246810) then
    update public.attendance_schedule_job_runs
       set finished_at=now(),status='skipped'
     where id=run_id;
    return jsonb_build_object(
      'run_id',run_id,
      'status','skipped',
      'reason','ALREADY_RUNNING'
    );
  end if;

  for rule_row in
    select id
      from public.attendance_schedule_rules
     where active=true
       and (effective_until is null or effective_until>=(now() at time zone timezone)::date)
     order by id
  loop
    rule_count:=rule_count+1;
    begin
      rule_generated:=public.materialize_attendance_shifts(rule_row.id,horizon_days);
      generated_count:=generated_count+rule_generated;
    exception when others then
      failed_count:=failed_count+1;
      errors:=errors||jsonb_build_array(jsonb_build_object(
        'rule_id',rule_row.id,
        'sqlstate',sqlstate,
        'message',sqlerrm
      ));
    end;
  end loop;

  final_status:=case when failed_count=0 then 'completed' else 'partial_failure' end;

  update public.attendance_schedule_job_runs
     set finished_at=now(),
         active_rules=rule_count,
         generated_shifts=generated_count,
         failed_rules=failed_count,
         status=final_status,
         error_details=errors
   where id=run_id;

  return jsonb_build_object(
    'run_id',run_id,
    'status',final_status,
    'active_rules',rule_count,
    'generated_shifts',generated_count,
    'failed_rules',failed_count
  );
end
$$;

revoke all on function public.refresh_attendance_schedule_horizon(integer)
  from public,anon,authenticated;
grant execute on function public.refresh_attendance_schedule_horizon(integer)
  to service_role;

-- 05:15 UTC is 01:15 in Puerto Rico throughout the year.
select cron.schedule(
  'instituva-attendance-horizon-daily',
  '15 5 * * *',
  $cron$select public.refresh_attendance_schedule_horizon(90);$cron$
);
