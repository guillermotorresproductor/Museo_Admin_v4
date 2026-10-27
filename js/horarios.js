/* Horarios semanales: vista sobre employee_shifts; sin tablas ni reglas de nómina nuevas. */
(function(){
"use strict";
const root=document.querySelector("[data-horarios-module]");if(!root)return;
const $=s=>root.querySelector(s), status=$("[data-schedule-status]"), body=$("[data-schedule-body]"), head=$("[data-schedule-head]"),editor=$("[data-editor]");
const dateInput=$("[data-week-date]"),area=$("[data-area-filter]");
let employees=[], days=[], weekStart="", editable=false;const drafts=new Map();
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const addDays=(d,n)=>{const a=new Date(d+"T12:00:00");a.setDate(a.getDate()+n);return [a.getFullYear(),String(a.getMonth()+1).padStart(2,"0"),String(a.getDate()).padStart(2,"0")].join("-")};
const monday=d=>{const x=new Date(d+"T12:00:00");const day=(x.getDay()+6)%7;return addDays(d,-day)};
const label=d=>new Date(d+"T12:00:00").toLocaleDateString("es-PR",{weekday:"short",day:"numeric",month:"short"});
const msg=(s,bad=false)=>{status.textContent=s;status.className="form-message"+(bad?" error":"")};
const hour=s=>{if(!s)return"";const x=String(s);if(x.includes("T")&&(/Z$/.test(x)||/[+-][0-9]{2}:?[0-9]{2}$/.test(x))){const d=new Date(x);if(!Number.isNaN(d.getTime()))return new Intl.DateTimeFormat("en-GB",{timeZone:"America/Puerto_Rico",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(d)}const m=x.match(/T(\d\d):(\d\d)/);return m?m[1]+":"+m[2]:x.slice(0,5)};
const minutes=sh=>{if(sh.status==="cancelled")return 0;const a=sh.starts_at||sh.starts_local||sh.local_start,b=sh.ends_at||sh.ends_local||sh.local_end;if(!a||!b)return 0;
if(/T/.test(a)&&/T/.test(b))return Math.max(0,(new Date(b)-new Date(a))/60000-Number(sh.expected_lunch_minutes||0));
const [h,m]=String(a).slice(0,5).split(":").map(Number),[h2,m2]=String(b).slice(0,5).split(":").map(Number);let t=(h2*60+m2)-(h*60+m);if(t<0)t+=1440;return Math.max(0,t-Number(sh.expected_lunch_minutes||0))};
const display=sh=>{let a=sh.local_start||sh.starts_local||sh.starts_at||"",b=sh.local_end||sh.ends_local||sh.ends_at||"";return hour(a)+"–"+hour(b)+(sh.crosses_midnight?" (+1)":"")};
function draw(){
const visible=employees.filter(e=>!area.value||((e.department||e.position||e.departamento||e.posicion||"").trim()===area.value));
head.innerHTML="<tr><th>Empleado / posición</th>"+days.map(d=>"<th>"+safe(label(d))+"</th>").join("")+"<th>Total</th></tr>";
body.innerHTML=visible.map(emp=>{const row=emp._week||{},cells=days.map(d=>{const item=row[d],ss=(item?.shifts||[]).filter(sh=>sh.status==="scheduled"),off=item?.day_off;
const draft=drafts.get(emp.id+"|"+d);const line=emp._failed?"ERROR":draft?(draft.dayOff?"LIBRE (borrador)":draft.start+"–"+draft.end+" (borrador)"):off?"LIBRE":ss.length?ss.map(display).join(" / "):"—";
return '<td><button class="schedule-cell" type="button" data-id="'+safe(emp.id)+'" data-date="'+d+'" '+(!editable?'disabled':'')+'>'+safe(line)+'</button></td>'}).join("");
const total=days.reduce((sum,d)=>{const draft=drafts.get(emp.id+"|"+d);if(draft){if(draft.dayOff)return sum;let t=(Number(draft.end.slice(0,2))*60+Number(draft.end.slice(3)))-(Number(draft.start.slice(0,2))*60+Number(draft.start.slice(3)));if(t<0)t+=1440;return sum+Math.max(0,t-draft.lunch)}return sum+(row[d]?.shifts||[]).filter(sh=>sh.status==="scheduled").reduce((n,sh)=>n+minutes(sh),0)},0)/60;
return "<tr><th>"+safe((emp.first_name||emp.nombre||"")+" "+(emp.last_name||emp.apellidos||""))+"<small style='display:block'>"+safe(emp.position||emp.posicion||"")+"</small></th>"+cells+"<td class='schedule-total'>"+total.toFixed(1)+" h</td></tr>"}).join("")||'<tr><td colspan="9">No hay empleados en esta selección.</td></tr>';
}
async function load(){
editor.hidden=true;weekStart=monday(dateInput.value||new Date(Date.now()-4*3600000).toISOString().slice(0,10));dateInput.value=weekStart;
days=Array.from({length:7},(_,i)=>addDays(weekStart,i));msg("Consultando turnos...");
try{
const results=await Promise.all(employees.map(e=>listEmployeeShifts(e.id,days[0],days[6]).then(v=>({e,v})).catch(error=>({e,error}))));
let failures=0;for(const {e,v,error} of results){e._week={};if(error){failures++;e._failed=true;continue;}e._failed=false;e._self=Boolean(v?.self);for(const d of v?.days||[])e._week[d.shift_date]=d;}
draw();msg(failures?("No se pudieron consultar "+failures+" empleados. No asumir que sus turnos están vacíos."):("Semana "+days[0]+" a "+days[6]+" · "+employees.length+" empleados"),!!failures);
}catch(e){msg("Error consultando horarios: "+(e.message||e),true)}
}
async function start(){
try{
if(typeof hasPermission!=="function"||!hasPermission("schedules.manage")){root.innerHTML="<h2>Acceso restringido</h2><p>No tiene autorización para administrar horarios.</p>";return}
editable=true;employees=(await fetchSupabaseEmployees()).filter(e=>!["inactive","inactivo"].includes(String(e.status||e.estado||"").toLowerCase()));
let names=[...new Set(employees.map(e=>(e.department||e.position||e.departamento||e.posicion||"").trim()).filter(Boolean))].sort();area.insertAdjacentHTML("beforeend",names.map(n=>'<option value="'+safe(n)+'">'+safe(n)+"</option>").join(""));
dateInput.value=monday(new Date(Date.now()-4*3600000).toISOString().slice(0,10));await load();
}catch(e){msg("No fue posible abrir Horarios: "+(e.message||e),true)}
}
body.addEventListener("click",ev=>{const b=ev.target.closest("[data-id]");if(!b||!editable)return;const emp=employees.find(e=>e.id===b.dataset.id);if(!emp)return;if(emp._failed){msg("No se puede editar: falló la consulta del empleado.",true);return}if(emp._self){msg("No puede modificar su propio turno.",true);return}
const day=emp._week?.[b.dataset.date], active=(day?.shifts||[]).filter(sh=>sh.status==="scheduled");if(active.length>1){msg("Hay varios turnos este día. Edítelos desde Recursos Humanos para evitar reemplazar el turno equivocado.",true);return}const sh=active[0],draft=drafts.get(emp.id+"|"+b.dataset.date);editor.reset();
editor.elements.employeeId.value=emp.id;editor.elements.shiftDate.value=b.dataset.date;
editor.elements.shiftId.value=sh?.id||"";editor.elements.expectedUpdatedAt.value=sh?.updated_at||"";
editor.elements.startsLocal.value=draft?.start||hour(sh?.local_start||sh?.starts_local||sh?.starts_at)||"08:00";editor.elements.endsLocal.value=draft?.end||hour(sh?.local_end||sh?.ends_local||sh?.ends_at)||"17:00";
editor.elements.lunchMinutes.value=draft?.lunch??sh?.expected_lunch_minutes??60;
$("[data-editor-title]").textContent=(emp.first_name||emp.nombre||"")+" "+(emp.last_name||emp.apellidos||"")+" · "+b.dataset.date;
editor.hidden=false;editor.scrollIntoView({behavior:"smooth",block:"nearest"});
});
editor.addEventListener("submit",async e=>{e.preventDefault();const f=editor.elements;try{
const a=f.startsLocal.value,b=f.endsLocal.value;if(a===b)throw Error("Entrada y salida no pueden coincidir.");
const lunch=Number(f.lunchMinutes.value);let mins=(Number(b.slice(0,2))*60+Number(b.slice(3)))-(Number(a.slice(0,2))*60+Number(a.slice(3)));if(mins<0)mins+=1440;
if(!Number.isInteger(lunch)||lunch<0||lunch>=mins)throw Error("El almuerzo debe ser menor que la duración del turno.");if(mins-lunch<=0)throw Error("La jornada no puede ser cero.");if(mins-lunch>480)throw Error("Este turno supera 8 horas ordinarias netas. Revise la programación.");
const emp=employees.find(x=>x.id===f.employeeId.value);if(!emp||emp._failed||emp._self)throw Error("No autorizado o datos incompletos.");const existing=emp._week||{},current=(existing[f.shiftDate.value]?.shifts||[]).filter(sh=>sh.status==="scheduled");
const net=mins-lunch;let other=0;
for(const d of days){
  if(d===f.shiftDate.value){other+=current.filter(sh=>sh.id!==f.shiftId.value).reduce((n,sh)=>n+minutes(sh),0);continue}
  const draft=drafts.get(emp.id+"|"+d);
  if(draft){if(!draft.dayOff){let delta=(Number(draft.end.slice(0,2))*60+Number(draft.end.slice(3)))-(Number(draft.start.slice(0,2))*60+Number(draft.start.slice(3)));if(delta<0)delta+=1440;other+=delta-draft.lunch}continue}
  other+=(existing[d]?.shifts||[]).filter(sh=>sh.status==="scheduled").reduce((n,sh)=>n+minutes(sh),0);
}
if(other+net>2400)throw Error("El borrador superaría 40 horas semanales.");
drafts.set(emp.id+"|"+f.shiftDate.value,{employeeId:emp.id,date:f.shiftDate.value,start:a,end:b,lunch,reason:f.reason.value.trim(),dayOff:false});
editor.hidden=true;draw();msg("Cambio guardado solamente en el borrador de esta sesión. Supabase no se modificó.");
}catch(err){msg("No se guardó: "+(err.message||err),true)}});
$("[data-day-off]").addEventListener("click",async()=>{const f=editor.elements;const reason=f.reason.value.trim();if(!reason){msg("Debe indicar un motivo para marcar un día libre.",true);return}
try{const emp=employees.find(e=>e.id===f.employeeId.value);if(!emp||emp._self||emp._failed)throw Error("No autorizado o datos incompletos.");drafts.set(emp.id+"|"+f.shiftDate.value,{employeeId:emp.id,date:f.shiftDate.value,dayOff:true,reason});editor.hidden=true;draw();msg("Día libre guardado solo en el borrador. No se ha publicado.");
}catch(err){msg("No se guardó: "+(err.message||err),true)}});
$("[data-close-editor]").addEventListener("click",()=>editor.hidden=true);
$("[data-export-draft]").addEventListener("click",()=>{const data={format:"instituva-horarios-draft",version:1,createdAt:new Date().toISOString(),items:[...drafts.values()]};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="horarios-borrador.json";link.click();URL.revokeObjectURL(url);msg("Borrador exportado. No ha sido publicado.");});
$("[data-import-draft]").addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>1000000)throw Error("Archivo demasiado grande");const data=JSON.parse(await file.text());if(data.format!=="instituva-horarios-draft"||data.version!==1||!Array.isArray(data.items))throw Error("Formato inválido");if(data.items.length>500)throw Error("Demasiados turnos");const incoming=new Map();for(const x of data.items){if(!employees.some(e=>e.id===x.employeeId)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(x.date)||typeof x.reason!=="string"||(!x.dayOff&&(!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(x.start)||!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(x.end)||!Number.isInteger(x.lunch))))throw Error("Datos no válidos");if(!x.dayOff){let duration=(Number(x.end.slice(0,2))*60+Number(x.end.slice(3)))-(Number(x.start.slice(0,2))*60+Number(x.start.slice(3)));if(duration<0)duration+=1440;if(x.start===x.end||x.lunch<0||x.lunch>=duration||duration-x.lunch>480)throw Error("Turno fuera del límite diario");}incoming.set(x.employeeId+"|"+x.date,x)}const totalByEmployeeWeek=new Map();for(const x of incoming.values()){if(x.dayOff)continue;let t=(Number(x.end.slice(0,2))*60+Number(x.end.slice(3)))-(Number(x.start.slice(0,2))*60+Number(x.start.slice(3)));if(t<0)t+=1440;const key=x.employeeId+"|"+monday(x.date);totalByEmployeeWeek.set(key,(totalByEmployeeWeek.get(key)||0)+t-x.lunch);}if([...totalByEmployeeWeek.values()].some(v=>v>2400))throw Error("El borrador contiene más de 40 horas semanales");drafts.clear();for(const [k,v] of incoming)drafts.set(k,v);draw();msg("Borrador importado; no se han modificado registros.");}catch(err){msg("Error al importar: "+err.message,true)}e.target.value="";});
$("[data-clear-draft]").addEventListener("click",()=>{if(!drafts.size||window.confirm("¿Descartar el borrador sin publicar?")){drafts.clear();draw();msg("Borrador descartado.")}});
$("[data-prev-week]").addEventListener("click",()=>{dateInput.value=addDays(weekStart,-7);load()});$("[data-next-week]").addEventListener("click",()=>{dateInput.value=addDays(weekStart,7);load()});
$("[data-refresh]").addEventListener("click",load);dateInput.addEventListener("change",load);area.addEventListener("change",draw);$("[data-print]").addEventListener("click",()=>window.print());
if(document.body.classList.contains("app-ready")) start();
else {
  const observer=new MutationObserver(()=>{
    if(!document.body.classList.contains("app-ready"))return;
    observer.disconnect();start();
  });
  observer.observe(document.body,{attributes:true,attributeFilter:["class"]});
}
})();