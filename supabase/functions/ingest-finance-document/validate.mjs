// Display name only. The storage path never uses this value.
// Trim surrounding space. Reject separators, dot-segments, controls, and names
// the finance_documents filename check would refuse.

export const MAX_INVOICE_BYTES = 15728640;

const MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png"
};

function coded(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function startsWith(bytes, signature) {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

export function detectInvoiceMime(bytes) {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  return null;
}

export function validateInvoiceFilename(filename) {
  if (typeof filename !== "string") throw coded("INVALID_FILENAME");
  const name = filename.trim();
  if (name.length < 1 || name.length > 200) throw coded("INVALID_FILENAME");
  if (name === "." || name === ".." || name.includes("/") || name.includes("\\")) {
    throw coded("INVALID_FILENAME");
  }
  for (let index = 0; index < name.length; index += 1) {
    if (name.charCodeAt(index) < 32) throw coded("INVALID_FILENAME");
  }
  return name;
}

function extensionMime(filename) {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0 || dot === filename.length - 1) return null;
  return MIME_BY_EXTENSION[filename.slice(dot + 1).toLowerCase()] || "other";
}

function declaredMime(value) {
  if (typeof value !== "string") return null;
  const mime = value.split(";")[0].trim().toLowerCase();
  if (!mime || mime === "application/octet-stream") return null;
  return mime;
}

export function validateInvoiceFile(bytes, filename, declaredType) {
  const content = bytes instanceof Uint8Array ? bytes : null;
  if (!content || content.byteLength === 0) throw coded("EMPTY_FILE");
  if (content.byteLength > MAX_INVOICE_BYTES) throw coded("FILE_TOO_LARGE");
  const mime = detectInvoiceMime(content);
  if (!mime) throw coded("INVALID_FILE_CONTENT");
  const declared = declaredMime(declaredType);
  if (declared && declared !== mime) throw coded("MIME_MISMATCH");
  const safeName = validateInvoiceFilename(filename);
  const extension = extensionMime(safeName);
  if (extension && extension !== mime) throw coded("EXTENSION_MISMATCH");
  return { mime, filename: safeName };
}
