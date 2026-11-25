// Narrow guard for disposable Auth E2E tests on the dedicated staging
// project. Accept only legacy staging JWT API keys that advertise the exact
// project reference and role. Never print or log raw credentials.
// This verifies key *metadata* locally; the staging Auth API still validates
// their cryptographic signatures before any fixture writes.
export const STAGING_REF="lonpdmxdvbxuagqxztig";
export const STAGING_URL=`https://${STAGING_REF}.supabase.co`;

function claimsFromLegacyKey(raw){
  if(typeof raw!=="string"||raw.length>4096||!/^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/.test(raw))
    throw Error("STAGING_LEGACY_JWT_KEY_REQUIRED");
  let claims;
  try{
    const segment=raw.split(".")[1];
    claims=JSON.parse(Buffer.from(segment,"base64url").toString("utf8"));
  }catch{
    throw Error("STAGING_KEY_CLAIMS_INVALID");
  }
  if(!claims||typeof claims!=="object"||Array.isArray(claims))
    throw Error("STAGING_KEY_CLAIMS_INVALID");
  return claims;
}

export function assertStagingLegacyApiKeys({serviceKey,anonKey,confirmRef,url,nowEpochSeconds=Math.floor(Date.now()/1000)}){
  if(confirmRef!==STAGING_REF)throw Error("STAGING_EXPLICIT_OPT_IN_REQUIRED");
  if(url!==undefined&&url!==STAGING_URL)throw Error("NOT_STAGING");
  if(!serviceKey||!anonKey||serviceKey===anonKey)
    throw Error("STAGING_SEPARATE_KEYS_REQUIRED");
  for(const [key,expectedRole] of [[serviceKey,"service_role"],[anonKey,"anon"]]){
    const claims=claimsFromLegacyKey(key);
    if(claims.ref!==STAGING_REF||claims.role!==expectedRole||claims.iss!=="supabase"||
       !Number.isSafeInteger(claims.exp)||claims.exp<=nowEpochSeconds+300)
      throw Error("STAGING_PROJECT_OR_ROLE_MISMATCH");
  }
  return true;
}

export function assertStagingUserJwt({userToken,confirmRef,nowEpochSeconds=Math.floor(Date.now()/1000)}){
  if(confirmRef!==STAGING_REF)throw Error("STAGING_EXPLICIT_OPT_IN_REQUIRED");
  const claims=claimsFromLegacyKey(userToken);
  if(claims.iss!==STAGING_URL+"/auth/v1"||
     (claims.ref!==undefined&&claims.ref!==STAGING_REF)||
     claims.role!=="authenticated"||typeof claims.sub!=="string"||
     !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.sub)||
     !Number.isSafeInteger(claims.exp)||claims.exp<=nowEpochSeconds+60)
    throw Error("STAGING_USER_JWT_SCOPE_INVALID");
  return true;
}
