import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const migration = fs.readFileSync(new URL('supabase/migrations/202610110002_marketing_equipment_inventory_create.sql', root), 'utf8');
const app = fs.readFileSync(new URL('js/app.js', root), 'utf8');
const service = fs.readFileSync(new URL('js/services/supabase.js', root), 'utf8');
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
  assert.doesNotMatch(migration, /alter policy inventory_photos_manage_update/);
  assert.match(migration, /alter policy inventory_photos_manage_delete/);
  assert.ok(migration.includes('public.can_create_inventory_photo(name)'));
  assert.ok(migration.includes('i.photo_path is null'));
});

test('A new photo needs INSERT only; a replacement still requests upsert', async () => {
  // Execute only the equipment-photo upload helpers, with a fake network.
  const start = service.indexOf('function inventoryPhotoPath(item) {');
  const end = service.indexOf('\nasync function deleteSupabaseInventoryPhoto', start);
  assert.ok(start >= 0 && end > start, 'Equipment photo upload helpers found');
  const section = service.slice(start, end);
  const requests = [];
  const calls = [];
  const ctx = vm.createContext({
    supabaseUrl: 'https://example.invalid',
    supabaseInventoryPhotosBucket: 'inventory-photos',
    supabaseAuthHeaders: async () => ({Authorization: 'Bearer fixture'}),
    fetch: async (url, opts) => {
      requests.push({url, opts});
      return {ok: true, json: async () => ({})};
    },
    inventoryRpc: async (name, body) => {calls.push({name, body}); return {id:body.p_id};},
    inventoryServiceError: () => new Error('Storage error'),
    deleteSupabaseInventoryPhoto: async () => {},
  });
  vm.runInContext(section, ctx);
  const item = {id:'asset-1', museum_id:'museum-1',version:1,photo_path:null};
  await ctx.uploadSupabaseInventoryPhoto(item, 'webp-data');
  assert.equal(requests[0].opts.headers['x-upsert'],undefined,'Initial upload should NOT require UPDATE');
  assert.equal(requests[0].opts.method,'POST');
  assert.equal(calls[0].name,'inventory_set_photo');
  await ctx.uploadSupabaseInventoryPhoto({...item, photo_path:'museum-1/asset-1/main.webp'},'new-webp-data');
  assert.equal(requests[1].opts.headers['x-upsert'],'true','Replacing existing photo preserves upsert');
});

test('An unsuccessful attachment requests cleanup only for the new unattached photo', async () => {
  const start = service.indexOf('function inventoryPhotoPath(item) {');
  const end = service.indexOf('\nasync function deleteSupabaseInventoryPhoto', start);
  assert.ok(start >= 0 && end > start, 'Equipment photo upload helpers found');
  const section = service.slice(start, end);
  const deleted = [];
  const ctx = vm.createContext({
    supabaseUrl:'https://example.invalid',supabaseInventoryPhotosBucket:'inventory-photos',
    supabaseAuthHeaders:async () => ({}),
    fetch:async () => ({ok:true,json:async () => ({})}),
    inventoryRpc:async () => {throw new Error('fixture: photo RPC fails');},
    inventoryServiceError:() => new Error('upload error'),
    deleteSupabaseInventoryPhoto:async path => {deleted.push(path);},
  });
  vm.runInContext(section,ctx);
  await assert.rejects(ctx.uploadSupabaseInventoryPhoto({id:'asset-2',museum_id:'museum-2',version:1,photo_path:null},'webp'),/photo RPC fails/);
  assert.deepEqual(deleted,['museum-2/asset-2/main.webp']);
});
