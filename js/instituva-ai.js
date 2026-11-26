"use strict";
function bindInstituvaAi() {
  const root=document.querySelector("[data-instituva-ai]");
  if (!root) return;
  const params=new URLSearchParams(window.location.search);
  const standalonePopup=params.get("popup")==="1" && window.parent===window;
  if(standalonePopup)document.body.classList.add("ai-popout-window");
  const embedded=params.get("dock")==="1" && window.parent!==window;
  if(embedded){
    document.body.classList.add("ai-embedded-frame");
    const notifyActivity=()=>{
      // Parent validates same-origin sender and frame identity before resetting
      // its normal inactivity timer; no text, token or record data crosses.
      window.parent.postMessage({type:"instituva-ai-dock-interaction"},window.location.origin);
    };
    document.addEventListener("pointerdown",notifyActivity,{passive:true});
    document.addEventListener("keydown",notifyActivity,{passive:true});
  }
  const moduleNames=Object.freeze({
    general:"Panel principal",administracion:"Administración",
    "recursos-humanos":"Recursos Humanos",asistencia:"Asistencia",
    finanzas:"Finanzas",inventario:"Inventario",colecciones:"Colecciones",
    horarios:"Horarios",notificaciones:"Notificaciones",direccion:"Dirección Ejecutiva"
  });
  const context=params.get("context");
  const contextElement=root.querySelector("[data-ai-context]");
  if(contextElement && Object.prototype.hasOwnProperty.call(moduleNames,context)){
    contextElement.textContent="Módulo abierto: "+moduleNames[context]+
      ". El contexto indica solo la sección actual; no consulta registros automáticamente.";
    contextElement.hidden=false;
  }
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
  const formattedAnswer=root.querySelector("[data-ai-answer-formatted]");
  const evidence=root.querySelector("[data-ai-evidence]");
  const sources=root.querySelector("[data-ai-sources]");
  const sourceDetails=root.querySelector("[data-ai-sources-details]");
  const choices=root.querySelector("[data-ai-employee-choices]");
  const choicesQuestion=root.querySelector("[data-ai-choices-question]");
  const choicesList=root.querySelector("[data-ai-choices-list]");
  const history=root.querySelector("[data-ai-history]");
  const thread=root.querySelector("[data-ai-thread]");
  const welcome=root.querySelector("[data-ai-welcome]");
  const questionInput=form.querySelector('[name="question"]');
  const newChat=root.querySelector("[data-ai-new-chat]");
  // Conversation state is display-only, kept solely in this page's DOM.
  // Do not persist it or include previous turns in API requests.
  const scrollChat=()=>{thread.scrollTop=thread.scrollHeight;};
  const appendMessage=(role,message)=>{
    const article=document.createElement("article");
    article.className="ai-chat-message ai-chat-message--"+(role==="user"?"user":"assistant");
    const heading=document.createElement("p");
    heading.className="ai-chat-speaker";
    heading.textContent=role==="user"?"Tú":"INSTITUVA AI";
    const text=document.createElement("p");
    text.className="ai-chat-body";
    text.textContent=String(message).slice(0,14000);
    article.appendChild(heading);
    article.appendChild(text);
    history.appendChild(article);
    scrollChat();
    saveConversation();
  };
  // Format only the closed server-produced diagnosis structure. If it changes,
  // fall back to the original text without guessing sections or interpreting HTML.
  const renderFormattedAnswer=(raw)=>{
    formattedAnswer.replaceChildren();
    formattedAnswer.hidden=true;
    answer.hidden=false;
    const headings=[
      "Análisis inicial",
      "Hipótesis (no confirmadas)",
      "Verificaciones pendientes",
      "Acciones manuales propuestas (NO ejecutadas)",
      "Limitaciones de la evidencia"
    ];
    const chunks=String(raw).split("\n\n");
    if(chunks.length!==6 ||
      !chunks[0].startsWith("INSTITUVA — DIAGNÓSTICO PRELIMINAR\n") ||
      !headings.every((heading,index)=>chunks[index+1].startsWith(heading+"\n")))
      return;
    const intro=document.createElement("p");
    intro.className="ai-diagnostic-intro";
    intro.textContent=chunks[0].split("\n").slice(1).join(" ").trim();
    formattedAnswer.appendChild(intro);
    for(let index=0;index<headings.length;index++){
      const section=document.createElement("section");
      section.className="ai-diagnostic-section";
      const title=document.createElement("h4");
      title.textContent=headings[index];
      section.appendChild(title);
      const lines=chunks[index+1].slice(headings[index].length+1).split("\n");
      if(index>0 && lines.every(line=>/^\d+\.\s+\S/.test(line))){
        const list=document.createElement("ol");
        for(const line of lines){
          const item=document.createElement("li");
          item.textContent=line.replace(/^\d+\.\s+/,"");
          list.appendChild(item);
        }
        section.appendChild(list);
      } else {
        const paragraph=document.createElement("p");
        paragraph.textContent=lines.join("\n");
        section.appendChild(paragraph);
      }
      formattedAnswer.appendChild(section);
    }
    answer.hidden=true;
    formattedAnswer.hidden=false;
  };
  const archiveResult=()=>{
    if(result.hidden)return;
    const lines=[answer.textContent,evidence.textContent];
    const refs=Array.from(sources.children||[]).map(item=>item.textContent);
    if(refs.length)lines.push("Fuentes consultadas:\n"+refs.join("\n"));
    appendMessage("assistant",lines.filter(Boolean).join("\n\n"));
    result.hidden=true;
    saveConversation();
  };
  let selectedEmployeeId=null;
  const clearChoices=()=>{
    choices.hidden=true;
    choicesQuestion.textContent="";
    choicesList.replaceChildren();
  };
  const showChoices=(body)=>{
    const options=body.options;
    if(!Array.isArray(options)||options.length<2||options.length>10)return false;
    if(!options.every(item=>item && typeof item.employee_id==="string" &&
       /^[a-f0-9-]{36}$/i.test(item.employee_id) &&
       typeof item.name==="string" && item.name.length>=3 && item.name.length<=120))
      return false;
    if(new Set(options.map(x=>x.employee_id)).size!==options.length)return false;
    choicesList.replaceChildren();
    choicesQuestion.textContent=String(body.question||"¿De cuál empleado se trata?").slice(0,900);
    for(const option of options){
      const select=document.createElement("button");
      select.type="button";
      select.className="button";
      select.textContent=option.name;
      select.addEventListener("click",()=>{
        employee.value=option.name;
        selectedEmployeeId=option.employee_id;
        appendMessage("user",option.name);
        clearChoices();
        form.requestSubmit();
      });
      choicesList.appendChild(select);
    }
    choices.hidden=false;
    scrollChat();
    return true;
  };
  const isPrivateAttendanceQuestion=(question)=>{
    const words=Array.from(question.matchAll(/[\p{L}\p{M}][\p{L}\p{M}.'-]*/gu),m=>m[0]);
    const norm=s=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    // Words describing a generic procedure are never treated as names.
    // Only an explicit probable person ("ponche de Juan") may cause
    // automatic routing to private attendance; the server still checks RLS.
    const stop=new Set(["ayer","hoy","dia","dias","ponche","ponches",
      "asistencia","jornada","jornadas","turno","turnos","entrada",
      "salida","empleado","empleada","empleados","empleadas","museo",
      "instituva","trabajo","laboral","horario","horarios","sistema",
      "modulo","modulos","registro","registros","historial","plataforma",
      "usuario","usuarios","personal","equipo","organizacion","empresa",
      "informe","informes","reporte","reportes","incidencia","problema",
      "pago","nomina","semana","mes","fecha","hora","horas","tiempo",
      "entradas","salidas","cierre","apertura","operacion","trabajadores",
      "mi","mis","tu","tus","su","sus","nuestro","nuestra",
      "la","el","los","las","un","una","que","como","cuando","de","del","para","este"]);
    const attendanceWords=words.some(w=>/^(ponch[a-z]*|asistencia|jornada|marcaciones)$/.test(norm(w)));
    if(!attendanceWords)return false;
    return words.some((w,i)=>["de","del","para"].includes(norm(w)) &&
      words[i+1] && words[i+1].length>=2 && !stop.has(norm(words[i+1])));
  };
  employee.addEventListener("input",()=>{selectedEmployeeId=null;clearChoices();});
  questionInput.addEventListener("input",()=>{selectedEmployeeId=null;clearChoices();});
  questionInput.addEventListener("keydown",event=>{
    if(event.key==="Enter" && !event.shiftKey && !event.isComposing){
      event.preventDefault();
      form.requestSubmit();
    }
  });
  clearChoices();
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
  const resetConversation=()=>{
    history.replaceChildren(welcome);
    result.hidden=true;
    answer.textContent="";
    answer.hidden=false;
    formattedAnswer.replaceChildren();
    formattedAnswer.hidden=true;
    evidence.textContent="";
    sources.replaceChildren();
    sourceDetails.hidden=true;
    resetGuide();
    selectedEmployeeId=null;
    clearChoices();
    employee.value="";
    date.value="";
    scheduleStart.value="";
    year.value="";
    questionInput.value="";
    status.textContent="";
    scrollChat();
    saveConversation();
  };
  newChat.addEventListener("click",()=>{
    if(!busy){
      // The auto-routed private mode must not become the next chat's default.
      mode.value="product";
      resetConversation();
      updateMode(true);
    }
  });
  let busy=false;
  let accessRevoked=false;
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
    // The private question may provide the name and a relative date ("ayer").
    employee.required=false;
    date.required=false;
    const collections=mode.value==="collections";
    const inventory=mode.value==="inventory";
    const assets=mode.value==="assets";
    const notifications=mode.value==="notifications";
    if (accessRevoked || (attendance && !canDiagnose) || (finance && !canReadFinance) || (collections && !canReadCollections) || (inventory && !canReadInventory) || (assets && !canReadAssets) || (schedules && !canReadSchedules) || (notifications && !canReadNotifications)) {
      status.textContent="Tu perfil no tiene permiso para este tipo de consulta.";
      form.querySelector('button[type="submit"]').disabled=true;
    } else {
      if (clearStatus && !busy) status.textContent="";
      form.querySelector('button[type="submit"]').disabled=busy;
    }
  };
  mode.addEventListener("change",()=>{
    // Separate domains have different permissions: never carry a private
    // conversation visually into a new domain.
    resetConversation();
    updateMode(true);
    saveConversation();
  });
  updateMode();

  // An independent window can outlive its originating module. Capture the
  // original user and effective access grants, then recheck the live database
  // before sending or displaying a response, on focus and periodically.
  // This check never queries employee or financial records.
  const mountedUserId=typeof getSupabaseSession==="function"
    ? String(getSupabaseSession()?.user?.id||"") : "";
  const mountedGrants=typeof currentPermissions!=="undefined"
    ? Array.from(currentPermissions).sort().join("\\n") : "";
  // Short-lived, same-tab presentation snapshot. No server-side chat history.
  // Revalidate the same user, museum, and grants before revealing saved text.
  // No access tokens or employee identifiers used for lookups are serialized.
  const continuityKey="instituva-ai-conversation-v1";
  const continuityMaxAgeMs=15*60*1000; // Mirrors the application idle window.
  let continuityReady=false;
  let restoringConversation=false;
  const clearContinuity=()=>{
    try{sessionStorage.removeItem(continuityKey);}catch{}
  };
  const saveConversation=()=>{
    if(!continuityReady || restoringConversation || accessRevoked || !verifiedMuseum)return;
    const messages=Array.from(history.querySelectorAll(".ai-chat-message:not([data-ai-welcome])"))
      .slice(-16).map(item=>({
        role:item.classList.contains("ai-chat-message--user")?"user":"assistant",
        text:String(item.querySelector(".ai-chat-body")?.textContent||"").slice(0,14000)
      }));
    const currentResult=result.hidden?null:{
      answer:String(answer.textContent||"").slice(0,14000),
      evidence:String(evidence.textContent||"").slice(0,1300),
      sources:Array.from(sources.children).slice(0,12)
        .map(item=>String(item.textContent||"").slice(0,500)),
      guide:guideSteps.slice(0,10).map(step=>({phase:step.phase,text:step.text}))
    };
    try{
      const serialized=JSON.stringify({
        version:1,user:mountedUserId,museum:verifiedMuseum,grants:mountedGrants,
        time:Date.now(),mode:String(mode.value),messages,currentResult
      });
      if(serialized.length<70000)sessionStorage.setItem(continuityKey,serialized);
      else clearContinuity();
    }catch{clearContinuity();}
  };
  const restoreConversation=()=>{
    if(continuityReady)return;
    continuityReady=true;
    let stored;
    try{
      const raw=sessionStorage.getItem(continuityKey);
      if(!raw)return;
      if(raw.length>70000)throw Error("BAD_SIZE");
      stored=JSON.parse(raw);
    }catch{clearContinuity();return;}
    if(!stored || stored.version!==1 || stored.user!==mountedUserId ||
      stored.museum!==verifiedMuseum || stored.grants!==mountedGrants ||
      !Number.isFinite(stored.time) ||
      Date.now()-stored.time<0 || Date.now()-stored.time>continuityMaxAgeMs ||
      !Array.isArray(stored.messages) || stored.messages.length>16){
      clearContinuity();return;
    }
    restoringConversation=true;
    try{
      if(Array.from(mode.options).some(option=>option.value===stored.mode)){
        mode.value=stored.mode;
        updateMode(true);
      }
      history.replaceChildren(welcome);
      for(const msg of stored.messages){
        if(!msg || !["user","assistant"].includes(msg.role) ||
          typeof msg.text!=="string" || msg.text.length>14000)
          throw Error("INVALID_MESSAGE");
        appendMessage(msg.role,msg.text);
      }
      if(stored.currentResult){
        const item=stored.currentResult;
        if(typeof item.answer!=="string" || item.answer.length>14000 ||
          typeof item.evidence!=="string" || item.evidence.length>1300 ||
          !Array.isArray(item.sources) || item.sources.length>12 ||
          item.sources.some(s=>typeof s!=="string" || s.length>500))
          throw Error("INVALID_RESULT");
        answer.textContent=item.answer;
        renderFormattedAnswer(item.answer);
        evidence.textContent=item.evidence;
        sources.replaceChildren();
        for(const ref of item.sources){
          const li=document.createElement("li");
          li.textContent=ref;
          sources.appendChild(li);
        }
        sourceDetails.hidden=item.sources.length===0;
        guideSteps=Array.isArray(item.guide) && item.guide.length<=10 &&
          item.guide.every(step=>step && ["verificar","accion_manual"].includes(step.phase) &&
            typeof step.text==="string" && step.text.length<=440)
          ? item.guide : [];
        guide.hidden=guideSteps.length===0;
        result.hidden=false;
      }
      status.textContent="";
      scrollChat();
    }catch{
      history.replaceChildren(welcome);
      result.hidden=true;
      clearContinuity();
    }finally{restoringConversation=false;}
  };
  let verifiedMuseum=null;
  let verificationInFlight=null;
  const revokeAiContext=(reason="La sesión, el museo o los permisos cambiaron.")=>{
    if(accessRevoked)return;
    accessRevoked=true;
    continuityReady=false;
    clearContinuity();
    resetConversation();
    newChat.disabled=true;
    form.querySelector('button[type="submit"]').disabled=true;
    status.textContent=reason+" Por seguridad, abre nuevamente el asistente.";
  };
  const verifyAiContext=async()=>{
    if(accessRevoked)return false;
    if(!mountedUserId)return false;
    let local;
    try {local=getSupabaseSession();}catch{return revokeAiContext(),false;}
    if(!local?.access_token || local.user?.id!==mountedUserId){
      revokeAiContext("La cuenta o sesión cambió.");return false;
    }
    if(verificationInFlight)return verificationInFlight;
    verificationInFlight=(async()=>{
      try{
        // Sequential calls: the app's legacy refresh-token helper has no
        // single-flight lock. Parallel requests close to expiry could both
        // try to rotate one refresh token and inadvertently log the user out.
        const museum=await supabasePost("/rest/v1/rpc/current_user_museum_id",{});
        const grants=await fetchCurrentSupabasePermissions();
        const latest=getSupabaseSession();
        const currentGrants=Array.isArray(grants)?grants.slice().sort().join("\\n"):"";
        if(!latest?.access_token || latest.user?.id!==mountedUserId ||
           typeof museum!=="string" || !museum ||
           currentGrants!==mountedGrants ||
           (verifiedMuseum && museum!==verifiedMuseum)){
          revokeAiContext();return false;
        }
        verifiedMuseum=museum;
        restoreConversation();
        return !accessRevoked;
      }catch{
        revokeAiContext("No se pudieron verificar los permisos de esta sesión.");
        return false;
      }
    })().finally(()=>{verificationInFlight=null;});
    return verificationInFlight;
  };
  if(mountedUserId){
    // A matching token refresh must not erase the conversation. A different
    // user/museum/grant set or failed verification always clears it.
    window.addEventListener("storage",event=>{
      if(event.key===supabaseSessionKey)return verifyAiContext();
    });
    window.addEventListener("focus",()=>verifyAiContext());
    document.addEventListener("visibilitychange",()=>{
      if(!document.hidden)return verifyAiContext();
    });
    window.setInterval(()=>{
      if(!document.hidden)void verifyAiContext();
    },60000);
    // No private result can be shown until this succeeds.
    void verifyAiContext();
  }

  form.addEventListener("submit",async(event)=>{
    event.preventDefault();
    if (busy || accessRevoked) return;
    if(mountedUserId && !(await verifyAiContext()))return;
    const data=new FormData(form);
    const originalMode=String(data.get("mode")||"product");
    const question=String(data.get("question")||"").trim();
    // An explicitly personal punch question from general help is routed to
    // the private mode; server-side permissions remain mandatory.
    const queryMode=originalMode==="product" && isPrivateAttendanceQuestion(question)
      ? "attendance" : originalMode;
    if(queryMode!==originalMode){mode.value=queryMode;updateMode(true);}
    const selectedId=selectedEmployeeId;
    selectedEmployeeId=null;
    const employee_name=String(data.get("employee_name")||"").trim();
    const day=String(data.get("day")||"");
    const start_day=String(data.get("start_day")||"");
    const fiscalYear=Number(data.get("year"));
    if(!question)return;
    if(queryMode==="attendance" && !canDiagnose){
      status.textContent="Tu perfil no tiene permiso para consultar asistencia privada de empleados.";
      return;
    }
    if (queryMode==="finance" && (!canReadFinance || !Number.isInteger(fiscalYear) || fiscalYear<2020 || fiscalYear>2100)) return;
    if (queryMode==="collections" && !canReadCollections) return;
    if (queryMode==="inventory" && !canReadInventory) return;
    if (queryMode==="assets" && !canReadAssets) return;
    if (queryMode==="schedules" && (!canReadSchedules || !/^20\d{2}-\d{2}-\d{2}$/.test(start_day))) return;
    if (queryMode==="notifications" && !canReadNotifications) return;
    // Selecting an ambiguity choice reuses the original question and must not
    // create a duplicate question bubble or transmit conversation history.
    archiveResult();
    if(!selectedId)appendMessage("user",question);
    busy=true;
    newChat.disabled=true;
    const button=form.querySelector('button[type="submit"]');
    button.disabled=true;
    result.hidden=true;
    resetGuide();
    clearChoices();
    answer.textContent="";
    formattedAnswer.replaceChildren();
    formattedAnswer.hidden=true;
    answer.hidden=false;
    evidence.textContent="";
    sources.replaceChildren();
    sourceDetails.hidden=true;
    status.textContent="Consultando las fuentes autorizadas...";
    try {
      const headers=await supabaseAuthHeaders();
      if(accessRevoked)return;
      const request={mode:queryMode,question};
      if (queryMode==="attendance") {
        if(employee_name)request.employee_name=employee_name;
        if(day)request.day=day;
        if(selectedId)request.employee_id=selectedId;
      }
      if (queryMode==="finance") request.year=fiscalYear;
      if (queryMode==="schedules") request.start_day=start_day;
      const res=await fetch(`${supabaseUrl}/functions/v1/instituva-ai-assistant`,{
        method:"POST",headers,body:JSON.stringify(request),cache:"no-store"
      });
      const body=await res.json().catch(()=>({}));
      if(mountedUserId && !(await verifyAiContext()))return;
      if(accessRevoked)return;
      if(!res.ok && res.status===409 &&
         body.code==="EMPLOYEE_SELECTION_REQUIRED" && showChoices(body)){
        status.textContent="Selecciona el empleado correcto para continuar; todavía no se ha consultado su expediente.";
        return;
      }
      if (!res.ok) throw Error(body.error||"El diagnóstico no está disponible.");
      if (body.read_only!==true || body.actions_executed!==false ||
          body.diagnostic_contract!=="read_only_v1" || typeof body.answer!=="string" ||
          body.mode!==queryMode || !Array.isArray(body.sources))
        throw Error("Respuesta del servicio no válida.");
      answer.textContent=body.answer;
      renderFormattedAnswer(body.answer);
      if (body.mode==="attendance") {
        const dayOffPunchCoincidence=body.evidence?.schedule_day_off_with_punches===true;
        evidence.textContent=`Fuente: asistencia de ${String(body.evidence?.employee||"").slice(0,120)}; fecha ${String(body.evidence?.date||day)}. Ponches efectivos: ${Number(body.evidence?.punch_count||0)}. Intentos rechazados: ${Number(body.evidence?.rejected_attempt_count||0)} (secuencia inválida: ${Number(body.evidence?.invalid_sequence_attempts||0)}). Alertas activas: ${Number(body.evidence?.active_alert_count||0)}; revisadas o resueltas: ${Number(body.evidence?.reviewed_or_resolved_alert_count||0)}. ${dayOffPunchCoincidence?"Observación: día libre registrado y ponches en la misma fecha; cotejar turnos y correcciones manualmente, no prueba incumplimiento. ":""}El conteo no confirma una causa. Solo lectura.`;
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
      // One query is independent of the next. Do not carry a selected employee
      // into an unrelated subsequent question.
      questionInput.value="";
      if(queryMode==="attendance")employee.value="";
      status.textContent="Consulta completada. Ningún registro operacional ha sido modificado.";
      scrollChat();
      saveConversation();
    } catch(error){
      if(accessRevoked)return;
      const message=error instanceof Error ? error.message : "No se pudo completar la consulta.";
      status.textContent=message;
      appendMessage("assistant",message);
    } finally{
      busy=false;
      newChat.disabled=accessRevoked;
      button.disabled=accessRevoked;
      updateMode();
    }
  });
}
