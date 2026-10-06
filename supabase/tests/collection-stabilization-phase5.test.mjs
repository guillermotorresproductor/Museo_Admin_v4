import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');
const migration = read('supabase/migrations/202610050005_collection_signature_revocation.sql');
const formalize = read('supabase/migrations/202610050003_collection_formalization.sql');
const numbering = read('supabase/migrations/202610050001_collection_accessions.sql');
const intake = read('js/collection-intake.js');
const signature = read('js/signature-capture.js');
const service = read('js/services/collections.js');
const sw = read('sw.js');

test('una corrección posterior revoca la firma sin borrar su evidencia', () => {
  assert.match(migration, /status = 'revocada'/);
  assert.match(migration, /firmas_revocadas/);
  assert.match(migration, /old\.status = 'capturada'/);
  assert.match(migration, /new\.status = 'revocada'/);
  assert.match(migration, /new\.visual is not distinct from old\.visual/);
  assert.match(migration, /SIGNATURE_IMMUTABLE/);
  assert.match(migration, /contract_snapshot is not null/);
  assert.match(migration, /initially deferred/);
  assert.match(migration, /auth\.uid\(\) is null/);
  assert.match(formalize, /status = 'capturada'/);
  assert.match(formalize, /SIGNATURE_STALE/);
  assert.match(read('ingreso-articulo.html'), /Reabrir para corrección/);
  assert.match(intake, /collectionReopenIngressCorrection/);
  assert.match(service, /CONTRACT_SIGNED_LOCKED/);
  const lock = read('supabase/migrations/202610050006_collection_signature_lock.sql');
  assert.match(lock, /CONTRACT_SIGNED_LOCKED/);
  assert.match(lock, /collection_reopen_ingress_correction/);
  assert.match(lock, /firmas_revocadas/);
  assert.doesNotMatch(lock, /MMPR-0179-2026/);
  assert.doesNotMatch(lock, /collection_allocate_inventory_number/);
  assert.doesNotMatch(lock, /insert\s+into\s+public\.collection_items/i);
  assert.match(intake, /select=status,signature_type/);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.collection_accession_signatures/i);
  assert.doesNotMatch(migration, /MMPR-0179-2026/);
  assert.doesNotMatch(migration, /insert\s+into\s+public\.collection_items/i);
  assert.doesNotMatch(migration, /collection_allocate_inventory_number/);
  assert.doesNotMatch(migration, /finance_|employees|attendance|checks/i);
});

test('la numeración sigue atómica, sin huecos y sin reinicio anual', () => {
  const allocator = numbering.slice(
    numbering.indexOf('create or replace function public.collection_allocate_inventory_number'),
    numbering.indexOf('comment on function public.collection_allocate_inventory_number')
  );
  assert.match(allocator, /pg_advisory_xact_lock/);
  assert.match(allocator, /America\/Puerto_Rico/);
  assert.match(allocator, /greatest\(current_value, scanned\) \+ 1/);
  assert.doesNotMatch(allocator, /0179/);
  assert.match(numbering, /Does not look for gaps and does not reset the consecutive/);
  assert.match(numbering, /revoke all on function public\.collection_allocate_inventory_number\(\) from public, anon, authenticated/);
});

test('hay una sola superficie de firma y el service worker no cachea páginas', () => {
  assert.equal([...signature.matchAll(/class SignatureCapture/g)].length, 1);
  assert.match(signature, /class WacomSTUAdapter/);
  assert.match(signature, /class PointerCanvasAdapter/);
  assert.match(signature, /return false;/);
  assert.match(intake, /data-signature-return/);
  assert.match(intake, /data-signature-director/);
  assert.match(intake, /data-signature-reception/);
  assert.match(service, /collection_return_accession/);
  assert.match(service, /collection_formalize_accession/);
  assert.match(sw, /fetch\(event\.request\)/);
  assert.doesNotMatch(sw, /caches\.open/);
});
