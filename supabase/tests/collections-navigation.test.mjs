import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../../js/app.js',import.meta.url),'utf8');
const guardSource=app.slice(app.indexOf('function enforceAuthenticatedPageAccess()'),app.indexOf('async function refreshCurrentPermissions()'));
function guard(page,permissions){
 let denied=false;const redirects=[];
 const canRead=()=>permissions.includes('collections.read')||permissions.includes('collections.write');
 const checks={'inventario-colecciones.html':canRead,'departamento-museologico.html':canRead,'colecciones-museograficas.html':canRead,'recibo-prestamo.html':()=>permissions.includes('collections.write')};
 const ctx=vm.createContext({getCurrentPage:()=>page,getSupabaseSession:()=>({access_token:'test'}),currentPermissionsLoaded:true,moduleAccessChecks:checks,
 EXECUTIVE_MODULE_ACCESS:{},SENSITIVE_MODULE_ACCESS:{},hasAdministrativeWorkspaceAccess:()=>permissions.includes('system.configure'),hasPermission:p=>permissions.includes(p),
 showProtectedAccessDenied:()=>denied=true,window:{location:{replace:p=>redirects.push(p)}}});
 vm.runInContext(guardSource,ctx);return{blocked:ctx.enforceAuthenticatedPageAccess(),denied,redirects};
}
test('cataloguer can traverse Museology and Collections without administrator',()=>{
 for(const p of ['departamento-museologico.html','colecciones-museograficas.html','inventario-colecciones.html','recibo-prestamo.html']) assert.equal(guard(p,['collections.write']).blocked,false);
});
test('read-only access opens catalog but does not grant loan form editing',()=>{
 assert.equal(guard('inventario-colecciones.html',['collections.read']).blocked,false);
 assert.equal(guard('recibo-prestamo.html',['collections.read']).blocked,true);
});
test('equipment and administrator permissions do not silently grant catalog rights',()=>{
 for(const permissions of [[],['inventory.manage'],['system.configure']]) assert.equal(guard('inventario-colecciones.html',permissions).denied,true);
});
test('piece deep link survives a login redirect without storing record data',()=>{
 const store=new Map();const piece='11111111-1111-4111-8111-111111111111';
 const source=fs.readFileSync(new URL('../../js/collections.js',import.meta.url),'utf8');
 const prefix=source.slice(0,source.indexOf('async function bindCollectionsCatalog'));
 vm.runInNewContext(prefix,{museoEnvironment:{name:'staging'},URLSearchParams,location:{search:`?pieza=${piece}`},sessionStorage:{setItem:(k,v)=>store.set(k,v)}});
 assert.deepEqual([...store.entries()],[['museo-collection-return-staging',piece]]);
});
