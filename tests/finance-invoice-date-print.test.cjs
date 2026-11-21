const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync("js/finance-documents.js", "utf8");
const start = source.indexOf("function invoiceReportRows(");
const end = source.indexOf("function invoicePrintReport(", start);
assert.ok(start > -1 && end > start, "Read-only date-range helper must exist");
const context = vm.createContext({
  invoiceDocuments: [
    { invoice_date: "2026-11-01", vendor_name: "A", description: "Material", total: 20, status: "pending_review" },
    { invoice_date: "2026-11-20", vendor_name: "B", description: "Equipo", total: 55, status: "pending_review" }
  ],
  invoiceProcessed: [
    { invoice_date: "2026-11-05", vendor_name: "C", description: "Servicios", total: 30, status: "confirmed" },
    { invoice_date: "2026-11-07", vendor_name: "D", description: "Rechazada", total: 99, status: "rejected" },
    { invoice_date: null, vendor_name: "E", description: "Sin fecha", total: 15, status: "confirmed" }
  ]
});
vm.runInContext(source.slice(start, end), context);
test("filter invoice date inclusive and exclude rejected/missing-date invoices", () => {
  const rows = context.invoiceReportRows("2026-11-01", "2026-11-05");
  assert.equal(rows.length, 2);
  assert.deepEqual(Array.from(rows, x => x.vendor_name), ["A", "C"]);
});
test("report does not alter invoice objects or data", () => {
  const before = JSON.stringify([...context.invoiceDocuments, ...context.invoiceProcessed]);
  context.invoiceReportRows("2026-11-01", "2026-11-30");
  assert.equal(JSON.stringify([...context.invoiceDocuments, ...context.invoiceProcessed]), before);
});
test("report UI has dates, purpose, amount, print and escape routine", () => {
  assert.match(source, /data-invoice-report-from/);
  assert.match(source, /data-invoice-report-to/);
  assert.match(source, /data-invoice-report-print/);
  assert.match(source, /<th>Propósito<\/th>/);
  assert.match(source, /Cantidad<\/th>/);
  assert.match(source, /invoiceEscape\(purpose\)/);
  assert.match(source, /bindInvoicePrintReport\(panel\)/);
});
