import {resolveEffectiveAttendanceEvents} from "./attendance-event-corrections.ts";
const museum="11111111-1111-4111-8111-111111111111";
const otherMuseum="22222222-2222-4222-8222-222222222222";
const employee="33333333-3333-4333-8333-333333333333";
const otherEmployee="44444444-4444-4444-8444-444444444444";
const event=(id:string,ref:string|null=null)=>({
 id,museum_id:museum,employee_id:employee,shift_id:"shift-1",
 supersedes_event_id:ref,event_type:"clock_in",occurred_at:"2026-11-25T12:00:00Z"
});
const ok=(value:boolean,label:string)=>{if(!value)throw Error(label)};
const rejects=(fn:()=>unknown,code:string)=>{
 try{fn()}catch(e){return (e as Error).message===code}return false;
};
Deno.test("replacement outside the queried day removes the old punch",()=>{
 const day=[event("original")];
 const replacement=event("next-day-correction","original");
 replacement.occurred_at="2026-11-26T12:00:00Z";
 const res=resolveEffectiveAttendanceEvents(day,[replacement],museum,employee);
 ok(res.supersededCount===1&&res.effectiveEvents.length===0,"stale punch kept");
});
Deno.test("same-day replacement is kept only once as the effective punch",()=>{
 const old=event("original"),corrected=event("corrected","original");
 const res=resolveEffectiveAttendanceEvents([old,corrected],[corrected],museum,employee);
 ok(res.supersededCount===1,"replacement not counted");
 ok(res.effectiveEvents.length===1&&res.effectiveEvents[0].id==="corrected","wrong effective punch");
});
Deno.test("only the first hop is needed to exclude a punch even with later correction",()=>{
 const old=event("original");
 const next=event("corrected","original");
 const latest=event("latest","corrected");
 const res=resolveEffectiveAttendanceEvents([old],[next],museum,employee);
 ok(res.effectiveEvents.length===0&&res.supersededCount===1,"old punch shown");
 const chain=resolveEffectiveAttendanceEvents([old,next],[next,latest],museum,employee);
 ok(chain.effectiveEvents.length===0&&chain.supersededCount===2,"correction chain shown as active");
});
Deno.test("unreplaced punch remains visible without speculative corrections",()=>{
 const old=event("original");
 const res=resolveEffectiveAttendanceEvents([old],[],museum,employee);
 ok(res.effectiveEvents.length===1&&res.supersededCount===0,"valid punch removed");
});
Deno.test("cross-tenant, cross-employee, cross-shift and ambiguous replacements fail closed",()=>{
 const old=event("original"),next=event("next","original");
 ok(rejects(()=>resolveEffectiveAttendanceEvents([old],[{...next,museum_id:otherMuseum}],museum,employee),"FORBIDDEN"),"foreign museum");
 ok(rejects(()=>resolveEffectiveAttendanceEvents([old],[{...next,employee_id:otherEmployee}],museum,employee),"FORBIDDEN"),"foreign employee");
 ok(rejects(()=>resolveEffectiveAttendanceEvents([old],[{...next,shift_id:"other-shift"}],museum,employee),"UPSTREAM_FAILURE"),"foreign shift");
 ok(rejects(()=>resolveEffectiveAttendanceEvents([old],[{...next,supersedes_event_id:"missing"}],museum,employee),"UPSTREAM_FAILURE"),"missing original");
 ok(rejects(()=>resolveEffectiveAttendanceEvents([old],[next,event("parallel","original")],museum,employee),"UPSTREAM_FAILURE"),"parallel corrections");
 ok(rejects(()=>resolveEffectiveAttendanceEvents([old,old],[],museum,employee),"UPSTREAM_FAILURE"),"duplicate original");
 ok(rejects(()=>resolveEffectiveAttendanceEvents([old],[old],museum,employee),"UPSTREAM_FAILURE"),"null replacement link");
});
