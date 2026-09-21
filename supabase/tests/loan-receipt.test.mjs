import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);

const source=fs.readFileSync(new URL('../../js/loan-receipt.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../../recibo-prestamo.html',import.meta.url),'utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]*>/g,'');
const ctx=vm.createContext({});vm.runInContext(source,ctx);
test('loan dates, other categories and purposes are validated',()=>{
 const good={modalidad:'temporal',inicio:'2026-09-21',devolucion:'2026-10-01',categoria:'CD',propositos:['Exhibición']};
 assert.equal(ctx.loanValidate(good),'');
 assert.match(ctx.loanValidate({...good,devolucion:'2026-09-20'}),/devolución/);
 assert.equal(ctx.loanValidate({...good,modalidad:'indefinido',devolucion:''}),'');
 assert.match(ctx.loanValidate({...good,categoria:'Otro'}),/categoría/);
 assert.match(ctx.loanValidate({...good,propositos:['Otros']}),/propósito/);
 assert.match(ctx.loanValidate({...good,propositos:[]}),/propósito/);
});
test('JSONB key reordering does not invalidate saved photographic evidence',()=>{
 const a={fotografias:{foto_frontal:{name:'pieza.jpg',data:'example'}}};
 const b={fotografias:{foto_frontal:{data:'example',name:'pieza.jpg'}}};
 assert.equal(JSON.stringify(ctx.loanCanonical(a)),JSON.stringify(ctx.loanCanonical(b)));
});
test('browser: fields, photographs, signatures, retry, reload, print and legacy preservation',{skip:process.env.LOAN_BROWSER_TEST!=='1'},async()=>{
 const {chromium}=require('playwright');
 const browser=await chromium.launch({headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1100,height:850}});const records=new Map();let failRead=false,posts=0;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:5199/**',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.route('https://loan-test.invalid/**',async route=>{
   const req=route.request(),u=new URL(req.url);
   assert.equal(req.headers().authorization,'Bearer synthetic');
   if(req.method()==='POST'){
     const body=req.postDataJSON();assert.equal(body.museum_id,'museum-test');assert.equal(body.module,'recibos_prestamo');
     assert.equal(req.headers().prefer,'resolution=ignore-duplicates,return=minimal');
     posts++;if(!records.has(body.record_key))records.set(body.record_key,JSON.parse(JSON.stringify(ctx.loanCanonical(body.payload))));
     return route.fulfill({status:201,body:''});
   }
   assert.equal(u.searchParams.get('museum_id'),'eq.museum-test');
   const key=u.searchParams.get('record_key');
   if(key?.startsWith('eq.')){
     if(failRead){failRead=false;return route.fulfill({status:503,body:'{}'});}
     return route.fulfill({json:[{payload:records.get(key.slice(3))}]});
   }
   return route.fulfill({json:[...records].map(([record_key,p])=>({record_key,articulo:p.articulo,prestamista:p.prestamista,numero:p.numeroArticulo}))});
 });
 async function load(){
   await page.goto('http://127.0.0.1:5199/recibo-prestamo.html');
   await page.addStyleTag({content:fs.readFileSync(new URL('../../css/main.css',import.meta.url),'utf8')});
   await page.addStyleTag({content:fs.readFileSync(new URL('../../css/loan-receipt.css',import.meta.url),'utf8')});
   await page.addScriptTag({content:`const supabaseUrl='https://loan-test.invalid',supabaseSystemRecordsTable='app_records';const currentMuseumContext=async()=>({museum_id:'museum-test',id:'writer-test'});const supabaseAuthHeaders=async()=>({'Content-Type':'application/json',Authorization:'Bearer synthetic'});const explainSystemRecordsError=()=> 'Error simulado';const canWriteCollections=()=>true;const fetchSystemCollection=async()=>[{numeroArticulo:'Artículo 00001',articulo:'Anterior',prestamista:'Dueño anterior'}];window.print=()=>{};document.body.classList.add('app-ready');`});
   await page.addScriptTag({content:source});await page.evaluate(()=>bindMuseologyLoanForm());
 }
 await load();
 for(const [name,value] of Object.entries({articulo:'Vinilo <prueba>',autor:'Artista',periodo:'1970',materiales:'Vinilo',procedencia:'Colección privada',descripcion:'Disco de prueba',alto:'30',ancho:'30',profundidad:'1',peso:'2',valor:'25',inicio:'2026-09-21',prestamista:'Dueño de prueba',correo:'test@example.invalid',telefono:'7875550101',direccion:'Dirección de prueba',fecha:'2026-09-21',ubicacion:'Almacén',inventario:'M-123',representante:'Ana',cargo_representante:'Museología',recibido_por:'Ana'})) await page.locator(`[name="${name}"]`).fill(value);
 await page.locator('[name=categoria]').selectOption('Discos de Vinilo');await page.locator('[name=condicion]').selectOption('Malo');
 await page.locator('[name=modalidad]').selectOption('indefinido');assert.equal(await page.locator('[name=devolucion]').isDisabled(),true);
 await page.locator('[name=propositos][value=Exhibición]').check();await page.locator('[name=certificacion]').check();
 const png=fs.readFileSync(new URL('./fixtures/collection-test.png',import.meta.url));
 for(const name of ['foto_frontal','foto_posterior'])await page.locator(`[name=${name}]`).setInputFiles({name:'prueba.png',mimeType:'image/png',buffer:png});
 await page.waitForFunction(()=>[...document.querySelectorAll('[data-preview]')].every(i=>!i.hidden));
 const canvas=page.locator('[data-signature=firma_propietario]');await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();
 await page.mouse.move(box.x+10,box.y+30);await page.mouse.down();await page.mouse.move(box.x+150,box.y+50);await page.mouse.up();
 failRead=true;await page.locator('[type=submit]').click();await page.waitForFunction(()=>document.querySelector('[type=submit]').textContent==='Reintentar guardado');
 assert.equal(records.size,1);assert.equal(await page.locator('[name=articulo]').isDisabled(),true);
 await page.locator('[type=submit]').click();await page.waitForFunction(()=>document.querySelector('[type=submit]').textContent==='Préstamo guardado');
 assert.equal(records.size,1);assert.equal(posts,2);const saved=[...records.values()][0];
 assert.equal(saved.autor,'Artista');assert.equal(saved.devolucion,'');assert.equal(saved.modalidad,'indefinido');assert.match(saved.titularidad,/no transfiere/);
 assert.ok(saved.fotografias.foto_frontal.data.startsWith('data:image/jpeg;base64,'));assert.ok(saved.fotografias.foto_posterior);assert.ok(saved.firmas.firma_propietario);
 await load();assert.match(await page.locator('#loan-list').innerText(),/Artículo 00001/);assert.equal(records.size,1);
 await page.locator('#loan-list button').click();assert.match(await page.locator('#loan-printout').textContent(),/Sin fecha establecida/);
 assert.match(await page.locator('#loan-printout').textContent(),/Vinilo <prueba>/);assert.equal(await page.locator('#loan-printout img').count(),3);
 assert.equal(await page.locator('#loan-printout prueba').count(),0);
 await page.locator('.loan-print-action').click();
 await page.emulateMedia({media:'print'});
 if(process.env.LOAN_QA_DIR){await page.screenshot({path:process.env.LOAN_QA_DIR+'/loan-print.png',fullPage:true});await page.pdf({path:process.env.LOAN_QA_DIR+'/loan-print.pdf',preferCSSPageSize:true});}
 assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

test('save uses a separate receipt, verifies evidence and retries without overwriting',async()=>{
 const rows=new Map(),calls=[];let uncertain=true;
 const c=vm.createContext({supabaseUrl:'https://test.invalid',supabaseSystemRecordsTable:'app_records',supabaseAuthHeaders:async()=>({Authorization:'Bearer test'}),explainSystemRecordsError:()=> 'Unavailable',
 fetch:async(url,options)=>{
  calls.push({url,options});const u=new URL(url);
  if(options.method==='POST'){
   const row=JSON.parse(options.body);assert.equal(row.museum_id,'museum-a');assert.equal(row.module,'recibos_prestamo');assert.equal(row.record_key,'receipt-fixed-id');
   assert.equal(options.headers.Prefer,'resolution=ignore-duplicates,return=minimal');
   if(!rows.has(row.record_key))rows.set(row.record_key,JSON.parse(JSON.stringify(ctx.loanCanonical(row.payload))));
   return {ok:true,json:async()=>null};
  }
  assert.equal(u.searchParams.get('museum_id'),'eq.museum-a');assert.equal(u.searchParams.get('module'),'eq.recibos_prestamo');
  if(uncertain){uncertain=false;return {ok:false,json:async()=>({})};}
  return {ok:true,json:async()=>[{payload:rows.get(u.searchParams.get('record_key').slice(3))}]};
 }});vm.runInContext(source,c);
 const profile={museum_id:'museum-a',id:'writer'};
 const receipt={id:'fixed-id',articulo:'Vinilo',fotografias:{foto_frontal:{name:'front.jpg',data:'evidence'},foto_posterior:{name:'back.jpg',data:'evidence2'}},firmas:{firma_propietario:'signature'},modalidad:'indefinido',devolucion:''};
 await assert.rejects(()=>c.loanSave(profile,receipt),/Unavailable/);
 const saved=await c.loanSave(profile,receipt);assert.equal(rows.size,1);assert.equal(saved.fotografias.foto_posterior.data,'evidence2');
 await assert.rejects(()=>c.loanSave(profile,{...receipt,articulo:'Changed'}),/no coincide/);
 assert.equal(rows.get('receipt-fixed-id').articulo,'Vinilo');
 assert.ok(calls.every(({url})=>!url.includes('record_key=eq.receipts')));
});
test('a rejected insert cannot report success or perform a readback',async()=>{
 let calls=0;const c=vm.createContext({supabaseUrl:'https://test.invalid',supabaseSystemRecordsTable:'app_records',supabaseAuthHeaders:async()=>({}),explainSystemRecordsError:()=> 'Permiso denegado',fetch:async()=>{calls++;return{ok:false,json:async()=>({})};}});vm.runInContext(source,c);
 await assert.rejects(()=>c.loanSave({museum_id:'a',id:'writer'},{id:'new'}),/Permiso denegado/);assert.equal(calls,1);
});
