/* Uses the existing authenticated session; no local persistence of catalog records. */
async function collectionRequest(path, body, method = 'POST', extraHeaders = {}) {
  const response = await fetch(supabaseUrl + path, {
    method, headers: { ...(await supabaseAuthHeaders()), ...extraHeaders },
    body: body === undefined ? undefined : body instanceof Blob ? body : JSON.stringify(body)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.message?.includes('COLLECTION_PHOTO_LIMIT') ? 'Esta pieza ya tiene el máximo de 4 fotografías.'
      : data?.code === '23505' ? 'Ese número de inventario ya existe. Consulte la pieza antes de crear otra.'
      : response.status === 409 || data?.code === 'PT409'
      ? 'Otra persona modificó esta pieza. Recargue antes de volver a guardar; sus cambios no se han sobrescrito.'
      : response.status === 403 || data?.code === '42501' ? 'Su cuenta no tiene permiso para esta operación de Colecciones.'
      : response.status === 401 ? 'La sesión venció. Vuelva a iniciar sesión.'
      : 'No se pudo completar la operación en Colecciones. Revise los campos e intente nuevamente.';
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
  });
}
async function collectionUpload(item, file, caption) {
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
  if (!ext || !file.size || file.size > 10485760) throw Error('Seleccione una imagen JPG, PNG o WEBP de hasta 10 MB.');
  const id = crypto.randomUUID(), path = `${item.museum_id}/${item.id}/${id}.${ext}`;
  await collectionRequest(`/storage/v1/object/collection-photos/${path}`, file, 'POST', { 'Content-Type': file.type, 'x-upsert': 'false' });
  // Never overwrite or delete a previous image, including on a failed attachment.
  return collectionRequest('/rest/v1/rpc/collection_attach_photo', {
    p_id: item.id, p_expected_version: item.version, p_photo_id: id, p_path: path, p_caption: caption
  });
}
async function collectionPhotoUrl(path) {
  if (!path || path.includes('..') || path.startsWith('/')) throw Error('La referencia de la fotografía no es válida.');
  // Read the private object with the existing authenticated session.
  // This avoids depending on signed-URL response formats while preserving Storage RLS.
  return `${supabaseUrl}/storage/v1/object/authenticated/collection-photos/${path.split('/').map(encodeURIComponent).join('/')}`;
}
async function collectionLoadPhoto(img, path) {
  const response = await fetch(collectionPhotoUrl(path), { headers: await supabaseAuthHeaders(), cache: 'no-store' });
  if (!response.ok) throw Error('No se pudo abrir la fotografía.');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw Error('El archivo protegido no es una imagen válida.');
  const objectUrl = URL.createObjectURL(blob);
  img.src = objectUrl;
  img.addEventListener('load', () => URL.revokeObjectURL(objectUrl), { once:true });
  img.addEventListener('error', () => URL.revokeObjectURL(objectUrl), { once:true });
}
