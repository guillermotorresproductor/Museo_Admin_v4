"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const dockSource=fs.readFileSync("js/instituva-ai-dock.js","utf8");
const dockCss=fs.readFileSync("css/instituva-ai-dock.css","utf8");
const app=fs.readFileSync("js/app.js","utf8");

function runDock(page="horarios.html",environment="staging"){
  const classes=new Set();
  const created=[];
  const make=(tag="div")=>{
    const node={
      tag,children:[],listeners:{},attributes:{},dataset:{},
      hidden:false,textContent:"",className:"",src:"",
      classList:{
        toggle(name,value){
          if(value===undefined){if(classes.has(name)){classes.delete(name);return false;}classes.add(name);return true;}
          if(value)classes.add(name);else classes.delete(name);return value;
        }
      },
      append(...children){this.children.push(...children);},
      addEventListener(name,cb){this.listeners[name]=cb;},
      setAttribute(name,value){this.attributes[name]=String(value);},
      focus(){this.didFocus=true;}
    };
    created.push(node);
    return node;
  };
  const body=make("body"),head=make("head"),host=make("div");
  const popups=[],handlers={};
  const location={
    href:"https://demo.instituva.com/"+page+"?environment="+environment,
    pathname:"/"+page,search:"?environment="+environment,
    origin:"https://demo.instituva.com"
  };
  const document={
    body,head,
    querySelector(selector){
      if(selector===".app-shell")return host;
      if(selector==="[data-ai-dock-launch]")return body.children.find(n=>Object.hasOwn(n.dataset,"aiDockLaunch"))||null;
      return null;
    },
    createElement:make,
    addEventListener(name,cb){handlers[name]=cb;}
  };
  const window={
    location,
    open(url,name,opts){
      const popup={url,name,opts,focused:false,focus(){this.focused=true;}};
      popups.push(popup);return popup;
    }
  };
  vm.runInNewContext(dockSource,{
    document,window,museoEnvironment:{name:environment},URL,URLSearchParams
  },{filename:"js/instituva-ai-dock.js"});
  const launcher=body.children.find(n=>Object.hasOwn(n.dataset,"aiDockLaunch"));
  const panel=body.children.find(n=>n.tag==="aside");
  const frame=panel?.children.find(n=>n.tag==="iframe");
  const controls=panel?.children[0]?.children?.[1]?.children || [];
  return {document,body,head,launcher,panel,frame,controls,handlers,popups,classes};
}

test("auth gate precedes lazy staging-only dock load and skips login and AI iframe",()=>{
 const gate=app.indexOf('if (enforceAuthenticatedPageAccess()) return;');
 const loader=app.indexOf('dockScript.src="js/instituva-ai-dock.js');
 assert.ok(gate>0 && loader>gate);
 const slice=app.slice(gate,loader);
 assert.match(slice,/museoEnvironment\.name === "staging"/);
 assert.match(slice,/getCurrentPage\(\) !== "asistente-ia.html"/);
 assert.match(slice,/document\.querySelector\("\[data-header\]"\)/);
 assert.match(app,/new URLSearchParams\(window\.location\.search\)\.get\("dock"\) === "1"/);
});

test("dock opens in the same page with no secrets in iframe URL",()=>{
 const d=runDock("horarios.html");
 assert.ok(d.launcher && d.panel && d.frame);
 assert.equal(d.panel.hidden,true);
 assert.equal(d.frame.src,"","no network until user clicks");
 d.launcher.listeners.click();
 assert.equal(d.panel.hidden,false);
 assert.equal(d.launcher.hidden,true);
 assert.equal(d.frame.src,
   "https://demo.instituva.com/asistente-ia.html?environment=staging&context=horarios&dock=1");
 assert.ok(d.classes.has("ai-dock-open"));
 assert.doesNotMatch(d.frame.src,/token|password|employee_id|user_id|record_id/i);
 assert.equal(d.head.children[0].tag,"link");
 assert.match(d.head.children[0].href,/instituva-ai-dock\.css/);
});

test("minimize and reopen preserve same in-page iframe; wide view doesn't rewrite module DOM",()=>{
 const d=runDock("inventario.html");
 d.launcher.listeners.click();
 const before=d.frame.src;
 d.controls[0].listeners.click();
 assert.ok(d.panel.className==="ai-dock-panel");
 assert.ok(d.classes.has("ai-dock-wide"));
 d.controls[2].listeners.click();
 assert.equal(d.panel.hidden,true);
 d.launcher.listeners.click();
 assert.equal(d.panel.hidden,false);
 assert.equal(d.frame.src,before);
 assert.ok(d.body.children.length===2,"only launch and dock are appended");
 assert.match(dockCss,/body\.ai-dock-open \.main-area/);
 assert.match(dockCss,/@media print/);
});

test("separate assistant window is first party and survives parent page navigation",()=>{
 const d=runDock("finanzas.html");
 d.launcher.listeners.click();
 d.controls[1].listeners.click();
 assert.equal(d.popups.length,1);
 assert.equal(d.popups[0].name,"instituva-ai-workspace");
 assert.equal(d.popups[0].url,
   "https://demo.instituva.com/asistente-ia.html?environment=staging&context=finanzas");
 assert.equal(d.popups[0].focused,true);
 assert.doesNotMatch(d.popups[0].url,/token|password|employee_id|history/i);
});

test("dock transports only public page category, not records or auth, and has no data mutations",()=>{
 assert.match(dockSource,/Object\.freeze\(\{/);
 assert.match(dockSource,/const context=moduleContexts\[page\]\|\|"general"/);
 assert.doesNotMatch(dockSource,/localStorage|sessionStorage|fetch\(|postMessage|\.innerHTML|\.insert\(|\.update\(|\.delete\(/);
 assert.match(dockCss,/max-width: 1099px/);
});
