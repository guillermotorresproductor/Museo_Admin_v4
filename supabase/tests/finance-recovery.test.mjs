import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import test from 'node:test';
const app=fs.readFileSync(new URL('../../js/app.js',import.meta.url),'utf8');
const model=fs.readFileSync(new URL('../../js/finance-model.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../../finanzas.html',import.meta.url),'utf8');
const ctx=vm.createContext({});
vm.runInContext(model+'\n'+app.slice(app.indexOf('const financeMonths ='),app.indexOf('const rentalGeneralRules =')),ctx);
const run=s=>JSON.parse(vm.runInContext(`JSON.stringify(${s})`,ctx));
const rows=run('legacyFinanceProjectionRows'),months=run('financeMonths');
test('Existing QuickBooks exports retain dates, classification and totals without demo records',()=>{
 const exportCtx=vm.createContext({});
 const start=app.indexOf('  const quickBooksCategories =',app.indexOf('function bindFinanceModule()'));
 const lists=app.slice(start,app.indexOf('  const money =',start));
 const logic=app.slice(app.indexOf('  const monthDate ='),app.indexOf('  const exportQuickBooks ='));
 vm.runInContext(model+lists+`const financeYear=2026;let rows=[{type:'income',category:'Ingresos',concept:'Entradas',values:[20.10]},{type:'expense',category:'Gastos Operacionales',concept:'Electricidad',values:[3.60]}];`+logic,exportCtx);
 const result=JSON.parse(vm.runInContext('JSON.stringify(summarizeQuickBooksRecords(buildQuickBooksTransactions(),"Fecha"))',exportCtx));
 assert.deepEqual(result,[{'Fecha':'2026-09-01','Total de Ingresos':'20.10','Total de Gastos':'3.60','Balance Neto':'16.50'}]);
 assert.equal(vm.runInContext('buildQuickBooksTransactions()[1]["Categoría"]',exportCtx),'Utilidades');
 assert.equal(vm.runInContext('rows=[];buildQuickBooksTransactions().length',exportCtx),0);
});
test('Historical 54-row template and exact cent totals remain intact',()=>{
 assert.equal(rows.length,54);
 assert.deepEqual(run('financeTotals(legacyFinanceProjectionRows)'),{income:746300,expense:576790.04,net:169509.96});
 assert.deepEqual(rows.find(r=>r.id==='exp-miscelaneos').values,[0,...Array(11).fill(1500)]);
 assert.deepEqual(rows.find(r=>r.id==='exp-reserva').values,[0,...Array(11).fill(3000)]);
 assert.equal(rows.find(r=>r.id==='exp-director').values[0],4000);
});
test('Real stored values win over defaults; no data produces no invented rows',()=>{
 ctx.records=[{id:'x',record_type:'expense',category:'Otros Gastos',concept:'Misceláneos',month:'Octubre',amount:71.23}];
 const result=run('financeRowsFromRecords(records,defaultFinanceRows,financeMonths,excludedFinanceConcepts)');
 assert.equal(result.length,1);assert.equal(result[0].values[1],71.23);assert.equal(result[0].values[0],null);
 assert.deepEqual(run('financeRowsFromRecords([],defaultFinanceRows,financeMonths,excludedFinanceConcepts)'),[]);
 assert.equal(rows.find(r=>r.id==='exp-miscelaneos').values[1],1500);
});
test('Income minus all expenses includes payroll and benefits once, in cents',()=>{
 ctx.records=[['income','Ingresos',10.10],['expense','Nómina',2.20],['expense','Beneficios',1.10],['expense','Gastos Operacionales',0.30]].map(([record_type,category,amount],i)=>({id:String(i),record_type,category,concept:category,month:months[0],amount}));
 assert.deepEqual(run('financeTotals(financeRowsFromRecords(records,[],financeMonths,new Set()))'),{income:10.1,expense:3.6,net:6.5});
});
test('Fiscal export dates match the existing September-August labels',()=>{
 assert.equal(run('financePeriodDate(2026,0)'),'2026-09-01');
 assert.equal(run('financePeriodDate(2026,4)'),'2027-01-01');
 assert.equal(run('financePeriodDate(2026,11)'),'2027-08-01');
});
test('Duplicate records fail visibly rather than silently replacing amounts',()=>{
 ctx.records=[{id:'x',record_type:'income',category:'Ingresos',concept:'A',month:'Septiembre',amount:1},{id:'y',record_type:'income',category:'Ingresos',concept:'A',month:'Septiembre',amount:2}];
 assert.throws(()=>run('financeRowsFromRecords(records,[],financeMonths,new Set())'),/duplicados/);
});
test('Six existing utilities and exports restored without switching environment',()=>{
 for(const tab of ['resumen','ingresos','gastos','nomina','reportes','configuracion'])assert.ok(html.includes(`data-finance-tab="${tab}"`));
 for(const type of ['csv','excel','daily','category'])assert.ok(html.includes(`data-qb-export="${type}"`));
 const operational=app.slice(app.indexOf('function bindFinanceModule()'),app.indexOf('function bindFinanceBudgetPreview()'));
 assert.doesNotMatch(operational,/seedFinanceRecords|quickBooksDemoTransactions|syncApprovedFinanceRowsToSupabase|callInstitutionalDataBridge|isInstitutionalDataBackendEnabled/);
 assert.match(operational,/update_finance_record_amount/);assert.match(operational,/finance_audit_history/);
 assert.match(operational,/finance\.write/);assert.match(operational,/finance\.export/);
 assert.match(operational,/museum_id=eq/);
 assert.match(html,/js\/finance-model\.js/);
});
