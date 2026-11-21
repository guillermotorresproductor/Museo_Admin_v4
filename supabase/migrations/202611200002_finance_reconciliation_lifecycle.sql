-- IT-2026-006: reversible, auditable correction; safeguards for later
-- invoice voids and prevention of issuing an invoice already matched.
ALTER TABLE public.finance_check_invoice_matches
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS release_reason text;
ALTER TABLE public.finance_check_invoice_matches
  DROP CONSTRAINT IF EXISTS finance_invoice_match_unique_invoice;
CREATE UNIQUE INDEX IF NOT EXISTS finance_invoice_match_one_active_invoice
  ON public.finance_check_invoice_matches(document_id)
  WHERE released_at IS NULL;

CREATE OR REPLACE FUNCTION public.reconcile_issued_finance_check(
  p_check_id uuid, p_document_ids uuid[], p_explanation text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_museum uuid;
  v_check public.finance_checks;
  v_document public.finance_documents;
  v_movement public.finance_movements;
  v_docs_count integer := 0;
  v_total numeric(14,2) := 0;
  v_note text;
  v_audit uuid;
BEGIN
  IF NOT public.finance_document_can_decide() THEN
    RAISE EXCEPTION 'Missing financial authorization' USING errcode='42501';
  END IF;
  v_museum := public.finance_movement_require_museum();
  v_note := pg_catalog.btrim(coalesce(p_explanation, ''));
  IF p_check_id IS NULL OR p_document_ids IS NULL
    OR pg_catalog.cardinality(p_document_ids) < 1
    OR pg_catalog.cardinality(p_document_ids) > 20
    OR pg_catalog.length(v_note) < 15
    OR pg_catalog.length(v_note) > 500 THEN
    RAISE EXCEPTION 'RECONCILIATION_INPUT_INVALID' USING errcode='22023';
  END IF;

  SELECT * INTO v_check FROM public.finance_checks
    WHERE id=p_check_id AND museum_id=v_museum FOR UPDATE;
  IF NOT FOUND OR v_check.status <> 'issued'
    OR v_check.payment_type <> 'expense'
    OR v_check.expense_source <> 'direct'
    OR v_check.finance_document_id IS NOT NULL
    OR v_check.movement_id IS NULL THEN
    RAISE EXCEPTION 'RECONCILIATION_CHECK_NOT_ELIGIBLE' USING errcode='P0001';
  END IF;
  SELECT * INTO v_movement FROM public.finance_movements
    WHERE id=v_check.movement_id AND museum_id=v_museum FOR UPDATE;
  IF NOT FOUND OR v_movement.voided_at IS NOT NULL OR
    v_movement.idempotency_key IS DISTINCT FROM v_check.id OR
    v_movement.amount IS DISTINCT FROM v_check.amount OR
    v_movement.budget_line_id IS DISTINCT FROM v_check.budget_line_id THEN
    RAISE EXCEPTION 'RECONCILIATION_MOVEMENT_NOT_ELIGIBLE' USING errcode='P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.finance_check_invoice_matches
             WHERE check_id=v_check.id AND released_at IS NULL) THEN
    RAISE EXCEPTION 'RECONCILIATION_ALREADY_EXISTS' USING errcode='P0001';
  END IF;

  -- Lock all confirmed invoices in a deterministic order to avoid double use.
  FOR v_document IN
    SELECT * FROM public.finance_documents
    WHERE id=ANY(p_document_ids) ORDER BY id FOR UPDATE
  LOOP
    v_docs_count := v_docs_count + 1;
    IF v_document.museum_id IS DISTINCT FROM v_museum
       OR v_document.status IS DISTINCT FROM 'confirmed'
       OR v_document.movement_id IS NULL
       OR v_document.total IS NULL
       OR v_document.budget_line_id IS DISTINCT FROM v_check.budget_line_id THEN
      RAISE EXCEPTION 'RECONCILIATION_INVOICE_NOT_ELIGIBLE' USING errcode='P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.finance_check_invoice_matches
               WHERE document_id=v_document.id AND released_at IS NULL) OR
       EXISTS (SELECT 1 FROM public.finance_checks other
               WHERE other.museum_id=v_museum AND other.status='issued'
                 AND other.finance_document_id=v_document.id) THEN
      RAISE EXCEPTION 'RECONCILIATION_INVOICE_ALREADY_USED' USING errcode='P0001';
    END IF;
    PERFORM 1 FROM public.finance_movements m WHERE m.id=v_document.movement_id
       AND m.museum_id=v_museum AND m.voided_at IS NULL
       AND m.amount=v_document.total
       AND m.budget_line_id=v_document.budget_line_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'RECONCILIATION_INVOICE_MOVEMENT_INVALID' USING errcode='P0001';
    END IF;
    v_total := v_total + v_document.total;
  END LOOP;

  IF v_docs_count <> pg_catalog.cardinality(p_document_ids)
     OR v_total IS DISTINCT FROM v_check.amount THEN
    RAISE EXCEPTION 'RECONCILIATION_AMOUNT_MISMATCH' USING errcode='P0001';
  END IF;

  INSERT INTO public.finance_check_invoice_matches
    (museum_id,check_id,document_id,amount,explanation,created_by)
  SELECT v_museum,v_check.id,d.id,d.total,v_note,auth.uid()
  FROM public.finance_documents d WHERE d.id=ANY(p_document_ids);

  v_audit := public.finance_check_audit(
    v_museum,'finance_check_invoice_reconciled',v_check.id,NULL,
    pg_catalog.jsonb_build_object('check_id',v_check.id,
      'check_number',v_check.check_number,'document_ids',p_document_ids,
      'payment_amount',v_check.amount,'note',v_note)
  );
  RETURN pg_catalog.jsonb_build_object(
    'ok',true,'check_id',v_check.id,'document_count',v_docs_count,
    'allocated_amount',v_total,'audit_id',v_audit
  );
END $function$;


CREATE OR REPLACE FUNCTION public.release_finance_check_reconciliation(
  p_check_id uuid,p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  museum uuid;
  cheque public.finance_checks;
  affected integer;
  reason text:=pg_catalog.btrim(coalesce(p_reason,''));
  audit_id uuid;
BEGIN
  IF NOT public.finance_document_can_decide() THEN
    RAISE EXCEPTION 'Missing financial authorization' USING errcode='42501';
  END IF;
  museum:=public.finance_movement_require_museum();
  IF p_check_id IS NULL OR pg_catalog.length(reason)<15 OR
    pg_catalog.length(reason)>500 THEN
    RAISE EXCEPTION 'RECONCILIATION_INPUT_INVALID' USING errcode='22023';
  END IF;
  SELECT * INTO cheque FROM public.finance_checks
    WHERE id=p_check_id AND museum_id=museum FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHECK_NOT_FOUND' USING errcode='P0001';
  END IF;
  UPDATE public.finance_check_invoice_matches
    SET released_at=pg_catalog.now(),released_by=auth.uid(),
      release_reason=reason
    WHERE museum_id=museum AND check_id=cheque.id AND released_at IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected=0 THEN
    RAISE EXCEPTION 'RECONCILIATION_NOT_FOUND' USING errcode='P0001';
  END IF;
  audit_id := public.finance_check_audit(
    museum,'finance_check_invoice_reconciliation_released',
    cheque.id,NULL,pg_catalog.jsonb_build_object(
      'check_id',cheque.id,'released_invoice_count',affected,'reason',reason
    ));
  RETURN pg_catalog.jsonb_build_object('ok',true,'released',affected,'audit_id',audit_id);
END $function$;
REVOKE ALL ON FUNCTION public.release_finance_check_reconciliation(uuid,text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.release_finance_check_reconciliation(uuid,text)
 TO authenticated;

CREATE OR REPLACE FUNCTION public.list_finance_reconciled_check_movements()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  museum uuid := public.finance_check_require_read();
BEGIN
  RETURN coalesce((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'movement_id',c.movement_id,'allocated_amount',approved.amount,'check_id',c.id
    ))
    FROM (
      SELECT matches.museum_id,matches.check_id,pg_catalog.sum(matches.amount) amount
      FROM public.finance_check_invoice_matches matches
      JOIN public.finance_documents doc ON doc.id=matches.document_id
        AND doc.museum_id=matches.museum_id
        AND doc.status='confirmed' AND doc.total=matches.amount
      JOIN public.finance_movements invoice_movement ON
        invoice_movement.id=doc.movement_id
        AND invoice_movement.museum_id=doc.museum_id
        AND invoice_movement.voided_at IS NULL
        AND invoice_movement.amount=doc.total
      WHERE matches.museum_id=museum AND matches.released_at IS NULL
      GROUP BY matches.museum_id,matches.check_id
    ) approved
    JOIN public.finance_checks c ON c.id=approved.check_id AND
      c.museum_id=approved.museum_id
    JOIN public.finance_movements m ON m.id=c.movement_id AND
      m.museum_id=c.museum_id
    WHERE c.status='issued' AND c.payment_type='expense'
      AND c.expense_source='direct' AND m.voided_at IS NULL
      AND approved.amount=c.amount AND m.amount=c.amount
  ),'[]'::jsonb);
END $function$;
REVOKE ALL ON FUNCTION public.list_finance_reconciled_check_movements()
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_finance_reconciled_check_movements()
 TO authenticated;

CREATE OR REPLACE FUNCTION public.finance_prevent_double_issued_invoice()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status='issued' AND NEW.finance_document_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM public.finance_check_invoice_matches m
            WHERE m.document_id=NEW.finance_document_id AND
              m.museum_id=NEW.museum_id AND m.released_at IS NULL) THEN
    RAISE EXCEPTION 'INVOICE_ALREADY_PAID' USING errcode='P0001';
  END IF;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS finance_prevent_double_issued_invoice_trg ON public.finance_checks;
CREATE TRIGGER finance_prevent_double_issued_invoice_trg
BEFORE INSERT OR UPDATE OF status,finance_document_id ON public.finance_checks
FOR EACH ROW EXECUTE FUNCTION public.finance_prevent_double_issued_invoice();
REVOKE ALL ON FUNCTION public.finance_prevent_double_issued_invoice()
 FROM PUBLIC,anon,authenticated;
