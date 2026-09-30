import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ingestInvoice, sha256Hex } from "../functions/ingest-finance-document/ingest.mjs";
import { MAX_INVOICE_BYTES, validateInvoiceFile } from "../functions/ingest-finance-document/validate.mjs";

const museumA = "fd300000-0000-4000-8000-0000000000a1";
const museumB = "fd300000-0000-4000-8000-0000000000b1";
const userA = "fd300000-0000-4000-8000-0000000000a2";
const pdf = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

function session(overrides = {}) {
  return {
    userId: userA,
    museumId: museumA,
    profileStatus: "active",
    financeWrite: true,
    financeRead: true,
    administration: true,
    ...overrides
  };
}

function backend() {
  const rows = [];
  let queue = Promise.resolve();
  const db = {
    rows,
    lookupFails: false,
    failMode: null,
    async findActiveDuplicate(museumId, sha256) {
      return rows.find((row) => row.museum_id === museumId && row.original_sha256 === sha256 && row.status !== "rejected") || null;
    },
    insertPending(row) {
      const run = queue.then(() => insertPending(db, row));
      queue = run.then(() => {}, () => {});
      return run;
    },
    async findById(museumId, documentId) {
      if (db.lookupFails) throw new Error("lookup failed");
      return rows.find((row) => row.museum_id === museumId && row.id === documentId) || null;
    }
  };
  const storage = {
    objects: new Map(),
    uploads: [],
    removed: [],
    async uploadOriginal(upload) {
      if (upload.upsert !== false) throw Object.assign(new Error("UPSERT"), { code: "UPLOAD_FAILED" });
      if (storage.objects.has(upload.path)) throw Object.assign(new Error("exists"), { code: "UPLOAD_FAILED" });
      storage.objects.set(upload.path, upload.bytes);
      storage.uploads.push(upload);
    },
    async removeOriginal(path) {
      storage.removed.push(path);
      storage.objects.delete(path);
    }
  };
  return { db, storage };
}

function insertPending(db, row) {
  if (db.failMode === "uncertain-after-commit") {
    db.rows.push(stored(row));
    throw Object.assign(new Error("timeout"), { code: "INSERT_UNCERTAIN" });
  }
  if (db.failMode === "uncertain") throw Object.assign(new Error("timeout"), { code: "INSERT_UNCERTAIN" });
  if (db.failMode === "error") throw Object.assign(new Error("db down"), { code: "INGEST_FAILED" });
  const clash = db.rows.find((item) => item.museum_id === row.museumId && item.original_sha256 === row.sha256 && item.status !== "rejected");
  if (clash) return { code: "DUPLICATE_DOCUMENT", document_id: clash.id };
  const saved = stored(row);
  db.rows.push(saved);
  return {
    document_id: saved.id,
    status: saved.status,
    original_filename: saved.original_filename,
    original_mime: saved.original_mime,
    original_byte_size: saved.original_byte_size,
    uploaded_at: saved.uploaded_at
  };
}

function stored(row) {
  return {
    id: row.documentId,
    museum_id: row.museumId,
    status: "pending_review",
    original_filename: row.filename,
    original_mime: row.mime,
    original_byte_size: row.byteSize,
    original_sha256: row.sha256,
    uploaded_at: "2026-09-30T14:00:00.000Z",
    movement_id: null,
    vendor_name: null,
    invoice_number: null,
    invoice_date: null,
    total: null,
    budget_line_id: null,
    description: null
  };
}

function ids(...values) {
  const pending = [...values];
  return () => pending.shift();
}

test("rejects an anonymous caller, a caller without finance.write, and a caller outside administration", async () => {
  const { db, storage } = backend();
  const anonymous = await ingestInvoice({ session: null, file: { bytes: pdf, filename: "a.pdf" }, db, storage, newId: ids("fd300000-0000-4000-8000-0000000000d1") });
  assert.equal(anonymous.body.code, "AUTH_REQUIRED");
  const writer = await ingestInvoice({
    session: session({ financeWrite: false }),
    file: { bytes: pdf, filename: "a.pdf" },
    db, storage, newId: ids("fd300000-0000-4000-8000-0000000000d1")
  });
  assert.equal(writer.body.code, "FORBIDDEN");
  const reader = await ingestInvoice({
    session: session({ financeRead: false }),
    file: { bytes: pdf, filename: "a.pdf" },
    db, storage, newId: ids("fd300000-0000-4000-8000-0000000000d1")
  });
  assert.equal(reader.body.code, "FORBIDDEN");
  const otherModule = await ingestInvoice({
    session: session({ administration: false }),
    file: { bytes: pdf, filename: "a.pdf" },
    db, storage, newId: ids("fd300000-0000-4000-8000-0000000000d1")
  });
  assert.equal(otherModule.body.code, "MODULE_FORBIDDEN");
  assert.equal(storage.uploads.length, 0);
});

test("accepts real PDF, JPEG, and PNG bytes and rejects empty, oversized, mismatched, and unsafe names", () => {
  assert.equal(validateInvoiceFile(pdf, "factura.pdf", "application/pdf").mime, "application/pdf");
  assert.equal(validateInvoiceFile(jpeg, "foto.jpg", "image/jpeg").mime, "image/jpeg");
  assert.equal(validateInvoiceFile(png, "foto.png", "image/png").mime, "image/png");
  assert.equal(validateInvoiceFile(pdf, "  factura.pdf  ", "application/pdf").filename, "factura.pdf");
  assert.throws(() => validateInvoiceFile(new Uint8Array(), "a.pdf", "application/pdf"), /EMPTY_FILE/);
  const huge = new Uint8Array(MAX_INVOICE_BYTES + 1);
  huge.set(pdf);
  assert.throws(() => validateInvoiceFile(huge, "a.pdf", "application/pdf"), /FILE_TOO_LARGE/);
  assert.throws(() => validateInvoiceFile(pdf, "a.pdf", "image/png"), /MIME_MISMATCH/);
  assert.throws(() => validateInvoiceFile(Uint8Array.from([1, 2, 3, 4]), "a.pdf", "application/pdf"), /INVALID_FILE_CONTENT/);
  assert.throws(() => validateInvoiceFile(pdf, "a.txt", "application/pdf"), /EXTENSION_MISMATCH/);
  assert.throws(() => validateInvoiceFile(pdf, "../factura.pdf", "application/pdf"), /INVALID_FILENAME/);
  assert.throws(() => validateInvoiceFile(pdf, "..\\factura.pdf", "application/pdf"), /INVALID_FILENAME/);
  assert.throws(() => validateInvoiceFile(pdf, "..", "application/pdf"), /INVALID_FILENAME/);
});

test("stores the server hash at the canonical path and leaves the invoice pending", async () => {
  const { db, storage } = backend();
  const documentId = "fd300000-0000-4000-8000-0000000000d1";
  const outcome = await ingestInvoice({
    session: session({ claimedMuseumId: museumB }),
    file: { bytes: pdf, filename: "factura.pdf", declaredType: "application/pdf", clientSha: "abc" },
    db,
    storage,
    newId: ids(documentId)
  });
  const expected = createHash("sha256").update(pdf).digest("hex");
  assert.equal(await sha256Hex(pdf), expected);
  assert.equal(outcome.httpStatus, 201);
  assert.equal(outcome.body.status, "pending_review");
  assert.equal(outcome.body.document_id, documentId);
  assert.equal(outcome.body.original_path, undefined);
  assert.equal(db.rows[0].museum_id, museumA);
  assert.equal(db.rows[0].original_sha256, expected);
  assert.equal(db.rows[0].movement_id, null);
  assert.equal(db.rows[0].vendor_name, null);
  assert.equal(db.rows[0].total, null);
  assert.equal(storage.uploads[0].upsert, false);
  assert.equal(storage.uploads[0].path, `${museumA}/${documentId}/original`);
  assert.equal(storage.uploads[0].path.includes("factura.pdf"), false);
  assert.deepEqual(storage.uploads[0].bytes, pdf);
});

test("keeps museums apart and reports an exact duplicate without a second object", async () => {
  const { db, storage } = backend();
  const first = await ingestInvoice({
    session: session(),
    file: { bytes: pdf, filename: "a.pdf", declaredType: "application/pdf" },
    db, storage, newId: ids("fd300000-0000-4000-8000-0000000000d1")
  });
  const otherMuseum = await ingestInvoice({
    session: session({ museumId: museumB, userId: "fd300000-0000-4000-8000-0000000000b2" }),
    file: { bytes: pdf, filename: "a.pdf", declaredType: "application/pdf" },
    db, storage, newId: ids("fd300000-0000-4000-8000-0000000000d2")
  });
  const duplicate = await ingestInvoice({
    session: session(),
    file: { bytes: pdf, filename: "otra.pdf", declaredType: "application/pdf" },
    db, storage, newId: ids("fd300000-0000-4000-8000-0000000000d3")
  });
  assert.equal(first.httpStatus, 201);
  assert.equal(otherMuseum.httpStatus, 201);
  assert.equal(duplicate.body.code, "DUPLICATE_DOCUMENT");
  assert.equal(duplicate.body.document_id, first.body.document_id);
  assert.equal(storage.objects.size, 2);
  assert.equal(storage.removed.length, 0);
});

test("a duplicate race leaves only the winner object", async () => {
  const { db, storage } = backend();
  let waiting = 0;
  let open;
  const gate = new Promise((resolve) => { open = resolve; });
  const original = db.findActiveDuplicate.bind(db);
  db.findActiveDuplicate = async (...args) => {
    waiting += 1;
    if (waiting === 2) open();
    await gate;
    return original(...args);
  };
  const [left, right] = await Promise.all([
    ingestInvoice({
      session: session(),
      file: { bytes: pdf, filename: "a.pdf", declaredType: "application/pdf" },
      db, storage, newId: ids("fd300000-0000-4000-8000-0000000000d1")
    }),
    ingestInvoice({
      session: session(),
      file: { bytes: pdf, filename: "a.pdf", declaredType: "application/pdf" },
      db, storage, newId: ids("fd300000-0000-4000-8000-0000000000d2")
    })
  ]);
  const codes = [left, right].map((item) => item.body.code || item.body.status);
  assert.deepEqual(codes.sort(), ["DUPLICATE_DOCUMENT", "pending_review"]);
  assert.equal(db.rows.length, 1);
  assert.equal(storage.objects.size, 1);
  assert.equal(storage.removed.length, 1);
  assert.equal(storage.removed[0].endsWith("/original"), true);
  assert.equal(storage.objects.has(storage.removed[0]), false);
  assert.equal(storage.removed[0].includes(db.rows[0].id), false);
});

test("cleans only its own object after a database failure, and keeps it when the row exists", async () => {
  const failed = backend();
  failed.db.failMode = "error";
  const failure = await ingestInvoice({
    session: session(),
    file: { bytes: pdf, filename: "a.pdf", declaredType: "application/pdf" },
    db: failed.db, storage: failed.storage, newId: ids("fd300000-0000-4000-8000-0000000000d4")
  });
  assert.equal(failure.body.code, "INGEST_FAILED");
  assert.deepEqual(failed.storage.removed, [`${museumA}/fd300000-0000-4000-8000-0000000000d4/original`]);
  assert.equal(failed.storage.objects.size, 0);

  const timeout = backend();
  timeout.db.failMode = "uncertain";
  const ambiguous = await ingestInvoice({
    session: session(),
    file: { bytes: pdf, filename: "a.pdf", declaredType: "application/pdf" },
    db: timeout.db, storage: timeout.storage, newId: ids("fd300000-0000-4000-8000-0000000000d5")
  });
  assert.equal(ambiguous.body.code, "INGEST_FAILED");
  assert.equal(timeout.storage.objects.size, 0);
  assert.equal(timeout.db.rows.length, 0);

  const committed = backend();
  committed.db.failMode = "uncertain-after-commit";
  const kept = await ingestInvoice({
    session: session(),
    file: { bytes: pdf, filename: "a.pdf", declaredType: "application/pdf" },
    db: committed.db, storage: committed.storage, newId: ids("fd300000-0000-4000-8000-0000000000d6")
  });
  assert.equal(kept.httpStatus, 201);
  assert.equal(kept.body.document_id, "fd300000-0000-4000-8000-0000000000d6");
  assert.equal(committed.storage.removed.length, 0);
  assert.equal(committed.storage.objects.size, 1);

  const hidden = backend();
  hidden.db.failMode = "uncertain";
  hidden.db.lookupFails = true;
  const uncertain = await ingestInvoice({
    session: session(),
    file: { bytes: pdf, filename: "a.pdf", declaredType: "application/pdf" },
    db: hidden.db, storage: hidden.storage, newId: ids("fd300000-0000-4000-8000-0000000000d7")
  });
  assert.equal(uncertain.body.code, "INGEST_UNCERTAIN");
  assert.equal(hidden.storage.removed.length, 0);
});

test("accepts active and activo profiles and rejects every other status", async () => {
  for (const profileStatus of ["active", "activo"]) {
    const { db, storage } = backend();
    const outcome = await ingestInvoice({
      session: session({ profileStatus }),
      file: { bytes: pdf, filename: "a.pdf", declaredType: "application/pdf" },
      db,
      storage,
      newId: ids("fd300000-0000-4000-8000-0000000000d1")
    });
    assert.equal(outcome.httpStatus, 201, profileStatus);
    assert.equal(outcome.body.status, "pending_review");
  }

  for (const profileStatus of ["inactive", "inactivo", "suspended", "pending", "", null]) {
    const { db, storage } = backend();
    const outcome = await ingestInvoice({
      session: session({ profileStatus }),
      file: { bytes: pdf, filename: "a.pdf", declaredType: "application/pdf" },
      db,
      storage,
      newId: ids("fd300000-0000-4000-8000-0000000000d1")
    });
    assert.equal(outcome.body.code, "PROFILE_REQUIRED", String(profileStatus));
    assert.equal(storage.uploads.length, 0, String(profileStatus));
    assert.equal(db.rows.length, 0, String(profileStatus));
  }
});

test("the intake migration only adds the pending-document function", () => {
  const migration = readFileSync(new URL("../migrations/202609300005_finance_document_ingest.sql", import.meta.url), "utf8");
  const source = readFileSync(new URL("../functions/ingest-finance-document/index.ts", import.meta.url), "utf8");
  assert.match(migration, /finance_document_upload/);
  assert.match(migration, /DUPLICATE_DOCUMENT/);
  assert.match(migration, /revoke all on function public\.create_finance_document_pending/);
  assert.match(migration, /grant execute on function public\.create_finance_document_pending/);
  assert.doesNotMatch(migration, /finance_records|finance_budget_lines|payroll_actual|employee_budget_assignments|quickbooks/i);
  assert.match(source, /upsert:\s*false/);
  assert.doesNotMatch(source, /form\.get\(["']museum_id["']\)/);
  assert.doesNotMatch(source, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test("the profile compatibility migration only widens the active status check", () => {
  const migration = readFileSync(new URL("../migrations/202609300006_finance_document_active_profile_compatibility.sql", import.meta.url), "utf8");
  const ingest = readFileSync(new URL("../functions/ingest-finance-document/ingest.mjs", import.meta.url), "utf8");
  assert.match(migration, /actor_status is null or actor_status not in \('active', 'activo'\)/);
  assert.match(ingest, /status === "active" \|\| status === "activo"/);
  assert.doesNotMatch(migration, /finance_records|finance_budget_lines|finance_movements|payroll_actual|employee_budget_assignments|employees|quickbooks|has_permission/i);
  assert.doesNotMatch(migration, /drop table|truncate|delete from/i);
});
