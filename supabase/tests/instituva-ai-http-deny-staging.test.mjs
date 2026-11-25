// Safe external auth-boundary smoke test for the dedicated INSTITUVA AI
// staging project. Intentionally does NOT use an API key or valid JWT.
// This cannot read tenant data, create users, invoke a model, or write records.
// Fail closed on an unexpected successful response or unavailable gateway.
import assert from "node:assert/strict";
import test from "node:test";

const projectId="lonpdmxdvbxuagqxztig";
const endpoint=`https://${projectId}.supabase.co/functions/v1/instituva-ai-assistant`;
const cases=[
  {name:"missing Authorization",authorization:null},
  {name:"malformed Bearer JWT",authorization:"Bearer definitely-not-a-jwt"}
];

for(const scenario of cases){
  test(`staging gateway denies ${scenario.name}`,async()=>{
    const headers={"content-type":"application/json"};
    if(scenario.authorization)headers.authorization=scenario.authorization;
    const response=await fetch(endpoint,{
      method:"POST",
      headers,
      body:JSON.stringify({mode:"product",question:"Synthetic authentication gate test; no operational request"}),
      signal:AbortSignal.timeout(12000),
      redirect:"manual"
    });
    // A 401 is produced by the Supabase JWT gateway before the function
    // is executed. Do not accept 2xx, 3xx, 403 or a 5xx as an auth test pass.
    assert.equal(response.status,401,
      `JWT protection failed or staging gateway unavailable (status=${response.status})`);
    const body=(await response.text()).slice(0,1000);
    assert.doesNotMatch(body,/"answer"\s*:/i,
      "an unauthenticated request unexpectedly returned an AI diagnosis");
  });
}
