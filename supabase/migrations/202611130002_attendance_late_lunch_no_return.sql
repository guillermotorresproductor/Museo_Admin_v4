-- IT-2026-004 second stage: cover real late lunch-out punches with no return.
-- Derived from live production function as of 2026-11-13.
-- Leaves existing 9-hour auto-close rule unchanged for normal lunch departures.
-- Never synthesizes an attendance clock-out event; uses the recorded lunch_out
-- timestamp for the time-entry close, with distinct review reason if late.
-- Never changes RLS, policies, role permissions, employee shifts or old records.
-- Requires staging regression, review of any payroll interpretation, then approval.
CREATE OR REPLACE FUNCTION public.process_attendance_lunch_absence_closures(p_now timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  r record; v_clockin timestamptz; v_lunch timestamptz;
  v_activation timestamptz;
  v_ci integer; v_lo integer; v_li integer; v_co integer; v_other integer;
  v_changed integer; affected integer := 0;
BEGIN
  -- Only trusted cron/backend database sessions; EXECUTE is also revoked from public.
  IF session_user NOT IN ('postgres','supabase_admin') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING errcode='42501';
  END IF;
  SELECT active_from INTO v_activation FROM public.attendance_auto_closure_activation WHERE id=true;
  IF v_activation IS NULL THEN RETURN 0; END IF;
  FOR r IN
    SELECT s.id, s.museum_id, s.employee_id, s.starts_at, s.ends_at
    FROM public.employee_shifts s
    WHERE s.status='scheduled'
      AND s.expected_lunch_minutes=60
      AND s.ends_at-s.starts_at=interval '9 hours'
      AND s.starts_at>=v_activation
      AND s.ends_at<=p_now
      AND s.shift_date >= (p_now AT TIME ZONE 'America/Puerto_Rico')::date - 14
      AND NOT EXISTS(select 1 from public.attendance_auto_closures ac where ac.shift_id=s.id)
    ORDER BY s.ends_at, s.id
  LOOP
    -- Serializes concurrent auto-close executions and locks the same shift used by attendance RPC.
    PERFORM pg_advisory_xact_lock(hashtextextended(r.employee_id::text || ':' || r.id::text,0));
    PERFORM 1 FROM public.employee_shifts s WHERE s.id=r.id AND s.status='scheduled' FOR UPDATE;
    IF NOT FOUND OR EXISTS(select 1 from public.attendance_auto_closures ac where ac.shift_id=r.id) THEN
      CONTINUE;
    END IF;
    SELECT min(e.occurred_at) FILTER(where e.event_type='clock_in'),
           min(e.occurred_at) FILTER(where e.event_type='lunch_out'),
           count(*) FILTER(where e.event_type='clock_in'),
           count(*) FILTER(where e.event_type='lunch_out'),
           count(*) FILTER(where e.event_type='lunch_in'),
           count(*) FILTER(where e.event_type='clock_out'),
           count(*) FILTER(where e.event_type NOT IN ('clock_in','lunch_out','lunch_in','clock_out'))
      INTO v_clockin,v_lunch,v_ci,v_lo,v_li,v_co,v_other
    FROM public.attendance_events e
    WHERE e.shift_id=r.id AND e.museum_id=r.museum_id AND e.employee_id=r.employee_id
      AND NOT EXISTS(select 1 from public.attendance_events newer where newer.supersedes_event_id=e.id)
      AND NOT public.attendance_is_excluded(e.shift_id,e.id)
      AND NOT public.attendance_is_excluded(e.shift_id,null);
    IF v_ci<>1 OR v_lo<>1 OR v_li<>0 OR v_co<>0 OR v_other<>0
       OR v_lunch<=v_clockin
       -- A recorded departure after 8 hours is still an actual departure.
       -- Restrict late departures to <=30 minutes past scheduled end and wait
       -- at least 60 minutes after the punch before concluding no return.
       OR (v_lunch>v_clockin+interval '8 hours'
           AND v_lunch>r.ends_at+interval '30 minutes')
       OR p_now<greatest(v_clockin+interval '9 hours',v_lunch+interval '1 hour') THEN
       CONTINUE;
    END IF;
    -- Ambiguous/missing employee_time_entries are not altered.
    IF (SELECT count(*) FROM public.employee_time_entries t
        WHERE t.museum_id=r.museum_id AND t.employee_id=r.employee_id
          AND t.clock_out IS NULL AND t.excluded_at IS NULL
          AND t.clock_in BETWEEN v_clockin-interval '2 minutes' AND v_clockin+interval '2 minutes')<>1
    THEN CONTINUE; END IF;
    UPDATE public.employee_time_entries t SET clock_out=v_lunch, updated_at=now()
      WHERE t.museum_id=r.museum_id AND t.employee_id=r.employee_id
        AND t.clock_out IS NULL AND t.excluded_at IS NULL
        AND t.clock_in BETWEEN v_clockin-interval '2 minutes' AND v_clockin+interval '2 minutes';
    GET DIAGNOSTICS v_changed=ROW_COUNT;
    IF v_changed<>1 THEN RAISE EXCEPTION 'AUTO_CLOSE_CONCURRENT_TIME_ENTRY_CHANGE: %',r.id; END IF;
    INSERT INTO public.attendance_auto_closures
      (shift_id,museum_id,employee_id,clock_in_at,lunch_out_at,administrative_closed_at,payable_minutes,closure_reason)
    VALUES (r.id,r.museum_id,r.employee_id,v_clockin,v_lunch,
            greatest(v_clockin+interval '9 hours',v_lunch+interval '1 hour'),
            least(480,greatest(0,floor(extract(epoch from (v_lunch-v_clockin))/60))::integer),
            case when v_lunch>v_clockin+interval '8 hours'
                 then 'LATE_LUNCH_NO_RETURN_REVIEW' else 'NO_LUNCH_RETURN' end)
    ON CONFLICT (shift_id) DO NOTHING;
    GET DIAGNOSTICS v_changed=ROW_COUNT;
    affected:=affected+v_changed;
  END LOOP;
  RETURN affected;
END $function$
;