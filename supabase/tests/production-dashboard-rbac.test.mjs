import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const app = fs.readFileSync(new URL("js/app.js", root), "utf8");
const dashboard = fs.readFileSync(new URL("dashboard.html", root), "utf8");
const migration = fs.readFileSync(
  new URL("supabase/migrations/202609030005_current_user_permissions_production_fix.sql", root),
  "utf8"
);

const modules = [
  ["departamento-museologico.html", "system.configure"],
  ["calendario.html", "calendar.manage"],
  ["renta-espacios.html", "rentals.manage"],
  ["membresias.html", "memberships.manage"],
  ["ujieres.html", "usher.schedule.manage"],
  ["mantenimiento.html", "system.configure"],
  ["documentos.html", "system.configure"],
  ["administracion.html", "system.configure"],
  ["boletin.html", "announcements.read"],
  ["inventario.html", "inventory.manage"]
];

test("Dashboard reutiliza módulos y permisos canónicos", () => {
  for (const [href, permission] of modules) {
    assert.match(dashboard, new RegExp(`href=["']${href.replace(".", "\\.")}["']`));
    assert.match(app, new RegExp(permission.replaceAll(".", "\\.")));
    assert.match(migration, new RegExp(permission.replaceAll(".", "\\.")));
  }
});

test("el filtrado usa una sola matriz RBAC para Dashboard y sidebar", () => {
  assert.match(app, /const moduleAccessChecks = \{/);
  assert.match(app, /moduleAccessChecks\[item\.href\]/);
  assert.match(app, /moduleAccessChecks\[href\]/);
});

test("Dirección Ejecutiva y Finanzas conservan controles independientes", () => {
  assert.match(app, /"finanzas\.html": \(\) => hasPermission\("finance\.read"\)/);
  assert.match(app, /"direccion-ejecutiva\.html": \(\) => hasPermission\("executive\.case\.read"\)/);
  const executiveLegacy = migration.match(/when v_role='ejecutivo'[\s\S]*?when v_role='finanzas'/)?.[0] || "";
  assert.doesNotMatch(executiveLegacy, /finance\.read|executive\.case\.read/);
});

test("la migración preserva denegaciones explícitas y no toca datos funcionales", () => {
  assert.match(migration, /up\.effect='deny'/);
  assert.doesNotMatch(migration, /\b(update|delete)\s+(public\.)?(profiles|employees|inventory_items|auth\.)/i);
});
