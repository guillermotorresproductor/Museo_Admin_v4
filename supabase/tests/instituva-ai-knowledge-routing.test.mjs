// Run with Node 22.6+ (TypeScript stripping supported):
// node --experimental-strip-types --test supabase/tests/instituva-ai-knowledge-routing.test.mjs
// Pure local tests: no Supabase URL, credentials or operational records.
import test from "node:test";
import assert from "node:assert/strict";
import {planNaturalQuery,isClearlyExternalQuestion} from "../functions/instituva-ai-assistant/conversational-plan.ts";
import {formatDiagnosticResponse,parseDiagnosticResponse} from "../functions/instituva-ai-assistant/diagnostic-response.ts";
import {findProductKnowledge, PRODUCT_KNOWLEDGE} from "../functions/instituva-ai-assistant/product-knowledge.ts";
import {findIncidentRunbooks} from "../functions/instituva-ai-assistant/incident-runbooks.ts";
import {requiredPermissionsForMode,assertTenantRows,assertEmployeeTenantRows,assertActiveMuseumProfile} from "../functions/instituva-ai-assistant/tenant-guard.ts";

const now=new Date("2026-11-26T16:00:00-04:00");
const plan=(question, extras={})=>planNaturalQuery(question,{mode:"auto",...extras},now);
test("general correction permission question uses product knowledge, not private employee rows",()=>{
  assert.equal(plan("¿Por qué Roberto no puede corregir un ponche?").mode,"product");
  assert.equal(plan("¿Quién puede corregir los ponches?").mode,"product");
});
test("date-scoped attendance issue still uses guarded attendance path",()=>{
  assert.equal(plan("¿Por qué Roberto no puede corregir el ponche de ayer?").mode,"attendance");
  assert.equal(plan("¿Qué pasó con el ponche de Ana hoy?").mode,"attendance");
});
test("ordinary financial, collections and inventory questions preserve existing routing",()=>{
  assert.equal(plan("¿Cuál es el presupuesto de finanzas?").mode,"finance");
  assert.equal(plan("¿Cuántas piezas hay en colecciones?").mode,"collections");
  assert.equal(plan("¿Cuántos equipos hay en inventario?").mode,"inventory");
});
test("institutional correction policy is discoverable and flagged unverified",()=>{
  const results=findProductKnowledge("quién tiene permiso para corregir ponches",5);
  assert.ok(results.some(x=>x.id==="attendance-correction-roles"));
  assert.ok(results.filter(x=>x.id==="attendance-correction-roles").every(x=>x.sourceStatus==="historical-unverified"));
});
test("knowledge entries have nonempty unique IDs and source attribution",()=>{
  assert.equal(new Set(PRODUCT_KNOWLEDGE.map(x=>x.id)).size,PRODUCT_KNOWLEDGE.length);
  for(const x of PRODUCT_KNOWLEDGE){
    assert.ok(x.id && x.domain && x.title && x.source && x.statement);
    assert.ok(["reviewed-main","historical-unverified"].includes(x.sourceStatus ?? "historical-unverified"));
  }
});
test("runbooks only propose manual verifications, not executed actions",()=>{
  const guides=findIncidentRunbooks("jornada abierta sin ponche");
  assert.ok(guides.length>=1);
  for(const guide of guides){
    assert.ok(guide.verify.length && guide.safeActions.length && guide.uncertainty);
    assert.ok(guide.source && guide.commit);
  }
});

const museumA="00000000-0000-0000-0000-000000000001";
const museumB="00000000-0000-0000-0000-000000000002";
const employeeA="00000000-0000-0000-0000-000000000011";
const employeeB="00000000-0000-0000-0000-000000000022";
test("cross-museum synthetic evidence fails closed, including mixed batches",()=>{
  const mixed=[{museum_id:museumA},{museum_id:museumB}];
  assert.throws(()=>assertTenantRows(mixed,museumA),/FORBIDDEN/);
  assert.throws(()=>assertEmployeeTenantRows([{museum_id:museumA,employee_id:employeeB}],museumA,employeeA),/FORBIDDEN/);
  assert.deepEqual(assertEmployeeTenantRows([{museum_id:museumA,employee_id:employeeA}],museumA,employeeA),[{museum_id:museumA,employee_id:employeeA}]);
});
test("inactive, mismatched or malformed caller profile does not resolve tenant",()=>{
  assert.throws(()=>assertActiveMuseumProfile({id:employeeA,museum_id:museumB,status:"inactive"},employeeA),/FORBIDDEN/);
  assert.throws(()=>assertActiveMuseumProfile({id:employeeB,museum_id:museumA,status:"active"},employeeA),/FORBIDDEN/);
  assert.equal(assertActiveMuseumProfile({id:employeeA,museum_id:museumA,status:"active"},employeeA),museumA);
});
test("read permissions never broaden cross-domain access",()=>{
  assert.deepEqual(requiredPermissionsForMode("product"),[]);
  assert.deepEqual(requiredPermissionsForMode("attendance"),["attendance.history.read","finance.read"]);
  assert.deepEqual(requiredPermissionsForMode("assets"),["collections.read","modules.inventory.read"]);
  assert.throws(()=>requiredPermissionsForMode("unknown"),/FORBIDDEN/);
});

test("brief verified answers have no obligatory report, hypotheses or disclaimers",()=>{
  const data=parseDiagnosticResponse(JSON.stringify({
    resumen:"El inventario tiene 12 equipos registrados.",
    hipotesis:[],verificaciones:[],recomendaciones_manuales:[],limitaciones:[]
  }));
  assert.equal(formatDiagnosticResponse(data),"El inventario tiene 12 equipos registrados.");
});
test("important uncertainty is still shown when relevant",()=>{
  const data=parseDiagnosticResponse(JSON.stringify({
    resumen:"Hay 2 alertas activas.",
    hipotesis:[],verificaciones:["Cotejar la fecha de las alertas."],
    recomendaciones_manuales:[],limitaciones:["El conteo no demuestra la causa."]
  }));
  const answer=formatDiagnosticResponse(data);
  assert.match(answer,/Hay 2 alertas activas/);
  assert.match(answer,/Qué comprobar/);
  assert.match(answer,/El conteo no demuestra la causa/);
  assert.doesNotMatch(answer,/DIAGNÓSTICO PRELIMINAR|Orientación de solo lectura/);
});

test("brief follow-ups retain only the previous domain; explicit subjects switch domains",()=>{
  assert.equal(plan("¿Y cuántos hay?",{conversation_context:{mode:"inventory"}}).mode,"inventory");
  assert.equal(plan("¿Y cuánto queda?",{conversation_context:{mode:"finance"}}).mode,"finance");
  assert.equal(plan("¿Y en colecciones?",{conversation_context:{mode:"finance"}}).mode,"collections");
  assert.equal(plan("Explícame la seguridad de INSTITUVA",{conversation_context:{mode:"attendance",employee_name:"Roberto"}}).mode,"product");
  assert.equal(plan("¿Y las incidencias?",{conversation_context:{mode:"attendance",employee_name:"Roberto"}}).mode,"attendance");
  assert.equal(plan("¿Y cuánto queda?",{conversation_context:{mode:"finance",employee_name:"Otro"}}).mode,"product");
});
test("clearly personal requests do not use the institutional assistant",()=>{
  assert.equal(isClearlyExternalQuestion("¿Qué restaurantes recomiendas?"),true);
  assert.equal(isClearlyExternalQuestion("¿Qué tiempo hará?"),false); // fail-safe ambiguity: no false denial
  assert.equal(isClearlyExternalQuestion("¿Cuál es el pronóstico del tiempo?"),true);
  assert.equal(isClearlyExternalQuestion("¿Cómo reparar mi automóvil?"),true);
  assert.equal(isClearlyExternalQuestion("¿Cómo gestionar el inventario del museo?"),false);
  assert.equal(isClearlyExternalQuestion("¿Qué permisos hay en INSTITUVA?"),false);
});
