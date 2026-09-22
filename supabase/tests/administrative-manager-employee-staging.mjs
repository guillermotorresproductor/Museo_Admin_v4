// Real Auth + PostgREST regression, strictly limited to disposable staging data.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const url = 'https://lonpdmxdvbxuagqxztig.supabase.co';
const service = process.env.MODULE_TEST_SERVICE_KEY;
const anon = process.env.MODULE_TEST_ANON_KEY;
assert.ok(service && anon, 'Staging keys required');
const marker = `hr-manager-${randomUUID()}`;
const employeeIds = [];
let actor, museum, otherMuseum;
async function request(path, method = 'GET', body, token = service, allowError = false) {
  const response = await fetch(url + path, {
    method, signal: AbortSignal.timeout(30000),
    headers: { apikey: token === service ? service : anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok && !allowError) throw Error(`${method} ${path.split('?')[0]}: ${response.status} ${data?.message || data?.error || ''}`);
  return { status: response.status, data };
}
try {
  museum = (await request('/rest/v1/museums', 'POST', { name: marker, slug: marker, active: true })).data[0];
  otherMuseum = (await request('/rest/v1/museums', 'POST', { name: marker + '-other', slug: marker + '-other', active: true })).data[0];
  const email = `${marker}@example.invalid`, password = `Aa7!${randomUUID()}`;
  actor = (await request('/auth/v1/admin/users', 'POST', { email, password, email_confirm: true })).data;
  await request(`/rest/v1/profiles?id=eq.${actor.id}`, 'PATCH', { museum_id: museum.id, role: 'ejecutivo', status: 'active' });
  const employee = (await request('/rest/v1/employees', 'POST', { museum_id: museum.id, profile_id: actor.id, first_name: marker, last_name: 'Manager', access_profile: 'gerente_administrativo', access_level: 'ejecutivo', status: 'activo' })).data[0];
  employeeIds.push(employee.id);
  const login = async () => (await request('/auth/v1/token?grant_type=password', 'POST', { email, password }, anon)).data.access_token;
  let token = await login();
  const permissions = async () => (await request('/rest/v1/rpc/current_user_permissions', 'POST', {}, token)).data.map(p => typeof p === 'string' ? p : p.code);
  const allowed = await permissions();
  for (const permission of ['employees.read.all', 'employees.create', 'employees.update.basic', 'employees.update.employment', 'employees.deactivate']) assert.ok(allowed.includes(permission), permission);
  for (const permission of ['roles.assign', 'system.configure', 'users.manage', 'finance.write']) assert.ok(!allowed.includes(permission), `Must not grant ${permission}`);
  console.log('PASS effective employee permissions without general administrator permissions');
  const payload = { museum_id: museum.id, first_name: marker, last_name: 'Created', profile_id: null, access_level: null, status: 'activo' };
  const created = (await request('/rest/v1/employees', 'POST', payload, token)).data[0];
  employeeIds.push(created.id);
  assert.equal(created.museum_id, museum.id);
  assert.equal(created.profile_id, null);
  assert.equal(created.access_level, null);
  token = await login();
  const saved = (await request(`/rest/v1/employees?id=eq.${created.id}`, 'GET', undefined, token)).data[0];
  assert.equal(saved.last_name, 'Created');
  console.log('PASS real authorized employee insert and retrieval after fresh login');
  const crossMuseum = await request('/rest/v1/employees', 'POST', { ...payload, museum_id: otherMuseum.id }, token, true);
  assert.equal(crossMuseum.status, 403);
  const privileged = await request('/functions/v1/assign-sensitive-role', 'POST', { employee_id: created.id, role_code: 'administrador', expected_role: null }, token, true);
  assert.equal(privileged.status, 403);
  console.log('PASS cross-museum creation and privileged role assignment rejected');
  const permission = (await request('/rest/v1/permissions?select=id&code=eq.employees.create')).data[0];
  await request('/rest/v1/user_permissions', 'POST', { museum_id: museum.id, user_id: actor.id, permission_id: permission.id, effect: 'deny' });
  assert.ok(!(await permissions()).includes('employees.create'));
  const denied = await request('/rest/v1/employees', 'POST', payload, token, true);
  assert.equal(denied.status, 403);
  console.log('PASS explicit deny overrides category and rejects insert');
} finally {
  for (const id of employeeIds.reverse()) await request(`/rest/v1/employees?id=eq.${id}`, 'DELETE');
  if (actor) {
    await request(`/rest/v1/user_permissions?user_id=eq.${actor.id}`, 'DELETE');
    // Test-only museums isolate audit cleanup from all real records.
    if (museum) await request(`/rest/v1/audit_logs?museum_id=eq.${museum.id}`, 'DELETE');
    await request(`/auth/v1/admin/users/${actor.id}`, 'DELETE');
  }
  for (const item of [otherMuseum, museum]) if (item) await request(`/rest/v1/museums?id=eq.${item.id}`, 'DELETE');
  console.log('Disposable staging fixtures removed; no production data created');
}
