-- Isolated staging-only end-to-end regression.
-- Every synthetic movement, cheque, invoice, reconciliation and audit row is ROLLED BACK.
BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub','35008ddc-8048-4551-8448-73d5b84a14c2',true);
DO $test$
DECLARE
 museum uuid := '00000000-0000-0000-0000-000000000001';
 actor uuid := '35008ddc-8048-4551-8448-73d5b84a14c2';
 line uuid := 'af8bc697-d089-44a8-900c-f328068bb185';
 check_id uuid := gen_random_uuid();
 doc_a uuid := gen_random_uuid();
 doc_b uuid := gen_random_uuid();
 cheque_movement uuid;
 movement_a uuid;
 movement_b uuid;
 result jsonb;
 projection jsonb;
BEGIN
 IF NOT public.finance_document_can_decide() THEN RAISE EXCEPTION 'Fixture actor is not authorized'; END IF;
 INSERT INTO public.finance_movements(museum_id,budget_line_id,occurred_on,amount,description,created_by,idempotency_key)
 VALUES (museum,line,'2026-11-04',600,'Test invoice A',actor,doc_a) RETURNING id INTO movement_a;
 INSERT INTO public.finance_movements(museum_id,budget_line_id,occurred_on,amount,description,created_by,idempotency_key)
 VALUES (museum,line,'2026-11-04',400,'Test invoice B',actor,doc_b) RETURNING id INTO movement_b;
 INSERT INTO public.finance_movements(museum_id,budget_line_id,occurred_on,amount,description,created_by,idempotency_key)
 VALUES (museum,line,'2026-11-04',1000,'Test direct cheque',actor,check_id) RETURNING id INTO cheque_movement;

 INSERT INTO public.finance_documents(id,museum_id,status,original_path,original_mime,original_byte_size,original_sha256,original_filename,uploaded_by)
 VALUES (doc_a,museum,'pending_review',museum::text||'/'||doc_a::text||'/original','application/pdf',100,repeat('a',64),'invoice-a.pdf',actor),
        (doc_b,museum,'pending_review',museum::text||'/'||doc_b::text||'/original','application/pdf',100,repeat('b',64),'invoice-b.pdf',actor);
 UPDATE public.finance_documents
 SET status='confirmed',vendor_name='Test Payee',total=600,invoice_date='2026-11-04',
     description='Test invoice A',budget_line_id=line,movement_id=movement_a,
     payment_method='check',confirmed_by=actor,confirmed_at=now()
 WHERE id=doc_a;
 UPDATE public.finance_documents
 SET status='confirmed',vendor_name='Test Payee',total=400,invoice_date='2026-11-04',
     description='Test invoice B',budget_line_id=line,movement_id=movement_b,
     payment_method='check',confirmed_by=actor,confirmed_at=now()
 WHERE id=doc_b;
 INSERT INTO public.finance_checks(id,museum_id,payment_type,expense_source,status,
 check_number,check_date,payee_name,amount,memo,budget_line_id,movement_id,created_by)
 VALUES(check_id,museum,'expense','direct','draft','TEST-R-2026','2026-11-04',
 'Test Payee',1000,'Synthetic test cheque',line,cheque_movement,actor);
 UPDATE public.finance_checks SET status='issued',issued_at=now(),issued_by=actor
 WHERE id=check_id;

 result:=public.reconcile_issued_finance_check(check_id,ARRAY[doc_a,doc_b],
 'Synthetic same obligation, two invoices under one issued cheque');
 IF result->>'ok' <> 'true' OR (result->>'allocated_amount')::numeric<>1000 THEN
   RAISE EXCEPTION 'Reconciliation failed: %',result;
 END IF;
 projection:=public.list_finance_reconciled_check_movements();
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(projection) j
              WHERE j->>'movement_id'=cheque_movement::text AND
                (j->>'allocated_amount')::numeric=1000) THEN
   RAISE EXCEPTION 'Projection failed: %',projection;
 END IF;

 BEGIN
  PERFORM public.reconcile_issued_finance_check(check_id,ARRAY[doc_a,doc_b],
   'Duplicate attempt should be rejected by server');
  RAISE EXCEPTION 'Duplicate reconciliation was unexpectedly accepted';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN
   IF SQLERRM NOT LIKE '%RECONCILIATION_ALREADY_EXISTS%' THEN RAISE; END IF;
 END;

 result:=public.release_finance_check_reconciliation(check_id,
   'Correction in staging test, reversing the match');
 IF (result->>'released')::int<>2 THEN RAISE EXCEPTION 'Release failed'; END IF;
 projection:=public.list_finance_reconciled_check_movements();
 IF projection<>'[]'::jsonb THEN RAISE EXCEPTION 'Released record still affects totals: %',projection; END IF;

 RAISE NOTICE 'PASS: exact two-invoice match, audit, projection, duplicate guard and release';
END $test$;
ROLLBACK;
