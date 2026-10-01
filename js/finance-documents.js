"use strict";

const invoiceCategoryOrder = ["Gastos Operacionales", "Servicios Contratados", "Otros Gastos"];
let invoiceRenderToken = 0;
let invoiceDocuments = [];
let invoiceCanDecide = false;
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

function invoiceRejectError(error) {
  if (error?.code === "INVALID_REJECTION_REASON") return "El motivo del rechazo es obligatorio.";
  if (error?.code === "DOCUMENT_NOT_PENDING") return "Esta factura ya no está pendiente de revisión.";
  return "No se pudo rechazar la factura.";
}

function invoiceConfirmError(error) {
  if (error?.code === "DOCUMENT_NOT_READY") return "Faltan datos para confirmar. Guarde la fecha, el total, la descripción y la línea presupuestaria.";
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
    description: invoiceFieldText(form.elements.description.value),
    budget_line_id: invoiceFieldText(form.elements.budget_line_id.value)
  };
  const persisted = {
    vendor_name: invoiceFieldText(snapshot.vendor_name),
    invoice_number: invoiceFieldText(snapshot.invoice_number),
    invoice_date: invoiceFieldText(snapshot.invoice_date),
    total: invoiceFieldText(snapshot.total),
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
    const [documents, lines, canDecide] = await Promise.all([
      fetchPendingFinanceDocuments(),
      fetchInvoiceBudgetLines(),
      financeDocumentCanDecide().catch(() => false)
    ]);
    if (token !== invoiceRenderToken) return;
    invoiceCanDecide = canDecide === true;
    invoiceDocuments = documents;
    invoiceLines = lines.filter((line) => line.record_type === "expense" && invoiceCategoryOrder.includes(line.category));
    renderInvoiceList(panel);
  } catch (error) {
    if (token !== invoiceRenderToken) return;
    panel.innerHTML = `<p class="page-kicker">Facturas</p><h3>Facturas pendientes</h3><p class="form-message error">${invoiceEscape(error.message || "No se pudieron cargar las facturas.")}</p>`;
  }
}

function renderInvoiceList(panel, notice = "") {
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
        ${notice ? `<p class="form-message">${invoiceEscape(notice)}</p>` : ""}
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
            <p>Al confirmar, la factura quedará registrada como confirmada y se creará el movimiento financiero correspondiente. No confirme hasta haber revisado la fecha, el total, la descripción y la línea presupuestaria.</p>
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
  showInvoiceOriginal(panel, invoice);
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
    const documents = await fetchPendingFinanceDocuments();
    if (listToken !== invoiceRenderToken) return;
    invoiceDocuments = documents;
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
    const documents = await fetchPendingFinanceDocuments();
    if (listToken !== invoiceRenderToken) return;
    invoiceDocuments = documents;
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
