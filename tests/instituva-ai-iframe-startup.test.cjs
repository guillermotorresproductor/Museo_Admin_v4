"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const app=fs.readFileSync("js/app.js","utf8");
const config=fs.readFileSync("js/config.js","utf8");
test("production application remains complete",()=>{
  assert.ok(app.length>430000);
  assert.ok(app.includes('document.addEventListener("DOMContentLoaded", initApp);'));
});
test("AI frame initializes after auth gate and before unrelated modules",()=>{
  const auth=app.indexOf('if (enforceAuthenticatedPageAccess()) return;');
  const guard=app.indexOf('if (getCurrentPage() === "asistente-ia.html") {',auth);
  const sidebar=app.indexOf('renderSidebar();',auth);
  assert.ok(auth>0&&guard>auth&&sidebar>guard);
  const fastpath=app.slice(guard,sidebar);
  assert.match(fastpath,/await syncEmployeeCacheFromSupabase\(\)/);
  for(const role of ["administrador_general","director_ejecutivo","gerente_administrativo","gerente_museografica"])
    assert.ok(fastpath.includes('"'+role+'"'));
  assert.match(fastpath,/employee\.authUserId === userId/);
  assert.match(fastpath,/employee\.statusCode === "activo"/);
  assert.match(fastpath,/allowedProfiles\.has\(employee\.accessProfile\)/);
  assert.match(fastpath,/if \(!instituvaAiUiEnabled \|\| !allowedEmployee\)/);
  assert.match(fastpath,/bindInstituvaAi\(\)/);
  assert.match(fastpath,/document\.body\.classList\.add\("app-ready"\)/);
  assert.match(fastpath,/showProtectedAccessDenied\("No se pudo inicializar/);
  assert.match(fastpath,/return;\s*\}/);
  assert.doesNotMatch(fastpath,/bindFinanceModule|bindInventoryModule|bindReportsModule|bindEmployeePortal/);
});
test("four-role production gate remains enabled; iframe cannot bypass backend",()=>{
  assert.match(config,/production: Object\.freeze\(\{[\s\S]{0,120}aiAssistantUiEnabled: true/);
  assert.match(app,/if \(enforceAuthenticatedPageAccess\(\)\) return;/);
  assert.match(app,/const aiAuthorizedRoles = new Set\(\["administrador_general","director_ejecutivo","gerente_administrativo","gerente_museografica"\]\)/);
});
