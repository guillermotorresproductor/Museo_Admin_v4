import {assertEmployeeTenantRows} from "./tenant-guard.ts";
import {validAttendanceDay} from "./attendance-day.ts";

// A narrow cross-module read-only comparison: employee_shifts + attendance_events.
// Called only AFTER the existing authenticated attendance permissions have been
// checked and all service-role rows have passed explicit tenant/employee checks.
// No employee IDs, shift IDs, timestamps or payroll data leave this function.
export type CrosscheckShift={
  id:string;museum_id:string;employee_id:string;shift_date:string;
  status:string;starts_at:string|null;ends_at:string|null;
};
export type CrosscheckEvent={
  id:string;museum_id:string;employee_id:string;shift_id:string;
  event_type:string;occurred_at:string;
};
const statuses=new Set(["scheduled","cancelled","completed","day_off"]);
const eventTypes=new Set(["clock_in","clock_out","lunch_out","lunch_in"]);

export function summarizeAttendanceScheduleCrosscheck(
  shifts:readonly CrosscheckShift[],effectiveEvents:readonly CrosscheckEvent[],
  museumId:string,employeeId:string,day:string
){
  validAttendanceDay(day);
  assertEmployeeTenantRows(shifts,museumId,employeeId);
  assertEmployeeTenantRows(effectiveEvents,museumId,employeeId);
  const shiftIds=new Set<string>(),dayOffShiftIds=new Set<string>();
  let dayOffRecords=0,scheduledRecords=0;
  for(const s of shifts){
    if(typeof s.id!=="string"||!s.id||shiftIds.has(s.id)||
       s.shift_date!==day||typeof s.status!=="string"||!statuses.has(s.status))
      throw Error("UPSTREAM_FAILURE");
    shiftIds.add(s.id);
    if(s.status==="day_off"){
      if(s.starts_at!==null||s.ends_at!==null)throw Error("UPSTREAM_FAILURE");
      dayOffRecords++;
      dayOffShiftIds.add(s.id);
    }else{
      if(typeof s.starts_at!=="string"||typeof s.ends_at!=="string"||
         !Number.isFinite(Date.parse(s.starts_at))||
         !Number.isFinite(Date.parse(s.ends_at))||
         Date.parse(s.ends_at)<=Date.parse(s.starts_at))
        throw Error("UPSTREAM_FAILURE");
      if(s.status==="scheduled")scheduledRecords++;
    }
  }
  const eventIds=new Set<string>();
  let linkedToDayOff=0;
  for(const e of effectiveEvents){
    if(typeof e.id!=="string"||!e.id||eventIds.has(e.id)||
       typeof e.shift_id!=="string"||!e.shift_id||
       typeof e.event_type!=="string"||!eventTypes.has(e.event_type)||
       typeof e.occurred_at!=="string"||!Number.isFinite(Date.parse(e.occurred_at)))
      throw Error("UPSTREAM_FAILURE");
    eventIds.add(e.id);
    if(dayOffShiftIds.has(e.shift_id))linkedToDayOff++;
  }
  const coincidence=dayOffRecords>0 && effectiveEvents.length>0;
  return {
    type:"attendance_schedule_crosscheck",
    day_off_schedule_records:dayOffRecords,
    scheduled_shift_records:scheduledRecords,
    effective_punch_records:effectiveEvents.length,
    day_off_and_punches_same_calendar_day:coincidence,
    punches_linked_to_day_off_shift:linkedToDayOff,
    requires_manual_schedule_review:coincidence,
    warning:"Solo compara registros autorizados de Horarios y Asistencia del mismo empleado y día. La coincidencia de un día libre con marcaciones es una observación, NO demuestra incumplimiento: pueden corresponder a turnos nocturnos de otra fecha o a correcciones. day_off no prueba aprobación de vacaciones. La IA no cambia jornadas, ponches ni solicitudes."
  };
}
