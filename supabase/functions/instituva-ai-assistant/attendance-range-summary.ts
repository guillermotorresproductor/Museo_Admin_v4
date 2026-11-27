import {assertEmployeeTenantRows} from "./tenant-guard.ts";
import {resolveEffectiveAttendanceEvents} from "./attendance-event-corrections.ts";
import {validAttendanceDay} from "./attendance-day.ts";
type Row={id:string;museum_id:string;employee_id:string;event_type:string;occurred_at:string;supersedes_event_id:string|null;shift_id:string;classification?:string|null};
type Shift={museum_id:string;employee_id:string;shift_date:string;starts_at:string;ends_at:string;status:string};
const dayOf=(time:string)=>{const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Puerto_Rico",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(time)); const part=(t:string)=>parts.find(p=>p.type===t)?.value||"";return part("year")+"-"+part("month")+"-"+part("day");};
const minutesBetween=(a:string,b:string)=>Math.round((Date.parse(b)-Date.parse(a))/60000);
export function summarizeAttendancePeriod(events:readonly Row[],replacements:readonly Row[],shifts:readonly Shift[],
  museumId:string,employeeId:string,start:string,endExclusive:string){
  validAttendanceDay(start);validAttendanceDay(endExclusive);
  const clean=assertEmployeeTenantRows(events,museumId,employeeId);
  const subs=assertEmployeeTenantRows(replacements,museumId,employeeId);
  const safeShifts=assertEmployeeTenantRows(shifts,museumId,employeeId);
  const {effectiveEvents,supersededCount}=resolveEffectiveAttendanceEvents(clean,subs,museumId,employeeId);
  const days=new Map<string,Row[]>();
  for(const event of effectiveEvents){
    const day=dayOf(event.occurred_at);
    if(day<start || day>=endExclusive)continue;
    const values=days.get(day)||[];
    values.push(event);
    days.set(day,values);
  }
  let verifiedNetMinutes=0,verifiedDays=0,incompleteDays=0,unverifiedLunchDays=0;
  let lateStarts=0,lateComparableDays=0,unmatchedShifts=0;
  const diagnostics:{day:string;status:string;net_minutes:number|null;late_start:boolean|null}[]=[];
  for(const [day,list] of [...days.entries()].sort((a,b)=>a[0].localeCompare(b[0]))){
    list.sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at));
    const kinds=list.map(x=>x.event_type);
    let net:number|null=null, status="incomplete";
    if(kinds.join(",")==="clock_in,lunch_out,lunch_in,clock_out" &&
       new Set(list.map(event=>event.shift_id)).size===1){
      const morning=minutesBetween(list[0].occurred_at,list[1].occurred_at);
      const afternoon=minutesBetween(list[2].occurred_at,list[3].occurred_at);
      const breakMinutes=minutesBetween(list[1].occurred_at,list[2].occurred_at);
      if(morning>=0&&afternoon>=0&&breakMinutes>=0&&morning+afternoon<=1440){
        net=morning+afternoon;status="verified_net";verifiedNetMinutes+=net;verifiedDays++;
      }
    }else if(kinds.join(",")==="clock_in,clock_out"){
      status="lunch_unverified";unverifiedLunchDays++;
    }
    if(status==="incomplete")incompleteDays++;
    const matching=safeShifts.filter(s=>s.shift_date===day && (s.status==="scheduled" || s.status==="published"));
    let late:null|boolean=null;
    if(kinds[0]==="clock_in" && matching.length===1){
      late=Date.parse(list[0].occurred_at)>Date.parse(matching[0].starts_at);
      if(Number.isFinite(Date.parse(matching[0].starts_at))){lateComparableDays++;if(late)lateStarts++;}
      else late=null;
    }else{unmatchedShifts++;}
    diagnostics.push({day,status,net_minutes:net,late_start:late});
  }
  const scheduledDates=new Set(safeShifts.filter(s=>
    (s.status==="scheduled" || s.status==="published") &&
    s.shift_date>=start && s.shift_date<endExclusive
  ).map(s=>s.shift_date));
  const scheduledDaysWithoutPunches=[...scheduledDates].filter(day=>!days.has(day)).length;
  return {
    start_day:start,end_day_inclusive:new Date(Date.parse(endExclusive+"T00:00:00Z")-86400000).toISOString().slice(0,10),
    days_with_punches:days.size,scheduled_days_without_punches:scheduledDaysWithoutPunches,
    verified_net_minutes:verifiedNetMinutes,
    verified_days:verifiedDays,incomplete_days:incompleteDays,
    days_without_confirmed_lunch:unverifiedLunchDays,
    entries_after_scheduled_start:lateStarts,comparable_schedule_days:lateComparableDays,
    days_without_comparable_shift:unmatchedShifts,
    superseded_punch_count:supersededCount,
    coverage:"Horas sumadas únicamente para jornadas con cuatro marcaciones cronológicas del mismo turno. Las jornadas incompletas o turnos programados sin marcaciones no se computan como cero horas trabajadas.",
    day_details:diagnostics
  };
}
