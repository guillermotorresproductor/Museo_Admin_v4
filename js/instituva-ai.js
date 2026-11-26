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
  const sourceDetails=root.querySelector("[data-ai-sources-details]");
  const guide=root.querySelector("[data-ai-guide]");
  const guidePanel=root.querySelector("[data-ai-guide-panel]");
  const guideStart=root.querySelector("[data-ai-guide-start]");
  const guideBack=root.querySelector("[data-ai-guide-back]");
  const guideNext=root.querySelector("[data-ai-guide-next]");
  const guideProgress=root.querySelector("[data-ai-guide-progress]");
  const guideStep=root.querySelector("[data-ai-guide-step]");
  let guideSteps=[];
  let guideIndex=-1;

  const resetGuide=()=>{
    guideSteps=[];
    guideIndex=-1;
    guide.hidden=true;
    guidePanel.hidden=true;
    guideStart.hidden=false;
    guideStart.textContent="Comenzar guía";
    guideStep.textContent="";
    guideProgress.textContent="";
  };
  const showGuideStep=()=>{
    const current=guideSteps[guideIndex];
    if (!current) return;
    guidePanel.hidden=false;
    guideStart.hidden=true;
    guideProgress.textContent=`Paso ${guideIndex+1} de ${guideSteps.length} — ${current.phase==="verificar"?"Comprobación":"Acción manual propuesta"}`;
    guideStep.textContent=current.text;
    guideBack.disabled=guideIndex===0;
    guideNext.textContent=guideIndex===guideSteps.length-1?"Finalizar recorrido":"Siguiente paso";
  };
  guideStart.addEventListener("click",()=>{
    if (!guideSteps.length) return;
    guideIndex=0;
    showGuideStep();
  });
  guideBack.addEventListener("click",()=>{
    if (guideIndex<=0) return;
    guideIndex--;
    showGuideStep();
  });
  guideNext.addEventListener("click",()=>{
    if(guideIndex<0 || !guideSteps.length) return;
    if(guideIndex===guideSteps.length-1){
      guidePanel.hidden=true;
      guideStart.hidden=false;
      guideStart.textContent="Revisar los pasos otra vez";
      guideIndex=-1;
      return;
    }
    guideIndex++;
    showGuideStep();
  });
  resetGuide();
  let busy=false;
  const canDiagnose=hasPermission("attendance.history.read") && hasPermission("finance.read");
  const canReadFinance=hasPermission("finance.read");
  const canReadCollections=hasPermission("collections.read");
  const canReadInventory=hasPermission("modules.inventory.read");
  const canReadAssets=canReadCollections && canReadInventory;
  const canReadSchedules=hasPermission("time.read.all");
  const canReadNotifications=hasPermission("notifications.read.self");

  const updateMode=(clearStatus=false)=>{
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
    const assets=mode.value==="assets";
    const notifications=mode.value==="notifications";
    if ((attendance && !canDiagnose) || (finance && !canReadFinance) || (collections && !canReadCollections) || (inventory && !canReadInventory) || (assets && !canReadAssets) || (schedules && !canReadSchedules) || (notifications && !canReadNotifications)) {
      status.textContent="Tu perfil no tiene permiso para este tipo de consulta.";
      form.querySelector('button[type="submit"]').disabled=true;
    } else {
      if (clearStatus && !busy) status.textContent="";
      form.querySelector('button[type="submit"]').disabled=busy;
    }
  };
  mode.addEventListener("change",()=>{
    result.hidden=true;
    resetGuide();
    updateMode(true);
  });
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
    if (queryMode==="assets" && !canReadAssets) return;
    if (queryMode==="schedules" && (!canReadSchedules || !/^20\d{2}-\d{2}-\d{2}$/.test(start_day))) return;
    if (queryMode==="notifications" && !canReadNotifications) return;
    busy=true;
    const button=form.querySelector('button[type="submit"]');
    button.disabled=true;
    result.hidden=true;
    resetGuide();
    answer.textContent="";
    evidence.textContent="";
    sources.replaceChildren();
    sourceDetails.hidden=true;
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
          body.diagnostic_contract!=="read_only_v1" || typeof body.answer!=="string" ||
          body.mode!==queryMode || !Array.isArray(body.sources))
        throw Error("Respuesta del servicio no válida.");
      answer.textContent=body.answer;
      if (body.mode==="attendance") {
        const dayOffPunchCoincidence=body.evidence?.schedule_day_off_with_punches===true;
        evidence.textContent=`Fuente: asistencia de ${String(body.evidence?.employee||"").slice(0,120)}; fecha ${String(body.evidence?.date||day)}. Ponches: ${Number(body.evidence?.punch_count||0)}. Alertas activas: ${Number(body.evidence?.active_alert_count||0)}; revisadas o resueltas: ${Number(body.evidence?.reviewed_or_resolved_alert_count||0)}. ${dayOffPunchCoincidence?"Observación: día libre registrado y ponches en la misma fecha; cotejar turnos y correcciones manualmente, no prueba incumplimiento. ":""}El conteo no confirma una causa. Solo lectura.`;
      } else if (body.mode==="finance") {
        const otherBudgetCategories=Number(body.evidence?.category_labels_redacted_records||0);
        evidence.textContent=`Presupuesto del año ${Number(body.evidence?.year||fiscalYear)}; celdas consultadas: ${Number(body.evidence?.record_count||0)}. ${otherBudgetCategories>0?`${otherBudgetCategories} registros con categoría no reconocida (importes incluidos en el total). `:""}No equivale a pagos ni cobros conciliados. Solo lectura.`;
      } else if (body.mode==="collections") {
        evidence.textContent=`Colecciones: ${Number(body.evidence?.item_count||0)} piezas; ${Number(body.evidence?.photo_count||0)} fotografías; ${Number(body.evidence?.history_count||0)} movimientos históricos. ${Number(body.evidence?.items_without_photos||0)} piezas sin fotografía registrada; esto no implica necesariamente un error. Solo lectura.`;
      } else if (body.mode==="inventory") {
        evidence.textContent=`Inventario: ${Number(body.evidence?.record_count||0)} registros; ${Number(body.evidence?.missing_photo_records||0)} sin fotografía asociada; ${Number(body.evidence?.archived_records||0)} archivados. Son datos administrativos, no una inspección física. Solo lectura.`;
      } else if (body.mode==="assets") {
        evidence.textContent=`Comparación documental de módulos: ${Number(body.evidence?.collections_visible_count||0)} registros visibles en Colecciones y ${Number(body.evidence?.inventory_visible_count||0)} registros visibles en Inventario. No son equivalentes entre sí ni prueban faltantes, duplicados o existencia física. Solo lectura.`;
      } else if (body.mode==="schedules") {
        evidence.textContent=`Horarios: ${Number(body.evidence?.record_count||0)} turnos entre ${String(body.evidence?.start_date||start_day)} y la fecha final exclusiva ${String(body.evidence?.end_date_exclusive||"")}. Posibles solapamientos: ${Number(body.evidence?.potential_overlap_pairs||0)}. Esto no prueba publicación ni asistencia. Solo lectura.`;
      } else if (body.mode==="notifications") {
        evidence.textContent=`Mis notificaciones (últimos 30 días): ${Number(body.evidence?.notification_count||0)} registradas, ${Number(body.evidence?.unread_count||0)} sin marcar como leídas. No acredita entrega por correo, SMS o push. Solo lectura.`;
      } else {
        evidence.textContent="Conocimiento general de INSTITUVA, sujeto a revisión y actualización. Sin acceso a datos de empleados.";
      }
      // Provenance is rendered as literal text, never as HTML or clickable user-supplied URLs.
      // Keep references intact instead of silently cutting the source list at 1,200 chars.
      sources.replaceChildren();
      const refs=body.sources.slice(0,20);
      for (const reference of refs) {
        const item=document.createElement("li");
        item.textContent=String(reference).slice(0,500);
        sources.appendChild(item);
      }
      sourceDetails.hidden=refs.length===0;
      // Only present a local guided walkthrough if the server supplied
      // explicitly typed, bounded advice. Never turn these strings into HTML.
      guideSteps=Array.isArray(body.guide_steps) && body.guide_steps.length<=10 &&
        body.guide_steps.every(step=>step && typeof step==="object" &&
          (step.phase==="verificar"||step.phase==="accion_manual") &&
          typeof step.text==="string" && step.text.trim().length>0 &&
          step.text.length<=440 && !/[\u0000-\u001f\u007f]/.test(step.text))
        ? body.guide_steps.map(step=>({phase:step.phase,text:step.text.trim()}))
        : [];
      guide.hidden=guideSteps.length===0;
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
