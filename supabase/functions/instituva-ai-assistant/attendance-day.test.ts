import {validAttendanceDay,nextAttendanceDay} from "./attendance-day.ts";
const assert=(ok:boolean,label:string)=>{if(!ok)throw Error(label)};
const invalid=(input:unknown)=>{
 try{validAttendanceDay(input)}catch(e){return (e as Error).message==="INVALID_REQUEST"}
 return false;
};
Deno.test("recognizes valid Puerto Rico calendar dates and year boundaries",()=>{
 assert(validAttendanceDay("2026-11-25")==="2026-11-25","valid day");
 assert(validAttendanceDay("2028-02-29")==="2028-02-29","leap day");
 assert(nextAttendanceDay("2026-12-31")==="2027-01-01","new year");
 assert(nextAttendanceDay("2028-02-29")==="2028-03-01","leap rollover");
});
Deno.test("rejects normalized nonexistent days and malformed inputs",()=>{
 for(const bad of ["2026-02-29","2026-02-31","2026-04-31","2026-13-01","2026-00-10","2026-11-00","2026-11-99","2026-1-4",null,42,{},[]]){
  assert(invalid(bad),"accepted invalid day "+String(bad));
 }
});
