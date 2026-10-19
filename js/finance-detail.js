"use strict";

// Consulta de solo lectura de todas las facturas cargadas. No altera documentos ni movimientos.
let financeDetailToken = 0;
function cancelFinanceDetail() { financeDetailToken += 1; }

function financeDetailBounds(year, startMonth, index) {
  const from = financePeriodDate(year, index, startMonth);
  const [calendarYear, calendarMonth] = from.split("-").map(Number);
  const until = new Date(Date.UTC(calendarYear, calendarMonth, 1)).toISOString().slice(0, 10);
  return { from, until };
}

async function fetchFinanceDetailMonth(museumId, from, until) {
  const result = [];
  for (let offset = 0; ; offset += 1000) {
    // Puerto Rico permanece en UTC-04:00. El mes se evalúa por uploaded_at local.
    const path = `/rest/v1/finance_documents?select=id,status,vendor_name,description,total,uploaded_at,invoice_date,invoice_number,payment_method,budget_line_id,original_filename,original_path,original_mime&museum_id=eq.${encodeURIComponent(museumId)}&uploaded_at=gte.${from}T04:00:00Z&uploaded_at=lt.${until}T04:00:00Z&order=uploaded_at.desc,id.asc&limit=1000&offset=${offset}`;
    const page = await supabaseGet(path);
    if (!Array.isArray(page)) throw new Error("La consulta de facturas devolvió un formato inesperado.");
    result.push(...page);
    if (page.length < 1000) return result;
  }
}

function renderFinanceDetail(panel, museumId, fiscalYear, startMonth, months) {
  cancelFinanceDetail();
  if (!panel || !museumId || !Array.isArray(months) || months.length !== 12) {
    if (panel) panel.innerHTML = '<p class="form-message error">Período financiero no disponible.</p>';
    return;
  }
  const currentMonth = financeMovementMonthIndex(puertoRicoToday(), fiscalYear, startMonth);
  const defaultIndex = currentMonth >= 0 ? currentMonth : 0;
  const options = months.map((name, index) => {
    const { from } = financeDetailBounds(fiscalYear, startMonth, index);
    return `<option value="${index}"${index === defaultIndex ? " selected" : ""}>${invoiceEscape(name)} ${from.slice(0, 4)}</option>`;
  }).join("");
  panel.innerHTML = `
    <section class="invoice-list" data-finance-detail>
      <p class="page-kicker">DETALLE</p>
      <h3>Facturas por mes</h3>
      <p>Consulta administrativa de facturas por fecha de carga en Puerto Rico. Solo lectura.</p>
      <div class="field" style="max-width: 340px;">
        <label for="finance-detail-month">Seleccionar mes</label>
        <select id="finance-detail-month" data-finance-detail-month>${options}</select>
      </div>
      <p class="form-message" aria-live="polite" data-finance-detail-message></p>
      <div data-finance-detail-content></div>
    </section>
  `;
  const root = panel.querySelector("[data-finance-detail]");
  const selector = root.querySelector("[data-finance-detail-month]");
  const load = () => {
    const index = Number(selector.value);
    if (Number.isInteger(index) && index >= 0 && index < 12) {
      void loadFinanceDetail(root, museumId, fiscalYear, startMonth, index);
    }
  };
  selector.addEventListener("change", load);
  load();
}

async function loadFinanceDetail(root, museumId, fiscalYear, startMonth, index) {
  const token = ++financeDetailToken;
  const message = root.querySelector("[data-finance-detail-message]");
  const container = root.querySelector("[data-finance-detail-content]");
  message.className = "form-message";
  message.textContent = "Consultando facturas…";
  container.replaceChildren();
  try {
    const { from, until } = financeDetailBounds(fiscalYear, startMonth, index);
    const [invoices, lines] = await Promise.all([
      fetchFinanceDetailMonth(museumId, from, until),
      fetchInvoiceBudgetLines()
    ]);
    if (token !== financeDetailToken || !root.isConnected) return;
    const lineMap = new Map(lines.map((line) => [line.id, line]));
    message.textContent = `${invoices.length} factura${invoices.length === 1 ? "" : "s"} cargada${invoices.length === 1 ? "" : "s"} en este mes.`;
    renderFinanceDetailList(container, invoices, lineMap);
  } catch (error) {
    if (token !== financeDetailToken || !root.isConnected) return;
    message.className = "form-message error";
    message.textContent = error.message || "No fue posible consultar las facturas.";
  }
}

function financeDetailLine(invoice, lineMap) {
  const line = lineMap.get(invoice.budget_line_id);
  return line ? `${line.category} · ${line.name}` : "Línea de gastos no disponible";
}

function renderFinanceDetailList(container, invoices, lineMap) {
  if (!invoices.length) {
    container.innerHTML = '<p class="empty-state">No hay facturas cargadas en este mes.</p>';
    return;
  }
  container.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Fecha de carga</th><th>Proveedor</th><th>Descripción</th><th>Línea de gastos</th><th>Total</th><th>Estado</th><th></th></tr></thead>
        <tbody>
        ${invoices.map((invoice) => `<tr>
          <td>${invoiceEscape(invoiceUploadedLabel(invoice.uploaded_at))}</td>
          <td>${invoiceEscape(invoice.vendor_name || "No indicado")}</td>
          <td>${invoiceEscape(invoice.description || "—")}</td>
          <td>${invoiceEscape(financeDetailLine(invoice, lineMap))}</td>
          <td>${invoiceEscape(invoiceMoney(invoice.total))}</td>
          <td>${invoiceEscape(invoice.status === "pending_review" ? "Pendiente de revisión" : invoiceStatusLabel(invoice.status))}</td>
          <td><button class="button secondary" type="button" data-detail-invoice-id="${invoiceEscape(invoice.id)}">Ver detalle</button></td>
        </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
  container.querySelectorAll("[data-detail-invoice-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const invoice = invoices.find((item) => item.id === button.dataset.detailInvoiceId);
      if (invoice) renderFinanceDetailInvoice(container, invoice, invoices, lineMap);
    });
  });
}

function renderFinanceDetailInvoice(container, invoice, invoices, lineMap) {
  container.innerHTML = `
    <div class="invoice-review">
      <div>
        <p class="page-kicker">Detalle de factura</p>
        <h3>${invoiceEscape(invoice.vendor_name || invoice.original_filename || "Factura")}</h3>
        <p>${invoiceEscape(invoice.status === "pending_review" ? "Pendiente de revisión" : invoiceStatusLabel(invoice.status))} · Solo lectura</p>
      </div>
      <div class="invoice-actions">
        <button class="button secondary" type="button" data-detail-back>Volver al listado</button>
      </div>
      <div class="table-wrap">
        <table class="data-table"><tbody>
          <tr><th>Proveedor</th><td>${invoiceEscape(invoice.vendor_name || "No indicado")}</td></tr>
          <tr><th>Fecha de carga</th><td>${invoiceEscape(invoiceUploadedLabel(invoice.uploaded_at))}</td></tr>
          <tr><th>Fecha de factura</th><td>${invoiceEscape(invoiceDateLabel(invoice.invoice_date))}</td></tr>
          <tr><th>Número</th><td>${invoiceEscape(invoice.invoice_number || "—")}</td></tr>
          <tr><th>Descripción</th><td>${invoiceEscape(invoice.description || "—")}</td></tr>
          <tr><th>Línea de gastos</th><td>${invoiceEscape(financeDetailLine(invoice, lineMap))}</td></tr>
          <tr><th>Método de pago</th><td>${invoiceEscape(invoicePaymentLabel(invoice.payment_method))}</td></tr>
          <tr><th>Total</th><td><strong>${invoiceEscape(invoiceMoney(invoice.total))}</strong></td></tr>
        </tbody></table>
      </div>
      <div class="invoice-preview" data-detail-file><p class="empty-state">Cargando archivo original…</p></div>
    </div>`;
  container.querySelector("[data-detail-back]").addEventListener("click", () => {
    renderFinanceDetailList(container, invoices, lineMap);
  });
  const file = container.querySelector("[data-detail-file]");
  const token = financeDetailToken;
  void (async () => {
    try {
      if (!invoice.original_path) throw new Error("El archivo original no está disponible.");
      const url = await signSupabaseFinanceDocument(invoice.original_path, 900);
      if (token !== financeDetailToken || !file.isConnected) return;
      if (!url) throw new Error("No se pudo cargar el archivo original.");
      if (invoice.original_mime === "application/pdf") {
        const frame = window.document.createElement("iframe");
        frame.title = "Factura original";
        frame.src = url;
        file.replaceChildren(frame);
      } else if (["image/jpeg", "image/png"].includes(invoice.original_mime)) {
        const image = window.document.createElement("img");
        image.alt = "Factura original";
        image.src = url;
        file.replaceChildren(image);
      } else {
        file.textContent = "Este archivo no admite vista previa.";
      }
    } catch (error) {
      if (token !== financeDetailToken || !file.isConnected) return;
      file.textContent = error.message || "No se pudo mostrar el archivo original.";
    }
  })();
}
