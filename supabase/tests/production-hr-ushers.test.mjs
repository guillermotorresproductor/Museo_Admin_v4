import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../../js/app.js", import.meta.url), "utf8");
const service = await readFile(new URL("../../js/services/supabase.js", import.meta.url), "utf8");
const invite = await readFile(new URL("../functions/invite-employee/index.ts", import.meta.url), "utf8");
const deactivate = await readFile(new URL("../functions/deactivate-user-access/index.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../migrations/202609030006_employee_profile_identity_production.sql", import.meta.url), "utf8");
const photoGuardMigration = await readFile(new URL("../migrations/202609030007_employee_legacy_photo_update_guard.sql", import.meta.url), "utf8");
const hrPage = await readFile(new URL("../../recursos-humanos.html", import.meta.url), "utf8");
const ushersPage = await readFile(new URL("../../ujieres.html", import.meta.url), "utf8");

assert.match(app, /museoEnvironmentName === "staging"[\s\S]*source: "demo"/);
assert.match(app, /No hay empleados registrados\./);
assert.match(app, /No se muestran datos locales\./);
assert.doesNotMatch(app, /SE MUESTRA EL DIRECTORIO LOCAL/);
assert.match(service, /select=id,profile_id,access_level,first_name/);
assert.doesNotMatch(service, /select=id,auth_user_id/);
assert.match(invite, /\.is\("profile_id", null\)/);
assert.match(invite, /roleError\?\.code === "PGRST205"/);
assert.match(invite, /LEGACY_RBAC_PROFILE_ROLE/);
assert.match(invite, /if \(roleError \|\| !role\) throw/);
assert.match(invite, /admin\.from\("user_roles"\)\.upsert/);
assert.match(deactivate, /from\("profiles"\)\.update\(\{ status: "suspended" \}\)\.eq\("id", userId\)/);
assert.match(migration, /profile_id = auth\.uid\(\)/);
assert.match(migration, /museum_id, user_id, action, table_name/);
assert.match(migration, /drop trigger if exists employees_audit[\s\S]*create trigger employees_audit/);
assert.doesNotMatch(migration, /\b(insert|update|delete)\s+(into\s+|from\s+)?public\.employees\b/i);
assert.match(photoGuardMigration, /new\.photo_url is distinct from old\.photo_url and new\.photo_url like 'data:%'/);
assert.match(hrPage, /js\/app\.js\?v=hr-production-20260903/);
assert.match(ushersPage, /js\/app\.js\?v=hr-production-20260903/);

console.log("Production HR and ushers checks passed.");
