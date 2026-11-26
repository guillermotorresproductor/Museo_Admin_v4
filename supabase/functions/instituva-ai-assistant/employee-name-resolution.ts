import {assertTenantRows} from "./tenant-guard.ts";
import {validAttendanceDay} from "./attendance-day.ts";

// Only the current authenticated museum's minimal employee identity fields.
export type ScopedEmployeeName = {
  id:string;museum_id:string;first_name:string;last_name:string;
};
export type EmployeeResolution =
  | {kind:"selected";employee:ScopedEmployeeName}
  | {kind:"ambiguous";options:readonly {employee_id:string;name:string}[]}
  | {kind:"need_more_name"}
  | {kind:"not_found"};

const normalize=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toLocaleLowerCase("es").replace(/\s+/g," ").trim();
const namePattern=/^[\p{L}\p{M}.' -]{2,120}$/u;
const uuidPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const excluded=new Set([
  "ayer","hoy","manana","dia","dias","el","la","los","las","un","una",
  "ponche","ponches","ponchar","turno","turnos","jornada","jornadas",
  "registro","registros","entrada","salida","asistencia","nomina",
  "museo","empleado","empleada","empleados","empleadas","esta","este",
  "que","cual","quien","cuando","como","porque","para","del","de",
  "se","al","con","su","sus","no","si","me","hay","fue","esta"
]);

// Conservative recognition of a person after "de/para" in a workplace question.
// Never selects a different organization; matching is done separately after auth.
export function inferEmployeeName(question:string):string|null{
  const tokens=Array.from(question.matchAll(/[\p{L}\p{M}][\p{L}\p{M}.'-]*/gu))
    .map(m=>m[0]);
  let found:string|null=null;
  for(let i=0;i<tokens.length-1;i++){
    if(!["de","del","para"].includes(normalize(tokens[i])))continue;
    const given=tokens[i+1];
    if(!given || given.length<2 || excluded.has(normalize(given)))continue;
    const surname=tokens[i+2];
    const second=surname && !excluded.has(normalize(surname)) && surname.length>=2
      ? " "+surname : "";
    const candidate=(given+second).trim();
    if(namePattern.test(candidate))found=candidate;
  }
  return found;
}

const puertoRicoLocalDay=(now:Date):string=>{
  if(!Number.isFinite(now.getTime()))throw Error("INVALID_REQUEST");
  const parts=new Intl.DateTimeFormat("en-US",{
    timeZone:"America/Puerto_Rico",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(now);
  const piece=(type:string)=>parts.find(p=>p.type===type)?.value||"";
  return validAttendanceDay(piece("year")+"-"+piece("month")+"-"+piece("day"));
};
export function attendanceDayFromQuestion(
  explicitDay:unknown,question:string,now=new Date()
):string|null{
  if(typeof explicitDay==="string" && explicitDay.trim())
    return validAttendanceDay(explicitDay.trim());
  const s=normalize(question);
  const yesterday=/\bayer\b/.test(s);
  const today=/\bhoy\b/.test(s);
  if(yesterday===today)return null;
  const day=puertoRicoLocalDay(now);
  if(today)return day;
  return validAttendanceDay(new Date(Date.parse(day+"T00:00:00Z")-86400000)
    .toISOString().slice(0,10));
}

export function resolveScopedEmployeeName(
  rows:readonly ScopedEmployeeName[],museumId:string,
  requestedName:string,selectedId:unknown=null
):EmployeeResolution{
  // Fail closed before any matching or option labels are constructed.
  assertTenantRows(rows,museumId);
  if(rows.length>=300)throw Error("UPSTREAM_FAILURE");
  const name=requestedName.trim();
  if(!namePattern.test(name))throw Error("INVALID_REQUEST");
  if(selectedId!==null && (typeof selectedId!=="string" || !uuidPattern.test(selectedId)))
    throw Error("INVALID_REQUEST");
  const fragments=normalize(name).split(" ");
  const exact=fragments.length>=2;
  const matched=rows.filter(e=>
    exact? normalize(e.first_name+" "+e.last_name)===normalize(name):
      normalize(e.first_name)===normalize(name)
  );
  if(!matched.length)return {kind:"not_found"};
  if(selectedId!==null){
    const chosen=matched.find(e=>e.id===selectedId);
    if(!chosen)throw Error("FORBIDDEN");
    return {kind:"selected",employee:chosen};
  }
  if(matched.length===1)return {kind:"selected",employee:matched[0]};
  // Avoid ambiguous choices with identical full names or huge name enumerations.
  if(matched.length>10 ||
    new Set(matched.map(e=>normalize(e.first_name+" "+e.last_name))).size!==matched.length)
    return {kind:"need_more_name"};
  return {
    kind:"ambiguous",
    options:matched.map(e=>({
      employee_id:e.id,
      name:(e.first_name+" "+e.last_name).trim().slice(0,120)
    })).sort((a,b)=>a.name.localeCompare(b.name,"es"))
  };
}
