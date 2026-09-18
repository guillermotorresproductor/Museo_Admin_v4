// Explicit staging-only integration test. Creates two disposable accounts; sends no email.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
const ref='lonpdmxdvbxuagqxztig',url=`https://${ref}.supabase.co`;
const secret=process.env.MODULE_TEST_SERVICE_KEY,anon=process.env.MODULE_TEST_ANON_KEY;
if(!secret||!anon)throw Error('Staging API keys required in process environment');
const users=[],employees=[];
const all=['personal','collections','calendar','rentals','memberships','ushers','maintenance','documents','administration','announcements','inventory'];
const matrix={mantenimiento:['personal','calendar','maintenance','announcements'],
 gerente_museografica:['personal','collections','calendar','ushers','documents','announcements'],
 contenido_marketing:['personal','calendar','ushers','documents','announcements'],
 coordinadora_experiencia:['personal','calendar','ushers','documents','announcements'],
 tecnico_produccion:['personal','calendar','ushers','documents','announcements','inventory'],
 asistente_administrativa:all,director_ejecutivo:all,administrador_general:all,gerente_administrativo:all,it_programador:all};
async function request(path,method='GET',body,token=secret,key=secret,allowError=false){
 const response=await fetch(url+path,{method,headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
 const raw=await response.text();let data;try{data=JSON.parse(raw);}catch{data=raw;}
 if(!response.ok&&!allowError)throw Error(`${method} ${path.split('?')[0]} HTTP ${response.status}: ${data?.message||data?.error||'request failed'}`);
 return {status:response.status,data};
}
async function create(label){
 const email=`module-profile-${label}-${randomBytes(7).toString('hex')}@example.invalid`,password=randomBytes(30).toString('base64url');
 const {data}=await request('/auth/v1/admin/users','POST',{email,password,email_confirm:true,user_metadata:{full_name:'TEST module profiles '+label}});
 users.push(data.id);return {id:data.id,email,password};
}
async function login(user){return (await request('/auth/v1/token?grant_type=password','POST',{email:user.email,password:user.password},anon,anon)).data;}
try{
 const actor=await create('actor'),target=await create('target');
 const profile=(await request('/rest/v1/profiles?select=museum_id&id=eq.'+actor.id)).data[0];
 await request('/rest/v1/profiles?id=eq.'+actor.id,'PATCH',{role:'administrador'});
 const role=(await request('/rest/v1/roles?select=id&code=eq.administrador')).data[0];
 await request('/rest/v1/user_roles','POST',{museum_id:profile.museum_id,user_id:actor.id,role_id:role.id});
 const employee=(await request('/rest/v1/employees','POST',{museum_id:profile.museum_id,profile_id:target.id,email:target.email,first_name:'TEST module profiles',last_name:'Disposable',access_level:'empleado',status:'activo'})).data[0];
 employees.push(employee.id);
 const admin=await login(actor);
 let expected='empleado';
 for(const [code,modules] of Object.entries(matrix)){
  const assigned=(await request('/functions/v1/assign-sensitive-role','POST',{employee_id:employee.id,role_code:code,expected_role:expected},admin.access_token,anon)).data;
  assert.equal(assigned.assigned,true);assert.equal(assigned.role,code);expected=code;
  const read=(await request('/functions/v1/assign-sensitive-role','POST',{action:'read',employee_id:employee.id},admin.access_token,anon)).data;
  assert.equal(read.role,code);assert.equal(read.effective_role,'empleado');
  const session=await login(target);
  const permissions=(await request('/rest/v1/rpc/current_user_permissions','POST',{},session.access_token,anon)).data.map(p=>typeof p==='string'?p:p.code);
  assert.deepEqual(permissions.filter(p=>p.startsWith('modules.')).sort(),modules.map(m=>`modules.${m}.read`).sort());
  for(const privileged of ['roles.assign','users.invite','inventory.manage','usher.schedule.manage','finance.write'])assert.ok(!permissions.includes(privileged),privileged);
  const saved=(await request('/rest/v1/employees?select=access_profile,access_level&id=eq.'+employee.id,'GET',undefined,session.access_token,anon)).data[0];
  assert.equal(saved.access_profile,code);assert.equal(saved.access_level,'empleado');
  const denied=await request('/functions/v1/assign-sensitive-role','POST',{employee_id:employee.id,role_code:'it_programador',expected_role:code},session.access_token,anon,true);
  assert.equal(denied.status,403);
  await request('/auth/v1/logout','POST',{},session.access_token,anon);
  console.log(`PASS ${code}: save, server read, fresh login, exact permissions, no self-escalation`);
 }
 console.log('PASS real staging authentication for all ten profiles; no invitation or mail endpoint called.');
} catch(error) { console.error('Integration failure:',error.message); throw error; }
finally {
 for(const id of employees)await request('/rest/v1/employees?id=eq.'+id,'DELETE');
 for(const id of users){
  // Retain test audit history while releasing the FK to this disposable identity.
  await request('/rest/v1/audit_logs?actor_user_id=eq.'+id,'PATCH',{actor_user_id:null});
  await request('/auth/v1/admin/users/'+id,'DELETE');
 }
 console.log('Disposable staging accounts and employee removed.');
}
