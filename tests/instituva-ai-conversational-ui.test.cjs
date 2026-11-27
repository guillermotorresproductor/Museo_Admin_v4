"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("asistente-ia.html","utf8");
const js=fs.readFileSync("js/instituva-ai.js","utf8");
test("chat has one visible composer, no department or date selectors",()=>{
 assert.match(html,/<input type="hidden" name="mode" value="auto">/);
 assert.doesNotMatch(html,/Tipo de consulta<\/label>|<select id="ai-mode"/);
 assert.match(html,/data-ai-new-chat/);
 assert.match(html,/name="employee_name"[^>]*>/);
 assert.match(html,/data-ai-private hidden style="display:none"/);
 assert.match(html,/data-ai-finance hidden style="display:none"/);
 assert.match(html,/data-ai-schedules hidden style="display:none"/);
 assert.match(html,/Escribe tu mensaje/);
});
test("messages use only bounded, server-validated context, never replay raw history",()=>{
 assert.match(js,/request\.conversation_context=conversationContext/);
 assert.match(js,/conversationContext=validatedContext\(body\.conversation_context\)/);
 assert.match(js,/conversationContext=validatedContext\(stored\.conversationContext\)/);
 assert.match(js,/stored\.user!==mountedUserId/);
 assert.match(js,/stored\.museum!==verifiedMuseum/);
 assert.match(js,/stored\.grants!==mountedGrants/);
 assert.match(js,/mode\.value="auto"/);
 assert.match(js,/queryMode!=="auto" && body\.mode!==queryMode/);
 assert.doesNotMatch(js,/request\.history\s*=|request\.messages\s*=/);
});
test("selected name ambiguity and backend authorizations are retained",()=>{
 assert.match(js,/request\.employee_id=selectedId/);
 assert.match(js,/body\.diagnostic_contract!=="read_only_v1"/);
 assert.match(js,/body\.read_only!==true \|\| body\.actions_executed!==false/);
 assert.match(html,/js\/instituva-ai\.js\?v=20261127-conversation-scope-1/);
});


test("step-by-step guidance is conversational, never a permanent toolbar",()=>{
 assert.doesNotMatch(html,/data-ai-guide|Comenzar guía|¿Quieres que te guíe paso a paso\?/);
 assert.doesNotMatch(js,/data-ai-guide|guideSteps|guidePanel|showGuideStep|resetGuide/);
 assert.match(html,/data-ai-history/);
 assert.match(html,/data-ai-answer/);
 assert.match(html,/data-ai-new-chat/);
 assert.match(html,/ai-chat-composer/);
});
test("modernized chat presentation stays within assistant-specific selectors",()=>{
 assert.match(html,/ai-title-accent/);
 assert.match(html,/ai-status-dot/);
 assert.match(html,/ai-visually-hidden/);
 assert.match(html,/data-ai-sources-details/);
 assert.match(html,/aria-label="Enviar mensaje"/);
 assert.match(html,/20261127-conversation-scope-1/);
});

test("diagnostic history has conversational presentation without changing source contract",()=>{
 assert.match(js,/const historyAnswer=\(raw\)=>/);
 assert.match(js,/role==="assistant"\?historyAnswer\(message\)/);
 assert.match(js,/headings\.every\(\(heading,index\)=>chunks\[index\+1\]\.startsWith\(heading\+"\\n"\)\)/);
 assert.match(js,/labels=\["","Posibles causas","Qué comprobar","Qué puedes hacer","Lo que falta confirmar"\]/);
 assert.match(js,/const refs=Array\.from\(sources\.children\|\|\[\]\)/);
});
