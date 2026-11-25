-- INSTITUVA AI: reversible staging-only authorization smoke test.
-- Requires the pre-existing INACTIVE synthetic fixture shown below.
-- NEVER RUN IN PRODUCTION. No permanent role, profile or usage updates.
-- No real Auth session is minted: this validates PostgreSQL authorization,
-- not the still-required HTTP E2E test with a signed JWT.
BEGIN;
DO $preflight$
BEGIN
  IF (SELECT count(*) FROM public.profiles
      WHERE id='56a66d2b-2046-48e6-b190-04d4599d8250'::uuid
      AND museum_id='33fafd1b-0bda-4e2e-904c-4ac1bbd0e6ce'::uuid
      AND status='inactive') <> 1 THEN
    RAISE EXCEPTION 'STAGING_ONLY_FIXTURE_NOT_FOUND';
  END IF;
END
$preflight$;
UPDATE public.profiles SET status='active'
WHERE id='56a66d2b-2046-48e6-b190-04d4599d8250'::uuid
AND status='inactive'
AND museum_id='33fafd1b-0bda-4e2e-904c-4ac1bbd0e6ce'::uuid;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',
  '56a66d2b-2046-48e6-b190-04d4599d8250',true);
DO $verify$
DECLARE foreign_denied boolean:=false;
BEGIN
  IF public.current_user_museum_id() IS DISTINCT FROM
     '33fafd1b-0bda-4e2e-904c-4ac1bbd0e6ce'::uuid THEN
    RAISE EXCEPTION 'INVALID_TENANT_SCOPE';
  END IF;
  IF public.has_permission('collections.read') IS DISTINCT FROM true
     OR public.collection_can_read() IS DISTINCT FROM true
     OR public.module_profile_allows('collections') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'COLLECTION_READ_NOT_AUTHORIZED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.collection_items
    WHERE museum_id='789522de-c2b6-49f0-a85c-fc8cd444d299'::uuid
  ) THEN
    RAISE EXCEPTION 'FOREIGN_COLLECTION_VISIBLE';
  END IF;
  IF public.ai_assistant_claim_collections_slot_v1(
     '33fafd1b-0bda-4e2e-904c-4ac1bbd0e6ce'::uuid
  ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'AUTHORIZED_QUOTA_DENIED';
  END IF;
  BEGIN
    PERFORM public.ai_assistant_claim_collections_slot_v1(
      '789522de-c2b6-49f0-a85c-fc8cd444d299'::uuid
    );
  EXCEPTION WHEN insufficient_privilege THEN
    foreign_denied:=true;
  END;
  IF foreign_denied IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FOREIGN_QUOTA_ALLOWED';
  END IF;
END
$verify$;
ROLLBACK;
