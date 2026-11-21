const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");
const model = fs.readFileSync("js/finance-model.js","utf8");
const app = fs.readFileSync("js/app.js","utf8");
const ctx=vm.createContext({});
vm.runInContext(model,ctx);

const rows=[
  {category:"Gastos Operacionales",concept:"Agua",sortOrder:1},
  {category:"Servicios Contratados",concept:"ArtBiz",sortOrder:14},
  {category:"Gastos Operacionales",concept:"Mensajería",sortOrder:25},
  {category:"Servicios Contratados",concept:"ArteGrafiko",sortOrder:26},
  {category:"Servicios Contratados",concept:"Servicios Profesionales",sortOrder:27},
  {category:"Otros Gastos",concept:"Misceláneos",sortOrder:31}
];
test("expense categories are contiguous and ordered",()=>{
 const copy=[...rows].sort(ctx.financeRealExpenseCategoryCompare);
 assert.deepEqual(copy.map(x=>x.concept),[
  "Agua","Mensajería","ArtBiz","ArteGrafiko","Servicios Profesionales","Misceláneos"]);
 const categoryTransitions=copy.map(x=>x.category).filter((x,i,a)=>i===0||x!==a[i-1]);
 assert.deepEqual(categoryTransitions,["Gastos Operacionales","Servicios Contratados","Otros Gastos"]);
});
test("source expense cells and rows remain unchanged",()=>{
 const prior=JSON.stringify(rows);
 [...rows].sort(ctx.financeRealExpenseCategoryCompare);
 assert.equal(JSON.stringify(rows),prior);
});
test("the grouping comparator is used only for the real-expense view",()=>{
 assert.match(app,/const visibleRows = \(showReal \? \[\.\.\.rows, \.\.\.unbudgetedExpenseRows\][\s\S]*?\.sort\(financeRealExpenseCategoryCompare\)[\s\S]*?: rows\.filter\(filter\)\);/);
});
