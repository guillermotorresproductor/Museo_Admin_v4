import {
  requiredPermissionsForMode,assertActiveMuseumProfile,assertTenantRows,assertEmployeeTenantRows
} from "./tenant-guard.ts";
function check(value:boolean,message:string){if(!value)throw Error(message)}
function rejects(fn:()=>unknown){try{fn()}catch(e){return (e as Error).message==="FORBIDDEN"}return false}
const museumA="11111111-1111-4111-8111-111111111111";
const museumB="22222222-2222-4222-8222-222222222222";
Deno.test("finance never inherits permission to read employee attendance",()=>{
  const finance=requiredPermissionsForMode("finance");
  check(finance.length===1&&finance[0]==="finance.read","finance permission changed");
  check(!finance.includes("attendance.history.read"),"finance read leaked attendance");
});
Deno.test("attendance requires both independent permissions",()=>{
  const permissions=requiredPermissionsForMode("attendance");
  check(permissions.includes("attendance.history.read")&&permissions.includes("finance.read"),"attendance permissions reduced");
});
Deno.test("general runbooks do not grant private-record permissions",()=>{
  check(requiredPermissionsForMode("product").length===0,"public help grants rights");
  check(rejects(()=>requiredPermissionsForMode("admin" as "finance")),"unsupported mode accepted");
});
Deno.test("active museum profile must belong to authenticated user",()=>{
  const profile={id:"u-a",museum_id:museumA,status:"activo"};
  check(assertActiveMuseumProfile(profile,"u-a")===museumA,"correct profile rejected");
  check(rejects(()=>assertActiveMuseumProfile(profile,"u-b")),"cross-account profile accepted");
  check(rejects(()=>assertActiveMuseumProfile({...profile,status:"revoked"},"u-a")),"inactive profile accepted");
  check(rejects(()=>assertActiveMuseumProfile({...profile,museum_id:null},"u-a")),"missing museum accepted");
});
Deno.test("tenant row isolation rejects cross-museum evidence atomically",()=>{
  check(assertTenantRows([{museum_id:museumA,id:"fixture-1"}],museumA).length===1,"own row rejected");
  check(rejects(()=>assertTenantRows([{museum_id:museumA},{museum_id:museumB}],museumA)),"foreign row accepted");
  check(rejects(()=>assertTenantRows([{museum_id:undefined}],museumA)),"unscoped row accepted");
  check(assertTenantRows([],museumA).length===0,"empty authorized result rejected");
});

Deno.test("attendance data from another museum or employee is rejected",()=>{
 const authorizedEmployee="33333333-3333-4333-8333-333333333333";
 const otherEmployee="44444444-4444-4444-8444-444444444444";
 const correct={museum_id:museumA,employee_id:authorizedEmployee,id:"synthetic"};
 check(assertEmployeeTenantRows([correct],museumA,authorizedEmployee).length===1,"own attendance rejected");
 check(rejects(()=>assertEmployeeTenantRows([correct,{...correct,museum_id:museumB}],museumA,authorizedEmployee)),"foreign museum attendance accepted");
 check(rejects(()=>assertEmployeeTenantRows([correct,{...correct,employee_id:otherEmployee}],museumA,authorizedEmployee)),"foreign employee attendance accepted");
 check(rejects(()=>assertEmployeeTenantRows([{...correct,museum_id:undefined}],museumA,authorizedEmployee)),"missing museum accepted");
 check(rejects(()=>assertEmployeeTenantRows([{...correct,employee_id:undefined}],museumA,authorizedEmployee)),"missing employee accepted");
});
