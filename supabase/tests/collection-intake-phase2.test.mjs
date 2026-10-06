import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');
const migration = read('supabase/migrations/202610050002_collection_intake_create.sql');
const inventory = read('inventario-colecciones.html');
const intake = read('ingreso-articulo.html');
const catalog = read('js/collections.js');
const service = read('js/services/collections.js');
const signature = read('js/signature-capture.js');
const intakeScript = read('js/collection-intake.js');
const app = read('js/app.js');

test('la migración de alta no reescribe el catálogo existente ni llama el generador al aplicarse', () => {
  assert.match(migration, /collection_create_catalog_entry/);
  assert.match(migration, /collection_attach_photo_role/);
  assert.match(migration, /collection_accession_signatures/);
  assert.match(migration, /grant execute on function public\.collection_create_catalog_entry/);
  assert.match(migration, /revoke all on function public\.collection_allocate_inventory_number\(\) from public, anon, authenticated/);
  assert.match(migration, /revoke all on function public\.collection_accession_save\(uuid, bigint, jsonb\) from public, anon, authenticated/);
  assert.match(migration, /update public\.collection_items\s+set version = version \+ 1/);
  assert.doesNotMatch(migration, /update public\.collection_items[\s\S]{0,120}accession_number/);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.collection_/i);
  assert.doesNotMatch(migration, /MMPR-0179-2026/);
  assert.doesNotMatch(migration, /select\s+public\.collection_allocate_inventory_number\(\)/i);
  assert.doesNotMatch(migration, /select\s+public\.collection_create_catalog_entry/i);
});

test('el número nuevo no se escribe a mano y ambas rutas usan el mismo inventario', () => {
  assert.match(inventory, /Se asignará automáticamente al guardar/);
  assert.match(inventory, /name="accession_number"[^>]*readonly/);
  assert.doesNotMatch(inventory, /name="accession_number"[^>]*required/);
  assert.match(inventory, /id="collection-intake"/);
  assert.match(inventory, /Fotografía frontal/);
  assert.match(inventory, /Fotografía posterior/);
  assert.match(inventory, /Fotografía lateral/);
  assert.match(inventory, /Fotografía adicional \/ detalle/);
  assert.equal([...inventory.matchAll(/name="photo_([1-4])"/g)].map(match => match[1]).join(','), '1,2,3,4');
  assert.match(catalog, /collectionCreateEntry/);
  assert.match(catalog, /item\.accession_number = editing\.accession_number/);
  assert.match(service, /delete payload\.accession_number/);
  assert.match(app, /ingreso-articulo\.html/);
});

test('préstamo y donación comparten la ficha y preparan anejos sin guardar la firma', () => {
  assert.match(intake, /Préstamo temporal/);
  assert.match(intake, /Donación permanente/);
  assert.match(intake, /Vincular pieza existente/);
  assert.match(intake, /Dirección \*/);
  assert.doesNotMatch(intake, /Dirección postal/);
  assert.match(intake, /data-photo-role="lateral"/);
  assert.match(intake, /data-photo-role="adicional"/);
  assert.match(intake, /Inventario adicional/);
  assert.match(intakeScript, /Evidencia de seguro/);
  assert.match(intakeScript, /Documento de tasación o valoración/);
  assert.match(intakeScript, /kind === 'otro'/);
  assert.match(intake, /✓ Fotografías incorporadas al expediente/);
  assert.match(intake, /data-signature-capture/);
  assert.doesNotMatch(intake, /<canvas/);
  assert.match(signature, /class WacomSTUAdapter/);
  assert.match(signature, /STU-540/);
  assert.match(signature, /class PointerCanvasAdapter/);
  assert.match(signature, /class SignatureCapture/);
  assert.match(signature, /saved: false/);
});

test('las medidas estructuradas se componen sin reinterpretar un texto vacío', () => {
  const ctx = vm.createContext({});
  const helperEnd = catalog.indexOf('const collectionReturnKey');
  vm.runInContext(catalog.slice(0, helperEnd), ctx);
  assert.equal(ctx.collectionComposeDimensions({
    height: '12', height_unit: 'cm', width: '30.5', width_unit: 'pulg.', weight: '2', weight_unit: 'lb', other_measurements: 'estuche'
  }), 'Alto: 12 cm; Ancho: 30.5 pulg.; Peso: 2 lb; Otras medidas: estuche');
  assert.equal(ctx.collectionComposeDimensions({}), '');
  assert.equal(ctx.collectionDirectAccession({ elements: { physical_condition: { value: 'Buena' }, fmv: { value: '10' } } }).modality, 'catalogacion_directa');
  assert.match(catalog, /3: 'lateral'/);
  assert.match(catalog, /4: 'adicional'/);
});
