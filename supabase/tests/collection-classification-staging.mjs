import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { File } from 'node:buffer';

const url = process.env.SUPABASE_TEST_URL;
assert.equal(url, 'https://lonpdmxdvbxuagqxztig.supabase.co', 'Staging only');
const secret = process.env.SUPABASE_TEST_SERVICE_KEY, anon = process.env.SUPABASE_TEST_ANON_KEY;
const marker = `classif-${Date.now()}`;
const users = [], museums = [];
let checks = 0;
const headers = t => ({ apikey: t === secret ? secret : anon, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });

async function api(path, body, t = secret, method = body === undefined ? 'GET' : 'POST') {
  const r = await fetch(url + path, { method, headers: { ...headers(t), Prefer: 'return=representation' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const e = Error(`HTTP ${r.status} ${path.split('?')[0]}: ${data?.message || data?.msg || data?.error || ''}`);
    e.status = r.status; e.code = data?.code; e.payload = data; throw e;
  }
  return data;
}

async function actor(museum) {
  const email = `${marker}@example.invalid`, password = `Aa!9${crypto.randomUUID()}`;
  const user = await api('/auth/v1/admin/users', { email, password, email_confirm: true });
  users.push(user);
  await api(`/rest/v1/profiles?id=eq.${user.id}`, { museum_id: museum.id, role: 'empleado', status: 'active', full_name: 'Catalogación ficticia clasificación' }, secret, 'PATCH');
  const [permission] = await api('/rest/v1/permissions?select=id&code=eq.collections.write');
  await api('/rest/v1/user_permissions', { museum_id: museum.id, user_id: user.id, permission_id: permission.id, effect: 'allow', assigned_by: user.id });
  const session = await api('/auth/v1/token?grant_type=password', { email, password }, anon);
  return session.access_token;
}

function piece(token, category, details, suffix) {
  return {
    accession_number: `TEST-${marker}-${suffix}`,
    title: `Pieza ficticia ${suffix}`,
    description: 'Descripción museográfica ficticia. Sin valor patrimonial.',
    category,
    location: 'Sala ficticia',
    condition: 'Prueba',
    status: 'ingreso',
    details
  };
}

try {
  museums.push((await api('/rest/v1/museums', { name: `PR Clasificación ficticia ${marker}`, slug: marker, active: true }))[0]);
  const token = await actor(museums[0]);
  const ctx = vm.createContext({ fetch, crypto, Blob, supabaseUrl: url, supabaseAuthHeaders: async () => headers(token) });
  vm.runInContext(fs.readFileSync(new URL('../../js/services/collections.js', import.meta.url), 'utf8'), ctx);

  for (const [category, suffix] of [['Disco de vinilo', 'vinilo'], ['Casete', 'casete'], ['8-Track', '8track']]) {
    const saved = await ctx.collectionSave(piece(token, category, { author: 'Sello ficticio' }, suffix), null, 'Registro ficticio de clasificación');
    const [reloaded] = await api(`/rest/v1/collection_items?id=eq.${saved.id}&select=category,description,details`, undefined, token);
    assert.equal(reloaded.category, category);
    assert.equal(reloaded.description, 'Descripción museográfica ficticia. Sin valor patrimonial.');
    assert.equal(reloaded.details.author, 'Sello ficticio');
    checks++;
  }

  await assert.rejects(
    () => ctx.collectionSave(piece(token, 'Objeto personal', {}, 'personal-vacio'), null, 'Debe exigir la descripción'),
    error => error.message.includes('descripción del objeto personal')
  );
  checks++;
  let personal = await ctx.collectionSave(piece(token, 'Objeto personal', { personal_object_description: 'Chaqueta de escenario', cultural_history: 'Gira ficticia' }, 'personal'), null, 'Registro ficticio de objeto personal');
  let [reloadedPersonal] = await api(`/rest/v1/collection_items?id=eq.${personal.id}&select=id,version,accession_number,title,description,category,location,condition,status,details`, undefined, token);
  assert.equal(reloadedPersonal.details.personal_object_description, 'Chaqueta de escenario');
  assert.equal(reloadedPersonal.description, 'Descripción museográfica ficticia. Sin valor patrimonial.');
  checks++;
  personal = await ctx.collectionSave({ ...reloadedPersonal, details: { ...reloadedPersonal.details, personal_object_description: 'Gafas' } }, reloadedPersonal, 'Edición ficticia del objeto personal');
  [reloadedPersonal] = await api(`/rest/v1/collection_items?id=eq.${personal.id}&select=id,version,accession_number,title,description,category,location,condition,status,details`, undefined, token);
  assert.equal(reloadedPersonal.details.personal_object_description, 'Gafas');
  checks++;
  personal = await ctx.collectionSave({ ...reloadedPersonal, category: 'Instrumento musical', details: { ...reloadedPersonal.details, personal_object_description: 'Gafas' } }, reloadedPersonal, 'Cambio ficticio de clasificación');
  [reloadedPersonal] = await api(`/rest/v1/collection_items?id=eq.${personal.id}&select=category,details`, undefined, token);
  assert.equal(reloadedPersonal.category, 'Instrumento musical');
  assert.equal(reloadedPersonal.details.personal_object_description, 'Gafas');
  checks++;

  await assert.rejects(
    () => ctx.collectionSave(piece(token, 'Otro', {}, 'otro-vacio'), null, 'Debe exigir el tipo'),
    error => error.message.includes('Especifique el tipo de objeto')
  );
  checks++;
  let other = await ctx.collectionSave(piece(token, 'Otro', { object_type_specification: 'Trofeo' }, 'otro'), null, 'Registro ficticio de otro objeto');
  let [reloadedOther] = await api(`/rest/v1/collection_items?id=eq.${other.id}&select=id,version,accession_number,title,description,category,location,condition,status,details`, undefined, token);
  assert.equal(reloadedOther.details.object_type_specification, 'Trofeo');
  checks++;
  other = await ctx.collectionSave({ ...reloadedOther, category: 'Documento', details: { ...reloadedOther.details, object_type_specification: 'Trofeo' } }, reloadedOther, 'Cambio ficticio a documento');
  [reloadedOther] = await api(`/rest/v1/collection_items?id=eq.${other.id}&select=category,details`, undefined, token);
  assert.equal(reloadedOther.category, 'Documento');
  assert.equal(reloadedOther.details.object_type_specification, 'Trofeo');
  checks++;

  await assert.rejects(
    () => ctx.collectionSave(piece(token, 'Documento', { campo_no_permitido: 'no' }, 'invalido'), null, 'Campo fuera del catálogo'),
    error => error.message.includes('dato de detalle')
  );
  checks++;

  const png = fs.readFileSync(new URL('./fixtures/collection-test.png', import.meta.url));
  let photographed = await ctx.collectionSave(piece(token, 'Fotografía', {}, 'foto'), null, 'Registro ficticio para fotografías');
  for (const caption of ['Fotografía 1', 'Fotografía 2', 'Fotografía 3', 'Fotografía 4']) {
    photographed = await ctx.collectionUpload(photographed, new File([png], `photo-${caption.slice(-1)}.png`, { type: 'image/png' }), caption);
  }
  const photos = await ctx.collectionRows('collection_active_photos', `&item_id=eq.${photographed.id}`);
  assert.equal(photos.length, 4);
  checks++;
  await assert.rejects(
    () => ctx.collectionUpload(photographed, new File([png], 'photo-5.png', { type: 'image/png' }), 'Fotografía 5'),
    error => error.message.includes('máximo de 4')
  );
  checks++;

  console.log(JSON.stringify({ result: 'PASS', checks, marker, museum: museums[0].id, production_writes: 0 }));
} finally {
  for (const user of users) await api(`/rest/v1/profiles?id=eq.${user.id}`, { status: 'inactive' }, secret, 'PATCH').catch(() => null);
  for (const museum of museums) await api(`/rest/v1/museums?id=eq.${museum.id}`, { active: false }, secret, 'PATCH').catch(() => null);
  console.log(JSON.stringify({ synthetic_profiles_disabled: users.length, isolated_test_museums: museums.map(m => m.id), patrimonial_deletes: 0 }));
}
