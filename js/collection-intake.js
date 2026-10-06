const intakeAttachmentKinds = Object.freeze([
  ['inventario_adicional', 'Inventario adicional'],
  ['seguro', 'Evidencia de seguro'],
  ['tasacion', 'Documento de tasación o valoración'],
  ['otro', 'Otros']
]);
const collectionContractAcceptance = 'Mediante la firma del presente formulario, las partes reconocen y aceptan las condiciones aquí establecidas.';
const collectionReceptionCertification = 'Certifico que la información contenida en este formulario es correcta y que la pieza fue recibida conforme a las condiciones descritas.';
const intakeStatusLabels = Object.freeze({
  borrador: 'Borrador',
  pendiente_firmas: 'Pendiente de firmas',
  formalizado: 'Formalizado',
  recibido: 'Recibido',
  devuelto: 'Devuelto',
  cerrado: 'Cerrado'
});

function intakeRequestKey() {
  return `museo-intake-request-${museoEnvironment.name}`;
}

function intakeUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function readIntakePending() {
  const raw = sessionStorage.getItem(intakeRequestKey());
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.requestId === 'string') return parsed;
  } catch (error) {
    // Phase 2 stored the request id as plain text.
  }
  return { requestId: raw };
}

function writeIntakePending(value) {
  sessionStorage.setItem(intakeRequestKey(), JSON.stringify(value));
}

function collectionIntakeAccession(form) {
  const modality = collectionFieldValue(form, 'modality');
  const purposes = [...form.querySelectorAll('input[name="purpose"]:checked')].map(input => input.value);
  const accession = {
    modality,
    status: 'borrador',
    ...collectionMeasurePair(form, 'height', 'height_unit'),
    ...collectionMeasurePair(form, 'width', 'width_unit'),
    ...collectionMeasurePair(form, 'depth', 'depth_unit'),
    ...collectionMeasurePair(form, 'weight', 'weight_unit'),
    other_measurements: collectionFieldValue(form, 'other_measurements'),
    physical_condition: collectionFieldValue(form, 'physical_condition'),
    conservation_notes: collectionFieldValue(form, 'conservation_notes'),
    estimated_value: collectionFieldValue(form, 'fmv'),
    purposes,
    party_name: collectionFieldValue(form, 'party_name'),
    party_entity: collectionFieldValue(form, 'party_entity'),
    party_email: collectionFieldValue(form, 'party_email'),
    party_phone: collectionFieldValue(form, 'party_phone'),
    party_address: collectionFieldValue(form, 'party_address')
  };
  if (modality === 'prestamo_temporal') {
    accession.started_on = collectionFieldValue(form, 'started_on');
    accession.expected_return_on = collectionFieldValue(form, 'expected_return_on');
    accession.purpose_details = collectionFieldValue(form, 'purpose_details');
    accession.activity_name = collectionFieldValue(form, 'activity_name');
    accession.activity_on = collectionFieldValue(form, 'activity_on');
    accession.activity_location = collectionFieldValue(form, 'activity_location');
  } else if (modality === 'donacion_permanente') {
    accession.started_on = collectionFieldValue(form, 'donation_on');
    accession.purposes = [];
  }
  return accession;
}

function bindCollectionIntake() {
  const form = document.querySelector('#collection-intake-form');
  const canWrite = typeof canWriteCollections === 'function' && canWriteCollections();
  const canDirect = typeof canSignCollectionDirector === 'function' && canSignCollectionDirector();
  if (!form || (!canWrite && !canDirect)) return;
  const status = document.querySelector('#intake-message');
  const say = (text, error = false) => { status.textContent = text; status.className = `form-message ${error ? 'error' : 'success'}`; };
  const photoNote = document.querySelector('#intake-photo-note');
  const attachments = document.querySelector('#intake-attachments');
  const pendingNote = document.querySelector('#intake-pending');
  const partySignature = new SignatureCapture(document.querySelector('[data-signature-capture]'), { signerRole: 'propietario' });
  const directorSignature = canDirect ? new SignatureCapture(document.querySelector('[data-signature-director]'), { signerRole: 'director' }) : null;
  const receptionSignature = new SignatureCapture(document.querySelector('[data-signature-reception]'), { signerRole: 'receptor' });
  const returnSignature = new SignatureCapture(document.querySelector('[data-signature-return]'), { signerRole: 'receptor_devolucion' });
  let saving = false;
  let created = null;
  let clean = true;
  let contractSigned = false;
  const photoPreviewUrls = {};
  const photoSlotState = {};
  form.noValidate = true;
  form.elements.reason.value = 'Registro inicial';
  document.querySelector('#intake-terms').textContent = collectionContractAcceptance;
  document.querySelector('#intake-reception-terms').textContent = collectionReceptionCertification;
  document.querySelector('[data-director-sign]').hidden = !canDirect;
  document.querySelector('[data-received-by]').textContent = localStorage.getItem('museo-admin-current-user') || 'Usuario autenticado';
  if (!canWrite) {
    document.querySelector('#intake-save').hidden = true;
    document.querySelector('#intake-formalize').hidden = true;
    document.querySelector('#intake-sign-party').hidden = true;
    document.querySelector('#intake-receive').hidden = true;
  }

  function requestId() {
    const pending = readIntakePending();
    if (pending?.requestId && intakeUuid(pending.requestId)) return pending.requestId;
    const next = crypto.randomUUID();
    writeIntakePending({ requestId: next });
    return next;
  }
  function setRequired(name, required) {
    const field = form.elements[name];
    if (field) field.required = required;
  }
  function editable() {
    return !created || ['borrador', 'pendiente_firmas'].includes(created.accession.status);
  }
  function applyModality() {
    const modality = form.elements.modality.value;
    const loan = modality === 'prestamo_temporal';
    const donation = modality === 'donacion_permanente';
    form.querySelector('[data-loan]').hidden = !loan;
    form.querySelector('[data-donation]').hidden = !donation;
    form.querySelector('[data-party]').hidden = !loan && !donation;
    form.querySelector('[data-donation-note]').hidden = !donation;
    form.querySelector('[data-party-name-label]').textContent = loan ? 'Nombre del propietario / prestamista *' : 'Nombre del donante *';
    form.querySelector('[data-party-legend]').textContent = loan ? 'Propietario / prestamista' : 'Donante';
    form.querySelector('[data-party-sign-legend]').textContent = loan ? 'Propietario / Prestamista' : donation ? 'Donante' : 'Propietario / Prestamista';
    ['party_name', 'party_email', 'party_phone', 'party_address'].forEach(name => setRequired(name, (loan || donation) && editable()));
    setRequired('started_on', loan && editable());
    setRequired('expected_return_on', loan && editable());
    setRequired('donation_on', donation && editable());
    const ownership = form.querySelector('[data-ownership]');
    const formal = created && ['formalizado', 'recibido'].includes(created.accession.status);
    ownership.textContent = formal && donation ? 'Museo' : loan ? 'Propiedad externa' : donation ? 'Pendiente de formalización' : 'Seleccione la modalidad';
    partySignature.setSigner(collectionFieldValue(form, 'party_name'), loan ? 'propietario' : donation ? 'donante' : partySignature.signerRole);
    applyPurpose();
    refreshMode();
  }
  function applyPurpose() {
    const purposes = [...form.querySelectorAll('input[name="purpose"]:checked')].map(input => input.value);
    const exhibition = purposes.includes('Exhibición');
    const other = purposes.includes('Otros');
    form.querySelector('[data-exhibition]').hidden = !exhibition;
    form.querySelector('[data-purpose-other]').hidden = !other;
    setRequired('activity_name', exhibition && form.elements.modality.value === 'prestamo_temporal' && editable());
    setRequired('purpose_details', other && form.elements.modality.value === 'prestamo_temporal' && editable());
  }
  function refreshPhotoNote() {
    const saved = [1, 2, 3, 4].some(n => photoSlotState[n] === 'saved');
    photoNote.hidden = !saved;
  }
  function revokePhotoPreview(n) {
    if (!photoPreviewUrls[n]) return;
    URL.revokeObjectURL(photoPreviewUrls[n]);
    delete photoPreviewUrls[n];
  }
  function paintPhotoSlot(n, mode, name) {
    const preview = form.querySelector(`[data-photo-preview="${n}"]`);
    const filename = form.querySelector(`[data-photo-filename="${n}"]`);
    const slotStatus = form.querySelector(`[data-photo-status="${n}"]`);
    const pick = form.querySelector(`[data-photo-pick="${n}"]`);
    const clear = form.querySelector(`[data-photo-clear="${n}"]`);
    const retry = form.querySelector(`[data-photo-retry="${n}"]`);
    const input = form.elements[`photo_${n}`];
    const labels = { pending: 'Lista para guardar', saved: 'Guardada', error: 'Error al cargar' };
    if (preview) {
      if (photoPreviewUrls[n]) { preview.src = photoPreviewUrls[n]; preview.hidden = false; }
      else if (mode !== 'saved') { preview.removeAttribute('src'); preview.hidden = true; }
    }
    if (filename) { filename.textContent = name || ''; filename.hidden = !name; }
    if (slotStatus) { slotStatus.textContent = labels[mode] || ''; slotStatus.hidden = !labels[mode]; }
    if (pick) { pick.hidden = mode === 'saved'; pick.textContent = mode === 'empty' ? 'Seleccionar' : 'Cambiar'; }
    if (clear) clear.hidden = mode !== 'pending' && mode !== 'error';
    if (retry) retry.hidden = mode !== 'error';
    if (input) input.disabled = mode === 'saved' || !canWrite || contractSigned;
  }
  function clearPhotoSlot(n) {
    revokePhotoPreview(n);
    photoSlotState[n] = 'empty';
    const input = form.elements[`photo_${n}`];
    if (input) input.value = '';
    paintPhotoSlot(n, 'empty', '');
  }
  function showPendingPhoto(n, file) {
    revokePhotoPreview(n);
    photoPreviewUrls[n] = URL.createObjectURL(file);
    photoSlotState[n] = 'pending';
    paintPhotoSlot(n, 'pending', file.name);
  }
  function markPhotoSaved(n) {
    photoSlotState[n] = 'saved';
    const input = form.elements[`photo_${n}`];
    const name = form.querySelector(`[data-photo-filename="${n}"]`)?.textContent || '';
    if (input) input.value = '';
    paintPhotoSlot(n, 'saved', name);
  }
  function markPhotoError(n) {
    photoSlotState[n] = 'error';
    const name = form.querySelector(`[data-photo-filename="${n}"]`)?.textContent || '';
    paintPhotoSlot(n, 'error', name);
  }
  async function showStoredPhoto(n, path) {
    revokePhotoPreview(n);
    photoSlotState[n] = 'saved';
    const input = form.elements[`photo_${n}`];
    if (input) input.value = '';
    paintPhotoSlot(n, 'saved', '');
    const preview = form.querySelector(`[data-photo-preview="${n}"]`);
    if (!preview || !path) return;
    preview.hidden = false;
    if (!path) { preview.hidden = true; preview.removeAttribute('src'); return; }
    try { await collectionLoadPhoto(preview, path); }
    catch (error) { console.error(error); preview.alt = 'No se pudo mostrar la fotografía guardada.'; }
  }
  async function loadSavedRolePhotos(itemId) {
    const [roles, photos] = await Promise.all([
      collectionRows('collection_photo_roles', `&item_id=eq.${itemId}`),
      collectionRows('collection_active_photos', `&item_id=eq.${itemId}`)
    ]);
    const paths = new Map(photos.map(photo => [photo.id, photo.path]));
    for (const role of roles) {
      const n = Number(Object.entries(collectionPhotoRoles).find(([, name]) => name === role.role)?.[0]);
      if (!n) continue;
      await showStoredPhoto(n, paths.get(role.photo_id) || '');
    }
    refreshPhotoNote();
  }
  async function acceptPhoto(n) {
    const input = form.elements[`photo_${n}`];
    const file = input?.files?.[0];
    if (photoSlotState[n] === 'saved') { if (input) input.value = ''; return; }
    if (!file) { clearPhotoSlot(n); refreshPhotoNote(); return; }
    try {
      await collectionValidatePhoto(file);
    } catch (error) {
      if (input) input.value = '';
      clearPhotoSlot(n);
      refreshPhotoNote();
      say(error.message, true);
      return;
    }
    showPendingPhoto(n, file);
    refreshPhotoNote();
  }
  function refreshMode() {
    const accession = created?.accession;
    const locked = accession && !['borrador', 'pendiente_firmas'].includes(accession.status);
    const signedLock = contractSigned && !locked;
    document.querySelector('#intake-workflow-status').textContent = intakeStatusLabels[accession?.status] || 'Borrador';
    document.querySelector('#intake-signed-lock').hidden = !signedLock;
    document.querySelector('#intake-save').textContent = accession ? 'Guardar correcciones' : 'Guardar borrador';
    document.querySelector('#intake-save').disabled = saving || locked || signedLock || !canWrite;
    document.querySelector('#intake-reopen').hidden = !canWrite || !signedLock;
    document.querySelector('#intake-reopen').disabled = saving || !signedLock;
    document.querySelector('#intake-formalize').disabled = saving || !canWrite || !accession || locked;
    document.querySelector('#intake-sign-party').disabled = saving || !canWrite || !accession || locked;
    if (document.querySelector('#intake-sign-director')) document.querySelector('#intake-sign-director').disabled = saving || !canDirect || !accession || locked;
    document.querySelector('#intake-receive').disabled = saving || !canWrite || accession?.status !== 'formalizado';
    form.elements.reason.required = !locked;
    [...form.elements.modality].forEach(input => { input.disabled = Boolean(accession) || !canWrite; });
    form.querySelectorAll('input, select, textarea').forEach(field => {
      if (field.name === 'modality') return;
      if (field.type === 'file' && String(field.name || '').startsWith('photo_')) {
        const n = Number(String(field.name).replace('photo_', ''));
        field.disabled = !canWrite || signedLock || photoSlotState[n] === 'saved';
        return;
      }
      const reception = field.closest('[data-reception]');
      const returning = field.closest('[data-return]');
      if (reception) {
        field.disabled = accession?.status !== 'formalizado' || !canWrite;
        return;
      }
      if (returning) {
        const loanReady = accession?.modality === 'prestamo_temporal' && accession?.status === 'recibido';
        field.disabled = !loanReady || !canWrite;
        return;
      }
      if (!canWrite || locked || signedLock) field.disabled = true;
    });
    document.querySelector('#intake-add-attachment').disabled = !canWrite || Boolean(locked) || signedLock;
    document.querySelector('[data-reception]').hidden = !accession || !['formalizado', 'recibido'].includes(accession.status);
    if (accession?.status === 'recibido') {
      document.querySelector('[data-reception]').hidden = false;
      form.elements.initial_location.value = accession.initial_location || form.elements.initial_location.value;
      form.elements.reception_notes.value = accession.reception_notes || '';
    }
    document.querySelector('[data-reception-number]').textContent = created?.item?.accession_number || 'Se asignará automáticamente al guardar';
    const loan = accession?.modality === 'prestamo_temporal';
    const returnPanel = document.querySelector('[data-return]');
    returnPanel.hidden = !loan || !['recibido', 'devuelto', 'cerrado'].includes(accession?.status);
    document.querySelector('#intake-return').hidden = !canWrite || accession?.status !== 'recibido';
    document.querySelector('#intake-close').hidden = !canWrite || accession?.status !== 'devuelto';
    document.querySelector('#intake-return').disabled = saving || !canWrite || accession?.status !== 'recibido';
    document.querySelector('#intake-close').disabled = saving || !canWrite || accession?.status !== 'devuelto';
    document.querySelector('[data-delivered-by]').textContent = accession?.delivered_by_name || localStorage.getItem('museo-admin-current-user') || 'Usuario autenticado';
    document.querySelector('[data-ingress-condition]').textContent = accession?.physical_condition || 'No registrada';
    const reference = document.querySelector('[data-return-reference]');
    if (loan && created?.item) {
      reference.textContent = [
        `Número de inventario: ${created.item.accession_number}`,
        `Título: ${created.item.title}`,
        `Prestamista: ${accession.party_name || 'No registrado'}`,
        `Entidad: ${accession.party_entity || 'No aplica'}`,
        `Fecha de ingreso: ${accession.started_on || 'No registrada'}`,
        `Fecha estimada de devolución: ${accession.expected_return_on || 'No registrada'}`,
        `Ubicación actual: ${created.item.location || 'No registrada'}`
      ].join('\n');
    }
    const returnSummary = document.querySelector('[data-return-summary]');
    if (loan && ['devuelto', 'cerrado'].includes(accession?.status)) {
      returnSummary.hidden = false;
      returnSummary.textContent = `Condición al ingreso: ${accession.physical_condition || 'No registrada'}. Condición a la devolución: ${accession.return_condition || 'No registrada'}. ${accession.return_notes || ''}`;
    } else returnSummary.hidden = true;
    const documentLink = document.querySelector('#intake-document');
    documentLink.hidden = !accession?.contract_snapshot;
    if (accession?.id) documentLink.href = `documento-ingreso.html?expediente=${encodeURIComponent(accession.id)}`;
    if (loan && ['devuelto', 'cerrado'].includes(accession?.status)) {
      document.querySelector('[data-ownership]').textContent = 'Propiedad externa. El préstamo ya no está bajo custodia activa del Museo.';
    }
    const preview = document.querySelector('#intake-contract-preview');
    const previewBody = document.querySelector('[data-contract-preview]');
    if (!accession?.contract_snapshot) {
      preview.hidden = !accession;
      previewBody.textContent = 'El documento oficial se imprimirá desde el snapshot contractual después de la formalización.';
    } else {
      preview.hidden = false;
      renderContractSnapshot(accession.contract_snapshot, previewBody);
    }
    if (created?.item?.accession_number) {
      const note = document.querySelector('#intake-inventory-note');
      note.replaceChildren();
      const label = document.createElement('strong');
      label.textContent = 'Número de inventario';
      note.append(label, document.createElement('br'), document.createTextNode(created.item.accession_number));
    }
  }
  function addAttachmentRow() {
    const row = document.createElement('div');
    row.className = 'intake-attachment';
    const options = intakeAttachmentKinds.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
    row.innerHTML = `<label class="field"><span>Documento</span><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" data-attachment-file></label><label class="field"><span>Categoría</span><select data-attachment-kind><option value="">Seleccione</option>${options}</select></label><label class="field"><span>Descripción</span><input data-attachment-description maxlength="2000"></label><button class="button secondary" type="button" data-attachment-remove>Quitar</button>`;
    row.querySelector('[data-attachment-remove]').onclick = () => { if (!saving) row.remove(); };
    attachments.append(row);
  }
  function focusInvalid() {
    const invalid = [...form.elements].find(element => element.willValidate && !element.disabled && !element.closest('[hidden]') && !element.checkValidity());
    if (!invalid) return true;
    invalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    invalid.focus();
    const visible = invalid.closest('label')?.querySelector('span')?.textContent?.replace(/\s*\*\s*$/, '').trim();
    say(`Falta completar: ${visible || 'un campo obligatorio'}.`, true);
    return false;
  }
  function validateIntake() {
    const modality = form.elements.modality.value;
    if (!modality) { say('Seleccione préstamo temporal o donación permanente.', true); return false; }
    if (!focusInvalid()) return false;
    if (form.elements.category.value === 'Objeto personal' && !collectionFieldValue(form, 'personal_object_description')) {
      say('Indique la descripción del objeto personal.', true); return false;
    }
    if (form.elements.category.value === 'Otro' && !collectionFieldValue(form, 'object_type_specification')) {
      say('Escriba el tipo de objeto.', true); return false;
    }
    if (modality === 'prestamo_temporal') {
      const purposes = [...form.querySelectorAll('input[name="purpose"]:checked')];
      if (!purposes.length) { say('Seleccione el propósito del préstamo.', true); return false; }
      if (form.elements.expected_return_on.value < form.elements.started_on.value) {
        say('La fecha estimada de devolución no puede ser anterior a la fecha de inicio.', true); return false;
      }
    }
    for (const row of attachments.querySelectorAll('.intake-attachment')) {
      const file = row.querySelector('[data-attachment-file]').files[0];
      if (!file) continue;
      const kind = row.querySelector('[data-attachment-kind]').value;
      const description = row.querySelector('[data-attachment-description]').value.trim();
      if (!kind) { say('Seleccione la categoría del anejo.', true); return false; }
      if (kind === 'otro' && !description) { say('La categoría Otros requiere una descripción.', true); return false; }
    }
    return true;
  }
  function itemPayload() {
    const keys = ['personal_object_description', 'object_type_specification', 'author', 'dating', 'materials', 'dimensions', 'provenance', 'owner', 'acquisition', 'custody', 'donor', 'owner_phone', 'owner_email', 'owner_address', 'lender', 'received_date', 'fmv', 'currency', 'loan_reference', 'notes', 'cultural_history'];
    const values = Object.fromEntries(keys.map(key => [key, collectionFieldValue(form, key)]));
    values.currency = 'USD';
    const composed = collectionComposeDimensions({
      height: form.elements.height.value, height_unit: form.elements.height_unit.value,
      width: form.elements.width.value, width_unit: form.elements.width_unit.value,
      depth: form.elements.depth.value, depth_unit: form.elements.depth_unit.value,
      weight: form.elements.weight.value, weight_unit: form.elements.weight_unit.value,
      other_measurements: form.elements.other_measurements.value
    });
    if (composed) values.dimensions = composed;
    return {
      title: collectionFieldValue(form, 'title'),
      description: collectionFieldValue(form, 'description'),
      category: form.elements.category.value,
      location: collectionFieldValue(form, 'location'),
      condition: form.elements.physical_condition.value,
      status: form.elements.status.value || 'ingreso',
      details: collectionDetailsPayload(form.elements.category.value, keys, values, created?.item?.details)
    };
  }
  function selectedSlots() {
    return [1, 2, 3, 4].map(n => ({ n, file: form.elements[`photo_${n}`]?.files?.[0] })).filter(slot => slot.file);
  }
  async function uploadPending() {
    const piece = created.item;
    const accession = created.accession;
    const slots = selectedSlots();
    for (const slot of slots) await collectionValidatePhoto(slot.file);
    partySignature.setAccession(accession.id);
    let version = piece;
    const existingRoles = await collectionRows('collection_photo_roles', `&item_id=eq.${piece.id}`);
    const existingPhotos = await collectionRows('collection_active_photos', `&item_id=eq.${piece.id}`);
    const paths = new Map(existingPhotos.map(photo => [photo.id, photo.path]));
    for (const slot of slots) {
      const role = collectionPhotoRoles[slot.n];
      const savedRole = existingRoles.find(row => row.role === role);
      if (photoSlotState[slot.n] === 'saved' || savedRole) {
        if (savedRole) await showStoredPhoto(slot.n, paths.get(savedRole.photo_id) || '');
        continue;
      }
      try {
        version = await collectionUpload(version, slot.file, '', role);
      } catch (error) {
        markPhotoError(slot.n);
        throw error;
      }
      existingRoles.push({ role });
      markPhotoSaved(slot.n);
    }
    created.item = version?.id ? version : piece;
    if (editable()) {
      for (const row of [...attachments.querySelectorAll('.intake-attachment')]) {
        const file = row.querySelector('[data-attachment-file]').files[0];
        if (!file) continue;
        await collectionUploadAccessionFile(accession, file, row.querySelector('[data-attachment-kind]').value, row.querySelector('[data-attachment-description]').value.trim());
        row.remove();
      }
    }
    const stillSelected = selectedSlots().length || [...attachments.querySelectorAll('[data-attachment-file]')].some(input => input.files[0]);
    if (!stillSelected) sessionStorage.removeItem(intakeRequestKey());
    pendingNote.hidden = stillSelected;
    photoNote.hidden = existingRoles.length === 0;
    const link = document.querySelector('#intake-result');
    link.hidden = false;
    link.href = `inventario-colecciones.html?pieza=${piece.id}`;
    link.textContent = `Abrir ${piece.accession_number} en el Inventario de Colecciones`;
  }
  function rememberCreated(response, id) {
    created = response;
    writeIntakePending({ requestId: id || readIntakePending()?.requestId || created.accession.client_request_id, accessionId: created.accession.id, itemId: created.item.id });
    partySignature.setAccession(created.accession.id);
    partySignature.setSigner(created.accession.party_name, created.accession.modality === 'donacion_permanente' ? 'donante' : 'propietario');
    directorSignature?.setAccession(created.accession.id);
    receptionSignature.setAccession(created.accession.id);
    receptionSignature.setSigner(localStorage.getItem('museo-admin-current-user') || '', 'receptor');
    returnSignature.setAccession(created.accession.id);
  }
  function savedForSignature() {
    if (!created?.accession?.id) { say('Guarde el borrador antes de firmar.', true); return false; }
    if (!clean && editable()) { say('Guarde las correcciones antes de firmar. Si el expediente cambia, hay que firmar otra vez.', true); return false; }
    return true;
  }
  async function fillExisting(accession, item) {
    created = { item, accession, replayed: true };
    const details = item.details || {};
    form.elements.modality.value = accession.modality;
    form.elements.category.value = item.category || '';
    form.elements.title.value = item.title || '';
    form.elements.description.value = item.description || '';
    form.elements.location.value = item.location || '';
    form.elements.status.value = item.status || 'ingreso';
    form.elements.physical_condition.value = accession.physical_condition || '';
    form.elements.conservation_notes.value = accession.conservation_notes || '';
    form.elements.fmv.value = accession.estimated_value ?? '';
    ['author', 'dating', 'materials', 'provenance', 'personal_object_description', 'object_type_specification'].forEach(name => {
      if (form.elements[name]) form.elements[name].value = details[name] || '';
    });
    ['height', 'width', 'depth', 'weight'].forEach(name => {
      form.elements[name].value = accession[name] ?? '';
      if (accession[`${name}_unit`]) form.elements[`${name}_unit`].value = accession[`${name}_unit`];
    });
    form.elements.other_measurements.value = accession.other_measurements || '';
    form.elements.party_name.value = accession.party_name || '';
    form.elements.party_entity.value = accession.party_entity || '';
    form.elements.party_email.value = accession.party_email || '';
    form.elements.party_phone.value = accession.party_phone || '';
    form.elements.party_address.value = accession.party_address || '';
    if (accession.modality === 'prestamo_temporal') {
      form.elements.started_on.value = accession.started_on || '';
      form.elements.expected_return_on.value = accession.expected_return_on || '';
      form.elements.purpose_details.value = accession.purpose_details || '';
      form.elements.activity_name.value = accession.activity_name || '';
      form.elements.activity_on.value = accession.activity_on || '';
      form.elements.activity_location.value = accession.activity_location || '';
      const purposes = Array.isArray(accession.purposes) ? accession.purposes : [];
      form.querySelectorAll('input[name="purpose"]').forEach(input => { input.checked = purposes.includes(input.value); });
    } else {
      form.elements.donation_on.value = accession.started_on || '';
    }
    syncCollectionCategoryFields(form, details);
    rememberCreated(created, accession.client_request_id);
    clean = true;
    applyModality();
    await loadSavedRolePhotos(item.id);
  }
  async function loadContractSigned() {
    contractSigned = false;
    if (!created?.accession?.id || !['borrador', 'pendiente_firmas'].includes(created.accession.status)) return;
    const signatures = await collectionRequest(`/rest/v1/collection_accession_signatures?select=status&accession_id=eq.${encodeURIComponent(created.accession.id)}&signature_type=eq.contractual&status=eq.capturada&limit=1`, undefined, 'GET');
    contractSigned = Array.isArray(signatures) && signatures.length > 0;
  }

  form.elements.category.addEventListener('change', () => syncCollectionCategoryFields(form));
  form.elements.modality.forEach(input => input.addEventListener('change', applyModality));
  form.querySelectorAll('input[name="purpose"]').forEach(input => input.addEventListener('change', applyPurpose));
  form.addEventListener('input', event => {
    clean = false;
    if (event.target.name === 'party_name') partySignature.setSigner(event.target.value);
    refreshPhotoNote();
  });
  form.addEventListener('change', event => {
    const n = Number(event.target?.name?.match(/^photo_([1-4])$/)?.[1]);
    if (n) acceptPhoto(n);
  });
  form.addEventListener('click', event => {
    const pick = Number(event.target.closest('[data-photo-pick]')?.dataset.photoPick);
    if (pick && !saving && photoSlotState[pick] !== 'saved') { form.elements[`photo_${pick}`]?.click(); return; }
    const clear = Number(event.target.closest('[data-photo-clear]')?.dataset.photoClear);
    if (clear && !saving && photoSlotState[clear] !== 'saved') { clearPhotoSlot(clear); refreshPhotoNote(); return; }
    if (event.target.closest('[data-photo-retry]') && !saving) document.querySelector('#intake-retry')?.click();
  });
  window.addEventListener('pagehide', () => { [1, 2, 3, 4].forEach(revokePhotoPreview); });
  [1, 2, 3, 4].forEach(n => paintPhotoSlot(n, 'empty', ''));
  document.querySelector('#intake-add-attachment').onclick = addAttachmentRow;
  document.querySelector('#intake-link-existing').disabled = true;
  document.querySelector('#intake-retry').onclick = async () => {
    if (saving || !created) return;
    if (contractSigned) { say('Hay firmas vigentes. Reabra el expediente antes de incorporar fotografías o anejos.', true); return; }
    saving = true;
    refreshMode();
    say('Reintentando la carga pendiente…');
    try {
      await uploadPending();
      say(`${created.item.accession_number} conserva su número. La carga pendiente se actualizó.`);
    } catch (error) {
      console.error(error);
      pendingNote.hidden = false;
      say(error.message || 'La carga sigue pendiente. Puede reintentar sin crear otra pieza.', true);
    } finally {
      saving = false;
      refreshMode();
    }
  };
  document.querySelector('#intake-reopen').onclick = async () => {
    if (saving || !canWrite || !contractSigned || !created?.accession?.id) return;
    saving = true;
    refreshMode();
    try {
      const response = await collectionReopenIngressCorrection(created.accession.id, created.accession.version);
      created.accession = response.accession;
      contractSigned = false;
      clean = true;
      applyModality();
      say('El expediente quedó reabierto. Las firmas anteriores se conservan, pero dejaron de validar este texto. Hay que firmar otra vez.');
    } catch (error) {
      console.error(error);
      say(error.message || 'No se pudo reabrir el expediente.', true);
    } finally {
      saving = false;
      refreshMode();
    }
  };
  document.querySelector('#intake-sign-party').onclick = async () => {
    if (saving || !savedForSignature()) return;
    saving = true;
    refreshMode();
    try {
      const response = await partySignature.persist(record => collectionRecordSignature(
        created.accession.id, created.accession.version, record.signer_role, record.capture_method, record.visual
      ));
      created.accession = response.accession;
      contractSigned = true;
      clean = true;
      applyModality();
      say('La firma del prestamista o donante quedó registrada. El ingreso sigue pendiente de la firma del Director y todavía no está formalizado. El contrato queda bloqueado hasta reabrirlo.');
    } catch (error) {
      console.error(error);
      say(error.message || 'No se pudo registrar la firma.', true);
    } finally {
      saving = false;
      refreshMode();
    }
  };
  document.querySelector('#intake-sign-director').onclick = async () => {
    if (saving || !directorSignature || !savedForSignature()) return;
    saving = true;
    refreshMode();
    try {
      const response = await directorSignature.persist(record => collectionRecordSignature(
        created.accession.id, created.accession.version, 'director', record.capture_method, record.visual
      ));
      created.accession = response.accession;
      contractSigned = true;
      clean = true;
      applyModality();
      say('La firma del Director quedó registrada. El ingreso se formaliza solo cuando también existe la firma del prestamista o donante.');
    } catch (error) {
      console.error(error);
      say(error.message || 'No se pudo registrar la firma del Director.', true);
    } finally {
      saving = false;
      refreshMode();
    }
  };
  document.querySelector('#intake-formalize').onclick = async () => {
    if (saving || !canWrite || !savedForSignature()) return;
    saving = true;
    refreshMode();
    say('Formalizando…');
    try {
      const response = await collectionFormalizeAccession(created.accession.id, created.accession.version);
      created = response;
      clean = true;
      applyModality();
      const printed = await collectionContractDocument(created.accession.id);
      if (!printed?.integrity_ok) {
        say('El ingreso quedó formalizado, pero la verificación del hash no coincidió.', true);
        return;
      }
      renderContractSnapshot(printed.contract_snapshot, document.querySelector('[data-contract-preview]'));
      say(created.accession.modality === 'donacion_permanente'
        ? 'El ingreso quedó formalizado. La titularidad de la donación pasó al Museo. La recepción física es el paso siguiente.'
        : 'El ingreso quedó formalizado. La propiedad sigue siendo externa y la custodia corresponde al Museo.');
    } catch (error) {
      console.error(error);
      if (created?.accession?.status === 'formalizado') {
        say(`${error.message || 'No se pudo leer el documento.'} El ingreso sí quedó formalizado.`, true);
        return;
      }
      say(error.message || 'No se pudo formalizar el ingreso.', true);
    } finally {
      saving = false;
      refreshMode();
    }
  };
  document.querySelector('#intake-return').onclick = async () => {
    if (saving || !canWrite || created?.accession?.status !== 'recibido' || created?.accession?.modality !== 'prestamo_temporal') return;
    const returnedOn = collectionFieldValue(form, 'returned_on');
    const condition = collectionFieldValue(form, 'return_condition');
    const receiver = collectionFieldValue(form, 'return_received_by');
    if (!returnedOn) { say('Indique la fecha efectiva de devolución.', true); return; }
    if (!condition) { say('Seleccione la condición de la pieza al devolver.', true); return; }
    if (!receiver) { say('Indique quién recibe la pieza en representación del prestamista.', true); return; }
    saving = true;
    refreshMode();
    try {
      returnSignature.setSigner(receiver, 'receptor_devolucion');
      const returned = await returnSignature.persist(record => collectionReturnAccession(
        created.accession.id, created.accession.version, returnedOn, condition,
        collectionFieldValue(form, 'return_notes'), receiver, record.capture_method, record.visual
      ));
      created.accession = returned.accession;
      applyModality();
      try {
        const closed = await collectionCloseAccession(created.accession.id, created.accession.version);
        created.accession = closed.accession;
        applyModality();
        say('La pieza fue devuelta y el expediente quedó cerrado. El número de inventario se conserva y el contrato original no cambia.');
      } catch (error) {
        console.error(error);
        say(`${error.message || 'No se pudo cerrar el expediente.'} La devolución sí quedó registrada.`, true);
      }
    } catch (error) {
      console.error(error);
      say(error.message || 'No se pudo registrar la devolución.', true);
    } finally {
      saving = false;
      refreshMode();
    }
  };
  document.querySelector('#intake-close').onclick = async () => {
    if (saving || !canWrite || created?.accession?.status !== 'devuelto') return;
    saving = true;
    refreshMode();
    try {
      const closed = await collectionCloseAccession(created.accession.id, created.accession.version);
      created.accession = closed.accession;
      applyModality();
      say('El expediente de préstamo quedó cerrado. La pieza permanece en el inventario.');
    } catch (error) {
      console.error(error);
      say(error.message || 'No se pudo cerrar el expediente.', true);
    } finally {
      saving = false;
      refreshMode();
    }
  };
  document.querySelector('#intake-receive').onclick = async () => {
    if (saving || !canWrite || created?.accession?.status !== 'formalizado') return;
    const location = collectionFieldValue(form, 'initial_location');
    if (!location) { say('Indique la ubicación inicial de la pieza.', true); return; }
    saving = true;
    refreshMode();
    try {
      const response = await receptionSignature.persist(record => collectionReceiveAccession(
        created.accession.id, created.accession.version, location, collectionFieldValue(form, 'reception_notes'), record.capture_method, record.visual
      ));
      created.accession = response.accession;
      created.item = response.item;
      applyModality();
      say('La pieza quedó recibida. Esta certificación es operativa y no es una tercera firma contractual.');
    } catch (error) {
      console.error(error);
      say(error.message || 'No se pudo certificar la recepción.', true);
    } finally {
      saving = false;
      refreshMode();
    }
  };
  applyModality();
  syncCollectionCategoryFields(form);
  refreshPhotoNote();

  form.onsubmit = async event => {
    event.preventDefault();
    if (saving || !canWrite || !editable()) return;
    if (contractSigned) { say('Hay firmas vigentes. Reabra el expediente antes de corregir el contrato.', true); return; }
    if (!validateIntake()) return;
    const slots = selectedSlots();
    saving = true;
    refreshMode();
    say(created ? 'Guardando correcciones…' : 'Guardando borrador…');
    try {
      for (const slot of slots) await collectionValidatePhoto(slot.file);
      const item = itemPayload();
      const accessionPayload = collectionIntakeAccession(form);
      const id = created?.accession?.client_request_id || requestId();
      let response = created;
      if (!created) {
        try {
          response = await collectionCreateEntry(item, accessionPayload, form.elements.reason.value.trim(), id);
        } catch (error) {
          if (!error.timeout) throw error;
          response = await collectionCreateEntry(item, accessionPayload, form.elements.reason.value.trim(), id);
        }
      } else {
        response = await collectionUpdateIngressDraft(created.accession.id, created.accession.version, item, accessionPayload, form.elements.reason.value.trim());
      }
      rememberCreated(response, id);
      pendingNote.hidden = false;
      await uploadPending();
      clean = true;
      applyModality();
      let notice = `${created.item.accession_number} quedó en el inventario. El estado del ingreso es ${intakeStatusLabels[created.accession.status] || created.accession.status}.`;
      if (created.accession.status === 'pendiente_firmas') notice += await intakeSignatureRevocationNotice(created.accession.id);
      say(notice);
    } catch (error) {
      console.error(error);
      if (created?.accession?.id) pendingNote.hidden = false;
      say(error.message || 'No se pudo completar el ingreso. Los datos permanecen en este formulario.', true);
    } finally {
      saving = false;
      refreshMode();
    }
  };

  const requested = new URLSearchParams(location.search).get('expediente');
  const pending = readIntakePending();
  if ((requested && intakeUuid(requested)) || (pending?.requestId && intakeUuid(pending.requestId))) {
    const filter = requested ? `&id=eq.${requested}` : `&client_request_id=eq.${pending.requestId}`;
    collectionRows('collection_accessions', filter).then(async rows => {
      const accession = rows[0];
      if (!accession?.collection_item_id) {
        if (pending?.requestId) pendingNote.hidden = false;
        return;
      }
      const items = await collectionRows('collection_items', `&id=eq.${accession.collection_item_id}`);
      if (!items[0]) return;
      await fillExisting(accession, items[0]);
      await loadContractSigned();
      refreshMode();
      const waiting = Boolean(pending?.requestId && accession.client_request_id === pending.requestId);
      pendingNote.hidden = !waiting;
      if (waiting) say('Carga pendiente. Puede reintentar sin crear otra pieza.');
    }).catch(error => {
      console.error(error);
      say(error.message || 'No se pudo recuperar el expediente.', true);
    });
  }
}

async function intakeSignatureRevocationNotice(accessionId) {
  try {
    const signatures = await collectionRequest(`/rest/v1/collection_accession_signatures?select=status,signature_type&accession_id=eq.${encodeURIComponent(accessionId)}&signature_type=eq.contractual`, undefined, 'GET');
    if (!Array.isArray(signatures) || !signatures.length) return '';
    if (signatures.some(row => row.status === 'capturada')) return '';
    if (signatures.some(row => row.status === 'revocada')) {
      return ' El contenido contractual cambió y las firmas anteriores dejaron de validar este expediente. Hay que firmar otra vez.';
    }
  } catch (error) {
    console.error(error);
  }
  return '';
}

function renderContractSnapshot(snapshot, host) {
  const documentSnapshot = snapshot?.document || {};
  const lines = [
    ['Expediente', documentSnapshot.file_number],
    ['Inventario', documentSnapshot.inventory_number],
    ['Pieza', documentSnapshot.item_id],
    ['Modalidad', documentSnapshot.modality],
    ['Título', documentSnapshot.title],
    ['Clasificación', documentSnapshot.category],
    ['Descripción', documentSnapshot.description],
    ['Medidas', documentSnapshot.dimensions],
    ['Condición', documentSnapshot.physical_condition],
    ['Prestamista / donante', documentSnapshot.party_name],
    ['Entidad', documentSnapshot.party_entity],
    ['Correo', documentSnapshot.party_email],
    ['Teléfono', documentSnapshot.party_phone],
    ['Dirección', documentSnapshot.party_address],
    ['Inicio', documentSnapshot.started_on],
    ['Devolución estimada', documentSnapshot.expected_return_on],
    ['Propósito', documentSnapshot.purpose],
    ['Exhibición', documentSnapshot.activity_name],
    ['Titularidad registrada', snapshot?.ownership_status],
    ['Custodia registrada', snapshot?.custody_status],
    ['Términos', documentSnapshot.acceptance],
    ['Anejos', Array.isArray(documentSnapshot.attachments) ? documentSnapshot.attachments.map(file => file.kind).join(', ') : ''],
    ['Firmas', Array.isArray(snapshot?.signatures) ? snapshot.signatures.map(signature => `${signature.signer_role}: ${signature.signer_name}`).join(' · ') : '']
  ].filter(([, value]) => value);
  host.textContent = lines.map(([label, value]) => `${label}: ${value}`).join('\n');
}
