const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'collections.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'inventario-colecciones.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'collections.css'), 'utf8');
const start = source.indexOf('function collectionLabelPages(');
const end = source.indexOf('\nfunction collectionCategoryLabel(', start);
assert.ok(start >= 0 && end > start, 'Batch pagination helper exists');
const paginate = vm.runInNewContext(source.slice(start, end) + '\ncollectionLabelPages;');

test('pagination fits 8, then continues on additional sheets without losing order', () => {
  for (const [count, pageSizes] of [[0, []], [1, [1]], [8, [8]], [9, [8, 1]], [16, [8, 8]], [17, [8, 8, 1]]]) {
    const ids = Array.from({length:count}, (_, i) => i);
    const pages = paginate(ids);
    assert.deepEqual(Array.from(pages, page => page.length), pageSizes);
    assert.deepEqual(Array.from(pages.flat()), ids);
  }
});

test('print actions stay separate and no data mutation occurs in batch handler', () => {
  assert.match(html, /id="collection-print-labels"/);
  assert.match(html, /id="collection-print-selection"/);
  assert.match(html, /id="collection-print-label"/);
  const start = source.indexOf('function printSelectedLabels()');
  const end = source.indexOf('function printLabel()', start);
  assert.ok(start >= 0 && end > start);
  const handler = source.slice(start, end);
  assert.match(handler, /collectionLabelPages\(chosen\)/);
  assert.match(handler, /qrcode\(0, 'M'\)/);
  assert.doesNotMatch(handler, /(?:collectionSave|collectionDelete|collectionUpdate|supabasePost|supabasePatch|supabaseDelete)\s*\(/);
  assert.match(css, /grid-template-columns:3\.75in 3\.75in/);
  assert.match(css, /grid-template-rows:repeat\(4,2\.35in\)/);
});


test('long titles keep full text and get a compact print layout', () => {
  const start = source.indexOf('function printSelectedLabels()');
  const end = source.indexOf('function printLabel()', start);
  const handler = source.slice(start, end);
  assert.match(handler, /esc\(item\.title\)/);
  assert.match(handler, /collection-print-label-long/);
  assert.match(handler, /<img src=/);
  assert.match(handler, /qrUrl/);
  assert.match(css, /\.collection-print-label-long \{/);
  assert.doesNotMatch(handler, /item\.title\.slice\(|item\.title\.substring\(/);
});
