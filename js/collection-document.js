const collectionDocumentRoles = Object.freeze({
  propietario: 'Propietario / Prestamista',
  donante: 'Donante',
  director: 'Director del Museo',
  receptor: 'Recepción del Museo',
  receptor_devolucion: 'Persona que recibe la devolución'
});
const collectionDocumentModalities = Object.freeze({
  prestamo_temporal: 'Préstamo temporal',
  donacion_permanente: 'Donación permanente',
  catalogacion_directa: 'Catalogación directa'
});
const collectionDocumentPhotoRoles = Object.freeze({
  frontal: 'Frontal',
  posterior: 'Posterior',
  lateral: 'Lateral',
  adicional: 'Adicional'
});
const collectionDocumentPhotoOrder = Object.freeze(['frontal', 'posterior', 'lateral', 'adicional']);

function collectionDocumentUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function formatDocumentWhen(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  const timestamp = /^\d{4}-\d{2}-\d{2}T/.test(text);
  if (!dateOnly && !timestamp) return text;
  const date = dateOnly
    ? new Date(Date.UTC(...text.split('-').map(Number).map((part, index) => index === 1 ? part - 1 : part), 16, 0, 0))
    : new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  const parts = new Intl.DateTimeFormat('es-PR', {
    timeZone: 'America/Puerto_Rico',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(dateOnly ? {} : { hour: 'numeric', minute: '2-digit', hour12: true })
  }).formatToParts(date);
  const pick = type => (parts.find(part => part.type === type)?.value || '').replace(/[\u202f\u00a0]/g, ' ');
  const written = `${pick('day')} de ${pick('month')} de ${pick('year')}`;
  if (dateOnly) return written;
  return `${written}, ${pick('hour')}:${pick('minute')} ${pick('dayPeriod').replace(/\s+/g, ' ').trim()}`;
}

function presentDocumentValue(value) {
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(text.trim()) ? formatDocumentWhen(text.trim()) : text;
}

function bindCollectionDocument() {
  const host = document.querySelector('#collection-document');
  if (!host || typeof canReadCollections !== 'function' || !canReadCollections()) return;
  document.querySelector('#document-print').onclick = () => window.print();
  const expediente = new URLSearchParams(location.search).get('expediente');
  if (!collectionDocumentUuid(expediente)) {
    host.textContent = 'El documento se abre desde un expediente formalizado.';
    return;
  }
  loadCollectionDocument(host, expediente).catch(error => {
    console.error(error);
    host.textContent = error.message || 'El documento contractual se imprime desde el snapshot, cuando el ingreso está formalizado.';
  });
}

async function loadCollectionDocument(host, expediente) {
  const printed = await collectionContractDocument(expediente);
  const events = await collectionRequest(`/rest/v1/collection_accession_events?select=*&accession_id=eq.${encodeURIComponent(expediente)}&order=occurred_at.asc,id.asc`, undefined, 'GET');
  if (!Array.isArray(events)) throw Error('No se pudo leer el historial del expediente.');
  const ids = new Set((printed.contract_snapshot?.signatures || []).map(signature => signature.id));
  events.forEach(event => {
    const signatureId = event.after_value?.signature_id || event.after_value?.return_signature_id;
    if (collectionDocumentUuid(signatureId)) ids.add(signatureId);
  });
  const signatures = ids.size
    ? await collectionRequest(`/rest/v1/collection_accession_signatures?select=*&id=in.(${[...ids].join(',')})`, undefined, 'GET')
    : [];
  if (!Array.isArray(signatures)) throw Error('No se pudieron leer las firmas referenciadas.');
  renderCollectionDocument(host, printed, events, signatures);
}

function renderCollectionDocument(host, printed, events, signatures) {
  const snapshot = printed?.contract_snapshot;
  const source = snapshot?.document;
  if (!source) {
    host.textContent = 'El documento contractual se imprime desde el snapshot, cuando el ingreso está formalizado.';
    return;
  }
  const byId = new Map(signatures.map(signature => [signature.id, signature]));
  host.replaceChildren();
  host.append(sectionHeading());
  const identity = document.createElement('section');
  identity.className = 'document-section document-identity';
  identity.append(definitionList([
    ['Número de expediente', source.file_number],
    ['Número de inventario', source.inventory_number],
    ['Modalidad', collectionDocumentModalities[source.modality] || source.modality],
    ['Fecha de formalización', formatDocumentWhen(printed.contract_snapshot_at)]
  ]));
  if (printed.integrity_ok === false) {
    const warning = document.createElement('p');
    warning.textContent = 'La huella guardada no coincide con el snapshot. No se reconstruyó el documento desde la ficha viva.';
    identity.append(warning);
  }
  host.append(identity);
  host.append(factSection('Pieza', [
    ['Clasificación', source.category],
    ['Tipo', source.object_type || source.personal_object_description],
    ['Nombre / título', source.title],
    ['Autor / artista / intérprete / fabricante', source.author],
    ['Fecha / período', source.dating],
    ['Materiales', source.materials],
    ['Procedencia', source.provenance],
    ['Descripción', source.description]
  ]));
  host.append(photoSection(source.photos));
  host.append(factSection('Dimensiones', [
    ['Alto', measure(source.height, source.height_unit)],
    ['Ancho', measure(source.width, source.width_unit)],
    ['Profundidad', measure(source.depth, source.depth_unit)],
    ['Peso', measure(source.weight, source.weight_unit)],
    ['Otras medidas', source.other_measurements]
  ]));
  host.append(factSection('Conservación', [
    ['Condición', source.physical_condition],
    ['Observaciones', source.conservation_notes]
  ]));
  host.append(factSection('Valor', [
    ['Valor estimado', source.estimated_value ? `${source.estimated_value} USD` : '']
  ]));
  const partyLabel = source.modality === 'donacion_permanente' ? 'Donante' : 'Prestamista';
  host.append(factSection(partyLabel, [
    ['Nombre', source.party_name],
    ['Entidad', source.party_entity],
    ['Correo', source.party_email],
    ['Teléfono', source.party_phone],
    ['Dirección', source.party_address]
  ]));
  host.append(factSection('Modalidad y fechas', [
    ['Inicio', source.started_on],
    ['Devolución estimada', source.expected_return_on],
    ['Propósito', source.purpose],
    ['Detalle del propósito', source.purpose_details],
    ['Exhibición / actividad', source.activity_name],
    ['Fecha de la actividad', source.activity_on],
    ['Ubicación de la actividad', source.activity_location]
  ]));
  host.append(factSection('Anejos', (source.attachments || []).length
    ? source.attachments.map(file => [file.kind, collectionDocumentUuid(file.description) ? '' : file.description])
    : [['Referencias', 'Sin anejos en el snapshot']]));
  const terms = document.createElement('section');
  terms.className = 'document-section';
  // El cotejo del formulario municipal completo sigue pendiente de forma interna y no se imprime.
  const termsTitle = document.createElement('h2');
  termsTitle.textContent = 'Términos oficiales';
  const acceptance = document.createElement('p');
  acceptance.textContent = source.acceptance || '';
  terms.append(termsTitle, acceptance);
  host.append(terms);
  host.append(signatureSection('Firmas contractuales', snapshot.signatures || [], byId));
  const reception = events.find(event => event.action === 'pieza_recibida');
  if (reception) host.append(operationalSection('Recepción del Museo', reception, byId, [
    ['Ubicación inicial', reception.after_value?.initial_location],
    ['Fecha y hora', formatDocumentWhen(reception.after_value?.received_at)],
    ['Observaciones', reception.after_value?.reception_notes],
    ['Certificación', 'Certifico que la información contenida en este formulario es correcta y que la pieza fue recibida conforme a las condiciones descritas.']
  ]));
  const returned = events.find(event => event.action === 'devolucion');
  if (returned) {
    const closure = document.createElement('section');
    closure.className = 'document-section';
    const closureTitle = document.createElement('h2');
    closureTitle.textContent = 'Cierre del préstamo';
    const closureNote = document.createElement('p');
    closureNote.textContent = 'Este cierre no modifica el contrato original.';
    closure.append(closureTitle, closureNote, definitionList([
      ['Expediente', source.file_number],
      ['Número de inventario', source.inventory_number],
      ['Pieza', source.title],
      ['Prestamista', source.party_name],
      ['Fecha de ingreso', source.started_on],
      ['Fecha de devolución', returned.after_value?.returned_on],
      ['Hora del evento', returned.after_value?.returned_at],
      ['Condición al ingreso', returned.after_value?.ingress_condition],
      ['Condición a la devolución', returned.after_value?.return_condition],
      ['Observaciones', returned.after_value?.return_notes],
      ['Entregado por', returned.after_value?.delivered_by_name],
      ['Recibido por', returned.after_value?.return_received_by]
    ]));
    const signatureId = returned.after_value?.signature_id;
    closure.append(signatureBlock(byId.get(signatureId), signatureId));
    const closed = events.find(event => event.action === 'cierre');
    if (closed) {
      const closedLine = document.createElement('p');
      closedLine.textContent = `Expediente cerrado: ${formatDocumentWhen(closed.occurred_at || closed.after_value?.closed_at || '')}`;
      closure.append(closedLine);
    }
    host.append(closure);
  }
  host.append(integrityBlock(printed.contract_hash));
  host.append(documentFooter(source));
}

function sectionHeading() {
  const header = document.createElement('header');
  header.className = 'document-masthead';
  const logo = document.createElement('img');
  logo.className = 'document-logo';
  logo.src = 'images/logo-horizontal.jpg';
  logo.alt = 'Museo de la Música de Puerto Rico';
  const kicker = document.createElement('p');
  kicker.className = 'document-kicker';
  kicker.textContent = 'MUSEO DE LA MÚSICA DE PUERTO RICO';
  const heading = document.createElement('h1');
  heading.textContent = 'DOCUMENTO DE INGRESO DE ARTÍCULO DE COLECCIÓN';
  header.append(logo, kicker, heading);
  return header;
}

function documentFooter(source) {
  const footer = document.createElement('footer');
  footer.className = 'document-footer';
  ['Museo de la Música de Puerto Rico', `Número de expediente: ${source.file_number || ''}`, `Número de inventario: ${source.inventory_number || ''}`].forEach(line => {
    const paragraph = document.createElement('p');
    paragraph.textContent = line;
    footer.append(paragraph);
  });
  return footer;
}

function integrityBlock(hash) {
  const section = document.createElement('section');
  section.className = 'document-integrity';
  const label = document.createElement('p');
  label.textContent = 'Huella de integridad (SHA-256):';
  const value = document.createElement('p');
  value.className = 'document-hash';
  value.textContent = hash || '';
  section.append(label, value);
  return section;
}

function factSection(title, rows) {
  const section = document.createElement('section');
  section.className = 'document-section';
  const heading = document.createElement('h2');
  heading.textContent = title;
  section.append(heading, definitionList(rows));
  return section;
}

function definitionList(rows) {
  const list = document.createElement('dl');
  rows.filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '').forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'document-row';
    const term = document.createElement('dt');
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.textContent = presentDocumentValue(value);
    row.append(term, detail);
    list.append(row);
  });
  if (!list.childElementCount) {
    const detail = document.createElement('dd');
    detail.textContent = 'No registrado en el snapshot.';
    list.append(detail);
  }
  return list;
}

function measure(value, unit) {
  if (value === undefined || value === null || value === '') return '';
  return `${value}${unit ? ` ${unit}` : ''}`;
}

function photoSection(photos) {
  const section = document.createElement('section');
  section.className = 'document-section document-photos-section';
  const heading = document.createElement('h2');
  heading.textContent = 'Fotografías';
  const grid = document.createElement('div');
  grid.className = 'document-photos';
  const ordered = [...(photos || [])].sort((left, right) => {
    const leftIndex = collectionDocumentPhotoOrder.indexOf(left.role);
    const rightIndex = collectionDocumentPhotoOrder.indexOf(right.role);
    return (leftIndex < 0 ? collectionDocumentPhotoOrder.length : leftIndex) - (rightIndex < 0 ? collectionDocumentPhotoOrder.length : rightIndex);
  });
  ordered.forEach(photo => {
    const figure = document.createElement('figure');
    figure.className = 'document-photo';
    const image = document.createElement('img');
    const label = collectionDocumentPhotoRoles[photo.role] || photo.role || 'Fotografía';
    image.alt = label;
    const caption = document.createElement('figcaption');
    caption.textContent = label;
    figure.append(image, caption);
    grid.append(figure);
    if (photo.path && typeof collectionLoadPhoto === 'function') {
      collectionLoadPhoto(image, photo.path).catch(() => {
        caption.textContent = `${label}. La referencia histórica se conserva; la imagen no pudo abrirse.`;
      });
    }
  });
  if (!grid.childElementCount) {
    const empty = document.createElement('p');
    empty.textContent = 'El snapshot no contiene referencias de fotografías.';
    section.append(heading, empty);
    return section;
  }
  section.append(heading, grid);
  return section;
}

function signatureSection(title, references, byId) {
  const section = document.createElement('section');
  section.className = 'document-section document-signatures';
  const heading = document.createElement('h2');
  heading.textContent = title;
  section.append(heading);
  references.forEach(reference => section.append(signatureBlock(byId.get(reference.id), reference.id, reference)));
  if (!references.length) {
    const empty = document.createElement('p');
    empty.textContent = 'El snapshot no contiene firmas.';
    section.append(empty);
  }
  return section;
}

function operationalSection(title, event, byId, rows) {
  const section = document.createElement('section');
  section.className = 'document-section document-reception';
  const heading = document.createElement('h2');
  heading.textContent = title;
  section.append(heading, definitionList(rows));
  section.append(signatureBlock(byId.get(event.after_value?.signature_id), event.after_value?.signature_id));
  return section;
}

function signatureBlock(signature, signatureId, reference) {
  const block = document.createElement('div');
  block.className = 'signature-block';
  const roleName = collectionDocumentRoles[signature?.signer_role || reference?.signer_role] || signature?.signer_role || reference?.signer_role || 'Firma';
  const name = document.createElement('p');
  name.className = 'signature-name';
  name.textContent = signature?.signer_name || reference?.signer_name || 'Nombre en el snapshot';
  const role = document.createElement('p');
  role.className = 'signature-role';
  role.textContent = roleName;
  block.append(name, role);
  const raster = signature?.visual?.raster?.dataUrl;
  if (typeof raster === 'string' && raster.startsWith('data:image/png;base64,')) {
    const image = document.createElement('img');
    image.alt = `Firma de ${roleName}`;
    image.src = raster;
    block.append(image);
  } else {
    const missing = document.createElement('p');
    missing.textContent = 'No se sustituyó por otra firma.';
    block.append(missing);
  }
  const when = formatDocumentWhen(signature?.signed_at || reference?.signed_at || '');
  if (when) {
    const dated = document.createElement('p');
    dated.className = 'signature-when';
    dated.textContent = when;
    block.append(dated);
  }
  return block;
}
