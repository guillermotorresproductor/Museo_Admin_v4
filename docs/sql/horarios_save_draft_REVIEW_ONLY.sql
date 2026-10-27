-- REVIEW ONLY; NO PRODUCTION OR STAGING EXECUTION.
-- Read/write of weekly draft through trusted RPC with server authorization.
-- Requires schedule_week_drafts and schedule_week_draft_items schema previously reviewed.
BEGIN;
CREATE OR REPLACE FUNCTION public.save_schedule_week_draft(
 p_week_start date, p_items jsonb, p_draft_id uuid DEFAULT NULL, p_expected_revision integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
 v_museum uuid; v_user uuid := auth.uid(); v_draft public.schedule_week_drafts%rowtype;
 v_item jsonb; v_employee public.employees%rowtype; v_day date;
 v_action text; v_start time; v_end time; v_lunch integer;
 v_duration integer; v_key text; v_seen text[] := ARRAY[]::text[];
BEGIN
 IF v_user IS NULL OR NOT public.has_permission('schedules.manage') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 v_museum := public.current_user_museum_id();
 IF v_museum IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF p_week_start IS NULL OR extract(isodow FROM p_week_start) <> 1 THEN RAISE EXCEPTION 'INVALID_WEEK'; END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)>300 THEN RAISE EXCEPTION 'INVALID_ITEMS'; END IF;
 IF p_draft_id IS NULL THEN
   INSERT INTO public.schedule_week_drafts(museum_id,week_start,created_by)
   VALUES(v_museum,p_week_start,v_user) RETURNING * INTO v_draft;
 ELSE
   SELECT * INTO v_draft FROM public.schedule_week_drafts WHERE id=p_draft_id AND museum_id=v_museum FOR UPDATE;
   IF NOT FOUND OR v_draft.state<>'draft' OR p_expected_revision IS DISTINCT FROM v_draft.revision
   OR v_draft.week_start<>p_week_start THEN RAISE EXCEPTION 'DRAFT_CONFLICT'; END IF;
 END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
 LOOP
   IF jsonb_typeof(v_item)<>'object' THEN RAISE EXCEPTION 'INVALID_ITEM'; END IF;
   SELECT * INTO v_employee FROM public.employees
   WHERE id=(v_item->>'employeeId')::uuid AND museum_id=v_museum AND status='activo';
   IF NOT FOUND OR v_employee.profile_id IS NOT DISTINCT FROM v_user THEN RAISE EXCEPTION 'EMPLOYEE_FORBIDDEN'; END IF;
   v_day := (v_item->>'date')::date;
   IF v_day<p_week_start OR v_day>p_week_start+6 THEN RAISE EXCEPTION 'DATE_OUTSIDE_WEEK'; END IF;
   v_key:=v_employee.id::text||'|'||v_day::text;
   IF v_key=ANY(v_seen) THEN RAISE EXCEPTION 'DUPLICATE_DAY'; END IF;
   v_seen:=array_append(v_seen,v_key);
   v_action:=CASE WHEN coalesce((v_item->>'dayOff')::boolean,false) THEN 'day_off' ELSE 'set_shift' END;
   IF v_action='set_shift' THEN
      v_start:=(v_item->>'start')::time; v_end:=(v_item->>'end')::time;
      v_lunch:=(v_item->>'lunch')::integer;
      IF v_start IS NULL OR v_end IS NULL OR v_start=v_end OR v_lunch IS NULL OR v_lunch<0 THEN RAISE EXCEPTION 'INVALID_SHIFT'; END IF;
      v_duration:=((extract(epoch FROM (v_end-v_start))/60)::integer+1440)%1440-v_lunch;
      IF v_duration<1 OR v_duration>480 THEN RAISE EXCEPTION 'INVALID_HOURS'; END IF;
   ELSE v_start:=NULL; v_end:=NULL; v_lunch:=NULL; END IF;
   IF length(coalesce(v_item->>'reason',''))>240 THEN RAISE EXCEPTION 'INVALID_REASON'; END IF;
 END LOOP;
 DELETE FROM public.schedule_week_draft_items WHERE draft_id=v_draft.id;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
 LOOP
   INSERT INTO public.schedule_week_draft_items(draft_id,employee_id,shift_date,action,starts_local,ends_local,lunch_minutes,reason,source_shift_id,source_updated_at)
   VALUES(v_draft.id,(v_item->>'employeeId')::uuid,(v_item->>'date')::date,
   CASE WHEN coalesce((v_item->>'dayOff')::boolean,false) THEN 'day_off' ELSE 'set_shift' END,
   CASE WHEN coalesce((v_item->>'dayOff')::boolean,false) THEN NULL ELSE (v_item->>'start')::time END,
   CASE WHEN coalesce((v_item->>'dayOff')::boolean,false) THEN NULL ELSE (v_item->>'end')::time END,
   CASE WHEN coalesce((v_item->>'dayOff')::boolean,false) THEN NULL ELSE (v_item->>'lunch')::integer END,
   coalesce(v_item->>'reason',''),NULL,NULL);
 END LOOP;
 UPDATE public.schedule_week_drafts SET revision=revision+1,updated_at=now() WHERE id=v_draft.id
 RETURNING * INTO v_draft;
 RETURN jsonb_build_object('id',v_draft.id,'revision',v_draft.revision,'state',v_draft.state,'item_count',jsonb_array_length(p_items));
END $fn$;
REVOKE ALL ON FUNCTION public.save_schedule_week_draft(date,jsonb,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_schedule_week_draft(date,jsonb,uuid,integer) TO authenticated;
COMMIT;
