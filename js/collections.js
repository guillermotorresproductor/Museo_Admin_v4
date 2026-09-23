const collectionConditionalFields = Object.freeze({
  personal_object_description: 'Objeto personal',
  object_type_specification: 'Otro'
});

function collectionConditionalDetail(category, key, typed, saved) {
  if (category === collectionConditionalFields[key]) return String(typed ?? '').trim();
  return String(saved ?? '').trim();
}

function collectionDetailsPayload(category, keys, values, saved) {
  const details = {};
  for (const key of keys) {
    if (Object.hasOwn(collectionConditionalFields, key)) {
      const value = collectionConditionalDetail(category, key, values[key], saved?.[key]);
      if (category === collectionConditionalFields[key] || value) details[key] = value;
    } else details[key] = String(values[key] ?? '').trim();
  }
  return details;
}

function collectionFactVisible(item, key) {
  const expected = collectionConditionalFields[key];
  if (!expected) return true;
  return item?.category === expected || Boolean(String(item?.details?.[key] ?? '').trim());
}

function syncCollectionCategoryFields(form, saved) {
  const category = form.elements.category?.value || '';
  for (const [key, expected] of Object.entries(collectionConditionalFields)) {
    const input = form.elements[key];
    if (!input) continue;
    const visible = category === expected;
    if (!visible) input.value = String(saved?.[key] ?? '').trim();
    input.required = visible;
    const field = input.closest?.('label');
    if (field) field.hidden = !visible;
  }
}

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
  let items = [], editing = null, saving = false, viewedItem = null, viewedQrDataUrl = '';
  const canWrite = canWriteCollections();
  const canReplacePhoto = hasPermission('collections.write');
  let replacingPhoto = false;
  const base = ['accession_number','title','description','category','location','condition','status'];
  const more = ['personal_object_description','object_type_specification','author','dating','materials','dimensions','provenance','owner','acquisition','custody','donor','owner_phone','owner_email','owner_address','lender','received_date','fmv','currency','loan_reference','notes','cultural_history'];
  const labels = {accession_number:'Número de inventario',title:'Nombre o título',description:'Descripción museográfica',category:'Clasificación',location:'Ubicación',condition:'Estado de conservación',status:'Estado del registro',personal_object_description:'Descripción del objeto personal',object_type_specification:'Especifique el tipo de objeto',author:'Autor / fabricante',dating:'Época / fecha de creación',materials:'Material',dimensions:'Dimensiones',provenance:'Procedencia',owner:'Titularidad',acquisition:'Forma de ingreso / adquisición',custody:'Condición de custodia',donor:'Donante / propietario',lender:'Prestamista',received_date:'Fecha de ingreso',fmv:'Valor estimado (FMV)',currency:'Moneda',loan_reference:'Referencia de préstamo / documento',notes:'Observaciones / anotaciones',owner_phone:'Teléfono del donante / propietario',owner_email:'Email del donante / propietario',owner_address:'Dirección del donante / propietario',cultural_history:'Historia / valor cultural'};
  const say = (text, error = false) => { status.textContent = text; status.className = `form-message ${error ? 'error' : 'success'}`; };
  const esc = value => safeHtml(String(value ?? ''));
  const photoSlotIds = [1, 2, 3, 4];
  const photoPreviewUrls = {};
  function revokePhotoPreview(n) {
    if (photoPreviewUrls[n]) { URL.revokeObjectURL(photoPreviewUrls[n]); delete photoPreviewUrls[n]; }
  }
  function renderPhotoSlot(n) {
    const file = form.elements[`photo_${n}`]?.files?.[0];
    const preview = form.querySelector(`[data-photo-preview="${n}"]`);
    const filename = form.querySelector(`[data-photo-filename="${n}"]`);
    const clear = form.querySelector(`[data-photo-clear="${n}"]`);
    revokePhotoPreview(n);
    if (filename) filename.textContent = file ? file.name : 'Ninguna seleccionada';
    if (clear) clear.hidden = !file;
    if (!preview) return;
    if (!file) { preview.removeAttribute('src'); preview.hidden = true; return; }
    photoPreviewUrls[n] = URL.createObjectURL(file);
    preview.src = photoPreviewUrls[n];
    preview.hidden = false;
  }
  function resetPhotoSlots() { photoSlotIds.forEach(renderPhotoSlot); }
  let syncingCategory = false;
  function applyCategoryFields() {
    if (!syncingCategory) syncCollectionCategoryFields(form, editing?.details);
  }
  function reset() {
    editing = null; syncingCategory = true; form.reset(); resetPhotoSlots(); syncingCategory = false; applyCategoryFields(); form.hidden = true;
    document.querySelector('#collection-form-title').textContent = 'Registrar pieza';
  }
  function edit(item) {
    if (!canWrite || saving) return;
    editing = item; syncingCategory = true; form.reset(); resetPhotoSlots();
    if (item) [...base,...more].forEach(key => { form.elements[key].value = base.includes(key) ? item[key] || '' : item.details?.[key] || ''; });
    form.elements.reason.value = item ? '' : 'Registro inicial';
    syncingCategory = false; applyCategoryFields();
    document.querySelector('#collection-form-title').textContent = item ? `Editar ${item.accession_number}` : 'Registrar pieza';
    form.hidden = false; form.scrollIntoView({behavior:'smooth'}); form.elements.title.focus();
  }
  function render() {
    const term = search.value.trim().toLocaleLowerCase('es');
    const selected = items.filter(i => [i.accession_number,i.title,i.description,i.category,i.location,i.details?.donor,i.details?.lender,i.details?.personal_object_description,i.details?.object_type_specification].join(' ').toLocaleLowerCase('es').includes(term));
    document.querySelector('#collection-count').textContent = `${selected.length} de ${items.length} piezas`;
    list.innerHTML = selected.length ? selected.map(i => `<tr><td>${esc(i.accession_number)}</td><td>${esc(i.title)}</td><td>${esc(i.category)}</td><td>${esc(i.location)}</td><td>${esc(i.condition)}</td><td><button class="button secondary" data-piece-view="${i.id}">Ver expediente</button>${canWrite ? ` <button class="button secondary" data-piece-edit="${i.id}">Editar</button>` : ''}</td></tr>`).join('') : '<tr><td colspan="6">No hay piezas que coincidan con la búsqueda.</td></tr>';
  }
  async function reload() { items = await collectionRows('collection_items'); render(); }
  function historyChanges(h) {
    if(h.action === 'sustitucion_fotografia') return `Fotografía anterior (sustituida, conservada): ${h.before_value.path}\nNueva fotografía: ${h.after_value.path}`;
    if(h.action === 'fotografia') return h.after_value.caption || 'Fotografía añadida al expediente.';
    return [...base,...more].flatMap(k => {
      const old = base.includes(k) ? h.before_value?.[k] : h.before_value?.details?.[k];
      const next = base.includes(k) ? h.after_value?.[k] : h.after_value?.details?.[k];
      return old === next ? [] : [`${labels[k]}: ${old || 'No registrado'} → ${next || 'No registrado'}`];
    }).join('\n');
  }
  function printLabel() {
    if (!viewedItem || !viewedQrDataUrl) return;
    const label = document.createElement('section');
    label.className = 'collection-print-label';
    label.setAttribute('aria-hidden','true');
    label.innerHTML = `<h1>Museo de la Música de Puerto Rico</h1><p><strong>N.º de inventario:</strong> ${esc(viewedItem.accession_number)}</p><p><strong>Pieza:</strong> ${esc(viewedItem.title)}</p><p><strong>Clasificación:</strong> ${esc(viewedItem.category)}</p><img src="${viewedQrDataUrl}" alt=""><p>Escanear para expediente interno</p>`;
    document.body.append(label);
    document.body.classList.add('collection-label-printing');
    const cleanup = () => { document.body.classList.remove('collection-label-printing'); label.remove(); };
    window.addEventListener('afterprint', cleanup, {once:true});
    window.print();
    window.setTimeout(() => { if(document.body.contains(label)) cleanup(); }, 3000);
  }
  async function show(item) {
    viewedItem = item; viewedQrDataUrl = '';
    const printButton = document.querySelector('#collection-print-label'); if(printButton) printButton.disabled = true;
    dialog.showModal(); detail.textContent = 'Cargando expediente…';
    const [photos,history] = await Promise.all([collectionRows('collection_active_photos',`&item_id=eq.${item.id}`),collectionHistory(item.id)]);
    detail.innerHTML = `<h2>${esc(item.accession_number)} · ${esc(item.title)}</h2><dl class="collection-facts">${[...base,...more].filter(k => collectionFactVisible(item, k)).map(k => `<div><dt>${esc(labels[k])}</dt><dd>${esc(base.includes(k) ? item[k] : item.details?.[k]) || 'No registrado'}</dd></div>`).join('')}</dl><h3>Fotografías conservadas</h3><div class="collection-gallery">${photos.map(p=>`<figure><img data-photo="${p.id}" alt="Fotografía de ${esc(item.title)}" loading="lazy"><figcaption>${esc(p.caption || 'Sin descripción')} · ${esc(new Date(p.created_at).toLocaleString('es-PR'))}</figcaption></figure>`).join('') || '<p>Sin fotografías registradas.</p>'}</div><h3>Historial</h3><ol>${history.map(h => `<li><strong>${esc(h.action === 'sustitucion_fotografia' ? 'Sustitución de fotografía' : h.action)}</strong> · ${esc(new Date(h.occurred_at).toLocaleString('es-PR'))}<p>${esc(h.reason)}</p><small>Responsable: ${esc(h.actor_name || h.actor_id)}</small><details><summary>Ver cambios conservados</summary><pre>${esc(historyChanges(h))}</pre></details></li>`).join('')}</ol><p><a href="inventario-colecciones.html?pieza=${item.id}">Enlace permanente del expediente</a></p>`;
    if(canReplacePhoto) photos.forEach(photo => {
      const figure = detail.querySelector(`[data-photo="${photo.id}"]`).closest('figure');
      const replaceButton = document.createElement('button');
      replaceButton.type = 'button'; replaceButton.className = 'button secondary';
      replaceButton.textContent = 'Sustituir fotografía inválida';
      const replacementForm = document.createElement('form');
      replacementForm.className = 'collection-photo-replacement'; replacementForm.hidden = true;
      replacementForm.innerHTML = '<p>Esta acción conservará la fotografía anterior en el historial y cargará una nueva fotografía válida. La fotografía anterior no será eliminada.</p><label class="field"><span>Razón de sustitución *</span><select name="reason" required><option value="">Seleccione una razón</option><option value="Archivo inválido o corrupto">Archivo inválido o corrupto</option></select></label><label class="field"><span>Fotografía correcta (JPG, PNG o WEBP, hasta 10 MB) *</span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required></label><p role="status" aria-live="polite"></p><button class="button" type="submit">Confirmar sustitución</button> <button class="button secondary" type="button" data-cancel-replacement>Cancelar</button>';
      replaceButton.onclick = () => { if(replacingPhoto) return; replacementForm.hidden = false; replaceButton.hidden = true; replacementForm.elements.reason.focus(); };
      replacementForm.querySelector('[data-cancel-replacement]').onclick = () => { if(replacingPhoto) return; replacementForm.reset(); replacementForm.hidden = true; replaceButton.hidden = false; };
      replacementForm.onsubmit = async event => {
        event.preventDefault();
        if(replacingPhoto || !canReplacePhoto || !replacementForm.reportValidity()) return;
        const message = replacementForm.querySelector('[role="status"]');
        const controls = [...replacementForm.querySelectorAll('input,select,button')];
        const file = replacementForm.elements.photo.files[0], reason = replacementForm.elements.reason.value;
        replacingPhoto = true; controls.forEach(control => control.disabled = true); message.textContent = 'Validando y sustituyendo fotografía…';
        let replaced = false;
        try {
          const updated = await collectionReplacePhoto(item, photo, file, reason); replaced = true;
          await reload(); await show(updated);
          const success = document.createElement('p'); success.setAttribute('role','status');
          success.textContent = 'Fotografía sustituida correctamente. La referencia anterior se conserva en el historial.';
          detail.prepend(success);
        } catch(error) {
          message.textContent = replaced ? 'La sustitución se guardó. Cierre y vuelva a abrir el expediente para verla; no repita la operación.' : error.message;
        } finally { replacingPhoto = false; controls.forEach(control => control.disabled = replaced); }
      };
      figure.append(replaceButton, replacementForm);
    });
    const permanent = new URL('inventario-colecciones.html', location.href);
    permanent.searchParams.set('pieza',item.id);
    if(museoEnvironment.name==='staging') permanent.searchParams.set('environment','staging');
    const qr = qrcode(0,'M'); qr.addData(permanent.href); qr.make();
    viewedQrDataUrl = qr.createDataURL(4,16);
    const code = document.createElement('figure'); code.className = 'collection-qr';
    const image = document.createElement('img'); image.src=viewedQrDataUrl; image.alt='Código QR del expediente';
    const caption = document.createElement('figcaption'); caption.textContent='QR del expediente. Requiere acceso autorizado.';
    code.append(image,caption); detail.append(code);
    if(printButton) printButton.disabled = false;
    await Promise.all(photos.map(async p => {
      try { const img = detail.querySelector(`[data-photo="${p.id}"]`); if(img) await collectionLoadPhoto(img,p.path); }
      catch { const img = detail.querySelector(`[data-photo="${p.id}"]`); if(img) img.replaceWith(document.createTextNode('No se pudo cargar esta fotografía. Cierre y vuelva a abrir el expediente.')); }
    }));
  }
  form.elements.category.addEventListener('change', applyCategoryFields);
  form.addEventListener('change', event => {
    const n = Number(event.target?.name?.match(/^photo_([1-4])$/)?.[1]);
    if (n) renderPhotoSlot(n);
  });
  form.addEventListener('click', event => {
    const pick = Number(event.target.closest('[data-photo-pick]')?.dataset.photoPick);
    if (pick && !saving) { form.elements[`photo_${pick}`]?.click(); return; }
    const n = Number(event.target.closest('[data-photo-clear]')?.dataset.photoClear);
    if (!n || saving) return;
    const input = form.elements[`photo_${n}`];
    if (input) input.value = '';
    renderPhotoSlot(n);
  });
  document.querySelector('#collection-new').hidden = !canWrite;
  document.querySelector('#collection-new').onclick = () => edit(null);
  document.querySelector('#collection-cancel').onclick = () => { if(!saving) reset(); };
  document.querySelector('#collection-close').onclick = () => { if(!replacingPhoto) dialog.close(); };
  dialog.addEventListener('cancel', event => { if(replacingPhoto) event.preventDefault(); });
  document.querySelector('#collection-print-label').onclick = printLabel;
  document.querySelector('#collection-reload').onclick = () => reload().then(()=>say('Listado actualizado.')).catch(e=>say(e.message,true));
  search.oninput = render;
  list.onclick = event => {
    const view = event.target.closest('[data-piece-view]'), editButton = event.target.closest('[data-piece-edit]');
    const item = items.find(i => i.id === (view?.dataset.pieceView || editButton?.dataset.pieceEdit));
    if (item) { if(view) show(item).catch(e=>{detail.textContent=e.message;}); else edit(item); }
  };
  form.onsubmit = async event => {
    event.preventDefault(); if(saving || !canWrite || !form.reportValidity()) return;
    const slots = photoSlotIds.map(n => ({ n, file: form.elements[`photo_${n}`]?.files?.[0] })).filter(slot => slot.file);
    if(slots.length > 4) {say('Puede seleccionar un máximo de 4 fotografías.',true); return;}
    const item = Object.fromEntries(base.map(k=>[k,form.elements[k].value.trim()]));
    item.details = collectionDetailsPayload(item.category, more, Object.fromEntries(more.map(k => [k, form.elements[k].value.trim()])), editing?.details);
    saving = true; const buttons = [...form.querySelectorAll('button')]; buttons.forEach(b=>b.disabled=true);
    let saved = false, uploaded = 0, failedSlot = null;
    try {
      for (const slot of slots) await collectionValidatePhoto(slot.file);
      if(slots.length) {
        const existingPhotos = editing ? await collectionRows('collection_active_photos',`&item_id=eq.${editing.id}`) : [];
        if(existingPhotos.length + slots.length > 4) {say(`Esta pieza ya tiene ${existingPhotos.length} fotografía(s). El máximo total es 4.`,true); return;}
      }
      editing = await collectionSave(item,editing,form.elements.reason.value.trim()); saved = true;
      for (const slot of slots) {
        failedSlot = slot.n;
        editing = await collectionUpload(editing,slot.file,form.elements.caption.value.trim());
        uploaded += 1;
        const input = form.elements[`photo_${slot.n}`];
        if (input) input.value = '';
        renderPhotoSlot(slot.n);
        failedSlot = null;
      }
      const savedId = editing.id; reset(); await reload(); say('Pieza guardada en Colecciones.');
      await show(items.find(i=>i.id===savedId));
    } catch(e) {
      const photoNote = failedSlot ? ` La fotografía ${failedSlot} no se adjuntó${uploaded ? `; se conservaron ${uploaded}.` : '.'}` : '';
      say(`${saved ? 'La ficha está guardada; no cree otra pieza.' : ''}${photoNote} ${e.message}`.trim(),true);
      if(saved) await reload().catch(()=>{});
    } finally {saving=false;buttons.forEach(b=>b.disabled=false);}
  };
  try {
    await reload(); say(canWrite ? 'Catálogo sincronizado. Puede registrar y editar piezas.' : 'Consulta del catálogo. Su cuenta no tiene permiso de edición.');
    const id = requestedCollectionId || sessionStorage.getItem(collectionReturnKey); sessionStorage.removeItem(collectionReturnKey);
    const item = items.find(i=>i.id===id); if(item) await show(item);
  } catch(e) {say(e.message,true); document.querySelector('#collection-new').disabled=true;}
}
