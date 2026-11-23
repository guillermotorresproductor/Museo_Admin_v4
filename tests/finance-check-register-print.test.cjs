const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync("js/finance-checks.js","utf8");
const start=source.indexOf("function financeCheckReportRows(");
const end=source.indexOf("function financeCheckPrintRegister(",start);
assert.ok(start>=0 && end>start,"report filter must be present");
const context=vm.createContext({});
vm.runInContext(source.slice(start,end),context);
const originals=[
{id:"1",check_number:"007710",check_date:"2026-11-01",payment_type:"expense",expense_source:"direct",status:"issued",amount:600},
{id:"2",check_number:"007711",check_date:"2026-11-11",payment_type:"payroll",expense_source:null,status:"issued",amount:300},
{id:"3",check_number:"007712",check_date:"2026-11-12",payment_type:"expense",expense_source:"invoice",status:"issued",amount:100},
{id:"4",check_number:"007713",check_date:"2026-10-20",payment_type:"expense",expense_source:"direct",status:"issued",amount:200},
{id:"5",check_number:"007714",check_date:"2026-11-20",payment_type:"expense",expense_source:"direct",status:"voided",amount:999},
{id:"6",check_number:"007715",check_date:"2026-11-21",payment_type:"payroll",status:"draft",amount:1000}
];
const rows=(params)=>Array.from(context.financeCheckReportRows(originals,params));
test("inclusive period filters and issued-only default",()=>{
 assert.deepEqual(rows({from:"2026-11-01",to:"2026-11-12"}).map(x=>x.id),["1","2","3"]);
 assert.equal(rows({}).length,4);
 assert.deepEqual(rows({from:"2026-11-11"}).map(x=>x.id),["2","3"]);
 assert.deepEqual(rows({to:"2026-10-31"}).map(x=>x.id),["4"]);
});
test("type drop-down: all, payroll, expense, direct, invoice",()=>{
 assert.deepEqual(rows({type:"all"}).map(x=>x.id),["4","1","2","3"]);
 assert.deepEqual(rows({type:"payroll"}).map(x=>x.id),["2"]);
 assert.deepEqual(rows({type:"expense"}).map(x=>x.id),["4","1","3"]);
 assert.deepEqual(rows({type:"direct"}).map(x=>x.id),["4","1"]);
 assert.deepEqual(rows({type:"invoice"}).map(x=>x.id),["3"]);
});
test("specific check search and filters can be combined",()=>{
 assert.deepEqual(rows({number:"007711"}).map(x=>x.id),["2"]);
 assert.equal(rows({number:"007711",type:"expense"}).length,0);
});
test("bad ranges are rejected with no data changes",()=>{
 assert.throws(()=>rows({from:"2026-12-31",to:"2026-01-01"}));
 assert.throws(()=>rows({from:"20-11-2026"}));
 assert.throws(()=>rows({type:"something-else"}));
 const snapshot=JSON.stringify(originals);
 rows({type:"all"});
 assert.equal(JSON.stringify(originals),snapshot);
});
test("print list keeps status and document data read only",()=>{
 assert.match(source,/data-check-register-form/);
 assert.match(source,/data-check-register-message/);
 assert.match(source,/name="from"/);
 assert.match(source,/name="to"/);
 assert.match(source,/name="type"/);
 assert.match(source,/name="number"/);
 assert.match(source,/financeCheckEscape\(check\.payee_name\)/);
 assert.match(source,/financeCheckEscape\(check\.memo \|\| "—"\)/);
 assert.match(source,/financeCheckMoney\(cents \/ 100\)/);
 assert.match(source,/Solo cheques emitidos; no incluye borradores ni anulados/);
 assert.match(source,/bindFinanceCheckPrintRegister\(panel, token\)/);
});
