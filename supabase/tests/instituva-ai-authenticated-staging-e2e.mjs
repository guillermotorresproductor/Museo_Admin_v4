// INSTITUVA AI authenticated staging E2E: reads only, no fixture creation.
// Required: INSTITUVA_STAGING_JWT_A, INSTITUVA_STAGING_JWT_B,
//           INSTITUVA_STAGING_EMPLOYEE_A (synthetic employee UUID in museum A),
//           INSTITUVA_STAGING_EMPLOYEE_A_NAME (full name of the same synthetic employee),
//           INSTITUVA_STAGING_EMPLOYEE_B and INSTITUVA_STAGING_EMPLOYEE_B_NAME,
//           INSTITUVA_STAGING_PUBLISHABLE_KEY (public staging API key).
// Never paste JWTs in chat or commit them. No credentials or response bodies logged.
// This test does not establish zero DB writes from internal quota accounting.
// Invoke: node --test supabase/tests/instituva-ai-authenticated-staging-e2e.mjs
import test from "node:test";
import assert from "node:assert/strict";

const endpoint="https://lonpdmxdvbxuagqxztig.supabase.co/functions/v1/instituva-ai-assistant";
const authEndpoint="https://lonpdmxdvbxuagqxztig.supabase.co/auth/v1/user";
const jwtA=process.env.INSTITUVA_STAGING_JWT_A;
const jwtB=process.env.INSTITUVA_STAGING_JWT_B;
const employeeA=process.env.INSTITUVA_STAGING_EMPLOYEE_A;
const employeeAName=process.env.INSTITUVA_STAGING_EMPLOYEE_A_NAME?.trim();
const employeeB=process.env.INSTITUVA_STAGING_EMPLOYEE_B;
const employeeBName=process.env.INSTITUVA_STAGING_EMPLOYEE_B_NAME?.trim();
const publicKey=process.env.INSTITUVA_STAGING_PUBLISHABLE_KEY;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const timeout=()=>AbortSignal.timeout(30000);
const fail=(why)=>{throw new Error(why)};
const validName=n=>typeof n==="string" && /^[\p{L}\p{M}.' -]{3,120}$/u.test(n) && n.split(/\s+/).length>=2;
if(!jwtA || !jwtB || !publicKey || !uuid.test(employeeA||"") || !uuid.test(employeeB||"") || !validName(employeeAName) || !validName(employeeBName)) {
  fail("Missing two authorized staging JWTs, a public API key or both synthetic employee identities. E2E NOT EXECUTED.");
}
if(jwtA===jwtB)fail("Two distinct fixture sessions are required.");
const getProfile=async jwt=>{
 const res=await fetch(authEndpoint,{headers:{Authorization:"Bearer "+jwt,apikey:publicKey},signal:timeout()});
 // Avoid logging tokens or private user records on failure.
 if(!res.ok)fail("Staging JWT verification failed: HTTP "+res.status);
 const user=await res.json();
 assert.ok(uuid.test(user.id),"Fixture session must resolve to a valid user UUID");
 return user.id;
};
const ask=async(jwt,question,extra={})=>{
 const res=await fetch(endpoint,{
   method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+jwt,apikey:publicKey},
   body:JSON.stringify({mode:"auto",question,...extra}),signal:timeout()
 });
 const body=await res.json().catch(()=>null);
 assert.ok(body && typeof body==="object","Assistant response must be JSON");
 return {status:res.status,body};
};
test("two synthetic sessions authenticate independently",async()=>{
 const [a,b]=await Promise.all([getProfile(jwtA),getProfile(jwtB)]);
 assert.notEqual(a,b,"Tests must use distinct authenticated users");
});
test("authorized institutional knowledge has a read-only contract and citations",async()=>{
 for(const jwt of [jwtA,jwtB]){
   const r=await ask(jwt,"¿Quién tiene permiso para corregir ponches?");
   // Both fixtures must have enabled AI/staff access; non-200 is a FAILED prerequisite.
   assert.equal(r.status,200,"Fixture requires active AI access in both museums, got HTTP "+r.status);
   assert.equal(r.body.mode,"product");
   assert.equal(r.body.read_only,true);
   assert.equal(r.body.actions_executed,false);
   assert.equal(r.body.diagnostic_contract,"read_only_v1");
   assert.ok(typeof r.body.answer==="string" && r.body.answer.length>10);
   assert.ok(Array.isArray(r.body.sources) && r.body.sources.length>0,"Verifiable source references required");
 }
});
test("both fixture users can read their own synthetic employee attendance",async()=>{
 const pairs=[[jwtA,employeeA,employeeAName],[jwtB,employeeB,employeeBName]];
 for(const [jwt,id,name] of pairs){
   const r=await ask(jwt,"Revisa los ponches de "+name+" hoy",{
     mode:"attendance",employee_name:name,employee_id:id
   });
   assert.equal(r.status,200,"Positive control attendance must succeed before cross-tenant test; HTTP "+r.status);
   assert.equal(r.body.read_only,true);
   assert.equal(r.body.actions_executed,false);
   assert.equal(r.body.mode,"attendance");
 }
});
test("cross-museum named employee lookup is denied rather than returning any private evidence",async()=>{
 const r=await ask(jwtB,"Revisa los ponches de "+employeeAName+" hoy",{
   mode:"attendance",employee_name:employeeAName,employee_id:employeeA
 });
 // A missing employee cannot prove isolation unless the name+ID belong to a
 // known synthetic record in tenant A; fixture provenance is a prerequisite.
 assert.notEqual(r.status,200,"Cross-tenant request must never return authorized private evidence");
 assert.ok([404,409].includes(r.status),"Fixture has positive attendance access, so cross-tenant lookup must fail on employee identity; HTTP "+r.status);
 assert.ok(!("evidence" in r.body) && !("sources" in r.body),
   "Denied cross-tenant case must not expose evidence or source records");
});
test("user-supplied museum_id cannot expand the authenticated tenant scope",async()=>{
 const r=await ask(jwtA,"¿Quién tiene permiso para corregir ponches?",{
   museum_id:"00000000-0000-0000-0000-000000000999"
 });
 assert.equal(r.status,200);
 assert.equal(r.body.mode,"product");
 assert.equal(r.body.actions_executed,false);
});
