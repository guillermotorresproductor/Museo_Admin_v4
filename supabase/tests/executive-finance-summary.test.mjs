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
  assert.equal(result.payroll, 6666.66);
  assert.equal(result.expense, 6677.91);
  assert.equal(result.net, -6577.81);
  assert.equal(result.months.filter((month) => month.included).length, 2);
  assert.equal(result.months.find((month) => month.from === "2026-11-01").included, false);
});

test("a month range accepts only complete months and keeps hourly pay", () => {
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
  assert.equal(result.payroll, 5977.83);
  assert.equal(result.expense, 5977.83);
  assert.equal(result.net, -5977.83);
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
  assert.equal(partial.code, "PARTIAL_PERIOD");
  assert.equal(partial.income, null);
  assert.equal(partial.net, null);
});

test("missing payroll, salary errors, and inactive monthly pay block the total", () => {
  const base = {
    today,
    range: { from: { year: 2026, month: 10 }, to: { year: 2026, month: 10 } },
    movements: [{ id: "in-1", occurred_on: "2026-10-02", amount: 20, record_type: "income", category: "Ingresos", counts_in_operating_balance: true }]
  };
  context.input = { ...base, payrollByMonth: {} };
  assert.equal(run("executiveFinanceSummary(input)").code, "PAYROLL_UNAVAILABLE");
  assert.equal(run("executiveFinanceSummary(input)").income, null);

  for (const [error, code] of [
    ["SALARY_CONFIGURATION_INCOMPLETE", "SALARY_CONFIGURATION_INCOMPLETE"],
    ["SALARY_PERIOD_UNSUPPORTED", "SALARY_PERIOD_UNSUPPORTED"],
    ["SALARY_CHANGE_UNDEFINED", "SALARY_CHANGE_UNDEFINED"],
    ["SALARY_HIRE_DATE_PARTIAL", "SALARY_HIRE_DATE_PARTIAL"],
    ["FORBIDDEN", "FORBIDDEN"]
  ]) {
    context.input = { ...base, payrollByMonth: { "2026-10-01": { error } } };
    const blocked = run("executiveFinanceSummary(input)");
    assert.equal(blocked.code, code);
    assert.equal(blocked.net, null);
  }

  context.input = { ...base, payrollByMonth: { "2026-10-01": monthPayload("2026-10-01", "2026-10-31", [salary("director", 3333.33, "inactivo")]) } };
  const inactive = run("executiveFinanceSummary(input)");
  assert.equal(inactive.code, "EMPLOYMENT_STATUS_UNDEFINED");
  assert.equal(inactive.expense, null);

  context.input = { ...base, payrollByMonth: { "2026-10-01": monthPayload("2026-10-01", "2026-10-31", [salary("director", 3333.33, "terminado")]) } };
  assert.equal(run("executiveFinanceSummary(input)").code, "EMPLOYMENT_STATUS_UNDEFINED");

  context.input = { ...base, payrollByMonth: { "2026-10-01": monthPayload("2026-10-01", "2026-10-31", [{ employee_id: "open", compensation_type: "unconfigured", employment_status: "activo", state: "SIN TURNO", actual_amount: 0 }]) } };
  assert.equal(run("executiveFinanceSummary(input)").code, "SALARY_CONFIGURATION_INCOMPLETE");
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

test("the executive calculation is on the portal and not on the finance page", () => {
  assert.match(finance, /executiveFinanceSummary/);
  assert.match(portal, /executive-finance-summary/);
  assert.doesNotMatch(fs.readFileSync("finanzas.html", "utf8"), /executive-finance-summary/);
  assert.match(finance, /payrollActualTotal\(await supabasePost\("\/rest\/v1\/rpc\/payroll_actual"/);
  assert.match(payrollPage, /round\(d\.payable_minutes \* d\.hourly_rate \/ 60\.0, 2\)|payroll_actual/);
  assert.match(migration, /payable_minutes \* d\.hourly_rate \/ 60\.0/);
  assert.doesNotMatch(migration, /salary_amount\s*\*|salary_amount\s*\//);
});
