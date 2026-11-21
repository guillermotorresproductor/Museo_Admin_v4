const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");
const model = fs.readFileSync("js/finance-model.js","utf8");
const page = fs.readFileSync("js/app.js","utf8");
const service = fs.readFileSync("js/services/supabase.js","utf8");
const checks = fs.readFileSync("js/finance-checks.js","utf8");
const migration = fs.readFileSync("supabase/migrations/202611200001_finance_check_invoice_matches.sql","utf8");
const lifecycle = fs.readFileSync("supabase/migrations/202611200002_finance_reconciliation_lifecycle.sql","utf8");
const context=vm.createContext({});
vm.runInContext(model,context);
const entry=(id,amount)=>({id,amount,occurred_on:"2026-11-04",
  budget_line_id:"professional",record_type:"expense",
  counts_in_operating_balance:true,voided_at:null});
const all=[entry("invoice-a",600),entry("invoice-b",400),entry("issued-check",1000)];
test("confirmed invoice and direct check double-post before a reconciliation",()=>{
  assert.equal(context.financeRealFromMovements(all,2026,9).monthExpense(2),2000);
});
test("explicit approved match leaves only one economic expense",()=>{
  const adjusted=context.financeApplyReconciledCheckMovements(all,
    [{movement_id:"issued-check",allocated_amount:1000}]);
  assert.equal(context.financeRealFromMovements(adjusted,2026,9).monthExpense(2),1000);
  assert.equal(adjusted[2].amount,0);
  assert.equal(all[2].amount,1000,"immutable source ledger");
});
test("unmatched, voided, unknown, duplicate or oversized check adjustments fail safely",()=>{
  for (const matches of [
    [{movement_id:"not-in-results",allocated_amount:1}],
    [{movement_id:"issued-check",allocated_amount:1000},{movement_id:"issued-check",allocated_amount:1000}],
    [{movement_id:"issued-check",allocated_amount:1000.01}],
    [{movement_id:"issued-check",allocated_amount:-1}],
    [{movement_id:"issued-check",allocated_amount:"no"}]
  ]) assert.throws(()=>context.financeApplyReconciledCheckMovements(all,matches));
  assert.equal(context.financeApplyReconciledCheckMovements(all,[])[2].amount,1000);
});
test("finance view obtains scope-limited reconciliations and never mutates ledger",()=>{
  assert.match(service,/list_finance_reconciled_check_movements/);
  assert.match(page,/financeApplyReconciledCheckMovements\(movementRows, reconciledCheckMovements\)/);
  assert.match(page,/financeRealFromMovements\(accountingMovements, financeYear, fiscalYearStartMonth\)/);
});
test("manual matching requires consent and a cent-exact invoice total",()=>{
  assert.match(checks,/canWrite && check\.status === "issued"/);
  assert.match(checks,/totalCents !== Math\.round\(Number\(check\.amount\) \* 100\)/);
  assert.match(checks,/window\.confirm\(/);
  assert.match(checks,/reconcile_issued_finance_check/);
});
test("server uses museum scoping, audited lifecycle and deny-by-default RLS",()=>{
  assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
  assert.match(migration,/REVOKE ALL ON TABLE public\.finance_check_invoice_matches FROM PUBLIC, anon, authenticated/);
  assert.match(migration,/public\.finance_document_can_decide\(\)/);
  assert.match(migration,/v_document\.museum_id IS DISTINCT FROM v_museum/);
  assert.match(migration,/v_total IS DISTINCT FROM v_check\.amount/);
  assert.match(migration,/finance_check_invoice_reconciled/);
  assert.match(lifecycle,/public\.release_finance_check_reconciliation/);
  assert.match(lifecycle,/finance_check_invoice_reconciliation_released/);
  assert.match(lifecycle,/finance_prevent_double_issued_invoice_trg/);
  assert.match(lifecycle,/invoice_movement\.voided_at IS NULL/);
});
