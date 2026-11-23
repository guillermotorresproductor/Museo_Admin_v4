const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");
const html = fs.readFileSync("inventario.html", "utf8");
const start = app.indexOf("function bindInventoryModule()");
const end = app.indexOf("\nfunction ", start + 10);
assert.ok(start > 0 && end > start);
const inventory = app.slice(start, end);
test("inventory report uses authorized loaded data without a new Supabase request", () => {
 const start = inventory.indexOf("const printInventoryList = () =>");
 const end = inventory.indexOf("printListButton?.addEventListener", start);
 const report = inventory.slice(start, end);
 assert.match(report, /printScope\?\.value === "all" \? \[\.\.\.records\] : getFilteredRecords\(\)/);
 assert.doesNotMatch(report, /supabasePost|supabaseGet|fetchSupabase|INSERT|UPDATE|DELETE/);
 assert.match(report, /window\.open\("", "_blank"/);
 assert.match(report, /popup\.print\(\)/);
});
test("printed values escaped and counts kept in register/pieces distinction", () => {
 assert.match(inventory, /printedRows\.reduce\(\(sum, record\)/);
 assert.match(inventory, /escapeHtml\(record\.asset_tag/);
 assert.match(inventory, /escapeHtml\(record\.name/);
 assert.match(inventory, /escapeHtml\(record\.location/);
 assert.match(inventory, /escapeHtml\(record\.responsible/);
 assert.match(inventory, /escapeHtml\(filters\)/);
 assert.match(inventory, /" · Incluye artículos archivados"/);
});
test("only inventory UI changed and preserves archive + search controls", () => {
 assert.match(html, /data-inventory-print-scope/);
 assert.match(html, /data-inventory-print-list/);
 assert.match(html, /data-inventory-add hidden/);
 assert.match(html, /data-inventory-search/);
 assert.match(html, /data-inventory-filter-location/);
 assert.match(html, /data-inventory-filter-status/);
 assert.match(html, /data-inventory-show-archived/);
 assert.match(inventory, /fetchSupabaseInventoryItems\(\{ includeArchived: Boolean\(showArchived\?\.checked\) \}\)/);
});
