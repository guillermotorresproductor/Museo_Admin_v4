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


test("different shift fragments in a day never become verified hours",()=>{
 const m="00000000-0000-4000-8000-000000000001",e="00000000-0000-4000-8000-000000000002";
 const kinds=["clock_in","lunch_out","lunch_in","clock_out"];
 const times=["12:00","16:00","17:00","21:00"];
 const events=kinds.map((event_type,i)=>({
  id:String(i),museum_id:m,employee_id:e,shift_id:i>=2?"shift-two":"shift-one",
  event_type,occurred_at:"2026-11-24T"+times[i]+":00Z",supersedes_event_id:null
 }));
 const sum=summarizeAttendancePeriod(events,[],[],m,e,"2026-11-24","2026-11-25");
 assert.equal(sum.verified_net_minutes,0);
 assert.equal(sum.incomplete_days,1);
});
test("scheduled day without punches is reported as missing evidence, never zero worked",()=>{
 const m="00000000-0000-4000-8000-000000000001",e="00000000-0000-4000-8000-000000000002";
 const shifts=[{museum_id:m,employee_id:e,shift_date:"2026-11-24",starts_at:"2026-11-24T12:00:00Z",ends_at:"2026-11-24T21:00:00Z",status:"scheduled"}];
 const d=summarizeAttendancePeriod([],[],shifts,m,e,"2026-11-24","2026-11-25");
 assert.equal(d.days_with_punches,0);
 assert.equal(d.scheduled_days_without_punches,1);
 assert.equal(d.verified_net_minutes,0);
 assert.equal(d.verified_days,0);
});
test("superseded attendance punch is not double-counted",()=>{
 const m="00000000-0000-4000-8000-000000000001",e="00000000-0000-4000-8000-000000000002";
 const events=[
  {id:"in",event_type:"clock_in",occurred_at:"2026-11-24T12:00:00Z",supersedes_event_id:null},
  {id:"lunch-old",event_type:"lunch_out",occurred_at:"2026-11-24T15:00:00Z",supersedes_event_id:null},
  {id:"lunch-new",event_type:"lunch_out",occurred_at:"2026-11-24T16:00:00Z",supersedes_event_id:"lunch-old"},
  {id:"back",event_type:"lunch_in",occurred_at:"2026-11-24T17:00:00Z",supersedes_event_id:null},
  {id:"out",event_type:"clock_out",occurred_at:"2026-11-24T21:00:00Z",supersedes_event_id:null}
 ].map(x=>({...x,museum_id:m,employee_id:e,shift_id:"shift-one"}));
 const d=summarizeAttendancePeriod(events,[events[2]],[],m,e,"2026-11-24","2026-11-25");
 assert.equal(d.verified_net_minutes,480);
 assert.equal(d.superseded_punch_count,1);
 assert.equal(d.incomplete_days,0);
});
test("a correction from another museum or employee fails closed",()=>{
 const m="00000000-0000-4000-8000-000000000001",e="00000000-0000-4000-8000-000000000002";
 const unrelated={id:"attack",museum_id:m,employee_id:"00000000-0000-4000-8000-000000000003",
  shift_id:"sh",supersedes_event_id:"a",event_type:"clock_in",occurred_at:"2026-11-24T12:00:00Z"};
 assert.throws(()=>summarizeAttendancePeriod([], [unrelated], [],m,e,"2026-11-24","2026-11-25"),/FORBIDDEN/);
});


test("ambiguous employee names require selection and never return foreign-museum options",async()=>{
 const {resolveScopedEmployeeName}=await import("../supabase/functions/instituva-ai-assistant/employee-name-resolution.ts");
 const m="00000000-0000-4000-8000-000000000001";
 const e1={id:"00000000-0000-4000-8000-000000000002",museum_id:m,first_name:"Roberto",last_name:"Díaz"};
 const e2={id:"00000000-0000-4000-8000-000000000003",museum_id:m,first_name:"Roberto",last_name:"Pérez"};
 const ambiguous=resolveScopedEmployeeName([e1,e2],m,"Roberto");
 assert.equal(ambiguous.kind,"ambiguous");
 assert.equal(ambiguous.options.length,2);
 const chosen=resolveScopedEmployeeName([e1,e2],m,"Roberto",e1.id);
 assert.equal(chosen.kind,"selected");
 assert.equal(chosen.employee.id,e1.id);
 const foreign={...e1,museum_id:"00000000-0000-4000-8000-000000000004"};
 assert.throws(()=>resolveScopedEmployeeName([e1,foreign],m,"Roberto"),/FORBIDDEN/);
 assert.equal(resolveScopedEmployeeName([e1],m,"Luis").kind,"not_found");
});
test("a later explicit employee replaces prior conversational employee only by authorized matching",()=>{
 const p=planNaturalQuery("¿Cuántas horas trabajó María en noviembre?",{
  mode:"auto",conversation_context:{mode:"attendance",employee_name:"Roberto Díaz",
  start_day:"2026-11-01",end_day:"2026-11-27"}
 },now);
 assert.equal(p.mode,"attendance");
 assert.equal(p.employeeName,"María");
 assert.deepEqual(p.range,{start:"2026-11-01",endExclusive:"2026-11-27"});
});


test("follow-up answers requested arrival evidence instead of repeating hours",()=>{
 const c={mode:"attendance",employee_name:"Roberto Díaz",start_day:"2026-11-01",end_day:"2026-11-27"};
 const p=planNaturalQuery("¿Y cuántos días llegó tarde?",{mode:"auto",conversation_context:c},now);
 assert.equal(p.mode,"attendance");
 assert.equal(p.attendanceIntent,"arrival");
 assert.equal(p.employeeName,"Roberto Díaz");
 assert.deepEqual(p.range,{start:"2026-11-01",endExclusive:"2026-11-27"});
});
test("investigate irregularities as a scoped follow-up without inventing new date or employee",()=>{
 const c={mode:"attendance",employee_name:"Roberto Díaz",start_day:"2026-11-01",end_day:"2026-11-27"};
 const p=planNaturalQuery("¿Encontraste alguna irregularidad?",{mode:"auto",conversation_context:c},now);
 assert.equal(p.mode,"attendance");
 assert.equal(p.attendanceIntent,"incidents");
 assert.equal(p.employeeName,"Roberto Díaz");
 assert.deepEqual(p.range,{start:"2026-11-01",endExclusive:"2026-11-27"});
});
test("generic wage question never enters private attendance computation",()=>{
 const p=planNaturalQuery("¿Cuánto representa eso en nómina?",{mode:"auto",conversation_context:{mode:"attendance",employee_name:"Roberto Díaz",start_day:"2026-11-01",end_day:"2026-11-27"}},now);
 assert.equal(p.mode,"product");
});


test("suspected absences are never misrepresented as confirmed employee nonattendance",()=>{
 const c={mode:"attendance",employee_name:"Roberto Díaz",start_day:"2026-11-01",end_day:"2026-11-27"};
 const p=planNaturalQuery("¿Cuántos días faltó Roberto en noviembre?",{mode:"auto",conversation_context:c},now);
 assert.equal(p.mode,"attendance");
 assert.equal(p.attendanceIntent,"absence");
 assert.equal(p.employeeName,"Roberto");
 assert.deepEqual(p.range,{start:"2026-11-01",endExclusive:"2026-11-27"});
});
test("overtime question does not claim payroll compensation or extrapolate from punches",()=>{
 const c={mode:"attendance",employee_name:"Roberto Díaz",start_day:"2026-11-01",end_day:"2026-11-27"};
 const p=planNaturalQuery("¿Cuántas horas extras trabajó?",{mode:"auto",conversation_context:c},now);
 assert.equal(p.mode,"attendance");
 assert.equal(p.attendanceIntent,"overtime");
 assert.equal(p.employeeName,"Roberto Díaz");
});
