const assert=require("node:assert/strict");
const fs=require("node:fs");
const test=require("node:test");
const source=fs.readFileSync("js/app.js","utf8");
const from=source.indexOf("function bindFinanceModule()");
const until=source.indexOf("function bindFinanceBudgetPreview()",from);
assert.ok(from>=0 && until>from);
const finance=source.slice(from,until);
test("Finance unlock does not await 12 payroll RPCs",()=>{
 const start=finance.indexOf("const syncFinanceFromSupabase = async");
 const end=finance.indexOf("const loadFinancePanel = async");
 assert.ok(start>=0 && end>start);
 const sync=finance.slice(start,end);
 assert.doesNotMatch(sync,/payroll_actual/);
 assert.doesNotMatch(sync,/Promise\.all\(Array\.from\(\{ length: 12 \}/);
 assert.match(sync,/payrollRealMonths = Array\(12\)\.fill\(null\)/);
});
test("Expense payroll loads one month at a time and stops on timeout",()=>{
 const start=finance.indexOf("const loadPayrollForExpenses = async");
 const end=finance.indexOf("const renderPanel = () =>",start);
 assert.ok(start>=0 && end>start);
 const lazy=finance.slice(start,end);
 assert.match(lazy,/if \(payrollRequested \|\| payrollLoading\) return/);
 assert.match(lazy,/for \(let index = 0; index < 12; index \+= 1\)/);
 assert.match(lazy,/await supabasePost\("\/rest\/v1\/rpc\/payroll_actual"/);
 assert.match(lazy,/break; \/\/ fail without starting 11 more expensive payroll queries/);
});
test("Missing payroll is not displayed as zero, and does not corrupt real summary",()=>{
 assert.match(finance,/payrollRealMonths\[index\] === null\) return null/);
 assert.match(finance,/amount === null \? "—" : money\(amount\)/);
 assert.match(finance,/amount === null \? "—" : money\(financeMonthReal/);
 assert.match(finance,/Los totales reales que incluyen nómina se muestran cuando/);
});
test("Other finance tabs remain accessible and unchanged",()=>{
 assert.match(finance,/if \(activeTab === "facturas"\)/);
 assert.match(finance,/renderFinanceDocuments\(\)/);
 assert.match(finance,/renderFinanceChecks\(\{ canWrite: canWrite\(\) \}\)/);
 assert.match(finance,/financeApplyReconciledCheckMovements\(movementRows, reconciledCheckMovements\)/);
});
