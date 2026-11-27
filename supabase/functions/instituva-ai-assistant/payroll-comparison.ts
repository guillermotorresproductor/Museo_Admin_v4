// Pure, bounded analysis of the existing payroll_actual RPC output.
// This function never accesses databases, edits records or exposes other staff.
import {validAttendanceDay} from "./attendance-day.ts";
type PayrollRow={employee_id:string;name:string;compensation_type?:string|null;actual_amount:number;worked_minutes:number;payable_minutes:number;approved_minutes:number;extraordinary_approved_minutes?:number;state?:string|null;days?:unknown[]};
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
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Puerto_Rico",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
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
  minutes(x.approved_minutes);
  if(x.extraordinary_approved_minutes!==undefined)minutes(x.extraordinary_approved_minutes);
  if(typeof x.state!=="string"||x.state.length>70)throw Error("UPSTREAM_FAILURE");
  return x;
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
  const diff=Math.round((a.actual_amount-b.actual_amount)*100)/100;
  const worked=a.worked_minutes-b.worked_minutes;
  const approved=a.approved_minutes-b.approved_minutes;
  const stateFlags=[a.state,b.state].filter(x=>x!=="CALCULADA");
  const observations=[
    "Horas registradas computadas: "+hours(a.worked_minutes)+" frente a "+hours(b.worked_minutes)+".",
    "Minutos adicionales aprobados: "+a.approved_minutes+" frente a "+b.approved_minutes+"."
  ];
  const cautions=[
    windows.partial?"La semana actual aún está en curso; los períodos tienen distinta duración.":"La comparación usa el cálculo actual, no un pago confirmado.",
    stateFlags.length?"Hay estados pendientes o incompletos; revisar las jornadas y autorizaciones antes de atribuir una causa.":"",
    "Las diferencias observadas no demuestran por sí solas su causa, ni acreditan depósito, cheque o conciliación."
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
    current_approved_minutes:a.approved_minutes,previous_approved_minutes:b.approved_minutes,
    current_state:a.state,previous_state:b.state,partial_current:windows.partial}};
}
