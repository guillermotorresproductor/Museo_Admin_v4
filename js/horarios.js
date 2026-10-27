/* Horarios semanales: vista sobre employee_shifts; sin tablas ni reglas de nómina nuevas. */
(function(){
"use strict";
const root=document.querySelector("[data-horarios-module]");if(!root)return;
const $=s=>root.querySelector(s), status=$("[data-schedule-status]"), body=$("[data-schedule-body]"), head=$("[data-schedule-head]"),editor=$("[data-editor]");
const dateInput=$("[data-week-date]"),area=$("[data-area-filter]");
let employees=[], days=[], weekStart="", editable=false;
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const addDays=(d,n)=>{const a=new Date(d+"T12:00:00");a.setDate(a.getDate()+n);return [a.getFullYear(),String(a.getMonth()+1).padStart(2,"0"),String(a.getDate()).padStart(2,"0")].join("-")};
const monday=d=>{const x=new Date(d+"T12:00:00");const day=(x.getDay()+6)%7;return addDays(d,-day)};
const label=d=>new Date(d+"T12:00:00").toLocaleDateString("es-PR",{weekday:"short",day:"numeric",month:"short"});
const msg=(s,bad=false)=>{status.textContent=s;status.className="form-message"+(bad?" error":"")};
const hour=s=>{if(!s)return"";const x=String(s);const m=x.match(/T(\d\d):(\d\d)/);return m?m[1]+":"+m[2]:x.slice(0,5)};
const minutes=sh=>{if(sh.status==="cancelled")return 0;const a=sh.starts_at||sh.starts_local||sh.startsLocal,b=sh.ends_at||sh.ends_local||sh.endsLocal;if(!a||!b)return 0;
if(/T/.test(a)&&/T/.test(b))return Math.max(0,(new Date(b)-new Date(a))/60000-Number(sh.expected_lunch_minutes||0));
const [h,m]=String(a).slice(0,5).split(":").map(Number),[h2,m2]=String(b).slice(0,5).split(":").map(Number);let t=(h2*60+m2)-(h*60+m);if(t<0)t+=1440;return Math.max(0,t-Number(sh.expected_lunch_minutes||0))};
const display=sh=>{let a=sh.starts_local||sh.starts_at||"",b=sh.ends_local||sh.ends_at||"";return hour(a)+"–"+hour(b)};
function draw(){
const visible=employees.filter(e=>!area.value||((e.department||e.position||"").trim()===area.value));
head.innerHTML="<tr><th>Empleado / posición</th>"+days.map(d=>"<th>"+safe(label(d))+"</th>").join("")+"<th>Total</th></tr>";
body.innerHTML=visible.map(emp=>{const row=emp._week||{},cells=days.map(d=>{const item=row[d],ss=item?.shifts||[],off=item?.day_off;
const line=off?"LIBRE":ss.length?ss.map(display).join(" / "):"—";
return '<td><button class="schedule-cell" type="button" data-id="'+safe(emp.id)+'" data-date="'+d+'" '+(!editable?'disabled':'')+'>'+safe(line)+'</button></td>'}).join("");
const all=days.flatMap(d=>row[d]?.shifts||[]);const total=all.reduce((n,s)=>n+minutes(s),0)/60;
return "<tr><th>"+safe((emp.first_name||"")+" "+(emp.last_name||""))+"<small style='display:block'>"+safe(emp.position||"")+"</small></th>"+cells+"<td class='schedule-total'>"+total.toFixed(1)+" h</td></tr>"}).join("")||'<tr><td colspan="9">No hay empleados en esta selección.</td></tr>';
}
async function load(){
editor.hidden=true;weekStart=monday(dateInput.value||new Date().toLocaleDateString("en-CA"));dateInput.value=weekStart;
days=Array.from({length:7},(_,i)=>addDays(weekStart,i));msg("Consultando turnos...");
try{
const results=await Promise.all(employees.map(e=>listEmployeeShifts(e.id,days[0],days[6]).then(v=>({e,v})).catch(error=>({e,error}))));
let failures=0;for(const {e,v,error} of results){e._week={};if(error){failures++;continue;}for(const d of v?.days||[])e._week[d.shift_date]=d;}
draw();msg(failures?("No se pudieron consultar "+failures+" empleados. No asumir que sus turnos están vacíos."):("Semana "+days[0]+" a "+days[6]+" · "+employees.length+" empleados"),!!failures);
}catch(e){msg("Error consultando horarios: "+(e.message||e),true)}
}
async function start(){
try{
if(typeof hasPermission!=="function"||!hasPermission("schedules.manage")){root.innerHTML="<h2>Acceso restringido</h2><p>No tiene autorización para administrar horarios.</p>";return}
editable=true;employees=(await fetchSupabaseEmployees()).filter(e=>e.status!=="inactive"&&e.status!=="inactivo");
let names=[...new Set(employees.map(e=>(e.department||e.position||"").trim()).filter(Boolean))].sort();area.insertAdjacentHTML("beforeend",names.map(n=>'<option value="'+safe(n)+'">'+safe(n)+"</option>").join(""));
dateInput.value=monday(new Date().toLocaleDateString("en-CA"));await load();
}catch(e){msg("No fue posible abrir Horarios: "+(e.message||e),true)}
}
body.addEventListener("click",ev=>{const b=ev.target.closest("[data-id]");if(!b||!editable)return;const emp=employees.find(e=>e.id===b.dataset.id);if(!emp)return;
const day=emp._week?.[b.dataset.date],sh=day?.shifts?.[0];editor.reset();
editor.elements.employeeId.value=emp.id;editor.elements.shiftDate.value=b.dataset.date;
editor.elements.shiftId.value=sh?.id||"";editor.elements.expectedUpdatedAt.value=sh?.updated_at||"";
editor.elements.startsLocal.value=hour(sh?.starts_local||sh?.starts_at)||"08:00";editor.elements.endsLocal.value=hour(sh?.ends_local||sh?.ends_at)||"17:00";
editor.elements.lunchMinutes.value=sh?.expected_lunch_minutes??60;
$("[data-editor-title]").textContent=(emp.first_name||"")+" "+(emp.last_name||"")+" · "+b.dataset.date;
editor.hidden=false;editor.scrollIntoView({behavior:"smooth",block:"nearest"});
});
editor.addEventListener("submit",async e=>{e.preventDefault();const f=editor.elements;try{
const a=f.startsLocal.value,b=f.endsLocal.value;if(a===b)throw Error("Entrada y salida no pueden coincidir.");
const lunch=Number(f.lunchMinutes.value);let mins=(Number(b.slice(0,2))*60+Number(b.slice(3)))-(Number(a.slice(0,2))*60+Number(a.slice(3)));if(mins<0)mins+=1440;
if(mins-lunch>480)throw Error("Este turno supera 8 horas ordinarias netas. Revise la programación.");
await scheduleEmployeeShift({employeeId:f.employeeId.value,shiftDate:f.shiftDate.value,shiftId:f.shiftId.value||null,expectedUpdatedAt:f.expectedUpdatedAt.value||null,startsLocal:a,endsLocal:b,setLunch:true,lunchMinutes:lunch,reason:f.reason.value||null});
await load();msg("Turno guardado. El cambio ya es visible en el sistema existente.");}catch(err){msg("No se guardó: "+(err.message||err),true)}});
$("[data-day-off]").addEventListener("click",async()=>{const f=editor.elements;const reason=f.reason.value.trim();if(!reason){msg("Debe indicar un motivo para marcar un día libre.",true);return}
try{const emp=employees.find(e=>e.id===f.employeeId.value);const shifts=emp?._week?.[f.shiftDate.value]?.shifts||[];await setEmployeeDayOff(f.employeeId.value,f.shiftDate.value,reason,shifts.map(s=>({id:s.id,updated_at:s.updated_at})));await load();msg("Día libre guardado.");}catch(err){msg("No se guardó: "+(err.message||err),true)}});
$("[data-close-editor]").addEventListener("click",()=>editor.hidden=true);
$("[data-prev-week]").addEventListener("click",()=>{dateInput.value=addDays(weekStart,-7);load()});$("[data-next-week]").addEventListener("click",()=>{dateInput.value=addDays(weekStart,7);load()});
$("[data-refresh]").addEventListener("click",load);dateInput.addEventListener("change",load);area.addEventListener("change",draw);$("[data-print]").addEventListener("click",()=>window.print());
start();
})();