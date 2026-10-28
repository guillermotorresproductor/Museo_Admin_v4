const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const sql = fs.readFileSync(path.join(__dirname, "../supabase/migrations/202610270001_schedule_week_drafts.sql"), "utf8");
const ui = fs.readFileSync(path.join(__dirname, "../js/horarios.js"), "utf8");
const portal = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");

test("publish is one function and marks the draft after the existing RPCs", () => {
  const start = sql.indexOf("function public.publish_schedule_week");
  const call = sql.indexOf("perform public.schedule_employee_shift", start);
  const marked = sql.indexOf("state = 'published'", call);
  assert.ok(start > 0 && call > start && marked > call);
  assert.match(sql, /perform public\.set_employee_day_off\(/);
});
test("server checks identity, permission, museum and revision", () => {
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /has_permission\('schedules\.manage'\)/);
  assert.match(sql, /museum_id = v_museum/);
  assert.match(sql, /profile_id is not distinct from v_actor/);
  assert.match(sql, /p_expected_revision/);
  assert.match(sql, /v_draft\.state <> 'draft'/);
});
test("ordinary limits and a single locked snapshot", () => {
  assert.match(sql, /not between 1 and 480/);
  assert.match(sql, /week_minutes > 2400/);
  assert.match(sql, /for update/);
  assert.match(sql, /v_source_at := v_current\.updated_at/);
  assert.doesNotMatch(sql, /IDENTITY_MODEL_UNVERIFIED|ATOMIC_PUBLISH_NOT_CERTIFIED/);
});
test("does not replace attendance or payroll functions", () => {
  assert.doesNotMatch(sql, /create or replace function public\.schedule_employee_shift/i);
  assert.doesNotMatch(sql, /create or replace function public\.list_my_assigned_shifts/i);
  assert.doesNotMatch(sql, /attendance_events|payroll_shift_days|employee_time_entries|record_employee_attendance/);
});
test("draft tables are not granted to anonymous clients", () => {
  assert.match(sql, /revoke all on function public\.publish_schedule_week\(uuid, integer\) from public/);
  assert.match(sql, /revoke all on table public\.schedule_week_drafts from public/);
});
test("the page publishes through the week RPC, not one shift at a time", () => {
  assert.match(ui, /saveScheduleWeekDraft/);
  assert.match(ui, /publishScheduleWeek/);
  assert.doesNotMatch(ui, /scheduleEmployeeShift\(/);
  assert.doesNotMatch(ui, /setEmployeeDayOff\(/);
});
test("Mi Espacio still reads only the existing assigned-shift RPC", () => {
  assert.match(portal, /function bindMyAssignedShifts/);
  assert.match(portal, /listMyAssignedShifts/);
});
