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
  assert.match(app,/js\/instituva-ai-dock\.js\?v=20261127-approved-orb-3/);
  assert.match(html,/js\/instituva-ai\.js\?v=20261127-conversation-scope-1/);
});
test("server still receives current query only, not conversation history",()=>{
  assert.match(ai,/const request=\{mode:queryMode,question\}/);
  assert.doesNotMatch(ai,/request\.messages\s*=|request\.history\s*=/);
  assert.match(ai,/read_only/);
});

test("floating Instituva AI orb replaces pill and disappears when chat opens",()=>{
  assert.match(dock,/ai-dock-launch-mark/);
  assert.match(dock,/textPath\.textContent="INSTITUVA AI"/);
  assert.match(dock,/launch\.hidden=open/);
  assert.match(dock,/panel\.hidden=!open/);
  assert.match(dock,/launch\.addEventListener\("click",\(\)=>setOpen\(true\)\)/);
  const style=fs.readFileSync("css/instituva-ai-dock.css","utf8");
  assert.match(style,/animation: ai-dock-float/);
  assert.match(style,/prefers-reduced-motion/);
  assert.doesNotMatch(style,/background:\s*#124f38/);
});

test("approved orb uses original emblem styling and clear safe offsets",()=>{
  const css=fs.readFileSync("css/instituva-ai-dock.css","utf8");
  const symbol=fs.readFileSync("assets/brand/instituva-ai-symbol.svg","utf8");
  assert.match(css,/right: 45px; bottom: 65px/);
  assert.match(css,/right: max\(25px, env\(safe-area-inset-right/);
  assert.match(css,/@keyframes ai-dock-float/);
  assert.match(symbol,/id="iv-silver"/);
  assert.match(symbol,/id="iv-cyan"/);
  assert.match(dock,/instituva-ai-symbol\.svg\?v=20261127-approved-orb-3/);
  assert.match(dock,/launch\.hidden=open/);
  assert.match(dock,/panel\.hidden=!open/);
});
