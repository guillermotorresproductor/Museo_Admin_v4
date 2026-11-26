"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const ai=fs.readFileSync("js/instituva-ai.js","utf8");
const html=fs.readFileSync("asistente-ia.html","utf8");

test("accepted message clears composer before network request, not before validation",()=>{
  const submit=ai.indexOf('form.addEventListener("submit"');
  const segment=ai.slice(submit);
  const validation=segment.indexOf('if (queryMode==="attendance" && !canDiagnose)');
  const clear=segment.indexOf('pendingChoiceQuestion=question;\n    questionInput.value="";');
  const request=segment.indexOf('const res=await fetch(');
  assert.ok(validation>=0 && clear>validation && request>clear);
  assert.ok(segment.indexOf('if(!question)return;')<clear);
  assert.match(segment,/const request=\{mode:queryMode,question\}/);
});
test("employee disambiguation choice resends original question without losing chat",()=>{
  assert.match(ai,/let pendingChoiceQuestion="";/);
  assert.match(ai,/questionInput\.value=pendingChoiceQuestion;[\s\S]{0,125}form\.requestSubmit\(\)/);
  assert.match(ai,/if\(!selectedId\)appendMessage\("user",question\)/);
  assert.match(ai,/if \(!res\.ok && res\.status===409 &&[\s\S]{0,200}showChoices\(body\)/);
});
test("new browser clients load updated composer code; server read-only contract remains",()=>{
  assert.match(html,/js\/instituva-ai\.js\?v=20261126-clear-composer-1/);
  assert.match(ai,/body\.read_only!==true \|\| body\.actions_executed!==false/);
  assert.match(ai,/stored\.museum!==verifiedMuseum/);
  assert.match(ai,/stored\.grants!==mountedGrants/);
});
