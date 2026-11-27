import {validAttendanceDay,nextAttendanceDay} from "./attendance-day.ts";

export type ConversationPlan={
  mode:"attendance"|"finance"|"collections"|"inventory"|"assets"|"schedules"|"notifications"|"product";
  attendanceIntent:"hours"|"arrival"|"incidents"|"absence"|"overtime"|"general";
  employeeName:string|null;
  day:string|null;
  range:{start:string;endExclusive:string}|null;
};
const normalized=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
// Clearly external personal requests are never sent to the model or any data-read route.
// This conservative filter does not classify ambiguous questions or museum operations.
export const isClearlyExternalQuestion=(question:string):boolean=>{
 const q=normalized(question);
 if(/\b(instituva|museo|nomina|asistencia|finanzas|colecciones|inventario|horarios|emplead[oa]s?|ponche|sistema|modulo)\b/.test(q))return false;
 return /\b(?:restaurantes?|receta de cocina|preparar una cena|pronostico del tiempo|clima de hoy|horoscopo|signo zodiacal|resultado del partido|marcador de futbol|reservar hotel|vuelos baratos|mi automovil|mi carro|mi vehiculo|cambiar aceite del carro|contrato de arrendamiento de mi apartamento)\b/.test(q);
};
const isContextualFollowup=(q:string)=>/^(?:[¿¡]\s*)?(?:y\b|entonces\b|tambien\b|en ese caso\b|de esos\b|de esas\b|los mismos\b|las mismas\b|cuantos hay\b|cuantas hay\b|que ocurre con eso\b|que paso con eso\b)/.test(q);
const months=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const nameStops=new Set(["de","del","en","desde","hasta","durante","noviembre","octubre","septiembre","diciembre","enero","febrero","marzo","abril","mayo","junio","julio","agosto","trabajo","trabajado","trabajaron","trabajados","horas","dias","dia","cuantas","cuantos","el","la","los","las","a","y","este","mes","ano","mismo","periodo"]);
const localToday=(now:Date)=>{
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Puerto_Rico",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
 const p=(t:string)=>parts.find(v=>v.type===t)?.value||"";
 return validAttendanceDay(p("year")+"-"+p("month")+"-"+p("day"));
};
const safeContext=(v:unknown):{mode:string;employee_name:string;start_day:string;end_day:string;day:string}|null=>{
 if(!v||typeof v!=="object"||Array.isArray(v))return null;
 const c=v as Record<string,unknown>;
 if(typeof c.mode!=="string" || !["attendance","finance","collections","inventory","assets","schedules","notifications","product"].includes(c.mode))return null;
 if(c.mode!=="attendance" && Object.keys(c).some(key=>key!=="mode"))return null;
 const name=typeof c.employee_name==="string" && c.employee_name.length<=120 && /^[\p{L}\p{M}.' -]*$/u.test(c.employee_name)?c.employee_name:"";
 const day=typeof c.day==="string"?c.day:"";
 const start=typeof c.start_day==="string"?c.start_day:"";
 const end=typeof c.end_day==="string"?c.end_day:"";
 try{if(day)validAttendanceDay(day);if(start)validAttendanceDay(start);if(end)validAttendanceDay(end);}
 catch{return null;}
 return {mode:c.mode,employee_name:name,start_day:start,end_day:end,day};
};
export function planNaturalQuery(question:string,input:Record<string,unknown>,now=new Date()):ConversationPlan {
 const text=normalized(question);
 const context=safeContext(input.conversation_context);
 const explicit=typeof input.mode==="string"?input.mode:"auto";
 const modes=["attendance","finance","collections","inventory","assets","schedules","notifications","product"];
 if(explicit!=="auto"&&!modes.includes(explicit))throw Error("INVALID_REQUEST");
 const attendance=/\b(?:horas?\s+trabajad[ao]s?|trabaj[oó]|ponch\w*|asistencia|almuerzo|llegad\w*|llego tarde|llegaron tarde|tardanz\w*|jornad\w*|entrad\w*|salid\w*|turno trabajado|nomina|horas adicionales|sobretiempo|ausencia(?:s)?|ausente(?:s)?|falt[oó])\b/.test(text) ||
   /\b(cuantas|cuantos)\s+(horas|dias)\b/.test(text);
 const finance=/\b(presupuesto|ingresos|gastos|balance|finanzas|cuentas por pagar)\b/.test(text);
 const collections=/\b(colecciones|piezas museograficas|obras de la coleccion)\b/.test(text);
 const inventory=/\b(inventario|equipos|mobiliario|activos fisicos)\b/.test(text);
 const schedules=/\b(horarios|turnos programados|solapamientos)\b/.test(text);
 const notifications=/\b(notificaciones|avisos internos|mis alertas)\b/.test(text);
 // Questions about the general correction policy do not authorize a private
 // employee lookup. Date-specific requests retain the guarded attendance route.
 const policyQuestion=/\b(?:quien(?:es)?|por que|porque|permiso(?:s)?|autorizad\w*|regla(?:s)?|politica(?:s)?|procedimiento(?:s)?|puede(?:n)?|debe(?:n)?)\b/.test(text) &&
   /\b(?:corregir|correccion(?:es)?|editar|modificar)\b/.test(text) &&
   /\b(?:ponch\w*|asistencia|marcacion(?:es)?)\b/.test(text);
 const hasSpecificPeriod=/\b(?:hoy|ayer|anteayer|20\d{2}-\d{2}-\d{2}|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/.test(text);
 let mode:ConversationPlan["mode"]=explicit==="auto"?
   (policyQuestion&&!hasSpecificPeriod?"product":attendance?"attendance":finance?"finance":collections&&inventory?"assets":collections?"collections":inventory?"inventory":schedules?"schedules":notifications?"notifications":context && isContextualFollowup(text)?context.mode as ConversationPlan["mode"]:"product")
   :explicit as ConversationPlan["mode"];
 if(/\b(cuanto representa|cuanto cobrar|pago de nomina|salario|tarifa por hora)\b/.test(text) && explicit==="auto")
   mode="product"; // No wage or payroll transaction inference from attendance.
 const attendanceIntent:ConversationPlan["attendanceIntent"]=
   /\b(?:horas?\s+(?:extra|extras|adicionales)|tiempo\s+extra|sobretiempo)/.test(text)?"overtime":
   /\b(?:falt[oó]|faltas?\s+al\s+trabajo|ausencia(?:s)?|ausente(?:s)?|no\s+asistio)/.test(text)?"absence":
   /\b(?:irregularidad(?:es)?|incidencia(?:s)?|anomalia(?:s)?|problema(?:s)?|faltantes?|sin\s+almuerzo|sin\s+ponch)/.test(text)?"incidents":
   /\b(?:tarde|tardanza(?:s)?|llegad[ao]\s+tarde|entrada(?:s)?\s+posterior(?:es)?)/.test(text)?"arrival":
   /\b(?:horas?|tiempo\s+trabajad[ao]|jornada(?:s)?\s+trabajad[ao]s?)/.test(text)?"hours":"general";
 const candidate=question.match(/\b(?:de|del|trabajo|trabaj[oó]|lleg[oó]|ponch[oó]|marc[oó])\s+([\p{Lu}][\p{L}\p{M}.'-]{1,40})(?:\s+([\p{Lu}][\p{L}\p{M}.'-]{1,40}))?/u);
 let employeeName=candidate?(candidate[1]+(candidate[2]?" "+candidate[2]:"")):null;
 if(employeeName && employeeName.split(" ").some(x=>nameStops.has(normalized(x))))employeeName=null;
 if(!employeeName && /^[\p{L}\p{M}.' -]{2,120}$/u.test(question.trim()) && question.trim().split(/\s+/).length<=3) employeeName=question.trim();
 if(typeof input.employee_name==="string"&&input.employee_name.trim())employeeName=input.employee_name.trim().slice(0,120);
 if(!employeeName && context?.mode==="attendance")employeeName=context.employee_name||null;
 let range:ConversationPlan["range"]=null;
 let day:string|null=null;
 const month=months.findIndex(m=>new RegExp("\\b"+m+"\\b").test(text) || (m==="noviembre" && text.split(/\s+/).includes("nov")));
 if(month>=0){
   const yearMatch=text.match(/\b(20\d{2})\b/);
   const year=yearMatch?Number(yearMatch[1]):Number(localToday(now).slice(0,4));
   const prefix=String(year)+"-"+String(month+1).padStart(2,"0")+"-";
   const max=new Date(Date.UTC(year,month+1,0)).getUTCDate();
   const explicitRange=text.match(/\b(?:del|desde el|entre el)\s+(\d{1,2})\s+(?:al|hasta el|y el)\s+(\d{1,2})\b/);
   const first=explicitRange?Number(explicitRange[1]):1;
   const last=explicitRange?Number(explicitRange[2]):max;
   if(first<1||last>max||first>last)throw Error("INVALID_REQUEST");
   const start=validAttendanceDay(prefix+String(first).padStart(2,"0"));
   const requestedEnd=nextAttendanceDay(validAttendanceDay(prefix+String(last).padStart(2,"0")));
   const todayExclusive=nextAttendanceDay(localToday(now));
   if(start>=todayExclusive)throw Error("INVALID_REQUEST");
   // The current month is partial: never count future days as missing work.
   const end=requestedEnd>todayExclusive?todayExclusive:requestedEnd;
   range={start,endExclusive:end};
 }else if(context?.mode==="attendance"&&context.start_day&&context.end_day&&
     !/\b(hoy|ayer|fecha|dia\s+\d{1,2})\b/.test(text)){
    const start=validAttendanceDay(context.start_day);
    const end=validAttendanceDay(context.end_day);
    const count=(Date.parse(end)-Date.parse(start))/86400000;
    if(count>0&&count<=31)range={start,endExclusive:end};
 }
 const specific=text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
 if(specific)day=validAttendanceDay(specific[1]);
 else if(/\bayer\b/.test(text))day=validAttendanceDay(new Date(Date.parse(localToday(now)+"T00:00:00Z")-86400000).toISOString().slice(0,10));
 else if(/\bhoy\b/.test(text))day=localToday(now);
 else if(context?.day && !range)day=validAttendanceDay(context.day);
 if(day)range=null;
 return {mode,employeeName,day,range,attendanceIntent};
}
