const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync("js/app.js","utf8");
const start=source.indexOf("function enforceAuthenticatedPageAccess()");
const end=source.indexOf("\nfunction ",start+10);
assert.ok(start>=0 && end>start);
const guard=source.slice(start,end);
function check({perms=[],moduleProfile=true,page="usuarios-externos.html",authenticated=true,loaded=true}={}) {
  let denied=false;
  const context=vm.createContext({
    getCurrentPage:()=>page,
    getSupabaseSession:()=>authenticated?{access_token:"test"}:null,
    loginUrlWithReturn:()=>"/login.html",
    currentPermissionsLoaded:loaded,
    hasModuleProfile:()=>moduleProfile,
    hasPermission:(code)=>perms.includes(code),
    showProtectedAccessDenied:()=>{denied=true},
    window:{location:{replace:()=>{denied=true}}},
  });
  vm.runInContext(guard,context);
  return {blocked:context.enforceAuthenticatedPageAccess(),denied};
}
test("authorized museum director with module profile may open accountant admin page",()=>{
 const r=check({perms:["users.invite","roles.assign"]});
 assert.equal(r.blocked,false);
 assert.equal(r.denied,false);
});
test("external accountant and other unprivileged users remain blocked",()=>{
 for(const perms of [[],["finance.read","finance.export"],["users.invite"],["roles.assign"]]){
  for(const moduleProfile of [true,false]){
   const r=check({perms,moduleProfile});
   assert.equal(r.blocked,true);
   assert.equal(r.denied,true);
  }
 }
});
test("the new route preserves denial when no session or permissions not loaded",()=>{
 assert.equal(check({perms:["users.invite","roles.assign"],authenticated:false}).blocked,true);
 assert.equal(check({perms:["users.invite","roles.assign"],loaded:false}).blocked,true);
});
test("no changes to the Finance, employees or other module routes",()=>{
 assert.match(guard,/if \(hasModuleProfile\(\)\)/);
 assert.match(guard,/if \(profilePageAllowed\(page\)\) return false/);
 assert.match(guard,/EXECUTIVE_MODULE_ACCESS\[page\]/);
 assert.match(guard,/SENSITIVE_MODULE_ACCESS\[page\]/);
});
