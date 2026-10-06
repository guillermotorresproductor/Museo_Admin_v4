import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');
const migration = read('supabase/migrations/202610050004_collection_return_print.sql');
const intake = read('ingreso-articulo.html');
const intakeScript = read('js/collection-intake.js');
const signature = read('js/signature-capture.js');
const service = read('js/services/collections.js');
const catalog = read('js/collections.js');
const app = read('js/app.js');
const documentPage = read('documento-ingreso.html');
const documentScript = read('js/collection-document.js');
const documentCss = read('css/collection-document.css');
const acceptance = 'Mediante la firma del presente formulario, las partes reconocen y aceptan las condiciones aquí establecidas.';

test('la devolución no reescribe el catálogo, el consecutivo ni el contrato', () => {
  assert.match(migration, /collection_return_accession/);
  assert.match(migration, /collection_close_accession/);
  assert.match(migration, /RETURN_LOAN_ONLY/);
  assert.match(migration, /RETURN_REQUIRES_RECEIVED/);
  assert.match(migration, /acc\.status <> 'recibido'/);
  assert.match(migration, /acc\.modality <> 'prestamo_temporal'/);
  assert.doesNotMatch(migration, /MMPR-0179-2026/);
  assert.doesNotMatch(migration, /collection_allocate_inventory_number/);
  assert.doesNotMatch(migration, /insert\s+into\s+public\.collection_items/i);
  assert.doesNotMatch(migration, /update\s+public\.collection_items/i);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.collection_/i);
  assert.doesNotMatch(migration, /unique[^;]{0,80}collection_item_id/i);
  const handover = migration.slice(
    migration.indexOf("set status = 'devuelto'"),
    migration.indexOf('returning * into saved;')
  );
  assert.doesNotMatch(handover, /physical_condition\s*=/);
  assert.doesNotMatch(handover, /contract_snapshot/);
  assert.doesNotMatch(handover, /contract_hash/);
});

test('la firma de devolución reutiliza el expediente y no sustituye las firmas contractuales', () => {
  assert.match(migration, /receptor_devolucion/);
  assert.match(migration, /'devolucion'/);
  assert.match(migration, /signature_type = 'devolucion'/);
  assert.match(migration, /action, reason, before_value, after_value/);
  assert.match(migration, /'devolucion'/);
  assert.match(migration, /'cierre'/);
  assert.match(migration, /status = 'devuelto'/);
  assert.match(migration, /status = 'cerrado'/);
  assert.match(migration, /custody_status = 'externa'/);
  assert.match(migration, /'photos'/);
  assert.match(intakeScript, /new SignatureCapture\(document\.querySelector\('\[data-signature-return\]'\)/);
  assert.match(intakeScript, /receptor_devolucion/);
  assert.equal([...signature.matchAll(/class SignatureCapture/g)].length, 1);
  assert.match(signature, /return false;/);
  assert.doesNotMatch(signature, /navigator\.hid/);
});

test('solo un préstamo recibido ofrece la devolución y la donación no', () => {
  assert.match(intake, /Devolver pieza/);
  assert.match(intake, /Condición de la pieza al devolver/);
  assert.match(intake, /Recibido por el propietario \/ prestamista/);
  assert.match(intakeScript, /accession\?\.modality === 'prestamo_temporal' && accession\?\.status === 'recibido'/);
  assert.match(intakeScript, /returnPanel\.hidden = !loan/);
  assert.match(catalog, /Devolver pieza/);
  assert.match(service, /collection_return_accession/);
  assert.match(service, /collection_close_accession/);
  assert.match(service, /RETURN_LOAN_ONLY/);
  assert.match(app, /documento-ingreso\.html": \(\) => canReadCollections\(\)/);
  assert.doesNotMatch(app, /documento-ingreso\.html": \(\) => canWriteCollections\(\)/);
});

test('el documento se imprime desde el snapshot, en carta, y sin la nota técnica', () => {
  const technicalNote = 'El resto del texto del formulario municipal se validará contra el documento oficial antes de la impresión definitiva.';
  assert.match(documentPage, /collection-document\.js/);
  assert.match(documentScript, /collectionContractDocument/);
  assert.match(documentScript, /source\.acceptance/);
  assert.equal(intake.includes(acceptance), true);
  assert.equal(intake.includes(technicalNote), false);
  assert.equal(documentScript.includes(technicalNote), false);
  assert.equal(documentScript.includes('PENDIENTE DE VALIDACIÓN'), false);
  assert.equal(documentScript.includes('plantilla estructural'), false);
  assert.equal(read('supabase/migrations/202610050004_collection_return_print.sql').includes(technicalNote), false);
  assert.equal(read('supabase/migrations/202610050003_collection_formalization.sql').includes(technicalNote), false);
  assert.match(documentScript, /No se sustituyó por otra firma/);
  assert.match(documentScript, /contract_hash/);
  assert.doesNotMatch(documentScript, /collection_items/);
  assert.doesNotMatch(documentScript, /collectionRows\('collection_items'/);
  assert.doesNotMatch(intakeScript, /window\.print/);
  assert.match(documentScript, /window\.print/);
  assert.match(documentCss, /@page\s*\{\s*size:\s*letter;/);
  assert.match(documentCss, /@media print/);
  assert.match(migration, /collection_contract_acceptance\(\)/);
  assert.equal(read('supabase/migrations/202610050003_collection_formalization.sql').includes(acceptance), true);
  assert.match(documentScript, /Este cierre no modifica el contrato original/);
});
