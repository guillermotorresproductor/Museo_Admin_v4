import {assertTenantRows} from "./tenant-guard.ts";
import {validAttendanceDay} from "./attendance-day.ts";

export type ScheduleEvidenceRow={
  id:string;museum_id:string;employee_id:string;shift_date:string;
  starts_at:string|null;ends_at:string|null;status:string;
};
// Exact values of the existing employee_shifts_status_check constraint.
const officialStatuses=new Set(["scheduled","cancelled","completed","day_off"]);

// Administrative counts only. Raw employee IDs and timestamps never go to AI.
export function summarizeSchedules(
  rows:readonly ScheduleEvidenceRow[],museumId:string,startDay:string,endExclusive:string
){
  validAttendanceDay(startDay);
  validAttendanceDay(endExclusive);
  assertTenantRows(rows,museumId);
  const ids=new Set<string>();
  const byEmployee=new Map<string,Array<{start:number;end:number}>>();
  const statuses=new Map<string,number>();
  let longShifts=0;
  let activeCount=0;
  for(const row of rows){
    if(typeof row.id!=="string"||!row.id||ids.has(row.id)||
      typeof row.employee_id!=="string"||!row.employee_id||
      typeof row.shift_date!=="string"||
      row.shift_date<startDay||row.shift_date>=endExclusive||
      typeof row.status!=="string"||!officialStatuses.has(row.status))
      throw Error("UPSTREAM_FAILURE");
    const status=row.status;
    // day_off intentionally has no start/end; it is not an attendance
    // event, a confirmed leave approval or an active shift to overlap.
    if(status==="day_off"){
      if(row.starts_at!==null||row.ends_at!==null)
        throw Error("UPSTREAM_FAILURE");
      ids.add(row.id);
      statuses.set(status,(statuses.get(status)||0)+1);
      continue;
    }
    if(typeof row.starts_at!=="string"||typeof row.ends_at!=="string")
      throw Error("UPSTREAM_FAILURE");
    const start=Date.parse(row.starts_at),end=Date.parse(row.ends_at);
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||
      end-start>72*60*60*1000)throw Error("UPSTREAM_FAILURE");
    ids.add(row.id);
    statuses.set(status,(statuses.get(status)||0)+1);
    if(end-start>12*60*60*1000)longShifts++;
    if(status==="scheduled"){
      activeCount++;
      const shifts=byEmployee.get(row.employee_id)||[];
      shifts.push({start,end});
      byEmployee.set(row.employee_id,shifts);
    }
  }
  let overlapPairs=0;
  for(const shifts of byEmployee.values()){
    shifts.sort((a,b)=>a.start-b.start);
    for(let i=0;i<shifts.length;i++){
      for(let j=i+1;j<shifts.length&&shifts[j].start<shifts[i].end;j++){
        overlapPairs++;
      }
    }
  }
  return {
    type:"schedules_readonly_summary",
    start_date:startDay,
    end_date_exclusive:endExclusive,
    record_count:rows.length,
    active_shift_records:activeCount,
    distinct_employees_with_active_shifts:byEmployee.size,
    potential_overlap_pairs:overlapPairs,
    shifts_over_12_hours:longShifts,
    statuses:[...statuses].sort((a,b)=>a[0].localeCompare(b[0]))
      .map(([status,count])=>({status,count})),
    warning:"Son registros de horario, no evidencia de asistencia ni de publicación en Mi Espacio. day_off indica un día libre en Horarios, pero no demuestra aprobación de una solicitud de ausencia. Los posibles solapamientos solo consideran turnos scheduled y requieren cotejo administrativo. No se consultaron nombres de empleados, ponches, nómina ni borradores externos."
  };
}
