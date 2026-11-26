import {
  inferEmployeeName,attendanceDayFromQuestion,resolveScopedEmployeeName
} from "./employee-name-resolution.ts";
const museumA="11111111-1111-4111-8111-111111111111";
const museumB="22222222-2222-4222-8222-222222222222";
const juanA="fa710000-2026-4000-8000-000000000201";
const juanB="fa710000-2026-4000-8000-000000000202";
const rows=[
 {id:juanA,museum_id:museumA,first_name:"Juan",last_name:"Vélez"},
 {id:juanB,museum_id:museumA,first_name:"Juan",last_name:"Torres"}
];
const ok=(flag:boolean,message:string)=>{if(!flag)throw Error(message)};
const forbidden=(fn:()=>unknown)=>{
  try{fn()}catch(e){return (e as Error).message==="FORBIDDEN"}return false;
};
Deno.test("infer surname and first name from conversational punch question",()=>{
 ok(inferEmployeeName("¿Qué pasó con el ponche de ayer de Juan?")==="Juan","Juan missing");
 ok(inferEmployeeName("Qué pasó con el ponche de Juan Vélez ayer?")==="Juan Vélez","surname missing");
 ok(inferEmployeeName("Revisar jornada de hoy de juan torres")==="juan torres","lowercase case");
 ok(inferEmployeeName("¿Qué pasó con el ponche de ayer?")===null,"date mistaken for name");
 ok(inferEmployeeName("Una jornada abierta impide ponchar")===null,"invented person");
});
Deno.test("local relative dates honor America/Puerto_Rico day boundaries",()=>{
 const now=new Date("2026-11-26T02:00:00.000Z"); // Nov 25, 10 PM in Puerto Rico
 ok(attendanceDayFromQuestion("","el ponche de ayer de Juan",now)==="2026-11-24","yesterday local");
 ok(attendanceDayFromQuestion("","el ponche de hoy de Juan",now)==="2026-11-25","today local");
 ok(attendanceDayFromQuestion("2026-11-23","ayer de Juan",now)==="2026-11-23","explicit date");
 ok(attendanceDayFromQuestion("","el ponche de Juan",now)===null,"date invented");
 ok(attendanceDayFromQuestion("","ayer u hoy",now)===null,"ambiguous relative date");
});
Deno.test("Juan must be disambiguated only among authenticated museum candidates",()=>{
 const r=resolveScopedEmployeeName(rows,museumA,"Juan");
 ok(r.kind==="ambiguous","no disambiguation");
 if(r.kind!=="ambiguous")return;
 ok(r.options.length===2,"wrong choice count");
 ok(r.options.some(x=>x.name==="Juan Vélez") &&
   r.options.some(x=>x.name==="Juan Torres"),"wrong labels");
 ok(r.options.every(x=>!x.name.includes("Museo")),"museum identity exposed");
 const chosen=resolveScopedEmployeeName(rows,museumA,"Juan",juanB);
 ok(chosen.kind==="selected"&&chosen.employee.id===juanB,"user-selected employee mismatch");
});
Deno.test("Juan full name selects only exact name; unknown names never guess",()=>{
 const r=resolveScopedEmployeeName(rows,museumA,"juan velez");
 ok(r.kind==="selected"&&r.employee.id===juanA,"diacritics should match");
 ok(resolveScopedEmployeeName(rows,museumA,"Pedro").kind==="not_found","invented employee");
 ok(forbidden(()=>resolveScopedEmployeeName(
  [...rows,{id:"fa710000-2026-4000-8000-000000000203",
   museum_id:museumB,first_name:"Juan",last_name:"Ajeno"}],museumA,"Juan"
 )),"cross-museum identity leaked");
});
Deno.test("forged selected UUID and matching name from another museum fail closed",()=>{
 ok(forbidden(()=>resolveScopedEmployeeName(rows,museumA,"Juan",
    "fa710000-2026-4000-8000-000000000299")),"forged id accepted");
 ok(forbidden(()=>resolveScopedEmployeeName(rows,museumA,"Juan",
    "fa710000-2026-4000-8000-000000000299")),"forged id accepted twice");
});
Deno.test("duplicate full names never silently choose an employee",()=>{
 const copies=[{...rows[0]}, {...rows[1],last_name:"Vélez"}];
 ok(resolveScopedEmployeeName(copies,museumA,"Juan").kind==="need_more_name",
 "identical full names incorrectly disambiguated");
 ok(resolveScopedEmployeeName(copies,museumA,"Juan Vélez").kind==="need_more_name",
 "identical names wrongly selected");
});
