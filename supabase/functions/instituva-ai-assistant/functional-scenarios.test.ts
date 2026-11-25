// Functional acceptance scenarios using synthetic records only. No network,
// provider key, operational table or production data is accessed here.
import {summarizeCollections} from "./collections-summary.ts";
import {summarizeInventory} from "./inventory-summary.ts";
import {summarizeSchedules} from "./schedules-summary.ts";
import {summarizeSelfNotifications} from "./notifications-summary.ts";
import {extractCompletedDiagnosis} from "./provider-response.ts";
import {formatDiagnosticResponse} from "./diagnostic-response.ts";

const museum="11111111-1111-4111-8111-111111111111";
const otherMuseum="22222222-2222-4222-8222-222222222222";
const user="33333333-3333-4333-8333-333333333333";
const check=(value:boolean,message:string)=>{if(!value)throw Error(message)};
const forbidden=(fn:()=>unknown)=>{
 try{fn()}catch(e){return (e as Error).message==="FORBIDDEN"}return false;
};
Deno.test("scenario: collection photo gap is quantified, never declared lost or removed",()=>{
 const facts=summarizeCollections([
  {id:"artifact-1",museum_id:museum,status:"ingreso"},
  {id:"artifact-2",museum_id:museum,status:"catalogada"},
 ],[{museum_id:museum,item_id:"artifact-1"}],
 [{museum_id:museum,item_id:"artifact-1"}],museum);
 check(facts.item_count===2&&facts.items_without_photos===1,"photo gap incorrect");
 check(facts.items_without_history===1,"history gap incorrect");
 check(facts.warning.includes("no son necesariamente errores"),"unsupported conclusion");
 check(!JSON.stringify(facts).includes("artifact-1"),"individual piece ID leaked");
});
Deno.test("scenario: inventory missing photo is not an equipment loss",()=>{
 const facts=summarizeInventory([
   {id:"eq-1",museum_id:museum,status:"activo",record_type:"individual",quantity:2,archived_at:null},
   {id:"eq-2",museum_id:museum,status:"archivado",record_type:"lote",quantity:1,archived_at:"2026-11-20T00:00:00Z"}
 ],museum,1);
 check(facts.record_count===2&&facts.quantity_total===3,"inventory quantities");
 check(facts.missing_photo_records===1&&facts.archived_records===1,"inventory flags");
 check(facts.warning.includes("no prueban pérdida"),"invented asset-loss conclusion");
 check(!JSON.stringify(facts).includes("eq-1"),"equipment ID disclosed");
});
Deno.test("scenario: overlapping schedule flagged without inventing attendance",()=>{
 const facts=summarizeSchedules([
  {id:"shift-1",museum_id:museum,employee_id:"person-1",shift_date:"2026-11-25",starts_at:"2026-11-25T12:00:00Z",ends_at:"2026-11-25T20:00:00Z",status:"scheduled"},
  {id:"shift-2",museum_id:museum,employee_id:"person-1",shift_date:"2026-11-25",starts_at:"2026-11-25T19:00:00Z",ends_at:"2026-11-25T23:00:00Z",status:"scheduled"},
  {id:"shift-3",museum_id:museum,employee_id:"person-1",shift_date:"2026-11-25",starts_at:"2026-11-25T15:00:00Z",ends_at:"2026-11-25T16:00:00Z",status:"cancelled"}
 ],museum,"2026-11-25","2026-12-02");
 check(facts.potential_overlap_pairs===1&&facts.active_shift_records===2,"overlap reasoning");
 check(facts.warning.includes("no evidencia de asistencia"),"attendance inferred from schedule");
 check(!JSON.stringify(facts).includes("person-1"),"employee ID leaked");
});
Deno.test("scenario: own notification counted, delivery via email not asserted",()=>{
 const facts=summarizeSelfNotifications([
 {id:"notice-1",museum_id:museum,recipient_user_id:user,category:"alert",created_at:"2026-11-24T12:00:00.000Z",read_at:null},
 {id:"notice-2",museum_id:museum,recipient_user_id:user,category:"general",created_at:"2026-11-24T13:00:00.000Z",read_at:"2026-11-25T12:00:00.000Z"}
 ],museum,user,"2026-11-01T00:00:00.000Z","2026-11-26T00:00:00.000Z");
 check(facts.notification_count===2&&facts.unread_count===1,"notification counts");
 check(facts.warning.includes("no entrega de correo"),"incorrect delivery evidence");
 check(!JSON.stringify(facts).includes(user),"user ID disclosed");
});
Deno.test("scenario: a foreign museum record is never treated as evidence",()=>{
 check(forbidden(()=>summarizeCollections([{id:"x",museum_id:otherMuseum,status:"ingreso"}],[],[],museum)),"collection tenant");
 check(forbidden(()=>summarizeInventory([{id:"x",museum_id:otherMuseum,record_type:"individual",status:"activo",quantity:1,archived_at:null}],museum,0)),"inventory tenant");
});
Deno.test("scenario: a proposed manual remedy is always presented as unexecuted",()=>{
 const raw={
 resumen:"Existen indicios administrativos, pero la causa no se ha confirmado.",
 hipotesis:["Podría existir un registro incompleto."],
 verificaciones:["Cotejar el expediente de origen con el responsable autorizado."],
 recomendaciones_manuales:["Solicitar al responsable una revisión documentada sin editar desde la IA."],
 limitaciones:["La evidencia agregada no permite determinar una causa concreta."]
 };
 const response={status:"completed",error:null,incomplete_details:null,output:[{
  type:"message",role:"assistant",status:"completed",content:[{type:"output_text",text:JSON.stringify(raw)}]
 }]};
 const text=formatDiagnosticResponse(extractCompletedDiagnosis(response));
 check(text.includes("Hipótesis (no confirmadas)"),"hypothesis mislabelled");
 check(text.includes("Acciones manuales propuestas (NO ejecutadas)"),"manual remedy mislabelled");
 check(text.includes("No se ejecutó ninguna operación"),"write status missing");
 check(text.includes("Limitaciones de la evidencia"),"uncertainty not conveyed");
});
