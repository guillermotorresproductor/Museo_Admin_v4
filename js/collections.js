// Preserve only the requested piece ID across this module's login redirect.
// No catalog record or photo is stored in browser storage.
const collectionReturnKey = `museo-collection-return-${museoEnvironment.name}`;
const requestedCollectionId = new URLSearchParams(location.search).get('pieza');
if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedCollectionId || '')) sessionStorage.setItem(collectionReturnKey, requestedCollectionId);
async function bindCollectionsCatalog() {
  const form = document.querySelector('#collection-form'); if (!form) return;
  const status = document.querySelector('#collection-message'), list = document.querySelector('#collection-list');
  const detail = document.querySelector('#collection-detail'), dialog = document.querySelector('#collection-dialog');
  const search = document.querySelector('#collection-search');
  let items = [], editing = null, saving = false;
  const canWrite = hasPermission('collections.write');
  const base = ['accession_number','title','description','category','location','condition','status'];
  const more = ['author','dating','materials','dimensions','provenance','owner','acquisition','custody','donor','lender','received_date','fmv','currency','loan_reference','notes'];
  const labels = {accession_number:'Número de inventario',title:'Nombre o título',description:'Descripción museográfica',category:'Clasificación',location:'Ubicación',condition:'Estado de conservación',status:'Estado del registro',author:'Autor / fabricante',dating:'Época / fecha de creación',materials:'Materiales y técnica',dimensions:'Dimensiones',provenance:'Procedencia',owner:'Titularidad',acquisition:'Forma de ingreso / adquisición',custody:'Condición de custodia',donor:'Donante',lender:'Prestamista',received_date:'Fecha de ingreso',fmv:'Valor estimado (FMV)',currency:'Moneda',loan_reference:'Referencia de préstamo / documento',notes:'Observaciones'};
  const say = (text, error = false) => { status.textContent = text; status.className = `form-message ${error ? 'error' : 'success'}`; };
  const esc = value => safeHtml(String(value ?? ''));
  function reset() {
    editing = null; form.reset(); form.hidden = true;
    document.querySelector('#collection-form-title').textContent = 'Registrar pieza';
  }
  function edit(item) {
    if (!canWrite || saving) return;
    editing = item; form.reset();
    if (item) [...base,...more].forEach(key => { form.elements[key].value = base.includes(key) ? item[key] || '' : item.details?.[key] || ''; });
    form.elements.reason.value = item ? '' : 'Registro inicial';
    document.querySelector('#collection-form-title').textContent = item ? `Editar ${item.accession_number}` : 'Registrar pieza';
    form.hidden = false; form.scrollIntoView({behavior:'smooth'}); form.elements.title.focus();
  }
  function render() {
    const term = search.value.trim().toLocaleLowerCase('es');
    const selected = items.filter(i => [i.accession_number,i.title,i.description,i.category,i.location,i.details?.donor,i.details?.lender].join(' ').toLocaleLowerCase('es').includes(term));
    document.querySelector('#collection-count').textContent = `${selected.length} de ${items.length} piezas`;
    list.innerHTML = selected.length ? selected.map(i => `<tr><td>${esc(i.accession_number)}</td><td>${esc(i.title)}</td><td>${esc(i.category)}</td><td>${esc(i.location)}</td><td>${esc(i.condition)}</td><td><button class="button secondary" data-piece-view="${i.id}">Ver expediente</button>${canWrite ? ` <button class="button secondary" data-piece-edit="${i.id}">Editar</button>` : ''}</td></tr>`).join('') : '<tr><td colspan="6">No hay piezas que coincidan con la búsqueda.</td></tr>';
  }
  async function reload() { items = await collectionRows('collection_items'); render(); }
  function historyChanges(h) {
    if(h.action === 'fotografia') return h.after_value.caption || 'Fotografía añadida al expediente.';
    return [...base,...more].flatMap(k => {
      const old = base.includes(k) ? h.before_value?.[k] : h.before_value?.details?.[k];
      const next = base.includes(k) ? h.after_value?.[k] : h.after_value?.details?.[k];
      return old === next ? [] : [`${labels[k]}: ${old || 'No registrado'} → ${next || 'No registrado'}`];
    }).join('\n');
  }
  async function show(item) {
    dialog.showModal(); detail.textContent = 'Cargando expediente…';
    const [photos,history] = await Promise.all([collectionRows('collection_photos',`&item_id=eq.${item.id}`),collectionHistory(item.id)]);
    detail.innerHTML = `<h2>${esc(item.accession_number)} · ${esc(item.title)}</h2><dl class="collection-facts">${[...base,...more].map(k => `<div><dt>${esc(labels[k])}</dt><dd>${esc(base.includes(k) ? item[k] : item.details?.[k]) || 'No registrado'}</dd></div>`).join('')}</dl><h3>Fotografías conservadas</h3><div class="collection-gallery">${photos.map(p=>`<figure><img data-photo="${p.id}" alt="Fotografía de ${esc(item.title)}" loading="lazy"><figcaption>${esc(p.caption || 'Sin descripción')} · ${esc(new Date(p.created_at).toLocaleString('es-PR'))}</figcaption></figure>`).join('') || '<p>Sin fotografías registradas.</p>'}</div><h3>Historial</h3><ol>${history.map(h => `<li><strong>${esc(h.action)}</strong> · ${esc(new Date(h.occurred_at).toLocaleString('es-PR'))}<p>${esc(h.reason)}</p><small>Responsable: ${esc(h.actor_name || h.actor_id)}</small><details><summary>Ver cambios conservados</summary><pre>${esc(historyChanges(h))}</pre></details></li>`).join('')}</ol><p><a href="inventario-colecciones.html?pieza=${item.id}">Enlace permanente del expediente</a></p>`;
    const permanent = new URL('inventario-colecciones.html', location.href);
    permanent.searchParams.set('pieza',item.id);
    if(museoEnvironment.name==='staging') permanent.searchParams.set('environment','staging');
    const qr = qrcode(0,'M'); qr.addData(permanent.href); qr.make();
    const code = document.createElement('figure');
    const image = document.createElement('img'); image.src=qr.createDataURL(4,16); image.alt='Código QR del expediente';
    const caption = document.createElement('figcaption'); caption.textContent='QR del expediente. Requiere acceso autorizado.';
    code.append(image,caption); detail.append(code);
    await Promise.all(photos.map(async p => {
      try { const url = await collectionPhotoUrl(p.path); const img = detail.querySelector(`[data-photo="${p.id}"]`); if(img) img.src = url; }
      catch { const img = detail.querySelector(`[data-photo="${p.id}"]`); if(img) img.replaceWith(document.createTextNode('No se pudo cargar esta fotografía. Cierre y vuelva a abrir el expediente.')); }
    }));
  }
  document.querySelector('#collection-new').hidden = !canWrite;
  document.querySelector('#collection-new').onclick = () => edit(null);
  document.querySelector('#collection-cancel').onclick = () => { if(!saving) reset(); };
  document.querySelector('#collection-close').onclick = () => dialog.close();
  document.querySelector('#collection-reload').onclick = () => reload().then(()=>say('Listado actualizado.')).catch(e=>say(e.message,true));
  search.oninput = render;
  list.onclick = event => {
    const view = event.target.closest('[data-piece-view]'), editButton = event.target.closest('[data-piece-edit]');
    const item = items.find(i => i.id === (view?.dataset.pieceView || editButton?.dataset.pieceEdit));
    if (item) { if(view) show(item).catch(e=>{detail.textContent=e.message;}); else edit(item); }
  };
  form.onsubmit = async event => {
    event.preventDefault(); if(saving || !canWrite || !form.reportValidity()) return;
    const file = form.elements.photo.files[0];
    if(file && (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>10485760 || !file.size)) {say('Seleccione una imagen JPG, PNG o WEBP de hasta 10 MB.',true); return;}
    const item = Object.fromEntries(base.map(k=>[k,form.elements[k].value.trim()]));
    item.details = Object.fromEntries(more.map(k=>[k,form.elements[k].value.trim()]));
    saving = true; const buttons = [...form.querySelectorAll('button')]; buttons.forEach(b=>b.disabled=true);
    let saved = false;
    try {
      editing = await collectionSave(item,editing,form.elements.reason.value.trim()); saved = true;
      if(file) editing = await collectionUpload(editing,file,form.elements.caption.value.trim());
      const savedId = editing.id; reset(); await reload(); say('Pieza guardada en Colecciones.');
      await show(items.find(i=>i.id===savedId));
    } catch(e) {
      say(`${saved ? 'La ficha está guardada; no se completó el paso posterior. No cree otra pieza. ' : ''}${e.message}`,true);
      if(saved) await reload().catch(()=>{});
    } finally {saving=false;buttons.forEach(b=>b.disabled=false);}
  };
  try {
    await reload(); say(canWrite ? 'Catálogo sincronizado. Puede registrar y editar piezas.' : 'Consulta del catálogo. Su cuenta no tiene permiso de edición.');
    const id = requestedCollectionId || sessionStorage.getItem(collectionReturnKey); sessionStorage.removeItem(collectionReturnKey);
    const item = items.find(i=>i.id===id); if(item) await show(item);
  } catch(e) {say(e.message,true); document.querySelector('#collection-new').disabled=true;}
}
