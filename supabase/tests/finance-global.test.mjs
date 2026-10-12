import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire("C:/Users/guill/AppData/Local/Temp/museo-jsdom/package.json");
const { JSDOM } = require("jsdom");
const model = fs.readFileSync("js/finance-model.js", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
const html = fs.readFileSync("finanzas.html", "utf8");
const context = vm.createContext({});
vm.runInContext(model, context);

function run(expression) {
  return JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context));
}

function movement(id, date, amount, type, extra = {}) {
  return {
    budget_line_id: id,
    occurred_on: date,
    amount,
    record_type: type,
    counts_in_operating_balance: true,
    ...extra
  };
}

test("Global sums registered movements from the fiscal start through the current month", () => {
  context.movements = [
    movement("in-sep", "2026-09-15", 100.1, "income"),
    movement("in-future", "2026-11-02", 999, "income"),
    movement("ex-oct", "2026-10-03", 10.2, "expense"),
    movement("payroll", "2026-10-05", 40, "expense"),
    movement("benefit", "2026-10-06", 1.05, "expense"),
    movement("future-expense", "2026-11-03", 80, "expense"),
    movement("voided", "2026-10-07", 50, "expense", { voided_at: "2026-10-08" }),
    movement("off", "2026-10-07", 80, "expense", { counts_in_operating_balance: false })
  ];
  const real = run("financeRealFromMovements(movements, 2026, 9)");
  const index = run("financeMovementMonthIndex('2026-10-12', 2026, 9)");
  assert.equal(index, 1);
  assert.equal(real.income, 1099.1);
  const started = run(`financeRealThroughMonth(financeRealFromMovements(movements, 2026, 9), ${index})`);
  assert.deepEqual(started, { income: 100.1, expense: 51.25, net: 48.85 });

  context.movements.push(movement("payroll-2", "2026-09-20", 15, "expense"));
  const once = run("financeRealThroughMonth(financeRealFromMovements(movements, 2026, 9), 1)");
  assert.equal(once.expense, 66.25);
  assert.equal(once.net, 33.85);
});

test("the Global screen shows only the three registered totals", () => {
  const view = app.slice(app.indexOf("function renderFinanceGlobal"), app.indexOf("function renderFinanceNetRegion"));
  const rendered = vm.runInContext(`${model}\n${view}\nrenderFinanceGlobal({ income: 100.1, expense: 51.25, net: 48.85, label: "Septiembre 2026 – Octubre 2026" })`, vm.createContext({}));
  assert.match(rendered, /Total de ingresos registrados/);
  assert.match(rendered, /Total de gastos registrados/);
  assert.match(rendered, /Balance neto/);
  assert.match(rendered, /Septiembre 2026 – Octubre 2026/);
  assert.match(rendered, /\$100\.10/);
  assert.match(rendered, /\$51\.25/);
  assert.match(rendered, /\$48\.85/);
  assert.equal(rendered.match(/<tbody>[\s\S]*<\/tbody>/)[0].match(/<tr>/g).length, 3);
  assert.doesNotMatch(rendered, /nómina calculada|presupuesto|3333/i);
});

test("Global follows Resumen and Resumen stays the default view", () => {
  const nav = html.slice(html.indexOf('aria-label="Navegación interna de Finanzas"'), html.indexOf("</nav>"));
  const tabs = [...nav.matchAll(/data-finance-tab="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(tabs, ["resumen", "global", "ingresos", "gastos", "facturas", "cheques", "nomina", "asistencia", "reportes", "configuracion"]);
  assert.match(nav, /data-finance-tab="resumen"[^>]*>Resumen/);
  assert.match(nav, /class="admin-tab is-active"[^>]*data-finance-tab="resumen"/);
  assert.doesNotMatch(nav, /data-finance-tab="global"[^>]*is-active|is-active[^>]*data-finance-tab="global"/);
  const globalSummary = app.slice(app.indexOf("  const globalSummary"), app.indexOf("  const renderSummary"));
  assert.match(globalSummary, /financeRealThroughMonth\(realMovements, index\)/);
  assert.doesNotMatch(globalSummary, /payrollRealMonths/);
  const resumen = app.slice(app.indexOf("  const realSummary"), app.indexOf("  const globalSummary"));
  assert.match(resumen, /financeMonthReal\(realMovements, payrollRealMonths\[index\], index\)/);
  assert.match(app, /if \(activeTab === "resumen"\) panel\.innerHTML = renderNetSummary\(\)/);
  assert.match(app, /if \(activeTab === "global"\) panel\.innerHTML = renderFinanceGlobal\(globalSummary\(\)\)/);
});

test("clicking Global and returning to Resumen uses the existing tab control", async () => {
  const dom = new JSDOM(html, { url: "http://127.0.0.1/finanzas.html", runScripts: "outside-only" });
  const { window } = dom;
  const finance = app.slice(app.indexOf("function renderFinanceGlobal"), app.indexOf("function bindFinanceBudgetPreview"));
  const context = vm.createContext({
    document: window.document,
    hasPermission: () => false,
    getSupabaseSession: () => null,
    loginUrlWithReturn: () => "login.html",
    safeHtml: (value) => String(value ?? "")
  });
  vm.runInContext(`${model}\n${finance}\nbindFinanceModule()`, context);
  const panel = window.document.querySelector("[data-finance-panel]");
  const button = (name) => window.document.querySelector(`[data-finance-tab="${name}"]`);
  assert.equal(button("resumen").classList.contains("is-active"), true);
  assert.equal(button("global").classList.contains("is-active"), false);

  button("global").click();
  assert.equal(button("global").classList.contains("is-active"), true);
  assert.equal(button("resumen").classList.contains("is-active"), false);
  assert.match(panel.textContent, /No se pudo determinar el período fiscal vigente/);
  assert.doesNotMatch(panel.textContent, /Total de Ingresos/);

  button("resumen").click();
  assert.equal(button("resumen").classList.contains("is-active"), true);
  assert.equal(button("global").classList.contains("is-active"), false);
  assert.match(panel.textContent, /Balance Neto/);
  assert.match(panel.textContent, /Total de Ingresos/);
  assert.match(panel.textContent, /Total de Gastos/);
  assert.doesNotMatch(panel.textContent, /Total de ingresos registrados/);
});
