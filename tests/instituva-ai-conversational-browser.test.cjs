"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM}=require("jsdom");

const html=fs.readFileSync("asistente-ia.html","utf8");
const ai=fs.readFileSync("js/instituva-ai.js","utf8");
const delay=()=>new Promise(resolve=>setTimeout(resolve,10));
const waitFor=async(predicate)=>{
 for(let i=0;i<80;i++){if(predicate())return;await delay();}
 assert.fail("Frontend did not reach expected state");
};
test("real chat DOM sends natural language, clears composer, and reuses scoped context",async()=>{
 const dom=new JSDOM(html,{url:"https://demo.instituva.com/asistente-ia.html?dock=1",runScripts:"outside-only",pretendToBeVisual:true});
 const w=dom.window;
 const userId="00000000-0000-4000-8000-000000000001";
 const museum="00000000-0000-0000-0000-000000000002";
 const grants=["attendance.history.read","finance.read","employees.read.all"];
 const requests=[];
 const context={mode:"attendance",employee_name:"Roberto Prueba",start_day:"2026-11-01",end_day:"2026-11-27"};
 try{
  w.getSupabaseSession=()=>({access_token:"synthetic-never-valid",user:{id:userId}});
  w.currentPermissions=new Set(grants);
  w.hasPermission=(p)=>w.currentPermissions.has(p);
  w.supabaseSessionKey="synthetic-ai-session";
  w.supabaseUrl="https://example.invalid";
  w.supabasePost=async(path)=>{assert.equal(path,"/rest/v1/rpc/current_user_museum_id");return museum;};
  w.fetchCurrentSupabasePermissions=async()=>[...grants];
  w.supabaseAuthHeaders=async()=>({Authorization:"Bearer synthetic-never-valid","Content-Type":"application/json"});
  w.fetch=async(_url,request)=>{
   requests.push(JSON.parse(request.body));
   return {ok:true,status:200,json:async()=>({
    mode:"attendance",answer:requests.length===1?"Se verificaron 8 horas.":"Una entrada posterior al turno.",
    sources:["attendance_events"],evidence:{domain:"attendance"},
    read_only:true,actions_executed:false,diagnostic_contract:"read_only_v1",
    conversation_context:context,guide_steps:[]
   })};
  };
  w.eval(ai);
  w.eval("bindInstituvaAi()");
  await waitFor(()=>w.document.querySelector('[data-ai-form] button[type="submit"]')?.disabled===false);
  const question=w.document.querySelector('[name="question"]');
  const form=w.document.querySelector("[data-ai-form]");
  assert.equal(w.document.querySelector('[name="mode"]').value,"auto");
  assert.equal(w.document.querySelectorAll("select").length,0);
  question.value="¿Cuántas horas trabajó Roberto en noviembre?";
  form.dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
  await waitFor(()=>requests.length===1 && w.document.querySelector("[data-ai-answer]").textContent.includes("8 horas"));
  assert.equal(requests[0].mode,"auto");
  assert.equal(requests[0].question,"¿Cuántas horas trabajó Roberto en noviembre?");
  assert.equal(question.value,"");
  assert.equal(requests[0].conversation_context,undefined);
  question.value="¿Y cuántos días llegó tarde?";
  form.dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
  await waitFor(()=>requests.length===2 && w.document.querySelector("[data-ai-answer]").textContent.includes("posterior"));
  assert.equal(requests[1].mode,"auto");
  assert.deepEqual(JSON.parse(JSON.stringify(requests[1].conversation_context)),context);
  assert.equal(question.value,"");
  assert.equal(w.document.querySelectorAll(".ai-chat-message--user").length,2);
  assert.equal(requests[0].messages,undefined);
  assert.equal(requests[1].history,undefined);
 }finally{dom.window.close();}
});
