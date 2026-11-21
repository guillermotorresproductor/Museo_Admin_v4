-- IT-2026-006: auditable exact reconciliation of issued direct checks with
-- one or more confirmed invoices. Source checks, invoices and movements remain
-- immutable; accounting presentation subtracts an explicitly matched payment.
-- No automatic matching based on name, amount, check number or text.
CREATE TABLE IF NOT EXISTS public.finance_check_invoice_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  museum_id uuid NOT NULL REFERENCES public.museums(id),
  check_id uuid NOT NULL REFERENCES public.finance_checks(id),
  document_id uuid NOT NULL REFERENCES public.finance_documents(id),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  explanation text NOT NULL CHECK (length(btrim(explanation)) BETWEEN 15 AND 500),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_invoice_match_unique_invoice UNIQUE (document_id),
  CONSTRAINT finance_invoice_match_unique_pair UNIQUE (check_id,document_id)
);
ALTER TABLE public.finance_check_invoice_matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.finance_check_invoice_matches FROM PUBLIC, anon, authenticated;
-- The service_role is reserved for operational diagnostics and secure functions.
GRANT SELECT ON TABLE public.finance_check_invoice_matches TO service_role;

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
             WHERE check_id=v_check.id) THEN
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
               WHERE document_id=v_document.id) OR
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
REVOKE ALL ON FUNCTION public.reconcile_issued_finance_check(uuid,uuid[],text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reconcile_issued_finance_check(uuid,uuid[],text)
  TO authenticated;

-- Read-only, museum-scoped reconciliation projection; never a write API.
CREATE OR REPLACE FUNCTION public.list_finance_reconciled_check_movements()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_museum uuid := public.finance_check_require_read();
BEGIN
  RETURN coalesce((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'movement_id',cheque.movement_id,
      'allocated_amount',matched.allocated,
      'check_id',cheque.id
    ))
    FROM (
      SELECT museum_id,check_id,pg_catalog.sum(amount) allocated
      FROM public.finance_check_invoice_matches
      WHERE museum_id=v_museum
      GROUP BY museum_id,check_id
    ) matched
    JOIN public.finance_checks cheque ON cheque.id=matched.check_id
      AND cheque.museum_id=matched.museum_id
    JOIN public.finance_movements movement ON movement.id=cheque.movement_id
      AND movement.museum_id=matched.museum_id
    WHERE cheque.status='issued'
      AND cheque.payment_type='expense'
      AND cheque.expense_source='direct'
      AND movement.voided_at IS NULL
      AND movement.amount=matched.allocated
  ),'[]'::jsonb);
END $function$;
REVOKE ALL ON FUNCTION public.list_finance_reconciled_check_movements()
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_finance_reconciled_check_movements()
 TO authenticated;
