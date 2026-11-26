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
  const destination=(popup=false)=>{
    const url=new URL("asistente-ia.html",window.location.href);
    url.search="";
    url.searchParams.set("environment",museoEnvironment.name);
    url.searchParams.set("context",context);
    url.searchParams.set(popup ? "popup" : "dock","1");
    return url.href;
  };

  const stylesheet=document.createElement("link");
  stylesheet.rel="stylesheet";
  stylesheet.href="css/instituva-ai-dock.css?v=20261126-dock-1";
  document.head.appendChild(stylesheet);

  const button=(label,cssClass)=>{
    const node=document.createElement("button");
    node.type="button";
    node.className=cssClass;
    node.textContent=label;
    return node;
  };
  const launch=button("INSTITUVA AI","ai-dock-launch");
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
  const footer=document.createElement("p");
  footer.className="ai-dock-disclaimer";
  footer.textContent="Al cambiar de página, este panel reinicia. «Ventana aparte» conserva la conversación mientras la mantengas abierta. No se almacenan mensajes.";
  panel.append(header,iframe,footer);
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
    document.body.classList.toggle("ai-dock-open",open);
    launch.setAttribute("aria-expanded",String(open));
    if(open)close.focus();
    else launch.focus();
  };
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
