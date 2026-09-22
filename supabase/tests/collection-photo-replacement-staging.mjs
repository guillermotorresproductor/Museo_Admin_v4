import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { File } from 'node:buffer';
import http from 'node:http';

const url = process.env.SUPABASE_TEST_URL;
assert.equal(url, 'https://lonpdmxdvbxuagqxztig.supabase.co', 'Staging only');
const secret = process.env.SUPABASE_TEST_SERVICE_KEY, anon = process.env.SUPABASE_TEST_ANON_KEY;
assert(secret && anon, 'Staging credentials required');
const marker = `photo-replacement-${Date.now()}`, users = [], museums = [];
let checks = 0, requests = 0;
const headers = token => ({ apikey: token === secret ? secret : anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
async function api(path, body, token = secret, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(url + path, { method, headers: { ...headers(token), Prefer: 'return=representation' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json().catch(() => null);
  if (!response.ok) { const error = Error(`HTTP ${response.status}: ${data?.message || data?.error || path.split('?')[0]}`); error.status = response.status; throw error; }
  return data;
}
async function actor(museum, suffix, permission) {
  const email = `${marker}-${suffix}@example.invalid`, password = `Aa!9${crypto.randomUUID()}`;
  const user = await api('/auth/v1/admin/users', { email, password, email_confirm: true }); users.push(user);
  await api(`/rest/v1/profiles?id=eq.${user.id}`, { museum_id: museum.id, role: 'empleado', status: 'active', full_name: `Prueba sustitución ${suffix}` }, secret, 'PATCH');
  const [p] = await api(`/rest/v1/permissions?select=id&code=eq.${permission}`);
  await api('/rest/v1/user_permissions', { museum_id: museum.id, user_id: user.id, permission_id: p.id, effect: 'allow', assigned_by: user.id });
  const session = await api('/auth/v1/token?grant_type=password', { email, password }, anon);
  return { token: session.access_token, user };
}
const fixture = (path, name, type) => new File([fs.readFileSync(new URL(path, import.meta.url))], name, { type });
const images = [fixture('../../images/logo-horizontal.jpg', 'test.jpg', 'image/jpeg'), fixture('./fixtures/collection-test.png', 'test.png', 'image/png'), fixture('../../assets/rentals/anfiteatro-concierto-vista-general.webp', 'test.webp', 'image/webp')];
const apple = new Uint8Array(4096); apple.set([0, 5, 0x16, 7, 0, 2, 0, 0]);
async function download(path, token) {
  const response = await fetch(`${url}/storage/v1/object/authenticated/collection-photos/${path}`, { headers: headers(token) });
  assert.equal(response.status, 200); return Buffer.from(await response.arrayBuffer());
}
try {
  for (const suffix of ['museum', 'foreign']) museums.push((await api('/rest/v1/museums', { name: `Prueba controlada ${marker}-${suffix}`, slug: `${marker}-${suffix}`, active: true }))[0]);
  const writer = await actor(museums[0], 'writer', 'collections.write');
  const reader = await actor(museums[0], 'reader', 'collections.read');
  const foreign = await actor(museums[1], 'foreign', 'collections.write');
  const c = vm.createContext({ fetch: (...args) => { requests++; return fetch(...args); }, crypto, Blob, Uint8Array, supabaseUrl: url, supabaseAuthHeaders: async () => headers(writer.token) });
  vm.runInContext(fs.readFileSync(new URL('../../js/services/collections.js', import.meta.url), 'utf8'), c);
  let item = await c.collectionSave({ accession_number: `TEST-${marker}`, title: 'Prueba de sustitución — NO patrimonial', description: 'Fixture aislado de staging.', category: 'Fotografía', location: 'Prueba', condition: 'Prueba', status: 'ingreso', details: {} }, null, 'Registro ficticio de prueba');
  // Simulate an existing historical invalid object ONLY in this synthetic staging piece.
  const oldId = crypto.randomUUID(), oldPath = `${item.museum_id}/${item.id}/${oldId}.jpg`;
  const uploaded = await fetch(`${url}/storage/v1/object/collection-photos/${oldPath}`, { method: 'POST', headers: { ...headers(writer.token), 'Content-Type': 'image/jpeg', 'x-upsert': 'false' }, body: apple });
  assert(uploaded.ok);
  item = await api('/rest/v1/rpc/collection_attach_photo', { p_id: item.id, p_expected_version: item.version, p_photo_id: oldId, p_path: oldPath, p_caption: 'Evidencia ficticia original' }, writer.token);
  for (let n = 0; n < 3; n++) item = await c.collectionUpload(item, images[1], 'Otra foto activa ficticia');
  const [original] = await c.collectionRows('collection_photos', `&id=eq.${oldId}`);
  const initialHistory = await c.collectionHistory(item.id);
  for (const invalid of [new File([apple], 'fake.jpg', { type: 'image/jpeg' }), new File(['not a photo'], 'fake.jpg', { type: 'image/jpeg' }), new File([new Uint8Array(10485761)], 'large.jpg', { type: 'image/jpeg' })]) {
    const before = requests;
    await assert.rejects(c.collectionReplacePhoto(item, original, invalid, 'Archivo inválido o corrupto'));
    assert.equal(requests, before, 'No upload or RPC for invalid selection'); checks++;
  }
  assert.deepEqual(await c.collectionHistory(item.id), initialHistory); checks++;
  let previous = original;
  for (const image of images) {
    const previousBytes = await download(previous.path, writer.token);
    item = await c.collectionReplacePhoto(item, previous, image, 'Archivo inválido o corrupto');
    const [replacement] = await api(`/rest/v1/collection_photo_replacements?old_photo_id=eq.${previous.id}`, undefined, writer.token);
    const [next] = await c.collectionRows('collection_photos', `&id=eq.${replacement.new_photo_id}`);
    assert.notEqual(next.id, previous.id); assert.notEqual(next.path, previous.path);
    assert.equal(replacement.created_by, writer.user.id); assert(replacement.created_at);
    assert.equal(replacement.reason, 'Archivo inválido o corrupto');
    assert.equal(next.caption, original.caption);
    assert.deepEqual(await download(next.path, writer.token), Buffer.from(await image.arrayBuffer()));
    assert.deepEqual(await download(previous.path, writer.token), previousBytes);
    const active = await c.collectionRows('collection_active_photos', `&item_id=eq.${item.id}`);
    assert.equal(active.length, 4); assert(active.some(p => p.id === next.id)); assert(!active.some(p => p.id === previous.id));
    const history = await c.collectionHistory(item.id);
    assert(history.some(h => h.action === 'sustitucion_fotografia' && h.before_value.path === previous.path && h.after_value.path === next.path && h.actor_id === writer.user.id));
    previous = next; checks++;
  }
  assert.deepEqual((await c.collectionRows('collection_photos', `&id=eq.${oldId}`))[0], original); checks++;
  assert.deepEqual(await download(oldPath, writer.token), Buffer.from(apple)); checks++;
  const staged = await c.collectionStorePhoto(item, images[1]);
  const replacementPayload = { p_id: item.id, p_expected_version: item.version, p_old_photo_id: previous.id, p_photo_id: staged.id, p_path: staged.path, p_reason: 'Archivo inválido o corrupto' };
  for (const token of [reader.token, foreign.token, anon]) {
    await assert.rejects(api('/rest/v1/rpc/collection_replace_photo', replacementPayload, token), e => e.status === 401 || e.status === 403); checks++;
  }
  assert.equal((await api(`/rest/v1/collection_active_photos?item_id=eq.${item.id}`, undefined, foreign.token)).length, 0); checks++;
  await assert.rejects(api('/rest/v1/rpc/collection_replace_photo', { ...replacementPayload, p_old_photo_id: original.id }, writer.token)); checks++;
  await assert.rejects(api('/rest/v1/rpc/collection_replace_photo', { ...replacementPayload, p_expected_version: item.version - 1 }, writer.token)); checks++;
  await assert.rejects(api('/rest/v1/rpc/collection_replace_photo', { ...replacementPayload, p_reason: '' }, writer.token)); checks++;
  await assert.rejects(api('/rest/v1/rpc/collection_attach_photo', { p_id: item.id, p_expected_version: item.version, p_photo_id: staged.id, p_path: staged.path, p_caption: '' }, writer.token)); checks++;
  for (const table of ['collection_photos', 'collection_photo_replacements', 'collection_history']) {
    await assert.rejects(api(`/rest/v1/${table}?item_id=eq.${item.id}`, { item_id: item.id }, writer.token, 'PATCH')); checks++;
  }
  const bucket = await api('/storage/v1/bucket/collection-photos'); assert.equal(bucket.public, false); checks++;
  console.log(JSON.stringify({ result: 'PASS', checks, piece: item.id, active_photos: 4, total_photo_records: 7, replacements: 3, production_writes: 0, deleted_objects: 0 }));
  if (process.argv.includes('--ui')) {
    // Read-only local UI review of this synthetic fixture; no session credentials in the browser.
    let finish;
    const finished = new Promise(resolve => { finish = resolve; });
    const allowedFiles = ['css/main.css', 'css/collections.css', 'js/services/collections.js', 'js/collections.js', 'js/vendor/qrcode-1.4.4.js'];
    const server = http.createServer(async (request, response) => {
      try {
        const target = new URL(request.url, 'http://127.0.0.1');
        if (request.method !== 'GET') { response.writeHead(405); response.end('Read-only test'); return; }
        if (target.pathname === '/__finish') { response.end('Prueba finalizada.'); finish(); return; }
        if (target.pathname === '/inventario-colecciones.html') {
          let html = fs.readFileSync(new URL('../../inventario-colecciones.html', import.meta.url), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
          const bootstrap = `<script>const museoEnvironment={name:'staging'};const supabaseUrl=location.origin+'/staging';const supabaseAuthHeaders=async()=>({});const canWriteCollections=()=>true;const hasPermission=p=>p==='collections.write';const safeHtml=s=>String(s).replace(/[&<>\x22']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\x22':'&quot;',"'":'&#39;'}[c]));</script><script src="/js/services/collections.js"></script><script src="/js/vendor/qrcode-1.4.4.js"></script><script src="/js/collections.js"></script><script>bindCollectionsCatalog();</script><a href="/__finish">Terminar prueba local</a>`;
          response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html.replace('</body>', bootstrap + '</body>')); return;
        }
        if (target.pathname.startsWith('/staging/')) {
          const upstream = new URL(target.pathname.slice('/staging'.length) + target.search, url);
          const table = upstream.pathname.split('/').pop();
          if (upstream.pathname.startsWith('/rest/v1/') && ['collection_items', 'collection_active_photos', 'collection_history'].includes(table)) {
            upstream.searchParams.set(table === 'collection_items' ? 'id' : 'item_id', `eq.${item.id}`);
          } else if (!upstream.pathname.startsWith(`/storage/v1/object/authenticated/collection-photos/${item.museum_id}/${item.id}/`)) {
            response.writeHead(403); response.end(); return;
          }
          const result = await fetch(upstream, { headers: headers(writer.token) });
          response.writeHead(result.status, { 'Content-Type': result.headers.get('content-type') || 'application/octet-stream' });
          response.end(Buffer.from(await result.arrayBuffer())); return;
        }
        const path = target.pathname.slice(1);
        if (!allowedFiles.includes(path)) { response.writeHead(404); response.end(); return; }
        response.setHeader('Content-Type', path.endsWith('.css') ? 'text/css' : 'application/javascript');
        response.end(fs.readFileSync(new URL('../../' + path, import.meta.url)));
      } catch { response.writeHead(500); response.end('Local test failed'); }
    });
    await new Promise(resolve => server.listen(8876, '127.0.0.1', resolve));
    console.log(JSON.stringify({ ui: `http://127.0.0.1:8876/inventario-colecciones.html?pieza=${item.id}`, mode: 'staging fixture, read-only proxy' }));
    const timeout = setTimeout(finish, 600000);
    await finished; clearTimeout(timeout); server.close();
  }
} finally {
  for (const user of users) await api(`/rest/v1/profiles?id=eq.${user.id}`, { status: 'inactive' }, secret, 'PATCH');
  for (const museum of museums) await api(`/rest/v1/museums?id=eq.${museum.id}`, { active: false }, secret, 'PATCH');
  console.log(JSON.stringify({ disabled_test_users: users.length, disabled_test_museums: museums.length, historical_deletes: 0 }));
}
