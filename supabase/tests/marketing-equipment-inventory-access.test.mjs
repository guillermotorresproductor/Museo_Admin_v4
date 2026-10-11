import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const migration = fs.readFileSync(new URL('supabase/migrations/202610110002_marketing_equipment_inventory_create.sql', root), 'utf8');
const manageFix = fs.readFileSync(new URL('supabase/migrations/202610110003_marketing_inventory_explicit_manage_allow.sql', root), 'utf8');
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
test('Any inventory viewer can attach a missing photo in their own museum', () => {
  assert.match(migration, /create or replace function public\.can_create_inventory_photo/);
  assert.match(migration, /public\.has_permission\('inventory\.photo\.attach'\)/);
  assert.match(migration, /i\.museum_id = public\.current_user_museum_id\(\)/);
  assert.match(migration, /i\.photo_path is null/);
  assert.match(migration, /s\.owner_id = auth\.uid\(\)::text/);
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

test('Mobile camera and gallery are direct controls on new and existing equipment', () => {
  const html = fs.readFileSync(new URL('inventario.html', root), 'utf8');
  const css = fs.readFileSync(new URL('css/main.css', root), 'utf8');
  const start = app.indexOf('function bindInventoryModule()');
  const end = app.indexOf('\nfunction bindCalendarModules(', start);
  const inventory = app.slice(start, end);
  assert.match(html, /<label class="field" for="inventory-photo">[\s\S]*id="inventory-photo"[^>]*accept="image\/\*,\.heic,\.heif"/);
  assert.match(html, /<label class="field" for="inventory-photo-camera">[\s\S]*id="inventory-photo-camera"[^>]*accept="image\/\*,\.heic,\.heif"[^>]*capture="environment"/);
  assert.doesNotMatch(html, /data-inventory-attach-photo|data-inventory-attach-camera|type="file"[^>]*\shidden/);
  assert.match(html, /data-inventory-list-message/);
  assert.match(inventory, /class="inventory-file-action"/);
  assert.match(inventory, /data-inventory-add-photo=/);
  assert.match(inventory, /accept="image\/\*,\.heic,\.heif"/);
  assert.match(inventory, /capture="environment"/);
  assert.match(inventory, /data-inventory-take-photo=/);
  assert.match(inventory, /list\?\.addEventListener\("change"/);
  assert.doesNotMatch(inventory, /\.click\(|pendingPhotoRecord|type="file"[^>]*hidden/);
  const ruleStart = css.indexOf('.inventory-file-action input[type="file"]');
  const ruleEnd = css.indexOf('.inventory-file-action:hover', ruleStart);
  const fileRule = css.slice(ruleStart, ruleEnd);
  assert.match(fileRule, /opacity:\s*0/);
  assert.match(fileRule, /position:\s*absolute/);
  assert.doesNotMatch(fileRule, /display:\s*none|visibility:\s*hidden/);
  assert.match(inventory, /setListMessage\("Fotografía del equipo añadida correctamente\.", "success"\)/);
  assert.match(inventory, /const canAttachInventoryPhoto = \(\) => canEditInventory\(\) \|\| hasPermission\("inventory\.photo\.attach"\)/);
  assert.match(inventory, /const canEditInventory = \(\) => hasPermission\("inventory\.manage"\)/);
  assert.match(inventory, /const canCreateInventory = \(\) => canEditInventory\(\) \|\| hasPermission\("inventory\.create"\)/);
  assert.match(inventory, /InventoryImage\.process\(file\)/);
  assert.match(inventory, /uploadSupabaseInventoryPhoto\(record, processed\.blob\)/);
});

test('Photo attachments use their own explicit, denyable permission', () => {
  assert.match(migration, /'inventory\.photo\.attach', 'Adjuntar primera fotografía/);
  assert.ok(migration.includes("requested_permission=''inventory.photo.attach'' and public.has_permission(''modules.inventory.read'')"));
  assert.match(migration, /chosen=''contenido_marketing'' and requested_permission=''inventory\.manage'' then return false/);
  assert.match(migration, /cardinality\(storage\.foldername\(object_name\)\) = 2/);
  assert.match(migration, /public\.can_manage_inventory_photo\(name\)/);
  const photoRpc = migration.slice(migration.indexOf('$marketing_inventory_photo_rpc$'));
  assert.match(photoRpc, /position\('inventory\.photo\.attach' in source_sql\) = 0/);
  assert.doesNotMatch(photoRpc, /inventory\.create/);
  assert.doesNotMatch(migration, /\b(create|drop)\s+(table|schema)\s+.*collection_items/i);
});

test('Staging SQL covers deny, ownership, museum isolation and separate capabilities', () => {
  const sql = fs.readFileSync(new URL('supabase/tests/employee-module-profiles.sql', root), 'utf8');
  for (const expectation of [
    'Marketing inherited equipment management from technical role',
    'Marketing could edit equipment',
    'Marketing could archive equipment',
    'Equipment create grant mismatch',
    'Inventory photo nested path accepted',
    'Inventory photo cross-museum path accepted',
    'Profile without inventory read can attach photos',
    'Explicit inventory photo denial ignored',
    'Explicit inventory create denial ignored',
    'Foreign equipment photo owner accepted',
    'Cross-museum equipment photo association accepted',
    'Replacement without manage accepted',
    'Explicit inventory manage allow ignored',
    'Marketing kept manage after explicit allow was removed'
  ]) {
    assert.ok(sql.includes(expectation), expectation);
  }
});

test('Marketing inventory.manage remains denied unless an active per-user allow is present', () => {
  assert.match(manageFix, /marketing_inventory_manage_explicit_allow_v1/);
  assert.match(manageFix, /requested_permission='inventory\.manage'/);
  assert.match(manageFix, /u\.user_id = auth\.uid\(\)/);
  assert.match(manageFix, /u\.museum_id = public\.current_user_museum_id\(\)/);
  assert.match(manageFix, /u\.effect = 'allow'/);
  assert.match(manageFix, /u\.valid_until is null or u\.valid_until > now\(\)/);
  assert.match(manageFix, /current_def := pg_get_functiondef\('public\.has_permission\(text\)'::regprocedure\)/);
  assert.match(manageFix, /if position\('marketing_inventory_manage_explicit_allow_v1' in current_def\) > 0 then/);
  assert.match(manageFix, /raise exception 'MARKETING_INVENTORY_RESOLVER_UNEXPECTED'/);
  assert.doesNotMatch(manageFix, /update public\.employees|update public\.profiles|collections\.write|finance\.write|insert into public\.user_permissions/i);
});


test('Permission migration matches the exact verified Staging and Production resolver formats', () => {
  const anchors = [
    "if requested_permission=''modules.''||target_module||''.read''",
    "if requested_permission = ''modules.'' || target_module || ''.read''",
    "target_module:=public.permission_module(requested_permission);",
    "target_module := public.permission_module(requested_permission);"
  ];
  for (const anchor of anchors) {
    assert.ok(migration.includes(anchor), `Missing resolver compatibility anchor: ${anchor}`);
  }
  assert.match(migration, /anchor_sql := case/);
  assert.match(migration, /pre_boundary_anchor := case/);
  assert.match(migration, /if anchor_sql is null or pre_boundary_anchor is null then/);
  assert.match(migration, /raise exception 'INVENTORY_MARKETING_PERMISSION_RESOLVER_CHANGED'/);
  assert.match(migration, /if position\('marketing_equipment_create_v1' in source_sql\) > 0 then/);
  assert.match(migration, /replace\(\s*source_sql,\s*anchor_sql,/);
  assert.match(migration, /replace\(\s*updated_sql,\s*pre_boundary_anchor,/);
});
