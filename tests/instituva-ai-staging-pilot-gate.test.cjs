"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const s=fs.readFileSync("supabase/functions/instituva-ai-assistant/index.ts","utf8");
test("pilot enabled only for exact staging URL and demo museum",()=>{
 assert.match(s,/Deno\.env\.get\("SUPABASE_URL"\) ===\s*"https:\/\/lonpdmxdvbxuagqxztig\.supabase\.co"/);
 assert.match(s,/museum === "00000000-0000-0000-0000-000000000001"/);
 assert.match(s,/return stagingPilot \|\|\s*\(Deno\.env\.get\("INSTITUVA_AI_ENABLED"\) === "true" && ids\.includes\(museum\)\)/);
 assert.doesNotMatch(s,/kfokfjngozgcwjpzxcsu/);
});
test("pilot grants do not bypass per-request account and module gates",()=>{
 assert.match(s,/authorizedStaffProfiles/);
 assert.match(s,/\.eq\("profile_id",user\.id\)/);
 assert.match(s,/\.eq\("museum_id",museumId\)/);
 assert.match(s,/requiredPermissionsForMode\(mode\)/);
 assert.match(s,/module_profile_allows/);
 assert.match(s,/actions_executed:false/);
});
