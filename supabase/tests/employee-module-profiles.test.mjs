import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const source=fs.readFileSync(new URL('../../js/app.js',import.meta.url),'utf8');
const service=fs.readFileSync(new URL('../../js/services/supabase.js',import.meta.url),'utf8');
const all=['personal','collections','calendar','rentals','memberships','ushers','maintenance','documents','administration','announcements','inventory'];
const expected={
 mantenimiento:['personal','calendar','maintenance','announcements'],
 gerente_museografica:['personal','collections','calendar','ushers','documents','announcements'],
 contenido_marketing:['personal','calendar','ushers','documents','announcements'],
 coordinadora_experiencia:['personal','calendar','ushers','documents','announcements'],
 tecnico_produccion:['personal','calendar','ushers','documents','announcements','inventory'],
 asistente_administrativa:all,director_ejecutivo:all,administrador_general:all,gerente_administrativo:all,it_programador:all
};
function context(modules,privileges=[]) {
 const local=new Map(),main={innerHTML:''},sidebar={innerHTML:'',querySelector:()=>null};
 const ctx=vm.createContext({console,URL,URLSearchParams,setTimeout,clearTimeout,
  museoEnvironment:{name:'staging'},museoEnvironmentName:'staging',
  localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)},
  window:{location:{pathname:'/dashboard.html',search:'',replace:()=>{throw Error('Unexpected redirect');}}},
  document:{addEventListener(){},querySelector:s=>s==='[data-sidebar]'?sidebar:s==='.page-content'?main:null,
   querySelectorAll:()=>[],body:{classList:{add(){}}}},
 });
 vm.runInContext(service+'\n'+source,ctx);
 vm.runInContext(`currentPermissions=new Set(${JSON.stringify(['module_profiles.active',...modules.map(m=>`modules.${m}.read`),...privileges])});currentPermissionsLoaded=true;saveSupabaseSession({access_token:'local-fixture'});`,ctx);
 return {ctx,main,sidebar};
}
for(const [code,modules] of Object.entries(expected))test(`${code}: exact menu, routes and persisted selection`,()=>{
 const {ctx,main,sidebar}=context(modules);
 vm.runInContext('renderSidebar()',ctx);
 const hrefs=[...sidebar.innerHTML.matchAll(/class="nav-link[^\"]*" href="([^\"]+)"/g)].map(m=>m[1]);
 const visible=hrefs.map(h=>vm.runInContext(`profilePageModules[${JSON.stringify(h)}]`,ctx));
 assert.deepEqual(visible.sort(),[...modules].sort());
 const pages=vm.runInContext('Object.fromEntries(navigationGroups[0].items.filter(i=>profilePageModules[i.href]).map(i=>[i.href,profilePageModules[i.href]]))',ctx);
 for(const [page,module] of Object.entries(pages)) {
  ctx.window.location.pathname='/'+page;
  const blocked=vm.runInContext('enforceAuthenticatedPageAccess()',ctx);
  assert.equal(blocked,!modules.includes(module),page);
  if(blocked)assert.match(main.innerHTML,/Acceso denegado/);
 }
 const label=vm.runInContext(`employeeAccessLabel('${code}')`,ctx);
 assert.equal(vm.runInContext(`employeeAccessCode(${JSON.stringify(label)})`,ctx),code);
 assert.equal(vm.runInContext(`employeeFromSupabase({access_profile:'${code}',access_level:'empleado'}).acceso`,ctx),label);
 for(const file of ['perfil-empleado.html','recursos-humanos.html'])assert.ok(fs.readFileSync(new URL('../../'+file,import.meta.url),'utf8').includes(`<option>${label}</option>`));
});
test('A previous administrator cannot bypass a restricted module profile',()=>{
 const {ctx}=context(expected.mantenimiento,['system.configure','roles.assign','inventory.manage','rentals.manage']);
 ctx.window.location.pathname='/inventario.html';
 assert.equal(vm.runInContext('enforceAuthenticatedPageAccess()',ctx),true);
 assert.equal(vm.runInContext('profilePageAllowed("administracion.html")',ctx),false);
});
test('All-module entry does not confer privileged administrative operations',()=>{
 const {ctx}=context(all);
 for(const page of ['finanzas.html','direccion-ejecutiva.html','perfil-empleado.html','recursos-humanos.html'])assert.equal(vm.runInContext(`profilePageAllowed('${page}')`,ctx),false);
 assert.equal(vm.runInContext('profilePageAllowed("administracion.html")',ctx),true);
 assert.match(source,/: isUshers \? hasPermission\("usher\.schedule\.manage"\)/);
});

test('Museographic operational permission opens both child routes and preserves prior modules',()=>{
 const {ctx}=context(expected.gerente_museografica,['collections.read','collections.write']);
 for(const page of ['departamento-museologico.html','colecciones-museograficas.html','inventario-colecciones.html','recibo-prestamo.html']){
  assert.equal(vm.runInContext(`profilePageAllowed('${page}')`,ctx),true,page);
  ctx.window.location.pathname='/'+page;
  assert.equal(vm.runInContext('enforceAuthenticatedPageAccess()',ctx),false,page);
 }
 assert.equal(vm.runInContext('canWriteCollections()',ctx),true);
 for(const page of ['administracion.html','recursos-humanos.html','finanzas.html'])assert.equal(vm.runInContext(`profilePageAllowed('${page}')`,ctx),false,page);
});
test('Both category selectors remove legacy choices and preserve existing account roles',()=>{
 const {ctx}=context(expected.gerente_museografica);
 for(const file of ['perfil-empleado.html','recursos-humanos.html']){
  const html=fs.readFileSync(new URL('../../'+file,import.meta.url),'utf8');
  assert.doesNotMatch(html,/<option>(Empleado|Ejecutivo|Administrador)<\/option>/);
  assert.doesNotMatch(html,/Niveles anteriores/);
 }
 for(const role of ['empleado','ejecutivo','administrador']){
  ctx.select={value:'',options:[{textContent:''}]};ctx.role=role;
  vm.runInContext('setEmployeeCategorySelection(select,role)',ctx);
  assert.equal(ctx.select.value,'');assert.equal(ctx.select.options[0].textContent,'Conservar configuración actual');
  assert.equal(vm.runInContext('employeeAccessCode(select.value || role)',ctx),role);
 }
 vm.runInContext("setEmployeeCategorySelection(select,'gerente_museografica')",ctx);
 assert.equal(ctx.select.value,'Gerente Museográfica');
 vm.runInContext('setEmployeeCategorySelection(select)',ctx);assert.equal(ctx.select.value,'');
});

test('Museology write capability opens both modules and preserves every previous route',()=>{
 const {ctx,sidebar}=context(expected.gerente_museografica,['collections.read','collections.write']);
 vm.runInContext('renderSidebar()',ctx);
 for(const page of ['inventario-colecciones.html','recibo-prestamo.html','departamento-museologico.html','employee-portal.html','calendario.html','ujieres.html','documentos.html','boletin.html']){
  assert.equal(vm.runInContext(`profilePageAllowed('${page}')`,ctx),true,page);
  ctx.window.location.pathname='/'+page;
  assert.equal(vm.runInContext('enforceAuthenticatedPageAccess()',ctx),false,page);
 }
 for(const page of ['administracion.html','finanzas.html','recursos-humanos.html','perfil-empleado.html'])assert.equal(vm.runInContext(`profilePageAllowed('${page}')`,ctx),false,page);
 assert.equal(vm.runInContext('canWriteCollections()',ctx),true);
 const denied=context(expected.gerente_museografica,['collections.read']);
 assert.equal(vm.runInContext('profilePageAllowed("recibo-prestamo.html")',denied.ctx),false);
 assert.equal(vm.runInContext('canWriteCollections()',denied.ctx),false);
});

test('HR selector contains only ten current categories and an empty preservation option',()=>{
 const html=fs.readFileSync(new URL('../../recursos-humanos.html',import.meta.url),'utf8');
 const selector=html.match(/<select name="acceso">([\s\S]*?)<\/select>/)[1];
 assert.equal((selector.match(/<option/g)||[]).length,11);
 assert(!/Niveles anteriores|<option>(Administrador|Ejecutivo|Empleado)<\/option>/.test(selector));
});
