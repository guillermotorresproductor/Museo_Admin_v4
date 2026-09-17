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
 for(const suffix of ['catalogo','otro']) museums.push((await api('/rest/v1/museums',{name:`PR Colecciones ficticio ${marker}-${suffix}`,slug:`${marker}-${suffix}`,active:true}))[0]);
 const writer=await actor(museums[0],'writer',['collections.write']);
 const reader=await actor(museums[0],'reader',['collections.read']);
 const foreign=await actor(museums[1],'foreign',['collections.write']);
 const c=vm.createContext({fetch,crypto,Blob,supabaseUrl:url,supabaseAuthHeaders:async()=>headers(writer.token)});
 vm.runInContext(fs.readFileSync(new URL('../../js/services/collections.js',import.meta.url),'utf8'),c);
 const permissions=await api('/rest/v1/rpc/current_user_permissions',{},writer.token);
 assert(!permissions.some(p=>(p.code||p)==='system.configure'));checks++;
 let piece=await c.collectionSave({accession_number:`TEST-${marker}`,title:'Cuatro de prueba — no patrimonial',description:'Pieza ficticia para comprobar Colecciones.',category:'Instrumento musical',location:'Sala de prueba',condition:'Estable (ficticio)',status:'ingreso',details:{owner:'Titular ficticio',custody:'Custodia ficticia',acquisition:'En documentación',fmv:'25.50',currency:'USD',provenance:'Datos de prueba'}},null,'Registro ficticio de verificación');checks++;
 const original=structuredClone(piece);
 const secondSession=await api('/auth/v1/token?grant_type=password',{email:writer.email,password:writer.password},anon);
 const [reloaded]=await api(`/rest/v1/collection_items?id=eq.${piece.id}`,undefined,secondSession.access_token);
 assert.equal(reloaded.title,piece.title);checks++;
 piece=await c.collectionSave({...piece,location:'Almacén de prueba',details:{...piece.details,notes:'Edición conservada'}},piece,'Movimiento ficticio para verificar historial');checks++;
 await deny(()=>c.collectionSave(original,original,'Versión anterior intencional'));
 await deny(()=>c.collectionSave({...piece,accession_number:` test-${marker} `},null,'Duplicado ficticio'));
 await deny(()=>api('/rest/v1/rpc/collection_save',{p_id:piece.id,p_expected_version:piece.version,p_item:piece,p_reason:'Intento de lector'},reader.token));
 assert.equal((await api(`/rest/v1/collection_items?id=eq.${piece.id}`,undefined,foreign.token)).length,0);checks++;
 await deny(()=>api('/rest/v1/rpc/collection_save',{p_id:piece.id,p_expected_version:piece.version,p_item:piece,p_reason:'Otro museo'},foreign.token));
 await deny(()=>api(`/rest/v1/collection_items?id=eq.${piece.id}`,{title:'Direct write'},writer.token,'PATCH'));
 await deny(()=>api(`/rest/v1/collection_items?id=eq.${piece.id}`,undefined,writer.token,'DELETE'));
 await deny(()=>api('/rest/v1/rpc/collection_save',{p_id:null,p_expected_version:null,p_item:piece,p_reason:'Sin identidad'},anon));
 const png=fs.readFileSync(new URL('./fixtures/collection-test.png',import.meta.url));
 piece=await c.collectionUpload(piece,new Blob([png],{type:'image/png'}),'Fotografía ficticia inicial');checks++;
 piece=await c.collectionUpload(piece,new Blob([png],{type:'image/png'}),'Segunda fotografía, conserva la anterior');checks++;
 const photos=await c.collectionRows('collection_photos',`&item_id=eq.${piece.id}`);assert.equal(photos.length,2);checks++;
 const signed=await c.collectionPhotoUrl(photos[0].path);const photoResponse=await fetch(signed);assert(photoResponse.ok);assert.deepEqual(Buffer.from(await photoResponse.arrayBuffer()),png);checks++;
 const upload=await fetch(`${url}/storage/v1/object/collection-photos/${photos[0].path}`,{method:'POST',headers:{...headers(writer.token),'Content-Type':'image/png','x-upsert':'true'},body:png});assert(!upload.ok);checks++;
 const deletion=await fetch(`${url}/storage/v1/object/collection-photos/${photos[0].path}`,{method:'DELETE',headers:headers(writer.token)});
 const stillThere=await fetch(await c.collectionPhotoUrl(photos[0].path));assert(stillThere.ok);checks++;
 await deny(()=>api(`/storage/v1/object/sign/collection-photos/${photos[0].path}`,{expiresIn:60},foreign.token));
 const history=await c.collectionHistory(piece.id);assert.equal(history.length,4);assert(history.some(h=>h.before_value?.location==='Sala de prueba'&&h.after_value?.location==='Almacén de prueba'));checks++;
 await deny(()=>api(`/rest/v1/collection_history?item_id=eq.${piece.id}`,{reason:'rewrite'},writer.token,'PATCH'));
 const readerView=await api(`/rest/v1/collection_items?id=eq.${piece.id}`,undefined,reader.token);assert.equal(readerView[0].version,piece.version);checks++;
 const [writePermission]=await api('/rest/v1/permissions?select=id&code=eq.collections.write');
 await api(`/rest/v1/user_permissions?user_id=eq.${writer.user.id}&permission_id=eq.${writePermission.id}`,{effect:'deny'},secret,'PATCH');
 await deny(()=>c.collectionSave(piece,piece,'Permiso revocado'));
 await api(`/rest/v1/user_permissions?user_id=eq.${writer.user.id}&permission_id=eq.${writePermission.id}`,{effect:'allow'},secret,'PATCH');
 console.log(JSON.stringify({result:'PASS',checks,marker,museum:museums[0].id,piece:piece.id,history:history.length,photos:photos.length,role:'empleado',permissions:['collections.write'],emails_sent:0}));
 if(process.argv.includes('ui')) {
  const {review}=await import('../../scripts/review-collections-staging.mjs');await review(secondSession,piece.id);
 }
} finally {
 // Patrimonial no-delete behavior is retained even for this isolated synthetic catalog.
 // Only deactivate the test identities; preserve the synthetic records and their history.
 for(const u of users) await api(`/rest/v1/profiles?id=eq.${u.id}`,{status:'inactive'},secret,'PATCH');
 for(const m of museums) await api(`/rest/v1/museums?id=eq.${m.id}`,{active:false},secret,'PATCH');
 console.log(JSON.stringify({synthetic_profiles_disabled:users.length,isolated_test_museums:museums.map(m=>m.id),production_writes:0,patrimonial_deletes:0}));
}
