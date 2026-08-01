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
const appJs = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");

function extractInventarioBlock(sql) {
  const match = sql.match(
    /if module_name = 'inventario' then\s*--[\s\S]*?return public\.has_permission\('inventory\.manage'\);\s*end if;/
  );
  assert.ok(match, "inventario module block missing");
  return match[0];
}

test("app_records requires module permission helper", () => {
  assert.match(appRecordsSql, /app_records_has_module_access/);
  assert.match(appRecordsSql, /app_records_module_select/);
  assert.match(appRecordsSql, /app_records_module_insert/);
  assert.match(appRecordsSql, /app_records_module_update/);
  assert.doesNotMatch(appRecordsSql, /create policy app_records_same_museum_select/);
});

test("unknown module fails closed", () => {
  assert.match(appRecordsSql, /Fail-closed for unknown modules/);
  assert.match(appRecordsSql, /return false;/);
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

test("ordinary same-museum user can read inventory", () => {
  const block = extractInventarioBlock(appRecordsSql);
  assert.match(block, /if mode = 'read' then\s*\n\s*return true;/);
  assert.match(appRecordsSql, /authenticated same museum/);
});

test("ordinary user cannot modify inventory without inventory.manage", () => {
  const block = extractInventarioBlock(appRecordsSql);
  assert.match(block, /return public\.has_permission\('inventory\.manage'\);/);
  assert.doesNotMatch(block, /if mode = 'write' then\s*\n\s*return true;/);
});

test("inventory.manage can read and modify", () => {
  const block = extractInventarioBlock(appRecordsSql);
  assert.match(block, /mode = 'read'[\s\S]*return true/);
  assert.match(block, /has_permission\('inventory\.manage'\)/);
});

test("other museum cannot read inventory via museum_id RLS", () => {
  assert.match(
    appRecordsSql,
    /museum_id = public\.current_user_museum_id\(\)\s*\n\s*and public\.app_records_has_module_access\(module, 'read'\)/
  );
  assert.match(appRecordsSql, /if public\.current_user_museum_id\(\) is null then\s*\n\s*return false;/);
});

test("app_records physical DELETE is not allowed", () => {
  assert.match(appRecordsSql, /Physical DELETE of app_records documents is not allowed/);
  assert.match(appRecordsSql, /no permitido/);
  assert.match(appRecordsSql, /drop policy if exists app_records_module_delete/);
  assert.doesNotMatch(appRecordsSql, /create policy app_records_module_delete/);
  assert.match(appRecordsSql, /revoke delete on public\.app_records from authenticated;/);
  assert.match(appRecordsSql, /mode not in \('read', 'write'\)/);
});

test("museum isolation remains mandatory in policies", () => {
  assert.match(appRecordsSql, /museum_id = public\.current_user_museum_id\(\)\s*\n\s*and public\.has_permission\('finance\.read'\)/);
});

test("common employee cannot overwrite admin modules without permission", () => {
  assert.match(appRecordsSql, /app_records_has_module_access\(module, 'write'\)/);
  assert.match(appRecordsSql, /created_by = auth\.uid\(\)/);
  assert.match(appRecordsSql, /updated_by = auth\.uid\(\)/);
});

test("finance uses secure amount RPC and select/insert grants", () => {
  assert.match(appRecordsSql, /has_permission\('finance\.read'\)/);
  assert.match(appRecordsSql, /has_permission\('finance\.write'\)/);
  assert.match(appRecordsSql, /update_finance_record_amount/);
  assert.match(appRecordsSql, /grant select, insert on public\.finance_records to authenticated;/);
  assert.doesNotMatch(appRecordsSql, /grant select, insert, update, delete on public\.finance_records/);
  assert.match(appJs, /\/rest\/v1\/rpc\/update_finance_record_amount/);
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
  assert.match(reconcileSql, /Does NOT touch status, position, department, access_level/);
});

test("terminated and inactive employees are preserved by omission", () => {
  assert.match(reconcileSql, /Employment data \(status, position, department, access_level\) is NEVER auto-changed/);
  assert.doesNotMatch(reconcileSql, /case when p\.status/);
  assert.doesNotMatch(reconcileSql, /'activo'/);
  assert.doesNotMatch(reconcileSql, /'inactivo'/);
});

test("partial identity links are completed safely", () => {
  assert.match(reconcileSql, /\(e\.profile_id is null or e\.profile_id = p\.id\)/);
  assert.match(reconcileSql, /\(e\.auth_user_id is null or e\.auth_user_id = p\.id\)/);
  assert.match(reconcileSql, /\(e\.profile_id is null or e\.auth_user_id is null\)/);
  assert.match(reconcileSql, /both null; profile_id=p\.id with auth_user_id null; auth_user_id=p\.id with profile_id null/);
});

test("ambiguous identity match aborts before linking", () => {
  assert.match(reconcileSql, /EMPLOYEE_RECONCILE_AMBIGUOUS/);
  assert.match(reconcileSql, /having count\(distinct e\.id\) > 1 or count\(distinct p\.id\) > 1/);
  assert.ok(
    reconcileSql.indexOf("EMPLOYEE_RECONCILE_AMBIGUOUS")
      < reconcileSql.indexOf("update public.employees e")
  );
});

test("conflicting different ids abort and do not replace", () => {
  assert.match(reconcileSql, /EMPLOYEE_RECONCILE_CONFLICT/);
  assert.match(reconcileSql, /e\.profile_id is not null and e\.profile_id <> p\.id/);
  assert.match(reconcileSql, /e\.auth_user_id is not null and e\.auth_user_id <> p\.id/);
});

test("other employee with same profile_id or auth_user_id is a conflict", () => {
  assert.match(reconcileSql, /other\.auth_user_id = p\.id/);
  assert.match(reconcileSql, /other\.profile_id = p\.id/);
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

test("usher schedule suite still has fifty-two tests", () => {
  const count = (usherTest.match(/^test\(/gm) || []).length;
  assert.strictEqual(count, 52);
});

console.log("All operational migration hardening checks passed.");
