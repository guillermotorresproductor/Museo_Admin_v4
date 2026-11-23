const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const sql = fs.readFileSync("supabase/migrations/20261123130000_external_accountant_readonly.sql","utf8");
const edge = fs.readFileSync("supabase/functions/external-accountant-access/index.ts","utf8");
const nonnull = fs.readFileSync("supabase/migrations/20261123132000_external_accountant_nonnull_profile_guard.sql","utf8");
const app = fs.readFileSync("js/app.js","utf8");
const service = fs.readFileSync("js/services/supabase.js","utf8");
const html = fs.readFileSync("usuarios-externos.html","utf8");

test("external accountant membership is tenant-scoped and unreachable from client writes",()=>{
 assert.match(sql,/museum_id uuid not null references public\.museums\(id\)/);
 assert.match(sql,/user_id uuid not null unique references auth\.users\(id\)/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on table public\.external_accountant_access from anon,authenticated/);
 assert.doesNotMatch(sql,/create policy.*external_accountant_access/i);
});

test("external identity blocks legacy NULL-profile RLS bypass",()=>{
 assert.match(nonnull,/current_employee_module_profile\(\)/);
 assert.match(nonnull,/external_accountant_access ea/);
 assert.match(nonnull,/then '__external_accountant__'/);
 assert.match(nonnull,/else \([\s\S]*?from public\.employees e/);
});
test("deny all accidental module and write access, revocation always wins",()=>{
 assert.match(sql,/not exists\([\s\S]*?public\.external_accountant_access ea/);
 assert.match(sql,/requested_permission in \(''finance\.read'',''finance\.export'',''profile\.read\.self''\)/);
 assert.match(sql,/ea\.museum_id = public\.current_user_museum_id\(\)/);
 assert.match(sql,/ea\.status = ''active''/);
 assert.doesNotMatch(sql,/delete from public\.finance_|update public\.finance_|insert into public\.finance_/);
});

test("an invite cannot create an employee or grant write",()=>{
 assert.match(edge,/requirePermission\(req,/);
 assert.match(edge,/requirePermission\(req, "roles\.assign"\)/);
 assert.match(edge,/inviteUserByEmail\(email/);
 assert.match(edge,/role:"empleado",status:activeProfileStatus/);
 assert.match(edge,/item\.code === "finance\.write" \? "deny" : "allow"/);
 assert.match(edge,/status:"revoked",invited_by:user\.id/);
 assert.match(edge,/\.eq\("museum_id",museum\)/);
 assert.doesNotMatch(edge,/from\("employees"\)\.insert|from\("employees"\)\.update/);
 assert.match(edge,/portals\[url\]\?\.\[museum\]/);
});
test("revocation is database enforced before UI is updated",()=>{
 assert.match(edge,/status:"revoked",revoked_at:new Date\(\)\.toISOString\(\),revoked_by:user\.id/);
 assert.match(edge,/\.eq\("id",id\)\.eq\("museum_id",museum\)\.eq\("status","active"\)/);
 assert.match(edge,/status:inactiveProfileStatus/);
});

const begin = service.indexOf("async function validateSupabasePasswordSetupSession(");
const end = service.indexOf("async function updateSupabaseSetupPassword(",begin);
assert.ok(begin>=0 && end>begin);
const validationCode = service.slice(begin,end);
const session = {access_token:"test",refresh_token:"test",user:{id:"test-user"}};
function contextFor(employeeRows,verifyResult){
 const called=[];
 const context=vm.createContext({
  passwordSetupError:(code)=>new Error(code),
  passwordSetupRequest:async(path,access,options)=>{
    called.push(path);
    if(path==="/auth/v1/user")return {id:"test-user",email:"someone@example.com",email_confirmed_at:"now",invited_at:"now"};
    if(path.startsWith("/rest/v1/profiles?"))return [{id:"test-user",museum_id:"museum-a",email:"someone@example.com",role:"empleado",status:"activo"}];
    if(path.startsWith("/rest/v1/employees?"))return employeeRows;
    if(path==="/functions/v1/external-accountant-access")return verifyResult;
    if(path.startsWith("/rest/v1/roles?"))return [{id:"role-employee"}];
    if(path.startsWith("/rest/v1/user_roles?"))return [{museum_id:"museum-a",roles:{code:"empleado"},valid_until:null}];
    throw Error("Unexpected request "+path);
  },
  encodeURIComponent
 });
 vm.runInContext(validationCode,context);
 return {context,called};
}
test("accountant invitation validates separate membership when no employee exists",async()=>{
 const {context,called}=contextFor([],{accountant:true,verified:true});
 const result=await context.validateSupabasePasswordSetupSession(session,"invite");
 assert.equal(result.external_accountant,true);
 assert.ok(called.includes("/functions/v1/external-accountant-access"));
});
test("accountant invite is rejected without server approval",async()=>{
 const {context}=contextFor([],{accountant:false,verified:false});
 await assert.rejects(()=>context.validateSupabasePasswordSetupSession(session,"invite"));
});
test("existing employee role validation stays unchanged",async()=>{
 const {context,called}=contextFor([{id:"employee",profile_id:"test-user",museum_id:"museum-a",email:"someone@example.com"}],null);
 const result=await context.validateSupabasePasswordSetupSession(session,"invite");
 assert.equal(result.external_accountant,undefined);
 assert.ok(!called.includes("/functions/v1/external-accountant-access"));
});
test("new admin route is protected, without employee HR account",()=>{
 assert.match(app,/"usuarios-externos\.html": \(\) => hasPermission\("users\.invite"\) && hasPermission\("roles\.assign"\)/);
 assert.match(app,/typeof bindExternalAccountants === "function"/);
 assert.match(html,/data-external-accountants/);
 assert.match(html,/data-accountant-invite/);
 assert.match(html,/data-accountant-list/);
 assert.match(service,/!validated\.external_accountant && \(validated\.invitation_id \|\| validated\.setup_type==='recovery'\)/);
});
