import {assertEmployeeTenantRows} from "./tenant-guard.ts";

// Pure resolution of a bounded, authorized attendance window. A correction
// made outside the selected calendar day can supersede a punch inside it.
// No DB calls or operational mutations; identities remain in server memory.
export type AttendanceEventCandidate={
  id:string;museum_id:string;employee_id:string;shift_id:string;
  supersedes_event_id:string|null;
};
export type AttendanceEventSuperseder={
  id:string;museum_id:string;employee_id:string;shift_id:string;
  supersedes_event_id:string|null;
};
export function resolveEffectiveAttendanceEvents<T extends AttendanceEventCandidate>(
  dayEvents:readonly T[],supersedingEvents:readonly AttendanceEventSuperseder[],
  museumId:string,employeeId:string
):{effectiveEvents:T[];supersededCount:number}{
  assertEmployeeTenantRows(dayEvents,museumId,employeeId);
  assertEmployeeTenantRows(supersedingEvents,museumId,employeeId);
  const byId=new Map<string,T>();
  for(const e of dayEvents){
    if(typeof e.id!=="string"||!e.id||byId.has(e.id)||
       typeof e.shift_id!=="string"||!e.shift_id)
      throw Error("UPSTREAM_FAILURE");
    byId.set(e.id,e);
  }
  const replaced=new Set<string>();
  const correctionIds=new Set<string>();
  for(const e of supersedingEvents){
    if(typeof e.id!=="string"||!e.id||correctionIds.has(e.id)||
       typeof e.supersedes_event_id!=="string"||!e.supersedes_event_id||
       typeof e.shift_id!=="string"||!e.shift_id)
      throw Error("UPSTREAM_FAILURE");
    const original=byId.get(e.supersedes_event_id);
    if(!original||original.shift_id!==e.shift_id||
       original.id===e.id||replaced.has(original.id))
      throw Error("UPSTREAM_FAILURE");
    correctionIds.add(e.id);
    replaced.add(original.id);
  }
  return {
    effectiveEvents:dayEvents.filter(e=>!replaced.has(e.id)),
    supersededCount:replaced.size
  };
}
