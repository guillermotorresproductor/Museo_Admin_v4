-- IT-2026-004 Staging transaction-only regression test.
-- Uses staging fixture employees and current production RPC signature.
-- ALL fixture data, configuration, and the temporary compatibility column ROLLBACK.
-- DO NOT execute in production. No payroll records survive.
BEGIN;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS attendance_required boolean NOT NULL DEFAULT true;
UPDATE public.attendance_settings SET presence_required=false WHERE museum_id='3add0f7a-cf6a-4a37-9bf6-feb1cdc5be36';
DO $test$
DECLARE
 e_old public.employees; e_new public.employees;
 old_shift uuid; new_shift uuid; result jsonb;
 local_day date := (now() AT TIME ZONE 'America/Puerto_Rico')::date;
BEGIN
 SELECT * INTO e_old FROM public.employees WHERE id='9b34ef88-b255-4eb6-9a03-a75f1fcf7d02';
 SELECT * INTO e_new FROM public.employees WHERE id='54d05a7c-06f2-4365-b2b0-41fa3d962b10';
 IF e_old.id IS NULL OR e_new.id IS NULL THEN
   RAISE EXCEPTION 'Missing synthetic staging fixtures';
 END IF;
 INSERT INTO public.employee_shifts(museum_id,employee_id,shift_date,starts_at,ends_at,status,expected_lunch_minutes,created_by)
 VALUES(e_old.museum_id,e_old.id,local_day,now()-interval '1 hour',now()+interval '8 hours','scheduled',60,e_old.profile_id)
 RETURNING id INTO old_shift;
 INSERT INTO public.employee_shifts(museum_id,employee_id,shift_date,starts_at,ends_at,status,expected_lunch_minutes,created_by)
 VALUES(e_new.museum_id,e_new.id,local_day,now()-interval '1 hour',now()+interval '8 hours','scheduled',60,e_new.profile_id)
 RETURNING id INTO new_shift;
 -- Case A: previous unfinished day must not corrupt today's payroll or create a new event.
 INSERT INTO public.employee_time_entries(museum_id,employee_id,clock_in,created_by)
 VALUES(e_old.museum_id,e_old.id,now()-interval '1 day',e_old.profile_id);
 result:=public.record_employee_attendance(e_old.profile_id,e_old.museum_id,'clock_in','{}'::jsonb);
 IF result->>'code' IS DISTINCT FROM 'PREVIOUS_SHIFT_OPEN' THEN
   RAISE EXCEPTION 'A: unexpected response: %',result;
 END IF;
 IF EXISTS(SELECT 1 FROM public.attendance_events WHERE shift_id=old_shift) THEN
   RAISE EXCEPTION 'A: phantom event was created';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.attendance_attempts WHERE shift_id=old_shift AND reason_code='PREVIOUS_SHIFT_OPEN') THEN
   RAISE EXCEPTION 'A: missing audit of denied attempt';
 END IF;
 -- Case B: normal employee must still be able to clock in.
 result:=public.record_employee_attendance(e_new.profile_id,e_new.museum_id,'clock_in','{}'::jsonb);
 IF result->>'ok' IS DISTINCT FROM 'true' THEN
   RAISE EXCEPTION 'B: normal punch failed: %',result;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.employee_time_entries WHERE employee_id=e_new.id AND clock_out IS NULL) THEN
   RAISE EXCEPTION 'B: normal time entry absent';
 END IF;
 -- Case C: duplicate entrance must remain rejected by the unchanged sequence rules.
 result:=public.record_employee_attendance(e_new.profile_id,e_new.museum_id,'clock_in','{}'::jsonb);
 IF result->>'code' IS DISTINCT FROM 'INVALID_EVENT_SEQUENCE' THEN
   RAISE EXCEPTION 'C: repeated punch not rejected: %',result;
 END IF;
 -- Case D: attendance exemption still takes precedence.
 UPDATE public.employees SET attendance_required=false WHERE id=e_old.id;
 result:=public.record_employee_attendance(e_old.profile_id,e_old.museum_id,'clock_in','{}'::jsonb);
 IF result->>'code' IS DISTINCT FROM 'ATTENDANCE_NOT_REQUIRED' THEN
   RAISE EXCEPTION 'D: exempt employee was not protected: %',result;
 END IF;
 RAISE NOTICE 'PASS: A stale open, B normal punch, C duplicate, D exempt';
END $test$;
ROLLBACK;
