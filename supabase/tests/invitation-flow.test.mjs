import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
const service = fs.readFileSync(new URL("../../js/services/supabase.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../../js/app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../../login.html", import.meta.url), "utf8");
const edge = fs.readFileSync(new URL("../functions/invite-employee/index.ts", import.meta.url), "utf8");
const edgeJS = stripTypeScriptTypes(edge.replace(/^import[^\n]+\n/,""));
const clone = value => JSON.parse(JSON.stringify(value));
const storage = () => { const data=new Map(); return { getItem:k=>data.get(k)??null, setItem:(k,v)=>data.set(k,String(v)), removeItem:k=>data.delete(k) }; };
const response = (data,status=200) => new Response(JSON.stringify(data),{status});
const authUser={id:"u1",email:"fixture@example.invalid",email_confirmed_at:"2026-01-01",invited_at:"2026-01-01"};
const session={access_token:"fixture-token",refresh_token:"fixture-refresh",user:{id:"u1"},setup_type:"invite"};
function serviceContext(overrides={}) {
  const calls=[];
  const context=vm.createContext({
    URL,Date,Object,localStorage:storage(),supabaseUrl:"https://fixture.supabase.invalid",
    supabaseHeaders:()=>({"Content-Type":"application/json"}),supabaseAuthHeaders:async()=>({}),
    fetch:async(url,options={})=>{
      calls.push({url,options});
      if(url.includes("/auth/v1/user"))return response(authUser);
      if(url.includes("/profiles?"))return response([{id:"u1",museum_id:"m1",email:authUser.email,status:"active"}]);
      if(url.includes("/employees?"))return response([{id:"e1",profile_id:"u1",museum_id:"m1",email:authUser.email}]);
      if(url.includes("/user_roles?"))return response([{museum_id:"m1",roles:{code:"empleado"}}]);
      if(url.includes("/logout"))return response({});
      throw Error("Unexpected mock URL");
    },...overrides
  });
  vm.runInContext(service,context);return {context,calls};
}
function server(options={}) {
  const state={failure:null,sent:0,calls:[],logs:[],users:[],tables:{
    employees:[{id:"e1",museum_id:"m1",email:authUser.email,first_name:"Fixture",last_name:"User",profile_id:null}],
    profiles:[],roles:[{id:"r1",code:"empleado"}],user_roles:[],audit_logs:[]
  }};
  Object.assign(state,options.state);
  let handler;
  const dbError=(message="internal column fixture",code="42501")=>({code,message,details:"technical fixture detail"});
  const admin={
    auth:{admin:{
      listUsers:async({page,perPage})=>({data:{users:clone(state.users.slice((page-1)*perPage,page*perPage))}}),
      inviteUserByEmail:async(email,config)=>{
        state.calls.push({op:"invite",config});
        if(state.failure==="send")return {error:{status:400,message:"internal Auth error"}};
        if(state.failure==="uncertain")throw Error("transport fixture error");
        state.sent++;
        const account=clone(authUser);state.users.push(account);
        state.tables.profiles.push({id:"u1",museum_id:"m1",email,full_name:"Fixture User",role:"empleado",status:"active"});
        if(state.failure==="lost-after")throw Error("lost response after send");
        return {data:{user:clone(account)}};
      },
      updateUserById:()=>{throw Error("Forbidden Auth update");},
      deleteUser:()=>{throw Error("Forbidden Auth delete");}
    }},
    from(table) {
      let op="read",payload,selection="",limit=Infinity,mode="many",filters=[];
      const q={
        select(value){selection=value;return q;},eq(k,v){filters.push(row=>row[k]===v);return q;},
        ilike(k,v){const exact=v.replace(/\\([\\%_])/g,"$1").toLowerCase();filters.push(row=>String(row[k]).toLowerCase()===exact);return q;},
        is(k,v){filters.push(row=>(row[k]??null)===v);return q;},limit(v){limit=v;return q;},
        single(){mode="one";return q;},maybeSingle(){mode="maybe";return q;},
        update(v){op="update";payload=v;return q;},upsert(v){op="upsert";payload=v;return q;},
        insert(v){op="insert";payload=v;return q;},
        then(resolve,reject){
          return Promise.resolve().then(()=>{
            state.calls.push({table,op,payload:clone(payload??null),selection});
            if(table==="audit_logs"&&op==="read"&&limit===0&&selection==="actor_user_id"&&options.schema==="legacy")
              return {error:{code:"PGRST204",message:"Could not find the 'actor_user_id' column of 'audit_logs' in the schema cache"}};
            if(table==="audit_logs"&&op==="read"&&limit===0&&options.schema==="trigger")
              return {error:{code:"42703",message:"column actor_user_id missing inside trigger"}};
            if(table==="profiles"&&op==="update"&&state.failure==="profile")return {error:dbError()};
            if(table==="employees"&&op==="update"&&state.failure==="employee")return {error:dbError()};
            if(table==="user_roles"&&op==="upsert"&&state.failure==="role")return {error:dbError()};
            if(table==="audit_logs"&&op==="insert"&&payload.action==="USER_INVITED"&&state.failure==="audit")return {error:dbError()};
            const rows=state.tables[table];
            let found=rows.filter(row=>filters.every(f=>f(row))).slice(0,limit);
            if(op==="update")found.forEach(row=>Object.assign(row,payload));
            if(op==="insert"){
              if(rows.some(row=>row.id===payload.id))return {error:dbError("duplicate id","23505")};
              rows.push(clone(payload));return {data:null,error:null};
            }
            if(op==="upsert"){
              if(!rows.some(row=>row.museum_id===payload.museum_id&&row.user_id===payload.user_id&&row.role_id===payload.role_id))rows.push(clone(payload));
              return {data:null,error:null};
            }
            if(mode==="one"&&found.length!==1)return {error:dbError("not one","PGRST116")};
            if(mode==="maybe"&&found.length>1)return {error:dbError("multiple","PGRST116")};
            return {data:clone(mode==="many"?found:found[0]??null),error:null};
          }).then(resolve,reject);
        }
      };return q;
    }
  };
  const context=vm.createContext({
    Response,URL,TextEncoder,crypto:webcrypto,console:{error:(...args)=>state.logs.push(args)},corsHeaders:{},
    json:(data,status=200)=>response(data,status),
    requirePermission:async()=>{if(options.denied)throw Error("FORBIDDEN");return {admin,user:{id:"admin"},profile:{museum_id:"m1"}};},
    Deno:{serve:fn=>{handler=fn;},env:{get:key=>key==="SUPABASE_URL"?(options.project??"https://kfokfjngozgcwjpzxcsu.supabase.co"):options.redirect}}
  });
  vm.runInContext(edgeJS,context);
  return {state,context,async invoke(action="invite",body={}) {
    const r=await handler({method:"POST",json:async()=>({employee_id:"e1",action,...body})});
    return {status:r.status,data:await r.json()};
  }};
}

test("no Auth mutation or deletion remains in invitation function",()=>{
  assert.doesNotMatch(edge,/ban_duration|deleteUser|updateUserById/);
});
test("successful invitation and repeat are idempotent",async()=>{
  const s=server();
  assert.equal((await s.invoke()).data.code,"invite_sent_linked");
  assert.equal((await s.invoke()).data.code,"invite_sent_linked");
  assert.equal((await s.invoke("repair")).data.code,"invite_sent_linked");
  assert.equal(s.state.sent,1);
  assert.equal(s.state.tables.user_roles.length,1);
  assert.equal(s.state.tables.audit_logs.filter(x=>x.action==="USER_INVITED").length,1);
});
for(const failure of ["profile","employee","role","audit"])test("repair after "+failure+" never sends again",async()=>{
  const s=server();s.state.failure=failure;
  const partial=await s.invoke();
  assert.equal(partial.data.code,"invite_sent_link_pending");
  assert.doesNotMatch(partial.data.message,/No se pudo enviar/);
  assert.equal(s.state.users.length,1);
  s.state.failure=null;
  assert.equal((await s.invoke("repair")).data.code,"invite_sent_linked");
  assert.equal(s.state.sent,1);
  assert.ok(s.state.logs.some(log=>log[1].code==="42501"&&log[1].detail));
});
test("definite send failure has invite_failed and no identity writes",async()=>{
  const s=server();s.state.failure="send";
  assert.equal((await s.invoke()).data.code,"invite_failed");
  assert.equal(s.state.sent,0);assert.equal(s.state.users.length,0);
});
test("uncertain dispatch is never classified as a definite failure or retried",async()=>{
  const s=server();s.state.failure="uncertain";
  assert.equal((await s.invoke()).data.code,"invite_status_unknown");
  s.state.failure=null;
  assert.equal((await s.invoke()).data.code,"invite_status_unknown");
  assert.equal((await s.invoke("repair")).data.code,"invite_status_unknown");
  assert.equal(s.state.calls.filter(c=>c.op==="invite").length,1);
});
test("concurrent initial requests dispatch at most once",async()=>{
  const s=server();await Promise.all([s.invoke(),s.invoke()]);
  assert.equal(s.state.sent,1);
  assert.equal((await s.invoke("repair")).data.code,"invite_sent_linked");
});
test("repair without an existing identity never sends",async()=>{
  const s=server();await s.invoke("repair");assert.equal(s.state.sent,0);
});
for(const kind of ["permission","missing","museum","email","duplicate","role","profile"])test("preflight "+kind+" rejects before send",async()=>{
  const s=server({denied:kind==="permission"});
  if(kind==="missing")s.state.tables.employees=[];
  if(kind==="museum")s.state.tables.employees[0].museum_id="other";
  if(kind==="email")s.state.tables.employees[0].email="bad";
  if(kind==="duplicate")s.state.tables.employees.push({...s.state.tables.employees[0],id:"e2"});
  if(kind==="role")s.state.tables.roles=[];
  if(kind==="profile")s.state.tables.employees[0].profile_id="other";
  assert.equal((await s.invoke()).data.code,"invite_failed");
  assert.equal(s.state.sent,0);
});
for(const [project,redirect] of [
  ["https://kfokfjngozgcwjpzxcsu.supabase.co","https://mmdpr.org/login.html"],
  ["https://lonpdmxdvbxuagqxztig.supabase.co","https://demo.instituva.com/login.html"],
  ["http://127.0.0.1:54321","http://localhost:3000/login.html"],
  ["http://kong:8000","http://localhost:5173/login.html"]
])test("closed redirect "+redirect,async()=>{
  const s=server({project,redirect});await s.invoke("invite",{redirectTo:"https://evil.invalid",redirect_to:"https://evil.invalid"});
  assert.equal(s.state.calls.find(c=>c.op==="invite").config.redirectTo,redirect);
});
for(const [project,redirect] of [
  ["https://unknown.invalid",undefined],
  ["https://kfokfjngozgcwjpzxcsu.supabase.co","https://evil.invalid/login.html"],
  ["https://kfokfjngozgcwjpzxcsu.supabase.co","https://demo.instituva.com/login.html"],
  ["http://localhost:54321","http://localhost:9999/login.html"],
  ["http://localhost:54321","http://localhost:5173/login.html?next=https://evil.invalid"]
])test("unrecognized redirect rejected: "+project+" "+redirect,async()=>{
  const s=server({project,redirect});assert.equal((await s.invoke()).data.code,"invite_failed");assert.equal(s.state.sent,0);
});
test("legacy audit fallback is read-only and happens before send",async()=>{
  const s=server({schema:"legacy"});assert.equal((await s.invoke()).data.code,"invite_sent_linked");
  const insert=s.state.calls.find(c=>c.table==="audit_logs"&&c.op==="insert");
  assert.equal(insert.payload.user_id,"admin");assert.equal(insert.payload.actor_user_id,undefined);
  assert.ok(s.state.calls.findIndex(c=>c.selection==="user_id")<s.state.calls.findIndex(c=>c.op==="invite"));
});
test("trigger errors are not treated as audit schema incompatibility",async()=>{
  const s=server({schema:"trigger"});await s.invoke();assert.equal(s.state.sent,0);
  assert.ok(!s.state.calls.some(c=>c.selection==="user_id"));
});
test("frontend response contains only controlled code stage and safe message",async()=>{
  const s=server();s.state.failure="audit";const r=await s.invoke();
  assert.deepEqual(Object.keys(r.data).sort(),["code","message","stage"]);
  assert.doesNotMatch(JSON.stringify(r.data),/actor_user_id|audit_logs|fixture|token|42501/);
});
test("server logs redact credentials and retain technical error fields",()=>{
  const s=server();s.context.logFailure("link",{code:"TEST",message:"Bearer secret access_token=foo fixture@example.invalid",details:"technical problem"});
  const log=s.state.logs.at(-1)[1];assert.equal(log.code,"TEST");assert.equal(log.details,"technical problem");
  assert.doesNotMatch(log.detail,/secret|foo|fixture@example/);
});
test("service uses invitation token and never ordinary login token",async()=>{
  const {context,calls}=serviceContext({getSupabaseSession:()=>{throw Error("must not read");}});
  await context.updateSupabaseSetupPassword(clone(session),"FixturePassword123!");
  assert.ok(calls.every(c=>c.options.headers.Authorization==="Bearer fixture-token"));
  assert.equal(calls.filter(c=>c.options.method==="PUT").length,1);
});
for(const [path,data,code] of [
  ["/profiles?",[],"invalid_profile"],["/employees?",[],"invalid_employee"],["/user_roles?",[],"invalid_role"],
  ["/auth/v1/user",{...authUser,email_confirmed_at:null},"unconfirmed"]
])test("validation rejects "+code+" before password write",async()=>{
  const {context,calls}=serviceContext();const original=context.fetch;
  context.fetch=async(url,opts)=>url.includes(path)?response(data):original(url,opts);
  await assert.rejects(context.updateSupabaseSetupPassword(clone(session),"FixturePassword123!"),e=>e.code===code);
  assert.equal(calls.filter(c=>c.options.method==="PUT").length,0);
});
test("Auth and PostgREST messages are not shown to the user",async()=>{
  const {context}=serviceContext({fetch:async()=>response({message:"internal audit_logs secret"},403)});
  await assert.rejects(context.validateSupabasePasswordSetupSession(clone(session),"invite"),e=>!/audit_logs|secret/.test(e.message)&&e.code==="acceptance_failed");
  assert.doesNotMatch(context.safePasswordSetupMessage(Error("internal secret")),/secret/);
});
for(const code of ["invite_failed","invite_sent_link_pending","invite_sent_linked"])test("frontend recognizes "+code,async()=>{
  const {context}=serviceContext({fetch:async()=>response({code,stage:"link",message:"internal malicious detail"},code==="invite_failed"?400:200)});
  const r=await context.inviteSupabaseEmployee("e1","repair");assert.equal(r.code,code);assert.doesNotMatch(r.message,/internal malicious/);
});
test("PKCE verifier is removed even on rejection",async()=>{
  const {context}=serviceContext({fetch:async()=>response({},400)});
  context.localStorage.setItem("sb-fixture-auth-token-code-verifier","fixture-verifier");
  await assert.rejects(context.exchangeSupabasePasswordSetupCode("fixture-code"));
  assert.equal(context.localStorage.getItem("sb-fixture-auth-token-code-verifier"),null);
});
test("PKCE and token hash exchange use only explicit credentials",async()=>{
  const calls=[];
  const {context}=serviceContext({fetch:async(url,opts)=>{calls.push({url,opts});return response(session);}});
  context.localStorage.setItem("sb-fixture-auth-token-code-verifier",JSON.stringify("fixture-verifier/PASSWORD_RECOVERY"));
  await context.exchangeSupabasePasswordSetupCode("fixture-code");
  await context.verifySupabaseEmailToken({token_hash:"fixture-hash",type:"invite"});
  assert.deepEqual(JSON.parse(calls[0].opts.body),{auth_code:"fixture-code",code_verifier:"fixture-verifier"});
  assert.deepEqual(JSON.parse(calls[1].opts.body),{token_hash:"fixture-hash",type:"invite"});
});

function ui(callback={},overrides={}) {
  const elements=new Map(),events={};
  const state={updated:0,redirect:null,cleaned:false,closed:[]};
  function element(key){
    if(!elements.has(key))elements.set(key,{hidden:false,disabled:false,textContent:"",listeners:{},elements:{username:{value:""}},
      addEventListener(name,fn){this.listeners[name]=fn;},reset(){state.reset=true;},
      querySelector(){return element("submit");},querySelectorAll(){return [element("password"),element("confirmation"),element("submit")];}});
    return elements.get(key);
  }
  const helpers=serviceContext().context;
  const context=vm.createContext({
    URL,URLSearchParams,Promise,JSON,Object,Set,
    document:{querySelector:element},
    window:{location:{href:"https://fixture.invalid/login.html#access_token=fixture-token",search:"",replace:url=>{state.redirect=url;}},
      history:{replaceState(){state.cleaned=true;}},addEventListener:(name,fn)=>events[name]=fn},
    sessionStorage:storage(),localStorage:storage(),passwordSetupPendingKey:"setup",
    getAuthCallbackParams:()=>clone(callback),isPasswordSetupCallback:p=>Boolean(p.type||p.code||p.access_token||p.token_hash||p.error),
    markPasswordSetupPending(){},clearPasswordSetupPending(){},isPasswordSetupPending:()=>false,
    validateSupabasePasswordSetupSession:async candidate=>{if(!candidate?.access_token)throw helpers.passwordSetupError("invalid_link");return {...candidate,user:{id:"u1"},setup_type:"invite"};},
    verifySupabaseEmailToken:async()=>clone(session),exchangeSupabasePasswordSetupCode:async()=>clone(session),
    updateSupabaseSetupPassword:async s=>{assert.equal(s.access_token,"fixture-token");state.updated++;},
    closeSupabasePasswordSetupSession:async s=>{state.closed.push(s.access_token);},
    getSupabaseSession:()=>{throw Error("must not read ordinary session");},
    passwordSetupError:helpers.passwordSetupError,safePasswordSetupMessage:helpers.safePasswordSetupMessage,
    clearPasswordSetupVerifier(){},passwordRecoveryRedirectUrl:()=>"https://fixture.invalid/login.html",
    FormData:class{get(){return "FixturePass123!";}delete(){}},
    ...overrides
  });
  const start=app.indexOf("function bindLoginDemo()");
  vm.runInContext(app.slice(start,app.indexOf("function bindIdleLogout()",start)),context);
  context.bindLoginDemo();
  return {context,state,events,element,submit:()=>element("[data-invite-password-form]").listeners.submit({preventDefault(){}})};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test("URL is cleaned immediately and all fields disabled until validation",async()=>{
  let release;
  const u=ui({access_token:"fixture-token",type:"invite"},{validateSupabasePasswordSetupSession:()=>new Promise(r=>{release=r;})});
  assert.equal(u.state.cleaned,true);assert.equal(u.element("password").disabled,true);
  await u.submit();assert.equal(u.state.updated,0);
  await tick();release(clone(session));await tick();
  assert.equal(u.element("password").disabled,false);
  await u.submit();assert.equal(u.state.updated,1);
  assert.match(u.state.redirect,/reason=password-created$/);
  assert.equal(u.element("password").disabled,true);
  assert.equal(u.context.sessionStorage.getItem("setup-session"),null);
  assert.ok(u.state.closed.includes("fixture-token"));
});
for(const ending of ["failure","cancel","pagehide"])test("temporary tokens erased on "+ending,async()=>{
  const held=clone(session);
  const u=ui({access_token:"fixture-token",type:"invite"},{
    validateSupabasePasswordSetupSession:async()=>held,
    ...(ending==="failure"?{updateSupabaseSetupPassword:async()=>{throw Error("internal secret");}}:{})
  });
  await tick();
  assert.equal(u.context.sessionStorage.getItem("setup-session"),null);
  if(ending==="failure")await u.submit();
  else if(ending==="cancel")u.element("[data-password-setup-cancel]").listeners.click();
  else u.events.pagehide();
  await tick();
  assert.equal(held.access_token,undefined);assert.equal(held.refresh_token,undefined);assert.equal(held.user,undefined);
  assert.equal(u.element("submit").disabled,true);assert.ok(u.state.closed.includes("fixture-token"));
  assert.doesNotMatch(u.element("[data-login-message]").textContent,/internal secret/);
  await u.submit();assert.equal(u.state.updated,0);
});
test("cancellation during validation cannot restore a session later",async()=>{
  let release;const held=clone(session);
  const u=ui({access_token:"fixture-token",type:"invite"},{validateSupabasePasswordSetupSession:()=>new Promise(r=>{release=r;})});
  await tick();u.element("[data-password-setup-cancel]").listeners.click();
  release(held);await tick();
  assert.equal(held.access_token,undefined);assert.equal(u.element("submit").disabled,true);
});
test("old persisted setup session and previous login session are never adopted",async()=>{
  const saved=storage();saved.setItem("setup-session",JSON.stringify({access_token:"other-account"}));
  const u=ui({},{sessionStorage:saved,isPasswordSetupPending:()=>true});
  await tick();await u.submit();assert.equal(u.state.updated,0);
  assert.equal(saved.getItem("setup-session"),null);assert.equal(u.element("submit").disabled,true);
});
test("password mismatch cannot write Auth",async()=>{
  const u=ui({access_token:"fixture-token",type:"invite"},{FormData:class{get(key){return key==="password"?"FixturePass123!":"WrongPass123!";}delete(){}}});
  await tick();await u.submit();assert.equal(u.state.updated,0);
  assert.match(u.element("[data-invite-password-message]").textContent,/no coinciden/);
});
test("logout rejection still clears local credentials and does not claim full success",async()=>{
  const held=clone(session);
  const u=ui({access_token:"fixture-token",type:"invite"},{validateSupabasePasswordSetupSession:async()=>held,closeSupabasePasswordSetupSession:async()=>{throw Error("network");}});
  await tick();await u.submit();
  assert.equal(held.access_token,undefined);assert.match(u.state.redirect,/logout-pending/);
});
test("inline capture strips query and fragment credentials before asset loading",()=>{
  const inline=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  let clean;
  const window={location:{href:"https://mmdpr.org/login.html?code=fixture-code&environment=production#access_token=fixture-token&type=invite"},
    history:{replaceState:(a,b,url)=>{clean=url;}},addEventListener(){}};
  vm.runInNewContext(inline,{window,URL,URLSearchParams});
  assert.equal(clean,"/login.html?environment=production");
  assert.equal(window.__instituvaAuthCallback.access_token,"fixture-token");
  assert.ok(html.indexOf(inline)<html.indexOf('src="js/config.js'));
});
test("repair button requests repair explicitly and never auto-retries",async()=>{
  let click;const calls=[];
  const button={disabled:false,addEventListener:(event,fn)=>{click=fn;}};
  const context=vm.createContext({
    invitationRepairOnly:false,inviteButton:button,profile:{id:"e1"},window:{confirm:()=>true},
    employeeDisplayName:()=>"Fixture",setProfileMessage(){},updateInviteButton:()=>{button.disabled=false;},
    inviteSupabaseEmployee:async(id,action)=>{calls.push(action);return {code:"invite_sent_link_pending",message:"Invitación enviada"};}
  });
  const start=app.indexOf('  inviteButton?.addEventListener("click"');
  vm.runInContext(app.slice(start,app.indexOf('  saveButton?.addEventListener',start)),context);
  await click();assert.deepEqual(calls,["invite"]);
  await click();assert.deepEqual(calls,["invite","repair"]);
});

test("a lost Auth response is repaired from the existing identity without resending",async()=>{
  const s=server();s.state.failure="lost-after";
  assert.equal((await s.invoke()).data.code,"invite_status_unknown");
  assert.equal(s.state.sent,1);s.state.failure=null;
  assert.equal((await s.invoke("repair")).data.code,"invite_sent_linked");
  assert.equal(s.state.sent,1);
});
test("an expired assigned role is not silently renewed",async()=>{
  const s=server();await s.invoke();
  s.state.tables.user_roles[0].valid_until="2000-01-01";
  assert.equal((await s.invoke("repair")).data.code,"invite_sent_link_pending");
  assert.equal(s.state.tables.user_roles[0].valid_until,"2000-01-01");
  assert.equal(s.state.sent,1);
});
test("ordinary pre-existing Auth accounts are not adopted or invited",async()=>{
  const s=server();
  s.state.users=[{...authUser,invited_at:null}];
  s.state.tables.profiles=[{id:"u1",museum_id:"m1",email:authUser.email,role:"empleado",status:"active"}];
  assert.equal((await s.invoke()).data.code,"invite_failed");
  assert.equal(s.state.sent,0);
});
test("an invitation callback requires an invited Auth account",async()=>{
  const {context}=serviceContext({fetch:async()=>response({...authUser,invited_at:null})});
  await assert.rejects(context.validateSupabasePasswordSetupSession(clone(session),"invite"),e=>e.code==="invalid_link");
});
test("HTML password fields start disabled",()=>{
  assert.match(html,/<input id="invite-password" disabled/);
  assert.match(html,/<input id="invite-password-confirmation" disabled/);
});
test("legacy page redirects remove credentials instead of forwarding them",()=>{
  const params={access_token:"fixture-token",refresh_token:"fixture-refresh",type:"invite"};
  const urls=[];
  const context=vm.createContext({
    URL,Object,window:{location:{href:"https://mmdpr.org/dashboard.html?access_token=fixture-token#refresh_token=fixture-refresh",replace:u=>urls.push(u)},
      history:{replaceState:(a,b,u)=>urls.push(u)}},
    getAuthCallbackParams:()=>params,isPasswordSetupCallback:()=>true,isLoginPage:()=>false,
    sessionStorage:storage(),passwordSetupPendingKey:"setup",clearPasswordSetupPending(){},clearPasswordSetupVerifier(){},
    passwordRecoveryRedirectUrl:()=>"https://mmdpr.org/login.html"
  });
  const start=app.indexOf("function redirectAuthCallbackToLogin()");
  vm.runInContext(app.slice(start,app.indexOf("function bindInstituvaAppLinks()",start)),context);
  context.redirectAuthCallbackToLogin();
  assert.ok(urls.every(u=>!/fixture|access_token|refresh_token/.test(u)));
  assert.equal(params.access_token,undefined);
  assert.match(urls.at(-1),/reason=invalid-link/);
});
