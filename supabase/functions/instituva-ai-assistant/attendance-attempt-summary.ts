import {assertEmployeeTenantRows} from "./tenant-guard.ts";

// Only closed outcome codes from attendance_attempts. Never retrieve presence
// evidence, GPS/Wi-Fi metadata, actor identity, internal reason text or tokens.
export type AttendanceAttemptEvidenceRow={
  museum_id:string;employee_id:string;result:unknown;requested_event:unknown;
};
const allowedResults=[
  "accepted","too_early","presence_validation_failed",
  "presence_not_configured","no_assigned_shift","invalid_sequence",
  "inactive_employee","permission_denied","duplicate_event","system_error"
] as const;
const resultSet=new Set<string>(allowedResults);
const eventSet=new Set(["clock_in","lunch_out","lunch_in","clock_out"]);

export function summarizeAttendanceAttemptOutcomes(
  rows:readonly AttendanceAttemptEvidenceRow[],museumId:string,employeeId:string
){
  assertEmployeeTenantRows(rows,museumId,employeeId);
  // Reject possibly truncated evidence. Callers must also fail closed on >=61.
  if(rows.length>60)throw Error("UPSTREAM_FAILURE");
  const counts=new Map<string,number>();
  for(const row of rows){
    if(typeof row.result!=="string" || !resultSet.has(row.result) ||
       typeof row.requested_event!=="string" || !eventSet.has(row.requested_event))
      throw Error("UPSTREAM_FAILURE");
    counts.set(row.result,(counts.get(row.result)||0)+1);
  }
  const accepted=counts.get("accepted")||0;
  const rejected=rows.length-accepted;
  return {
    total_attempts:rows.length,
    accepted_attempts:accepted,
    rejected_attempts:rejected,
    invalid_sequence_attempts:counts.get("invalid_sequence")||0,
    rejected_by_code:allowedResults
      .filter(code=>code!=="accepted"&&(counts.get(code)||0)>0)
      .map(code=>({code,count:counts.get(code)||0})),
    warning:"Los códigos son resultados de intentos registrados, no una explicación causal definitiva. Un intento accepted no prueba por sí solo un evento efectivo, una jornada cerrada ni una nómina correcta."
  };
}
