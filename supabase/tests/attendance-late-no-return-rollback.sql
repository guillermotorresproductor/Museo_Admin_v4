-- IT-2026-004: isolated late no-return closure test.
-- Execute only in staging. Synthetic attendance and the new RPC are rolled back.
BEGIN;
CREATE TABLE public.attendance_auto_closure_activation(id boolean PRIMARY KEY,active_from timestamptz NOT NULL);
INSERT INTO public.attendance_auto_closure_activation VALUES(true,now()-interval '14 days');
-- The next statement is substituted from the candidate migration when executing:
-- {{CANDIDATE_CLOSURE_FUNCTION}}
DO $test$
DECLARE
 e public.employees; sh uuid; ai uuid; t0 timestamptz; outbound timestamptz;
 d date := (now() AT TIME ZONE 'America/Puerto_Rico')::date - 1;
 scenario int:=0; actual_reason text; payable int; actual_out timestamptz; n int;
BEGIN
 FOR e IN SELECT * FROM public.employees WHERE id IN (
 '9b34ef88-b255-4eb6-9a03-a75f1fcf7d02',
 '54d05a7c-06f2-4365-b2b0-41fa3d962b10',
 'cf8ab07f-7b69-4799-94ec-efba4d519c4c') ORDER BY id LOOP
 scenario:=scenario+1;
 t0:=(d+time '08:00') AT TIME ZONE 'America/Puerto_Rico';
 outbound:=CASE scenario WHEN 1 THEN t0+interval '9 hours 16 minutes'
                         WHEN 2 THEN t0+interval '3 hours'
                         ELSE t0+interval '10 hours' END;
 INSERT INTO public.employee_shifts(museum_id,employee_id,shift_date,starts_at,ends_at,status,expected_lunch_minutes,created_by)
 VALUES(e.museum_id,e.id,d,t0,t0+interval '9 hours','scheduled',60,e.profile_id) RETURNING id INTO sh;
 INSERT INTO public.employee_time_entries(museum_id,employee_id,clock_in,created_by)
 VALUES(e.museum_id,e.id,t0,e.profile_id);
 INSERT INTO public.attendance_attempts(museum_id,employee_id,shift_id,actor_user_id,requested_event,result)
 VALUES(e.museum_id,e.id,sh,e.profile_id,'clock_in','accepted') RETURNING id INTO ai;
 INSERT INTO public.attendance_events(museum_id,employee_id,shift_id,attempt_id,event_type,occurred_at,classification,settings_version,created_by)
 VALUES(e.museum_id,e.id,sh,ai,'clock_in',t0,'on_time',1,e.profile_id);
 INSERT INTO public.attendance_attempts(museum_id,employee_id,shift_id,actor_user_id,requested_event,result)
 VALUES(e.museum_id,e.id,sh,e.profile_id,'lunch_out','accepted') RETURNING id INTO ai;
 INSERT INTO public.attendance_events(museum_id,employee_id,shift_id,attempt_id,event_type,occurred_at,classification,settings_version,created_by)
 VALUES(e.museum_id,e.id,sh,ai,'lunch_out',outbound,'standard',1,e.profile_id);
 PERFORM public.process_attendance_lunch_absence_closures(now());
 SELECT ac.closure_reason,ac.payable_minutes,te.clock_out INTO actual_reason,payable,actual_out
 FROM public.employee_time_entries te
 LEFT JOIN public.attendance_auto_closures ac ON ac.employee_id=te.employee_id AND ac.shift_id=sh
 WHERE te.employee_id=e.id AND te.clock_in=t0;
 IF scenario=1 AND (actual_reason IS DISTINCT FROM 'LATE_LUNCH_NO_RETURN_REVIEW'
    OR actual_out IS DISTINCT FROM outbound OR payable IS DISTINCT FROM 480) THEN
   RAISE EXCEPTION 'Late-out test failed %,%,%',actual_reason,actual_out,payable;
 END IF;
 IF scenario=2 AND (actual_reason IS DISTINCT FROM 'NO_LUNCH_RETURN'
    OR actual_out IS DISTINCT FROM outbound OR payable IS DISTINCT FROM 180) THEN
   RAISE EXCEPTION 'Normal closure regression failed %,%,%',actual_reason,actual_out,payable;
 END IF;
 IF scenario=3 AND (actual_reason IS NOT NULL OR actual_out IS NOT NULL) THEN
   RAISE EXCEPTION 'Out-of-window exit should require human review';
 END IF;
 SELECT count(*) INTO n FROM public.attendance_events WHERE shift_id=sh AND event_type='clock_out';
 IF n<>0 THEN RAISE EXCEPTION 'An invented punch was created'; END IF;
 END LOOP;
 IF scenario<>3 THEN RAISE EXCEPTION 'Not all fixtures executed'; END IF;
 RAISE NOTICE 'PASS: late 17:16, normal 11:00, out-of-window 18:00';
END $test$;
ROLLBACK;
