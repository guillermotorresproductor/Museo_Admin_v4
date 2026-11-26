"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const ai=fs.readFileSync("js/instituva-ai.js","utf8");
const dock=fs.readFileSync("js/instituva-ai-dock.js","utf8");
const html=fs.readFileSync("asistente-ia.html","utf8");
const app=fs.readFileSync("js/app.js","utf8");
test("assistant excludes redundant operational/technical disclaimers from chat",()=>{
  assert.doesNotMatch(html,/Módulo abierto: Panel principal|Conversación temporal en este navegador|Consulta incidencias, revisa evidencias autorizadas/);
  assert.doesNotMatch(dock,/Al cambiar de página, este panel reinicia/);
  assert.doesNotMatch(dock,/ai-dock-disclaimer|footer\.textContent/);
});
test("same-tab conversation restoration is scoped and expires",()=>{
  assert.match(ai,/const continuityKey="instituva-ai-conversation-v1"/);
  assert.match(ai,/const continuityMaxAgeMs=15\*60\*1000/);
  assert.match(ai,/stored\.user!==mountedUserId/);
  assert.match(ai,/stored\.museum!==verifiedMuseum/);
  assert.match(ai,/stored\.grants!==mountedGrants/);
  assert.match(ai,/Date\.now\(\)-stored\.time>continuityMaxAgeMs/);
  assert.match(ai,/sessionStorage\.setItem\(continuityKey,serialized\)/);
  assert.match(ai,/sessionStorage\.removeItem\(continuityKey\)/);
  assert.match(ai,/restoreConversation\(\);/);
  assert.ok(ai.indexOf("verifiedMuseum=museum;")<ai.indexOf("restoreConversation();"));
  assert.match(ai,/if\(!continuityReady \|\| restoringConversation \|\| accessRevoked \|\| !verifiedMuseum\)return;/);
});
test("session state discarded at logout or authorization revocation",()=>{
  assert.match(app,/sessionStorage\.removeItem\("instituva-ai-conversation-v1"\)/);
  assert.match(app,/sessionStorage\.removeItem\("instituva-ai-dock-open-v1"\)/);
  assert.match(ai,/accessRevoked=true;\s*continuityReady=false;\s*clearContinuity\(\)/);
});
test("dock automatically reopens after navigating the same tab",()=>{
  assert.match(dock,/sessionStorage\.setItem\(dockStateKey,open\?"1":"0"\)/);
  assert.match(dock,/sessionStorage\.getItem\(dockStateKey\)==="1"\)setOpen\(true\)/);
  assert.match(app,/js\/instituva-ai-dock\.js\?v=20261126-continuity-1/);
  assert.match(html,/js\/instituva-ai\.js\?v=20261126-clear-composer-1/);
});
test("server still receives current query only, not conversation history",()=>{
  assert.match(ai,/const request=\{mode:queryMode,question\}/);
  assert.doesNotMatch(ai,/request\.messages\s*=|request\.history\s*=/);
  assert.match(ai,/read_only/);
});
