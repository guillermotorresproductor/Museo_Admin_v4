import { validateInvoiceFile } from "./validate.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const MESSAGES = {
  AUTH_REQUIRED: "Debe iniciar sesión.",
  FORBIDDEN: "No tiene permiso para registrar facturas.",
  MODULE_FORBIDDEN: "Esta operación pertenece a Administración.",
  PROFILE_REQUIRED: "La cuenta no tiene un perfil válido.",
  MUSEUM_REQUIRED: "La cuenta no tiene un museo asignado.",
  FILE_REQUIRED: "Falta el archivo.",
  EMPTY_FILE: "El archivo está vacío.",
  FILE_TOO_LARGE: "El archivo supera 15 MiB.",
  INVALID_FILE_CONTENT: "El archivo no es un PDF, JPEG o PNG válido.",
  MIME_MISMATCH: "El tipo declarado no coincide con el contenido.",
  EXTENSION_MISMATCH: "La extensión no corresponde al contenido.",
  INVALID_FILENAME: "El nombre del archivo no es válido.",
  DUPLICATE_DOCUMENT: "Esta factura ya está registrada.",
  UPLOAD_FAILED: "No se pudo guardar el archivo.",
  INGEST_FAILED: "No se pudo registrar la factura.",
  INGEST_UNCERTAIN: "No se pudo confirmar si la factura quedó registrada.",
  COMPENSATION_FAILED: "No se pudo registrar la factura ni retirar el archivo temporal."
};

const STATUS = {
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  MODULE_FORBIDDEN: 403,
  PROFILE_REQUIRED: 403,
  MUSEUM_REQUIRED: 403,
  DUPLICATE_DOCUMENT: 409,
  INGEST_UNCERTAIN: 503,
  COMPENSATION_FAILED: 500,
  INGEST_FAILED: 500,
  UPLOAD_FAILED: 500
};

function coded(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function result(code, extra = {}) {
  const body = { code, error: MESSAGES[code] || MESSAGES.INGEST_FAILED };
  if (extra.document_id) body.document_id = extra.document_id;
  return { httpStatus: STATUS[code] || 400, body };
}

function success(row) {
  return {
    httpStatus: 201,
    body: {
      document_id: row.document_id || row.id,
      status: row.status,
      original_filename: row.original_filename,
      original_mime: row.original_mime,
      original_byte_size: row.original_byte_size,
      uploaded_at: row.uploaded_at
    }
  };
}

export function canonicalOriginalPath(museumId, documentId) {
  if (!UUID.test(museumId) || !UUID.test(documentId)) throw coded("INGEST_FAILED");
  return `${museumId}/${documentId}/original`;
}

export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

function authorize(session) {
  if (!session?.userId) throw coded("AUTH_REQUIRED");
  if (session.financeWrite !== true || session.financeRead !== true) throw coded("FORBIDDEN");
  if (session.administration !== true) throw coded("MODULE_FORBIDDEN");
  if (session.profileStatus !== "active") throw coded("PROFILE_REQUIRED");
  const museumId = String(session.museumId || "").toLowerCase();
  if (!UUID.test(museumId)) throw coded("MUSEUM_REQUIRED");
  return { userId: String(session.userId).toLowerCase(), museumId };
}

async function compensate(db, storage, museumId, documentId, path, failure) {
  let existing;
  try {
    existing = await db.findById(museumId, documentId);
  } catch {
    return result("INGEST_UNCERTAIN");
  }
  if (existing) return success(existing);
  try {
    await storage.removeOriginal(path);
  } catch {
    return result("COMPENSATION_FAILED");
  }
  if (failure?.code === "DUPLICATE_DOCUMENT") {
    return result("DUPLICATE_DOCUMENT", { document_id: failure.document_id || null });
  }
  return result(failure?.code === "INSERT_UNCERTAIN" ? "INGEST_FAILED" : "INGEST_FAILED");
}

export async function ingestInvoice({ session, file, db, storage, newId }) {
  let uploadedPath = null;
  try {
    const actor = authorize(session);
    if (!file?.bytes) throw coded("FILE_REQUIRED");
    const checked = validateInvoiceFile(file.bytes, file.filename, file.declaredType);
    const sha256 = await sha256Hex(file.bytes);
    const duplicate = await db.findActiveDuplicate(actor.museumId, sha256);
    if (duplicate?.id) return result("DUPLICATE_DOCUMENT", { document_id: duplicate.id });

    const documentId = String(newId()).toLowerCase();
    const path = canonicalOriginalPath(actor.museumId, documentId);
    await storage.uploadOriginal({ path, bytes: file.bytes, mime: checked.mime, upsert: false });
    uploadedPath = path;

    let created;
    try {
      created = await db.insertPending({
        actorId: actor.userId,
        museumId: actor.museumId,
        documentId,
        filename: checked.filename,
        mime: checked.mime,
        byteSize: file.bytes.byteLength,
        sha256
      });
    } catch (error) {
      return compensate(db, storage, actor.museumId, documentId, path, error);
    }

    if (created?.code === "DUPLICATE_DOCUMENT") {
      return compensate(db, storage, actor.museumId, documentId, path, created);
    }
    return success(created);
  } catch (error) {
    if (uploadedPath) return result("INGEST_UNCERTAIN");
    const code = error?.code && MESSAGES[error.code] ? error.code : "INGEST_FAILED";
    return result(code);
  }
}
