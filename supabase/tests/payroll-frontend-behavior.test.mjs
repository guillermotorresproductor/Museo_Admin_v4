import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire("C:/Users/guill/AppData/Local/Temp/museo-jsdom/package.json");
const { JSDOM } = require("jsdom");

const museumId = "a1f597f7-44a2-44b2-9214-93364c2a12ff";
const otherMuseumId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const employeeId = "19054839-4e00-4a1d-816e-c6c69e07506d";
const lineId = "7bf20d7d-0e20-4197-bb8e-13297f000ef1";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://127.0.0.1/finanzas.html",
  runScripts: "dangerously"
});
const { window } = dom;
const originalAdd = window.document.addEventListener.bind(window.document);
window.document.addEventListener = (type, fn, options) => {
  if (type === "DOMContentLoaded") return undefined;
  return originalAdd(type, fn, options);
};
window.eval([
  fs.readFileSync("js/config.js", "utf8").replace(/^"use strict";\s*/, ""),
  fs.readFileSync("js/services/supabase.js", "utf8"),
  fs.readFileSync("js/payroll-actual.js", "utf8"),
  fs.readFileSync("js/app.js", "utf8"),
  "globalThis.__permit = function(list){ currentPermissions = new Set(list); };"
].join("\n"));
window.document.addEventListener = originalAdd;

const calls = [];
let confirmAnswer = true;
let postGate = null;
let postError = null;
window.confirm = () => confirmAnswer;
window.fetchSupabaseProfile = async () => ({ id: "actor-1", museum_id: museumId });
window.supabasePost = async (path, body) => {
  calls.push({ method: "POST", path, body });
  if (postGate) await postGate;
  if (postError) throw new Error(postError);
  if (path.endsWith("/payroll_actual")) {
    return {
      from: body.p_from,
      to: body.p_to,
      budget_month: "septiembre",
      budget_year: 2026,
      full_month: true,
      plazas: [],
      unassigned: { actual_amount: 0, employees: [] },
      employees: [{
        employee_id: employeeId,
        name: "Ana Pérez",
        position: "Guía",
        employment_status: "inactivo",
        plaza_name: "Guías",
        compensation_type: "hourly",
        hourly_rate: 10,
        monthly_equivalent: 100,
        worked_minutes: 60,
        payable_minutes: 60,
        over_limit_minutes: 0,
        actual_amount: 10,
        state: "CALCULADA",
        days: []
      }]
    };
  }
  if (path.endsWith("/get_employee_compensation")) {
    return {
      compensation_type: "hourly",
      hourly_rate: 15,
      pay_frequency: "biweekly",
      standard_hours_week: null,
      effective_from: "2026-09-15"
    };
  }
  if (path.endsWith("/save_employee_compensation")) return { ok: true };
  if (path.endsWith("/assign_employee_budget_line")) return { ok: true };
  if (path.endsWith("/close_employee_budget_assignment")) return { ok: true };
  if (path.endsWith("/list_attendance_history")) {
    return {
      employees: [
        { employee_id: employeeId, name: "Ana Pérez", scheduled_days: 1, days_with_punches: 1, regular_minutes: 60, approved_overtime_minutes: 0, late_days: 0, incident_days: 0, corrected_days: 0, days: [] },
        { employee_id: "c49e0812-f6fc-4e9b-9cc3-43f230977b3a", name: "Alberto Soto", scheduled_days: 1, days_with_punches: 0, regular_minutes: 0, approved_overtime_minutes: 0, late_days: 0, incident_days: 0, corrected_days: 0, days: [] }
      ]
    };
  }
  throw new Error(`unexpected ${path}`);
};
window.supabaseGet = async (path) => {
  calls.push({ method: "GET", path });
  assert.equal(path.includes(otherMuseumId), false);
  if (path.startsWith("/rest/v1/employees?")) {
    return [
      { id: employeeId, first_name: "Ana", last_name: "Pérez", status: "activo" },
      { id: "c49e0812-f6fc-4e9b-9cc3-43f230977b3a", first_name: "Alberto", last_name: "Soto", status: "inactivo" }
    ];
  }
  if (path.startsWith("/rest/v1/finance_budget_lines?")) {
    return [{ id: lineId, name: "Guías" }];
  }
  if (path.startsWith("/rest/v1/employee_budget_assignments?")) {
    return window.__assignments || [];
  }
  throw new Error(`unexpected ${path}`);
};

function permit(list) {
  window.__permit(list);
}
function posted(name) {
  return calls.filter((call) => call.method === "POST" && call.path.endsWith(`/${name}`));
}
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("nómina real reads payroll_actual and hides controls without permission", async () => {
  permit(["compensation.read", "attendance.history.read"]);
  window.document.body.innerHTML = window.renderPayrollActualShell();
  assert.equal(window.document.querySelector("[data-payroll-assign]"), null);
  assert.match(window.document.body.textContent, /Nómina real/);
  permit([]);
  assert.equal(window.renderPayrollActualShell(), "");
});

test("assignment writes only through the authorized RPCs and keeps the form on a network error", async () => {
  permit(["compensation.read", "compensation.manage", "attendance.history.read"]);
  confirmAnswer = true;
  postError = null;
  window.__assignments = [];
  calls.length = 0;
  window.document.body.innerHTML = window.renderPayrollActualShell();
  await window.bindPayrollActual(museumId);
  await wait(20);
  const payrollCalls = posted("payroll_actual");
  assert.equal(payrollCalls.length, 1);
  assert.equal(typeof payrollCalls[0].body.p_from, "string");
  assert.equal(typeof payrollCalls[0].body.p_to, "string");
  assert.equal(calls.some((call) => /finance_records|resolve_employee_compensation|save_employee_sensitive_details/.test(call.path)), false);
  assert.match(window.document.body.textContent, /Exempleado/);
  assert.match(window.document.body.textContent, /Por hora/);
  assert.equal(window.document.body.textContent.includes(employeeId), false);

  const assignmentGets = calls.filter((call) => call.method === "GET" && call.path.includes("employee_budget_assignments"));
  assert.equal(assignmentGets.length > 0, true);
  assert.match(assignmentGets[0].path, new RegExp(museumId));

  const form = window.document.querySelector("[data-payroll-assign]");
  form.querySelector("[data-payroll-employee-choice]").value = employeeId;
  form.querySelector("[data-payroll-line-choice]").value = lineId;
  form.querySelector("[data-payroll-assign-from]").value = "2026-10-01";
  postError = "Failed to fetch";
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await wait(20);
  assert.equal(posted("assign_employee_budget_line").length, 1);
  assert.equal(form.querySelector("[data-payroll-assign-from]").value, "2026-10-01");
  const admin = window.document.querySelector("[data-payroll-admin-message]").textContent;
  assert.match(admin, /No hubo conexión/);
  assert.doesNotMatch(admin, /rpc|PGRST|uuid|Failed to fetch/i);
  postError = null;
});

test("an open plaza must be closed before another assignment, and close requires confirmation", async () => {
  permit(["compensation.read", "compensation.manage", "attendance.history.read"]);
  window.__assignments = [{
    employee_id: employeeId,
    budget_line_id: lineId,
    effective_from: "2026-09-01",
    effective_until: null
  }];
  calls.length = 0;
  window.document.body.innerHTML = window.renderPayrollActualShell();
  const root = window.document.querySelector("[data-payroll-actual]");
  delete root.dataset.bound;
  await window.bindPayrollActual(museumId);
  await wait(20);
  assert.match(window.document.body.textContent, /Plaza vigente/);
  assert.match(window.document.body.textContent, /Historial/);
  const form = window.document.querySelector("[data-payroll-assign]");
  form.querySelector("[data-payroll-employee-choice]").value = employeeId;
  form.querySelector("[data-payroll-line-choice]").value = lineId;
  form.querySelector("[data-payroll-assign-from]").value = "2026-10-01";
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await wait(20);
  assert.equal(posted("assign_employee_budget_line").length, 0);
  assert.match(window.document.querySelector("[data-payroll-admin-message]").textContent, /Cierre primero/);
  assert.equal(form.querySelector("[data-payroll-assign-from]").value, "2026-10-01");

  confirmAnswer = false;
  const closeButton = window.document.querySelector("[data-payroll-close]");
  closeButton.parentElement.querySelector("[data-payroll-close-until]").value = "2026-09-30";
  closeButton.click();
  await wait(20);
  assert.equal(posted("close_employee_budget_assignment").length, 0);
  assert.equal(closeButton.parentElement.querySelector("[data-payroll-close-until]").value, "2026-09-30");

  confirmAnswer = true;
  closeButton.click();
  await wait(20);
  const closed = posted("close_employee_budget_assignment");
  assert.equal(closed.length, 1);
  assert.equal(closed[0].body.p_employee_id, employeeId);
  assert.equal(closed[0].body.p_effective_until, "2026-09-30");
  assert.equal(calls.some((call) => call.method !== "GET" && call.path.includes("employee_budget_assignments") && !call.path.includes("/rpc/")), false);
});

test("a double click assigns the plaza once", async () => {
  permit(["compensation.read", "compensation.manage", "attendance.history.read"]);
  window.__assignments = [];
  confirmAnswer = true;
  postError = null;
  calls.length = 0;
  let release;
  postGate = new Promise((resolve) => { release = resolve; });
  window.document.body.innerHTML = window.renderPayrollActualShell();
  const root = window.document.querySelector("[data-payroll-actual]");
  delete root.dataset.bound;
  await window.bindPayrollActual(museumId);
  await wait(20);
  const form = window.document.querySelector("[data-payroll-assign]");
  form.querySelector("[data-payroll-employee-choice]").value = employeeId;
  form.querySelector("[data-payroll-line-choice]").value = lineId;
  form.querySelector("[data-payroll-assign-from]").value = "2026-10-02";
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  release();
  postGate = null;
  await wait(30);
  assert.equal(posted("assign_employee_budget_line").length, 1);
});

test("compensation reads, saves once, and keeps the draft when the network fails", async () => {
  permit(["compensation.read", "compensation.manage"]);
  calls.length = 0;
  postError = null;
  window.document.body.innerHTML = `
    <section data-compensation-section>
      <div data-compensation-summary></div>
      <form>
        <fieldset data-compensation-editor>
          <input name="standardHoursWeek">
          <input name="hourlyRate">
          <select name="compensationSchedule"></select>
          <input name="compensationEffectiveFrom">
          <input name="salaryAmount">
          <select name="compensationSalarySchedule"></select>
          <input name="compensationSalaryEffectiveFrom">
          <button type="button" data-compensation-save>Establecer vigencia</button>
        </fieldset>
      </form>
      <p data-compensation-message></p>
    </section>`;
  const panel = window.bindEmployeeCompensation(window.document.body);
  await panel.load({ id: employeeId, profile_id: "other-person" });
  const summary = window.document.querySelector("[data-compensation-summary]").textContent;
  assert.match(summary, /Por hora/);
  assert.match(summary, /\$15\.00|15/);
  assert.match(summary, /15 de septiembre de 2026/);
  assert.equal(window.document.querySelector("[data-compensation-editor]").hidden, false);
  assert.equal(summary.includes(employeeId), false);

  const rate = window.document.querySelector("[name=hourlyRate]");
  const schedule = window.document.querySelector("[name=compensationSchedule]");
  const effective = window.document.querySelector("[name=compensationEffectiveFrom]");
  rate.value = "18.50";
  schedule.value = "biweekly";
  effective.value = "2026-10-01";
  postError = "TypeError: Failed to fetch uuid PGRST202 /rest/v1/rpc/save_employee_compensation";
  const button = window.document.querySelector("[data-compensation-save]");
  button.click();
  await wait(20);
  assert.equal(rate.value, "18.50");
  assert.equal(effective.value, "2026-10-01");
  const message = window.document.querySelector("[data-compensation-message]").textContent;
  assert.match(message, /No hubo conexión/);
  assert.doesNotMatch(message, /rpc|PGRST|uuid|save_employee_compensation/i);

  postError = null;
  let release;
  postGate = new Promise((resolve) => { release = resolve; });
  const before = posted("save_employee_compensation").length;
  button.click();
  button.click();
  release();
  postGate = null;
  await wait(30);
  const saves = posted("save_employee_compensation");
  assert.equal(saves.length - before, 1);
  assert.equal(saves.at(-1).body.p_employee_id, employeeId);
  assert.equal(saves.at(-1).body.p_effective_from, "2026-10-01");
  assert.match(window.document.querySelector("[data-compensation-message]").textContent, /Nueva vigencia registrada/);
  await panel.load({ id: employeeId, profile_id: "other-person" });
  assert.match(window.document.querySelector("[data-compensation-summary]").textContent, /Por hora/);
});

test("a user without compensation permission does not see the editor", async () => {
  permit(["compensation.read"]);
  window.document.body.innerHTML = `
    <section data-compensation-section>
      <div data-compensation-summary></div>
      <fieldset data-compensation-editor hidden>
        <input name="hourlyRate">
        <select name="compensationSchedule"></select>
        <input name="compensationEffectiveFrom">
        <input name="salaryAmount">
        <select name="compensationSalarySchedule"></select>
        <input name="compensationSalaryEffectiveFrom">
        <button type="button" data-compensation-save>Establecer vigencia</button>
      </fieldset>
      <p data-compensation-message></p>
    </section>`;
  const before = posted("save_employee_compensation").length;
  const panel = window.bindEmployeeCompensation(window.document.body);
  await panel.load({ id: employeeId, profile_id: "other-person" });
  assert.equal(window.document.querySelector("[data-compensation-section]").hidden, false);
  assert.equal(window.document.querySelector("[data-compensation-editor]").hidden, true);
  window.document.querySelector("[data-compensation-save]").click();
  await wait(10);
  assert.equal(posted("save_employee_compensation").length, before);
});

test("attendance history always sends the former-employee flag and labels both groups", async () => {
  permit(["attendance.history.read"]);
  calls.length = 0;
  window.document.body.innerHTML = `
    <div data-attendance-period>
      <select name="attendancePeriod"><option value="month" selected>Mensual</option></select>
      <select name="includeFormer"><option value="0" selected>Solo empleados activos</option><option value="1">Incluir exempleados</option></select>
      <input name="anchor">
      <input name="from">
      <input name="to">
      <p data-period-label></p>
      <div data-period-nav></div>
      <div data-period-anchor></div>
    </div>
    <div data-today-staff></div>
    <div data-attendance-history>
      <p data-history-message></p>
      <table><tbody data-history-body></tbody></table>
      <div data-punch-editor hidden></div>
    </div>`;
  window.bindAttendanceHistory();
  await wait(30);
  const first = posted("list_attendance_history");
  assert.equal(first.length, 1);
  assert.equal(first[0].body.p_include_former, false);
  assert.equal(Object.keys(first[0].body).sort().join(","), "p_from,p_include_former,p_to");
  assert.equal(window.document.body.textContent.includes("Exempleado"), false);

  window.document.querySelector("[name=includeFormer]").value = "1";
  window.document.querySelector("[name=includeFormer]").dispatchEvent(new window.Event("change"));
  await wait(30);
  const second = posted("list_attendance_history");
  assert.equal(second.length, 2);
  assert.equal(second[1].body.p_include_former, true);
  const statusLookup = calls.filter((call) => call.method === "GET" && call.path.includes("/rest/v1/employees"));
  assert.match(statusLookup.at(-1).path, new RegExp(museumId));
  assert.equal(statusLookup.at(-1).path.includes(otherMuseumId), false);
  assert.match(window.document.body.textContent, /Activo/);
  assert.match(window.document.body.textContent, /Exempleado/);
});

test("finance and human resources pages keep their existing modules", () => {
  const finance = fs.readFileSync("finanzas.html", "utf8");
  const hr = fs.readFileSync("recursos-humanos.html", "utf8");
  const reports = fs.readFileSync("reportes.html", "utf8");
  assert.match(finance, /Nómina presupuestada|data-finance/);
  assert.match(finance, /js\/payroll-actual\.js\?v=payroll-frontend-20260929/);
  assert.match(hr, /data-compensation-save/);
  assert.match(hr, /data-hr-module/);
  assert.match(reports, /name="includeFormer"/);
  assert.doesNotMatch(fs.readFileSync("js/payroll-actual.js", "utf8"), /finance_records|resolve_employee_compensation|save_employee_sensitive_details/);
  assert.doesNotMatch(fs.readFileSync("js/app.js", "utf8"), /save_employee_sensitive_details|resolve_employee_compensation/);
});
