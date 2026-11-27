// Pure synthetic fixtures matching public.payroll_actual output; no network or database.
// Run with Node 22+: node --experimental-strip-types --test tests/instituva-ai-payroll-contract.test.mjs
import {test} from "node:test";
import assert from "node:assert/strict";
import {compareAuthorizedPayroll} from "../supabase/functions/instituva-ai-assistant/payroll-comparison.ts";

const windows={current:{from:"2026-11-23",to:"2026-11-27"},
  previous:{from:"2026-11-16",to:"2026-11-22"},partial:true};
const row=(id,from,amount,minutes)=>({
  employee_id:id,name:"Empleado Ficticio",compensation_type:"hourly",
  actual_amount:amount,worked_minutes:minutes,payable_minutes:minutes,
  over_limit_minutes:0,state:"CALCULADA",
  days:[{shift_date:from,state:"COMPLETA",worked_minutes:minutes,
    payable_minutes:minutes,over_limit_minutes:0,amount}]
});
test("compares only selected employee using real RPC fields",()=>{
  const current={employees:[row("demo-1","2026-11-23",120,480),
    row("other-tenant","2026-11-23",999999,480)]};
  const previous={employees:[row("demo-1","2026-11-16",100,420)]};
  const result=compareAuthorizedPayroll(current,previous,"demo-1","Empleado Ficticio",windows);
  assert.equal(result.evidence.comparison_available,true);
  assert.equal(result.evidence.difference,20);
  assert.equal(result.evidence.current_payable_minutes,480);
  assert.equal(result.evidence.previous_over_limit_minutes,0);
  assert.ok(!result.answer.includes("999999"));
  assert.ok(!result.answer.includes("aprobados"));
  assert.ok(result.answer.includes("no confirma aprobaciones"));
});
test("missing official fields fails closed",()=>{
  const broken=row("demo-1","2026-11-23",120,480);
  delete broken.over_limit_minutes;
  assert.throws(()=>compareAuthorizedPayroll({employees:[broken]},
    {employees:[row("demo-1","2026-11-16",100,420)]},
    "demo-1","Empleado Ficticio",windows),/UPSTREAM_FAILURE/);
});
test("other employee cannot be substituted by name",()=>{
  const result=compareAuthorizedPayroll(
    {employees:[row("other","2026-11-23",1000,480)]},
    {employees:[row("other","2026-11-16",900,480)]},
    "demo-1","Empleado Ficticio",windows);
  assert.equal(result.evidence.comparison_available,false);
  assert.ok(!result.answer.includes("1000"));
});
