import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { File } from 'node:buffer';

const service = fs.readFileSync(new URL('../../js/services/collections.js', import.meta.url), 'utf8');
const catalog = fs.readFileSync(new URL('../../js/collections.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const invalidMessage = 'El archivo seleccionado no contiene una fotografía JPG, PNG o WEBP válida. Seleccione la imagen original e intente nuevamente.';
const fixture = (path, name, type) => new File([fs.readFileSync(new URL(path, import.meta.url))], name, { type });
const jpeg = fixture('../../images/logo-horizontal.jpg', 'photo.jpg', 'image/jpeg');
const png = fixture('./fixtures/collection-test.png', 'photo.png', 'image/png');
const webp = fixture('../../assets/rentals/anfiteatro-concierto-vista-general.webp', 'photo.webp', 'image/webp');
const appleBytes = new Uint8Array(4096);
appleBytes.set([0, 5, 0x16, 7, 0, 2, 0, 0, 0x4d, 0x61, 0x63, 0x20, 0x4f, 0x53, 0x20, 0x58]);
const appleDouble = new File([appleBytes], 'photo.jpg', { type: 'image/jpeg' });
const text = new File(['This is not a photograph.'], 'photo.jpg', { type: 'image/jpeg' });
const oversized = new File([new Uint8Array(10485761)], 'photo.jpg', { type: 'image/jpeg' });

function context() {
  const calls = [];
  const ctx = vm.createContext({ Uint8Array, Blob, crypto, fetch: () => { calls.push('fetch'); throw Error('Unexpected network request'); } });
  vm.runInContext(service, ctx);
  ctx.collectionRequest = async () => { calls.push('request'); throw Error('Unexpected write'); };
  return { ctx, calls };
}

for (const [format, file, extension] of [['JPEG', jpeg, 'jpg'], ['PNG', png, 'png'], ['WEBP', webp, 'webp']]) {
  test(`${format}: accepts real image and reads only the first 12 bytes`, async () => {
    const { ctx } = context();
    const reads = [];
    const selected = { name: file.name, type: file.type, size: file.size, slice(start, end) { reads.push([start, end]); return file.slice(start, end); } };
    assert.equal(await ctx.collectionValidatePhoto(selected), extension);
    assert.deepEqual(reads, [[0, 12]]);
  });
}

for (const [name, file, message] of [
  ['AppleDouble disguised as JPG', appleDouble, invalidMessage],
  ['Text renamed JPG', text, invalidMessage],
  ['File over 10 MB', oversized, 'Cada fotografía debe pesar hasta 10 MB.'],
]) {
  test(`${name}: rejects before upload or metadata write`, async () => {
    const { ctx, calls } = context();
    await assert.rejects(ctx.collectionUpload({}, file, ''), { message });
    assert.deepEqual(calls, []);
  });
}

test('rejects mismatched MIME or extension, empty files and incomplete signatures', async () => {
  const { ctx } = context();
  for (const file of [new File([png], 'photo.jpg', { type: 'image/jpeg' }), new File([jpeg], 'photo.png', { type: 'image/jpeg' }), new File([], 'photo.jpg', { type: 'image/jpeg' }), new File([new Uint8Array([0xff, 0xd8])], 'photo.jpg', { type: 'image/jpeg' })]) {
    await assert.rejects(ctx.collectionValidatePhoto(file), { message: invalidMessage });
  }
});

test('form exposes four independent photo slots instead of one multiple input', () => {
  const html = fs.readFileSync(new URL('../../inventario-colecciones.html', import.meta.url), 'utf8');
  assert.equal([...html.matchAll(/name="photo_([1-4])"/g)].map(match => match[1]).join(','), '1,2,3,4');
  assert.equal([...html.matchAll(/data-photo-pick="([1-4])"/g)].map(match => match[1]).join(','), '1,2,3,4');
  assert.doesNotMatch(html, /id="collection-photo"/);
  assert.doesNotMatch(html, /name="photo"/);
  assert.doesNotMatch(html, /<input[^>]*name="photo_[1-4]"[^>]*multiple/);
});

test('collection_save accepts the catalog form detail fields without rewriting photos', () => {
  const sql = fs.readFileSync(new URL('../migrations/202609220004_collection_save_details_fields.sql', import.meta.url), 'utf8');
  assert.match(sql, /create or replace function public\.collection_save/);
  for (const key of ['owner_phone','owner_email','owner_address','cultural_history']) assert.match(sql, new RegExp(`'${key}'`));
  assert.doesNotMatch(sql, /\b(delete|truncate)\b/i);
  assert.doesNotMatch(sql, /collection_photos/);
});

test('invalid selection prevents saving the expediente, even after a valid selected image', async () => {
  const { ctx, calls } = context();
  const messages = [];
  const button = { disabled: false };
  Object.assign(ctx, {
    form: { reportValidity: () => true, elements: { photo_1: { files: [jpeg] }, photo_2: { files: [appleDouble] }, photo_3: { files: [] }, photo_4: { files: [] } }, querySelectorAll: () => [button] },
    photoSlotIds: [1, 2, 3, 4], canWrite: true, saving: false, editing: null, base: [], more: [],
    say: message => messages.push(message),
    collectionSave: async () => { calls.push('save'); },
    collectionRows: async () => { calls.push('rows'); return []; }
  });
  const start = catalog.indexOf('  form.onsubmit = async event => {');
  const end = catalog.indexOf('\n  try {\n    await reload();', start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(catalog.slice(start, end), ctx);
  await ctx.form.onsubmit({ preventDefault() {} });
  assert.deepEqual(calls, []);
  assert.deepEqual(messages, [invalidMessage]);
  assert.equal(button.disabled, false);
  assert.equal(ctx.saving, false);
});

test('saves once then uploads remaining slots independently without duplicating a prior photo', async () => {
  const { ctx, calls } = context();
  const messages = [];
  const button = { disabled: false };
  const slot = (file) => ({ files: file ? [file] : [], value: file ? file.name : '' });
  const slots = { photo_1: slot(jpeg), photo_2: slot(png), photo_3: slot(), photo_4: slot() };
  Object.assign(ctx, {
    form: {
      reportValidity: () => true,
      elements: { ...slots, reason: { value: 'Registro inicial' }, caption: { value: '' } },
      querySelectorAll: () => [button]
    },
    photoSlotIds: [1, 2, 3, 4], canWrite: true, saving: false, editing: null, base: [], more: [],
    say: message => messages.push(message),
    renderPhotoSlot: n => { if (!slots[`photo_${n}`].files[0]) slots[`photo_${n}`].value = ''; },
    collectionSave: async () => { calls.push('save'); return { id: 'piece', version: 1 }; },
    collectionUpload: async (item, file) => {
      calls.push(`upload:${file.name}`);
      if (file === png) throw Error('fallo controlado de la fotografía 2');
      return { id: item.id, version: item.version + 1 };
    },
    collectionRows: async () => [],
    reset() {}, reload: async () => {}, show: async () => {}
  });
  const start = catalog.indexOf('  form.onsubmit = async event => {');
  const end = catalog.indexOf('\n  try {\n    await reload();', start);
  vm.runInContext(catalog.slice(start, end), ctx);
  await ctx.form.onsubmit({ preventDefault() {} });
  assert.deepEqual(calls, ['save', 'upload:photo.jpg', 'upload:photo.png']);
  assert.equal(slots.photo_1.value, '');
  assert.equal(slots.photo_2.files[0], png);
  assert.match(messages[0], /ficha está guardada.*fotografía 2/i);
  slots.photo_1.files = [];
  ctx.editing = { id: 'piece', version: 2 };
  ctx.collectionUpload = async (item, file) => { calls.push(`retry:${file.name}`); return { id: item.id, version: item.version + 1 }; };
  await ctx.form.onsubmit({ preventDefault() {} });
  assert.deepEqual(calls.slice(3), ['save', 'retry:photo.png']);
});
