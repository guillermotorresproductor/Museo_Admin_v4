// Pure, fail-closed permission and tenant checks. No database or network access.
export type AiDiagnosticMode = "product"|"attendance"|"finance"|"collections"|"inventory";
export const requiredPermissionsForMode=(mode:AiDiagnosticMode):readonly string[]=>{
  if(mode==="product")return [];
  if(mode==="finance")return ["finance.read"];
  if(mode==="collections")return ["collections.read"];
  if(mode==="inventory")return ["modules.inventory.read"];
  if(mode==="attendance")return ["attendance.history.read","finance.read"];
  throw Error("FORBIDDEN");
};
export const assertActiveMuseumProfile=(profile:{
  id?:unknown; museum_id?:unknown; status?:unknown
}|null, userId:string):string=>{
  if(!profile || profile.id!==userId || typeof profile.museum_id!=="string" ||
     !/^[a-f0-9-]{36}$/i.test(profile.museum_id) ||
     !["activo","active"].includes(String(profile.status)))throw Error("FORBIDDEN");
  return profile.museum_id;
};
export const assertTenantRows=<T extends {museum_id?:unknown}>(
  rows:readonly T[],museumId:string
):readonly T[]=>{
  if(rows.some(row=>row.museum_id!==museumId))throw Error("FORBIDDEN");
  return rows;
};

export const assertEmployeeTenantRows=<T extends {museum_id?:unknown;employee_id?:unknown}>(
  rows:readonly T[],museumId:string,employeeId:string
):readonly T[]=>{
  assertTenantRows(rows,museumId);
  if(rows.some(row=>row.employee_id!==employeeId))throw Error("FORBIDDEN");
  return rows;
};
