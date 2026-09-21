/* One record per receipt avoids replacing the legacy shared receipts array.
   All reads/writes use the existing museum-scoped app_records policies.
   Photographs and signatures remain in that protected record, never browser storage. */
const loanOwnershipText = 'La pieza continúa siendo propiedad del prestamista. El préstamo no transfiere la propiedad al Museo de la Música de Puerto Rico en Guaynabo. La modalidad por tiempo indefinido no establece una fecha de devolución en este formulario.';
const loanToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
function loanValidate(values) {
  if (!['temporal','indefinido'].includes(values.modalidad)) return 'Seleccione la modalidad del préstamo.';
  if (values.modalidad === 'temporal' && (!values.devolucion || values.devolucion < values.inicio)) return 'La devolución debe ser igual o posterior al inicio del préstamo.';
  if (values.categoria === 'Otro' && !values.categoria_otro?.trim()) return 'Especifique la otra categoría.';
  if (!values.propositos?.length && !values.proposito?.trim()) return 'Indique el propósito del préstamo.';
  if (values.propositos?.includes('Otros') && !values.proposito?.trim()) return 'Describa el otro propósito.';
  return '';
}
async function loanApi(profile, query, method = 'GET', body) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${supabaseSystemRecordsTable}?${query}`, {
    method, headers: {...await supabaseAuthHeaders(), ...(method === 'POST' ? {Prefer:'resolution=ignore-duplicates,return=minimal'} : {})},
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const result = await response.json().catch(()=>null);
  if (!response.ok) throw Error(explainSystemRecordsError(result, method === 'GET' ? 'cargar' : 'guardar'));
  return result;
}
function loanFilter(profile) {
  return `museum_id=eq.${encodeURIComponent(profile.museum_id)}&module=eq.recibos_prestamo`;
}
async function loanRead(profile, key) {
  const rows = await loanApi(profile, `${loanFilter(profile)}&record_key=eq.${encodeURIComponent(key)}&select=payload&limit=1`);
  if (!Array.isArray(rows) || rows.length !== 1) throw Error('No se pudo confirmar el expediente guardado.');
  return rows[0].payload;
}
function loanCanonical(value) {
  if (Array.isArray(value)) return value.map(loanCanonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,loanCanonical(value[k])]));
  return value;
}
async function loanSave(profile, receipt) {
  const key = `receipt-${receipt.id}`;
  await loanApi(profile, 'on_conflict=museum_id,module,record_key', 'POST', {
    museum_id:profile.museum_id, module:'recibos_prestamo', record_key:key, payload:receipt,
    created_by:profile.id, updated_by:profile.id, updated_at:new Date().toISOString()
  });
  const saved = await loanRead(profile,key);
  // Compare the entire submitted snapshot, including image evidence, after persistence.
  if (Object.keys(receipt).some(k=>JSON.stringify(loanCanonical(saved[k]))!==JSON.stringify(loanCanonical(receipt[k])))) throw Error('El expediente guardado no coincide. Conserve el formulario y avise a Administración.');
  return saved;
}
async function loanPhoto(file) {
  if (!file) return null;
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || !file.size || file.size > 10485760) throw Error('Seleccione una fotografía JPG, PNG o WEBP de hasta 10 MB.');
  const bitmap = await createImageBitmap(file).catch(()=>{throw Error('No se pudo leer la fotografía. Seleccione otra imagen.');});
  try {
    const scale = Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width=Math.max(1,Math.round(bitmap.width*scale)); canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/jpeg',.8);
    if(data.length>1500000) throw Error('La fotografía sigue siendo demasiado grande. Use una copia de menor tamaño.');
    return {name:file.name,data};
  } finally {bitmap.close();}
}
async function bindMuseologyLoanForm() {
  const form=document.querySelector('#loan-receipt-form');if(!form)return;
  const message=document.querySelector('[data-loan-message]'), submit=form.querySelector('[type=submit]');
  const fields=[...form.elements].filter(e=>e.name && !['file','checkbox'].includes(e.type));
  const photos={}, signatures={}, photoTasks={}, photoErrors={};
  let profile=null, busy=false, locked=false, pending=null, displayed=null, dirty=false;
  const say=(s,error=false)=>{message.textContent=s;message.className=`form-message ${error?'error':'success'}`;};
  const meta=r=>{document.querySelector('[data-loan-article-number]').textContent=r?.numeroArticulo||'Se asignará al guardar';document.querySelector('[data-loan-article-date]').textContent=r?.fechaEmision||loanToday();};
  const toggle=()=>{const end=form.elements.devolucion;end.disabled=locked||form.elements.modalidad.value==='indefinido';end.required=form.elements.modalidad.value==='temporal';if(form.elements.modalidad.value==='indefinido')end.value='';};
  const lock=value=>{locked=value;[...form.elements].filter(e=>e.name).forEach(e=>e.disabled=value);form.querySelectorAll('[data-clear-signature]').forEach(b=>b.disabled=value);toggle();};
  const read=()=>{
    const values=Object.fromEntries(fields.map(e=>[e.name,e.value.trim()]));
    values.propositos=[...form.querySelectorAll('[name=propositos]:checked')].map(e=>e.value);
    values.certificacion=form.elements.certificacion.checked;
    values.fotografias={...photos};values.firmas={...signatures};values.titularidad=loanOwnershipText;
    if(values.modalidad==='indefinido')values.devolucion='';
    return values;
  };
  form.addEventListener('input',()=>{dirty=true;});
  form.elements.modalidad.addEventListener('change',toggle);
  for(const canvas of form.querySelectorAll('[data-signature]')) {
    const key=canvas.dataset.signature,ctx=canvas.getContext('2d');let drawing=false;
    ctx.lineWidth=2;ctx.lineCap='round';
    const point=e=>{const r=canvas.getBoundingClientRect();return[(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height];};
    canvas.addEventListener('pointerdown',e=>{if(locked||busy)return;drawing=true;canvas.setPointerCapture(e.pointerId);ctx.beginPath();ctx.moveTo(...point(e));});
    canvas.addEventListener('pointermove',e=>{if(drawing){ctx.lineTo(...point(e));ctx.stroke();}});
    const finish=()=>{if(drawing){drawing=false;signatures[key]=canvas.toDataURL('image/png');dirty=true;}};
    canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);
    form.querySelector(`[data-clear-signature="${key}"]`).onclick=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);delete signatures[key];dirty=true;};
  }
  for(const input of form.querySelectorAll('[type=file]')) input.addEventListener('change',()=>{
    const file=input.files[0],key=input.name;
    const task=loanPhoto(file).then(photo=>{
      if(photoTasks[key]!==task)return;
      delete photoErrors[key];if(photo)photos[key]=photo;else delete photos[key];
      const image=form.querySelector(`[data-preview="${key}"]`);image.hidden=!photo;if(photo)image.src=photo.data;else image.removeAttribute('src');
    }).catch(e=>{if(photoTasks[key]===task){photoErrors[key]=e.message;delete photos[key];form.querySelector(`[data-preview="${key}"]`).hidden=true;say(e.message,true);}});
    photoTasks[key]=task;
  });
  function printReceipt(r) {
    const area=document.querySelector('#loan-printout');area.replaceChildren();
    const add=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;area.append(el);return el;};
    add('h2','Museo de la Música de Puerto Rico');add('h3','Formulario de préstamo a colección');
    add('p',`${r.numeroArticulo||'Formulario sin guardar'} · Fecha de emisión: ${r.fechaEmision||loanToday()}`);
    add('p',r.titularidad||loanOwnershipText);
    let dl;
    for(const child of form.children) {
      if(child.tagName==='H4'){add('h3',child.textContent);dl=document.createElement('dl');area.append(dl);}
      for(const e of child.querySelectorAll('[name]')){
        if(e.type==='checkbox'||e.type==='file'||!dl)continue;
        const label=form.querySelector(`label[for="${e.id}"]`);const box=document.createElement('div');
        const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label?.textContent.replace(' *','')||e.name;
        const val=r[e.name];dd.textContent=e.tagName==='SELECT'?([...e.options].find(o=>o.value===val)?.textContent||val||'____________________'):(val||'____________________');
        if(e.name==='devolucion'&&r.modalidad==='indefinido')dd.textContent='Sin fecha establecida';
        box.append(dt,dd);dl.append(box);
      }
      if(child.tagName==='FIELDSET')add('p',`Propósitos: ${(r.propositos||[]).join(', ')||'____________________'}`);
      for(const input of child.querySelectorAll('[type=file]')){
        const photo=r.fotografias?.[input.name];if(photo?.data?.startsWith('data:image/jpeg;base64,')){add('p',input.name==='foto_frontal'?'Fotografía frontal':'Fotografía posterior / detalles');const img=document.createElement('img');img.src=photo.data;img.alt=photo.name;area.append(img);}
      }
      for(const canvas of child.querySelectorAll('[data-signature]')){
        add('p',child.querySelector('label').textContent.split(' (')[0]);const sig=r.firmas?.[canvas.dataset.signature];
        if(sig?.startsWith('data:image/png;base64,')){const img=document.createElement('img');img.src=sig;img.alt='Firma registrada';area.append(img);}else add('p','________________________________________');
      }
    }
    add('p',`Certificación de titularidad e información: ${r.certificacion?'Aceptada en el formulario':'Pendiente de completar'}`);
    document.body.classList.add('loan-printing');window.print();
  }
  window.addEventListener('afterprint',()=>document.body.classList.remove('loan-printing'));
  document.querySelector('#loan-print').onclick=async()=>{await Promise.all(Object.values(photoTasks));printReceipt(displayed||pending||read());};
  document.querySelector('#loan-new').onclick=()=>{
    if(busy)return;
    if((dirty||pending)&&!confirm(pending?'Hay un guardado sin confirmar. Reintente primero para evitar duplicar el préstamo. ¿Abrir otro formulario?':'¿Descartar los datos sin guardar y abrir un formulario nuevo?'))return;
    displayed=null;pending=null;dirty=false;form.reset();lock(false);submit.disabled=!profile;submit.textContent='Guardar préstamo';
    for(const o of [photos,signatures,photoTasks,photoErrors])Object.keys(o).forEach(k=>delete o[k]);
    form.querySelectorAll('[data-signature]').forEach(c=>c.getContext('2d').clearRect(0,0,c.width,c.height));
    form.querySelectorAll('[data-preview]').forEach(i=>{i.hidden=true;i.removeAttribute('src');});meta();say('Nuevo formulario.');
  };
  async function list() {
    const container=document.querySelector('#loan-list'),status=document.querySelector('#loan-list-message');status.textContent='Cargando préstamos…';
    const all=[];
    for(let offset=0;;offset+=100){
      const page=await loanApi(profile,`${loanFilter(profile)}&record_key=like.receipt-*&select=record_key,articulo:payload->>articulo,prestamista:payload->>prestamista,numero:payload->>numeroArticulo&order=created_at.desc,id.desc&limit=100&offset=${offset}`);
      if(!Array.isArray(page))throw Error('No se pudo cargar el listado.');all.push(...page);if(page.length<100)break;
    }
    const legacy=await fetchSystemCollection('recibos_prestamo','receipts',[]);
    container.replaceChildren();
    for(const r of all){const line=document.createElement('div'),button=document.createElement('button');button.type='button';button.className='button secondary';button.textContent=`${r.numero} · ${r.articulo} · ${r.prestamista} — Ver / imprimir`;
      button.onclick=async()=>{if(busy)return;try{const record=await loanRead(profile,r.record_key);printReceipt(record);}catch(e){say(e.message,true);}};line.append(button);container.append(line);}
    for(const r of Array.isArray(legacy)?legacy:[]){const p=document.createElement('p');p.textContent=`${r.numeroArticulo||'Recibo anterior'} · ${r.articulo||''} · ${r.prestamista||''} — Resumen del formulario anterior`;container.append(p);}
    status.textContent=`${all.length} expedientes completos y ${Array.isArray(legacy)?legacy.length:0} resúmenes anteriores.`;
  }
  const reload=()=>list().catch(e=>{document.querySelector('#loan-list-message').textContent=e.message;});
  document.querySelector('#loan-reload').onclick=()=>{if(profile)reload();};
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!profile||displayed||!canWriteCollections())return;
    if(!pending&&!form.reportValidity())return;
    busy=true;submit.disabled=true;
    try{
      await Promise.all(Object.values(photoTasks));
      if(Object.values(photoErrors).length)throw Error(Object.values(photoErrors)[0]);
      if(!pending){
        const values=read(),error=loanValidate(values);if(error)throw Error(error);
        const id=crypto.randomUUID();pending={...values,id,schemaVersion:2,numeroArticulo:`PR-${loanToday().replaceAll('-','')}-${id}`,fechaEmision:loanToday()};lock(true);
      }
      say('Guardando y verificando el expediente…');
      displayed=await loanSave(profile,pending);pending=null;dirty=false;meta(displayed);submit.textContent='Préstamo guardado';
      say('Expediente completo guardado. Puede imprimirlo o iniciar otro formulario.');await reload();
    }catch(e){say(e.message+(pending?' Reintente el guardado; se conservará el mismo número.':''),true);submit.textContent=pending?'Reintentar guardado':'Guardar préstamo';}
    finally{busy=false;submit.disabled=!!displayed;}
  });
  meta();toggle();
  try{profile=await currentMuseumContext();submit.disabled=!canWriteCollections();await reload();}
  catch(e){say(e.message,true);submit.disabled=true;}
}
