import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const model = fs.readFileSync("js/finance-model.js", "utf8");
const summary = fs.readFileSync("js/executive-finance-summary.js", "utf8");
const finance = fs.readFileSync("js/app.js", "utf8");
const portal = fs.readFileSync("employee-portal.html", "utf8");
const payrollPage = fs.readFileSync("js/payroll-actual.js", "utf8");
const migration = fs.readFileSync("supabase/migrations/202610120001_payroll_monthly_salary.sql", "utf8");
const context = vm.createContext({});
vm.runInContext(`${model}\n${summary}`, context);

function run(expression) {
  return JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context));
}

function monthPayload(from, to, employees) {
  return { payload: { full_month: true, from, to, employees } };
}

function salary(id, amount, status = "activo") {
  return {
    employee_id: id,
    compensation_type: "salary",
    employment_status: status,
    state: "CALCULADA",
    actual_amount: amount
  };
}

const today = "2026-10-12";
const september = monthPayload("2026-09-01", "2026-09-30", [salary("director", 3333.33)]);
const october = monthPayload("2026-10-01", "2026-10-31", [salary("director", 3333.33)]);

test("the fiscal window keeps started months and drops future months", () => {
  context.input = {
    fiscalStartMonth: 9,
    today,
    movements: [
      { id: "in-1", occurred_on: "2026-09-15", amount: 100.1, record_type: "income", category: "Ingresos", counts_in_operating_balance: true },
      { id: "in-future", occurred_on: "2026-11-02", amount: 999, record_type: "income", category: "Ingresos", counts_in_operating_balance: true },
      { id: "ex-1", occurred_on: "2026-10-03", amount: 10.2, record_type: "expense", category: "Gastos Operacionales", counts_in_operating_balance: true },
      { id: "payroll-movement", occurred_on: "2026-10-05", amount: 4000, record_type: "expense", category: "Nómina", counts_in_operating_balance: true },
      { id: "benefit", occurred_on: "2026-10-06", amount: 1.05, record_type: "expense", category: "Beneficios", counts_in_operating_balance: true },
      { id: "voided", occurred_on: "2026-10-07", amount: 50, record_type: "expense", category: "Otros Gastos", voided_at: "2026-10-08", counts_in_operating_balance: true },
      { id: "off-balance", occurred_on: "2026-10-07", amount: 80, record_type: "expense", category: "Otros Gastos", counts_in_operating_balance: false }
    ],
    payrollByMonth: {
      "2026-09-01": september,
      "2026-10-01": october,
      "2026-11-01": monthPayload("2026-11-01", "2026-11-30", [salary("director", 3333.33)])
    }
  };
  const result = run("executiveFinanceSummary(input)");
  assert.equal(result.status, "ready");
  assert.equal(result.income, 100.1);
  assert.equal(result.payroll, 4000);
  assert.equal(result.expense, 4011.25);
  assert.equal(result.net, -3911.15);
  assert.equal(result.message, "");
  assert.equal(result.months.filter((month) => month.included).length, 2);
  assert.equal(result.months.find((month) => month.from === "2026-11-01").included, false);
});

test("a month range accepts only complete months and ignores calculated pay", () => {
  context.input = {
    today,
    range: { from: { year: 2026, month: 9 }, to: { year: 2026, month: 10 } },
    movements: [],
    payrollByMonth: {
      "2026-09-01": monthPayload("2026-09-01", "2026-09-30", [
        salary("director", 2500.5),
        { employee_id: "guide", compensation_type: "hourly", employment_status: "terminado", state: "CALCULADA", actual_amount: 144 }
      ]),
      "2026-10-01": october
    }
  };
  const result = run("executiveFinanceSummary(input)");
  assert.equal(result.status, "ready");
  assert.equal(result.payroll, 0);
  assert.equal(result.expense, 0);
  assert.equal(result.net, 0);
  assert.equal(result.message, "");
});

test("daily dates and a partial payroll payload do not become a total", () => {
  context.input = { today, range: { from: { year: 2026, month: 10, day: 1 }, to: { year: 2026, month: 10 } }, movements: [], payrollByMonth: {} };
  assert.equal(run("executiveFinanceSummary(input)").status, "blocked");
  assert.equal(run("executiveFinanceSummary(input)").code, "PARTIAL_PERIOD");
  assert.equal(run("executiveFinanceSummary(input)").net, null);

  context.input = {
    today,
    range: { from: { year: 2026, month: 10 }, to: { year: 2026, month: 10 } },
    movements: [{ id: "in-1", occurred_on: "2026-10-02", amount: 20, record_type: "income", category: "Ingresos", counts_in_operating_balance: true }],
    payrollByMonth: { "2026-10-01": { payload: { full_month: false, from: "2026-10-01", to: "2026-10-15", employees: [salary("director", 1666.67)] } } }
  };
  const partial = run("executiveFinanceSummary(input)");
  assert.equal(partial.status, "ready");
  assert.equal(partial.income, 20);
  assert.equal(partial.expense, 0);
  assert.equal(partial.message, "");
});

test("registered movements stay visible without payroll data or compensation notices", () => {
  const base = {
    today,
    range: { from: { year: 2026, month: 10 }, to: { year: 2026, month: 10 } },
    movements: [{ id: "in-1", occurred_on: "2026-10-02", amount: 20, record_type: "income", category: "Ingresos", counts_in_operating_balance: true }]
  };
  context.input = { ...base };
  const missing = run("executiveFinanceSummary(input)");
  assert.equal(missing.status, "ready");
  assert.equal(missing.income, 20);
  assert.equal(missing.expense, 0);
  assert.equal(missing.message, "");

  context.input = {
    ...base,
    movements: [
      { id: "in-1", occurred_on: "2026-10-02", amount: 20, record_type: "income", category: "Ingresos", counts_in_operating_balance: true },
      { id: "ex-1", occurred_on: "2026-10-04", amount: 8, record_type: "expense", category: "Gastos Operacionales", counts_in_operating_balance: true }
    ],
    payrollByMonth: { "2026-10-01": monthPayload("2026-10-01", "2026-10-31", [
      { employee_id: "open", compensation_type: "unconfigured", employment_status: "activo", state: "SIN TURNO", actual_amount: 900 },
      { employee_id: "blank", compensation_type: "", employment_status: "activo", state: "SIN TURNO", actual_amount: 400 }
    ]) }
  };
  const open = run("executiveFinanceSummary(input)");
  assert.equal(open.status, "ready");
  assert.equal(open.income, 20);
  assert.equal(open.expense, 8);
  assert.equal(open.net, 12);
  assert.equal(open.payroll, 0);
  assert.equal(open.message, "");
});

test("a registered payroll payment is counted once and a matching calculation is not added again", () => {
  context.input = {
    today,
    range: { from: { year: 2026, month: 10 }, to: { year: 2026, month: 10 } },
    movements: [
      { id: "in-1", occurred_on: "2026-10-02", amount: 50, record_type: "income", category: "Ingresos", counts_in_operating_balance: true },
      { id: "pay-1", occurred_on: "2026-10-05", amount: 100, record_type: "expense", category: "Nómina", counts_in_operating_balance: true },
      { id: "ex-1", occurred_on: "2026-10-06", amount: 5, record_type: "expense", category: "Gastos Operacionales", counts_in_operating_balance: true }
    ],
    payrollByMonth: { "2026-10-01": monthPayload("2026-10-01", "2026-10-31", [salary("director", 100)]) }
  };
  const matched = run("executiveFinanceSummary(input)");
  assert.equal(matched.status, "ready");
  assert.equal(matched.income, 50);
  assert.equal(matched.payroll, 100);
  assert.equal(matched.expense, 105);
  assert.equal(matched.net, -55);
  assert.equal(matched.message, "");

  context.input.payrollByMonth = { "2026-10-01": monthPayload("2026-10-01", "2026-10-31", [salary("director", 150)]) };
  const different = run("executiveFinanceSummary(input)");
  assert.equal(different.expense, 105);
  assert.equal(different.payroll, 100);
  assert.equal(different.message, "");
});

test("a future-only selection does not report zero as a result", () => {
  context.input = {
    today,
    range: { from: { year: 2026, month: 11 }, to: { year: 2026, month: 11 } },
    movements: [],
    payrollByMonth: { "2026-11-01": monthPayload("2026-11-01", "2026-11-30", [salary("director", 3333.33)]) }
  };
  const result = run("executiveFinanceSummary(input)");
  assert.equal(result.code, "FUTURE_ONLY");
  assert.equal(result.payroll, null);
  assert.equal(result.net, null);
});

test("the executive summary reads registered movements and leaves payroll on its own screen", () => {
  const loader = finance.slice(finance.indexOf("async function loadExecutiveFinance"), finance.indexOf("async function renderExecutiveFinance"));
  assert.match(finance, /executiveFinanceSummary/);
  assert.match(portal, /executive-finance-summary/);
  assert.match(loader, /finance\.read/);
  assert.doesNotMatch(loader, /compensation\.read|attendance\.history\.read|payroll_actual/);
  assert.doesNotMatch(summary, /payroll_actual|compensation_type|payrollByMonth/);
  assert.doesNotMatch(fs.readFileSync("finanzas.html", "utf8"), /executive-finance-summary/);
  assert.match(finance, /payrollActualTotal\(await supabasePost\("\/rest\/v1\/rpc\/payroll_actual"/);
  assert.match(payrollPage, /round\(d\.payable_minutes \* d\.hourly_rate \/ 60\.0, 2\)|payroll_actual/);
  assert.match(migration, /payable_minutes \* d\.hourly_rate \/ 60\.0/);
  assert.doesNotMatch(migration, /salary_amount\s*\*|salary_amount\s*\//);
});
