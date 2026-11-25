"use strict";
function bindInstituvaAi() {
  const root=document.querySelector("[data-instituva-ai]");
  if (!root) return;
  const form=root.querySelector("[data-ai-form]");
  const mode=form.querySelector('[name="mode"]');
  const privateFields=root.querySelector("[data-ai-private]");
  const financeFields=root.querySelector("[data-ai-finance]");
  const year=form.querySelector('[name="year"]');
  const employee=form.querySelector('[name="employee_name"]');
  const date=form.querySelector('[name="day"]');
  const status=root.querySelector("[data-ai-status]");
  const result=root.querySelector("[data-ai-result]");
  const answer=root.querySelector("[data-ai-answer]");
  const evidence=root.querySelector("[data-ai-evidence]");
  const sources=root.querySelector("[data-ai-sources]");
  let busy=false;
  const canDiagnose=hasPermission("attendance.history.read") && hasPermission("finance.read");

  const updateMode=()=>{
    const attendance=mode.value==="attendance";
    privateFields.hidden=!attendance;
    const finance=mode.value==="finance";
    financeFields.hidden=!finance;
    year.required=finance;
    employee.required=attendance;
    date.required=attendance;
    if ((attendance || finance) && !canDiagnose) {
      status.textContent="Tu perfil no autoriza consultar Asistencia y Nómina de empleados.";
      form.querySelector('button[type="submit"]').disabled=true;
    } else {
      if (!busy) status.textContent="";
      form.querySelector('button[type="submit"]').disabled=busy;
    }
  };
  mode.addEventListener("change",updateMode);
  updateMode();

  form.addEventListener("submit",async(event)=>{
    event.preventDefault();
    if (busy) return;
    const data=new FormData(form);
    const queryMode=String(data.get("mode")||"product");
    const question=String(data.get("question")||"").trim();
    const employee_name=String(data.get("employee_name")||"").trim();
    const day=String(data.get("day")||"");
    const fiscalYear=Number(data.get("year"));
    if (!question || (queryMode==="attendance" && (!canDiagnose || !employee_name || !day))) return;
    if (queryMode==="finance" && (!canDiagnose || !Number.isInteger(fiscalYear) || fiscalYear<2020 || fiscalYear>2100)) return;
    busy=true;
    const button=form.querySelector('button[type="submit"]');
    button.disabled=true;
    result.hidden=true;
    status.textContent="Consultando las fuentes autorizadas...";
    try {
      const headers=await supabaseAuthHeaders();
      const request={mode:queryMode,question};
      if (queryMode==="attendance") {
        request.employee_name=employee_name;
        request.day=day;
      }
      if (queryMode==="finance") request.year=fiscalYear;
      const res=await fetch(`${supabaseUrl}/functions/v1/instituva-ai-assistant`,{
        method:"POST",headers,body:JSON.stringify(request),cache:"no-store"
      });
      const body=await res.json().catch(()=>({}));
      if (!res.ok) throw Error(body.error||"El diagnóstico no está disponible.");
      if (body.read_only!==true || typeof body.answer!=="string") throw Error("Respuesta del servicio no válida.");
      answer.textContent=body.answer;
      if (body.mode==="attendance") {
        evidence.textContent=`Fuente: asistencia de ${String(body.evidence?.employee||"").slice(0,120)}; fecha ${String(body.evidence?.date||day)}. Ponches: ${Number(body.evidence?.punch_count||0)}. Alertas: ${Number(body.evidence?.alert_count||0)}. Solo lectura.`;
      } else if (body.mode==="finance") {
        evidence.textContent=`Presupuesto del año ${Number(body.evidence?.year||fiscalYear)}; celdas consultadas: ${Number(body.evidence?.record_count||0)}. No equivale a pagos ni cobros conciliados. Solo lectura.`;
      } else {
        evidence.textContent="Conocimiento general de INSTITUVA, sujeto a revisión y actualización. Sin acceso a datos de empleados.";
      }
      sources.textContent="Fuentes consultadas: "+(Array.isArray(body.sources)?body.sources.join("; ").slice(0,1200):"No disponibles");
      result.hidden=false;
      status.textContent="Consulta completada. Ningún registro operacional ha sido modificado.";
    } catch(error){
      status.textContent=error instanceof Error ? error.message : "No se pudo completar la consulta.";
    } finally{
      busy=false;
      button.disabled=false;
      updateMode();
    }
  });
}
