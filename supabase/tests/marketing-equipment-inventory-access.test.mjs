import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const migration = fs.readFileSync(new URL('supabase/migrations/202610110002_marketing_equipment_inventory_create.sql', root), 'utf8');
const app = fs.readFileSync(new URL('js/app.js', root), 'utf8');
const original = fs.readFileSync(new URL('supabase/migrations/202609180002_employee_module_profiles.sql', root), 'utf8');
const inventory = fs.readFileSync(new URL('supabase/migrations/202609020003_inventory_practical_records.sql', root), 'utf8');

test('Marketing inventory is a shared profile capability, never user-specific', () => {
  assert.match(migration, /update public\.employee_module_profiles[\s\S]*code = 'contenido_marketing'/);
  assert.match(migration, /array_append\(modules, 'inventory'\)/);
  assert.doesNotMatch(migration, /irodriguez|@museodelamusicadepr|202610110001|e\.profile_id\s*=\s*'/i);
  assert.match(original, /\('contenido_marketing','Creadora de Contenido y Marketing'/);
});
test('Only equipment inventory; museographic collections not included', () => {
  assert.doesNotMatch(migration, /collections\.write|collections\.read|collection_items|collection_photos|inventario-colecciones\.html/);
  assert.match(migration, /inventory\.create/);
  assert.doesNotMatch(migration, /insert into public\.user_permissions|insert into public\.role_permissions/i);
});
test('Creation is granted after explicit denies and module boundary', () => {
  assert.match(migration, /marketing_equipment_create_v1/);
  assert.match(migration, /if chosen=''contenido_marketing'' and requested_permission=''inventory\.create''/);
  assert.match(migration, /requested_permission=''modules\.''\|\|target_module\|\|''\.read''/);
  assert.match(migration, /replace\(source_sql, old_guard, new_guard\)/);
  assert.match(inventory, /create or replace function public\.inventory_create\(p_item jsonb\)/);
});
test('The UI permits adding but does not give Marketing edit/archive access', () => {
  assert.match(app, /const canEditInventory = \(\) => hasPermission\("inventory\.manage"\)/);
  assert.match(app, /const canCreateInventory = \(\) => canEditInventory\(\) \|\| hasPermission\("inventory\.create"\)/);
  assert.match(app, /if \(!canCreateInventory\(\) && entryPanel\)/);
  assert.match(app, /canEditInventory\(\) && !record\.archived_at/);
  assert.match(app, /String\(new FormData\(form\)\.get\("id"\)/);
});
test('New item photo insertion only for creator and initial photo', () => {
  assert.match(migration, /create or replace function public\.can_create_inventory_photo/);
  assert.match(migration, /i\.created_by = auth\.uid\(\)/);
  assert.match(migration, /i\.photo_path is null/);
  assert.match(migration, /alter policy inventory_photos_manage_insert/);
  assert.doesNotMatch(migration, /alter policy inventory_photos_manage_update|alter policy inventory_photos_manage_delete/);
});
