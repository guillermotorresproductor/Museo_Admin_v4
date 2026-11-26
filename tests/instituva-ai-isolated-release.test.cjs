"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

const app=fs.readFileSync("js/app.js","utf8");
const config=fs.readFileSync("js/config.js","utf8");
const html=fs.readFileSync("asistente-ia.html","utf8");
const dock=fs.readFileSync("js/instituva-ai-dock.js","utf8");
const ai=fs.readFileSync("js/instituva-ai.js","utf8");

test("complete production app remains intact; initialization and other modules preserved",()=>{
  assert.ok(app.length>400000,"existing application must not be truncated");
  assert.match(app,/document.addEventListener\("DOMContentLoaded", initApp\);/);
  for(const f of ["bindFinanceModule()","bindInventoryModule()","bindReportsModule()","bindEmployeePortal()"])
    assert.ok(app.includes(f),f+" must remain");
});
test("production interface rollout is gated by authenticated linked staff",()=>{
  assert.match(config,/production: Object.freeze\(\{[\s\S]{0,100}aiAssistantUiEnabled: true/);
  assert.match(config,/const instituvaAiUiEnabled = museoEnvironment.aiAssistantUiEnabled === true;/);
  assert.ok(app.indexOf("if (enforceAuthenticatedPageAccess()) return;")<app.indexOf("const aiAuthorizedRoles"));
});
test("assistant browser access requires active linked exact employee roles",()=>{
  for(const role of ["administrador_general","director_ejecutivo","gerente_administrativo","gerente_museografica"])
    assert.match(app,new RegExp('"'+role+'"'));
  assert.match(app,/e\.authUserId === aiSessionUserId/);
  assert.match(app,/e\.statusCode === "activo"/);
  assert.match(app,/aiAuthorizedRoles\.has\(e\.accessProfile\)/);
  assert.match(app,/if \(getCurrentPage\(\) === "asistente-ia.html" && !canUseAi\)/);
  assert.match(app,/if \(canUseAi && getCurrentPage\(\) !== "asistente-ia.html"/);
});
test("assistant page uses same-origin script and no direct secrets",()=>{
  assert.match(html,/src="js\/config\.js(?:\?[^"]*)?"/);
  assert.match(html,/src="js\/instituva-ai\.js(?:\?[^"]*)?"/);
  assert.match(html,/src="js\/app\.js(?:\?[^"]*)?"/);
  assert.doesNotMatch(html+ai+ dock,/sk-proj-|SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(dock,/\.insert\(|\.update\(|\.delete\(|fetch\(/);
});
