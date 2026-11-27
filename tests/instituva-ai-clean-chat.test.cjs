"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const html=fs.readFileSync("asistente-ia.html","utf8");
const ai=fs.readFileSync("js/instituva-ai.js","utf8");
const dock=fs.readFileSync("js/instituva-ai-dock.js","utf8");
test("four user-requested helper lines are absent from the interface",()=>{
  assert.doesNotMatch(html,/Enter para enviar · Shift\+Enter para salto de línea/);
  assert.doesNotMatch(dock,/Ventana aparte.*conserva la conversación/);
  assert.doesNotMatch(dock,/No se guardan mensajes en el servidor/);
  assert.doesNotMatch(ai,/Conocimiento general de INSTITUVA, sujeto a revisión y actualización\. Sin acceso a datos de empleados\./);
});
test("redundant stock preamble is removed only in assistant presentation",()=>{
  const start=ai.indexOf("const presentationAnswer=");
  const end=ai.indexOf(";\n  const renderFormattedAnswer",start);
  assert.ok(start>=0 && end>start);
  const source=ai.slice(start,end+1).replace("const presentationAnswer=","presentationAnswer=");
  const context={presentationAnswer:null};
  vm.runInNewContext(source,context);
  const sample="INSTITUVA — DIAGNÓSTICO PRELIMINAR\nOrientación de solo lectura. No se ejecutó ninguna operación sobre los registros operacionales.\n\nAnálisis inicial\nResultado verificado\n\nHipótesis (no confirmadas)\nNo hay\n\nVerificaciones pendientes\nSin pendientes\n\nAcciones manuales propuestas (NO ejecutadas)\nNinguna\n\nLimitaciones de la evidencia\nSolo lo verificado";
  const result=context.presentationAnswer(sample);
  assert.doesNotMatch(result,/Orientación de solo lectura/);
  assert.ok(result.startsWith("INSTITUVA — DIAGNÓSTICO PRELIMINAR\n\nAnálisis inicial"));
  assert.ok(result.includes("Resultado verificado"));
  assert.ok(result.includes("Limitaciones de la evidencia\nSolo lo verificado"));
  const independent="El horario es de solo lectura; no se puede editar.";
  assert.equal(context.presentationAnswer(independent),independent);
});
test("existing read-only API contract and session isolation are preserved",()=>{
  assert.match(ai,/body\.read_only!==true \|\| body\.actions_executed!==false/);
  assert.match(ai,/stored\.user!==mountedUserId/);
  assert.match(ai,/stored\.museum!==verifiedMuseum/);
  assert.match(ai,/stored\.grants!==mountedGrants/);
  assert.match(ai,/const displayAnswer=presentationAnswer\(body\.answer\)/);
  assert.match(ai,/const displayAnswer=presentationAnswer\(item\.answer\)/);
  assert.match(html,/js\/instituva-ai\.js\?v=20261127-payroll-comparison-1/);
});
