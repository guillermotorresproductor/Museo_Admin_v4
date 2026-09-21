import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const service=fs.readFileSync(new URL('../../js/services/supabase.js',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../../js/app.js',import.meta.url),'utf8');
const id='11111111-1111-4111-8111-111111111111';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6xkAAAAASUVORK5CYII=';
function client(fetch) {
 const c=vm.createContext({fetch,crypto,atob,Uint8Array,supabaseUrl:'https://test.invalid',supabaseAuthHeaders:async()=>({}),employeeInitials:()=>''});
 vm.runInContext(service,c);return c;
}
test('basic payload never overwrites a persisted photo or security level',()=>{
 const c=client(()=>{}), payload=c.employeeToSupabasePayload({foto:png,acceso:'Administrador'},'m');
 assert.equal(Object.hasOwn(payload,'photo_url'),false);assert.equal(Object.hasOwn(payload,'access_level'),false);
});
for(const failure of ['upload','commit'])test(`photo ${failure} failure rejects save and preserves old reference`,async()=>{
 const paths=[];
 const c=client(async(path)=>{paths.push(path);return new Response(JSON.stringify(path.includes('/rest/v1/employees')?[{id}]:{message:'injected failure'}),{status:path.includes(failure==='upload'?'/storage/':'/rpc/')?500:200});});
 const model={foto:png,photoReference:'old-private-reference'};
 await assert.rejects(()=>c.saveSupabaseEmployee(model,'m',id),error=>error.savedEmployeeId===id);
 assert.equal(model.photoReference,'old-private-reference');
 if(failure==='upload')assert.equal(paths.some(p=>p.includes('/rpc/')),false);
});
test('an update matching zero employees is an error',async()=>{
 const c=client(async()=>new Response('[]'));
 await assert.rejects(()=>c.updateSupabaseEmployee(id,{foto:''},'m'),/No se confirmó/);
});
test('signed URL failure prevents a successful directory read',async()=>{
 const c=client(async path=>new Response(JSON.stringify(path.includes('/employees?')?[{id,photo_url:'storage:employee-photos/m/e/p.png'}]:{message:'denied'}),{status:path.includes('/sign/')?403:200}));
 await assert.rejects(()=>c.fetchSupabaseEmployees(),/denied/);
});

const hr=app.slice(app.indexOf('function bindHumanResourcesModule()'),app.indexOf('async function bindEmployeeProfile()'));
const submit=hr.slice(hr.indexOf('  form.addEventListener("submit"'),hr.indexOf('  directory.addEventListener("click"'));
function formFixture({roleFailure=false,photoFailure=false,allowed=true,draft=false,legacy=false,conflicting=false}={}) {
 let handler;const calls=[],messages=[];
 const fields={id,nombre:'Synthetic',apellidos:'Employee',posicion:'Prueba',departamento:'Prueba',correo:'test@example.invalid',telefono:'',direccion:'',fechaContratacion:'',horario:'',educacion:'',condicion:'',acceso:'Administrador',estado:'Activo',notificaciones:''};
 if(draft){fields.correo='';fields.acceso='';}
 if(legacy)fields.acceso='';
 const form={elements:{id:{value:id}},addEventListener:(event,fn)=>handler=fn};
 const c=vm.createContext({form,FormData:class{get(k){return fields[k];}},employeeSaving:false,photoReading:false,photoReadError:false,selectedPhoto:png,formPhotoReference:'',formServerLevel:{role:'empleado',conflicting:false},submitButton:{},
 canManageEmployees:()=>true,hasPermission:()=>allowed,employeeInitials:()=>'',getEmployeeRecords:()=>[{id}],getSupabaseSession:()=>({access_token:'fixture'}),supabaseProfile:{museum_id:'m'},
 saveSupabaseEmployee:async()=>{calls.push('save');if(photoFailure)throw Error('photo failed');return [{id}];},assignSupabaseEmployeeLevel:async()=>{calls.push('assign');if(roleFailure)throw Error('role failed');return {assigned:true,role:'administrador'};},
 canManageSensitiveEmployeeData:()=>false,fetchSupabaseEmployees:async()=>{calls.push('readback');return [{id}];},saveEmployeeRecords:()=>{},renderDirectory:()=>{},resetForm:()=>{},hideForm:()=>{},setMessage:(text,type)=>messages.push({text,type}),providerNeutralMessage:e=>e.message});
 if(draft){c.formServerLevel={role:null,conflicting:false};c.selectedPhoto='';}
 if(legacy)c.formServerLevel={role:legacy,conflicting};
 vm.runInContext(service.slice(0,service.indexOf("'use strict';")),c);
 vm.runInContext(submit,c);return {invoke:()=>handler({preventDefault(){}}),calls,messages};
}

test('RH saves a draft with no email or level without assigning any role',async()=>{
 const f=formFixture({draft:true,allowed:false});await f.invoke();
 assert.deepEqual(f.calls,['save','readback']);assert.equal(f.messages.at(-1).type,'success');
});
test('RH submit waits for safe assignment and server readback before success',async()=>{
 const f=formFixture();await f.invoke();assert.deepEqual(f.calls,['save','assign','readback']);assert.equal(f.messages.at(-1).type,'success');
});
for(const option of ['roleFailure','photoFailure'])test(`RH ${option} never reports employee updated`,async()=>{
 const f=formFixture({[option]:true});await f.invoke();assert.equal(f.messages.at(-1).type,'error');assert.ok(!f.messages.some(m=>m.type==='success'));assert.ok(!f.calls.includes('readback'));
});
test('RH refuses an unauthorized level before any write',async()=>{
 const f=formFixture({allowed:false});await f.invoke();assert.deepEqual(f.calls,[]);assert.equal(f.messages.at(-1).type,'error');
});

test('Ver perfil photo failure never updates cache or reports success',async()=>{
 const start=app.indexOf('  saveButton?.addEventListener("click"',app.indexOf('async function bindEmployeeProfile()'));
 const callback=app.slice(start,app.indexOf('\n  });',start)+6);
 let handler;const messages=[];
 const c=vm.createContext({saveButton:{addEventListener:(_,fn)=>handler=fn},profileSaving:false,profilePhotoReading:false,profilePhotoReadError:false,
 profile:{id,source:'supabase',acceso:'Empleado'},pendingPhoto:png,document:{querySelectorAll:()=>[]},employeeInitials:()=>'',getSupabaseSession:()=>({access_token:'fixture'}),
 fetchSupabaseProfile:async()=>({museum_id:'m'}),serverLevel:'empleado',serverLevelConflict:false,hasPermission:()=>true,canManageEmployees:()=>true,
 updateSupabaseEmployee:async()=>{throw Error('photo failed');},saveEmployeeRecords:()=>assert.fail('must not change cache'),setProfileMessage:(text,type)=>messages.push({text,type})});
 vm.runInContext(callback,c);await handler();assert.equal(messages.at(-1).type,'error');assert.ok(!messages.some(m=>m.type==='success'));
 assert.equal(c.profileSaving,false);assert.equal(c.saveButton.disabled,false);
});

for(const legacy of ['empleado','ejecutivo','administrador'])test('Legacy '+legacy+' remains unchanged without a category selection',async()=>{
 const f=formFixture({legacy,conflicting:true});await f.invoke();assert.deepEqual(f.calls,['save','readback']);assert.equal(f.messages.at(-1).type,'success');
});
