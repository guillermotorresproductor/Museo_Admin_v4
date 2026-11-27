"use strict";
// Optional authenticated INSTITUVA AI panel. No API, role, or operational writes.
// Loaded only after app.js completes the existing page/session permission gate.
(function mountInstituvaAiDock(){
  const host=document.querySelector(".app-shell");
  if(!host || document.querySelector("[data-ai-dock-launch]"))return;
  if(new URLSearchParams(window.location.search).get("dock")==="1")return;
  const page=(window.location.pathname.split("/").pop()||"").toLowerCase();
  if(page==="login.html"||page==="asistente-ia.html")return;

  const moduleContexts=Object.freeze({
    "administracion.html":"administracion",
    "recursos-humanos.html":"recursos-humanos",
    "reportes.html":"asistencia",
    "finanzas.html":"finanzas",
    "inventario.html":"inventario",
    "inventario-colecciones.html":"colecciones",
    "colecciones-museograficas.html":"colecciones",
    "horarios.html":"horarios",
    "notificaciones.html":"notificaciones",
    "direccion-ejecutiva.html":"direccion",
    "dashboard.html":"general",
    "index.html":"general"
  });
  // Only a public page category is passed, never record IDs, employee names,
  // messages, access tokens, or authorization information.
  const context=moduleContexts[page]||"general";
  const dockStateKey="instituva-ai-dock-open-v1";
  const destination=(popup=false)=>{
    const url=new URL("asistente-ia.html",window.location.href);
    url.search="";
    url.searchParams.set("environment",museoEnvironment.name);
    url.searchParams.set("context",context);
    // Force fresh assistant HTML after a verified production hotfix.
    url.searchParams.set("ai_ui","20261126-modern-chat-1");
    url.searchParams.set(popup ? "popup" : "dock","1");
    return url.href;
  };

  const stylesheet=document.createElement("link");
  stylesheet.rel="stylesheet";
  stylesheet.href="css/instituva-ai-dock.css?v=20261126-modern-dock-1";
  document.head.appendChild(stylesheet);

  const button=(label,cssClass)=>{
    const node=document.createElement("button");
    node.type="button";
    node.className=cssClass;
    node.textContent=label;
    return node;
  };
  // Compact floating launcher: brand emblem + curved name, no fixed green pill.
  // Purely presentational; existing authentication and iframe gates are unchanged.
  const launch=button("","ai-dock-launch");
  const mark=document.createElement("span");
  mark.className="ai-dock-launch-mark";
  mark.setAttribute("aria-hidden","true");
  const monogram=document.createElement("span");
  monogram.className="ai-dock-launch-monogram";
  monogram.textContent="I";
  const chevron=document.createElement("span");
  chevron.className="ai-dock-launch-chevron";
  chevron.textContent="‹›";
  mark.append(monogram,chevron);
  const svgNs="http://www.w3.org/2000/svg";
  const arc=document.createElementNS(svgNs,"svg");
  arc.setAttribute("class","ai-dock-launch-arc");
  arc.setAttribute("viewBox","0 0 120 120");
  arc.setAttribute("aria-hidden","true");
  const defs=document.createElementNS(svgNs,"defs");
  const curve=document.createElementNS(svgNs,"path");
  curve.id="ai-dock-launch-curve";
  curve.setAttribute("d","M 18,69 A 42,42 0 0,1 102,69");
  defs.appendChild(curve);
  const textNode=document.createElementNS(svgNs,"text");
  const textPath=document.createElementNS(svgNs,"textPath");
  textPath.setAttribute("href","#ai-dock-launch-curve");
  textPath.setAttribute("startOffset","50%");
  textPath.setAttribute("text-anchor","middle");
  textPath.textContent="INSTITUVA AI";
  textNode.appendChild(textPath);
  arc.append(defs,textNode);
  launch.append(mark,arc);
  launch.dataset.aiDockLaunch="";
  launch.setAttribute("aria-controls","instituva-ai-dock");
  launch.setAttribute("aria-expanded","false");
  launch.setAttribute("aria-label","Abrir asistente INSTITUVA sin salir de este módulo");

  const panel=document.createElement("aside");
  panel.id="instituva-ai-dock";
  panel.className="ai-dock-panel";
  panel.hidden=true;
  panel.setAttribute("aria-label","Asistente INSTITUVA, panel lateral");
  const header=document.createElement("div");
  header.className="ai-dock-header";
  const heading=document.createElement("div");
  const title=document.createElement("strong");
  title.textContent="INSTITUVA AI";
  const subtitle=document.createElement("span");
  subtitle.textContent="Consulta autorizada · Solo lectura";
  heading.append(title,subtitle);
  const controls=document.createElement("div");
  controls.className="ai-dock-controls";
  const expand=button("Ampliar","ai-dock-control");
  expand.setAttribute("aria-pressed","false");
  const popout=button("Ventana aparte","ai-dock-control");
  const close=button("Cerrar","ai-dock-control");
  controls.append(expand,popout,close);
  header.append(heading,controls);
  const iframe=document.createElement("iframe");
  iframe.dataset.aiDockFrame="";
  iframe.title="Asistente conversacional INSTITUVA, sesión actual";
  iframe.referrerPolicy="same-origin";
  iframe.loading="lazy";
  // Iframe remains mounted when minimized, preserving in-page conversation.
  panel.append(header,iframe);
  document.body.append(launch,panel);

  let expanded=false;
  let frameLoaded=false;
  const setOpen=(open)=>{
    if(open && !frameLoaded){
      iframe.src=destination();
      frameLoaded=true;
    }
    panel.hidden=!open;
    launch.hidden=open;
    try {sessionStorage.setItem(dockStateKey,open?"1":"0");}catch{}
    document.body.classList.toggle("ai-dock-open",open);
    launch.setAttribute("aria-expanded",String(open));
    if(open)close.focus();
    else launch.focus();
  };
  // Same-tab navigation remounts the dock in its previous open/closed state.
  // The conversation itself is restored only after rechecking live grants.
  try {if(sessionStorage.getItem(dockStateKey)==="1")setOpen(true);}catch{}
  launch.addEventListener("click",()=>setOpen(true));
  close.addEventListener("click",()=>setOpen(false));
  expand.addEventListener("click",()=>{
    expanded=!expanded;
    panel.classList.toggle("ai-dock-panel--wide",expanded);
    document.body.classList.toggle("ai-dock-wide",expanded);
    expand.textContent=expanded?"Reducir":"Ampliar";
    expand.setAttribute("aria-pressed",String(expanded));
  });
  popout.addEventListener("click",()=>{
    // Resolve the named window without navigating it. Sending its URL again
    // would silently reload the existing window and erase its private chat.
    const opened=window.open("","instituva-ai-workspace",
      "popup=yes,width=1050,height=860,resizable=yes,scrollbars=yes");
    if(!opened)return;
    let alreadyOurAssistant=false;
    try{
      const current=new URL(opened.location.href);
      alreadyOurAssistant=current.origin===window.location.origin &&
        current.pathname.endsWith("/asistente-ia.html") &&
        current.searchParams.get("popup")==="1" &&
        current.searchParams.get("environment")===museoEnvironment.name;
    }catch{ /* blank or cross-origin window: navigate only to first-party page */ }
    if(!alreadyOurAssistant)opened.location.replace(destination(true));
    opened.focus();
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape" && !panel.hidden && event.target!==iframe)
      setOpen(false);
  });
})();
