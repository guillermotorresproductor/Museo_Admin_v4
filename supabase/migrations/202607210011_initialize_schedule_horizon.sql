-- Populate the horizon immediately on deployment and prove that rerunning the
-- generator is safe. The daily cron job will maintain it from this point on.

do $$
declare
  first_run jsonb;
  second_run jsonb;
begin
  if not exists(
    select 1
      from cron.job
     where jobname='instituva-attendance-horizon-daily'
       and active=true
  ) then
    raise exception 'ATTENDANCE_HORIZON_JOB_NOT_ACTIVE';
  end if;

  first_run:=public.refresh_attendance_schedule_horizon(90);
  if coalesce((first_run->>'failed_rules')::integer,0)>0 then
    raise exception 'INITIAL_ATTENDANCE_HORIZON_FAILED: %',first_run;
  end if;

  second_run:=public.refresh_attendance_schedule_horizon(90);
  if coalesce((second_run->>'failed_rules')::integer,0)>0
     or coalesce((second_run->>'generated_shifts')::integer,0)<>0 then
    raise exception 'ATTENDANCE_HORIZON_NOT_IDEMPOTENT: %',second_run;
  end if;
end
$$;
