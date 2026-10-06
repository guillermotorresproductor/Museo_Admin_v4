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

function collectionCategoryLabel(value) {
  return value === 'Otro' ? 'Otros' : value;
}

function collectionFactVisible(item, key) {
  const expected = collectionConditionalFields[key];
  if (!expected) return true;
  return item?.category === expected || Boolean(String(item?.details?.[key] ?? '').trim());
}

function collectionComposeDimensions(parts) {
  const bits = [];
  const add = (label, value, unit) => {
    const number = String(value ?? '').trim();
    if (!number) return;
    bits.push(`${label}: ${number}${unit ? ` ${unit}` : ''}`);
  };
  add('Alto', parts.height, parts.height_unit);
  add('Ancho', parts.width, parts.width_unit);
  add('Profundidad', parts.depth, parts.depth_unit);
  add('Peso', parts.weight, parts.weight_unit);
  const other = String(parts.other_measurements ?? '').trim();
  if (other) bits.push(`Otras medidas: ${other}`);
  return bits.join('; ');
}

function collectionFieldValue(form, name) {
  return String(form.elements?.[name]?.value ?? '').trim();
}

function collectionMeasurePair(form, name, unitName) {
  const number = collectionFieldValue(form, name);
  if (!number) return { [name]: '', [unitName]: '' };
  return { [name]: number, [unitName]: collectionFieldValue(form, unitName) };
}

function collectionDirectAccession(form) {
  return {
    modality: 'catalogacion_directa',
    status: 'borrador',
    ...collectionMeasurePair(form, 'height', 'height_unit'),
    ...collectionMeasurePair(form, 'width', 'width_unit'),
    ...collectionMeasurePair(form, 'depth', 'depth_unit'),
    ...collectionMeasurePair(form, 'weight', 'weight_unit'),
    other_measurements: collectionFieldValue(form, 'other_measurements'),
    physical_condition: collectionFieldValue(form, 'physical_condition'),
    conservation_notes: collectionFieldValue(form, 'conservation_notes'),
    estimated_value: collectionFieldValue(form, 'fmv')
  };
}

const collectionPhotoRoles = Object.freeze({ 1: 'frontal', 2: 'posterior', 3: 'lateral', 4: 'adicional' });
const collectionModalityLabels = Object.freeze({
  catalogacion_directa: 'Catalogación directa',
  prestamo_temporal: 'Préstamo temporal',
  donacion_permanente: 'Donación permanente'
});
const collectionConditionOptions = Object.freeze(['Excelente', 'Buena', 'Regular', 'Mala', 'Requiere evaluación']);

function collectionDraftKey() {
  return `museo-collection-draft-${museoEnvironment.name}`;
}

function collectionReadDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(collectionDraftKey()) || 'null');
    if (!draft || typeof draft.fields !== 'object' || !draft.fields) return null;
    return draft;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function collectionWriteDraft(draft) {
  localStorage.setItem(collectionDraftKey(), JSON.stringify(draft));
}

function collectionClearDraft() {
  localStorage.removeItem(collectionDraftKey());
}

function collectionRecentPiece(row, now = Date.now()) {
  const updated = Date.parse(row?.updated_at || '');
  return Number.isFinite(updated) && now - updated >= 0 && now - updated < 120000;
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
  form.noValidate = true;
  const detail = document.querySelector('#collection-detail'), dialog = document.querySelector('#collection-dialog');
  const search = document.querySelector('#collection-search');
  let items = [], accessions = [], editing = null, saving = false, viewedItem = null, viewedQrDataUrl = '', createRequestId = null;
  const canWrite = canWriteCollections();
  const canReplacePhoto = hasPermission('collections.write');
  let replacingPhoto = false;
  const base = ['accession_number','title','description','category','location','condition','status'];
  const more = ['personal_object_description','object_type_specification','author','dating','materials','dimensions','provenance','owner','acquisition','custody','donor','owner_phone','owner_email','owner_address','lender','received_date','fmv','currency','loan_reference','notes','cultural_history'];
  const labels = {accession_number:'Número de inventario',title:'Nombre o título',description:'Descripción museográfica',category:'Clasificación',location:'Ubicación',condition:'Estado de conservación',status:'Estado del registro',personal_object_description:'Descripción del objeto personal',object_type_specification:'* Tipo de objeto',author:'Autor / fabricante',dating:'Época / fecha de creación',materials:'Material',dimensions:'Dimensiones',provenance:'Procedencia',owner:'Titularidad',acquisition:'Forma de ingreso / adquisición',custody:'Condición de custodia',donor:'Donante / propietario',lender:'Prestamista',received_date:'Fecha de ingreso',fmv:'Valor estimado (FMV)',currency:'Moneda',loan_reference:'Referencia de préstamo / documento',notes:'Observaciones / anotaciones',owner_phone:'Teléfono del donante / propietario',owner_email:'Email del donante / propietario',owner_address:'Dirección del donante / propietario',cultural_history:'Historia / valor cultural'};
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
  const draftFields = [...base, ...more, 'reason', 'caption', 'height', 'height_unit', 'width', 'width_unit', 'depth', 'depth_unit', 'weight', 'weight_unit', 'other_measurements', 'physical_condition', 'conservation_notes'];
  const draftNotice = document.querySelector('#collection-draft');
  const submitButton = form.querySelector('[type="submit"]');
  const submitLabel = submitButton.textContent;
  let draftTimer = 0;
  function fieldSnapshot() {
    return Object.fromEntries(draftFields.map(key => [key, form.elements[key]?.value ?? '']));
  }
  function photosSelected() {
    return photoSlotIds.some(n => form.elements[`photo_${n}`]?.files?.[0]);
  }
  function refreshDraftNotice() {
    if (draftNotice) draftNotice.hidden = !collectionReadDraft();
  }
  function rememberDraft() {
    if (!canWrite || saving) return;
    const existing = collectionReadDraft();
    const currentId = editing?.id || null;
    if (existing && (existing.collectionId || null) !== currentId) {
      refreshDraftNotice();
      return;
    }
    const fields = fieldSnapshot();
    const meaningful = Object.entries(fields).some(([key, value]) => {
      if (key === 'reason' && value === 'Registro inicial') return false;
      if (key === 'status' && value === 'ingreso') return false;
      if (key === 'currency' && value === 'USD') return false;
      return String(value).trim() !== '';
    });
    if (!meaningful && !existing?.collectionId) {
      if (existing) collectionClearDraft();
      refreshDraftNotice();
      return;
    }
    collectionWriteDraft({
      updatedAt: new Date().toISOString(),
      mode: currentId ? 'edit' : 'new',
      collectionId: currentId,
      version: editing?.version ?? null,
      accessionNumber: fields.accession_number || '',
      hadPhotos: photosSelected() || Boolean(existing?.hadPhotos && existing.collectionId === currentId),
      confirmed: Boolean(existing?.confirmed && existing.collectionId === currentId),
      fields
    });
    refreshDraftNotice();
  }
  function scheduleDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(rememberDraft, 400);
  }
  function markConfirmed(row) {
    editing = row;
    const fields = fieldSnapshot();
    collectionWriteDraft({
      updatedAt: new Date().toISOString(),
      mode: 'edit',
      collectionId: row.id,
      version: row.version,
      accessionNumber: row.accession_number || fields.accession_number || '',
      hadPhotos: photosSelected(),
      confirmed: true,
      fields
    });
    refreshDraftNotice();
  }
  function setBusy(busy) {
    saving = busy;
    submitButton.disabled = busy;
    submitButton.textContent = busy ? 'Guardando...' : submitLabel;
    form.querySelectorAll('button').forEach(button => { if (button !== submitButton) button.disabled = busy; });
  }
  function focusInvalid() {
    const invalid = [...form.elements].find(element => element.willValidate && !element.disabled && !element.checkValidity());
    if (!invalid) return true;
    const field = invalid.closest('label');
    if (field?.hidden) field.hidden = false;
    invalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    invalid.focus();
    const visible = field?.querySelector('span')?.textContent?.replace(/\s*\*\s*$/, '').trim();
    say(`Falta completar: ${visible || labels[invalid.name] || 'un campo obligatorio'}.`, true);
    return false;
  }
  async function adoptRecentPiece(accessionNumber) {
    const rows = await collectionRows('collection_items', `&accession_number=eq.${encodeURIComponent(accessionNumber)}`);
    return rows.find(row => row.accession_number === accessionNumber && collectionRecentPiece(row)) || null;
  }
  function restoreDraft() {
    const draft = collectionReadDraft();
    if (!draft || saving) return;
    const item = draft.collectionId
      ? (items.find(row => row.id === draft.collectionId) || { id: draft.collectionId, version: draft.version, accession_number: draft.accessionNumber, details: {} })
      : null;
    edit(item);
    syncingCategory = true;
    draftFields.forEach(key => { if (form.elements[key] && draft.fields[key] != null) form.elements[key].value = draft.fields[key]; });
    syncingCategory = false;
    applyCategoryFields();
    syncCatalogMode();
    if (draft.hadPhotos) say('El borrador fue recuperado. Por seguridad del navegador, deberá seleccionar nuevamente las fotografías.', true);
    else say('Se encontró un borrador sin guardar.');
  }
  function modalityOf(item) {
    const rows = accessions.filter(row => row.collection_item_id === item.id);
    rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return rows[0]?.modality || '';
  }
  function syncCatalogMode() {
    const isNew = !editing?.id;
    const knownCondition = !isNew && collectionConditionOptions.includes(editing.condition);
    const useConditionList = isNew || knownCondition;
    const auto = form.querySelector('[data-accession-auto]');
    const number = form.elements.accession_number;
    if (auto) auto.hidden = !isNew;
    if (number) {
      number.readOnly = true;
      number.required = false;
      number.hidden = isNew;
      number.value = isNew ? '' : (editing.accession_number || '');
    }
    form.querySelectorAll('[data-catalog-party]').forEach(field => { field.hidden = isNew; });
    const structured = form.querySelector('[data-catalog-dimensions]');
    const legacy = form.querySelector('[data-catalog-dimensions-legacy]');
    if (structured) structured.hidden = !isNew;
    if (legacy) legacy.hidden = isNew;
    const conditionList = form.querySelector('[data-catalog-condition-select]');
    const conditionText = form.querySelector('[data-catalog-condition-text]');
    const conservation = form.querySelector('[data-catalog-conservation]');
    if (conditionList) conditionList.hidden = !useConditionList;
    if (conditionText) conditionText.hidden = useConditionList;
    if (conservation) conservation.hidden = !isNew;
    if (form.elements.physical_condition) {
      form.elements.physical_condition.required = useConditionList;
      if (knownCondition && !form.elements.physical_condition.value) form.elements.physical_condition.value = editing.condition;
    }
    if (form.elements.condition) form.elements.condition.required = !useConditionList;
    if (isNew && form.elements.currency) form.elements.currency.value = 'USD';
    const currencyNote = form.querySelector('[data-currency-note]');
    if (currencyNote) currencyNote.textContent = isNew ? 'USD' : (editing?.details?.currency || 'USD');
    const currencyField = form.querySelector('[data-catalog-currency]');
    if (currencyField) currencyField.hidden = true;
  }
  function reset() {
    editing = null; createRequestId = null; syncingCategory = true; form.reset(); resetPhotoSlots(); syncingCategory = false; applyCategoryFields(); syncCatalogMode(); form.hidden = true;
    document.querySelector('#collection-form-title').textContent = 'Nuevo artículo';
  }
  function edit(item) {
    if (!canWrite || saving) return;
    editing = item;
    if (!item) createRequestId = null;
    syncingCategory = true; form.reset(); resetPhotoSlots();
    if (item) [...base,...more].forEach(key => { form.elements[key].value = base.includes(key) ? item[key] || '' : item.details?.[key] || ''; });
    form.elements.reason.value = item ? '' : 'Registro inicial';
    syncingCategory = false; applyCategoryFields(); syncCatalogMode();
    document.querySelector('#collection-form-title').textContent = item ? `Editar ${item.accession_number}` : 'Nuevo artículo';
    form.hidden = false; form.scrollIntoView({behavior:'smooth'}); form.elements.title.focus();
  }
  const modalityFilter = document.querySelector('#collection-modality-filter');
  function render() {
    const term = search.value.trim().toLocaleLowerCase('es');
    const mode = modalityFilter?.value || '';
    const selected = items.filter(i => {
      const modality = modalityOf(i);
      const modeOk = !mode || (mode === 'registro_anterior' ? !modality : modality === mode);
      const text = [i.accession_number,i.title,i.description,i.category,i.location,i.details?.donor,i.details?.lender,i.details?.personal_object_description,i.details?.object_type_specification].join(' ').toLocaleLowerCase('es');
      return modeOk && text.includes(term);
    });
    document.querySelector('#collection-count').textContent = `${selected.length} de ${items.length} piezas`;
    list.innerHTML = selected.length ? selected.map(i => {
      const label = collectionModalityLabels[modalityOf(i)] || 'Registro anterior';
      const accession = accessions.filter(row => row.collection_item_id === i.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
      const links = [];
      if (accession?.contract_snapshot) links.push(`<a class="button secondary" href="documento-ingreso.html?expediente=${encodeURIComponent(accession.id)}">Documento</a>`);
      if (accession?.modality === 'prestamo_temporal' && accession.status === 'recibido') links.push(`<a class="button secondary" href="ingreso-articulo.html?expediente=${encodeURIComponent(accession.id)}">Devolver pieza</a>`);
      else if (accession?.modality === 'prestamo_temporal' && accession.status === 'devuelto') links.push(`<a class="button secondary" href="ingreso-articulo.html?expediente=${encodeURIComponent(accession.id)}">Cerrar expediente</a>`);
      else if (accession && accession.modality !== 'catalogacion_directa' && ['borrador', 'pendiente_firmas', 'formalizado'].includes(accession.status)) {
        links.push(`<a class="button secondary" href="ingreso-articulo.html?expediente=${encodeURIComponent(accession.id)}">${accession.status === 'formalizado' ? 'Recepción' : 'Continuar ingreso'}</a>`);
      }
      const continueIntake = links.length ? ` ${links.join(' ')}` : '';
      return `<tr><td>${esc(i.accession_number)}</td><td>${esc(i.title)}</td><td>${esc(collectionCategoryLabel(i.category))}</td><td>${esc(label)}</td><td>${esc(i.location)}</td><td>${esc(i.condition)}</td><td><button class="button secondary" data-piece-view="${i.id}">Ver expediente</button>${canWrite ? ` <button class="button secondary" data-piece-edit="${i.id}">Editar</button>` : ''}${continueIntake}</td></tr>`;
    }).join('') : '<tr><td colspan="7">No hay piezas que coincidan con la búsqueda.</td></tr>';
  }
  async function reload() {
    const [nextItems, nextAccessions] = await Promise.all([
      collectionRows('collection_items'),
      collectionRows('collection_accessions')
    ]);
    items = nextItems;
    accessions = nextAccessions;
    render();
  }
  function historyChanges(h) {
    if(h.action === 'sustitucion_fotografia') return `Fotografía anterior (sustituida, conservada): ${h.before_value.path}\nNueva fotografía: ${h.after_value.path}`;
    if(h.action === 'fotografia') return h.after_value.caption || 'Fotografía añadida al expediente.';
    return [...base,...more].flatMap(k => {
      const old = base.includes(k) ? h.before_value?.[k] : h.before_value?.details?.[k];
      const next = base.includes(k) ? h.after_value?.[k] : h.after_value?.details?.[k];
      return old === next ? [] : [`${labels[k]}: ${old || 'No registrado'} → ${next || 'No registrado'}`];
    }).join('\n');
  }
  function printCollectionList() {
    const sheet = document.createElement('section');
    sheet.className = 'collection-print-list';
    sheet.setAttribute('aria-hidden', 'true');
    const printedAt = new Date().toLocaleString('es-PR', { dateStyle: 'long', timeStyle: 'short' });
    const rows = items.map(item => `<tr><td>${esc(item.accession_number)}</td><td>${esc(item.title)}</td></tr>`).join('');
    sheet.innerHTML = `<header><p>MUSEO DE LA MÚSICA DE PUERTO RICO</p><h1>INVENTARIO DE COLECCIONES</h1><p>Fecha de impresión: ${esc(printedAt)}</p><p>Total de piezas: ${items.length}</p></header><table><thead><tr><th>NÚMERO</th><th>PIEZA / NOMBRE</th></tr></thead><tbody>${rows}</tbody></table>`;
    document.body.append(sheet);
    document.body.classList.add('collection-list-printing');
    const cleanup = () => { document.body.classList.remove('collection-list-printing'); sheet.remove(); };
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(() => { if (document.body.contains(sheet)) cleanup(); }, 3000);
  }
  function printLabel() {
    if (!viewedItem || !viewedQrDataUrl) return;
    const label = document.createElement('section');
    label.className = 'collection-print-label';
    label.setAttribute('aria-hidden','true');
    label.innerHTML = `<h1>Museo de la Música de Puerto Rico</h1><p><strong>N.º de inventario:</strong> ${esc(viewedItem.accession_number)}</p><p><strong>Pieza:</strong> ${esc(viewedItem.title)}</p><p><strong>Clasificación:</strong> ${esc(collectionCategoryLabel(viewedItem.category))}</p><img src="${viewedQrDataUrl}" alt=""><p>Escanear para expediente interno</p>`;
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
    if (!dialog.open) dialog.showModal(); detail.textContent = 'Cargando expediente…';
    const [photos,history] = await Promise.all([collectionRows('collection_active_photos',`&item_id=eq.${item.id}`),collectionHistory(item.id)]);
    const intakeLabel = collectionModalityLabels[modalityOf(item)] || 'Registro anterior';
    const accessionRow = accessions.filter(row => row.collection_item_id === item.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    const intakeLink = accessionRow && accessionRow.modality !== 'catalogacion_directa'
      ? `<p>${accessionRow.contract_snapshot ? `<a href="documento-ingreso.html?expediente=${encodeURIComponent(accessionRow.id)}">Documento contractual</a>` : `<a href="ingreso-articulo.html?expediente=${encodeURIComponent(accessionRow.id)}">Continuar ingreso</a>`}${accessionRow.modality === 'prestamo_temporal' && accessionRow.status === 'recibido' ? ` · <a href="ingreso-articulo.html?expediente=${encodeURIComponent(accessionRow.id)}">Devolver pieza</a>` : ''}</p>`
      : '';
    detail.innerHTML = `<h2>${esc(item.accession_number)} · ${esc(item.title)}</h2><p>Alta: ${esc(intakeLabel)}</p><dl class="collection-facts">${[...base,...more].filter(k => collectionFactVisible(item, k)).map(k => `<div><dt>${esc(labels[k])}</dt><dd>${esc(k === 'category' ? collectionCategoryLabel(item.category) : (base.includes(k) ? item[k] : item.details?.[k])) || 'No registrado'}</dd></div>`).join('')}</dl>${intakeLink}<h3>Fotografías conservadas</h3><div class="collection-gallery">${photos.map(p=>`<figure><img data-photo="${p.id}" alt="Fotografía de ${esc(item.title)}" loading="lazy"><figcaption>${esc(p.caption || 'Sin descripción')} · ${esc(new Date(p.created_at).toLocaleString('es-PR'))}</figcaption></figure>`).join('') || '<p>Sin fotografías registradas.</p>'}</div><h3>Historial</h3><ol>${history.map(h => `<li><strong>${esc(h.action === 'sustitucion_fotografia' ? 'Sustitución de fotografía' : h.action)}</strong> · ${esc(new Date(h.occurred_at).toLocaleString('es-PR'))}<p>${esc(h.reason)}</p><small>Responsable: ${esc(h.actor_name || h.actor_id)}</small><details><summary>Ver cambios conservados</summary><pre>${esc(historyChanges(h))}</pre></details></li>`).join('')}</ol><p><a href="inventario-colecciones.html?pieza=${item.id}">Enlace permanente del expediente</a></p>`;
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
  form.addEventListener('input', scheduleDraft);
  form.addEventListener('change', event => {
    const n = Number(event.target?.name?.match(/^photo_([1-4])$/)?.[1]);
    if (n) renderPhotoSlot(n);
    scheduleDraft();
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
  const intakeLink = document.querySelector('#collection-intake');
  if (intakeLink) intakeLink.hidden = !canWrite;
  document.querySelector('#collection-new').hidden = !canWrite;
  document.querySelector('#collection-new').onclick = () => edit(null);
  document.querySelector('#collection-cancel').onclick = () => { if(!saving) reset(); };
  document.querySelector('#collection-close').onclick = () => { if(!replacingPhoto) dialog.close(); };
  dialog.addEventListener('cancel', event => { if(replacingPhoto) event.preventDefault(); });
  document.querySelector('#collection-print-label').onclick = printLabel;
  document.querySelector('#collection-print-list').onclick = printCollectionList;
  document.querySelector('#collection-reload').onclick = () => reload().then(()=>say('Listado actualizado.')).catch(e=>say(e.message,true));
  search.oninput = render;
  if (modalityFilter) modalityFilter.onchange = render;
  list.onclick = event => {
    const view = event.target.closest('[data-piece-view]'), editButton = event.target.closest('[data-piece-edit]');
    const item = items.find(i => i.id === (view?.dataset.pieceView || editButton?.dataset.pieceEdit));
    if (item) { if(view) show(item).catch(e=>{detail.textContent=e.message;}); else edit(item); }
  };
  document.querySelector('#collection-draft-restore').onclick = restoreDraft;
  document.querySelector('#collection-draft-discard').onclick = () => {
    if (saving) return;
    collectionClearDraft();
    refreshDraftNotice();
  };
  window.addEventListener('beforeunload', event => {
    if (!collectionReadDraft()) return;
    event.preventDefault();
    event.returnValue = '';
  });
  form.onsubmit = async event => {
    event.preventDefault();
    if (saving || !canWrite) return;
    if (!focusInvalid()) return;
    const slots = photoSlotIds.map(n => ({ n, file: form.elements[`photo_${n}`]?.files?.[0] })).filter(slot => slot.file);
    if (slots.length > 4) { say('Puede seleccionar un máximo de 4 fotografías.', true); return; }
    rememberDraft();
    const item = Object.fromEntries(base.map(key => [key, form.elements[key].value.trim()]));
    item.details = collectionDetailsPayload(item.category, more, Object.fromEntries(more.map(key => [key, form.elements[key].value.trim()])), editing?.details);
    const reason = form.elements.reason.value.trim();
    setBusy(true);
    say('Guardando...');
    let saved = false, uploaded = 0, failedSlot = null, photoFailed = false;
    try {
      for (const slot of slots) await collectionValidatePhoto(slot.file);
      if (slots.length && editing?.id) {
        const existingPhotos = await collectionRows('collection_active_photos', `&item_id=eq.${editing.id}`);
        if (existingPhotos.length + slots.length > 4) { say(`Esta pieza ya tiene ${existingPhotos.length} fotografía(s). El máximo total es 4.`, true); return; }
      }
      if (!editing?.id) {
        const conditionList = form.querySelector('[data-catalog-condition-select]');
        if (conditionList && !conditionList.hidden && form.elements.physical_condition) item.condition = form.elements.physical_condition.value.trim();
        const composed = collectionComposeDimensions({
          height: form.elements.height?.value, height_unit: form.elements.height_unit?.value,
          width: form.elements.width?.value, width_unit: form.elements.width_unit?.value,
          depth: form.elements.depth?.value, depth_unit: form.elements.depth_unit?.value,
          weight: form.elements.weight?.value, weight_unit: form.elements.weight_unit?.value,
          other_measurements: form.elements.other_measurements?.value
        });
        if (composed) item.details.dimensions = composed;
        delete item.accession_number;
        if (!createRequestId) createRequestId = crypto.randomUUID();
        let created;
        try {
          created = await collectionCreateEntry(item, collectionDirectAccession(form), reason, createRequestId);
        } catch (error) {
          if (!error.timeout) throw error;
          created = await collectionCreateEntry(item, collectionDirectAccession(form), reason, createRequestId);
        }
        editing = created.item;
        if (!editing?.id) throw new Error('No se pudo confirmar la pieza creada.');
      } else {
        item.accession_number = editing.accession_number;
        const conditionList = form.querySelector('[data-catalog-condition-select]');
        if (conditionList && !conditionList.hidden && form.elements.physical_condition) item.condition = form.elements.physical_condition.value.trim();
        editing = await collectionSave(item, editing, reason);
      }
      markConfirmed(editing);
      saved = true;
      for (const slot of slots) {
        failedSlot = slot.n;
        try {
          editing = await collectionUpload(editing, slot.file, form.elements.caption.value.trim(), collectionPhotoRoles[slot.n]);
        } catch (error) {
          photoFailed = true;
          throw error;
        }
        markConfirmed(editing);
        uploaded += 1;
        const input = form.elements[`photo_${slot.n}`];
        if (input) input.value = '';
        renderPhotoSlot(slot.n);
        failedSlot = null;
      }
      const savedId = editing.id;
      await reload();
      const recognized = items.find(row => row.id === savedId);
      if (!recognized) throw new Error('La ficha fue guardada, pero no apareció en el listado.');
      await show(recognized);
      collectionClearDraft();
      refreshDraftNotice();
      reset();
      say('Guardado correctamente.');
    } catch (error) {
      console.error(error);
      if (photoFailed) say('La ficha fue guardada, pero una fotografía no pudo adjuntarse.', true);
      else if (saved) say('La ficha fue guardada, pero no se pudo confirmar en el listado. Sus datos permanecen en este formulario.', true);
      else say(error.message || 'No se pudo completar el guardado. Sus datos permanecen en este formulario.', true);
      if (saved) await reload().catch(reloadError => console.error(reloadError));
    } finally { setBusy(false); }
  };
  try {
    await reload(); say(canWrite ? 'Catálogo sincronizado. Puede registrar y editar piezas.' : 'Consulta del catálogo. Su cuenta no tiene permiso de edición.');
    refreshDraftNotice();
    const id = requestedCollectionId || sessionStorage.getItem(collectionReturnKey); sessionStorage.removeItem(collectionReturnKey);
    const item = items.find(i => i.id === id); if (item) await show(item);
  } catch (e) { say(e.message, true); document.querySelector('#collection-new').disabled = true; }
}
