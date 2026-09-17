import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const url=process.env.SUPABASE_TEST_URL;
assert.equal(url,'https://lonpdmxdvbxuagqxztig.supabase.co','Staging only');
if(process.argv.includes('ui') && !process.stdin.isTTY) throw Error('UI review requires an interactive terminal (tty=true) so Enter can close the session and deactivate fixtures.');
const secret=process.env.SUPABASE_TEST_SERVICE_KEY,anon=process.env.SUPABASE_TEST_ANON_KEY;
const marker=`collections-${Date.now()}`; const users=[],museums=[]; let checks=0;
const headers=t=>({apikey:t===secret?secret:anon,Authorization:`Bearer ${t}`,'Content-Type':'application/json'});
async function api(path,body,t=secret,method=body===undefined?'GET':'POST') {
 const r=await fetch(url+path,{method,headers:{...headers(t),Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 const data=await r.json().catch(()=>null); if(!r.ok) {const e=Error(`HTTP ${r.status} ${path.split('?')[0]}: ${data?.message||data?.msg||data?.error||''}`); e.status=r.status;e.code=data?.code;throw e;} return data;
}
async function deny(fn){await assert.rejects(fn);checks++;}
async function actor(museum,suffix,permissions) {
 const email=`${marker}-${suffix}@example.invalid`,password=`Aa!9${crypto.randomUUID()}`;
 const user=await api('/auth/v1/admin/users',{email,password,email_confirm:true});users.push(user);
 await api(`/rest/v1/profiles?id=eq.${user.id}`,{museum_id:museum.id,role:'empleado',status:'active',full_name:`Catalogación ficticia ${suffix}`},secret,'PATCH');
 for(const code of permissions) {
  const [p]=await api(`/rest/v1/permissions?select=id&code=eq.${code}`);
  await api('/rest/v1/user_permissions',{museum_id:museum.id,user_id:user.id,permission_id:p.id,effect:'allow',assigned_by:user.id});
 }
 const session=await api('/auth/v1/token?grant_type=password',{email,password},anon);
 return {user,session,email,password,token:session.access_token};
}
try {
 museums.push((await api('/rest/v1/museums',{name:`Administrative collections fixture ${marker}`,slug:`${marker}-admin-access`,active:true}))[0]);
 const museum=museums[0];
 for(const role of ['administrador','ejecutivo']) {
  const writer=await actor(museum,role,[]);
  const [r]=await api(`/rest/v1/roles?select=id&code=eq.${role}`);
  // Only new synthetic identities receive a role; no existing person is changed.
  await api('/rest/v1/user_roles',{museum_id:museum.id,user_id:writer.user.id,role_id:r.id,assigned_by:writer.user.id});
  const permissions=await api('/rest/v1/rpc/current_user_permissions',{},writer.token);
  const codes=permissions.map(p=>p.code||p);
  assert(!codes.includes('collections.write')); checks++;
  assert(role==='administrador'?codes.includes('system.configure'):codes.includes('audit.read')&&codes.includes('notifications.manage')); checks++;
  assert.equal(await api('/rest/v1/rpc/collection_can_write',{},writer.token),true); checks++;
  const c=vm.createContext({fetch,crypto,Blob,supabaseUrl:url,supabaseAuthHeaders:async()=>headers(writer.token)});
  vm.runInContext(fs.readFileSync(new URL('../../js/services/collections.js',import.meta.url),'utf8'),c);
  let piece=await c.collectionSave({accession_number:`TEST-${marker}-${role}`,title:'Pieza ficticia de permisos',description:'Sin valor patrimonial; prueba de acceso administrativo',category:'Documento',location:'Sala ficticia',condition:'Prueba',status:'ingreso',details:{}},null,'Validación administrativa ficticia');checks++;
  piece=await c.collectionSave({...piece,location:'Otra sala ficticia'},piece,'Edición administrativa ficticia');checks++;
  const png=fs.readFileSync(new URL('./fixtures/collection-test.png',import.meta.url));
  piece=await c.collectionUpload(piece,new Blob([png],{type:'image/png'}),'Foto ficticia de permisos');checks++;
  const photos=await c.collectionRows('collection_photos',`&item_id=eq.${piece.id}`);
  assert.equal(photos.length,1);assert((await fetch(await c.collectionPhotoUrl(photos[0].path))).ok);checks++;
  assert.equal((await c.collectionHistory(piece.id)).length,3);checks++;
  await deny(()=>api(`/rest/v1/collection_items?id=eq.${piece.id}`,undefined,writer.token,'DELETE'));
  await deny(()=>api(`/rest/v1/collection_history?item_id=eq.${piece.id}`,{reason:'overwrite'},writer.token,'PATCH'));
  for(const code of role==='administrador'?['system.configure','audit.read']:['audit.read']) {
   const [p]=await api(`/rest/v1/permissions?select=id&code=eq.${code}`);
   await api('/rest/v1/user_permissions',{museum_id:museum.id,user_id:writer.user.id,permission_id:p.id,effect:'deny',assigned_by:writer.user.id});
  }
  assert.equal(await api('/rest/v1/rpc/collection_can_write',{},writer.token),false);checks++;
  await deny(()=>c.collectionSave(piece,piece,'Administración revocada'));
  assert.equal((await c.collectionHistory(piece.id)).length,0);checks++;
  console.log(JSON.stringify({role,result:'PASS',no_individual_collection_grant:true}));
 }
 const employee=await actor(museum,'ordinary',[]);
 assert.equal(await api('/rest/v1/rpc/collection_can_write',{},employee.token),false);checks++;
 await deny(()=>api('/rest/v1/rpc/collection_save',{p_id:null,p_expected_version:null,p_item:{},p_reason:'Usuario sin acceso'},employee.token));
 console.log(JSON.stringify({result:'PASS',checks,production_writes:0,emails_sent:0}));
} finally {
 for(const u of users) await api(`/rest/v1/profiles?id=eq.${u.id}`,{status:'inactive'},secret,'PATCH');
 for(const m of museums) await api(`/rest/v1/museums?id=eq.${m.id}`,{active:false},secret,'PATCH');
 console.log(JSON.stringify({synthetic_profiles_disabled:users.length,synthetic_museums_disabled:museums.length}));
}
