import assert from "node:assert/strict";

const url = process.env.SUPABASE_TEST_URL;
const anon = process.env.SUPABASE_TEST_ANON_KEY;
const service = process.env.SUPABASE_TEST_SERVICE_KEY;
if (!url || !anon || !service) throw new Error("Missing Staging test environment.");

const marker = `TEST-B1-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const serviceHeaders = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };
const createdUsers = [];
const createdEmployees = [];
let testMuseumId = "";
let failure;

async function api(path, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { response, data };
}

function requireOk(result, label) {
  assert.ok(result.response.ok, `${label}: ${result.response.status} ${JSON.stringify(result.data)}`);
  return result.data;
}

async function createUser(label) {
  const email = `${marker.toLowerCase()}-${label}@example.invalid`;
  const password = `T3st!${crypto.randomUUID()}aA`;
  const data = requireOk(await api("/auth/v1/admin/users", {
    method: "POST",
    headers: serviceHeaders,
    body: { email, password, email_confirm: true, user_metadata: { full_name: `${marker} ${label}` } }
  }), `create user ${label}`);
  createdUsers.push(data.id);
  return { id: data.id, email, password };
}

async function signIn(user) {
  const data = requireOk(await api("/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: { email: user.email, password: user.password }
  }), "sign in");
  return data.access_token;
}

async function profile(userId) {
  const rows = requireOk(await api(`/rest/v1/profiles?select=id,museum_id&id=eq.${userId}`, { headers: serviceHeaders }), "read profile");
  return rows[0];
}

async function assignRole(userId, code) {
  const roleRows = requireOk(await api(`/rest/v1/roles?select=id&code=eq.${code}`, { headers: serviceHeaders }), `read role ${code}`);
  const userProfile = await profile(userId);
  requireOk(await api("/rest/v1/user_roles", {
    method: "POST",
    headers: { ...serviceHeaders, Prefer: "resolution=merge-duplicates" },
    body: { museum_id: userProfile.museum_id, user_id: userId, role_id: roleRows[0].id, assigned_by: userId }
  }), `assign role ${code}`);
}

async function createEmployee(token, museumId, label) {
  const result = await api("/rest/v1/employees", {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: {
      museum_id: museumId,
      first_name: marker,
      last_name: label,
      position: "Prueba",
      department: "TEST-B1",
      email: `${marker.toLowerCase()}-${label.toLowerCase()}@example.invalid`,
      status: "activo"
    }
  });
  const rows = requireOk(result, `create employee ${label}`);
  createdEmployees.push(rows[0].id);
  return rows[0];
}

async function countSyntheticResidue() {
  const employeeRows = requireOk(await api(`/rest/v1/employees?select=id&department=eq.TEST-B1`, { headers: serviceHeaders }), "verify employees cleanup");
  const profileRows = requireOk(await api(`/rest/v1/profiles?select=id&email=ilike.*${encodeURIComponent(marker)}*`, { headers: serviceHeaders }), "verify profiles cleanup");
  const auditRows = requireOk(await api(`/rest/v1/audit_logs?select=id&or=(record_id.in.(${createdEmployees.join(",") || "00000000-0000-0000-0000-000000000000"}),actor_user_id.in.(${createdUsers.join(",") || "00000000-0000-0000-0000-000000000000"}))`, { headers: serviceHeaders }), "verify audit cleanup");
  const assignments = requireOk(await api("/rest/v1/app_records?select=id,payload&module=eq.calendario_ujieres", { headers: serviceHeaders }), "verify usher assignments cleanup");
  const assignmentResidue = assignments.filter((row) => JSON.stringify(row.payload || {}).includes("TEST-B1"));
  return employeeRows.length + profileRows.length + auditRows.length + assignmentResidue.length;
}

try {
  const adminA = await createUser("admin-a");
  const adminB = await createUser("admin-b");

  const museum = requireOk(await api("/rest/v1/museums", {
    method: "POST",
    headers: { ...serviceHeaders, Prefer: "return=representation" },
    body: { name: marker, slug: marker.toLowerCase(), active: true }
  }), "create isolated museum");
  testMuseumId = museum[0].id;

  requireOk(await api(`/rest/v1/profiles?id=eq.${adminB.id}`, {
    method: "PATCH",
    headers: serviceHeaders,
    body: { museum_id: testMuseumId }
  }), "move isolated profile");

  await assignRole(adminA.id, "administrador");
  await assignRole(adminB.id, "administrador");
  const tokenA = await signIn(adminA);
  const tokenB = await signIn(adminB);
  const profileA = await profile(adminA.id);
  const profileB = await profile(adminB.id);

  const employeeA = await createEmployee(tokenA, profileA.museum_id, "Empleado-A");
  await createEmployee(tokenB, profileB.museum_id, "Empleado-B");

  const ownRead = requireOk(await api(`/rest/v1/employees?select=id,profile_id,first_name,last_name,position,status&id=eq.${employeeA.id}`, {
    headers: { apikey: anon, Authorization: `Bearer ${tokenA}` }
  }), "read own museum employee");
  assert.equal(ownRead.length, 1, "administrator could not read its museum employee");

  const isolatedRead = requireOk(await api(`/rest/v1/employees?select=id&id=eq.${employeeA.id}`, {
    headers: { apikey: anon, Authorization: `Bearer ${tokenB}` }
  }), "read isolated employee");
  assert.equal(isolatedRead.length, 0, "cross-museum employee isolation failed");

  requireOk(await api(`/rest/v1/employees?id=eq.${employeeA.id}`, {
    method: "PATCH",
    headers: { apikey: anon, Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: { position: "Prueba editada" }
  }), "edit employee");

  const archived = requireOk(await api("/functions/v1/set-employee-status", {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
    body: { employee_id: employeeA.id, status: "inactivo" }
  }), "archive employee");
  assert.equal(archived.employee.status, "inactivo", "employee archive did not persist");

  const audits = requireOk(await api(`/rest/v1/audit_logs?select=action,record_id&record_id=eq.${employeeA.id}`, { headers: serviceHeaders }), "read employee audit");
  assert.ok(audits.length >= 3, "create, edit, and archive audit entries were not recorded");

  const unauthorized = await createUser("employee-no-admin");
  const unauthorizedToken = await signIn(unauthorized);
  const denied = await api("/rest/v1/employees", {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${unauthorizedToken}`, "Content-Type": "application/json" },
    body: { museum_id: (await profile(unauthorized.id)).museum_id, first_name: marker, last_name: "Denied", department: "TEST-B1", email: `${marker.toLowerCase()}-denied@example.invalid` }
  });
  assert.equal(denied.response.status, 403, "employee without permission created an employee");

  console.log(JSON.stringify({ marker, passed: true, checks: ["create", "read", "edit", "archive", "audit", "permissions", "isolation"] }));
} catch (error) {
  failure = error;
} finally {
  if (createdEmployees.length) {
    await api(`/rest/v1/audit_logs?record_id=in.(${createdEmployees.join(",")})`, { method: "DELETE", headers: serviceHeaders });
    await api(`/rest/v1/employees?id=in.(${createdEmployees.join(",")})`, { method: "DELETE", headers: serviceHeaders });
    await api(`/rest/v1/audit_logs?record_id=in.(${createdEmployees.join(",")})`, { method: "DELETE", headers: serviceHeaders });
  }
  if (createdUsers.length) {
    await api(`/rest/v1/audit_logs?actor_user_id=in.(${createdUsers.join(",")})`, { method: "DELETE", headers: serviceHeaders });
    await api(`/rest/v1/user_roles?user_id=in.(${createdUsers.join(",")})`, { method: "DELETE", headers: serviceHeaders });
    for (const userId of createdUsers) await api(`/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: serviceHeaders });
  }
  if (testMuseumId) await api(`/rest/v1/museums?id=eq.${testMuseumId}`, { method: "DELETE", headers: serviceHeaders });

  const residue = await countSyntheticResidue().catch(() => Number.POSITIVE_INFINITY);
  if (residue !== 0) failure = new Error(`TEST-B1 cleanup failed; synthetic residue count: ${residue}`);
}

if (failure) throw failure;
