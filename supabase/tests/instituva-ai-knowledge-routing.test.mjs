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
import {comparisonWindows,compareAuthorizedPayroll} from "../functions/instituva-ai-assistant/payroll-comparison.ts";
import {summarizeCollections} from "../functions/instituva-ai-assistant/collections-summary.ts";
import {summarizeInventory} from "../functions/instituva-ai-assistant/inventory-summary.ts";

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
test("employee headcount is an authorized aggregate, never a generic product guess",()=>{
  assert.equal(plan("¿Cuántos empleados activos tiene actualmente este museo? Indica el total y la fuente consultada.").mode,"staff");
  assert.equal(plan("¿Cuántas empleadas están registradas en la plantilla?").mode,"staff");
  assert.deepEqual(requiredPermissionsForMode("staff"),["employees.read.all"]);
  assert.equal(plan("¿Cuántos equipos hay en inventario?").mode,"inventory");
  assert.equal(plan("¿Cuántas horas trabajó Ana ayer?").mode,"attendance");
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

test("payroll comparison is routed separately from attendance and budget",()=>{
  assert.equal(plan("¿Por qué la nómina de Roberto es mayor esta semana?").mode,"payroll");
  assert.equal(plan("¿Es mayor la nómina de Roberto Díaz esta semana?").employeeName,"Roberto Díaz");
  assert.equal(plan("¿Cuál es la nómina presupuestada?").mode,"attendance");
  assert.equal(plan("¿Qué diferencia hay en el presupuesto de finanzas?").mode,"finance");
  assert.equal(plan("¿Cómo se calcula la nómina?").mode,"product");
  assert.equal(plan("¿Y la diferencia?",{conversation_context:{mode:"payroll",employee_name:"Roberto Díaz"}}).mode,"payroll");
  assert.equal(plan("¿Y la diferencia?",{conversation_context:{mode:"payroll",employee_name:"Roberto Díaz"}}).employeeName,"Roberto Díaz");
  assert.equal(plan("¿Y la diferencia?",{conversation_context:{mode:"payroll",employee_name:"Roberto Díaz",employee_id:"malicious"}}).mode,"product");
});
test("payroll requires independent authorized compensation, finance and attendance grants",()=>{
  assert.deepEqual(requiredPermissionsForMode("payroll"),["attendance.history.read","finance.read","compensation.read"]);
});
test("Puerto Rico week comparison never includes future days",()=>{
  const windows=comparisonWindows(new Date("2026-11-27T18:00:00Z"));
  assert.deepEqual(windows,{
    current:{from:"2026-11-23",to:"2026-11-27"},
    previous:{from:"2026-11-16",to:"2026-11-22"},partial:true
  });
  const sunday=comparisonWindows(new Date("2026-11-29T18:00:00Z"));
  assert.equal(sunday.current.to,"2026-11-29");
  assert.equal(sunday.partial,false);
});
test("comparison uses only explicitly selected employee's authorized result",()=>{
  const w=comparisonWindows(new Date("2026-11-27T18:00:00Z"));
  const employee="00000000-0000-0000-0000-000000000011";
  const other="00000000-0000-0000-0000-000000000022";
  const row=(id,amount,minutes,approved=0)=>({
    employee_id:id,name:"Nombre de prueba",compensation_type:"hourly",
    actual_amount:amount,worked_minutes:minutes,payable_minutes:minutes,
    approved_minutes:approved,state:"CALCULADA",days:[]
  });
  const result=compareAuthorizedPayroll(
    {employees:[row(other,500000,1000),row(employee,300,480,60)]},
    {employees:[row(employee,200,420,0),row(other,999999,900)]},
    employee,"Empleado de Prueba",w
  );
  assert.equal(result.evidence.difference,100);
  assert.equal(result.evidence.current_approved_minutes,60);
  assert.match(result.answer,/\$300/);
  assert.doesNotMatch(result.answer,/500000|999999|Nombre de prueba/);
  assert.match(result.answer,/semana actual aún está en curso/);
});
test("payroll snapshots fail closed on duplicates, malformed rates or wrong employee",()=>{
  const w=comparisonWindows(new Date("2026-11-27T18:00:00Z"));
  const id="00000000-0000-0000-0000-000000000011";
  const valid={employee_id:id,name:"Prueba",compensation_type:"hourly",
    actual_amount:200,worked_minutes:480,payable_minutes:480,
    approved_minutes:0,state:"CALCULADA",days:[]};
  assert.throws(()=>compareAuthorizedPayroll({employees:[valid,valid]},
    {employees:[valid]},id,"Empleado de Prueba",w),/UPSTREAM_FAILURE/);
  assert.throws(()=>compareAuthorizedPayroll({employees:[{...valid,actual_amount:Infinity}]},
    {employees:[valid]},id,"Empleado de Prueba",w),/UPSTREAM_FAILURE/);
  const missing=compareAuthorizedPayroll({employees:[]},{employees:[]},id,"Empleado de Prueba",w);
  assert.equal(missing.evidence.comparison_available,false);
  assert.doesNotMatch(missing.answer,/\$0/);
});
test("salary compensation is never misrepresented as weekly wage",()=>{
  const w=comparisonWindows(new Date("2026-11-27T18:00:00Z"));
  const id="00000000-0000-0000-0000-000000000011";
  const row={employee_id:id,name:"Prueba",compensation_type:"salary",
    actual_amount:0,worked_minutes:480,payable_minutes:480,approved_minutes:0,
    state:"PERIODO PARCIAL",days:[]};
  const out=compareAuthorizedPayroll({employees:[row]},{employees:[row]},id,"Empleado de Prueba",w);
  assert.equal(out.evidence.comparison_available,false);
  assert.match(out.answer,/salario mensual/);
});

test("cross-module payroll explains authorized daily statuses without leaking shift or rate",()=>{
  const windows=comparisonWindows(new Date("2026-11-27T18:00:00Z"));
  const id="00000000-0000-0000-0000-000000000011";
  const row=(amount,worked,approved,days)=>({
    employee_id:id,name:"Nombre privado",compensation_type:"hourly",
    actual_amount:amount,worked_minutes:worked,payable_minutes:worked,
    approved_minutes:approved,state:"CALCULADA",days
  });
  const current=row(375,980,60,[
    {shift_date:"2026-11-23",state:"COMPLETA",worked_minutes:480,
      approved_minutes:60,amount:185,hourly_rate:99999,notes:"Secreto"},
    {shift_date:"2026-11-24",state:"PENDIENTE DE CORRECCIÓN",
      worked_minutes:0,approved_minutes:0,amount:0,shift_id:"secret-id"},
    {shift_date:"2026-11-25",state:"COMPLETA",
      worked_minutes:500,approved_minutes:0,amount:190}
  ]);
  const past=row(310,900,0,[
    {shift_date:"2026-11-16",state:"COMPLETA",
      worked_minutes:450,approved_minutes:0,amount:155},
    {shift_date:"2026-11-17",state:"COMPLETA",
      worked_minutes:450,approved_minutes:0,amount:155}
  ]);
  const result=compareAuthorizedPayroll({employees:[current]},
    {employees:[past]},id,"Empleado de Prueba",windows);
  assert.equal(result.evidence.difference,65);
  assert.equal(result.evidence.current_exception_days,1);
  assert.equal(result.evidence.current_days,3);
  assert.match(result.answer,/PENDIENTE DE CORRECCIÓN: 1/);
  assert.match(result.answer,/Jornadas con minutos adicionales aprobados: 1 frente a 0/);
  assert.doesNotMatch(JSON.stringify(result),/Secreto|secret-id|99999|Nombre privado/);
  assert.match(result.answer,/no demuestran por sí solas su causa/);
});
test("daily payroll comparisons fail closed on malformed or out-of-period records",()=>{
  const windows=comparisonWindows(new Date("2026-11-27T18:00:00Z"));
  const id="00000000-0000-0000-0000-000000000011";
  const row=(days)=>({employee_id:id,name:"Prueba",compensation_type:"hourly",
    actual_amount:100,worked_minutes:480,payable_minutes:480,
    approved_minutes:0,state:"CALCULADA",days});
  const previous=row([{shift_date:"2026-11-16",state:"COMPLETA",
    worked_minutes:480,approved_minutes:0,amount:100}]);
  for(const bad of [
    {shift_date:"2026-11-28",state:"COMPLETA",worked_minutes:480,approved_minutes:0,amount:100},
    {shift_date:"2026-11-24",state:"DESCONOCIDO",worked_minutes:480,approved_minutes:0,amount:100},
    {shift_date:"2026-11-24",state:"COMPLETA",worked_minutes:480,approved_minutes:-1,amount:100}
  ]){
    assert.throws(()=>compareAuthorizedPayroll({employees:[row([bad])]},
      {employees:[previous]},id,"Empleado de Prueba",windows),/UPSTREAM_FAILURE/);
  }
});

test("cross-module aggregate inventory and collections remain independent",()=>{
 const museum=museumA;
 const pieces=[
  {id:"c1",museum_id:museum,status:"ingreso"},
  {id:"c2",museum_id:museum,status:"catalogada"}
 ];
 const photos=[{museum_id:museum,item_id:"c1"}];
 const history=[{museum_id:museum,item_id:"c1"}];
 const collections=summarizeCollections(pieces,photos,history,museum);
 const inventory=summarizeInventory([
  {id:"i1",museum_id:museum,record_type:"equipo",status:"activo",quantity:4,archived_at:null},
  {id:"i2",museum_id:museum,record_type:"equipo",status:"archivado",quantity:1,archived_at:"2026-11-01"}
 ],museum,1);
 assert.equal(collections.item_count,2);
 assert.equal(collections.items_without_photos,1);
 assert.equal(collections.items_without_history,1);
 assert.equal(inventory.record_count,2);
 assert.equal(inventory.quantity_total,5);
 assert.equal(inventory.archived_records,1);
 assert.equal(inventory.missing_photo_records,1);
 assert.notEqual(collections.item_count,inventory.quantity_total);
});
test("cross-module synthetic records never cross museum boundaries",()=>{
 const items=[{id:"c1",museum_id:museumA,status:"catalogada"}];
 assert.throws(()=>summarizeCollections(items,[{museum_id:museumB,item_id:"c1"}],[],museumA),/FORBIDDEN/);
 assert.throws(()=>summarizeInventory([{id:"i1",museum_id:museumB,
   record_type:"equipo",status:"activo",quantity:1,archived_at:null}],museumA,0),/FORBIDDEN/);
 assert.throws(()=>summarizeInventory([{id:"i1",museum_id:museumA,
   record_type:"equipo",status:"activo",quantity:1,archived_at:null}],museumA,2),/UPSTREAM_FAILURE/);
});
test("combined assets route requires both independent module permissions",()=>{
 assert.equal(plan("¿Qué diferencias hay entre colecciones e inventario?").mode,"assets");
 assert.deepEqual(requiredPermissionsForMode("assets"),["collections.read","modules.inventory.read"]);
});

test("employee-name clarification resumes guarded payroll or attendance investigation",()=>{
  assert.equal(plan("Roberto Díaz",{conversation_context:{mode:"payroll"}}).mode,"payroll");
  assert.equal(plan("Roberto Díaz",{conversation_context:{mode:"payroll"}}).employeeName,"Roberto Díaz");
  assert.equal(plan("Roberto Díaz",{conversation_context:{mode:"attendance",day:"2026-11-26"}}).mode,"attendance");
  assert.equal(plan("Roberto Díaz",{conversation_context:{mode:"attendance",day:"2026-11-26"}}).day,"2026-11-26");
  assert.equal(plan("Roberto Díaz",{conversation_context:{mode:"finance"}}).mode,"product");
  assert.equal(plan("Roberto Díaz").mode,"product");
});
test("natural short follow-ups retain only a validated domain",()=>{
  for(const prompt of ["¿Qué debo revisar?","¿Puedes explicar esa diferencia?","¿Qué significa eso?","¿Por qué ocurrió?","¿Qué recomiendas?"]){
    assert.equal(plan(prompt,{conversation_context:{mode:"assets"}}).mode,"assets",prompt);
  }
  assert.equal(plan("¿Y en inventario?",{conversation_context:{mode:"assets"}}).mode,"inventory");
  assert.equal(plan("¿Y en finanzas?",{conversation_context:{mode:"assets"}}).mode,"finance");
  assert.equal(plan("¿Qué debo revisar?",{conversation_context:{mode:"attendance",employee_name:"Roberto",employee_id:"forged"}}).mode,"product");
  assert.equal(plan("¿Qué debo revisar?").mode,"product");
  assert.equal(plan("Revisemos el procedimiento general de control de inventario y su documentación institucional sin datos de personas",{conversation_context:{mode:"payroll",employee_name:"Roberto Díaz"}}).mode,"inventory");
});
