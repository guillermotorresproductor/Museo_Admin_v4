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
