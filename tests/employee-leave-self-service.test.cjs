const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const html = fs.readFileSync("employee-portal.html", "utf8");
const main = fs.readFileSync("js/app.js", "utf8");
const leave = fs.readFileSync("js/employee-leave-requests.js", "utf8");
const admin = fs.readFileSync("js/administrative-space.js", "utf8");
const sql = fs.readFileSync("supabase/migrations/20261110150000_employee_leave_self_service_approvers.sql", "utf8");

test("only new scoped module binds days-off panel on all portal profiles", () => {
  assert.match(html, /js\/employee-leave-requests\.js\?v=leave-self-service-20261110/);
  assert.match(main, /await bindExecutiveEmployeePortal\(profile, employee\);\s*await bindEmployeeLeaveRequests\(employee\);/);
  assert.match(main, /if \(employee\) await bindEmployeeLeaveRequests\(employee\);/);
  assert.doesNotMatch(admin, /bindAdministrativeLeave\(employee, employeesPromise\)/);
});

test("form submits only authenticated employee ID and validates dates", () => {
  assert.match(leave, /employee_id: employee\.id, start_date, end_date/);
  assert.match(leave, /end_date < start_date/);
  assert.match(leave, /reason\.length < 5/);
  assert.match(leave, /if \(busy\) return;/);
});

test("roles are explicitly scoped and hidden on non-reviewers", () => {
  for (const role of ["gerente_administrativo", "director_ejecutivo", "administrador_general"]) {
    assert.ok(leave.includes(role));
    assert.ok(sql.includes(role));
  }
  assert.match(leave, /request\.status === "pending" && String\(record\.employee_id\) !== String\(employee\.id\)/);
  assert.match(leave, /if \(reviewer && !isOwn && request\.status === "pending"\)/);
});

test("backend enforces self-only submissions, reviewer identity and no self-review", () => {
  assert.match(sql, /id = new\.employee_id and profile_id = auth\.uid\(\)/);
  assert.match(sql, /leave_row\.requested_by = auth\.uid\(\)/);
  assert.match(sql, /e\.id=leave_row\.employee_id and e\.profile_id=auth\.uid\(\)/);
  assert.match(sql, /leave_row\.status <> 'pending'/);
  assert.match(sql, /for update/);
  assert.doesNotMatch(sql, /alter table public\.(attendance|payroll|schedules)/);
});

test("JS module parses without browser execution", () => {
  new vm.Script(leave);
});
