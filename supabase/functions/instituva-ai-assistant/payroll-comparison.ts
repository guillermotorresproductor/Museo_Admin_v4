// Pure, bounded analysis of the existing payroll_actual RPC output.
// This function never accesses databases, edits records or exposes other staff.
import {validAttendanceDay} from "./attendance-day.ts";
type PayrollRow={employee_id:string;name:string;compensation_type?:string|null;actual_amount:number;worked_minutes:number;payable_minutes:number;over_limit_minutes:number;state?:string|null;days?:unknown[]};
type PayrollPayload={employees?:unknown};
const numeric=(value:unknown):number=>{
  if(typeof value!=="number"||!Number.isFinite(value)||Math.abs(value)>1e9)throw Error("UPSTREAM_FAILURE");
  return value;
};
const minutes=(value:unknown):number=>{
  const n=numeric(value);
  if(!Number.isSafeInteger(n)||n<0||n>7*24*60)throw Error("UPSTREAM_FAILURE");
  return n;
};
const date=(d:Date)=>validAttendanceDay(d.toISOString().slice(0,10));
export const comparisonWindows=(now=new Date())=>{
  if(!Number.isFinite(now.getTime()))throw Error("INVALID_REQUEST");
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Puerto_Rico",
    year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const part=(kind:string)=>parts.find(x=>x.type===kind)?.value||"";
  const today=part("year")+"-"+part("month")+"-"+part("day");
  validAttendanceDay(today);
  const utc=new Date(today+"T00:00:00Z");
  const mondayOffset=(utc.getUTCDay()+6)%7;
  const thisMonday=new Date(utc.getTime()-mondayOffset*86400000);
  const previousMonday=new Date(thisMonday.getTime()-7*86400000);
  const previousSunday=new Date(thisMonday.getTime()-86400000);
  return {current:{from:date(thisMonday),to:today},
    previous:{from:date(previousMonday),to:date(previousSunday)},partial:utc.getUTCDay()!==0};
};
const onlyEmployee=(raw:unknown,id:string):PayrollRow|null=>{
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("UPSTREAM_FAILURE");
  const list=(raw as PayrollPayload).employees;
  if(!Array.isArray(list)||list.length>500)throw Error("UPSTREAM_FAILURE");
  const matched=list.filter((x:unknown)=>x&&typeof x==="object"&&!Array.isArray(x)&&(x as {employee_id?:unknown}).employee_id===id);
  if(matched.length>1)throw Error("UPSTREAM_FAILURE");
  if(!matched.length)return null;
  const x=matched[0] as PayrollRow;
  // Treat all returned names, positions and line items as untrusted data.
  if(!["hourly","salary"].includes(String(x.compensation_type||"")) && x.compensation_type!==null)throw Error("UPSTREAM_FAILURE");
  if(typeof x.name!=="string"||x.name.length>120||!Array.isArray(x.days)||x.days.length>40)throw Error("UPSTREAM_FAILURE");
  numeric(x.actual_amount);minutes(x.worked_minutes);minutes(x.payable_minutes);
  minutes(x.over_limit_minutes);
  if(typeof x.state!=="string"||x.state.length>70)throw Error("UPSTREAM_FAILURE");
  return x;
};
// Validate and reduce the exact employee's daily payroll evidence. Exclude
// free-text names, notes, rates, budget labels and other employees from output.
type DayEvidence={day:string;state:string;worked_minutes:number;payable_minutes:number;over_limit_minutes:number;amount:number};
const permittedStates=new Set(["COMPLETA","PENDIENTE DE CORRECCIÓN","EN CURSO",
  "SIN PONCHAR","SIN TURNO","SIN TARIFA","EXCLUIDA"]);
const safeDaily=(row:PayrollRow,from:string,to:string):DayEvidence[]=>{
  if(!Array.isArray(row.days)||row.days.length>40)throw Error("UPSTREAM_FAILURE");
  const output:DayEvidence[]=[];
  for(const raw of row.days){
    if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("UPSTREAM_FAILURE");
    const v=raw as Record<string,unknown>;
    const day=typeof v.shift_date==="string"?validAttendanceDay(v.shift_date):"";
    if(!day||day<from||day>to)throw Error("UPSTREAM_FAILURE");
    if(typeof v.state!=="string"||!permittedStates.has(v.state))throw Error("UPSTREAM_FAILURE");
    const amount=numeric(v.amount);
    const worked_minutes=minutes(v.worked_minutes);
    const payable_minutes=minutes(v.payable_minutes);
    const over_limit_minutes=minutes(v.over_limit_minutes);
    output.push({day,state:v.state,worked_minutes,payable_minutes,over_limit_minutes,amount});
  }
  output.sort((a,b)=>a.day.localeCompare(b.day));
  return output;
};
const dailyFindings=(a:PayrollRow,b:PayrollRow,windows:ReturnType<typeof comparisonWindows>)=>{
  const current=safeDaily(a,windows.current.from,windows.current.to);
  const previous=safeDaily(b,windows.previous.from,windows.previous.to);
  const statusCounts=(rows:DayEvidence[])=>rows.reduce((acc,row)=>{
    if(row.state!=="COMPLETA")acc[row.state]=(acc[row.state]||0)+1;
    return acc;
  },{} as Record<string,number>);
  const incompleteA=statusCounts(current),incompleteB=statusCounts(previous);
  const flagged=Object.keys(incompleteA).length>0||Object.keys(incompleteB).length>0;
  const extraCurrent=current.filter(d=>d.over_limit_minutes>0).length;
  const extraPrevious=previous.filter(d=>d.over_limit_minutes>0).length;
  const describe=(set:Record<string,number>)=>Object.entries(set)
    .map(([state,count])=>state+": "+count).join("; ")||"sin incidencias de estado";
  const observations=[
    "Jornadas del cálculo oficial: "+current.length+" esta semana y "+previous.length+" la anterior.",
    "Jornadas con minutos por encima del límite semanal (no implican aprobación): "+extraCurrent+" frente a "+extraPrevious+"."
  ];
  if(flagged)observations.push("Estados que requieren cotejo: actual ("+
    describe(incompleteA)+"), anterior ("+describe(incompleteB)+").");
  return {observations,flagged,day_count_current:current.length,
    day_count_previous:previous.length,exception_days_current:Object.values(incompleteA).reduce((n,v)=>n+v,0),
    exception_days_previous:Object.values(incompleteB).reduce((n,v)=>n+v,0)};
};
const currency=(n:number)=>new Intl.NumberFormat("es-PR",{style:"currency",currency:"USD"}).format(n);
const hours=(m:number)=>(m/60).toFixed(2)+" h";
export function compareAuthorizedPayroll(current:unknown,previous:unknown,employeeId:string,employeeName:string,
  windows:ReturnType<typeof comparisonWindows>){
  if(typeof employeeId!=="string"||!employeeId||typeof employeeName!=="string"||
    !/^[\p{L}\p{M}.' -]{2,120}$/u.test(employeeName))throw Error("INVALID_REQUEST");
  const a=onlyEmployee(current,employeeId),b=onlyEmployee(previous,employeeId);
  if(!a&&!b)return {answer:"No hay cálculos de nómina para ese empleado en los dos períodos consultados. No equivale a ausencia ni a falta de pago.",
    evidence:{domain:"payroll",current_from:windows.current.from,current_to:windows.current.to,
      previous_from:windows.previous.from,previous_to:windows.previous.to,comparison_available:false}};
  if(!a||!b)return {answer:"Solo hay un período con cálculo de nómina para el empleado seleccionado. No puedo comparar importes sin datos de ambos períodos.",
    evidence:{domain:"payroll",current_from:windows.current.from,current_to:windows.current.to,
      previous_from:windows.previous.from,previous_to:windows.previous.to,comparison_available:false}};
  if(a.compensation_type==="salary"||b.compensation_type==="salary")return {
    answer:"El empleado figura con compensación salarial mensual en al menos uno de los períodos. Una comparación de semanas parciales no permite explicar su salario mensual; consulta un período mensual completo autorizado.",
    evidence:{domain:"payroll",comparison_available:false,reason:"monthly_salary_not_comparable"}
  };
  const dayEvidence=dailyFindings(a,b,windows);
  const diff=Math.round((a.actual_amount-b.actual_amount)*100)/100;
   const stateFlags=[a.state,b.state].filter(x=>x!=="CALCULADA");
  const observations=[
    "Horas registradas computadas: "+hours(a.worked_minutes)+" frente a "+hours(b.worked_minutes)+".",
    "Minutos computables: "+a.payable_minutes+" frente a "+b.payable_minutes+".",
    "Minutos fuera del límite semanal: "+a.over_limit_minutes+" frente a "+b.over_limit_minutes+".",
    ...dayEvidence.observations
  ];
  const cautions=[
    windows.partial?"La semana actual aún está en curso; los períodos tienen distinta duración.":"La comparación usa el cálculo actual, no un pago confirmado.",
    stateFlags.length||dayEvidence.flagged?"Hay estados pendientes o incompletos; revisar las jornadas y autorizaciones antes de atribuir una causa.":"",
    "El cálculo no confirma aprobaciones de minutos adicionales, cambios de tarifa, depósito, cheque ni conciliación; deben verificarse por separado."
  ].filter(Boolean);
  const answer="Nómina calculada para "+employeeName+": "+currency(a.actual_amount)+
    " ("+windows.current.from+" a "+windows.current.to+") frente a "+
    currency(b.actual_amount)+" ("+windows.previous.from+" a "+windows.previous.to+
    "). Diferencia: "+(diff>0?"+":"")+currency(diff)+". "+
    observations.join(" ")+" "+cautions.join(" ");
  return {answer,evidence:{domain:"payroll",comparison_available:true,
    current_from:windows.current.from,current_to:windows.current.to,
    previous_from:windows.previous.from,previous_to:windows.previous.to,
    current_amount:a.actual_amount,previous_amount:b.actual_amount,difference:diff,
    current_worked_minutes:a.worked_minutes,previous_worked_minutes:b.worked_minutes,
    current_payable_minutes:a.payable_minutes,previous_payable_minutes:b.payable_minutes,
    current_over_limit_minutes:a.over_limit_minutes,previous_over_limit_minutes:b.over_limit_minutes,
    current_state:a.state,previous_state:b.state,partial_current:windows.partial,
    current_days:dayEvidence.day_count_current,previous_days:dayEvidence.day_count_previous,
    current_exception_days:dayEvidence.exception_days_current,
    previous_exception_days:dayEvidence.exception_days_previous}};
}
