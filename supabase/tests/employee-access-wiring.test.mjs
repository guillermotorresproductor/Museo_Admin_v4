import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { stripTypeScriptTypes } from "node:module";
const read=p=>fs.readFileSync(new URL(p,import.meta.url),"utf8");
const app=read("../../js/app.js"), service=read("../../js/services/supabase.js");
const helpers=stripTypeScriptTypes(read("../functions/_shared/employee-access.ts").replace(/^export /gm,""));
const edge=stripTypeScriptTypes(read("../functions/assign-sensitive-role/index.ts").replace(/^import[^\n]+\n/gm,""));
const employeeId="11111111-1111-4111-8111-111111111111";
const clone=v=>JSON.parse(JSON.stringify(v));
function fixture({legacy=false,denied=false,failure=null}={}) {
 const tables={employees:[{id:employeeId,museum_id:"m",profile_id:"target",access_level:"empleado"}],
 profiles:[{id:"target",museum_id:"m",role:"empleado",status:"active"}],
 roles:[{id:"e",code:"empleado",active:true},{id:"x",code:"ejecutivo",active:true},{id:"a",code:"administrador",active:true}],
 user_roles:[{museum_id:"m",user_id:"target",role_id:"e",valid_until:null}],audit_logs:[]};
 const calls=[];
 const admin={from(table){let op="read",payload,filters=[],mode="many",limit=Infinity;
 const q={select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},is(k,v){filters.push(r=>(r[k]??null)===v);return q;},
 in(k,v){filters.push(r=>v.includes(r[k]));return q;},limit(v){limit=v;return q;},single(){mode="one";return q;},
 update(v){op="update";payload=v;return q;},insert(v){op="insert";payload=v;return q;},upsert(v){op="upsert";payload=v;return q;},delete(){op="delete";return q;},
 then(resolve,reject){return Promise.resolve().then(()=>{
 calls.push({table,op,payload});
 if(legacy&&["roles","user_roles"].includes(table))return {error:{code:"PGRST205"}};
 if(failure?.({table,op,payload}))return {error:{code:"42501"}};
 let rows=tables[table],found=rows.filter(r=>filters.every(f=>f(r))).slice(0,limit);
 if(op==="update")found.forEach(r=>Object.assign(r,payload));
 if(op==="delete")tables[table]=rows.filter(r=>!found.includes(r));
 if(op==="insert")rows.push(clone(payload));
 if(op==="upsert"){let existing=rows.find(r=>r.role_id===payload.role_id&&r.user_id===payload.user_id&&r.museum_id===payload.museum_id);if(existing)Object.assign(existing,payload);else rows.push(clone(payload));}
 if(mode==="one"&&found.length!==1)return {error:{code:"PGRST116"}};
 return {data:clone(mode==="one"?found[0]:found),error:null};
 }).then(resolve,reject);}};return q;}};
 let handler;
 const ctx=vm.createContext({Date,console,Response,corsHeaders:{},json:(body,status=200)=>new Response(JSON.stringify(body),{status}),
 requirePermission:async(req,permission)=>{if(denied||permission!=="roles.assign")throw Error("FORBIDDEN");return {admin,user:{id:"actor"},profile:{museum_id:"m"}};},
 errorResponse:()=>new Response(JSON.stringify({error:"denied"}),{status:403}),Deno:{serve:fn=>handler=fn}});
 vm.runInContext(helpers,ctx);vm.runInContext(edge,ctx);
 return {tables,calls,ctx,admin,async invoke(body={}){const r=await handler({method:"POST",json:async()=>({employee_id:employeeId,role_code:"ejecutivo",expected_role:"empleado",...body})});return {status:r.status,body:await r.json()};}};
}
for(const legacy of [false,true])test("authorized level replacement, legacy="+legacy,async()=>{
 const f=fixture({legacy});const r=await f.invoke();assert.equal(r.status,200);assert.equal(r.body.assigned,true);
 assert.equal(f.tables.profiles[0].role,"ejecutivo");assert.equal(f.tables.profiles[0].status,"active");assert.equal(f.tables.employees[0].access_level,"ejecutivo");
 if(!legacy)assert.deepEqual(f.tables.user_roles.map(r=>r.role_id),["x"]);
 assert.equal(f.tables.audit_logs.at(-1).action,"ACCESS_LEVEL_CHANGED");
});
test("read reflects server roles instead of stale employee label",async()=>{
 const f=fixture();f.tables.user_roles.push({museum_id:"m",user_id:"target",role_id:"a"});
 const r=await f.invoke({action:"read"});assert.equal(r.body.role,"administrador");assert.equal(r.body.conflicting,true);
 assert.ok(f.calls.every(c=>c.op==="read"));
});
test("roles.assign is mandatory; denied request writes nothing",async()=>{
 const f=fixture({denied:true});assert.equal((await f.invoke()).status,403);assert.equal(f.calls.length,0);
});
test("replacement removes incompatible levels and preserves unrelated roles",async()=>{
 const f=fixture();f.tables.profiles[0].role="administrador";
 f.tables.user_roles.push({museum_id:"m",user_id:"target",role_id:"a"},{museum_id:"m",user_id:"target",role_id:"other"});
 const r=await f.invoke({role_code:"empleado",expected_role:"administrador"});assert.equal(r.body.assigned,true);
 assert.deepEqual(f.tables.user_roles.map(r=>r.role_id).sort(),["e","other"]);assert.equal(f.tables.profiles[0].role,"empleado");
});
test("stale request cannot overwrite a changed level",async()=>{
 const f=fixture();f.tables.profiles[0].role="administrador";assert.equal((await f.invoke()).status,409);assert.ok(f.calls.every(c=>c.op==="read"));
});
test("concurrent replacements do not accumulate access levels",async()=>{
 const f=fixture();const responses=await Promise.all([f.invoke(),f.invoke({role_code:"administrador"})]);
 assert.equal(responses.filter(r=>r.body.assigned).length,1);assert.equal(f.tables.user_roles.length,1);
});
for(const failed of ["profile","remove","assign","employee","audit"])test("failure never claims success: "+failed,async()=>{
 const f=fixture({failure:({table,op,payload})=>failed==="profile"?table==="profiles"&&payload?.role:failed==="remove"?op==="delete":failed==="assign"?op==="upsert":failed==="employee"?table==="employees"&&op==="update":table==="audit_logs"&&payload?.action==="ACCESS_LEVEL_CHANGED"});
 const result=await f.invoke();assert.equal(result.status,409);assert.notEqual(result.body.assigned,true);assert.equal(f.tables.profiles[0].status,"suspended");
});
test("unlinked employee stores intended level and audits it",async()=>{
 const f=fixture();f.tables.employees[0].profile_id=null;const r=await f.invoke();assert.equal(r.body.assigned,true);assert.equal(f.tables.employees[0].access_level,"ejecutivo");
 assert.ok(f.calls.every(c=>!["profiles","user_roles"].includes(c.table)));
});
function guard(permissions,authenticated=true){const redirects=[];let denied=false;
 const ctx=vm.createContext({getSupabaseSession:()=>authenticated?{access_token:"fixture"}:null,getCurrentPage:()=>"employee-portal.html",
 window:{location:{replace:url=>redirects.push(url)}},loginUrlWithReturn:()=>"login.html",showProtectedAccessDenied:()=>{denied=true;}});
 vm.runInContext(app.slice(app.indexOf("let currentPermissions ="),app.indexOf("function loginUrlWithReturn")),ctx);
 vm.runInContext(app.slice(app.indexOf("function enforceAuthenticatedPageAccess"),app.indexOf("async function refreshCurrentPermissions")),ctx);
 ctx.granted=permissions;vm.runInContext("currentPermissions = new Set(granted);currentPermissionsLoaded=true",ctx);
 return {blocked:ctx.enforceAuthenticatedPageAccess(),redirects,denied};}
for(const permissions of [["employees.read.self","time.clock"],["system.configure","employees.read.self"],["audit.read","notifications.manage","profile.read.self"]])test("personal portal stays accessible: "+permissions.join(","),()=>{
 const r=guard(permissions);assert.equal(r.blocked,false);assert.equal(r.redirects.length,0);
});
test("personal portal rejects anonymous and permissionless access",()=>{assert.equal(guard([],false).redirects[0],"login.html");assert.equal(guard([]).denied,true);});
test("Mi cuenta points to authenticated personal information",()=>{
 assert.match(app,/href: "employee-portal.html", label: "Mi cuenta"/);
 assert.match(app,/<a href="employee-portal.html">Mi cuenta<\/a>/);
 assert.doesNotMatch(app,/href: "login.html", label: "Mi cuenta"/);
 assert.match(read("../../employee-portal.html"),/data-portal-account/);
});
test("personal data queries scope administrator to own employee",async()=>{
 const urls=[];const ctx=vm.createContext({URL,Date,employeeInitials:()=>"U",supabaseUrl:"https://fixture.invalid",supabaseAuthHeaders:async()=>({}),fetch:async url=>{
 urls.push(url);return new Response(JSON.stringify(url.endsWith("/auth/v1/user")?{id:"own-user"}:url.includes("/employees?")?[{id:employeeId,profile_id:"own-user",first_name:"Own"}]:[]));}});
 vm.runInContext(service,ctx);
 await ctx.fetchOwnSupabaseTimeEntries();await ctx.fetchOwnSupabaseAttendanceEvents();await ctx.fetchOwnSupabaseCorrectionShifts();await ctx.fetchOwnSupabaseCorrectionRequests();
 assert.ok(urls.filter(u=>u.includes("/employees?")).every(u=>u.includes("profile_id=eq.own-user")));
 for(const table of ["employee_time_entries","attendance_events","employee_shifts"])assert.ok(urls.find(u=>u.includes("/"+table+"?")).includes("employee_id=eq."+employeeId));
 assert.ok(urls.find(u=>u.includes("/attendance_correction_requests?")).includes("requested_by=eq.own-user"));
});

for (const permissions of [["profile.read.self"],["profile.read.self","schedules.read.self","time.clock","time.read.self"]]) test("portal renders only permitted personal tools: "+permissions.join(","),async()=>{
 const elements=new Map();const calls=[];
 function element(key){if(!elements.has(key))elements.set(key,{hidden:false,textContent:"",dataset:{},classList:{toggle(){}},closest(){return element(key+" parent");},setAttribute(k){if(k==="hidden")this.hidden=true;},addEventListener(k,fn){this[k]=fn;}});return elements.get(key);}
 const ctx=vm.createContext({Date,Boolean,Promise,document:{querySelector:element},navigator:{},
 getSupabaseSession:()=>({access_token:"fixture",user:{id:"own"}}),fetchSupabaseProfile:async()=>({email:"own@example.invalid"}),
 fetchOwnSupabaseEmployee:async()=>({id:employeeId,nombre:"Own",correo:"own@example.invalid",horario:"09:00",posicion:"Director"}),
 employeeDisplayName:()=>"Own",hasPermission:p=>permissions.includes(p),formatPortalDate:()=>"date",renderPortalTools(){},
 fetchOwnSupabaseTimeEntries:async(n,id)=>{calls.push(["time",id]);return [];},fetchOwnSupabaseAttendanceEvents:async(n,id)=>{calls.push(["events",id]);return [];},
 renderPortalTimeEntries(){},fetchOwnSupabaseNotifications:async()=>{throw Error("notifications not permitted");},renderPortalNotifications(){},
 bindPortalAttendanceCorrections:()=>{throw Error("corrections not permitted");}});
 vm.runInContext(app.slice(app.indexOf("async function bindEmployeePortal()"),app.indexOf("function ensureEnvironmentOnLocalAuthCallback")),ctx);
 await ctx.bindEmployeePortal();
 assert.equal(element("[data-portal-clock-button]").hidden,!permissions.includes("time.clock"));
 assert.equal(element(".portal-schedule").hidden,!permissions.includes("schedules.read.self"));
 assert.equal(element("[data-portal-time-list] parent").hidden,!permissions.includes("time.read.self"));
 assert.match(element("[data-portal-account]").textContent,/own@example.invalid/);
 assert.equal(calls.length,permissions.includes("time.read.self")?2:0);
 assert.ok(calls.every(c=>c[1]===employeeId));
 if(!permissions.includes("time.clock"))await element("[data-portal-clock-button]").click();
});
test("tenant mismatch cannot read or change another employee",async()=>{
 const f=fixture();f.tables.employees[0].museum_id="other";
 assert.notEqual((await f.invoke()).status,200);assert.ok(f.calls.every(c=>c.op==="read"));
});
test("level service reports assignment failures instead of success",async()=>{
 const ctx=vm.createContext({supabaseUrl:"https://fixture.invalid",supabaseAuthHeaders:async()=>({}),fetch:async()=>new Response(JSON.stringify({error:"assignment failed"}),{status:409})});
 vm.runInContext(service,ctx);await assert.rejects(ctx.assignSupabaseEmployeeLevel(employeeId,"ejecutivo","empleado"),/assignment failed/);
});
