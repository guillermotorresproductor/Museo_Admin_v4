"use strict";

// Uncalibrated positions for the ArteGrafiko preprinted check.
// Physical calibration replaces only this object.
const financeCheckPrintLayout = {
  calibrated: false,
  model: "ArteGrafiko",
  unit: "in",
  page: { width: 8.5, height: 11 },
  zones: {
    check: { x: 0.990551, y: 0.811811, width: 7.7, height: 2.75, label: "Cheque" },
    stub1: { x: 0.4, y: 4.273622, width: 7.7, height: 2.55, label: "Talonario 1" },
    stub2: { x: 0.4, y: 7.889764, width: 7.7, height: 2.55, label: "Talonario 2" }
  },
  fields: {
    date: { x: 6.937401, y: 1.092441, width: 1.7, height: 0.28 },
    payee: { x: 1.204331, y: 1.473701, width: 4.8, height: 0.28 },
    amountNumeric: { x: 6.994881, y: 1.473701, width: 1.8, height: 0.28 },
    amountWords: { x: 1.093701, y: 1.953071, width: 7.1, height: 0.32 },
    memo: { x: 1.343701, y: 2.631811, width: 4.6, height: 0.28 },
    stub1Payee: { x: 0.7, y: 4.473622, width: 4.4, height: 0.24 },
    stub1Date: { x: 5.3, y: 4.473622, width: 1.5, height: 0.24 },
    stub1CheckNumber: { x: 6.9, y: 4.473622, width: 0.9, height: 0.24 },
    stub1Memo: { x: 0.7, y: 4.873622, width: 4.8, height: 0.24 },
    stub1Amount: { x: 5.7, y: 4.873622, width: 2.1, height: 0.24 },
    stub1Reference: { x: 0.7, y: 5.273622, width: 7.1, height: 0.24 },
    stub1BudgetLine: { x: 0.7, y: 5.673622, width: 7.1, height: 0.24 },
    stub2Payee: { x: 0.7, y: 8.089764, width: 4.4, height: 0.24 },
    stub2Date: { x: 5.3, y: 8.089764, width: 1.5, height: 0.24 },
    stub2CheckNumber: { x: 6.9, y: 8.089764, width: 0.9, height: 0.24 },
    stub2Memo: { x: 0.7, y: 8.489764, width: 4.8, height: 0.24 },
    stub2Amount: { x: 5.7, y: 8.489764, width: 2.1, height: 0.24 },
    stub2Reference: { x: 0.7, y: 8.889764, width: 7.1, height: 0.24 },
    stub2BudgetLine: { x: 0.7, y: 9.289764, width: 7.1, height: 0.24 }
  }
};

const financeCheckStatusLabels = { draft: "Borrador", issued: "Emitido", voided: "Anulado" };
const financeCheckErrors = {
  INVOICE_ALREADY_PAID: "Esa factura ya tiene un cheque emitido.",
  CHECK_NUMBER_TAKEN: "Ese número de cheque ya existe, incluso si fue anulado.",
  CHECK_LOCKED: "Un cheque emitido no se puede editar.",
  CHECK_NOT_DRAFT: "Solo un borrador se puede emitir.",
  CHECK_AMOUNT_MISMATCH: "El cheque debe ser por el total de la factura.",
  INVOICE_NOT_ELIGIBLE: "Esa factura no está confirmada o ya no se puede pagar.",
  INVOICE_MUSEUM_MISMATCH: "La factura no pertenece a este museo.",
  EMPLOYEE_MUSEUM_MISMATCH: "El empleado no pertenece a este museo.",
  EMPLOYEE_NOT_ACTIVE: "Solo se puede pagar a un empleado activo.",
  BUDGET_LINE_MUSEUM_MISMATCH: "El renglón no pertenece a este museo.",
  BUDGET_LINE_NOT_EXPENSE_ELIGIBLE: "Ese renglón no está disponible para un gasto directo.",
  MOVEMENT_MUSEUM_MISMATCH: "El movimiento no pertenece a este museo.",
  INVALID_CHECK_NUMBER: "Escriba el número del cheque, hasta 20 caracteres.",
  INVALID_PAYEE: "Escriba el beneficiario.",
  INVALID_MEMO: "Escriba el concepto.",
  INVALID_DATE: "Escriba la fecha del cheque.",
  INVALID_PERIOD: "El período de nómina necesita fecha de inicio y fecha final.",
  INVALID_AMOUNT: "La cantidad debe ser mayor que cero, con dos decimales.",
  "Invalid amount": "La cantidad debe ser mayor que cero, con dos decimales.",
  "Invalid void reason": "Escriba el motivo de la anulación.",
  "Missing financial authorization": "No tiene permiso para esta operación."
};

let financeCheckToken = 0;
let financeCheckCatalog = { checks: [], employees: [], invoices: [], lines: [] };

function cancelFinanceChecks() {
  financeCheckToken += 1;
}

function financeCheckEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function financeCheckMoney(value) {
  return Number(value || 0).toLocaleString("es-PR", { style: "currency", currency: "USD" });
}

function financeCheckPrintedAmount(value) {
  return Number(value || 0).toLocaleString("es-PR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function financeCheckDateLabel(value) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
}

function financeCheckErrorMessage(error) {
  const message = String(error?.message || "");
  const match = Object.entries(financeCheckErrors).find(([code]) => message.includes(code));
  return match ? match[1] : "No se pudo completar la operación del cheque.";
}

function financeCheckTypeLabel(check) {
  if (check.payment_type === "payroll") return "Nómina";
  if (check.expense_source === "invoice") return "Factura";
  return "Gasto directo";
}

function financeCheckReference(check) {
  if (check.payment_type === "payroll") {
    if (check.period_start && check.period_end) {
      return `Nómina ${financeCheckDateLabel(check.period_start)}–${financeCheckDateLabel(check.period_end)}`;
    }
    return "Nómina";
  }
  if (check.expense_source === "invoice") {
    return check.invoice_reference ? `Factura ${check.invoice_reference}` : "Factura";
  }
  return "";
}

function financeCheckChunk(value, apocope) {
  if (value === 100) return "CIEN";
  const hundreds = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];
  const units = ["CERO", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE"];
  const tens = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  const hundred = hundreds[Math.floor(value / 100)];
  const rest = value % 100;
  let tail = "";
  if (rest > 0 && rest <= 20) {
    tail = rest === 1 && apocope ? "UN" : units[rest];
  } else if (rest > 20 && rest < 30) {
    const twenties = ["", apocope ? "VEINTIÚN" : "VEINTIUNO", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
    tail = twenties[rest - 20];
  } else if (rest >= 30) {
    const one = rest % 10;
    const ten = tens[Math.floor(rest / 10)];
    if (one === 0) tail = ten;
    else tail = `${ten} Y ${one === 1 && apocope ? "UN" : units[one]}`;
  }
  return [hundred, tail].filter(Boolean).join(" ");
}

function financeCheckSpanishAmount(value) {
  if (value === 0) return "CERO";
  const millions = Math.floor(value / 1000000);
  const thousands = Math.floor((value % 1000000) / 1000);
  const rest = value % 1000;
  const parts = [];
  if (millions === 1) parts.push("UN MILLÓN");
  else if (millions > 1) parts.push(`${financeCheckChunk(millions, true)} MILLONES`);
  if (thousands === 1) parts.push("MIL");
  else if (thousands > 1) parts.push(`${financeCheckChunk(thousands, true)} MIL`);
  if (rest) parts.push(financeCheckChunk(rest, true));
  if (millions && !thousands && !rest) parts[parts.length - 1] += " DE";
  return parts.join(" ");
}

function financeCheckAmountWords(amount) {
  const centsTotal = Math.round(Number(amount) * 100);
  if (!Number.isFinite(centsTotal) || centsTotal <= 0) return "";
  const dollars = Math.floor(centsTotal / 100);
  const cents = centsTotal % 100;
  const noun = dollars === 1 ? "DÓLAR" : "DÓLARES";
  return `${financeCheckSpanishAmount(dollars)} ${noun} CON ${String(cents).padStart(2, "0")}/100`;
}

function financeCheckBoxStyle(box) {
  const unit = financeCheckPrintLayout.unit;
  return `position:absolute;left:${box.x}${unit};top:${box.y}${unit};width:${box.width}${unit};height:${box.height}${unit};box-sizing:border-box;overflow:hidden;`;
}

function financeCheckFieldStyle(name) {
  return financeCheckBoxStyle(financeCheckPrintLayout.fields[name]);
}

function financeCheckPrintValues(check) {
  const date = financeCheckDateLabel(check.check_date);
  const amount = financeCheckMoney(check.amount);
  const words = financeCheckAmountWords(check.amount);
  const reference = financeCheckReference(check);
  return {
    date,
    payee: check.payee_name || "",
    amountNumeric: financeCheckPrintedAmount(check.amount),
    amountWords: words,
    memo: check.memo || "",
    stub1Payee: check.payee_name || "",
    stub1Date: date,
    stub1CheckNumber: check.check_number || "",
    stub1Memo: check.memo || "",
    stub1Amount: amount,
    stub1Reference: reference,
    stub1BudgetLine: check.budget_name || "",
    stub2Payee: check.payee_name || "",
    stub2Date: date,
    stub2CheckNumber: check.check_number || "",
    stub2Memo: check.memo || "",
    stub2Amount: amount,
    stub2Reference: reference,
    stub2BudgetLine: check.budget_name || ""
  };
}

function financeCheckSheetMarkup(check) {
  const layout = financeCheckPrintLayout;
  const unit = layout.unit;
  const values = financeCheckPrintValues(check);
  const zones = Object.values(layout.zones).map((zone) => `
    <div class="finance-check-zone" style="${financeCheckBoxStyle(zone)}border:1px dashed #c8c8c8;">
      <span class="finance-check-zone-label" style="font:10px sans-serif;color:#777;">${financeCheckEscape(zone.label)}</span>
    </div>`).join("");
  const fields = Object.entries(layout.fields).map(([name]) => `
    <div class="finance-check-field" style="${financeCheckFieldStyle(name)}font:11pt 'Times New Roman',serif;line-height:1.1;">${financeCheckEscape(values[name])}</div>`).join("");
  return `<div class="finance-check-sheet" style="position:relative;width:${layout.page.width}${unit};height:${layout.page.height}${unit};background:#fff;">${zones}${fields}</div>`;
}

function financeCheckPrintCss() {
  const layout = financeCheckPrintLayout;
  const unit = layout.unit;
  const width = `${layout.page.width}${unit}`;
  const height = `${layout.page.height}${unit}`;
  const hidden = ".finance-check-print-note, .finance-check-zone, .finance-check-zone-label, .finance-check-guide";
  return `
    @page { size: ${width} ${height}; margin: 0; }
    html, body { margin: 0; padding: 0; width: ${width}; height: ${height}; overflow: hidden; }
    .finance-check-sheet { position: relative; width: ${width}; height: ${height}; }
    .finance-check-field { font: 11pt "Times New Roman", serif; line-height: 1.1; color: #000; }
    .finance-check-print-note { position: fixed; left: 0; top: 0; right: 0; z-index: 2; margin: 0; padding: 8px 12px; font: 12px Arial, sans-serif; background: #f4f1ea; color: #222; }
    @media print { ${hidden} { display: none !important; } }
  `;
}

function financeCheckPrintDocument(check) {
  const title = `Cheque ${check.check_number || ""}`;
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${financeCheckEscape(title)}</title>
  <style>${financeCheckPrintCss()}</style>
</head>
<body>
  
  ${financeCheckSheetMarkup(check)}
  <script>addEventListener("load", () => { print(); });</script>
</body>
</html>`;
}

function financeCheckOpenPrint(check) {
  const preview = window.open("", "finance-check-print", "width=900,height=760");
  if (!preview) return;
  preview.document.open();
  preview.document.write(financeCheckPrintDocument(check));
  preview.document.close();
}

async function loadFinanceCheckCatalog() {
  const [checks, employees, invoices, lines] = await Promise.all([
    supabasePost("/rest/v1/rpc/list_finance_checks", {}),
    supabasePost("/rest/v1/rpc/list_finance_check_employees", {}),
    supabasePost("/rest/v1/rpc/list_finance_check_invoices", {}),
    fetchInvoiceBudgetLines()
  ]);
  financeCheckCatalog = {
    checks: Array.isArray(checks) ? checks : [],
    employees: Array.isArray(employees) ? employees : [],
    invoices: Array.isArray(invoices) ? invoices : [],
    lines: Array.isArray(lines) ? lines : []
  };
}

function renderFinanceChecks() {
  const panel = document.querySelector("[data-finance-panel]");
  if (!panel) return;
  const token = ++financeCheckToken;
  panel.innerHTML = `<p class="page-kicker">Cheques</p><h3>Cheques</h3><p>Cargando historial.</p>`;
  Promise.all([
    loadFinanceCheckCatalog(),
    typeof financeDocumentCanDecide === "function" ? financeDocumentCanDecide().catch(() => false) : Promise.resolve(false)
  ]).then(([, canOperate]) => {
    if (token !== financeCheckToken) return;
    renderFinanceCheckList(panel, token, canOperate === true, "");
  }).catch((error) => {
    if (token !== financeCheckToken) return;
    panel.innerHTML = `<p class="page-kicker">Cheques</p><h3>Cheques</h3><p class="form-message error">${financeCheckEscape(financeCheckErrorMessage(error))}</p>`;
  });
}

function renderFinanceCheckList(panel, token, canWrite, notice) {
  const rows = financeCheckCatalog.checks.map((check) => `
    <tr>
      <td>${financeCheckEscape(check.check_number)}</td>
      <td>${financeCheckEscape(financeCheckDateLabel(check.check_date))}</td>
      <td>${financeCheckEscape(check.payee_name)}</td>
      <td>${financeCheckEscape(financeCheckTypeLabel(check))}</td>
      <td>${financeCheckEscape(check.memo)}</td>
      <td>${financeCheckEscape(financeCheckMoney(check.amount))}</td>
      <td>${financeCheckEscape(financeCheckStatusLabels[check.status] || check.status)}</td>
      <td>
        <button class="button secondary" type="button" data-check-view="${financeCheckEscape(check.id)}">Ver</button>
        <button class="button secondary" type="button" data-check-print="${financeCheckEscape(check.id)}">Imprimir</button>
        ${canWrite && check.status !== "voided" ? `<button class="button secondary" type="button" data-check-void="${financeCheckEscape(check.id)}">Anular</button>` : ""}
      </td>
    </tr>`).join("");
  panel.innerHTML = `
    <p class="page-kicker">Cheques</p>
    <h3>Cheques</h3>
    <p>El cheque de gasto directo crea el movimiento al emitirse. El cheque de una factura usa el movimiento que la factura ya tiene. El cheque de nómina no crea un gasto.</p>
    ${notice ? `<p class="form-message">${financeCheckEscape(notice)}</p>` : ""}
    ${canWrite ? `<p><button class="button" type="button" data-check-new>Nuevo cheque</button></p>` : ""}
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Número</th><th>Fecha</th><th>Beneficiario</th><th>Tipo</th><th>Concepto</th><th>Cantidad</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="8">No hay cheques registrados.</td></tr>`}</tbody>
      </table>
    </div>`;
  panel.querySelector("[data-check-new]")?.addEventListener("click", () => {
    if (token !== financeCheckToken) return;
    renderFinanceCheckType(panel, token, canWrite);
  });
  panel.querySelectorAll("[data-check-view], [data-check-void]").forEach((button) => {
    button.addEventListener("click", () => {
      if (token !== financeCheckToken) return;
      const id = button.dataset.checkView || button.dataset.checkVoid;
      renderFinanceCheckDetail(panel, token, canWrite, financeCheckCatalog.checks.find((item) => item.id === id), button.dataset.checkVoid ? "focus-void" : "");
    });
  });
  panel.querySelectorAll("[data-check-print]").forEach((button) => {
    button.addEventListener("click", () => {
      const check = financeCheckCatalog.checks.find((item) => item.id === button.dataset.checkPrint);
      if (check) financeCheckOpenPrint(check);
    });
  });
}

function renderFinanceCheckType(panel, token, canWrite) {
  panel.innerHTML = `
    <p class="page-kicker">Cheques</p>
    <h3>Nuevo cheque</h3>
    <p>Tipo de pago</p>
    <p>
      <button class="button" type="button" data-check-type="expense">Gasto / Suplidor</button>
      <button class="button secondary" type="button" data-check-type="payroll">Nómina / Empleado</button>
    </p>
    <p><button class="button secondary" type="button" data-check-back>Volver</button></p>`;
  panel.querySelector("[data-check-back]")?.addEventListener("click", () => renderFinanceCheckList(panel, token, canWrite, ""));
  panel.querySelectorAll("[data-check-type]").forEach((button) => {
    button.addEventListener("click", () => {
      if (token !== financeCheckToken) return;
      if (button.dataset.checkType === "payroll") renderFinanceCheckForm(panel, token, canWrite, { payment_type: "payroll" });
      else renderFinanceCheckSource(panel, token, canWrite);
    });
  });
}

function renderFinanceCheckSource(panel, token, canWrite) {
  panel.innerHTML = `
    <p class="page-kicker">Cheques</p>
    <h3>Gasto / Suplidor</h3>
    <p>Origen del gasto</p>
    <p>
      <button class="button" type="button" data-check-source="direct">Gasto nuevo</button>
      <button class="button secondary" type="button" data-check-source="invoice">Factura registrada</button>
    </p>
    <p><button class="button secondary" type="button" data-check-back>Volver</button></p>`;
  panel.querySelector("[data-check-back]")?.addEventListener("click", () => renderFinanceCheckType(panel, token, canWrite));
  panel.querySelectorAll("[data-check-source]").forEach((button) => {
    button.addEventListener("click", () => {
      if (token !== financeCheckToken) return;
      renderFinanceCheckForm(panel, token, canWrite, { payment_type: "expense", expense_source: button.dataset.checkSource });
    });
  });
}

function financeCheckLineOptions(selected) {
  return financeCheckCatalog.lines.map((line) => `
    <option value="${financeCheckEscape(line.id)}" ${line.id === selected ? "selected" : ""}>${financeCheckEscape(line.category)} → ${financeCheckEscape(line.name)}</option>`).join("");
}

function financeCheckEmployeeOptions(selected) {
  return financeCheckCatalog.employees.map((employee) => `
    <option value="${financeCheckEscape(employee.id)}" ${employee.id === selected ? "selected" : ""}>${financeCheckEscape(employee.name)}</option>`).join("");
}

function financeCheckField(id, label, control) {
  return `<div class="field"><label for="${id}">${label}</label>${control}</div>`;
}

function financeCheckInvoiceOptions(selected) {
  const options = financeCheckCatalog.invoices.map((invoice) => `
    <option value="${financeCheckEscape(invoice.id)}" ${invoice.id === selected ? "selected" : ""}>${financeCheckEscape(invoice.vendor_name)} · ${financeCheckEscape(invoice.invoice_number || "Sin número")} · ${financeCheckEscape(financeCheckMoney(invoice.total))}</option>`).join("");
  return `<option value="">Seleccione una factura confirmada</option>${options}`;
}

function renderFinanceCheckForm(panel, token, canWrite, check) {
  const invoice = check.expense_source === "invoice";
  const payroll = check.payment_type === "payroll";
  const direct = check.payment_type === "expense" && check.expense_source === "direct";
  const title = payroll ? "Nómina / Empleado" : invoice ? "Pago de factura" : "Gasto nuevo";
  panel.innerHTML = `
    <p class="page-kicker">Cheques</p>
    <h3>${financeCheckEscape(title)}</h3>
    <p class="form-message" data-check-form-message></p>
    <form data-check-form>
      <div class="form-grid">
        ${invoice ? financeCheckField("check-invoice", "Factura", `<select id="check-invoice" name="finance_document_id" required>${financeCheckInvoiceOptions(check.finance_document_id)}</select>`) : ""}
        ${financeCheckField("check-number", "Número de cheque", `<input id="check-number" name="check_number" required maxlength="20" value="${financeCheckEscape(check.check_number || "")}">`)}
        ${financeCheckField("check-date", "Fecha", `<input id="check-date" name="check_date" type="date" required value="${financeCheckEscape(String(check.check_date || "").slice(0, 10))}">`)}
        ${direct ? financeCheckField("check-payee", "Beneficiario", `<input id="check-payee" name="payee_name" required maxlength="200" value="${financeCheckEscape(check.payee_name || "")}">`) : ""}
        ${direct ? financeCheckField("check-amount", "Cantidad", `<input id="check-amount" name="amount" type="number" min="0.01" step="0.01" required value="${check.amount ?? ""}">`) : ""}
        ${direct ? financeCheckField("check-memo", "Concepto / Memo", `<input id="check-memo" name="memo" required maxlength="500" value="${financeCheckEscape(check.memo || "")}">`) : ""}
        ${direct ? financeCheckField("check-line", "Categoría / Renglón", `<select id="check-line" name="budget_line_id" required><option value="">Seleccione un renglón</option>${financeCheckLineOptions(check.budget_line_id)}</select>`) : ""}
        ${payroll ? financeCheckField("check-employee", "Empleado", `<select id="check-employee" name="employee_id" required><option value="">Seleccione un empleado activo</option>${financeCheckEmployeeOptions(check.employee_id)}</select>`) : ""}
        ${payroll ? financeCheckField("check-amount", "Cantidad", `<input id="check-amount" name="amount" type="number" min="0.01" step="0.01" required value="${check.amount ?? ""}">`) : ""}
        ${payroll ? financeCheckField("check-memo", "Concepto / Memo", `<input id="check-memo" name="memo" required maxlength="500" value="${financeCheckEscape(check.memo || "")}">`) : ""}
        ${payroll ? financeCheckField("check-period-start", "Período desde", `<input id="check-period-start" name="period_start" type="date" value="${financeCheckEscape(String(check.period_start || "").slice(0, 10))}">`) : ""}
        ${payroll ? financeCheckField("check-period-end", "Período hasta", `<input id="check-period-end" name="period_end" type="date" value="${financeCheckEscape(String(check.period_end || "").slice(0, 10))}">`) : ""}
      </div>
      <div data-check-invoice-preview></div>
      <p style="margin-top:16px">
        <button class="button secondary" type="submit" name="intent" value="draft">Guardar borrador</button>
        <button class="button" type="submit" name="intent" value="issue">Emitir</button>
        <button class="button secondary" type="button" data-check-back>Volver</button>
      </p>
    </form>`;
  const form = panel.querySelector("[data-check-form]");
  const preview = panel.querySelector("[data-check-invoice-preview]");
  const showInvoice = () => {
    if (!invoice || !preview) return;
    const selected = financeCheckCatalog.invoices.find((item) => item.id === form.elements.finance_document_id.value);
    preview.innerHTML = selected ? `
      <div class="table-wrap"><table class="data-table"><tbody>
        <tr><th>Beneficiario</th><td>${financeCheckEscape(selected.vendor_name)}</td></tr>
        <tr><th>Total</th><td>${financeCheckEscape(financeCheckMoney(selected.total))}</td></tr>
        <tr><th>Concepto</th><td>${financeCheckEscape(selected.description)}</td></tr>
        <tr><th>Factura</th><td>${financeCheckEscape(selected.invoice_number || "—")}</td></tr>
        <tr><th>Renglón</th><td>${financeCheckEscape(selected.category)} → ${financeCheckEscape(selected.name)}</td></tr>
      </tbody></table></div>` : "";
  };
  form.elements.finance_document_id?.addEventListener("change", showInvoice);
  showInvoice();
  panel.querySelector("[data-check-back]")?.addEventListener("click", () => renderFinanceCheckList(panel, token, canWrite, ""));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (token !== financeCheckToken) return;
    const intent = event.submitter?.value || "draft";
    const message = panel.querySelector("[data-check-form-message]");
    try {
      const saved = await supabasePost("/rest/v1/rpc/save_finance_check_draft", financeCheckDraftPayload(form, check));
      if (intent === "issue") await supabasePost("/rest/v1/rpc/issue_finance_check", { p_check_id: saved.id });
      await loadFinanceCheckCatalog();
      if (token !== financeCheckToken) return;
      renderFinanceCheckList(panel, token, canWrite, intent === "issue" ? "Cheque emitido." : "Borrador guardado.");
    } catch (error) {
      if (message) message.textContent = financeCheckErrorMessage(error);
    }
  });
}

function financeCheckBlank(value) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function financeCheckId(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function financeCheckDraftPayload(form, check) {
  const invoice = check.expense_source === "invoice"
    ? financeCheckCatalog.invoices.find((item) => item.id === form.elements.finance_document_id.value)
    : null;
  const payroll = check.payment_type === "payroll";
  const amount = invoice ? Number(invoice.total) : Math.round(Number(form.elements.amount.value) * 100) / 100;
  return {
    p_check_id: financeCheckId(check.id),
    p_payment_type: check.payment_type,
    p_expense_source: payroll ? null : check.expense_source,
    p_check_number: form.elements.check_number.value,
    p_check_date: form.elements.check_date.value,
    p_payee_name: payroll || invoice ? null : form.elements.payee_name.value,
    p_amount: amount,
    p_memo: invoice ? invoice.description : form.elements.memo.value,
    p_budget_line_id: invoice ? invoice.budget_line_id : (payroll ? null : financeCheckId(form.elements.budget_line_id.value)),
    p_finance_document_id: invoice ? invoice.id : null,
    p_movement_id: invoice ? invoice.movement_id : null,
    p_employee_id: payroll ? financeCheckId(form.elements.employee_id.value) : null,
    p_period_start: payroll ? financeCheckBlank(form.elements.period_start.value) : null,
    p_period_end: payroll ? financeCheckBlank(form.elements.period_end.value) : null
  };
}

function renderFinanceCheckDetail(panel, token, canWrite, check, mode) {
  if (!check) return;
  const editable = canWrite && check.status === "draft";
  const voidable = canWrite && check.status !== "voided";
  const line = check.budget_category ? `${check.budget_category} → ${check.budget_name}` : "—";
  panel.innerHTML = `
    <p class="page-kicker">Cheques</p>
    <h3>Cheque ${financeCheckEscape(check.check_number)}</h3>
    <p>${financeCheckEscape(financeCheckStatusLabels[check.status] || check.status)} · ${financeCheckEscape(financeCheckTypeLabel(check))}</p>
    <p class="form-message" data-check-form-message></p>
    <div class="table-wrap"><table class="data-table"><tbody>
      <tr><th>Fecha</th><td>${financeCheckEscape(financeCheckDateLabel(check.check_date))}</td></tr>
      <tr><th>Beneficiario</th><td>${financeCheckEscape(check.payee_name)}</td></tr>
      <tr><th>Cantidad</th><td>${financeCheckEscape(financeCheckMoney(check.amount))}</td></tr>
      <tr><th>Cantidad en palabras</th><td>${financeCheckEscape(financeCheckAmountWords(check.amount))}</td></tr>
      <tr><th>Concepto</th><td>${financeCheckEscape(check.memo)}</td></tr>
      <tr><th>Renglón</th><td>${financeCheckEscape(line)}</td></tr>
      <tr><th>Referencia</th><td>${financeCheckEscape(financeCheckReference(check) || "—")}</td></tr>
      ${check.void_reason ? `<tr><th>Motivo de anulación</th><td>${financeCheckEscape(check.void_reason)}</td></tr>` : ""}
    </tbody></table></div>
    <p>Vista previa sobre el modelo preimpreso de ArteGrafiko. Las posiciones todavía no están calibradas con el papel físico.</p>
    <div class="table-wrap">${financeCheckSheetMarkup(check)}</div>
    <p>
      <button class="button" type="button" data-check-print>Imprimir</button>
      ${editable ? `<button class="button secondary" type="button" data-check-edit>Editar</button>` : ""}
      ${editable ? `<button class="button" type="button" data-check-issue>Emitir</button>` : ""}
      <button class="button secondary" type="button" data-check-back>Volver</button>
    </p>
    ${voidable ? `<form data-check-void-form><div class="field"><label for="check-void-reason">Motivo de anulación</label><textarea id="check-void-reason" name="void_reason" required maxlength="500"></textarea></div><p><button class="button secondary" type="submit">Anular</button></p></form>` : ""}`;
  if (mode === "focus-void") panel.querySelector("[name=void_reason]")?.focus();
  panel.querySelector("[data-check-back]")?.addEventListener("click", () => renderFinanceCheckList(panel, token, canWrite, ""));
  panel.querySelector("[data-check-print]")?.addEventListener("click", () => financeCheckOpenPrint(check));
  panel.querySelector("[data-check-edit]")?.addEventListener("click", () => renderFinanceCheckForm(panel, token, canWrite, check));
  panel.querySelector("[data-check-issue]")?.addEventListener("click", async () => {
    const message = panel.querySelector("[data-check-form-message]");
    try {
      await supabasePost("/rest/v1/rpc/issue_finance_check", { p_check_id: check.id });
      await loadFinanceCheckCatalog();
      if (token !== financeCheckToken) return;
      renderFinanceCheckList(panel, token, canWrite, "Cheque emitido.");
    } catch (error) {
      if (message) message.textContent = financeCheckErrorMessage(error);
    }
  });
  panel.querySelector("[data-check-void-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = panel.querySelector("[data-check-form-message]");
    try {
      await supabasePost("/rest/v1/rpc/void_finance_check", {
        p_check_id: check.id,
        p_void_reason: event.currentTarget.elements.void_reason.value
      });
      await loadFinanceCheckCatalog();
      if (token !== financeCheckToken) return;
      renderFinanceCheckList(panel, token, canWrite, "Cheque anulado. El historial se conserva.");
    } catch (error) {
      if (message) message.textContent = financeCheckErrorMessage(error);
    }
  });
}
