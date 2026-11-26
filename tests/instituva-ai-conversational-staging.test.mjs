import {test} from "node:test";
import assert from "node:assert/strict";
import {planNaturalQuery} from "../supabase/functions/instituva-ai-assistant/conversational-plan.ts";
import {summarizeAttendancePeriod} from "../supabase/functions/instituva-ai-assistant/attendance-range-summary.ts";
const now=new Date("2026-11-26T20:00:00Z");
test("free language resolves employee and current month up to today",()=>{
 const p=planNaturalQuery("¿Cuántas horas trabajó Roberto en noviembre?",{mode:"auto"},now);
 assert.equal(p.mode,"attendance");
 assert.equal(p.employeeName,"Roberto");
 assert.deepEqual(p.range,{start:"2026-11-01",endExclusive:"2026-11-27"});
});
test("follow-up keeps authorized employee and period without repeating selectors",()=>{
 const c={mode:"attendance",employee_name:"Roberto Díaz",start_day:"2026-11-01",end_day:"2026-11-27"};
 const p=planNaturalQuery("¿Y cuántos días llegó tarde?",{mode:"auto",conversation_context:c},now);
 assert.equal(p.mode,"attendance");
 assert.equal(p.employeeName,"Roberto Díaz");
 assert.deepEqual(p.range,{start:"2026-11-01",endExclusive:"2026-11-27"});
});
test("explicit numbered period and short month are understood and capped at current day",()=>{
 const p=planNaturalQuery("Horas trabajadas de Roberto del 1 al 28 de nov de 2026",{mode:"auto"},now);
 assert.equal(p.mode,"attendance");
 assert.equal(p.employeeName,"Roberto");
 assert.equal(p.range.start,"2026-11-01");
 assert.equal(p.range.endExclusive,"2026-11-27");
});
test("unsupported payroll monetary query cannot be mistaken for budget",()=>{
 const p=planNaturalQuery("¿Cuánto representa eso en nómina?",{mode:"auto",conversation_context:{mode:"attendance",employee_name:"Roberto",start_day:"2026-11-01",end_day:"2026-11-27"}},now);
 assert.equal(p.mode,"product");
});
test("invalid future month and cross-museum attendance cannot pass",()=>{
 assert.throws(()=>planNaturalQuery("Horas trabajadas de Roberto en diciembre 2026",{mode:"auto"},now));
 const id="00000000-0000-4000-8000-000000000001",other="00000000-0000-4000-8000-000000000002";
 const e={id:"a",museum_id:other,employee_id:id,shift_id:"sh",supersedes_event_id:null,event_type:"clock_in",occurred_at:"2026-11-24T12:00:00Z"};
 assert.throws(()=>summarizeAttendancePeriod([e],[],[],id,id,"2026-11-24","2026-11-25"),/FORBIDDEN/);
});
test("four valid punches yield exactly eight verified net hours",()=>{
 const museum="00000000-0000-4000-8000-000000000001",employee="00000000-0000-4000-8000-000000000002";
 const kinds=["clock_in","lunch_out","lunch_in","clock_out"],times=["12:00","16:00","17:00","21:00"];
 const events=kinds.map((event_type,i)=>({id:String(i),museum_id:museum,employee_id:employee,shift_id:"sh",event_type,occurred_at:"2026-11-24T"+times[i]+":00Z",supersedes_event_id:null}));
 const shifts=[{museum_id:museum,employee_id:employee,shift_date:"2026-11-24",starts_at:"2026-11-24T12:00:00Z",ends_at:"2026-11-24T21:00:00Z",status:"scheduled"}];
 const data=summarizeAttendancePeriod(events,[],shifts,museum,employee,"2026-11-24","2026-11-25");
 assert.equal(data.verified_net_minutes,480);
 assert.equal(data.verified_days,1);
 assert.equal(data.entries_after_scheduled_start,0);
});
test("missing lunch does not masquerade as confirmed net work",()=>{
 const museum="00000000-0000-4000-8000-000000000001",employee="00000000-0000-4000-8000-000000000002";
 const events=["clock_in","clock_out"].map((event_type,i)=>({id:String(i),museum_id:museum,employee_id:employee,shift_id:"sh",event_type,occurred_at:"2026-11-24T"+(i?"21:00":"12:00")+":00Z",supersedes_event_id:null}));
 const d=summarizeAttendancePeriod(events,[],[],museum,employee,"2026-11-24","2026-11-25");
 assert.equal(d.verified_net_minutes,0);
 assert.equal(d.days_without_confirmed_lunch,1);
});
