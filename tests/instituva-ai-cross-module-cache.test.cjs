"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const paths=["dashboard.html","administracion.html","finanzas.html","recursos-humanos.html","horarios.html","inventario.html","notificaciones.html","colecciones-museograficas.html","reportes.html","direccion-ejecutiva.html"];
test("AI-enabled app/config cache versions are consistent across major museum modules",()=>{
  for(const path of paths){
    const content=fs.readFileSync(path,"utf8");
    assert.match(content,/src="js\/config\.js\?v=20261126-ai-cross-module-1"/,path);
    assert.match(content,/src="js\/app\.js\?v=20261126-ai-cross-module-1"/,path);
    assert.ok(content.includes("class=\"app-shell\""),path+" retains original page shell");
  }
});
test("production still mounts dock exclusively after exact staff role validation",()=>{
  const app=fs.readFileSync("js/app.js","utf8");
  assert.match(app,/const canUseAi = instituvaAiUiEnabled && Boolean\(aiActiveStaff\);/);
  assert.match(app,/aiDockScript\.src = "js\/instituva-ai-dock\.js\?v=20261127-floating-orb-2";/);
  assert.match(app,/aiAuthorizedRoles\.has\(e\.accessProfile\)/);
});
