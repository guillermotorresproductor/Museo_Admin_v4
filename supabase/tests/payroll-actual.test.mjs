import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync("supabase/migrations/202609290001_payroll_actual.sql", "utf8");
const page = fs.readFileSync("js/payroll-actual.js", "utf8");
const finance = fs.readFileSync("js/app.js", "utf8");

test("history keeps the default active-only behavior", () => {
  assert.match(migration, /p_include_former boolean default false/);
  assert.match(migration, /p_include_former or e\.status = 'activo'/);
});

test("one employee cannot hold two plazas, and one plaza can hold many", () => {
  assert.match(migration, /EMPLOYEE_PLAZA_OVERLAP/);
  assert.doesNotMatch(migration, /budget_line_id with =/);
});

test("payroll is calculated on read and ignores approved overtime pay", () => {
  assert.match(migration, /least\(rec\.worked_minutes, remaining\)/);
  assert.match(migration, /remaining := 2400/);
  assert.doesNotMatch(migration, /update public\.finance_records/);
  assert.doesNotMatch(migration, /approved_overtime_minutes \*/);
});

test("plaza assignment uses the museum Finanzas already loaded", () => {
  assert.match(finance, /bindPayrollActual\(currentProfile\.museum_id\)/);
  assert.match(page, /async function bindPayrollActual\(museumId\)/);
  assert.doesNotMatch(page, /currentProfile/);
  assert.match(page, /category=eq\.\$\{encodeURIComponent\("Nómina"\)\}/);
  assert.match(page, /\/rest\/v1\/rpc\/assign_employee_budget_line/);
  assert.match(page, /\/rest\/v1\/rpc\/close_employee_budget_assignment/);
  assert.match(page, /Cerrar asignación/);
  assert.match(page, /EMPLOYEE_PLAZA_OVERLAP/);
  assert.match(page, /console\.error\("Asignación de plaza:"/);
  assert.match(page, /\/rest\/v1\/employee_budget_assignments\?select=/);
  assert.doesNotMatch(page, /insert into public\.employee_budget_assignments/);
});

test("the finance screen keeps the budget grid and only displays the server result", () => {
  assert.match(finance, /Nómina presupuestada/);
  assert.match(finance, /renderPayrollActualShell\(\)/);
  assert.match(page, /\/rest\/v1\/rpc\/payroll_actual/);
  assert.doesNotMatch(page, /update_finance_record_amount/);
  assert.doesNotMatch(page, /finance_records/);
});
