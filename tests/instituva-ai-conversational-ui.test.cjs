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
 assert.match(html,/js\/instituva-ai\.js\?v=20261126-modern-chat-1/);
});
