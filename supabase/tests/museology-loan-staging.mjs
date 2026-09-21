import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {review} from '../../scripts/review-collections-staging.mjs';
const url='https://lonpdmxdvbxuagqxztig.supabase.co';
const secret=process.env.MODULE_TEST_SERVICE_KEY,anon=process.env.MODULE_TEST_ANON_KEY;
assert(secret&&anon,'Staging keys required');
const marker=`collections-${Date.now()}`,users=[],museums=[];let checks=0;
const headers=t=>({apikey:t===secret?secret:anon,Authorization:`Bearer ${t}`,'Content-Type':'application/json'});
async function api(p,b,t=secret,method=b===undefined?'GET':'POST',prefer='return=representation'){
 const r=await fetch(url+p,{method,headers:{...headers(t),Prefer:prefer},body:b===undefined?undefined:JSON.stringify(b)});
 const d=await r.json().catch(()=>null);if(!r.ok){const e=Error(`${method} ${p.split('?')[0]} HTTP ${r.status}: ${d?.message||d?.msg||d?.error}`);e.status=r.status;throw e;}return d;
}
const codes=async t=>(await api('/rest/v1/rpc/current_user_permissions',{},t)).map(p=>p.code||p);
async function login(u){return api('/auth/v1/token?grant_type=password',{email:u.email,password:u.password},anon);}
async function actor(m,suffix,role='empleado'){
 const email=`${marker}-${suffix}@example.invalid`,password=`Aa!9${crypto.randomUUID()}`;
 const u=await api('/auth/v1/admin/users',{email,password,email_confirm:true});users.push(u.id);
 await api(`/rest/v1/profiles?id=eq.${u.id}`,{museum_id:m.id,role,status:'active',full_name:`TEST Museología ${suffix}`},secret,'PATCH');
 const [r]=await api(`/rest/v1/roles?select=id&code=eq.${role}`);
 await api('/rest/v1/user_roles',{museum_id:m.id,user_id:u.id,role_id:r.id});
 const [e]=await api('/rest/v1/employees',{museum_id:m.id,profile_id:u.id,email,first_name:'TEST Museología',last_name:suffix,access_level:role,access_profile:'gerente_museografica',status:'activo'});
 const a={id:u.id,email,password,employee:e};a.session=await login(a);return a;
}
async function denied(fn){await assert.rejects(fn,e=>e.status===403||e.status===401);checks++;}
try{
 for(const suffix of ['own','foreign'])museums.push((await api('/rest/v1/museums',{name:`TEST Museología ${marker}-${suffix}`,slug:`${marker}-${suffix}`,active:true}))[0]);
 const writer=await actor(museums[0],'writer'),executive=await actor(museums[0],'executive','ejecutivo'),foreign=await actor(museums[1],'foreign');
 for(const a of [writer,executive]){
  const p=await codes(a.session.access_token);assert(p.includes('collections.write'));assert(p.includes('collections.read'));
  assert.deepEqual(p.filter(p=>p.startsWith('modules.')).sort(),['personal','collections','calendar','ushers','documents','announcements'].map(m=>`modules.${m}.read`).sort());
  for(const forbidden of ['roles.assign','system.configure','finance.write','employees.update.basic','users.invite'])assert(!p.includes(forbidden),forbidden);checks++;
  await denied(()=>api('/rest/v1/rpc/assign_employee_module_profile',{p_employee_id:a.employee.id,p_profile_code:'administrador_general',p_expected_role:'gerente_museografica'},a.session.access_token));
 }
 let token=writer.session.access_token;
 const c=vm.createContext({fetch,crypto,Blob,supabaseUrl:url,supabaseSystemRecordsTable:'app_records',supabaseAuthHeaders:async()=>headers(token),explainSystemRecordsError:d=>d?.message||'API error'});
 vm.runInContext(fs.readFileSync(new URL('../../js/services/collections.js',import.meta.url),'utf8'),c);
 vm.runInContext(fs.readFileSync(new URL('../../js/loan-receipt.js',import.meta.url),'utf8'),c);
 let piece=await c.collectionSave({accession_number:marker,title:'Pieza ficticia préstamo',description:'Prueba sin valor patrimonial',category:'Instrumento musical',location:'TEST',condition:'Buena',status:'ingreso',details:{owner:'Propietario ficticio'}},null,'Verificar perfil de Museología');checks++;
 piece=await c.collectionSave({...piece,location:'TEST segunda ubicación'},piece,'Verificar edición e historial');checks++;
 const png=fs.readFileSync(new URL('./fixtures/collection-test.png',import.meta.url));
 piece=await c.collectionUpload(piece,new Blob([png],{type:'image/png'}),'TEST fotografía');checks++;
 const legacy=[{numeroArticulo:'TEST anterior',articulo:'Recibo previo ficticio',prestamista:'Propietario ficticio'}];
 await api('/rest/v1/app_records',{museum_id:museums[0].id,module:'recibos_prestamo',record_key:'receipts',payload:legacy,created_by:writer.id,updated_by:writer.id});
 const profile={id:writer.id,museum_id:museums[0].id};
 const signature='data:image/png;base64,'+png.toString('base64');
 const receipt={id:crypto.randomUUID(),schemaVersion:2,numeroArticulo:'TEST-'+marker,fechaEmision:'2026-09-21',categoria:'Instrumento musical',articulo:'TEST préstamo completo',autor:'Artista ficticio',periodo:'1970',materiales:'Madera',procedencia:'Colección privada ficticia',descripcion:'TEST expediente',alto:'30',alto_unidad:'cm',ancho:'15',ancho_unidad:'pulg.',profundidad:'4',profundidad_unidad:'cm',peso:'2',peso_unidad:'kg',otras_medidas:'TEST',condicion:'Buena',valor:'25 USD',conservacion_observaciones:'TEST',modalidad:'indefinido',inicio:'2026-09-21',devolucion:'',propositos:['Exhibición'],proposito:'TEST propósito',prestamista:'Propietario ficticio',correo:'owner@example.invalid',telefono:'7875550101',direccion:'TEST dirección',representante:'TEST representante',cargo_representante:'Museología',recibido_por:'TEST receptor',fecha:'2026-09-21',inventario:marker,registro_digital:'Sí',ubicacion:'TEST',observaciones:'TEST interno',certificacion:true,titularidad:'La pieza continúa perteneciendo al propietario; no transfiere propiedad.',fotografias:{foto_frontal:{name:'test.png',data:signature},foto_posterior:{name:'test.png',data:signature}},firmas:{firma_propietario:signature,firma_representante:signature,firma_recibido:signature}};
 await c.loanSave(profile,receipt);await c.loanSave(profile,receipt);checks++;
 let rows=await api(`/rest/v1/app_records?record_key=eq.receipt-${receipt.id}`,undefined,token);assert.equal(rows.length,1);assert.deepEqual(rows[0].payload,receipt);checks++;
 await api('/auth/v1/logout',{},token);writer.session=await login(writer);token=writer.session.access_token;
 assert((await codes(token)).includes('collections.write'));assert.deepEqual(await c.loanRead(profile,`receipt-${receipt.id}`),receipt);checks++;
 assert.deepEqual((await api(`/rest/v1/app_records?record_key=eq.receipts&museum_id=eq.${profile.museum_id}`,undefined,token))[0].payload,legacy);checks++;
 const temporal={...receipt,id:crypto.randomUUID(),modalidad:'temporal',devolucion:'2026-12-31'};await c.loanSave(profile,temporal);checks++;
 assert.equal((await api(`/rest/v1/app_records?record_key=eq.receipt-${receipt.id}`,undefined,foreign.session.access_token)).length,0);checks++;
 await denied(()=>api('/rest/v1/app_records',{museum_id:museums[1].id,module:'recibos_prestamo',record_key:'receipt-cross-museum',payload:receipt,created_by:writer.id,updated_by:writer.id},token));
 await denied(()=>api('/rest/v1/rpc/collection_save',{p_id:piece.id,p_expected_version:piece.version,p_item:piece,p_reason:'Cross museum denied'},foreign.session.access_token));
 const [permission]=await api('/rest/v1/permissions?select=id&code=eq.collections.write');
 const [deny]=await api('/rest/v1/user_permissions',{museum_id:profile.museum_id,user_id:writer.id,permission_id:permission.id,effect:'deny',assigned_by:writer.id});
 assert(!(await codes(token)).includes('collections.write'));checks++;
 await denied(()=>c.collectionSave(piece,piece,'Explicit deny'));
 await assert.rejects(()=>c.loanSave(profile,{...receipt,id:crypto.randomUUID()}));checks++;
 await api(`/rest/v1/user_permissions?user_id=eq.${writer.id}&permission_id=eq.${permission.id}&museum_id=eq.${profile.museum_id}`,{valid_until:'2020-01-01T00:00:00Z'},secret,'PATCH');
 assert((await codes(token)).includes('collections.write'));checks++;
 console.log(JSON.stringify({result:'PASS',checks,marker,museum:profile.museum_id,piece:piece.id,receipt:receipt.id,real_auth:true,real_database:true,production_writes:0}));
 if(process.argv.includes('ui'))await review(writer.session,piece.id);
}finally{
 for(const id of users)await api(`/rest/v1/profiles?id=eq.${id}`,{status:'inactive'},secret,'PATCH');
 for(const m of museums)await api(`/rest/v1/museums?id=eq.${m.id}`,{active:false},secret,'PATCH');
 console.log(JSON.stringify({test_profiles_deactivated:users.length,isolated_museums:museums.map(m=>m.id),deleted_records:0}));
}
