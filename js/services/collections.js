/* Uses the existing authenticated session. Text drafts stay in the browser; this module does not store them. */
const collectionSaveTimeoutMs = 30000;
const collectionPhotoUploadTimeoutMs = 60000;
const collectionPhotoAttachTimeoutMs = 30000;

async function collectionRequest(path, body, method = 'POST', extraHeaders = {}, timeoutMs = 0) {
  const timeout = timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined;
  let response;
  try {
    response = await fetch(supabaseUrl + path, {
      method, signal: timeout, headers: { ...(await supabaseAuthHeaders()), ...extraHeaders },
      body: body === undefined ? undefined : body instanceof Blob ? body : JSON.stringify(body)
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      const timeoutError = new Error('La conexión tardó demasiado.');
      timeoutError.timeout = true;
      throw timeoutError;
    }
    console.error(error);
    throw new Error('No se pudo completar el guardado. Sus datos permanecen en este formulario.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.message?.includes('COLLECTION_PHOTO_LIMIT') ? 'Esta pieza ya tiene el máximo de 4 fotografías.'
      : data?.message?.includes('PERSONAL_OBJECT_DESCRIPTION_REQUIRED') ? 'Indique la descripción del objeto personal.'
      : data?.message?.includes('OBJECT_TYPE_SPECIFICATION_REQUIRED') ? 'Escriba el tipo de objeto.'
      : data?.message?.includes('INVALID_DETAILS') ? 'Revise los campos del expediente. Hay un dato de detalle que el catálogo no puede guardar.'
      : data?.message?.includes('PARTY_REQUIRED') ? 'Complete el nombre, el correo, el teléfono y la dirección.'
      : data?.message?.includes('PARTY_EMAIL_INVALID') ? 'El correo electrónico no es válido.'
      : data?.message?.includes('LOAN_DATES_REQUIRED') ? 'Indique la fecha de inicio y la fecha estimada de devolución.'
      : data?.message?.includes('RETURN_BEFORE_START') ? 'La fecha estimada de devolución no puede ser anterior a la fecha de inicio.'
      : data?.message?.includes('LOAN_PURPOSE_REQUIRED') ? 'Seleccione el propósito del préstamo.'
      : data?.message?.includes('EXHIBITION_NAME_REQUIRED') ? 'Indique el nombre de la exhibición o actividad.'
      : data?.message?.includes('PURPOSE_DETAILS_REQUIRED') ? 'Describa el propósito cuando selecciona Otros.'
      : data?.message?.includes('DONATION_DATE_REQUIRED') ? 'Indique la fecha de donación o ingreso.'
      : data?.message?.includes('PHYSICAL_CONDITION_REQUIRED') ? 'Seleccione la condición general.'
      : data?.message?.includes('FORMALIZATION_LATER') ? 'El alta inicial queda en borrador. La formalización exige la firma del prestamista o donante y la del Director.'
      : data?.message?.includes('CONTRACT_LOCKED') ? 'El expediente ya está formalizado. Los datos contractuales no se pueden modificar.'
      : data?.message?.includes('CONTRACT_SIGNED_LOCKED') ? 'Hay firmas vigentes. Reabra el expediente antes de corregir el contrato.'
      : data?.message?.includes('CONTRACT_SNAPSHOT_IMMUTABLE') ? 'El snapshot contractual no se puede reescribir.'
      : data?.message?.includes('SIGNATURE_STALE') ? 'El expediente cambió después de una firma. Vuelva a firmar antes de formalizar.'
      : data?.message?.includes('PARTY_SIGNATURE_REQUIRED') ? 'Falta la firma del prestamista o del donante.'
      : data?.message?.includes('DIRECTOR_SIGNATURE_REQUIRED') ? 'Falta la firma del Director del Museo.'
      : data?.message?.includes('DIRECTOR_SIGNATURE_FORBIDDEN') ? 'Solo el perfil autorizado puede firmar como Director del Museo.'
      : data?.message?.includes('SIGNATURE_EMPTY') ? 'La firma está vacía.'
      : data?.message?.includes('SIGNATURE_ROLE') ? 'El firmante no corresponde a esta modalidad.'
      : data?.message?.includes('RECEPTION_LOCATION_REQUIRED') ? 'Indique la ubicación inicial de la pieza.'
      : data?.message?.includes('RECEPTION_REQUIRES_FORMALIZATION') ? 'La recepción física se habilita después de formalizar.'
      : data?.message?.includes('CONTRACT_NOT_FORMALIZED') ? 'El documento oficial se imprime desde el snapshot, cuando el ingreso esté formalizado.'
      : data?.message?.includes('MODALITY_IMMUTABLE') ? 'La modalidad no se puede cambiar después de crear el expediente.'
      : data?.message?.includes('RETURN_LOAN_ONLY') ? 'La devolución corresponde solo a un préstamo temporal.'
      : data?.message?.includes('RETURN_REQUIRES_RECEIVED') ? 'Solo se puede devolver un préstamo que ya fue recibido.'
      : data?.message?.includes('RETURN_DATE_REQUIRED') ? 'Indique la fecha efectiva de devolución.'
      : data?.message?.includes('RETURN_DATE_BEFORE_INTAKE') ? 'La fecha de devolución no puede ser anterior a la fecha de ingreso.'
      : data?.message?.includes('RETURN_DATE_IN_FUTURE') ? 'La fecha de devolución no puede ser posterior a hoy.'
      : data?.message?.includes('RETURN_CONDITION_REQUIRED') ? 'Seleccione la condición de la pieza al devolver.'
      : data?.message?.includes('RETURN_RECEIVER_REQUIRED') ? 'Indique quién recibe la pieza en representación del prestamista.'
      : data?.message?.includes('CLOSE_REQUIRES_RETURN') ? 'El cierre requiere que la devolución ya esté registrada.'
      : data?.message?.includes('RETURN_SIGNATURE_REQUIRED') ? 'Falta la firma de quien recibe la devolución.'
      : data?.message?.includes('RETURN_IMMUTABLE') ? 'La devolución ya registrada no se puede reescribir.'
      : data?.message?.includes('INVALID_MEASUREMENT') ? 'Revise las medidas. Use números y la unidad correspondiente.'
      : data?.message?.includes('PHOTO_ROLE_IN_USE') ? 'Esa posición de fotografía ya tiene una imagen activa.'
      : data?.message?.includes('INVALID_ATTACHMENT_KIND') ? 'Seleccione el tipo de anejo.'
      : data?.code === '23505' ? 'Ese número de inventario ya existe. Consulte la pieza antes de crear otra.'
      : response.status === 409 || data?.code === 'PT409'
      ? 'Otra persona modificó esta pieza. Recargue antes de volver a guardar; sus cambios no se han sobrescrito.'
      : response.status === 403 || data?.code === '42501' ? 'Su cuenta no tiene permiso para esta operación de Colecciones.'
      : response.status === 401 ? 'La sesión venció. Vuelva a iniciar sesión.'
      : 'No se pudo completar la operación en Colecciones. Revise los campos e intente nuevamente.';
    console.error(data || response.status);
    const error = new Error(message); error.status = response.status; error.code = data?.code; throw error;
  }
  return data;
}
async function collectionRows(table, filter = '') {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const page = await collectionRequest(`/rest/v1/${table}?select=*&order=created_at.asc,id.asc&limit=500&offset=${offset}${filter}`, undefined, 'GET');
    if (!Array.isArray(page)) throw Error('No se pudo confirmar la lectura de Colecciones.');
    rows.push(...page); if (page.length < 500) return rows;
  }
}
async function collectionHistory(id) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const page = await collectionRequest(`/rest/v1/collection_history?select=*&item_id=eq.${encodeURIComponent(id)}&order=occurred_at.desc,id.desc&limit=500&offset=${offset}`, undefined, 'GET');
    if (!Array.isArray(page)) throw Error('No se pudo confirmar el historial.');
    rows.push(...page); if(page.length < 500) return rows;
  }
}
async function collectionSave(item, previous, reason) {
  return collectionRequest('/rest/v1/rpc/collection_save', {
    p_id: previous?.id || null, p_expected_version: previous?.version || null, p_item: item, p_reason: reason
  }, 'POST', {}, collectionSaveTimeoutMs);
}
async function collectionCreateEntry(item, accession, reason, requestId) {
  const payload = { ...item };
  delete payload.accession_number;
  return collectionRequest('/rest/v1/rpc/collection_create_catalog_entry', {
    p_item: payload, p_accession: accession, p_reason: reason, p_request_id: requestId
  }, 'POST', {}, collectionSaveTimeoutMs);
}
async function collectionValidatePhoto(file) {
  const invalid = 'El archivo seleccionado no contiene una fotografía JPG, PNG o WEBP válida. Seleccione la imagen original e intente nuevamente.';
  if (file.size > 10485760) throw Error('Cada fotografía debe pesar hasta 10 MB.');
  if (!file.size) throw Error(invalid);
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const matches = (signature, offset = 0) => signature.every((byte, index) => bytes[offset + index] === byte);
  const format = matches([0xff, 0xd8, 0xff]) ? 'jpeg'
    : matches([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ? 'png'
    : matches([0x52, 0x49, 0x46, 0x46]) && matches([0x57, 0x45, 0x42, 0x50], 8) ? 'webp' : null;
  const extension = file.name.split('.').pop().toLowerCase();
  if (!format || file.type !== `image/${format}` ||
      !(format === 'jpeg' ? ['jpg', 'jpeg'].includes(extension) : extension === format)) throw Error(invalid);
  return format === 'jpeg' ? 'jpg' : format;
}
async function collectionStorePhoto(item, file) {
  const ext = await collectionValidatePhoto(file);
  const id = crypto.randomUUID(), path = `${item.museum_id}/${item.id}/${id}.${ext}`;
  await collectionRequest(`/storage/v1/object/collection-photos/${path}`, file, 'POST', { 'Content-Type': file.type, 'x-upsert': 'false' }, collectionPhotoUploadTimeoutMs);
  return { id, path };
}
async function collectionUpload(item, file, caption, role) {
  const { id, path } = await collectionStorePhoto(item, file);
  // Never overwrite or delete a previous image, including on a failed attachment.
  if (role) {
    return collectionRequest('/rest/v1/rpc/collection_attach_photo_role', {
      p_id: item.id, p_expected_version: item.version, p_photo_id: id, p_path: path, p_caption: caption, p_role: role
    }, 'POST', {}, collectionPhotoAttachTimeoutMs);
  }
  return collectionRequest('/rest/v1/rpc/collection_attach_photo', {
    p_id: item.id, p_expected_version: item.version, p_photo_id: id, p_path: path, p_caption: caption
  }, 'POST', {}, collectionPhotoAttachTimeoutMs);
}
async function collectionStoreAccessionFile(accession, file) {
  const extension = file.name.split('.').pop().toLowerCase();
  const allowed = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  if (file.size > 10485760) throw Error('Cada anejo debe pesar hasta 10 MB.');
  if (!allowed[extension] || file.type !== allowed[extension]) throw Error('El anejo debe ser PDF, JPG, PNG o WEBP.');
  if (extension === 'pdf') {
    const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (String.fromCharCode(...header) !== '%PDF-') throw Error('El archivo PDF no es válido.');
  } else await collectionValidatePhoto(file);
  const id = crypto.randomUUID();
  const path = `${accession.museum_id}/${accession.id}/${id}.${extension === 'jpeg' ? 'jpg' : extension}`;
  await collectionRequest(`/storage/v1/object/collection-accession-files/${path}`, file, 'POST', { 'Content-Type': file.type, 'x-upsert': 'false' }, collectionPhotoUploadTimeoutMs);
  return { id, path };
}
async function collectionUploadAccessionFile(accession, file, kind, description) {
  const { id, path } = await collectionStoreAccessionFile(accession, file);
  return collectionRequest('/rest/v1/rpc/collection_attach_accession_file', {
    p_accession_id: accession.id, p_file_id: id, p_path: path, p_kind: kind, p_description: description || ''
  }, 'POST', {}, collectionPhotoAttachTimeoutMs);
}
async function collectionReopenIngressCorrection(id, version) {
  return collectionRequest('/rest/v1/rpc/collection_reopen_ingress_correction', {
    p_id: id, p_expected_version: version
  }, 'POST', {}, collectionSaveTimeoutMs);
}
async function collectionUpdateIngressDraft(id, version, item, accession, reason) {
  const payload = { ...item };
  delete payload.accession_number;
  return collectionRequest('/rest/v1/rpc/collection_update_ingress_draft', {
    p_id: id, p_expected_version: version, p_item: payload, p_accession: accession, p_reason: reason
  }, 'POST', {}, collectionSaveTimeoutMs);
}
async function collectionRecordSignature(id, version, role, method, visual) {
  return collectionRequest('/rest/v1/rpc/collection_record_signature', {
    p_id: id, p_expected_version: version, p_signer_role: role, p_capture_method: method, p_visual: visual
  }, 'POST', {}, collectionSaveTimeoutMs);
}
async function collectionFormalizeAccession(id, version) {
  return collectionRequest('/rest/v1/rpc/collection_formalize_accession', {
    p_id: id, p_expected_version: version
  }, 'POST', {}, collectionSaveTimeoutMs);
}
async function collectionReceiveAccession(id, version, location, notes, method, visual) {
  return collectionRequest('/rest/v1/rpc/collection_receive_accession', {
    p_id: id, p_expected_version: version, p_location: location, p_notes: notes, p_capture_method: method, p_visual: visual
  }, 'POST', {}, collectionSaveTimeoutMs);
}
async function collectionReturnAccession(id, version, returnedOn, condition, notes, receivedBy, method, visual) {
  return collectionRequest('/rest/v1/rpc/collection_return_accession', {
    p_id: id, p_expected_version: version, p_returned_on: returnedOn, p_condition: condition,
    p_notes: notes, p_return_received_by: receivedBy, p_capture_method: method, p_visual: visual
  }, 'POST', {}, collectionSaveTimeoutMs);
}
async function collectionCloseAccession(id, version) {
  return collectionRequest('/rest/v1/rpc/collection_close_accession', {
    p_id: id, p_expected_version: version
  }, 'POST', {}, collectionSaveTimeoutMs);
}
async function collectionContractDocument(id) {
  return collectionRequest('/rest/v1/rpc/collection_contract_document', { p_id: id }, 'POST', {}, collectionSaveTimeoutMs);
}
async function collectionReplacePhoto(item, previous, file, reason) {
  if (!reason || reason.trim().length < 3 || reason.trim().length > 2000) throw Error('Indique la razón de la sustitución.');
  const { id, path } = await collectionStorePhoto(item, file);
  return collectionRequest('/rest/v1/rpc/collection_replace_photo', {
    p_id: item.id, p_expected_version: item.version, p_old_photo_id: previous.id,
    p_photo_id: id, p_path: path, p_reason: reason.trim()
  });
}
async function collectionPhotoUrl(path) {
  if (!path || path.includes('..') || path.startsWith('/')) throw Error('La referencia de la fotografía no es válida.');
  // Read the private object with the existing authenticated session.
  // This avoids depending on signed-URL response formats while preserving Storage RLS.
  return `${supabaseUrl}/storage/v1/object/authenticated/collection-photos/${path.split('/').map(encodeURIComponent).join('/')}`;
}
async function collectionLoadPhoto(img, path) {
  const url = await collectionPhotoUrl(path);
  const response = await fetch(url, { headers: await supabaseAuthHeaders(), cache: 'no-store' });
  if (!response.ok) throw Error('No se pudo abrir la fotografía.');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw Error('El archivo protegido no es una imagen válida.');
  const objectUrl = URL.createObjectURL(blob);
  img.src = objectUrl;
  img.addEventListener('load', () => URL.revokeObjectURL(objectUrl), { once:true });
  img.addEventListener('error', () => URL.revokeObjectURL(objectUrl), { once:true });
}
