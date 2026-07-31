const assert = require("assert");
const fs = require("fs");
const path = require("path");

function test(name, fn) {
  fn();
  console.log(`PASS ${name}`);
}

const root = path.join(__dirname, "..");
const appRecordsSql = fs.readFileSync(
  path.join(root, "supabase", "migrations", "202607290001_restore_operational_records.sql"),
  "utf8"
);
const reconcileSql = fs.readFileSync(
  path.join(root, "supabase", "migrations", "202607290002_reconcile_employee_directory.sql"),
  "utf8"
);
const usherTest = fs.readFileSync(
  path.join(root, "scripts", "test-usher-schedule-views.cjs"),
  "utf8"
);

test("app_records requires module permission helper", () => {
  assert.match(appRecordsSql, /app_records_has_module_access/);
  assert.match(appRecordsSql, /app_records_module_select/);
  assert.match(appRecordsSql, /app_records_module_insert/);
  assert.match(appRecordsSql, /app_records_module_update/);
  assert.match(appRecordsSql, /app_records_module_delete/);
  assert.doesNotMatch(appRecordsSql, /create policy app_records_same_museum_select/);
});

test("unknown module fails closed", () => {
  assert.match(appRecordsSql, /Fail-closed for unknown modules/);
  assert.match(appRecordsSql, /return false;/);
  assert.doesNotMatch(appRecordsSql, /museum_id = public\.current_user_museum_id\(\)\s*;\s*$/m);
});

test("module inventory uses existing permissions only", () => {
  for (const permission of [
    "rentals.manage",
    "calendar.manage",
    "schedules.read.team",
    "inventory.manage",
    "notifications.manage",
    "system.configure",
    "audit.read"
  ]) {
    assert.match(appRecordsSql, new RegExp(`has_permission\\('${permission.replace(".", "\\.")}'\\)`));
  }
  assert.doesNotMatch(appRecordsSql, /insert into public\.permissions/);
});

test("museum isolation remains mandatory in policies", () => {
  assert.match(appRecordsSql, /museum_id = public\.current_user_museum_id\(\)\s*\n\s*and public\.app_records_has_module_access\(module, 'read'\)/);
  assert.match(appRecordsSql, /museum_id = public\.current_user_museum_id\(\)\s*\n\s*and public\.has_permission\('finance\.read'\)/);
});

test("common employee cannot overwrite admin modules without permission", () => {
  assert.match(appRecordsSql, /app_records_has_module_access\(module, 'write'\)/);
  assert.match(appRecordsSql, /created_by = auth\.uid\(\)/);
  assert.match(appRecordsSql, /updated_by = auth\.uid\(\)/);
  assert.doesNotMatch(
    appRecordsSql,
    /create policy app_records_same_museum_insert[\s\S]*museum_id = public\.current_user_museum_id\(\)\s*\n\s*and created_by = auth\.uid\(\)\s*\n\s*and updated_by = auth\.uid\(\)\s*\);/
  );
});

test("finance.read and finance.write remain separated", () => {
  assert.match(appRecordsSql, /has_permission\('finance\.read'\)/);
  assert.match(appRecordsSql, /has_permission\('finance\.write'\)/);
  assert.match(appRecordsSql, /grant select, insert on public\.finance_records to authenticated;/);
  assert.doesNotMatch(appRecordsSql, /grant select, insert, update, delete on public\.finance_records/);
  assert.match(appRecordsSql, /roles\.code in \('administrador', 'finanzas'\)/);
});

test("helper privileges revoke PUBLIC and anon", () => {
  assert.match(appRecordsSql, /revoke all on function public\.app_records_has_module_access\(text, text\) from public, anon;/);
  assert.match(appRecordsSql, /security definer\s*\nset search_path = ''/);
  assert.match(appRecordsSql, /Callers cannot pass an arbitrary permission code/);
});

test("reconciliation does not change employment fields", () => {
  assert.doesNotMatch(reconcileSql, /\bstatus\s*=/);
  assert.doesNotMatch(reconcileSql, /\baccess_level\s*=/);
  assert.doesNotMatch(reconcileSql, /\bposition\s*=/);
  assert.doesNotMatch(reconcileSql, /\bdepartment\s*=/);
  assert.match(reconcileSql, /set profile_id = p\.id,\s*\n\s*auth_user_id = p\.id,/);
});

test("terminated and inactive employees are preserved by omission", () => {
  assert.match(reconcileSql, /Employment data \(status, position, department, access_level\) is NEVER auto-changed/);
  assert.doesNotMatch(reconcileSql, /case when p\.status/);
  assert.doesNotMatch(reconcileSql, /'activo'/);
  assert.doesNotMatch(reconcileSql, /'inactivo'/);
});

test("ambiguous identity match aborts before linking", () => {
  assert.match(reconcileSql, /EMPLOYEE_RECONCILE_AMBIGUOUS/);
  assert.match(reconcileSql, /having count\(distinct e\.id\) > 1 or count\(distinct p\.id\) > 1/);
  assert.ok(
    reconcileSql.indexOf("EMPLOYEE_RECONCILE_AMBIGUOUS")
      < reconcileSql.indexOf("update public.employees e")
  );
});

test("conflicting existing links are not replaced", () => {
  assert.match(reconcileSql, /EMPLOYEE_RECONCILE_CONFLICT/);
  assert.match(reconcileSql, /e\.profile_id is not null and e\.profile_id <> p\.id/);
  assert.match(reconcileSql, /e\.auth_user_id is not null and e\.auth_user_id <> p\.id/);
  assert.match(reconcileSql, /e\.profile_id is null/);
  assert.match(reconcileSql, /e\.auth_user_id is null/);
});

test("no special-case name logic remains", () => {
  assert.doesNotMatch(reconcileSql, /joaqu[ií]n/i);
  assert.doesNotMatch(reconcileSql, /hern[aá]ndez/i);
  assert.doesNotMatch(reconcileSql, /Empleado de ejemplo/);
  assert.doesNotMatch(reconcileSql, /Demostración/);
});

test("full_name recovery only for placeholder names", () => {
  assert.match(reconcileSql, /Usuario Institucional/);
  assert.match(reconcileSql, /position\('@' in p\.full_name\) > 0/);
  assert.match(reconcileSql, /btrim\(coalesce\(p\.full_name, ''\)\) = ''/);
});

test("usher schedule suite still has twenty-six tests", () => {
  const count = (usherTest.match(/^test\(/gm) || []).length;
  assert.strictEqual(count, 26);
});

console.log("All operational migration hardening checks passed.");
