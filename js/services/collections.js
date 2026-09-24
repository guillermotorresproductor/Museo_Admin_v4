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
async function collectionUpload(item, file, caption) {
  const { id, path } = await collectionStorePhoto(item, file);
  // Never overwrite or delete a previous image, including on a failed attachment.
  return collectionRequest('/rest/v1/rpc/collection_attach_photo', {
    p_id: item.id, p_expected_version: item.version, p_photo_id: id, p_path: path, p_caption: caption
  }, 'POST', {}, collectionPhotoAttachTimeoutMs);
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
