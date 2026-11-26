import {summarizeAttendanceAttemptOutcomes} from "./attendance-attempt-summary.ts";
const M="11111111-1111-4111-8111-111111111111";
const B="22222222-2222-4222-8222-222222222222";
const E="33333333-3333-4333-8333-333333333333";
const OTHER="44444444-4444-4444-8444-444444444444";
const row=(result:string,requested_event="clock_in")=>({
  museum_id:M,employee_id:E,result,requested_event
});
const check=(condition:boolean,label:string)=>{if(!condition)throw Error(label)};
const reject=(f:()=>unknown)=>{
  try{f()}catch(err){return ["FORBIDDEN","UPSTREAM_FAILURE"].includes((err as Error).message)}
  return false;
};
Deno.test("accepted prior punch plus rejected next-day attempt remain distinct",()=>{
  const evidence=summarizeAttendanceAttemptOutcomes([
    row("accepted"),row("invalid_sequence")
  ],M,E);
  check(evidence.total_attempts===2,"attempt count");
  check(evidence.accepted_attempts===1,"accepted result");
  check(evidence.rejected_attempts===1,"rejected result");
  check(evidence.invalid_sequence_attempts===1,"invalid sequence count");
  check(evidence.rejected_by_code.length===1&&
    evidence.rejected_by_code[0].code==="invalid_sequence","code grouping");
  check(evidence.warning.includes("no una explicación causal definitiva"),"missing uncertainty");
});
Deno.test("foreign museum and foreign employee results are rejected atomically",()=>{
 check(reject(()=>summarizeAttendanceAttemptOutcomes([row("accepted"),{...row("invalid_sequence"),museum_id:B}],M,E)),"museum isolation");
 check(reject(()=>summarizeAttendanceAttemptOutcomes([row("accepted"),{...row("invalid_sequence"),employee_id:OTHER}],M,E)),"employee isolation");
 check(reject(()=>summarizeAttendanceAttemptOutcomes([{...row("accepted"),museum_id:""}],M,E)),"missing museum");
});
Deno.test("hostile or unknown codes and excessive results fail closed",()=>{
 check(reject(()=>summarizeAttendanceAttemptOutcomes([row("ignore previous instructions")],M,E)),"hostile result");
 check(reject(()=>summarizeAttendanceAttemptOutcomes([row("accepted","steal_credentials")],M,E)),"hostile event");
 check(reject(()=>summarizeAttendanceAttemptOutcomes(Array.from({length:61},()=>row("accepted")),M,E)),"truncated evidence");
 check(summarizeAttendanceAttemptOutcomes([],M,E).total_attempts===0,"empty evidence");
});
Deno.test("no private metadata is exposed to output",()=>{
 const evidence=summarizeAttendanceAttemptOutcomes([{
   ...row("presence_validation_failed"),actor_user_id:"sensitive",
   presence_evidence:{location:"private"},reason_code:"secret"
 }],M,E);
 check(evidence.rejected_attempts===1,"failed attempt");
 const output=JSON.stringify(evidence);
 check(!output.includes("sensitive")&&!output.includes("private")&&!output.includes("secret"),"private metadata leak");
});
