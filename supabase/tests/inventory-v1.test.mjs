import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);
const imageSource = fs.readFileSync(new URL("js/inventory-image.js", root), "utf8");
const migration = fs.readFileSync(new URL("supabase/migrations/202609010001_inventory_items.sql", root), "utf8");
const html = fs.readFileSync(new URL("inventario.html", root), "utf8");
const service = fs.readFileSync(new URL("js/services/supabase.js", root), "utf8");

const sandbox = { module: { exports: {} }, exports: {} };
vm.runInNewContext(imageSource, sandbox);
const image = sandbox.module.exports;

test("acepta formatos de entrada y rechaza archivos mayores de 10 MB", () => {
  for (const type of ["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"]) {
    assert.equal(image.validateFile({ name: `foto.${type.split("/")[1]}`, type, size: 1024 }), true);
  }
  assert.throws(() => image.validateFile({ name: "foto.jpg", type: "image/jpeg", size: 10 * 1024 * 1024 + 1 }), /10 MB/);
  assert.throws(() => image.validateFile({ name: "foto.gif", type: "image/gif", size: 1024 }), /JPG, PNG, HEIC o WebP/);
});

test("expone los límites de procesamiento requeridos", () => {
  assert.equal(image.limits.MIN_WIDTH, 800);
  assert.equal(image.limits.MIN_HEIGHT, 600);
  assert.equal(image.limits.MAX_DIMENSION, 1600);
  assert.equal(image.limits.MAX_OUTPUT_BYTES, 500 * 1024);
});

test("la migración impone unicidad, un equipo por fila y archivo lógico", () => {
  assert.match(migration, /unique index inventory_items_museum_asset_tag_unique/i);
  assert.match(migration, /unique index inventory_items_museum_serial_unique/i);
  assert.match(migration, /quantity = 1/i);
  assert.match(migration, /cannot be deleted; archive/i);
  assert.match(migration, /inventory_archive\(p_id uuid, p_expected_version bigint\)/i);
});

test("la migración exige museo, permiso y versión para escribir", () => {
  assert.match(migration, /museum_id = public\.current_user_museum_id\(\)/i);
  assert.match(migration, /has_permission\('inventory\.manage'\)/i);
  assert.match(migration, /version = p_expected_version/i);
  assert.match(migration, /revoke all on public\.inventory_items from anon, authenticated/i);
});

test("la auditoría cubre los eventos solicitados", () => {
  for (const action of ["INVENTORY_CREATED", "INVENTORY_EDITED", "INVENTORY_LOCATION_CHANGED", "INVENTORY_RESPONSIBLE_CHANGED", "INVENTORY_CONDITION_CHANGED", "INVENTORY_ARCHIVED"]) {
    assert.match(migration, new RegExp(action));
  }
});

test("la fotografía usa bucket privado, ruta final y URL firmada sin base64", () => {
  assert.match(migration, /'inventory-photos', 'inventory-photos', false/i);
  assert.match(migration, /storage\.filename\(name\) = 'main\.webp'/i);
  assert.match(service, /object\/sign\/\$\{supabaseInventoryPhotosBucket\}/);
  assert.match(service, /\$\{item\.museum_id\}\/\$\{item\.id\}\/main\.webp/);
  assert.doesNotMatch(service, /readAsDataURL|base64/i);
});

test("la página mantiene el módulo aislado y carga el procesador WebP", () => {
  assert.match(html, /id="inventory-form"/);
  assert.match(html, /js\/inventory-image\.js/);
  assert.match(html, /data-inventory-show-archived/);
  assert.doesNotMatch(html, /Instituva_App/i);
});
