import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const url=process.env.SUPABASE_TEST_URL;
assert.equal(url,'https://lonpdmxdvbxuagqxztig.supabase.co','Staging only');
const anon=process.env.SUPABASE_TEST_ANON_KEY, secret=process.env.SUPABASE_TEST_SERVICE_KEY;
assert.ok(anon && secret);
const marker=`photo-level-${Date.now()}`;
const users=[], employees=[], objects=[];
let museum, token;
const headers=t=>({apikey:t===secret?secret:anon,Authorization:`Bearer ${t}`,'Content-Type':'application/json'});
async function api(path,body,t=secret,method=body===undefined?'GET':'POST') {
 const r=await fetch(url+path,{method,headers:{...headers(t),Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await r.json().catch(()=>null);
 if(!r.ok) throw Error(`${method} ${path}: ${r.status} ${JSON.stringify(data)}`);
 return data;
}
async function createUser(label,role) {
 const email=`${marker}-${label}@example.invalid`,password=`A!a7${crypto.randomUUID()}`;
 const u=await api('/auth/v1/admin/users',{email,password,email_confirm:true});users.push(u.id);
 await api(`/rest/v1/profiles?id=eq.${u.id}`,{museum_id:museum,role,status:'active'},secret,'PATCH');
 const [catalog]=await api(`/rest/v1/roles?select=id&code=eq.${role}`);
 await api('/rest/v1/user_roles',{museum_id:museum,user_id:u.id,role_id:catalog.id,assigned_by:u.id});
 return {...u,email,password};
}
const login=async u=>(await api('/auth/v1/token?grant_type=password',{email:u.email,password:u.password},anon)).access_token;
async function employee(u) {
 const [e]=await api('/rest/v1/employees',{museum_id:museum,profile_id:u.id,first_name:marker,last_name:'Synthetic',email:u.email,position:'Prueba',department:marker,status:'activo',access_level:'empleado'});
 employees.push(e.id);return e;
}
function client() {
 const c=vm.createContext({fetch,crypto,Uint8Array,atob,console,supabaseUrl:url,supabaseAuthHeaders:async()=>headers(token),employeeInitials:()=> 'TEST'});
 vm.runInContext(fs.readFileSync(new URL('../../js/services/supabase.js',import.meta.url),'utf8'),c);
 return c;
}
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6xkAAAAASUVORK5CYII=';
try {
 [museum]= (await api('/rest/v1/museums',{name:marker,slug:marker,active:true})).map(x=>x.id);
 const admin=await createUser('admin','administrador'), own=await createUser('own','empleado'), other=await createUser('other','empleado');
 const e=await employee(own), unrelated=await employee(other);
 token=await login(admin);
 let c=client();
 // Exercise the actual browser service used by RH, including durable readback.
 let model=c.employeeFromSupabase(e);model.foto=png;
 await c.saveSupabaseEmployee(model,museum,e.id);
 objects.push(model.photoReference.replace('storage:employee-photos/',''));
 let loaded=(await c.fetchSupabaseEmployees()).find(x=>x.id===e.id);
 assert.match(loaded.photoReference,/^storage:employee-photos\//);assert.match(loaded.foto,/token=/);
 let r=await fetch(loaded.foto);assert.equal(r.status,200);assert.ok((await r.arrayBuffer()).byteLength>0);
 // A new session and a new JS context cannot rely on localStorage or old URLs.
 token=await login(own);c=client();
 loaded=(await c.fetchSupabaseEmployees()).find(x=>x.id===e.id);assert.ok(loaded);
 assert.equal((await fetch(loaded.foto)).status,200);
 loaded.foto=png;await c.persistSupabaseEmployeePhoto(e.id,loaded,museum);
 objects.push(loaded.photoReference.replace('storage:employee-photos/',''));
 assert.equal((await c.fetchSupabaseEmployees()).find(x=>x.id===e.id).photoReference,loaded.photoReference);
 await assert.rejects(()=>c.persistSupabaseEmployeePhoto(unrelated.id,{foto:png},museum));
 await assert.rejects(()=>api('/rest/v1/rpc/set_employee_photo',{p_employee_id:unrelated.id,p_path:null,p_expected_photo:null},token));
 const direct=await api(`/rest/v1/employees?id=eq.${e.id}`,{photo_url:'https://example.invalid/fake.png'},token,'PATCH').catch(()=>[]);
 assert.equal(direct.length,0);
 assert.equal((await api(`/rest/v1/employees?id=eq.${e.id}&select=photo_url`))[0].photo_url,loaded.photoReference);
 await assert.rejects(()=>api('/rest/v1/rpc/set_employee_photo',{p_employee_id:e.id,p_path:null,p_expected_photo:null},token));
 const before=await api(`/rest/v1/employees?id=eq.${unrelated.id}&select=access_level,photo_url`);
 await assert.rejects(()=>c.assignSupabaseEmployeeLevel(e.id,'administrador','empleado'));
 const outsider=await createUser('outside','administrador');
 const [outsideMuseum]=await api('/rest/v1/museums',{name:marker+'-outside',slug:marker+'-outside',active:true});
 await api(`/rest/v1/profiles?id=eq.${outsider.id}`,{museum_id:outsideMuseum.id},secret,'PATCH');
 await api(`/rest/v1/user_roles?user_id=eq.${outsider.id}`,{museum_id:outsideMuseum.id},secret,'PATCH');
 token=await login(outsider);c=client();
 await assert.rejects(()=>c.persistSupabaseEmployeePhoto(e.id,{foto:png},museum));
 await assert.rejects(()=>api('/rest/v1/rpc/set_employee_photo',{p_employee_id:e.id,p_path:null,p_expected_photo:loaded.photoReference},token));
 await assert.rejects(()=>api('/storage/v1/object/sign/employee-photos/'+objects.at(-1),{expiresIn:60},token));
 await assert.rejects(()=>api('/storage/v1/object/sign/employee-photos/'+objects.at(-1),{expiresIn:60},anon));
 token=await login(admin);c=client();
 await api(`/rest/v1/employees?id=eq.${e.id}`,{email:'mismatched@example.invalid'},secret,'PATCH');
 await assert.rejects(()=>c.assignSupabaseEmployeeLevel(e.id,'administrador','empleado'));
 await api(`/rest/v1/employees?id=eq.${e.id}`,{email:own.email},secret,'PATCH');
 const assigned=await c.assignSupabaseEmployeeLevel(e.id,'administrador','empleado');assert.equal(assigned.assigned,true);
 assert.equal((await c.fetchSupabaseEmployeeLevel(e.id)).role,'administrador');
 assert.deepEqual(await api(`/rest/v1/employees?id=eq.${unrelated.id}&select=access_level,photo_url`),before);
 token=await login(own);
 const permissions=await api('/rest/v1/rpc/current_user_permissions',{},token);
 for(const permission of ['roles.assign','employees.read.all','finance.read','inventory.manage']) assert.ok(permissions.some(p=>(p.code||p)===permission),permission);
 // Ver perfil uses updateSupabaseEmployee; the saved photo survives another login.
 c=client();loaded=(await c.fetchSupabaseEmployees()).find(x=>x.id===e.id);loaded.foto=png;
 await c.updateSupabaseEmployee(e.id,loaded,museum);objects.push(loaded.photoReference.replace('storage:employee-photos/',''));
 token=await login(own);c=client();loaded=(await c.fetchSupabaseEmployees()).find(x=>x.id===e.id);
 assert.equal((await fetch(loaded.foto)).status,200);
 await assert.rejects(()=>c.persistSupabaseEmployeePhoto(e.id,{...loaded,foto:'data:image/svg+xml;base64,PHN2Zy8+'},museum));
 loaded.foto='';await c.persistSupabaseEmployeePhoto(e.id,loaded,museum);
 assert.equal((await c.fetchSupabaseEmployees()).find(x=>x.id===e.id).foto,'');
 assert.equal((await api(`/rest/v1/audit_logs?select=id&museum_id=eq.${museum}&action=eq.USER_INVITED`)).length,0);
 console.log(JSON.stringify({marker,passed:true,checks:['RH save','Ver perfil save','private read','new session','self photo','unauthorized employee denied','cross-museum write/read denied','anonymous photo read denied','direct photo write denied','stale photo denied','identity mismatch denied','level effective permissions','other employee unchanged','invalid image rejected','remove persists','zero invitations']}));
} catch(error) { console.error('TEST FAILURE:',error); throw error; }
finally {
 // Only synthetic IDs created by this run. No invitations.
 for(const path of objects) await api('/storage/v1/object/employee-photos',{prefixes:[path]},secret,'DELETE');
 for(const id of employees) await api(`/rest/v1/employees?id=eq.${id}`,undefined,secret,'DELETE');
 for(const id of users) await api(`/rest/v1/user_roles?user_id=eq.${id}`,undefined,secret,'DELETE');
 for(const id of users) {
  await api(`/rest/v1/audit_logs?actor_user_id=eq.${id}`,undefined,secret,'DELETE');
  await api(`/auth/v1/admin/users/${id}`,undefined,secret,'DELETE');
 }
 // Museum retained as a synthetic audit container; contains no login accounts.
 console.log(JSON.stringify({cleanup:'synthetic accounts and employee records removed',auditMuseum:museum}));
}
