"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("asistente-ia.html","utf8");
const dock=fs.readFileSync("js/instituva-ai-dock.js","utf8");
const config=fs.readFileSync("js/config.js","utf8");
test("iframe HTML loads a fresh assistant app and config",()=>{
  for(const asset of ["js/config.js","js/app.js"]) {
    assert.match(html,new RegExp(asset.replaceAll(".","\\.")+"\\?v=20261126-ai-frame-3"));
  }
  assert.match(html,/js\/instituva-ai\.js\?v=20261126-conversation-staging-1/);
  assert.match(dock,/searchParams\.set\("ai_ui","20261126-frame-3"\)/);
});
test("fail-closed fallback does not expose an unauthenticated chat",()=>{
  assert.match(html,/if \(document\.body\?\.classList\.contains\("app-ready"\)\) return;/);
  assert.match(html,/main\.replaceChildren\(section\);/);
  assert.match(html,/No se pudo abrir INSTITUVA AI/);
  assert.doesNotMatch(html,/sk-proj-|SUPABASE_SERVICE_ROLE_KEY/);
});
test("production still restricts AI to four approved roles",()=>{
  assert.match(config,/production: Object\.freeze\(\{[\s\S]{0,130}aiAssistantUiEnabled: true/);
  const app=fs.readFileSync("js/app.js","utf8");
  for(const role of ["administrador_general","director_ejecutivo","gerente_administrativo","gerente_museografica"])
    assert.ok(app.includes('"'+role+'"'));
});