import test from "node:test";
import assert from "node:assert/strict";
import {assertStagingLegacyApiKeys,assertStagingAnonKey,assertStagingUserJwt,STAGING_REF,STAGING_URL} from "./instituva-ai-staging-key-guard.mjs";
// Test-only unsigned synthetic JWT strings: metadata format checks are NOT
// cryptographic auth; they must NEVER be submitted to the staging API.
const now=1795640000;
const fake=(role,ref=STAGING_REF,exp=now+3600,iss="supabase")=>
  [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
   Buffer.from(JSON.stringify({iss,ref,role,exp})).toString("base64url"),
   "synthetic-signature"].join(".");
const good={serviceKey:fake("service_role"),anonKey:fake("anon"),
  confirmRef:STAGING_REF,url:STAGING_URL,nowEpochSeconds:now};
const denied=(override,reason)=>{
  assert.throws(()=>assertStagingLegacyApiKeys({...good,...override}),
    error=>error.message===reason);
};
test("project-bound metadata guard accepts the exact synthetic staging roles",()=>{
  assert.equal(assertStagingLegacyApiKeys(good),true);
});
test("a production service_role key is rejected before any network access",()=>{
  denied({serviceKey:fake("service_role","kfokfjngozgcwjpzxcsu")},
    "STAGING_PROJECT_OR_ROLE_MISMATCH");
});
test("a foreign anon key and swapped privileged roles are rejected",()=>{
  denied({anonKey:fake("anon","kfokfjngozgcwjpzxcsu")},
    "STAGING_PROJECT_OR_ROLE_MISMATCH");
  denied({serviceKey:fake("anon",STAGING_REF,now+3700)},"STAGING_PROJECT_OR_ROLE_MISMATCH");
  denied({anonKey:fake("service_role",STAGING_REF,now+3700)},"STAGING_PROJECT_OR_ROLE_MISMATCH");
});
test("explicit staging opt-in and URL cannot be bypassed",()=>{
  denied({confirmRef:undefined},"STAGING_EXPLICIT_OPT_IN_REQUIRED");
  denied({confirmRef:"kfokfjngozgcwjpzxcsu"},"STAGING_EXPLICIT_OPT_IN_REQUIRED");
  denied({url:"https://kfokfjngozgcwjpzxcsu.supabase.co"},"NOT_STAGING");
});
test("expired, missing, malformed or repeated credentials are rejected",()=>{
  denied({serviceKey:fake("service_role",STAGING_REF,now+30)},
    "STAGING_PROJECT_OR_ROLE_MISMATCH");
  denied({serviceKey:fake("service_role",STAGING_REF,now+3600,"other")},
    "STAGING_PROJECT_OR_ROLE_MISMATCH");
  denied({serviceKey:null},"STAGING_SEPARATE_KEYS_REQUIRED");
  denied({anonKey:good.serviceKey},"STAGING_SEPARATE_KEYS_REQUIRED");
  denied({serviceKey:"sb_secret_not_proven_to_be_staging"},"STAGING_LEGACY_JWT_KEY_REQUIRED");
  denied({anonKey:"not-jwt"},"STAGING_LEGACY_JWT_KEY_REQUIRED");
});

const testUser=(role="authenticated",issuer=STAGING_URL+"/auth/v1",
  sub="33333333-3333-4333-8333-333333333333",exp=now+3600)=>
  [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
   Buffer.from(JSON.stringify({iss:issuer,role,sub,exp})).toString("base64url"),
   "fake-signature"].join(".");
test("model smoke allows only staging anon metadata and a staging Auth user token",()=>{
  assert.equal(assertStagingAnonKey({anonKey:good.anonKey,confirmRef:STAGING_REF,
    nowEpochSeconds:now}),true);
  assert.equal(assertStagingUserJwt({userToken:testUser(),confirmRef:STAGING_REF,
    nowEpochSeconds:now}),true);
});
test("model smoke rejects production-issued or fake-role user tokens",()=>{
  for(const token of [
    testUser("authenticated","https://kfokfjngozgcwjpzxcsu.supabase.co/auth/v1"),
    testUser("service_role"),testUser("anon"),
    testUser("authenticated",STAGING_URL+"/auth/v1","not-a-user-uuid"),
    testUser("authenticated",STAGING_URL+"/auth/v1",
      "33333333-3333-4333-8333-333333333333",now+1)
  ]){
    assert.throws(()=>assertStagingUserJwt({userToken:token,confirmRef:STAGING_REF,
      nowEpochSeconds:now}),/STAGING_USER_JWT_SCOPE_INVALID/);
  }
  assert.throws(()=>assertStagingAnonKey({anonKey:fake("anon","kfokfjngozgcwjpzxcsu"),
    confirmRef:STAGING_REF,nowEpochSeconds:now}),/STAGING_ANON_KEY_SCOPE_INVALID/);
});
