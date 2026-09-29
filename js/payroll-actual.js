// Presents payroll_actual. It does not calculate hours, rates, or budget amounts.
function payrollMoney(value) {
  return Number(value || 0).toLocaleString("es-PR", { style: "currency", currency: "USD" });
}
function payrollHours(minutes) {
  return `${(Number(minutes || 0) / 60).toFixed(2)} h`;
}
function payrollDateLabel(value) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}
function payrollClock(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit", timeZone: "America/Puerto_Rico" });
}
function payrollMonthRange(year, month, kind) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const iso = (date) => date.toISOString().slice(0, 10);
  if (kind === "first") return { from: iso(start), to: iso(new Date(Date.UTC(year, month - 1, 15))) };
  if (kind === "second") return { from: iso(new Date(Date.UTC(year, month - 1, 16))), to: iso(end) };
  return { from: iso(start), to: iso(end) };
}
function renderPayrollActualShell() {
  if (!hasPermission("compensation.read") || !hasPermission("attendance.history.read")) return "";
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Puerto_Rico" }));
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return `
    <section class="payroll-actual" data-payroll-actual>
      <p class="page-kicker">Nómina real</p>
      <h3>Nómina real / acumulada</h3>
      <p>Se calcula al consultar. No modifica el presupuesto.</p>
      <div class="finance-actions">
        <label>Mes <input type="month" data-payroll-month value="${month}"></label>
        <button class="button secondary" type="button" data-payroll-period="first">1–15</button>
        <button class="button secondary" type="button" data-payroll-period="second">16–fin</button>
        <button class="button secondary" type="button" data-payroll-period="month">Mes completo</button>
        <button class="button secondary" type="button" data-payroll-refresh>Actualizar</button>
      </div>
      <p class="form-message" data-payroll-message></p>
      <div data-payroll-results></div>
      ${hasPermission("compensation.manage") ? `
        <form class="form-grid" data-payroll-assign>
          <h3>Asignar plaza</h3>
          <div class="field"><label>Empleado<select data-payroll-employee-choice></select></label></div>
          <div class="field"><label>Plaza<select data-payroll-line-choice></select></label></div>
          <div class="field"><label>Desde<input type="date" data-payroll-assign-from required></label></div>
          <button class="button secondary" type="submit">Asignar</button>
        </form>` : ""}
    </section>
  `;
}
function renderPayrollResults(payload) {
  const plazas = payload.plazas || [];
  const unassigned = payload.unassigned || { actual_amount: 0, employees: [] };
  const employees = payload.employees || [];
  const plazaCards = plazas.map((plaza) => `
    <article class="card panel">
      <h3>${safeHtml(plaza.name)}</h3>
      <p>Presupuesto del mes ${payrollMoney(plaza.budget_amount)}</p>
      <p>Nómina acumulada ${payrollMoney(plaza.actual_amount)}</p>
      <p>${payload.full_month ? `Disponible ${payrollMoney(plaza.difference)}` : "La diferencia se calcula en el mes completo."}</p>
      <ul>
        ${(plaza.employees || []).map((person) => `<li>${safeHtml(person.name)} ${payrollMoney(person.actual_amount)}</li>`).join("") || "<li>Vacante</li>"}
      </ul>
    </article>
  `).join("");
  const rows = employees.map((person) => `
    <tr>
      <td><button class="button secondary" type="button" data-payroll-open="${person.employee_id}">${safeHtml(person.name)}</button></td>
      <td>${safeHtml(person.position || "")}</td>
      <td>${safeHtml(person.plaza_name || "Sin plaza presupuestaria asignada")}</td>
      <td>${safeHtml(person.compensation_type || "")}</td>
      <td>${person.hourly_rate == null ? "—" : payrollMoney(person.hourly_rate)}</td>
      <td>${person.monthly_equivalent == null ? "—" : payrollMoney(person.monthly_equivalent)}</td>
      <td>${payrollHours(person.worked_minutes)}</td>
      <td>${payrollHours(person.payable_minutes)}</td>
      <td>${payrollHours(person.over_limit_minutes)}</td>
      <td>${payrollMoney(person.actual_amount)}</td>
      <td>${safeHtml(person.state || "")}</td>
    </tr>
  `).join("");
  return `
    <p>${payrollDateLabel(payload.from)} – ${payrollDateLabel(payload.to)}. Presupuesto de referencia: ${safeHtml(payload.budget_month)} ${payload.budget_year}.</p>
    <div class="payroll-plazas">${plazaCards}</div>
    <article class="card panel">
      <h3>Sin plaza presupuestaria asignada</h3>
      <p>Nómina acumulada ${payrollMoney(unassigned.actual_amount)}</p>
      <ul>
        ${(unassigned.employees || []).map((person) => `<li>${safeHtml(person.name)} ${payrollMoney(person.actual_amount)}</li>`).join("") || "<li>Nadie</li>"}
      </ul>
    </article>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Empleado</th><th>Posición</th><th>Plaza</th><th>Tipo</th><th>Tarifa</th><th>Equivalente mensual</th>
            <th>Horas trabajadas</th><th>Horas pagables</th><th>Horas sobre límite</th><th>Nómina acumulada</th><th>Estado</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="11">No hay actividad en este período.</td></tr>`}</tbody>
      </table>
    </div>
    <div data-payroll-detail></div>
  `;
}
function renderPayrollDetail(person) {
  const days = person.days || [];
  return `
    <h3>Detalle de ${safeHtml(person.name)}</h3>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Fecha</th><th>Entrada</th><th>Almuerzo</th><th>Regreso</th><th>Salida</th>
            <th>Horas trabajadas</th><th>Horas pagables</th><th>Tarifa</th><th>Total del día</th><th>Plaza</th><th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${days.map((day) => `
            <tr>
              <td>${payrollDateLabel(day.shift_date)}</td>
              <td>${payrollClock(day.clock_in)}</td>
              <td>${payrollClock(day.lunch_out)}</td>
              <td>${payrollClock(day.lunch_in)}</td>
              <td>${payrollClock(day.clock_out)}</td>
              <td>${payrollHours(day.worked_minutes)}</td>
              <td>${payrollHours(day.payable_minutes)}</td>
              <td>${day.hourly_rate == null ? "—" : payrollMoney(day.hourly_rate)}</td>
              <td>${payrollMoney(day.amount)}</td>
              <td>${safeHtml(day.plaza_name || "Sin plaza presupuestaria asignada")}</td>
              <td>${safeHtml(day.state || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}
async function bindPayrollActual() {
  const root = document.querySelector("[data-payroll-actual]");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";
  const message = root.querySelector("[data-payroll-message]");
  const results = root.querySelector("[data-payroll-results]");
  const monthInput = root.querySelector("[data-payroll-month]");
  let payload = null;
  let kind = "month";
  const showMessage = (text, isError) => {
    message.textContent = text || "";
    message.className = isError ? "form-message error" : "form-message";
  };
  const load = async () => {
    const [year, month] = monthInput.value.split("-").map(Number);
    if (!year || !month) return;
    const range = payrollMonthRange(year, month, kind);
    showMessage("Consultando nómina real…", false);
    try {
      payload = await supabasePost("/rest/v1/rpc/payroll_actual", { p_from: range.from, p_to: range.to });
      results.innerHTML = renderPayrollResults(payload);
      showMessage("", false);
    } catch (error) {
      results.innerHTML = "";
      showMessage(error.message || "No se pudo consultar la nómina real.", true);
    }
  };
  root.querySelectorAll("[data-payroll-period]").forEach((button) => {
    button.addEventListener("click", () => {
      kind = button.dataset.payrollPeriod;
      load();
    });
  });
  root.querySelector("[data-payroll-refresh]")?.addEventListener("click", load);
  monthInput.addEventListener("change", load);
  results.addEventListener("click", (event) => {
    const button = event.target.closest("[data-payroll-open]");
    if (!button || !payload) return;
    const person = (payload.employees || []).find((item) => item.employee_id === button.dataset.payrollOpen);
    const detail = results.querySelector("[data-payroll-detail]");
    if (person && detail) detail.innerHTML = renderPayrollDetail(person);
  });
  const assignForm = root.querySelector("[data-payroll-assign]");
  if (assignForm && currentProfile?.museum_id) {
    try {
      const [employees, lines] = await Promise.all([
        supabaseGet(`/rest/v1/employees?select=id,first_name,last_name&museum_id=eq.${encodeURIComponent(currentProfile.museum_id)}&status=eq.activo&order=last_name.asc`),
        supabaseGet(`/rest/v1/finance_budget_lines?select=id,name&museum_id=eq.${encodeURIComponent(currentProfile.museum_id)}&category=eq.${encodeURIComponent("Nómina")}&order=name.asc`)
      ]);
      const employeeChoice = assignForm.querySelector("[data-payroll-employee-choice]");
      const lineChoice = assignForm.querySelector("[data-payroll-line-choice]");
      employeeChoice.innerHTML = employees.map((person) => `<option value="${person.id}">${safeHtml(`${person.first_name} ${person.last_name}`)}</option>`).join("");
      lineChoice.innerHTML = lines.map((line) => `<option value="${line.id}">${safeHtml(line.name)}</option>`).join("");
      assignForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          await supabasePost("/rest/v1/rpc/assign_employee_budget_line", {
            p_employee_id: employeeChoice.value,
            p_budget_line_id: lineChoice.value,
            p_effective_from: assignForm.querySelector("[data-payroll-assign-from]").value
          });
          showMessage("Plaza asignada.", false);
          await load();
        } catch (error) {
          showMessage(error.message || "No se pudo asignar la plaza.", true);
        }
      });
    } catch (error) {
      assignForm.hidden = true;
    }
  }
  load();
}
