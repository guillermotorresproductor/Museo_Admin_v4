// Staging only. No secret/service key, forged JWT, production writes or user credentials in logs.
"use strict";
const assert=require("node:assert/strict");
const {randomUUID,randomBytes}=require("node:crypto");
const fs=require("node:fs");
const source=fs.readFileSync("js/config.js","utf8");
const staging=source.match(/staging:\s*Object\.freeze\(\{([\s\S]*?)\}\)/)?.[1]||"";
const url=staging.match(/supabaseUrl:\s*"([^"]+)"/)?.[1];
const key=staging.match(/supabasePublishableKey:\s*"([^"]+)"/)?.[1];
assert.equal(url,"https://lonpdmxdvbxuagqxztig.supabase.co");
assert.match(key||"",/^sb_publishable_[A-Za-z0-9_-]{20,}$/);
assert.equal(process.env.INSTITUVA_E2E_STAGING_ONLY,"lonpdmxdvbxuagqxztig");
const marker="instituva-e2e-"+randomBytes(9).toString("hex");
const email=marker+"@example.invalid";
const password="P4!"+randomBytes(26).toString("base64url");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function api(path,body,accessToken){
 const response=await fetch(url+path,{method:"POST",headers:{
  "apikey":key,"Content-Type":"application/json",
  ...(accessToken?{"Authorization":"Bearer "+accessToken}:{})
 },body:JSON.stringify(body),signal:AbortSignal.timeout(20000),redirect:"error"});
 const data=await response.json().catch(()=>({}));
 return {status:response.status,data};
}
(async()=>{
 const made=await api("/auth/v1/signup",{email,password,data:{full_name:"INSTITUVA AI E2E disposable actor"}});
 if(![200,201].includes(made.status) || !made.data.user?.id){
  console.log("STAGING_E2E_SIGNUP_UNAVAILABLE",made.status,typeof made.data.msg==="string"?made.data.msg.slice(0,100):"");
  process.exitCode=2;return;
 }
 const id=made.data.user.id;
 assert.match(id,/^[0-9a-f-]{36}$/i);
 console.log("STAGING_E2E_USER_CREATED",id);
 let jwt=made.data.session?.access_token;
 for(let attempt=0;attempt<75;attempt++){
  if(jwt)break;
  const login=await api("/auth/v1/token?grant_type=password",{email,password});
  if(login.status===200 && login.data.access_token) jwt=login.data.access_token;
  else await sleep(2000);
 }
 if(!jwt){console.log("STAGING_E2E_ACTIVATION_TIMED_OUT",id);process.exitCode=3;return;}
 const user=await fetch(url+"/auth/v1/user",{headers:{apikey:key,Authorization:"Bearer "+jwt},signal:AbortSignal.timeout(20000)}).then(r=>r.json());
 assert.equal(user.id,id,"Auth issued JWT not bound to disposable account");
 console.log("STAGING_E2E_SIGNED_JWT_VERIFIED",id);
 // Wait for the authorized, synthetic employee, schedule, and punches to be provisioned.
 let complete=false;
 for(let attempt=0;attempt<55;attempt++){
  const r=await api("/functions/v1/instituva-ai-assistant",{
   mode:"auto",question:"¿Cuántas horas trabajó Roberto Diagnostico en noviembre de 2026?"
  },jwt);
  if(r.status===200){
   assert.equal(r.data.mode,"attendance");
   assert.equal(r.data.read_only,true);
   assert.equal(r.data.actions_executed,false);
   assert.equal(r.data.diagnostic_contract,"read_only_v1");
   assert.match(r.data.answer,/8 h 00 min/);
   assert.equal(r.data.evidence.verified_net_minutes,480);
   assert.equal(r.data.evidence.verified_days,1);
   const context=r.data.conversation_context;
   assert.equal(context.employee_name,"Roberto Diagnostico");
   assert.equal(context.mode,"attendance");
   assert.match(context.start_day,/^2026-11/);
   console.log("STAGING_E2E_ATTENDANCE_VERIFIED",480);
   const second=await api("/functions/v1/instituva-ai-assistant",{
    mode:"auto",question:"¿Y cuántos días llegó tarde?",conversation_context:context
   },jwt);
   assert.equal(second.status,200);
   assert.match(second.data.answer,/Entradas posteriores al inicio programado/);
   assert.equal(second.data.evidence.entries_after_scheduled_start,0);
   console.log("STAGING_E2E_FOLLOWUP_ARRIVALS_VERIFIED");
   const third=await api("/functions/v1/instituva-ai-assistant",{
    mode:"auto",question:"¿Encontraste alguna irregularidad?",conversation_context:context
   },jwt);
   assert.equal(third.status,200);
   assert.match(third.data.answer,/Incidencias documentales/);
   assert.equal(third.data.actions_executed,false);
   console.log("STAGING_E2E_INCIDENT_FOLLOWUP_VERIFIED");
   complete=true;break;
  }
  if(![403,404,422,503].includes(r.status)){
   console.log("STAGING_E2E_UNEXPECTED_STATUS",r.status,typeof r.data.error==="string"?r.data.error.slice(0,150):"");
   process.exitCode=4;return;
  }
  await sleep(2000);
 }
 if(!complete){console.log("STAGING_E2E_PROVISIONING_TIMED_OUT",id);process.exitCode=5;return;}
 console.log("STAGING_E2E_PASS_SIGNED_USER_READ_ONLY_THREE_TURNS",id);
})().catch(e=>{console.error("STAGING_E2E_FAILED",e.message);process.exitCode=1;});
