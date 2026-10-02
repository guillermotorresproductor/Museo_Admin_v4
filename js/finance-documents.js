"use strict";

const invoiceCategoryOrder = ["Gastos Operacionales", "Servicios Contratados", "Otros Gastos"];
const invoiceUploadMaxBytes = 15728640;
const invoiceUploadTypes = Object.freeze({
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png"
});
let invoiceRenderToken = 0;
let invoiceDocuments = [];
let invoiceProcessed = [];
let invoiceCanDecide = false;
let invoiceLines = [];
let invoiceUploading = false;

function cancelFinanceDocuments() {
  invoiceRenderToken += 1;
}

function invoiceCanUpload() {
  if (typeof hasPermission !== "function") return false;
  if (!hasPermission("finance.read") || !hasPermission("finance.write")) return false;
  if (typeof hasModuleProfile === "function" && hasModuleProfile()) {
    return hasPermission("modules.administration.read");
  }
  return true;
}

function invoiceUploadExtension(filename) {
  const name = String(filename || "");
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  return name.slice(dot + 1).toLowerCase();
}

function invoiceUploadClientError(file) {
  if (!file || !file.size) return "El archivo está vacío.";
  if (file.size > invoiceUploadMaxBytes) return "El archivo supera 15 MiB.";
  const expected = invoiceUploadTypes[invoiceUploadExtension(file.name)];
  if (!expected) return "Solo se aceptan archivos PDF, JPEG o PNG.";
  const declared = String(file.type || "").split(";")[0].trim().toLowerCase();
  if (declared && declared !== "application/octet-stream" && declared !== expected) {
    return "El tipo del archivo no corresponde a PDF, JPEG o PNG.";
  }
  return "";
}

function invoiceUploadErrorMessage(error) {
  const code = String(error?.code || "");
  const status = Number(error?.status || 0);
  if (code === "DUPLICATE_DOCUMENT" || status === 409) return "Esta factura ya fue cargada anteriormente.";
  if (code === "EMPTY_FILE") return "El archivo está vacío.";
  if (code === "FILE_TOO_LARGE") return "El archivo supera 15 MiB.";
  if (code === "INVALID_FILE_CONTENT" || code === "MIME_MISMATCH" || code === "EXTENSION_MISMATCH") {
    return "El archivo no es un PDF, JPEG o PNG válido.";
  }
  if (code === "INVALID_FILENAME") return "El nombre del archivo no es válido.";
  if (code === "FORBIDDEN" || code === "MODULE_FORBIDDEN" || status === 403) return "No tiene permiso para subir facturas.";
  if (code === "AUTH_REQUIRED" || status === 401) return "Debe iniciar sesión para subir una factura.";
  if (code === "NETWORK") return "No se pudo cargar la factura. Verifique su conexión.";
  return "No se pudo cargar la factura.";
}

function invoiceEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function invoiceDateLabel(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  if (!year || !month || !day) return "—";
  return `${day}/${month}/${year}`;
}

function invoiceUploadedLabel(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-PR", { dateStyle: "medium", timeStyle: "short" });
}

function invoiceMoney(value) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return amount.toLocaleString("es-PR", { style: "currency", currency: "USD" });
}

function invoiceStatusLabel(status) {
  if (status === "confirmed") return "Confirmada";
  if (status === "rejected") return "Rechazada";
  return "—";
}

function invoicePaymentLabel(value) {
  const match = invoicePaymentMethods.find(([code]) => code === value);
  return match ? match[1] : "—";
}

function invoiceProcessedStamp(document) {
  if (document?.status === "rejected") return document.rejected_at || "";
  if (document?.status === "confirmed") return document.confirmed_at || "";
  return "";
}

function invoiceSortProcessed(documents) {
  return (Array.isArray(documents) ? documents : [])
    .filter((document) => document.status === "confirmed" || document.status === "rejected")
    .sort((left, right) => (Date.parse(invoiceProcessedStamp(right) || "") || 0) - (Date.parse(invoiceProcessedStamp(left) || "") || 0));
}

function invoiceLineLabel(lineId) {
  if (!lineId) return "Sin línea";
  const line = invoiceLines.find((item) => item.id === lineId);
  if (!line) return "Línea no disponible para facturas";
  return `${line.category} · ${line.name}`;
}

const invoicePaymentMethods = [
  ["cash", "Cash"],
  ["credit_card", "Tarjeta de crédito"],
  ["ath_movil", "ATH Móvil"],
  ["check", "Cheque"]
];

function invoiceSnapshot(document) {
  return {
    vendor_name: document.vendor_name ?? null,
    invoice_number: document.invoice_number ?? null,
    invoice_date: document.invoice_date ?? null,
    total: document.total ?? null,
    payment_method: document.payment_method ?? null,
    description: document.description ?? null,
    budget_line_id: document.budget_line_id ?? null
  };
}

function invoiceBlank(value) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function invoiceReviewError(error) {
  if (error?.code === "DOCUMENT_REVIEW_STALE") {
    return "Otra persona guardó esta factura después de que usted la abrió. Recargue la factura antes de guardar.";
  }
  if (error?.code === "DOCUMENT_NOT_PENDING") return "Esta factura ya no está pendiente de revisión.";
  if (error?.code === "BUDGET_LINE_REJECTED") return "Esa línea presupuestaria no está disponible para facturas.";
  if (error?.code === "INVALID_TOTAL") return "El total debe ser mayor que cero, con un máximo de dos decimales.";
  if (error?.code === "INVALID_VENDOR") return "El proveedor admite hasta 200 caracteres.";
  if (error?.code === "INVALID_INVOICE_NUMBER") return "El número de factura admite hasta 80 caracteres.";
  if (error?.code === "INVALID_DESCRIPTION") return "La descripción admite hasta 500 caracteres.";
  if (error?.code === "PAYMENT_METHOD_INVALID") return "Seleccione un método de pago de la lista.";
  return "No se pudo guardar la revisión.";
}

function invoiceRejectError(error) {
  if (error?.code === "INVALID_REJECTION_REASON") return "El motivo del rechazo es obligatorio.";
  if (error?.code === "DOCUMENT_NOT_PENDING") return "Esta factura ya no está pendiente de revisión.";
  return "No se pudo rechazar la factura.";
}

function invoiceConfirmError(error) {
  if (error?.code === "DOCUMENT_NOT_READY") return "Faltan datos para confirmar. Guarde la fecha, el total, el método de pago, la descripción y la línea presupuestaria.";
  if (error?.code === "DOCUMENT_NOT_PENDING") return "Esta factura ya no está pendiente de revisión.";
  if (error?.code === "BUDGET_LINE_NOT_INVOICE_ELIGIBLE") return "Esa línea presupuestaria no está disponible para facturas.";
  if (error?.code === "IDEMPOTENCY_CONFLICT") return "No se pudo confirmar la factura. Recargue el listado antes de intentar de nuevo.";
  if (error?.code === "UNAUTHORIZED") return "No tiene autorización para confirmar facturas.";
  return "No se pudo confirmar la factura.";
}

function invoiceFieldText(value) {
  return String(value ?? "").trim();
}

function invoiceReviewDirty(form, snapshot) {
  const current = {
    vendor_name: invoiceFieldText(form.elements.vendor_name.value),
    invoice_number: invoiceFieldText(form.elements.invoice_number.value),
    invoice_date: invoiceFieldText(form.elements.invoice_date.value),
    total: invoiceFieldText(form.elements.total.value),
    payment_method: invoiceFieldText(form.elements.payment_method.value),
    description: invoiceFieldText(form.elements.description.value),
    budget_line_id: invoiceFieldText(form.elements.budget_line_id.value)
  };
  const persisted = {
    vendor_name: invoiceFieldText(snapshot.vendor_name),
    invoice_number: invoiceFieldText(snapshot.invoice_number),
    invoice_date: invoiceFieldText(snapshot.invoice_date),
    total: invoiceFieldText(snapshot.total),
    payment_method: invoiceFieldText(snapshot.payment_method),
    description: invoiceFieldText(snapshot.description),
    budget_line_id: invoiceFieldText(snapshot.budget_line_id)
  };
  if (current.total && persisted.total && Number(current.total) === Number(persisted.total) && Number.isFinite(Number(current.total))) {
    current.total = persisted.total;
  }
  return Object.keys(persisted).some((key) => current[key] !== persisted[key]);
}

function invoiceLineOptions(selectedId) {
  const groups = invoiceCategoryOrder.map((category) => {
    const options = invoiceLines
      .filter((line) => line.record_type === "expense" && line.category === category)
      .map((line) => `<option value="${invoiceEscape(line.id)}"${line.id === selectedId ? " selected" : ""}>${invoiceEscape(line.name)}</option>`)
      .join("");
    if (!options) return "";
    return `<optgroup label="${invoiceEscape(category)}">${options}</optgroup>`;
  }).join("");
  return `<option value="">Sin línea todavía</option>${groups}`;
}

function invoicePaymentOptions(selected) {
  const placeholder = `<option value=""${!selected ? " selected" : ""}>Seleccione método de pago</option>`;
  const options = invoicePaymentMethods
    .map(([value, label]) => `<option value="${value}"${value === selected ? " selected" : ""}>${invoiceEscape(label)}</option>`)
    .join("");
  return placeholder + options;
}

const invoiceDraftFieldNames = ["vendor_name", "invoice_number", "invoice_date", "total", "payment_method", "description", "budget_line_id"];
let invoiceDraftTimer = 0;
let invoiceDraftHoldId = "";

function invoiceDraftKey() {
  const environment = typeof museoEnvironment !== "undefined" && museoEnvironment?.name ? museoEnvironment.name : "local";
  return `museo-invoice-drafts-${environment}`;
}

function invoiceDraftStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(invoiceDraftKey()) || "null");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch (error) {
    console.error(error);
    return {};
  }
}

function invoiceReadDraft(documentId) {
  const draft = invoiceDraftStore()[documentId];
  if (!draft || draft.documentId !== documentId || typeof draft.fields !== "object" || !draft.fields) return null;
  if (typeof draft.baseline !== "object" || !draft.baseline) return null;
  return draft;
}

function invoiceWriteDraft(documentId, draft) {
  const store = invoiceDraftStore();
  store[documentId] = draft;
  try {
    localStorage.setItem(invoiceDraftKey(), JSON.stringify(store));
  } catch (error) {
    console.error(error);
  }
}

function invoiceClearDraft(documentId) {
  const store = invoiceDraftStore();
  if (!Object.hasOwn(store, documentId)) return;
  delete store[documentId];
  try {
    if (Object.keys(store).length) localStorage.setItem(invoiceDraftKey(), JSON.stringify(store));
    else localStorage.removeItem(invoiceDraftKey());
  } catch (error) {
    console.error(error);
  }
}

function invoiceDraftValue(source, key) {
  return invoiceFieldText(source?.[key]);
}

function invoiceDraftRecord(source) {
  return Object.fromEntries(invoiceDraftFieldNames.map((key) => [key, invoiceDraftValue(source, key)]));
}

function invoiceDraftSame(left, right) {
  return invoiceDraftFieldNames.every((key) => {
    const current = left?.[key] ?? "";
    const persisted = right?.[key] ?? "";
    if (key === "total" && current && persisted && Number(current) === Number(persisted) && Number.isFinite(Number(current))) return true;
    return current === persisted;
  });
}

function invoicePaymentAllowed(value) {
  return invoicePaymentMethods.some(([code]) => code === value);
}

function invoiceDraftAction(documentId, snapshot) {
  const draft = invoiceReadDraft(documentId);
  if (!draft) return "none";
  const baseline = invoiceDraftRecord(snapshot);
  if (!invoiceDraftSame(draft.baseline, baseline)) return "conflict";
  if (invoiceDraftSame(draft.fields, baseline)) {
    invoiceClearDraft(documentId);
    return "none";
  }
  return "restore";
}

function rememberInvoiceDraft(documentId, fields, snapshot) {
  if (!documentId || invoiceDraftHoldId === documentId) return;
  const current = invoiceDraftRecord(fields);
  if (!invoicePaymentAllowed(current.payment_method)) current.payment_method = "";
  const baseline = invoiceDraftRecord(snapshot);
  const existing = invoiceReadDraft(documentId);
  if (existing && !invoiceDraftSame(existing.baseline, baseline)) return;
  if (invoiceDraftSame(current, baseline)) {
    invoiceClearDraft(documentId);
    return;
  }
  invoiceWriteDraft(documentId, {
    documentId,
    updatedAt: new Date().toISOString(),
    baseline: existing?.baseline || baseline,
    fields: current
  });
}

function invoiceFormDraftFields(form) {
  return Object.fromEntries(invoiceDraftFieldNames.map((key) => [key, form.elements[key]?.value ?? ""]));
}

function applyInvoiceDraft(form, fields) {
  invoiceDraftFieldNames.forEach((key) => {
    const input = form.elements[key];
    if (!input || fields[key] == null) return;
    if (key === "payment_method" && fields[key] && !invoicePaymentAllowed(fields[key])) {
      input.value = "";
      return;
    }
    input.value = fields[key];
  });
}

function invoiceDraftContext() {
  const review = document.querySelector("[data-invoice-review]");
  const form = document.querySelector("[data-invoice-form]");
  if (!review || !form || invoiceCanDecide !== true) return null;
  const documentId = review.dataset.invoiceReview;
  const invoice = invoiceDocuments.find((item) => item.id === documentId);
  if (!invoice) return null;
  return { documentId, form, snapshot: invoiceSnapshot(invoice) };
}

function flushInvoiceDraft() {
  const current = invoiceDraftContext();
  if (!current) return;
  rememberInvoiceDraft(current.documentId, invoiceFormDraftFields(current.form), current.snapshot);
}

function scheduleInvoiceDraft() {
  clearTimeout(invoiceDraftTimer);
  invoiceDraftTimer = setTimeout(flushInvoiceDraft, 400);
}

function bindInvoiceDraftPersistence() {
  if (typeof document === "undefined") return;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushInvoiceDraft();
  });
  window.addEventListener("pagehide", flushInvoiceDraft);
}

function renderFinanceDocuments() {
  const token = ++invoiceRenderToken;
  const panel = document.querySelector("[data-finance-panel]");
  if (!panel) return;
  panel.innerHTML = `<p class="page-kicker">Facturas</p><h3>Facturas pendientes</h3><p class="form-message">Cargando facturas…</p>`;
  loadFinanceDocuments(token);
}

async function loadFinanceDocuments(token, notice = "", noticeState = "") {
  const panel = document.querySelector("[data-finance-panel]");
  if (!panel) return;
  try {
    const [documents, processed, lines, canDecide] = await Promise.all([
      fetchPendingFinanceDocuments(),
      fetchProcessedFinanceDocuments(),
      fetchInvoiceBudgetLines(),
      financeDocumentCanDecide().catch(() => false)
    ]);
    if (token !== invoiceRenderToken) return;
    invoiceCanDecide = canDecide === true;
    invoiceDocuments = documents;
    invoiceProcessed = invoiceSortProcessed(processed);
    invoiceLines = lines.filter((line) => line.record_type === "expense" && invoiceCategoryOrder.includes(line.category));
    renderInvoiceList(panel, notice, noticeState);
  } catch (error) {
    if (token !== invoiceRenderToken) return;
    panel.innerHTML = `<p class="page-kicker">Facturas</p><h3>Facturas pendientes</h3><p class="form-message error">${invoiceEscape(error.message || "No se pudieron cargar las facturas.")}</p>`;
  }
}

function renderInvoiceList(panel, notice = "", noticeState = "") {
  const rows = invoiceDocuments.map((document) => `
    <tr>
      <td>${invoiceEscape(document.original_filename)}</td>
      <td>${invoiceEscape(invoiceUploadedLabel(document.uploaded_at))}</td>
      <td>${invoiceEscape(document.vendor_name || "—")}</td>
      <td>${invoiceEscape(document.invoice_number || "—")}</td>
      <td>${invoiceEscape(invoiceDateLabel(document.invoice_date))}</td>
      <td>${invoiceEscape(invoiceMoney(document.total))}</td>
      <td>${invoiceEscape(invoiceLineLabel(document.budget_line_id))}</td>
      <td><button class="button secondary" type="button" data-invoice-open="${invoiceEscape(document.id)}">Abrir</button></td>
    </tr>
  `).join("");
  panel.innerHTML = `
    <div class="invoice-list">
      <div>
        <p class="page-kicker">Facturas</p>
        <h3>Facturas pendientes</h3>
        <p>Una factura pendiente es evidencia. Guardar la revisión no crea un gasto ni cambia el presupuesto.</p>
        ${invoiceCanUpload() ? `
          <div class="invoice-upload">
            <input id="invoice-upload-file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" hidden>
            <button class="button" type="button" data-invoice-upload ${invoiceUploading ? "disabled" : ""}>Subir factura</button>
          </div>
        ` : ""}
        ${notice ? `<p class="form-message${noticeState === "error" ? " error" : ""}">${invoiceEscape(notice)}</p>` : ""}
      </div>
      ${invoiceDocuments.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Fecha de carga</th>
                <th>Proveedor</th>
                <th>Número</th>
                <th>Fecha factura</th>
                <th>Total</th>
                <th>Línea presupuestaria</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      ` : `<p class="empty-state">No hay facturas pendientes</p>`}
      <div>
        <h3>Facturas procesadas</h3>
        <p>Las facturas confirmadas y rechazadas quedan aquí para consulta.</p>
      </div>
      ${invoiceProcessed.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Fecha de factura</th>
                <th>Suplidor</th>
                <th>Número</th>
                <th>Descripción</th>
                <th>Total</th>
                <th>Método de pago</th>
                <th>Estado</th>
                <th>Fecha de procesamiento</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${invoiceProcessed.map((document) => `
              <tr>
                <td>${invoiceEscape(invoiceDateLabel(document.invoice_date))}</td>
                <td>${invoiceEscape(document.vendor_name || "—")}</td>
                <td>${invoiceEscape(document.invoice_number || "—")}</td>
                <td>${invoiceEscape(document.description || "—")}</td>
                <td>${invoiceEscape(invoiceMoney(document.total))}</td>
                <td>${invoiceEscape(invoicePaymentLabel(document.payment_method))}</td>
                <td>${invoiceEscape(invoiceStatusLabel(document.status))}</td>
                <td>${invoiceEscape(invoiceUploadedLabel(invoiceProcessedStamp(document)))}</td>
                <td><button class="button secondary" type="button" data-invoice-view="${invoiceEscape(document.id)}">Ver factura</button></td>
              </tr>
            `).join("")}</tbody>
          </table>
        </div>
      ` : `<p class="empty-state">No hay facturas procesadas</p>`}
    </div>
  `;
  panel.querySelectorAll("[data-invoice-open]").forEach((button) => {
    button.addEventListener("click", () => openFinanceDocument(button.dataset.invoiceOpen));
  });
  panel.querySelectorAll("[data-invoice-view]").forEach((button) => {
    button.addEventListener("click", () => openProcessedFinanceDocument(button.dataset.invoiceView));
  });
  bindInvoiceUpload(panel);
}

function bindInvoiceUpload(panel) {
  const button = panel.querySelector("[data-invoice-upload]");
  const input = panel.querySelector("#invoice-upload-file");
  if (!button || !input || button.dataset.bound === "1") return;
  button.dataset.bound = "1";
  button.addEventListener("click", () => {
    if (invoiceUploading) return;
    input.click();
  });
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    input.value = "";
    if (!file || invoiceUploading) return;
    void submitInvoiceUpload(panel, file);
  });
}

async function submitInvoiceUpload(panel, file) {
  const problem = invoiceUploadClientError(file);
  if (problem) {
    renderInvoiceList(panel, problem, "error");
    return;
  }
  const token = invoiceRenderToken;
  invoiceUploading = true;
  renderInvoiceList(panel, "Subiendo factura...");
  try {
    const created = await ingestFinanceDocument(file);
    if (created?.status !== "pending_review") {
      throw Object.assign(new Error("La factura no quedó pendiente."), { code: "INGEST_FAILED" });
    }
    invoiceUploading = false;
    if (token !== invoiceRenderToken) return;
    await loadFinanceDocuments(token, "Factura cargada correctamente.");
  } catch (error) {
    invoiceUploading = false;
    if (token !== invoiceRenderToken) return;
    renderInvoiceList(panel, invoiceUploadErrorMessage(error), "error");
  }
}

function openFinanceDocument(documentId) {
  const token = ++invoiceRenderToken;
  const panel = document.querySelector("[data-finance-panel]");
  const invoice = invoiceDocuments.find((item) => item.id === documentId);
  if (!panel || !invoice) return;
  renderInvoiceReview(panel, invoice, token);
}

function openProcessedFinanceDocument(documentId) {
  const token = ++invoiceRenderToken;
  const panel = document.querySelector("[data-finance-panel]");
  const invoice = invoiceProcessed.find((item) => item.id === documentId);
  if (!panel || !invoice) return;
  renderProcessedInvoice(panel, invoice, token);
}

function renderProcessedInvoice(panel, invoice, token) {
  const status = invoiceStatusLabel(invoice.status);
  panel.innerHTML = `
    <div class="invoice-review" data-invoice-review="${invoiceEscape(invoice.id)}" data-invoice-readonly="true">
      <div>
        <p class="page-kicker">Facturas</p>
        <h3>${invoiceEscape(invoice.vendor_name || invoice.original_filename || "Factura")}</h3>
        <p>${invoice.status === "rejected" ? "Rechazada. El documento y su historial se conservan." : "Confirmada. Esta vista es solo consulta."}</p>
      </div>
      <div class="invoice-actions">
        <button class="button secondary" type="button" data-invoice-back>Volver al listado</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <tbody>
            <tr><th>Fecha de factura</th><td>${invoiceEscape(invoiceDateLabel(invoice.invoice_date))}</td></tr>
            <tr><th>Suplidor</th><td>${invoiceEscape(invoice.vendor_name || "—")}</td></tr>
            <tr><th>Número</th><td>${invoiceEscape(invoice.invoice_number || "—")}</td></tr>
            <tr><th>Descripción</th><td>${invoiceEscape(invoice.description || "—")}</td></tr>
            <tr><th>Total</th><td>${invoiceEscape(invoiceMoney(invoice.total))}</td></tr>
            <tr><th>Método de pago</th><td>${invoiceEscape(invoicePaymentLabel(invoice.payment_method))}</td></tr>
            <tr><th>Estado</th><td>${invoiceEscape(status)}</td></tr>
            <tr><th>Fecha de procesamiento</th><td>${invoiceEscape(invoiceUploadedLabel(invoiceProcessedStamp(invoice)))}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="invoice-preview" data-invoice-preview><p class="empty-state">Cargando el archivo…</p></div>
    </div>
  `;
  panel.querySelector("[data-invoice-back]")?.addEventListener("click", () => {
    if (token !== invoiceRenderToken) return;
    renderInvoiceList(panel);
  });
  showInvoiceOriginal(panel, invoice);
}

function renderInvoiceReview(panel, invoice, token, notice = "") {
  const canDecide = invoiceCanDecide === true;
  const snapshot = invoiceSnapshot(invoice);
  const totalValue = snapshot.total === null || snapshot.total === undefined ? "" : snapshot.total;
  panel.innerHTML = `
    <div class="invoice-review" data-invoice-review="${invoiceEscape(invoice.id)}">
      <div>
        <p class="page-kicker">Facturas</p>
        <h3>${invoiceEscape(invoice.original_filename)}</h3>
        <p>Cargada ${invoiceEscape(invoiceUploadedLabel(invoice.uploaded_at))}. La factura sigue pendiente hasta que se confirme o se rechace.</p>
      </div>
      <div class="invoice-actions">
        <button class="button secondary" type="button" data-invoice-back>Volver al listado</button>
        <button class="button secondary" type="button" data-invoice-reload-file>Mostrar el archivo de nuevo</button>
      </div>
      <p class="form-message" data-invoice-message>${invoiceEscape(notice)}</p>
      <p class="form-message" data-invoice-draft hidden>Se encontró un borrador sin guardar. Los datos ya guardados son más recientes. <button class="button secondary" type="button" data-invoice-draft-restore>Recuperar borrador</button> <button class="button secondary" type="button" data-invoice-draft-discard>Descartar borrador</button></p>
      <div class="invoice-preview" data-invoice-preview><p class="empty-state">Cargando el archivo…</p></div>
      <form class="form-grid" data-invoice-form>
        <div class="form-row">
          <div class="field">
            <label for="invoice-vendor">Proveedor</label>
            <input id="invoice-vendor" name="vendor_name" maxlength="200" value="${invoiceEscape(snapshot.vendor_name || "")}" ${canDecide ? "" : "disabled"}>
          </div>
          <div class="field">
            <label for="invoice-number">Número de factura</label>
            <input id="invoice-number" name="invoice_number" maxlength="80" value="${invoiceEscape(snapshot.invoice_number || "")}" ${canDecide ? "" : "disabled"}>
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="invoice-date">Fecha de factura</label>
            <input id="invoice-date" name="invoice_date" type="date" value="${invoiceEscape(snapshot.invoice_date || "")}" ${canDecide ? "" : "disabled"}>
          </div>
          <div class="field">
            <label for="invoice-total">Total</label>
            <input id="invoice-total" name="total" inputmode="decimal" value="${invoiceEscape(totalValue)}" ${canDecide ? "" : "disabled"}>
          </div>
        </div>
        <div class="field">
          <label for="invoice-payment-method">Método de pago</label>
          <select id="invoice-payment-method" name="payment_method" ${canDecide ? "" : "disabled"}>${invoicePaymentOptions(snapshot.payment_method)}</select>
        </div>
        <div class="field">
          <label for="invoice-description">Descripción</label>
          <textarea id="invoice-description" name="description" maxlength="500" ${canDecide ? "" : "disabled"}>${invoiceEscape(snapshot.description || "")}</textarea>
        </div>
        <div class="field">
          <label for="invoice-line">Línea presupuestaria</label>
          <select id="invoice-line" name="budget_line_id" ${canDecide ? "" : "disabled"}>${invoiceLineOptions(snapshot.budget_line_id)}</select>
        </div>
        ${canDecide ? `<div class="invoice-actions"><button class="button submit-button" type="submit">Guardar revisión</button><button class="button secondary" type="button" data-invoice-reject>Rechazar factura</button><button class="button" type="button" data-invoice-confirm>Confirmar factura</button></div>` : `<p>Puede consultar la factura.</p>`}
      </form>
      ${canDecide ? `
        <dialog class="invoice-reject-dialog" data-invoice-reject-dialog>
          <form class="invoice-reject-form" data-invoice-reject-form>
            <h3>Rechazar factura</h3>
            <p>La factura será marcada como rechazada. El documento original se conservará para auditoría.</p>
            <div class="field">
              <label for="invoice-reject-reason">Motivo del rechazo</label>
              <textarea id="invoice-reject-reason" name="reason" maxlength="500" rows="4"></textarea>
            </div>
            <p class="form-message" data-invoice-reject-message></p>
            <div class="invoice-actions">
              <button class="button secondary" type="button" data-invoice-reject-cancel>Cancelar</button>
              <button class="button" type="submit" data-invoice-reject-confirm>Confirmar rechazo</button>
            </div>
          </form>
        </dialog>
        <dialog class="invoice-reject-dialog" data-invoice-confirm-dialog>
          <form class="invoice-reject-form" data-invoice-confirm-form>
            <h3>Confirmar factura</h3>
            <p>Al confirmar, la factura quedará registrada como confirmada y se creará el movimiento financiero correspondiente. No confirme hasta haber revisado la fecha, el total, el método de pago, la descripción y la línea presupuestaria.</p>
            <p class="form-message" data-invoice-confirm-message></p>
            <div class="invoice-actions">
              <button class="button secondary" type="button" data-invoice-confirm-cancel>Cancelar</button>
              <button class="button" type="submit" data-invoice-confirm-submit>Confirmar factura</button>
            </div>
          </form>
        </dialog>
      ` : ""}
    </div>
  `;
  panel.querySelector("[data-invoice-back]")?.addEventListener("click", () => {
    cancelFinanceDocuments();
    renderInvoiceList(panel);
  });
  panel.querySelector("[data-invoice-reload-file]")?.addEventListener("click", () => {
    showInvoiceOriginal(panel, invoice);
  });
  panel.querySelector("[data-invoice-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    saveInvoiceReview(panel, invoice, snapshot, token);
  });
  panel.querySelector("[data-invoice-reject]")?.addEventListener("click", () => {
    openInvoiceReject(panel);
  });
  panel.querySelector("[data-invoice-reject-cancel]")?.addEventListener("click", () => {
    panel.querySelector("[data-invoice-reject-dialog]")?.close();
  });
  panel.querySelector("[data-invoice-reject-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    confirmInvoiceReject(panel, invoice, token);
  });
  panel.querySelector("[data-invoice-confirm]")?.addEventListener("click", () => {
    const form = panel.querySelector("[data-invoice-form]");
    const message = panel.querySelector("[data-invoice-message]");
    if (form && invoiceReviewDirty(form, snapshot)) {
      if (message) {
        message.className = "form-message error";
        message.textContent = "Hay cambios sin guardar. Guarde la revisión antes de confirmar la factura.";
      }
      return;
    }
    openInvoiceConfirm(panel);
  });
  panel.querySelector("[data-invoice-confirm-cancel]")?.addEventListener("click", () => {
    panel.querySelector("[data-invoice-confirm-dialog]")?.close();
  });
  panel.querySelector("[data-invoice-confirm-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    confirmInvoiceDocument(panel, invoice, token);
  });
  prepareInvoiceDraft(panel, invoice, snapshot, notice);
  showInvoiceOriginal(panel, invoice);
}

function prepareInvoiceDraft(panel, invoice, snapshot, notice) {
  const form = panel.querySelector("[data-invoice-form]");
  const message = panel.querySelector("[data-invoice-message]");
  const draftBox = panel.querySelector("[data-invoice-draft]");
  if (!form || invoiceCanDecide !== true) return;
  const action = invoiceDraftAction(invoice.id, snapshot);
  if (action === "restore") {
    invoiceDraftHoldId = "";
    applyInvoiceDraft(form, invoiceReadDraft(invoice.id).fields);
    if (!notice && message) {
      message.className = "form-message";
      message.textContent = "Se recuperó el trabajo que no se había guardado.";
    }
  } else if (action === "conflict") {
    invoiceDraftHoldId = invoice.id;
    if (draftBox) draftBox.hidden = false;
  } else if (invoiceDraftHoldId === invoice.id) {
    invoiceDraftHoldId = "";
  }
  form.addEventListener("input", scheduleInvoiceDraft);
  form.addEventListener("change", scheduleInvoiceDraft);
  draftBox?.querySelector("[data-invoice-draft-restore]")?.addEventListener("click", () => {
    const draft = invoiceReadDraft(invoice.id);
    if (!draft) return;
    invoiceDraftHoldId = "";
    applyInvoiceDraft(form, draft.fields);
    draftBox.hidden = true;
    if (message) {
      message.className = "form-message";
      message.textContent = "Se recuperó el borrador. Guarde la revisión para conservarlo en el servidor.";
    }
    flushInvoiceDraft();
  });
  draftBox?.querySelector("[data-invoice-draft-discard]")?.addEventListener("click", () => {
    invoiceClearDraft(invoice.id);
    invoiceDraftHoldId = "";
    if (draftBox) draftBox.hidden = true;
  });
}

function openInvoiceConfirm(panel) {
  const dialog = panel.querySelector("[data-invoice-confirm-dialog]");
  const message = panel.querySelector("[data-invoice-confirm-message]");
  const submit = panel.querySelector("[data-invoice-confirm-submit]");
  const cancel = panel.querySelector("[data-invoice-confirm-cancel]");
  if (!dialog) return;
  if (submit) submit.disabled = false;
  if (cancel) cancel.disabled = false;
  if (message) {
    message.className = "form-message";
    message.textContent = "";
  }
  dialog.showModal();
}

async function confirmInvoiceDocument(panel, invoice, token) {
  const dialog = panel.querySelector("[data-invoice-confirm-dialog]");
  const message = panel.querySelector("[data-invoice-confirm-message]");
  const submit = panel.querySelector("[data-invoice-confirm-submit]");
  const cancel = panel.querySelector("[data-invoice-confirm-cancel]");
  if (token !== invoiceRenderToken || submit?.disabled) return;
  if (submit) submit.disabled = true;
  if (cancel) cancel.disabled = true;
  if (message) {
    message.className = "form-message";
    message.textContent = "";
  }
  let saved;
  try {
    saved = await confirmFinanceDocument(invoice.id);
    if (saved?.status !== "confirmed" || !saved?.movement_id) throw new Error("La factura no quedó confirmada.");
    invoiceClearDraft(invoice.id);
  } catch (error) {
    if (token !== invoiceRenderToken) return;
    if (submit) submit.disabled = false;
    if (cancel) cancel.disabled = false;
    if (message) {
      message.className = "form-message error";
      message.textContent = invoiceConfirmError(error);
    }
    return;
  }
  dialog?.close();
  const listToken = ++invoiceRenderToken;
  try {
    const [documents, processed] = await Promise.all([
      fetchPendingFinanceDocuments(),
      fetchProcessedFinanceDocuments()
    ]);
    if (listToken !== invoiceRenderToken) return;
    invoiceDocuments = documents;
    invoiceProcessed = invoiceSortProcessed(processed);
    renderInvoiceList(panel, "Factura confirmada. Se registró el movimiento financiero.");
  } catch (error) {
    if (listToken !== invoiceRenderToken) return;
    panel.innerHTML = `<p class="page-kicker">Facturas</p><h3>Facturas pendientes</h3><p class="form-message">Factura confirmada. Se registró el movimiento financiero.</p><p class="form-message error">${invoiceEscape(error.message || "No se pudieron cargar las facturas.")}</p>`;
  }
}

function openInvoiceReject(panel) {
  const dialog = panel.querySelector("[data-invoice-reject-dialog]");
  const field = panel.querySelector("#invoice-reject-reason");
  const message = panel.querySelector("[data-invoice-reject-message]");
  if (!dialog) return;
  if (field) field.value = "";
  if (message) {
    message.className = "form-message";
    message.textContent = "";
  }
  dialog.showModal();
}

async function confirmInvoiceReject(panel, invoice, token) {
  const dialog = panel.querySelector("[data-invoice-reject-dialog]");
  const message = panel.querySelector("[data-invoice-reject-message]");
  const confirm = panel.querySelector("[data-invoice-reject-confirm]");
  const cancel = panel.querySelector("[data-invoice-reject-cancel]");
  const reason = String(panel.querySelector("#invoice-reject-reason")?.value || "").trim();
  if (token !== invoiceRenderToken) return;
  if (!reason) {
    if (message) {
      message.className = "form-message error";
      message.textContent = "El motivo del rechazo es obligatorio.";
    }
    return;
  }
  if (confirm) confirm.disabled = true;
  if (cancel) cancel.disabled = true;
  if (message) {
    message.className = "form-message";
    message.textContent = "";
  }
  let saved;
  try {
    saved = await rejectFinanceDocument(invoice.id, reason);
    if (saved?.status !== "rejected") throw new Error("La factura no quedó rechazada.");
    invoiceClearDraft(invoice.id);
  } catch (error) {
    if (token !== invoiceRenderToken) return;
    if (confirm) confirm.disabled = false;
    if (cancel) cancel.disabled = false;
    if (message) {
      message.className = "form-message error";
      message.textContent = invoiceRejectError(error);
    }
    return;
  }
  dialog?.close();
  const listToken = ++invoiceRenderToken;
  try {
    const [documents, processed] = await Promise.all([
      fetchPendingFinanceDocuments(),
      fetchProcessedFinanceDocuments()
    ]);
    if (listToken !== invoiceRenderToken) return;
    invoiceDocuments = documents;
    invoiceProcessed = invoiceSortProcessed(processed);
    renderInvoiceList(panel, "Factura rechazada. El documento se conservó para auditoría.");
  } catch (error) {
    if (listToken !== invoiceRenderToken) return;
    panel.innerHTML = `<p class="page-kicker">Facturas</p><h3>Facturas pendientes</h3><p class="form-message">Factura rechazada. El documento se conservó para auditoría.</p><p class="form-message error">${invoiceEscape(error.message || "No se pudieron cargar las facturas.")}</p>`;
  }
}

async function showInvoiceOriginal(panel, invoice) {
  const preview = panel.querySelector("[data-invoice-preview]");
  if (!preview) return;
  preview.innerHTML = `<p class="empty-state">Cargando el archivo…</p>`;
  try {
    const url = await signSupabaseFinanceDocument(invoice.original_path, 900);
    if (panel.querySelector("[data-invoice-review]")?.dataset.invoiceReview !== invoice.id) return;
    if (!url) throw new Error("No se pudo mostrar el archivo.");
    const current = panel.querySelector("[data-invoice-preview]");
    if (!current) return;
    if (invoice.original_mime === "application/pdf") {
      current.innerHTML = `<iframe title="Factura original" src="${invoiceEscape(url)}"></iframe>`;
    } else if (invoice.original_mime === "image/jpeg" || invoice.original_mime === "image/png") {
      current.innerHTML = `<img alt="Factura original" src="${invoiceEscape(url)}">`;
    } else {
      current.innerHTML = `<p class="empty-state">Este archivo no se puede mostrar aquí.</p>`;
    }
  } catch (error) {
    const current = panel.querySelector("[data-invoice-preview]");
    if (!current || panel.querySelector("[data-invoice-review]")?.dataset.invoiceReview !== invoice.id) return;
    current.innerHTML = `<p class="form-message error">${invoiceEscape(error.message || "No se pudo mostrar el archivo.")}</p>`;
  }
}

async function saveInvoiceReview(panel, invoice, expected, token) {
  const form = panel.querySelector("[data-invoice-form]");
  const message = panel.querySelector("[data-invoice-message]");
  const button = form?.querySelector("[type=submit]");
  if (!form || token !== invoiceRenderToken) return;
  const totalText = invoiceBlank(form.elements.total.value);
  let total = null;
  if (totalText) {
    if (!/^\d+(\.\d{1,2})?$/.test(totalText) || Number(totalText) <= 0) {
      if (message) {
        message.className = "form-message error";
        message.textContent = "El total debe ser mayor que cero, con un máximo de dos decimales.";
      }
      return;
    }
    total = totalText;
  }
  if (button) button.disabled = true;
  if (message) {
    message.className = "form-message";
    message.textContent = "Guardando revisión…";
  }
  try {
    const saved = await updateFinanceDocumentReview({
      documentId: invoice.id,
      expected,
      vendor_name: form.elements.vendor_name.value,
      invoice_number: form.elements.invoice_number.value,
      invoice_date: invoiceBlank(form.elements.invoice_date.value),
      total,
      payment_method: invoiceBlank(form.elements.payment_method.value),
      description: form.elements.description.value,
      budget_line_id: invoiceBlank(form.elements.budget_line_id.value)
    });
    if (saved?.status !== "pending_review") throw new Error("La factura no permaneció pendiente.");
    const next = {
      ...invoice,
      status: saved.status,
      vendor_name: saved.vendor_name,
      invoice_number: saved.invoice_number,
      invoice_date: saved.invoice_date,
      total: saved.total,
      payment_method: saved.payment_method,
      description: saved.description,
      budget_line_id: saved.budget_line_id
    };
    invoiceDocuments = invoiceDocuments.map((item) => item.id === next.id ? next : item);
    invoiceClearDraft(invoice.id);
    if (token !== invoiceRenderToken) return;
    renderInvoiceReview(panel, next, token, "Revisión guardada. La factura sigue pendiente.");
  } catch (error) {
    if (token !== invoiceRenderToken) return;
    if (button) button.disabled = false;
    if (message) {
      message.className = "form-message error";
      message.textContent = invoiceReviewError(error);
    }
    if (error?.code === "DOCUMENT_REVIEW_STALE") {
      const actions = panel.querySelector(".invoice-actions");
      if (actions && !actions.querySelector("[data-invoice-reload]")) {
        const reload = window.document.createElement("button");
        reload.className = "button secondary";
        reload.type = "button";
        reload.dataset.invoiceReload = "true";
        reload.textContent = "Recargar factura";
        reload.addEventListener("click", () => reloadFinanceDocument(invoice.id));
        actions.append(reload);
      }
    }
  }
}

async function reloadFinanceDocument(documentId) {
  const token = ++invoiceRenderToken;
  const panel = document.querySelector("[data-finance-panel]");
  if (!panel) return;
  panel.innerHTML = `<p class="form-message">Recargando factura…</p>`;
  try {
    const documents = await fetchPendingFinanceDocuments();
    if (token !== invoiceRenderToken) return;
    invoiceDocuments = documents;
    const document = documents.find((item) => item.id === documentId);
    if (!document) {
      renderInvoiceList(panel);
      return;
    }
    renderInvoiceReview(panel, document, token, "Se cargó la revisión más reciente.");
  } catch (error) {
    if (token !== invoiceRenderToken) return;
    panel.innerHTML = `<p class="form-message error">${invoiceEscape(error.message || "No se pudo recargar la factura.")}</p>`;
  }
}

bindInvoiceDraftPersistence();
