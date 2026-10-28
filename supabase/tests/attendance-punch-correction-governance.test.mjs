import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/202610280001_punch_correction_governance.sql"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const edge = fs.readFileSync(path.join(root, "supabase/functions/manage-attendance-corrections/index.ts"), "utf8");

test("the migration denies the administrative manager before granting the two authorized profiles", () => {
  const denyAt = migration.indexOf("punch_correction_governance_20261028");
  const allowAt = migration.indexOf("in ('administrador_general','director_ejecutivo') then");
  assert.ok(denyAt > 0);
  assert.ok(allowAt > 0);
  assert.match(migration, /overlay\(src placing E'\\nbegin' \|\| deny_sql/);
  assert.match(migration, /current_employee_module_profile\(\) = 'gerente_administrativo'/);
  assert.match(migration, /p_decision = ''approved'' and not public\.has_permission\(''attendance\.punches\.correct''\)/);
  assert.equal(migration.includes("schedules.manage"), false);
  assert.equal(migration.includes("attendance.exclusions.manage"), false);
  assert.equal(migration.includes("public.payroll"), false);
});

test("attendance edit controls follow punch-correction permission and schedules stay gated", () => {
  const cardAt = app.indexOf("const canApplyPunchCorrection = hasPermission(\"attendance.punches.correct\")");
  const approveAt = app.indexOf("${canApplyPunchCorrection ? `<button class=\"portal-inline-button\" type=\"submit\" data-decision=\"approved\">Aprobar</button>` : \"\"}");
  assert.ok(cardAt > 0);
  assert.ok(approveAt > cardAt);
  assert.match(app, /historyOnly \|\| !canCorrect/);
  assert.match(app, /No tiene autorización para corregir ponches/);
  assert.match(app, /hasPermission\("schedules\.manage"\)/);
  assert.match(app, /form\.hidden = !canManage/);
});

test("the approver list and the punch RPC name the same two profiles", () => {
  const authorizers = fs.readFileSync(path.join(root, "supabase/migrations/202610280002_punch_correction_authorizers.sql"), "utf8");
  assert.match(authorizers, /list_attendance_correction_authorizers\(\)/);
  assert.match(authorizers, /correct_shift_attendance_punches\(uuid,text,text,uuid,jsonb\)/);
  assert.match(authorizers, /e\.access_profile in \('director_ejecutivo','gerente_administrativo'\)/);
  assert.match(authorizers, /e\.access_profile in \('administrador_general','director_ejecutivo'\)/);
  assert.equal(authorizers.includes("schedules.manage"), false);
  assert.equal(authorizers.includes("public.payroll"), false);
  assert.equal(authorizers.includes("current_employee_module_profile"), false);
});

test("the legacy correction function refuses an approval by the administrative manager", () => {
  const decideAt = edge.indexOf("action === \"decide\"");
  const approvedAt = edge.indexOf("decision === \"approved\"");
  const profileAt = edge.indexOf("\"gerente_administrativo\"");
  assert.ok(decideAt > 0);
  assert.ok(approvedAt > decideAt);
  assert.ok(profileAt > approvedAt);
  assert.match(edge, /No tiene autorización para corregir ponches/);
});
