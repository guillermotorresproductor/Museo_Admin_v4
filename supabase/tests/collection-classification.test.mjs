import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const catalog = fs.readFileSync(new URL('../../js/collections.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const html = fs.readFileSync(new URL('../../inventario-colecciones.html', import.meta.url), 'utf8');
const sql = fs.readFileSync(new URL('../migrations/202609230001_collection_classification_details.sql', import.meta.url), 'utf8');

function helpers() {
  const ctx = vm.createContext({});
  const helperEnd = catalog.indexOf('const collectionReturnKey');
  assert.ok(helperEnd > 0);
  vm.runInContext(catalog.slice(0, helperEnd), ctx);
  return ctx;
}

function field(value = '') {
  const label = { hidden: false };
  return { value, required: false, closest: () => label, label };
}

test('dropdown keeps existing classifications and adds the three audio formats', () => {
  for (const category of ['Instrumento musical', 'Documento', 'Fotografía', 'Objeto personal', 'Partitura', 'Vestuario', 'Obra de arte', 'Otro', 'Disco de vinilo', 'Casete', '8-Track']) {
    assert.match(html, new RegExp(`<option value="${category}">${category}</option>`));
  }
  assert.match(html, /name="description"/);
  assert.match(html, /Descripción museográfica \*/);
  assert.match(html, /name="personal_object_description"/);
  assert.match(html, /Descripción del objeto personal \*/);
  assert.match(html, /name="object_type_specification"/);
  assert.match(html, /Especifique el tipo de objeto \*/);
  assert.equal([...html.matchAll(/name="photo_([1-4])"/g)].map(match => match[1]).join(','), '1,2,3,4');
});

test('conditional fields appear, become required, and hide without dropping a saved value', () => {
  const ctx = helpers();
  const personal = field();
  const other = field();
  const form = { elements: { category: { value: '' }, personal_object_description: personal, object_type_specification: other } };
  ctx.syncCollectionCategoryFields(form, null);
  assert.equal(personal.label.hidden, true);
  assert.equal(personal.required, false);
  assert.equal(other.label.hidden, true);
  assert.equal(other.required, false);

  form.elements.category.value = 'Objeto personal';
  personal.value = 'Chaqueta de escenario';
  ctx.syncCollectionCategoryFields(form, null);
  assert.equal(personal.label.hidden, false);
  assert.equal(personal.required, true);
  assert.equal(other.label.hidden, true);
  assert.equal(other.required, false);
  assert.equal(personal.value, 'Chaqueta de escenario');

  form.elements.category.value = 'Instrumento musical';
  ctx.syncCollectionCategoryFields(form, { personal_object_description: 'Chaqueta de escenario' });
  assert.equal(personal.label.hidden, true);
  assert.equal(personal.required, false);
  assert.equal(personal.value, 'Chaqueta de escenario');

  form.elements.category.value = 'Otro';
  other.value = '  ';
  ctx.syncCollectionCategoryFields(form, null);
  assert.equal(other.label.hidden, false);
  assert.equal(other.required, true);
  assert.equal(personal.label.hidden, true);
  assert.equal(personal.required, false);

  form.elements.category.value = 'Documento';
  other.value = 'Trofeo sin guardar';
  ctx.syncCollectionCategoryFields(form, null);
  assert.equal(other.label.hidden, true);
  assert.equal(other.required, false);
  assert.equal(other.value, '');
});

test('saved conditional text stays in details when the category changes', () => {
  const ctx = helpers();
  const keys = ['personal_object_description', 'object_type_specification', 'author'];
  const saved = { personal_object_description: 'Sombrero de escenario', author: 'Taller' };
  const hidden = ctx.collectionDetailsPayload('Instrumento musical', keys, {
    personal_object_description: 'texto no guardado',
    object_type_specification: 'Trofeo',
    author: 'Taller'
  }, saved);
  assert.equal(hidden.personal_object_description, 'Sombrero de escenario');
  assert.equal(hidden.object_type_specification, undefined);
  assert.equal(hidden.author, 'Taller');

  const personal = ctx.collectionDetailsPayload('Objeto personal', keys, {
    personal_object_description: 'Gafas',
    object_type_specification: '',
    author: ''
  }, saved);
  assert.equal(personal.personal_object_description, 'Gafas');
  assert.equal(personal.object_type_specification, undefined);

  const other = ctx.collectionDetailsPayload('Otro', keys, {
    personal_object_description: '',
    object_type_specification: 'Medalla',
    author: ''
  }, saved);
  assert.equal(other.object_type_specification, 'Medalla');
  assert.equal(other.personal_object_description, 'Sombrero de escenario');

  const created = ctx.collectionDetailsPayload('Disco de vinilo', keys, {
    personal_object_description: '',
    object_type_specification: '',
    author: ''
  }, null);
  assert.equal(JSON.stringify(created), JSON.stringify({ author: '' }));
});

test('expediente shows a stored classification detail and the general description remains separate', () => {
  const ctx = helpers();
  const item = { category: 'Objeto personal', description: 'Chaqueta negra con lentejuelas', details: { personal_object_description: 'Chaqueta de escenario' } };
  assert.equal(ctx.collectionFactVisible(item, 'description'), true);
  assert.equal(ctx.collectionFactVisible(item, 'personal_object_description'), true);
  assert.equal(ctx.collectionFactVisible(item, 'object_type_specification'), false);
  assert.equal(ctx.collectionFactVisible({ category: 'Instrumento musical', details: item.details }, 'personal_object_description'), true);
});

test('collection_save allowlist accepts the new details and does not rewrite stored rows', () => {
  for (const key of ['author', 'dating', 'materials', 'dimensions', 'provenance', 'owner', 'acquisition', 'custody', 'donor', 'owner_phone', 'owner_email', 'owner_address', 'lender', 'received_date', 'fmv', 'currency', 'loan_reference', 'notes', 'cultural_history', 'personal_object_description', 'object_type_specification']) {
    assert.match(sql, new RegExp(`'${key}'`));
  }
  assert.match(sql, /PERSONAL_OBJECT_DESCRIPTION_REQUIRED/);
  assert.match(sql, /OBJECT_TYPE_SPECIFICATION_REQUIRED/);
  assert.match(sql, /'Objeto personal'/);
  assert.match(sql, /'Otro'/);
  assert.doesNotMatch(sql, /\b(delete|truncate)\b/i);
  assert.doesNotMatch(sql, /collection_photos/);
  assert.doesNotMatch(sql, /drop\s+table/i);
});

test('submit keeps conditional details out of the payload unless the category or saved record requires them', async () => {
  const ctx = vm.createContext({
    photoSlotIds: [1, 2, 3, 4], canWrite: true, saving: false, editing: { id: 'piece', version: 2, details: { personal_object_description: 'Maleta de gira' } },
    base: ['category', 'title'], more: ['personal_object_description', 'object_type_specification', 'notes'],
    items: [], say() {}, reset() {}, reload: async () => {}, show: async () => {},
    form: {
      reportValidity: () => true,
      elements: {
        category: { value: 'Documento' },
        title: { value: 'Partitura de prueba' },
        personal_object_description: { value: 'texto oculto no guardado' },
        object_type_specification: { value: 'texto oculto' },
        notes: { value: 'Nota' },
        reason: { value: 'Cambio de clasificación' },
        caption: { value: '' },
        photo_1: { files: [] }, photo_2: { files: [] }, photo_3: { files: [] }, photo_4: { files: [] }
      },
      querySelectorAll: () => [{ disabled: false }]
    }
  });
  const saved = [];
  ctx.collectionSave = async item => { saved.push(item); return { id: 'piece', version: 3 }; };
  const helperEnd = catalog.indexOf('const collectionReturnKey');
  vm.runInContext(catalog.slice(0, helperEnd), ctx);
  const start = catalog.indexOf('  form.onsubmit = async event => {');
  const end = catalog.indexOf('\n  try {\n    await reload();', start);
  vm.runInContext(catalog.slice(start, end), ctx);
  await ctx.form.onsubmit({ preventDefault() {} });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].details.personal_object_description, 'Maleta de gira');
  assert.equal(saved[0].details.object_type_specification, undefined);
  assert.equal(saved[0].details.notes, 'Nota');
  assert.equal(saved[0].description, undefined);
});
