import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../../js/app.js", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("../../js/services/supabase.js", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../../ruta-digital.html", import.meta.url), "utf8");

test("los tres flujos de Mantenimiento usan maintenance_tasks", () => {
  assert.match(service, /fetchSupabaseMaintenanceTasks/);
  assert.match(service, /saveSupabaseMaintenanceTask/);
  assert.match(service, /archiveSupabaseMaintenanceTask/);
  for (const type of ["work", "material_request", "route_inspection"]) assert.match(app, new RegExp(type));
  assert.match(route, /data-route-history/);
  assert.doesNotMatch(route, /Juan Pérez|01\/07\/2026/);
  assert.match(app, /No hay inspecciones registradas/);
});

test("Mantenimiento conserva permiso propio y compatibilidad administrativa limitada", () => {
  assert.match(app, /hasPermission\("maintenance\.manage"\) \|\| hasAdministrativeWorkspaceAccess\(\)/);
  assert.doesNotMatch(app, /maintenance\.manage[^\n]+finance/);
});
