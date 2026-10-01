"use strict";

const invoiceCategoryOrder = ["Gastos Operacionales", "Servicios Contratados", "Otros Gastos"];
let invoiceRenderToken = 0;
let invoiceDocuments = [];
let invoiceLines = [];

function cancelFinanceDocuments() {
  invoiceRenderToken += 1;
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

function invoiceLineLabel(lineId) {
  if (!lineId) return "Sin línea";
  const line = invoiceLines.find((item) => item.id === lineId);
  if (!line) return "Línea no disponible para facturas";
  return `${line.category} · ${line.name}`;
}

function invoiceSnapshot(document) {
  return {
    vendor_name: document.vendor_name ?? null,
    invoice_number: document.invoice_number ?? null,
    invoice_date: document.invoice_date ?? null,
    total: document.total ?? null,
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
  return "No se pudo guardar la revisión.";
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

function renderFinanceDocuments() {
  const token = ++invoiceRenderToken;
  const panel = document.querySelector("[data-finance-panel]");
  if (!panel) return;
  panel.innerHTML = `<p class="page-kicker">Facturas</p><h3>Facturas pendientes</h3><p class="form-message">Cargando facturas…</p>`;
  loadFinanceDocuments(token);
}

async function loadFinanceDocuments(token) {
  const panel = document.querySelector("[data-finance-panel]");
  if (!panel) return;
  try {
    const [documents, lines] = await Promise.all([
      fetchPendingFinanceDocuments(),
      fetchInvoiceBudgetLines()
    ]);
    if (token !== invoiceRenderToken) return;
    invoiceDocuments = documents;
    invoiceLines = lines.filter((line) => line.record_type === "expense" && invoiceCategoryOrder.includes(line.category));
    renderInvoiceList(panel);
  } catch (error) {
    if (token !== invoiceRenderToken) return;
    panel.innerHTML = `<p class="page-kicker">Facturas</p><h3>Facturas pendientes</h3><p class="form-message error">${invoiceEscape(error.message || "No se pudieron cargar las facturas.")}</p>`;
  }
}

function renderInvoiceList(panel) {
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
    </div>
  `;
  panel.querySelectorAll("[data-invoice-open]").forEach((button) => {
    button.addEventListener("click", () => openFinanceDocument(button.dataset.invoiceOpen));
  });
}

function openFinanceDocument(documentId) {
  const token = ++invoiceRenderToken;
  const panel = document.querySelector("[data-finance-panel]");
  const invoice = invoiceDocuments.find((item) => item.id === documentId);
  if (!panel || !invoice) return;
  renderInvoiceReview(panel, invoice, token);
}

function renderInvoiceReview(panel, invoice, token, notice = "") {
  const canWrite = typeof hasPermission === "function" && hasPermission("finance.write");
  const snapshot = invoiceSnapshot(invoice);
  const totalValue = snapshot.total === null || snapshot.total === undefined ? "" : snapshot.total;
  panel.innerHTML = `
    <div class="invoice-review" data-invoice-review="${invoiceEscape(invoice.id)}">
      <div>
        <p class="page-kicker">Facturas</p>
        <h3>${invoiceEscape(invoice.original_filename)}</h3>
        <p>Cargada ${invoiceEscape(invoiceUploadedLabel(invoice.uploaded_at))}. La factura sigue pendiente hasta una fase posterior.</p>
      </div>
      <div class="invoice-actions">
        <button class="button secondary" type="button" data-invoice-back>Volver al listado</button>
        <button class="button secondary" type="button" data-invoice-reload-file>Mostrar el archivo de nuevo</button>
      </div>
      <p class="form-message" data-invoice-message>${invoiceEscape(notice)}</p>
      <div class="invoice-preview" data-invoice-preview><p class="empty-state">Cargando el archivo…</p></div>
      <form class="form-grid" data-invoice-form>
        <div class="form-row">
          <div class="field">
            <label for="invoice-vendor">Proveedor</label>
            <input id="invoice-vendor" name="vendor_name" maxlength="200" value="${invoiceEscape(snapshot.vendor_name || "")}" ${canWrite ? "" : "disabled"}>
          </div>
          <div class="field">
            <label for="invoice-number">Número de factura</label>
            <input id="invoice-number" name="invoice_number" maxlength="80" value="${invoiceEscape(snapshot.invoice_number || "")}" ${canWrite ? "" : "disabled"}>
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="invoice-date">Fecha de factura</label>
            <input id="invoice-date" name="invoice_date" type="date" value="${invoiceEscape(snapshot.invoice_date || "")}" ${canWrite ? "" : "disabled"}>
          </div>
          <div class="field">
            <label for="invoice-total">Total</label>
            <input id="invoice-total" name="total" inputmode="decimal" value="${invoiceEscape(totalValue)}" ${canWrite ? "" : "disabled"}>
          </div>
        </div>
        <div class="field">
          <label for="invoice-description">Descripción</label>
          <textarea id="invoice-description" name="description" maxlength="500" ${canWrite ? "" : "disabled"}>${invoiceEscape(snapshot.description || "")}</textarea>
        </div>
        <div class="field">
          <label for="invoice-line">Línea presupuestaria</label>
          <select id="invoice-line" name="budget_line_id" ${canWrite ? "" : "disabled"}>${invoiceLineOptions(snapshot.budget_line_id)}</select>
        </div>
        ${canWrite ? `<button class="button submit-button" type="submit">Guardar revisión</button>` : `<p>Puede consultar la factura. Guardar la revisión requiere permiso de edición.</p>`}
      </form>
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
  showInvoiceOriginal(panel, invoice);
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
      description: saved.description,
      budget_line_id: saved.budget_line_id
    };
    invoiceDocuments = invoiceDocuments.map((item) => item.id === next.id ? next : item);
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
