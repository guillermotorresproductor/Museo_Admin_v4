// No network, secrets, or operational database needed.
import {test} from "node:test";
import assert from "node:assert/strict";
import {requiredPermissionsForMode,assertTenantRows,assertEmployeeTenantRows,assertActiveMuseumProfile}
  from "../supabase/functions/instituva-ai-assistant/tenant-guard.ts";
import {planNaturalQuery} from "../supabase/functions/instituva-ai-assistant/conversational-plan.ts";

const museumA="00000000-0000-0000-0000-000000000001";
const museumB="00000000-0000-0000-0000-000000000002";

test("tenant mismatch fails closed, even for aggregate rows",()=>{
  assert.deepEqual(assertTenantRows([{museum_id:museumA}],museumA),[{museum_id:museumA}]);
  assert.throws(()=>assertTenantRows([{museum_id:museumA},{museum_id:museumB}],museumA),/FORBIDDEN/);
  assert.throws(()=>assertTenantRows([{amount:100}],museumA),/FORBIDDEN/);
  assert.throws(()=>assertEmployeeTenantRows([{museum_id:museumA,employee_id:"other"}],museumA,"selected"),/FORBIDDEN/);
  assert.throws(()=>assertActiveMuseumProfile({id:"alice",museum_id:museumB,status:"activo"},"bob"),/FORBIDDEN/);
  assert.equal(assertActiveMuseumProfile({id:"alice",museum_id:museumA,status:"activo"},"alice"),museumA);
});

test("payroll requires compensation and attendance grants in addition to finance",()=>{
  assert.deepEqual([...requiredPermissionsForMode("payroll")],
    ["attendance.history.read","finance.read","compensation.read"]);
  assert.deepEqual([...requiredPermissionsForMode("assets")],
    ["collections.read","modules.inventory.read"]);
  assert.throws(()=>requiredPermissionsForMode("unrecognized"),/FORBIDDEN/);
});

test("natural payroll question and follow-up retain subject, not untrusted data",()=>{
  const now=new Date("2026-11-27T18:00:00Z");
  const first=planNaturalQuery("¿Por qué la nómina de Roberto es mayor esta semana?",{mode:"auto"},now);
  assert.equal(first.mode,"payroll");
  const follow=planNaturalQuery("¿Y la semana pasada?",{
    mode:"auto",conversation_context:{mode:"payroll",employee_name:"Empleado Ficticio"}
  },now);
  assert.equal(follow.mode,"payroll");
  assert.equal(follow.employeeName,"Empleado Ficticio");
  const forged=planNaturalQuery("¿Y la semana pasada?",{
    mode:"auto",conversation_context:{mode:"payroll",employee_name:"Empleado Ficticio",museum_id:museumB}
  },now);
  assert.notEqual(forged.mode,"payroll");
});
