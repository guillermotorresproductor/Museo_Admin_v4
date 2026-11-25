"use strict";
function bindInstituvaAi() {
  const root=document.querySelector("[data-instituva-ai]");
  if (!root) return;
  const form=root.querySelector("[data-ai-form]");
  const mode=form.querySelector('[name="mode"]');
  const privateFields=root.querySelector("[data-ai-private]");
  const financeFields=root.querySelector("[data-ai-finance]");
  const schedulesFields=root.querySelector("[data-ai-schedules]");
  const scheduleStart=form.querySelector('[name="start_day"]');
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
  const canReadFinance=hasPermission("finance.read");
  const canReadCollections=hasPermission("collections.read");
  const canReadInventory=hasPermission("modules.inventory.read");
  const canReadSchedules=hasPermission("time.read.all");
  const canReadNotifications=hasPermission("notifications.read.self");

  const updateMode=()=>{
    const attendance=mode.value==="attendance";
    privateFields.hidden=!attendance;
    const finance=mode.value==="finance";
    financeFields.hidden=!finance;
    const schedules=mode.value==="schedules";
    schedulesFields.hidden=!schedules;
    scheduleStart.required=schedules;
    year.required=finance;
    employee.required=attendance;
    date.required=attendance;
    const collections=mode.value==="collections";
    const inventory=mode.value==="inventory";
    const notifications=mode.value==="notifications";
    if ((attendance && !canDiagnose) || (finance && !canReadFinance) || (collections && !canReadCollections) || (inventory && !canReadInventory) || (schedules && !canReadSchedules) || (notifications && !canReadNotifications)) {
      status.textContent="Tu perfil no tiene permiso para este tipo de consulta.";
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
    const start_day=String(data.get("start_day")||"");
    const fiscalYear=Number(data.get("year"));
    if (!question || (queryMode==="attendance" && (!canDiagnose || !employee_name || !day))) return;
    if (queryMode==="finance" && (!canReadFinance || !Number.isInteger(fiscalYear) || fiscalYear<2020 || fiscalYear>2100)) return;
    if (queryMode==="collections" && !canReadCollections) return;
    if (queryMode==="inventory" && !canReadInventory) return;
    if (queryMode==="schedules" && (!canReadSchedules || !/^20\d{2}-\d{2}-\d{2}$/.test(start_day))) return;
    if (queryMode==="notifications" && !canReadNotifications) return;
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
      if (queryMode==="schedules") request.start_day=start_day;
      const res=await fetch(`${supabaseUrl}/functions/v1/instituva-ai-assistant`,{
        method:"POST",headers,body:JSON.stringify(request),cache:"no-store"
      });
      const body=await res.json().catch(()=>({}));
      if (!res.ok) throw Error(body.error||"El diagnóstico no está disponible.");
      if (body.read_only!==true || body.actions_executed!==false ||
          body.diagnostic_contract!=="read_only_v1" || typeof body.answer!=="string")
        throw Error("Respuesta del servicio no válida.");
      answer.textContent=body.answer;
      if (body.mode==="attendance") {
        evidence.textContent=`Fuente: asistencia de ${String(body.evidence?.employee||"").slice(0,120)}; fecha ${String(body.evidence?.date||day)}. Ponches: ${Number(body.evidence?.punch_count||0)}. Alertas: ${Number(body.evidence?.alert_count||0)}. Solo lectura.`;
      } else if (body.mode==="finance") {
        evidence.textContent=`Presupuesto del año ${Number(body.evidence?.year||fiscalYear)}; celdas consultadas: ${Number(body.evidence?.record_count||0)}. No equivale a pagos ni cobros conciliados. Solo lectura.`;
      } else if (body.mode==="collections") {
        evidence.textContent=`Colecciones: ${Number(body.evidence?.item_count||0)} piezas; ${Number(body.evidence?.photo_count||0)} fotografías; ${Number(body.evidence?.history_count||0)} movimientos históricos. ${Number(body.evidence?.items_without_photos||0)} piezas sin fotografía registrada; esto no implica necesariamente un error. Solo lectura.`;
      } else if (body.mode==="inventory") {
        evidence.textContent=`Inventario: ${Number(body.evidence?.record_count||0)} registros; ${Number(body.evidence?.missing_photo_records||0)} sin fotografía asociada; ${Number(body.evidence?.archived_records||0)} archivados. Son datos administrativos, no una inspección física. Solo lectura.`;
      } else if (body.mode==="schedules") {
        evidence.textContent=`Horarios: ${Number(body.evidence?.record_count||0)} turnos entre ${String(body.evidence?.start_date||start_day)} y la fecha final exclusiva ${String(body.evidence?.end_date_exclusive||"")}. Posibles solapamientos: ${Number(body.evidence?.potential_overlap_pairs||0)}. Esto no prueba publicación ni asistencia. Solo lectura.`;
      } else if (body.mode==="notifications") {
        evidence.textContent=`Mis notificaciones (últimos 30 días): ${Number(body.evidence?.notification_count||0)} registradas, ${Number(body.evidence?.unread_count||0)} sin marcar como leídas. No acredita entrega por correo, SMS o push. Solo lectura.`;
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
