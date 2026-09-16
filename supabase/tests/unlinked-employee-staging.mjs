import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const url = process.env.SUPABASE_TEST_URL;
assert.equal(url, 'https://lonpdmxdvbxuagqxztig.supabase.co');
const secret = process.env.SUPABASE_TEST_SERVICE_KEY, anon = process.env.SUPABASE_TEST_ANON_KEY;
const before = process.argv.includes('before'), marker = `unlinked-${Date.now()}`;
let museum, actor, employee, token;
const headers = t => ({apikey: t === secret ? secret : anon, Authorization: `Bearer ${t}`, 'Content-Type':'application/json'});
async function api(path, body, t = secret, method = body === undefined ? 'GET' : 'POST') {
  const r = await fetch(url + path, {signal:AbortSignal.timeout(30000),method, headers:{...headers(t), Prefer:'return=representation'}, body:body === undefined ? undefined : JSON.stringify(body)});
  const data = await r.json().catch(()=>null);
  if (!r.ok) throw Error(`${method} ${path}: ${r.status} ${JSON.stringify(data)}`);
  return data;
}
const captures = [];
async function capturedFetch(path, options) {
  if(path.includes('/functions/')) console.log(JSON.stringify({request:path.split('/').at(-1),action:JSON.parse(options.body).action||'assign',at:new Date().toISOString()}));
  const r = await fetch(path, {...options,signal:AbortSignal.timeout(30000)});
  if (path.includes('/functions/')) { const capture={endpoint:path.split('/').at(-1), status:r.status, body:await r.clone().json()}; captures.push(capture);console.log(JSON.stringify(capture)); }
  return r;
}
try {
  [museum] = await api('/rest/v1/museums', {name:marker, slug:marker, active:true});
  console.log(JSON.stringify({marker,museum:museum.id,stage:'fixture'}));
  const email = `${marker}@example.invalid`, password = `A!a7${crypto.randomUUID()}`;
  actor = await api('/auth/v1/admin/users', {email,password,email_confirm:true});
  console.log(JSON.stringify({actor:actor.id}));
  await api(`/rest/v1/profiles?id=eq.${actor.id}`, {museum_id:museum.id, role:'administrador', status:'active'}, secret, 'PATCH');
  const [role] = await api('/rest/v1/roles?select=id&code=eq.administrador');
  await api('/rest/v1/user_roles', {museum_id:museum.id,user_id:actor.id,role_id:role.id,assigned_by:actor.id});
  token = (await api('/auth/v1/token?grant_type=password', {email,password},anon)).access_token;
  [employee] = await api('/rest/v1/employees', {museum_id:museum.id,first_name:marker,last_name:'Synthetic',position:'Prueba',department:'Prueba',status:'activo',email:null,profile_id:null,access_level:null});
  console.log(JSON.stringify({employee:employee.id,stage:'queries'}));
  const c = vm.createContext({fetch:capturedFetch,crypto,Uint8Array,atob,console,supabaseUrl:url,supabaseAuthHeaders:async()=>headers(token),employeeInitials:()=> 'TEST'});
  vm.runInContext(fs.readFileSync(new URL('../../js/services/supabase.js',import.meta.url),'utf8'),c);
  if (before) {
    await assert.rejects(()=>c.fetchSupabaseEmployeeLevel(employee.id));
    await assert.rejects(()=>c.fetchSupabaseEmployeeAccess(employee.id));
  } else {
    const state = await c.fetchSupabaseEmployeeLevel(employee.id);
    assert.equal(state.role,null); assert.equal(state.effective_role,null);
    const access = await c.fetchSupabaseEmployeeAccess(employee.id);
    assert.equal(access.status,'incomplete_record'); assert.equal(access.can_invite,false);
    const model = c.employeeFromSupabase(employee); model.posicion='Expediente actualizado';
    await c.saveSupabaseEmployee(model,museum.id,employee.id);
    let [saved] = await api(`/rest/v1/employees?id=eq.${employee.id}`);
    assert.equal(saved.position,model.posicion); assert.equal(saved.access_level,null); assert.equal(saved.profile_id,null);
    const assigned = await c.assignSupabaseEmployeeLevel(employee.id,'empleado',null);
    assert.equal(assigned.assigned,true);
    await assert.rejects(()=>c.assignSupabaseEmployeeLevel(employee.id,'ejecutivo',null),e=>e.status===409);
    model.correo=`${marker}-employee@example.invalid`;
    await c.updateSupabaseEmployee(employee.id,model,museum.id);
    const ready = await c.fetchSupabaseEmployeeAccess(employee.id);
    assert.equal(ready.status,'no_account'); assert.equal(ready.can_invite,true);
    assert.equal((await c.fetchSupabaseEmployeeLevel(employee.id)).effective_role,null);
    // Repair is explicitly incapable of dispatching mail when Auth is absent.
    const repair = await c.inviteSupabaseEmployee(employee.id,'repair');
    assert.equal(repair.code,'invite_status_unknown');
    [saved] = await api(`/rest/v1/employees?id=eq.${employee.id}`);
    assert.equal(saved.profile_id,null); assert.equal(saved.access_level,'empleado');
    assert.equal((await api(`/rest/v1/audit_logs?museum_id=eq.${museum.id}&action=in.(USER_INVITED,USER_INVITATION_REQUESTED,USER_INVITATION_RESENT)`)).length,0);
    // A draft never bypasses authentication or roles.assign.
    const unauthorized = await fetch(url+'/functions/v1/assign-sensitive-role', {method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({employee_id:employee.id,action:'read'}),signal:AbortSignal.timeout(30000)});
    assert.equal(unauthorized.status,401);
    await api(`/rest/v1/user_roles?user_id=eq.${actor.id}`,undefined,secret,'DELETE');
    await api(`/rest/v1/profiles?id=eq.${actor.id}`,{role:'empleado'},secret,'PATCH');
    await assert.rejects(()=>c.assignSupabaseEmployeeLevel(employee.id,'administrador','empleado'),e=>e.status===403);
    assert.equal((await api(`/rest/v1/employees?id=eq.${employee.id}`))[0].access_level,'empleado');
  }
  console.log(JSON.stringify({marker,mode:before?'before':'after',captures,result:'PASS'}));
} finally {
  if (employee) await api(`/rest/v1/employees?id=eq.${employee.id}`,undefined,secret,'DELETE');
  if (actor) {
    await api(`/rest/v1/user_roles?user_id=eq.${actor.id}`,undefined,secret,'DELETE');
    await api(`/rest/v1/audit_logs?actor_user_id=eq.${actor.id}`,undefined,secret,'DELETE');
    await api(`/auth/v1/admin/users/${actor.id}`,undefined,secret,'DELETE');
  }
  console.log(JSON.stringify({cleanup:'Only this run synthetic employee and actor removed',museum:museum?.id}));
}
