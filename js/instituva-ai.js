"use strict";
function bindInstituvaAi() {
  const root=document.querySelector("[data-instituva-ai]");
  if (!root) return;
  const form=root.querySelector("[data-ai-form]");
  const status=root.querySelector("[data-ai-status]");
  const result=root.querySelector("[data-ai-result]");
  const answer=root.querySelector("[data-ai-answer]");
  const evidence=root.querySelector("[data-ai-evidence]");
  if (!hasPermission("attendance.history.read") || !hasPermission("finance.read")) {
    root.textContent="Tu cuenta no tiene autorización para consultar datos de Asistencia y Nómina.";
    return;
  }
  let busy=false;
  form.addEventListener("submit",async(event)=>{
    event.preventDefault();
    if (busy) return;
    const data=new FormData(form);
    const question=String(data.get("question")||"").trim();
    const employee_name=String(data.get("employee_name")||"").trim();
    const day=String(data.get("day")||"");
    if (!question || !employee_name || !day) return;
    busy=true;
    const button=form.querySelector("button[type=submit]");
    button.disabled=true;
    result.hidden=true;
    status.textContent="Consultando registros autorizados...";
    try {
      const headers=await supabaseAuthHeaders();
      const res=await fetch(`${supabaseUrl}/functions/v1/instituva-ai-assistant`,{
        method:"POST",headers,body:JSON.stringify({question,employee_name,day})
      });
      const body=await res.json().catch(()=>({}));
      if (!res.ok) throw Error(body.error||"El diagnóstico no está disponible.");
      if (body.read_only!==true || typeof body.answer!=="string") throw Error("Respuesta del servicio no válida.");
      answer.textContent=body.answer;
      evidence.textContent=`Fuente: Asistencia y Nómina de ${String(body.evidence?.employee||"").slice(0,120)}, fecha ${String(body.evidence?.date||day)}. Ponches: ${Number(body.evidence?.punch_count||0)}. Alertas: ${Number(body.evidence?.alert_count||0)}. Solo lectura.`;
      result.hidden=false;
      status.textContent="Diagnóstico completado. No se modificó ningún registro.";
    } catch(error){
      status.textContent=error instanceof Error ? error.message : "No se pudo completar la consulta.";
    } finally{
      busy=false;
      button.disabled=false;
    }
  });
}
