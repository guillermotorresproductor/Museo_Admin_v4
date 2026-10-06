import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');
const migration = read('supabase/migrations/202610050003_collection_formalization.sql');
const intake = read('ingreso-articulo.html');
const intakeScript = read('js/collection-intake.js');
const signature = read('js/signature-capture.js');
const service = read('js/services/collections.js');
const app = read('js/app.js');
const acceptance = 'Mediante la firma del presente formulario, las partes reconocen y aceptan las condiciones aquí establecidas.';
const reception = 'Certifico que la información contenida en este formulario es correcta y que la pieza fue recibida conforme a las condiciones descritas.';

test('la migración de formalización no toca el catálogo ni el consecutivo al aplicarse', () => {
  assert.match(migration, /collection_update_ingress_draft/);
  assert.match(migration, /collection_record_signature/);
  assert.match(migration, /collection_formalize_accession/);
  assert.match(migration, /collection_receive_accession/);
  assert.match(migration, /collection_contract_document/);
  assert.doesNotMatch(migration, /MMPR-0179-2026/);
  assert.doesNotMatch(migration, /collection_allocate_inventory_number/);
  assert.doesNotMatch(migration, /collection_allocate_ingress_file_number/);
  assert.doesNotMatch(migration, /insert\s+into\s+public\.collection_items/i);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.collection_/i);
  assert.doesNotMatch(migration, /update public\.collection_items[^;]*accession_number/i);
});

test('la edición contractual queda bloqueada después de formalizar y el snapshot no se reescribe', () => {
  assert.match(migration, /acc\.status not in \('borrador', 'pendiente_firmas'\)/);
  assert.match(migration, /CONTRACT_LOCKED/);
  assert.match(migration, /expediente_corregido/);
  assert.match(migration, /old\.contract_hash is not null and new\.contract_hash is distinct from old\.contract_hash/);
  assert.match(migration, /CONTRACT_SNAPSHOT_IMMUTABLE/);
  assert.match(migration, /a\.contract_snapshot is not null or a\.status not in \('borrador', 'pendiente_firmas'\)/);
});

test('formalizar exige las dos firmas, conserva el préstamo externo y transfiere la donación al formalizar', () => {
  assert.match(migration, /PARTY_SIGNATURE_REQUIRED/);
  assert.match(migration, /DIRECTOR_SIGNATURE_REQUIRED/);
  assert.match(migration, /SIGNATURE_STALE/);
  assert.match(migration, /v_ownership := 'museo'/);
  assert.match(migration, /v_ownership := 'externa'/);
  assert.match(migration, /v_custody := 'museo'/);
  assert.match(migration, /to_jsonb\('Museo'::text\)/);
  assert.match(migration, /Pendiente de formalización/);
  assert.match(migration, /extensions\.digest/);
  assert.match(migration, /contract_hash/);
  assert.doesNotMatch(migration, /collections\.write'\) is not true then\s*raise exception 'DIRECTOR_SIGNATURE_FORBIDDEN'/);
});

test('el permiso de Director no sale de collections.write', () => {
  assert.match(migration, /collections\.sign\.director/);
  assert.match(migration, /return chosen = 'director_ejecutivo'/);
  assert.match(app, /canSignCollectionDirector = \(\) => hasPermission\("collections\.sign\.director"\)/);
  assert.match(service, /DIRECTOR_SIGNATURE_FORBIDDEN/);
  assert.doesNotMatch(migration, /collections\.write' and requested_permission = 'collections\.sign\.director'/);
});

test('los términos y la recepción usan el texto exigido y una sola superficie de firma', () => {
  assert.equal(intake.includes(acceptance), true);
  assert.equal(intakeScript.includes(acceptance), true);
  assert.equal(migration.includes(acceptance), true);
  assert.equal(intake.includes(reception), true);
  assert.equal(intakeScript.includes(reception), true);
  assert.equal(migration.includes(reception), true);
  assert.match(intake, /Carga pendiente/);
  assert.match(intake, /Reintentar/);
  assert.match(intake, /Pad no disponible — firma en pantalla habilitada/);
  assert.match(intake, /Pad de firma conectado|data-pad-status/);
  assert.match(signature, /Pad de firma conectado/);
  assert.match(signature, /Pad no disponible — firma en pantalla habilitada/);
  assert.match(signature, /class SignatureCapture/);
  assert.equal([...signature.matchAll(/class SignatureCapture/g)].length, 1);
  assert.match(signature, /class WacomSTUAdapter/);
  assert.match(signature, /class PointerCanvasAdapter/);
  assert.match(signature, /STU-540/);
  assert.match(signature, /saved: false/);
  assert.match(signature, /return false;/);
  assert.doesNotMatch(signature, /navigator\.hid/);
  assert.doesNotMatch(signature, /@wacom\/signature-sdk/);
  assert.match(migration, /signature_type in \('contractual', 'recepcion'\)/);
  assert.match(migration, /'receptor', 'recepcion'/);
  assert.match(service, /collection_contract_document/);
  assert.match(intakeScript, /renderContractSnapshot/);
  assert.match(intakeScript, /client_request_id/);
});
