// Optional real provider smoke test for an already-authorized staging user.
// Do NOT use production tokens. This executes exactly one product-knowledge
// diagnostic, does not request operational records, and consumes one AI quota
// slot on the authenticated staging museum. Run only with explicit opt-in.
// User JWT must belong to an ACTIVE account in an AI-allowlisted staging museum.
import assert from "node:assert/strict";
import {
  assertStagingAnonKey,assertStagingUserJwt,STAGING_REF,STAGING_URL
} from "./instituva-ai-staging-key-guard.mjs";

const confirmRef=process.env.INSTITUVA_AI_E2E_CONFIRM_STAGING;
const anonKey=process.env.INSTITUVA_AI_TEST_ANON_KEY;
const userJwt=process.env.INSTITUVA_AI_TEST_USER_JWT;
assertStagingAnonKey({anonKey,confirmRef});
assertStagingUserJwt({userToken:userJwt,confirmRef});
// No network request is made until both credentials have passed local scope
// checks. The Auth API validates the JWT cryptographically afterward.
const request=async(path,body)=>{
  const response=await fetch(STAGING_URL+path,{
    method:body?"POST":"GET",
    signal:AbortSignal.timeout(30000),
    headers:{"apikey":anonKey,"Authorization":"Bearer "+userJwt,
      "Content-Type":"application/json"},
    body:body?JSON.stringify(body):undefined,
    redirect:"manual"
  });
  const value=await response.json().catch(()=>null);
  return {status:response.status,value};
};
try{
  const auth=await request("/auth/v1/user");
  assert.equal(auth.status,200,
    "Staging Auth did not verify this signed user JWT");
  assert.ok(auth.value?.id,"Staging identity could not be verified");
  const check=await request("/functions/v1/instituva-ai-assistant",{
    mode:"product",
    question:"Una jornada abierta impide registrar ponches. ¿Qué evidencia y pasos manuales deben revisarse sin modificar registros?"
  });
  assert.equal(check.status,200,
    "AI staging did not return a successful product-only diagnosis (HTTP "+check.status+")");
  const d=check.value;
  assert.equal(d?.mode,"product","unexpected mode");
  assert.equal(d?.diagnostic_contract,"read_only_v1","unexpected diagnostic contract");
  assert.equal(d?.read_only,true,"write-enabled response");
  assert.equal(d?.actions_executed,false,"the AI claimed operational actions");
  assert.ok(Array.isArray(d?.sources)&&d.sources.length>0,
    "no approved product sources available");
  assert.ok(Number(d?.evidence?.source_count)>0,"missing evidence provenance");
  assert.ok(typeof d?.answer==="string"&&d.answer.length>70&&d.answer.length<8000,
    "no real formatted model diagnosis");
  assert.match(d.answer,/Hipótesis \(no confirmadas\)/,
    "hypotheses not marked as unconfirmed");
  assert.match(d.answer,/Acciones manuales propuestas \(NO ejecutadas\)/,
    "recommendations not marked as non-executed");
  assert.match(d.answer,/Limitaciones de la evidencia/,
    "evidence limitations missing");
  assert.match(d.answer,/No se ejecutó ninguna operación/,
    "read-only conclusion missing");
  // A pass proves provider execution/format for a product question only,
  // not authorized cross-module business data access or clinical accuracy.
  console.log(JSON.stringify({status:"PASS",staging:STAGING_REF,
    verified_user:true,product_only:true,provider_response:true,
    model_diagnostic_contract:true,operational_writes:0,
    technical_quota_calls:1}));
}catch(err){
  // No request or response payloads, JWTs, emails or user IDs in logs.
  console.error("INSTITUVA AI staging model smoke failed:",
    err instanceof Error?err.message:"unknown");
  process.exitCode=1;
}
