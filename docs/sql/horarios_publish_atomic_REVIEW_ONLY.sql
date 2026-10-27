-- REVIEW ONLY. Do not deploy before isolated transactional integration tests.
-- Existing shift RPCs run WITHIN this PostgreSQL call / same transaction.
-- Any exception rolls back all prior changes, including audits.
BEGIN;
CREATE OR REPLACE FUNCTION public.publish_schedule_week(
 p_draft_id uuid, p_expected_revision integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $pub$
DECLARE
 v_actor uuid := auth.uid();
 v_museum uuid;
 v_draft public.schedule_week_drafts%rowtype;
 v_item public.schedule_week_draft_items%rowtype;
 v_emp public.employees%rowtype;
 v_current public.employee_shifts%rowtype;
 v_count integer := 0;
 v_shifts jsonb;
 v_now date := (now() AT TIME ZONE 'America/Puerto_Rico')::date;
 v_n int;
 v_existing_count int;
 v_week_minutes int;
BEGIN
 IF v_actor IS NULL OR NOT public.has_permission('schedules.manage') THEN
   RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
 END IF;
 v_museum := public.current_user_museum_id();
 IF v_museum IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_draft FROM public.schedule_week_drafts
 WHERE id=p_draft_id AND museum_id=v_museum FOR UPDATE;
 IF NOT FOUND OR v_draft.state<>'draft'
    OR v_draft.revision IS DISTINCT FROM p_expected_revision THEN
   RAISE EXCEPTION 'DRAFT_CONFLICT';
 END IF;
 -- Serialize all weekly scheduling operations that use the same lock protocol.
 PERFORM pg_advisory_xact_lock(hashtextextended(v_museum::text||'|'||v_draft.week_start::text,0));
 SELECT count(*) INTO v_n FROM public.schedule_week_draft_items WHERE draft_id=v_draft.id;
 IF v_n=0 OR v_n>300 THEN RAISE EXCEPTION 'INVALID_BATCH'; END IF;
 -- Stage 1: fail closed on stale rows, on untracked shifts, or past dates.
 FOR v_item IN SELECT * FROM public.schedule_week_draft_items
 WHERE draft_id=v_draft.id ORDER BY employee_id,shift_date
 LOOP
   IF v_item.shift_date < v_draft.week_start OR v_item.shift_date>v_draft.week_start+6
      OR v_item.shift_date<=v_now THEN RAISE EXCEPTION 'INVALID_DATE'; END IF;
   SELECT * INTO v_emp FROM public.employees
   WHERE id=v_item.employee_id AND museum_id=v_museum AND status='activo' FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'EMPLOYEE_NOT_ACTIVE'; END IF;
   -- Identity matching must be confirmed against actual employee/profile mapping.
   -- REVISIÓN PENDIENTE: modelo de identidad verificado por los RPC existentes.
   -- Sin esa garantía, la operación falla cerrada, incluso con autorización administrativa.
   RAISE EXCEPTION 'IDENTITY_MODEL_UNVERIFIED';
   IF v_item.action='set_shift' THEN
      IF v_item.lunch_minutes IS NULL OR v_item.lunch_minutes<0
      OR ((extract(epoch FROM (v_item.ends_local-v_item.starts_local))/60)::integer+1440)%1440-v_item.lunch_minutes NOT BETWEEN 1 AND 480
      THEN RAISE EXCEPTION 'INVALID_HOURS'; END IF;
   END IF;
   -- Fail closed until snapshots are captured by the draft-save RPC.
   IF EXISTS(SELECT 1 FROM public.employee_shifts
     WHERE employee_id=v_item.employee_id AND museum_id=v_museum
     AND shift_date=v_item.shift_date AND status IN ('scheduled','completed'))
      AND v_item.source_shift_id IS NULL THEN
      RAISE EXCEPTION 'MISSING_BASELINE_SNAPSHOT';
   END IF;
   SELECT count(*) INTO v_existing_count FROM public.employee_shifts
     WHERE employee_id=v_item.employee_id AND museum_id=v_museum
     AND shift_date=v_item.shift_date AND status IN ('scheduled','completed');
   IF v_existing_count > 1 THEN RAISE EXCEPTION 'MULTIPLE_OR_COMPLETED_SHIFTS'; END IF;
   IF EXISTS(SELECT 1 FROM public.employee_shifts WHERE employee_id=v_item.employee_id
     AND museum_id=v_museum AND shift_date=v_item.shift_date AND status='completed')
     THEN RAISE EXCEPTION 'COMPLETED_SHIFT_LOCKED'; END IF;
   IF v_item.source_shift_id IS NOT NULL THEN
      SELECT * INTO v_current FROM public.employee_shifts
      WHERE id=v_item.source_shift_id AND employee_id=v_item.employee_id
      AND museum_id=v_museum AND shift_date=v_item.shift_date AND status='scheduled'
      FOR UPDATE;
      IF NOT FOUND OR v_current.updated_at IS DISTINCT FROM v_item.source_updated_at
        THEN RAISE EXCEPTION 'SHIFT_CONFLICT'; END IF;
   END IF;
 END LOOP;
 -- Revisión de horas: vista final de borradores + turnos oficiales no reemplazados.
 -- No autorizar una publicación hasta certificar la equivalencia de los límites
 -- del procedimiento original para todas las semanas y cruces de medianoche.
 RAISE EXCEPTION 'ATOMIC_PUBLISH_NOT_CERTIFIED';
 -- Stage 2: use existing vetted auditing and shift rules INSIDE same DB transaction.
 FOR v_item IN SELECT * FROM public.schedule_week_draft_items
 WHERE draft_id=v_draft.id ORDER BY employee_id,shift_date
 LOOP
   IF v_item.action='day_off' THEN
      SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'updated_at',updated_at)), '[]'::jsonb)
      INTO v_shifts FROM public.employee_shifts WHERE museum_id=v_museum
      AND employee_id=v_item.employee_id AND shift_date=v_item.shift_date
      AND status='scheduled';
      PERFORM public.set_employee_day_off(
        p_employee_id=>v_item.employee_id,
        p_shift_date=>v_item.shift_date,
        p_reason=>coalesce(nullif(v_item.reason,''),'Programación semanal'),
        p_expected_shifts=>v_shifts
      );
   ELSE
      PERFORM public.schedule_employee_shift(
        p_employee_id=>v_item.employee_id,
        p_shift_date=>v_item.shift_date,
        p_starts_local=>v_item.starts_local,
        p_ends_local=>v_item.ends_local,
        p_shift_id=>v_item.source_shift_id,
        p_expected_lunch_minutes=>v_item.lunch_minutes,
        p_set_lunch=>true,
        p_shift_type=>NULL::text,
        p_expected_updated_at=>v_item.source_updated_at,
        p_reason=>coalesce(nullif(v_item.reason,''),'Programación semanal')
      );
   END IF;
   v_count:=v_count+1;
 END LOOP;
 UPDATE public.schedule_week_drafts SET state='published',published_by=v_actor,
 published_at=now(),revision=revision+1,updated_at=now()
 WHERE id=v_draft.id;
 RETURN jsonb_build_object('status','published','count',v_count,'draft_id',v_draft.id);
END $pub$;
REVOKE ALL ON FUNCTION public.publish_schedule_week(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.publish_schedule_week(uuid,integer) TO authenticated;
COMMIT;
