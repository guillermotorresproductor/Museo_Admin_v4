// Opt-in authenticated E2E for name disambiguation in the EXACT AI staging museum.
// Requires only temporary synthetic employees, shift, alert and open time entry.
// Never creates immutable attendance_attempts/events; those are tested in rolled-back SQL.
// Never logs passwords, JWTs, service keys, actual user names or prompt content.
// Required local variables: INSTITUVA_AI_TEST_SERVICE_KEY, INSTITUVA_AI_TEST_ANON_KEY,
// INSTITUVA_AI_E2E_CONFIRM_STAGING=<exact staging ref>.
// No production URL, no changes to any existing employee, role, audit or permission.
import assert from "node:assert/strict";
import {randomBytes,randomUUID} from "node:crypto";
import {assertStagingLegacyApiKeys,STAGING_REF,STAGING_URL} from "./instituva-ai-staging-key-guard.mjs";

const allowedMuseum="3a605399-ff3b-4214-884f-d42aaadb0856";
const key=process.env.INSTITUVA_AI_TEST_SERVICE_KEY;
const anon=process.env.INSTITUVA_AI_TEST_ANON_KEY;
assertStagingLegacyApiKeys({
 serviceKey:key,anonKey:anon,
 confirmRef:process.env.INSTITUVA_AI_E2E_CONFIRM_STAGING,
 url:process.env.SUPABASE_URL
});
const marker="instituva-ai-name-e2e-"+randomBytes(7).toString("hex");
const created={museums:[],users:[],employees:[],shifts:[],entries:[],alerts:[],
 permissions:[],settings:[]};
let failed=false;
const checks=[];
const check=(label,condition)=>{assert.ok(condition,label);checks.push(label);};

async function api(path,{method="GET",token=key,apikey=token===key?key:anon,body,allowError=false}={}){
 const r=await fetch(STAGING_URL+path,{
   method,signal:AbortSignal.timeout(30000),redirect:"manual",
   headers:{apikey,Authorization:"Bearer "+token,"Content-Type":"application/json",
    Prefer:"return=representation"},
   body:body===undefined?undefined:JSON.stringify(body)
 });
 const data=await r.json().catch(()=>null);
 if(!allowError&&!r.ok)throw Error("STAGING_HTTP_"+r.status+"_"+path.split("?")[0]);
 return {status:r.status,data};
}
const rest=(table,filter="",select="*")=>api("/rest/v1/"+table+"?select="+select+filter);
const insert=async(table,body)=>{
 const r=await api("/rest/v1/"+table,{method:"POST",body});
 if(!Array.isArray(r.data)||!r.data[0]?.id ||
    (body.id && r.data[0].id!==body.id))
   throw Error("SYNTHETIC_INSERT_NOT_VERIFIED_"+table);
 return r.data[0];
};
const del=async(path)=>{
 const r=await api(path,{method:"DELETE",allowError:true});
 if(r.status<200||r.status>=300)throw Error("SYNTHETIC_CLEANUP_HTTP_"+r.status);
};
const PRday=(offset)=>{
 const parts=new Intl.DateTimeFormat("en-US",{
   timeZone:"America/Puerto_Rico",year:"numeric",month:"2-digit",day:"2-digit"
 }).formatToParts(new Date());
 const get=t=>parts.find(x=>x.type===t)?.value||"";
 const local=get("year")+"-"+get("month")+"-"+get("day");
 return new Date(Date.parse(local+"T00:00:00Z")+offset*86400000).toISOString().slice(0,10);
};
async function preflight(){
 const m=await rest("museums","&id=eq."+allowedMuseum,"id,slug,active");
 check("AI allowlisted synthetic museum known",m.data?.length===1 &&
   m.data[0].slug.startsWith("instituva-ai-browser-") && m.data[0].active===true);
 for(const table of ["employees","employee_shifts","attendance_attempts",
   "attendance_events","employee_time_entries","attendance_operational_alerts",
   "attendance_settings"]){
   const r=await rest(table,"&museum_id=eq."+allowedMuseum,"museum_id");
   check("no existing fixture or real operations in "+table,
     Array.isArray(r.data)&&r.data.length===0);
 }
}
async function actor(){
 const email=marker+"@example.invalid";
 const password="A9!"+randomBytes(25).toString("base64url");
 const made=await api("/auth/v1/admin/users",{method:"POST",body:{
   email,password,email_confirm:true,
   user_metadata:{full_name:"INSTITUVA AI disposable test"}
 }});
 assert.ok(made.data?.id,"synthetic user missing");
 created.users.push(made.data.id);
 // Auth registration may have assigned DEFAULT-museum roles. This is our new
 // synthetic user and has not signed in; remove ONLY that user's roles.
 await del("/rest/v1/user_roles?user_id=eq."+made.data.id);
 const roles=await rest("user_roles","&user_id=eq."+made.data.id,"user_id");
 check("new test user carries no inherited roles",roles.data?.length===0);
 const patch=await api("/rest/v1/profiles?id=eq."+made.data.id,{
   method:"PATCH",body:{museum_id:allowedMuseum,role:"empleado",status:"active",full_name:"AI disposable test"}
 });
 check("test profile belongs only to allowlisted synthetic museum",
   patch.data?.length===1 && patch.data[0].museum_id===allowedMuseum);
 const session=await api("/auth/v1/token?grant_type=password",{
   method:"POST",token:anon,apikey:anon,body:{email,password}
 });
 assert.ok(session.data?.access_token,"real signed test JWT missing");
 return {id:made.data.id,token:session.data.access_token};
}
async function grant(actorId,codes){
 const perms=await rest("permissions","","id,code");
 const matched=perms.data.filter(p=>codes.includes(p.code));
 if(matched.length!==codes.length)throw Error("PERMISSION_CATALOG_INCOMPLETE");
 const rows=matched.map(p=>({
   museum_id:allowedMuseum,user_id:actorId,permission_id:p.id,effect:"allow"
 }));
 const r=await api("/rest/v1/user_permissions",{method:"POST",body:rows});
 check("temporary explicit read grants created",
   Array.isArray(r.data)&&r.data.length===rows.length);
 created.permissions.push(...matched.map(p=>({permission_id:p.id,code:p.code})));
}
async function setupEmployee(museum,first,last){
 const id=randomUUID();
 // Track BEFORE writing: even a dropped HTTP response leaves a known cleanup key.
 created.employees.push({id,museum});
 await insert("employees",{
   id,museum_id:museum,first_name:first,last_name:last,
   position:"Empleado de prueba",department:"Pruebas",status:"activo"
 });
 return id;
}
async function setupEvidence(velezId,actorId){
 created.settings.push(allowedMuseum);
 const setting=await api("/rest/v1/attendance_settings",{
   method:"POST",body:{museum_id:allowedMuseum,timezone:"America/Puerto_Rico"}
 });
 check("disposable attendance timezone created",setting.data?.length===1);
 const yesterday=PRday(-1),before=PRday(-2);
 const shiftId=randomUUID();
 created.shifts.push(shiftId);
 await insert("employee_shifts",{
   id:shiftId,museum_id:allowedMuseum,employee_id:velezId,shift_date:yesterday,
   starts_at:yesterday+"T12:00:00Z",ends_at:yesterday+"T21:00:00Z",
   status:"scheduled",expected_lunch_minutes:60,created_by:actorId
 });
 const entryId=randomUUID();
 created.entries.push(entryId);
 await insert("employee_time_entries",{
   id:entryId,museum_id:allowedMuseum,employee_id:velezId,
   clock_in:before+"T12:02:00Z",clock_out:null,created_by:actorId
 });
 const alertId=randomUUID();
 created.alerts.push(alertId);
 await insert("attendance_operational_alerts",{
   id:alertId,museum_id:allowedMuseum,employee_id:velezId,shift_id:shiftId,
   alert_date:yesterday,alert_type:"missing_clock_in",status:"active"
 });
}
const postAi=(token,payload)=>api("/functions/v1/instituva-ai-assistant",{
 method:"POST",token,apikey:anon,body:payload,allowError:true
});
try{
 await preflight();
 const actorSession=await actor();
 const museum2=randomUUID();
 created.museums.push(museum2);
 await insert("museums",{
   id:museum2,name:marker+"-other-museum",slug:marker+"-other-museum",active:true
 });
 const velez=await setupEmployee(allowedMuseum,"Juan","Vélez");
 const torres=await setupEmployee(allowedMuseum,"Juan","Torres");
 const foreign=await setupEmployee(museum2,"Juan","Ajeno");
 await setupEvidence(velez,actorSession.id);
 await grant(actorSession.id,["attendance.history.read","finance.read",
    "employees.read.all","time.read.all"]);
 const who=await api("/auth/v1/user",{token:actorSession.token,apikey:anon});
 check("signed JWT belongs to disposable user",who.data?.id===actorSession.id);
 const roster=await api("/rest/v1/employees?select=id,first_name,last_name,museum_id&first_name=eq.Juan",{
   token:actorSession.token,apikey:anon
 });
 check("real JWT sees only two same-museum Juan employees",
   roster.data?.length===2&&roster.data.every(e=>e.museum_id===allowedMuseum)&&
   roster.data.every(e=>e.id!==foreign));
 const question="¿Qué pasó con el ponche de ayer de Juan?";
 const ambiguous=await postAi(actorSession.token,{mode:"attendance",question});
 check("first-name question requests clarification before model call",
   ambiguous.status===409 && ambiguous.data?.code==="EMPLOYEE_SELECTION_REQUIRED" &&
   ambiguous.data?.options?.length===2);
 const names=ambiguous.data.options.map(x=>x.name).sort();
 check("assistant asks Juan Vélez or Juan Torres, never foreign museum",
   names.includes("Juan Vélez") && names.includes("Juan Torres") &&
   !names.includes("Juan Ajeno") &&
   ambiguous.data.options.every(x=>x.employee_id!==foreign));
 const forged=await postAi(actorSession.token,{
   mode:"attendance",question,employee_name:"Juan Vélez",employee_id:foreign
 });
 check("cross-museum forged employee selection denied",forged.status===403);
 const positive=await postAi(actorSession.token,{
   mode:"attendance",question,employee_name:"Juan Vélez",employee_id:velez
 });
 check("selected Juan has read-only AI diagnosis with signed JWT",
   positive.status===200 && positive.data?.mode==="attendance" &&
   positive.data?.read_only===true && positive.data?.actions_executed===false &&
   positive.data?.diagnostic_contract==="read_only_v1" &&
   positive.data?.evidence?.employee==="Juan Vélez" &&
   positive.data?.evidence?.previous_open_entries===1 &&
   Array.isArray(positive.data?.guide_steps)&&positive.data.guide_steps.length>0);
 // First-name directory access must be separate from attendance permission.
 await del("/rest/v1/user_permissions?museum_id=eq."+allowedMuseum+
   "&user_id=eq."+actorSession.id+"&permission_id=eq."+
   created.permissions.find(p=>p.code==="employees.read.all")?.permission_id);
 const denied=await postAi(actorSession.token,{mode:"attendance",question});
 check("without employees directory grant no first-name disclosure",denied.status===403);
 console.log(JSON.stringify({status:"PASS",staging:STAGING_REF,checks:checks.length,
   signed_jwt:true,museums_isolated:true,choice_required:true,
   selected_employee_diagnosis:true,provider_calls:1,operational_writes_by_ai:0}));
}catch(error){
 failed=true;
 console.error("AI NAME E2E FAILED:",error instanceof Error?error.message:"unknown");
}finally{
 const cleanupErrors=[];
 const clean=async(path)=>{try{await del(path)}catch(e){cleanupErrors.push(String(e))}};
 for(const id of created.alerts)await clean("/rest/v1/attendance_operational_alerts?id=eq."+id);
 for(const id of created.entries)await clean("/rest/v1/employee_time_entries?id=eq."+id);
 for(const id of created.shifts)await clean("/rest/v1/employee_shifts?id=eq."+id);
 for(const e of created.employees)await clean("/rest/v1/employees?id=eq."+e.id);
 for(const museum of created.settings)await clean("/rest/v1/attendance_settings?museum_id=eq."+museum);
 // Delete audit records only for synthetic employees created by this test.
 for(const e of created.employees)await clean("/rest/v1/audit_logs?museum_id=eq."+e.museum+"&record_id=eq."+e.id+"&table_name=eq.employees");
 for(const actorId of created.users){
   await clean("/rest/v1/user_permissions?user_id=eq."+actorId);
   await clean("/rest/v1/user_roles?user_id=eq."+actorId);
   try{
     const r=await api("/auth/v1/admin/users/"+actorId,{method:"DELETE",allowError:true});
     if(r.status<200||r.status>=300)cleanupErrors.push("Auth user cleanup failed");
   }catch{cleanupErrors.push("Auth user cleanup exception");}
 }
 for(const id of created.museums)await clean("/rest/v1/museums?id=eq."+id);
 // Verify deletions without showing IDs or confidential content.
 for(const e of created.employees){
   try{
     const r=await rest("employees","&id=eq."+e.id,"id");
     if(r.data?.length!==0)cleanupErrors.push("Employee fixture remains");
   }catch{cleanupErrors.push("Employee cleanup unverifiable");}
 }
 for(const id of created.users){
   try{
     const r=await api("/auth/v1/admin/users/"+id,{allowError:true});
     if(r.status!==404)cleanupErrors.push("Auth fixture remains");
   }catch{cleanupErrors.push("Auth cleanup unverifiable");}
 }
 for(const id of created.museums){
   try{const r=await rest("museums","&id=eq."+id,"id");
     if(r.data?.length!==0)cleanupErrors.push("Museum fixture remains");
   }catch{cleanupErrors.push("Museum cleanup unverifiable");}
 }
 if(cleanupErrors.length){
   console.error("AI FIXTURE CLEANUP REQUIRES ADMIN REVIEW:",JSON.stringify({
     marker,errors:cleanupErrors
   }));
   process.exitCode=1;
 }else{
   console.log("PASS: disposable AI name E2E fixtures cleaned");
   if(failed)process.exitCode=1;
 }
}
