const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");

const model = fs.readFileSync("js/finance-model.js", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
const service = fs.readFileSync("js/services/supabase.js", "utf8");
const context = vm.createContext({});
vm.runInContext(model, context);
const planned = [{ budgetLineId: "a", category: "Servicios Contratados", concept: "ArtBiz", sortOrder: 25 }];
const movement = (id, date, category="Servicios Contratados", name="Servicios Profesionales") => ({
  budget_line_id: id, occurred_on: date, category, concept: name,
  sort_order: 27, record_type: "expense",
  counts_in_operating_balance: true, amount: 10529.53, voided_at: null
});

test("real-only table shows one missing line, without creating a budget value", () => {
  const result = context.financeUnbudgetedExpenseRows(planned, [
    movement("prof", "2026-11-04"), movement("prof", "2026-11-13")
  ], 2026, 9);
  assert.equal(result.length, 1);
  assert.equal(result[0].concept, "Servicios Profesionales");
  assert.equal(result[0].budgetLineId, "prof");
  assert.equal(result[0].sortOrder, 27);
  assert.deepEqual(Array.from(result[0].values), Array(12).fill(null));
  assert.deepEqual(Array.from(result[0].recordIds), Array(12).fill(null));
});

test("do not duplicate rows already represented by budget records", () => {
  assert.equal(context.financeUnbudgetedExpenseRows(
    planned, [movement("a", "2026-11-05")], 2026, 9).length, 0);
});

test("ignore outside fiscal year, excluded lines, income and voids", () => {
  const one = movement("prof", "2027-11-04");
  const two = { ...movement("b", "2026-11-04"), record_type: "income" };
  const three = { ...movement("c", "2026-11-04"), voided_at: "2026-11-05" };
  const four = { ...movement("d", "2026-11-04"), counts_in_operating_balance: false };
  assert.equal(context.financeUnbudgetedExpenseRows(planned, [one,two,three,four], 2026, 9).length, 0);
});

test("existing financial calculations remain unchanged", () => {
  const m = [movement("prof", "2026-11-04"), { ...movement("prof", "2026-11-13"), amount: 20 }];
  const before = context.financeRealFromMovements(m,2026,9).monthExpense(2);
  context.financeUnbudgetedExpenseRows(planned, m,2026,9);
  assert.equal(context.financeRealFromMovements(m,2026,9).monthExpense(2), before);
  assert.equal(before, 10549.53);
});

test("only the real-expense view includes display-only rows", () => {
  assert.match(app, /showReal \? \[\.\.\.rows, \.\.\.unbudgetedExpenseRows\]/);
  assert.match(app, /unbudgetedExpenseRows = financeUnbudgetedExpenseRows/);
  assert.match(service, /finance_budget_lines\(record_type,category,name,sort_order,counts_in_operating_balance\)/);
});
