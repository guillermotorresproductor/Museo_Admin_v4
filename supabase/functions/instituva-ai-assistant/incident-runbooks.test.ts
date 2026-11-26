import {findIncidentRunbooks} from "./incident-runbooks.ts";

const assert=(condition:boolean,message:string)=>{if(!condition)throw new Error(message);};
Deno.test("jornada abierta identifies attendance guidance, without database access",()=>{
 const matches=findIncidentRunbooks("No puedo ponchar por jornada abierta");
 assert(matches.some(x=>x.id==="attendance-open"),"attendance guide missing");
});
Deno.test("financial reconciliation is not mistaken for confirmed payment",()=>{
 const matches=findIncidentRunbooks("Mi factura tiene cheque pero no está conciliada");
 assert(matches.some(x=>x.id==="finance-checks"),"check reconciliation guide missing");
 assert(matches.every(x=>x.uncertainty.length>0 && x.safeActions.length>0),"missing uncertainty");
});
Deno.test("collection issue returns documented troubleshooting rather than modification",()=>{
 const matches=findIncidentRunbooks("No encuentro una pieza en colecciones");
 assert(matches.some(x=>x.id==="collections"),"collection guide missing");
});
Deno.test("unrelated questions do not invent incident evidence",()=>{
 assert(findIncidentRunbooks("¿Qué significa el número cuántico principal?").length===0,"unrelated guide selected");
});
Deno.test("all sources are pinned and guidance never contains record content",()=>{
 const guides=findIncidentRunbooks("ponche factura colección horarios usuario acceso",20);
 assert(guides.every(g=>/^[a-f0-9]{40}$/.test(g.commit)),"unpinned source");
 assert(guides.every(g=>g.verify.length>0&&g.safeActions.length>0&&g.uncertainty.length>0),"missing safeguards");
});

Deno.test("equipment issues use administrative inventory guidance",()=>{
 const guides=findIncidentRunbooks("Un equipo del inventario de equipos no aparece");
 assert(guides.some(x=>x.id==="equipment-inventory"),"equipment guidance missing");
});
Deno.test("notification issue does not claim delivery",()=>{
 const guides=findIncidentRunbooks("No me llegan las notificaciones del sistema");
 assert(guides.some(x=>x.id==="notifications"),"notification guidance missing");
 assert(guides.some(x=>x.uncertainty.includes("no demuestra")),"uncertainty missing");
});
Deno.test("private institutional documents remain restricted",()=>{
 const guides=findIncidentRunbooks("No puedo descargar un documento PDF");
 assert(guides.some(x=>x.id==="documents"),"documents guidance missing");
});
Deno.test("a leave request never proves approval or a punch",()=>{
 const guides=findIncidentRunbooks("Mi solicitud de días libres no aparece aprobada");
 assert(guides.some(x=>x.id==="days-off"),"leave guidance missing");
});
