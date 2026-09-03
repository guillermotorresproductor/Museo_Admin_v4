import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../../js/app.js", import.meta.url), "utf8");
const service = await readFile(new URL("../../js/services/supabase.js", import.meta.url), "utf8");
const invite = await readFile(new URL("../functions/invite-employee/index.ts", import.meta.url), "utf8");
const deactivate = await readFile(new URL("../functions/deactivate-user-access/index.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../migrations/202609030006_employee_profile_identity_production.sql", import.meta.url), "utf8");

assert.match(app, /museoEnvironmentName === "staging"[\s\S]*source: "demo"/);
assert.match(app, /No hay empleados registrados\./);
assert.match(app, /No se muestran datos locales\./);
assert.doesNotMatch(app, /SE MUESTRA EL DIRECTORIO LOCAL/);
assert.match(service, /select=id,profile_id,first_name/);
assert.doesNotMatch(service, /select=id,auth_user_id/);
assert.match(invite, /\.is\("profile_id", null\)/);
assert.match(deactivate, /\.eq\("profile_id", userId\)/);
assert.match(migration, /profile_id = auth\.uid\(\)/);
assert.match(migration, /museum_id, user_id, action, table_name/);
assert.match(migration, /matching_employees = 1[\s\S]*position = 'Administrador General'/);
assert.match(migration, /drop trigger if exists employees_audit[\s\S]*jsonb_build_object\('position', previous_position\)[\s\S]*create trigger employees_audit/);
assert.doesNotMatch(migration, /\b(insert|delete)\s+(into\s+|from\s+)?public\.employees\b/i);

console.log("Production HR and ushers checks passed.");
