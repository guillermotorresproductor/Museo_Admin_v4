import {assertEmployeeTenantRows} from "./tenant-guard.ts";

export type AttendanceAlertEvidenceRow={
  museum_id:string;employee_id:string;alert_type:unknown;status:unknown;
  detected_at:unknown;
};
const alertTypes=new Set([
  "late","missing_clock_in","lunch_exceeded","missing_lunch",
  "early_clock_out","missing_clock_out","inconsistent_sequence"
]);
const alertStatuses=new Set(["active","auto_resolved","reviewed"]);

// Counts only. Do not send IDs, comments or full alert records to the model.
// An alert that was resolved/reviewed is not an active incident.
export function summarizeAttendanceAlertStates(
  rows:readonly AttendanceAlertEvidenceRow[],museumId:string,employeeId:string
){
  assertEmployeeTenantRows(rows,museumId,employeeId);
  const counts={active:0,auto_resolved:0,reviewed:0};
  for(const row of rows){
    if(typeof row.alert_type!=="string"||!alertTypes.has(row.alert_type)||
       typeof row.status!=="string"||!alertStatuses.has(row.status)||
       (row.detected_at!==null &&
          (typeof row.detected_at!=="string" ||
            !Number.isFinite(Date.parse(row.detected_at)))))
      throw Error("UPSTREAM_FAILURE");
    counts[row.status as keyof typeof counts]++;
  }
  return {
    total_alert_records:rows.length,
    active_alerts:counts.active,
    auto_resolved_alerts:counts.auto_resolved,
    reviewed_alerts:counts.reviewed,
    warning:"Solo las alertas con estado active se consideran pendientes de revisión. Una alerta auto_resolved o reviewed es histórica, no prueba una incidencia actual ni una corrección ejecutada por la IA."
  };
}
