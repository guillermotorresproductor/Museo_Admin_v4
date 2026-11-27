// Run with Node 22.6+ (TypeScript stripping supported):
// node --experimental-strip-types --test supabase/tests/instituva-ai-knowledge-routing.test.mjs
// Pure local tests: no Supabase URL, credentials or operational records.
import test from "node:test";
import assert from "node:assert/strict";
import {planNaturalQuery} from "../functions/instituva-ai-assistant/conversational-plan.ts";
import {findProductKnowledge, PRODUCT_KNOWLEDGE} from "../functions/instituva-ai-assistant/product-knowledge.ts";
import {findIncidentRunbooks} from "../functions/instituva-ai-assistant/incident-runbooks.ts";

const now=new Date("2026-11-26T16:00:00-04:00");
const plan=(question, extras={})=>planNaturalQuery(question,{mode:"auto",...extras},now);
test("general correction permission question uses product knowledge, not private employee rows",()=>{
  assert.equal(plan("¿Por qué Roberto no puede corregir un ponche?").mode,"product");
  assert.equal(plan("¿Quién puede corregir los ponches?").mode,"product");
});
test("date-scoped attendance issue still uses guarded attendance path",()=>{
  assert.equal(plan("¿Por qué Roberto no puede corregir el ponche de ayer?").mode,"attendance");
  assert.equal(plan("¿Qué pasó con el ponche de Ana hoy?").mode,"attendance");
});
test("ordinary financial, collections and inventory questions preserve existing routing",()=>{
  assert.equal(plan("¿Cuál es el presupuesto de finanzas?").mode,"finance");
  assert.equal(plan("¿Cuántas piezas hay en colecciones?").mode,"collections");
  assert.equal(plan("¿Cuántos equipos hay en inventario?").mode,"inventory");
});
test("institutional correction policy is discoverable and flagged unverified",()=>{
  const results=findProductKnowledge("quién tiene permiso para corregir ponches",5);
  assert.ok(results.some(x=>x.id==="attendance-correction-roles"));
  assert.ok(results.filter(x=>x.id==="attendance-correction-roles").every(x=>x.sourceStatus==="historical-unverified"));
});
test("knowledge entries have nonempty unique IDs and source attribution",()=>{
  assert.equal(new Set(PRODUCT_KNOWLEDGE.map(x=>x.id)).size,PRODUCT_KNOWLEDGE.length);
  for(const x of PRODUCT_KNOWLEDGE){
    assert.ok(x.id && x.domain && x.title && x.source && x.statement);
    assert.ok(["reviewed-main","historical-unverified"].includes(x.sourceStatus ?? "historical-unverified"));
  }
});
test("runbooks only propose manual verifications, not executed actions",()=>{
  const guides=findIncidentRunbooks("jornada abierta sin ponche");
  assert.ok(guides.length>=1);
  for(const guide of guides){
    assert.ok(guide.verify.length && guide.safeActions.length && guide.uncertainty);
    assert.ok(guide.source && guide.commit);
  }
});
