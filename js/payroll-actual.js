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
  const fullMonth = payrollMonthRange(now.getFullYear(), now.getMonth() + 1, "month");
  return `
    <section class="payroll-actual" data-payroll-actual>
      <p class="page-kicker">Nómina real</p>
      <h3>Nómina real / acumulada</h3>
      <p>Se calcula al consultar. No modifica el presupuesto.</p>
      <div class="finance-actions">
        <label>Mes <input type="month" data-payroll-month value="${month}"></label>
        <label>Desde <input type="date" data-payroll-from value="${fullMonth.from}"></label>
        <label>Hasta <input type="date" data-payroll-to value="${fullMonth.to}"></label>
        <button class="button secondary" type="button" data-payroll-period="month">Mes completo</button>
        <button class="button secondary" type="button" data-payroll-refresh>Actualizar</button>
      </div>
      <p class="form-message" data-payroll-message></p>
      <div data-payroll-results></div>
      ${hasPermission("compensation.manage") ? `
        <form class="form-grid" data-payroll-assign>
          <h3>Asignar plaza</h3>
          <p>La plaza vigente es la que aplica hoy. Para cambiarla, cierre la asignación actual y después registre la nueva. El historial no se borra.</p>
          <p class="form-message" data-payroll-admin-message></p>
          <div class="field"><label>Empleado<select data-payroll-employee-choice required><option value="">Seleccione un empleado</option></select></label></div>
          <div class="field"><label>Plaza<select data-payroll-line-choice required><option value="">Seleccione una plaza</option></select></label></div>
          <div class="field"><label>Vigente desde<input type="date" data-payroll-assign-from required></label></div>
          <button class="button secondary" type="submit">Asignar</button>
        </form>
        <section class="payroll-assignments" data-payroll-assignments>
          <h3>Asignaciones de plaza</h3>
          <div data-payroll-assignment-list></div>
        </section>` : ""}
    </section>
  `;
}
function renderPayrollResults(payload) {
  const employees = payload.employees || [];
  const totals = employees.reduce((sum, person) => {
    sum.worked += Number(person.worked_minutes || 0);
    sum.amount += Number(person.actual_amount || 0);
    return sum;
  }, { worked: 0, amount: 0 });
  totals.amount = Math.round(totals.amount * 100) / 100;
  const rows = employees.map((person) => `
    <tr>
      <td><button class="button secondary" type="button" data-payroll-open="${person.employee_id}">${safeHtml(person.name)}</button>${payrollEmploymentLabel(person.employment_status) ? ` <span class="status-badge">Exempleado</span>` : ""}</td>
      <td>${safeHtml(person.position || "")}</td>
      <td>${safeHtml(payrollTypeLabel(person.compensation_type))}</td>
      <td class="payroll-key">${person.hourly_rate == null ? "—" : payrollMoney(person.hourly_rate)}</td>
      <td class="payroll-key">${payrollHours(person.worked_minutes)}</td>
      <td class="payroll-key">${payrollHours(person.over_limit_minutes)}</td>
      <td class="payroll-key">${payrollMoney(person.actual_amount)}</td>
      <td>${safeHtml(person.state || "")}</td>
    </tr>
  `).join("");
  return `
    <div class="payroll-summary">
      <p><strong>Período:</strong> ${payrollDateLabel(payload.from)} – ${payrollDateLabel(payload.to)}</p>
      <p><strong>Total horas trabajadas:</strong> ${payrollHours(totals.worked)}</p>
      <p><strong>Total nómina acumulada:</strong> ${payrollMoney(totals.amount)}</p>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Empleado</th><th>Posición</th><th>Tipo</th><th class="payroll-key">Tarifa</th>
            <th class="payroll-key">Horas trabajadas</th><th class="payroll-key">Horas sobre límite</th><th class="payroll-key">Nómina acumulada</th><th>Estado</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="8">No hay actividad en este período.</td></tr>`}</tbody>
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
function payrollEmploymentLabel(status) {
  const value = String(status || "").toLowerCase();
  if (!value || value === "activo" || value === "active") return "";
  return "Exempleado";
}
function payrollTypeLabel(type) {
  const labels = {
    hourly: "Por hora",
    salary: "Sueldo fijo",
    commission: "Comisión",
    mixed: "Mixto",
    stipend: "Estipendio",
    other: "Otro",
    unconfigured: "Pendiente de configurar"
  };
  return labels[type] || (type ? "Compensación registrada" : "—");
}
function payrollNetworkText(detail, fallback) {
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(detail)) {
    return "No hubo conexión. Lo que escribió sigue en el formulario.";
  }
  return fallback;
}
function payrollConsultText(error) {
  const detail = String(error?.message || "");
  console.error("Nómina real:", detail);
  if (detail.includes("FORBIDDEN") || detail.includes("42501")) return "No tiene permiso para consultar la nómina real.";
  if (detail.includes("INVALID_PERIOD")) return "El período indicado no es válido.";
  if (detail.includes("RANGE_TOO_LONG")) return "El período no puede pasar de 366 días.";
  if (detail.includes("FISCAL_START_MISSING")) return "No se pudo determinar el año fiscal del museo.";
  return payrollNetworkText(detail, "No se pudo consultar la nómina real.");
}
function payrollAdminText(error) {
  const detail = String(error?.message || error || "");
  console.error("Asignación de plaza:", detail);
  if (detail.includes("EMPLOYEE_PLAZA_OVERLAP")) return "Ese empleado ya tiene una plaza vigente en esas fechas. Ciérrela antes de asignar otra.";
  if (detail.includes("OPEN_ASSIGNMENT_NOT_FOUND")) return "No hay una asignación abierta para cerrar en esa fecha.";
  if (detail.includes("ASSIGNMENT_ALREADY_CLOSED") || detail.includes("ASSIGNMENT_HISTORY_IMMUTABLE")) return "Esa asignación ya forma parte del historial y no se puede modificar.";
  if (detail.includes("FORBIDDEN") || detail.includes("42501")) return "No tiene permiso para administrar plazas.";
  if (detail.includes("PAYROLL_LINE_NOT_FOUND")) return "Esa plaza no pertenece a la nómina de este museo.";
  if (detail.includes("EMPLOYEE_NOT_FOUND")) return "Ese empleado no pertenece a este museo.";
  if (detail.includes("EFFECTIVE_FROM_REQUIRED") || detail.includes("EFFECTIVE_UNTIL_REQUIRED")) return "Indique la fecha de vigencia.";
  return payrollNetworkText(detail, "No se pudo completar la operación. Lo que escribió sigue en el formulario.");
}
async function bindPayrollActual(museumId) {
  const root = document.querySelector("[data-payroll-actual]");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";
  const message = root.querySelector("[data-payroll-message]");
  const results = root.querySelector("[data-payroll-results]");
  const monthInput = root.querySelector("[data-payroll-month]");
  const fromInput = root.querySelector("[data-payroll-from]");
  const toInput = root.querySelector("[data-payroll-to]");
  let payload = null;
  const showMessage = (text, isError) => {
    message.textContent = text || "";
    message.className = isError ? "form-message error" : "form-message";
  };
  const load = async () => {
    const from = fromInput.value;
    const to = toInput.value;
    if (!from || !to) return;
    if (from > to) {
      results.innerHTML = "";
      showMessage("El período indicado no es válido.", true);
      return;
    }
    showMessage("Consultando nómina real…", false);
    try {
      payload = await supabasePost("/rest/v1/rpc/payroll_actual", { p_from: from, p_to: to });
      results.innerHTML = renderPayrollResults(payload);
      showMessage("", false);
    } catch (error) {
      results.innerHTML = "";
      showMessage(payrollConsultText(error), true);
    }
  };
  root.querySelector("[data-payroll-period='month']")?.addEventListener("click", () => {
    const [year, month] = monthInput.value.split("-").map(Number);
    if (!year || !month) return;
    const range = payrollMonthRange(year, month, "month");
    fromInput.value = range.from;
    toInput.value = range.to;
    load();
  });
  root.querySelector("[data-payroll-refresh]")?.addEventListener("click", load);
  fromInput.addEventListener("change", load);
  toInput.addEventListener("change", load);
  results.addEventListener("click", (event) => {
    const button = event.target.closest("[data-payroll-open]");
    if (!button || !payload) return;
    const person = (payload.employees || []).find((item) => item.employee_id === button.dataset.payrollOpen);
    const detail = results.querySelector("[data-payroll-detail]");
    if (person && detail) detail.innerHTML = renderPayrollDetail(person);
  });
  const assignForm = root.querySelector("[data-payroll-assign]");
  const adminMessage = root.querySelector("[data-payroll-admin-message]");
  const assignmentList = root.querySelector("[data-payroll-assignment-list]");
  const showAdmin = (text, isError) => {
    if (!adminMessage) return;
    adminMessage.textContent = text || "";
    adminMessage.className = isError ? "form-message error" : "form-message";
  };
  if (assignForm) {
    const employeeChoice = assignForm.querySelector("[data-payroll-employee-choice]");
    const lineChoice = assignForm.querySelector("[data-payroll-line-choice]");
    const museum = String(museumId || "");
    let directory = [];
    let lines = [];
    let assignmentRows = [];
    let assigning = false;
    let closing = false;
    const personName = (id) => {
      const person = directory.find((item) => item.id === id);
      return person ? `${person.first_name} ${person.last_name}` : "Empleado";
    };
    const lineName = (id) => lines.find((item) => item.id === id)?.name || "Plaza";
    const assignmentTable = (rows, historical) => `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Empleado</th><th>Plaza</th><th>Vigente desde</th><th>Estado</th>${historical ? "" : "<th></th>"}</tr></thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>${safeHtml(personName(row.employee_id))}</td>
                <td>${safeHtml(lineName(row.budget_line_id))}</td>
                <td>${payrollDateLabel(row.effective_from)}</td>
                <td>${historical ? `Cerrada · ${payrollDateLabel(row.effective_until)}` : "Vigente"}</td>
                ${historical ? "" : `<td>
                  <div class="payroll-close">
                    <input type="date" data-payroll-close-until aria-label="Fecha de cierre">
                    <button class="button secondary" type="button" data-payroll-close="${row.employee_id}">Cerrar asignación</button>
                  </div>
                </td>`}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`;
    const renderAssignments = (rows) => {
      assignmentRows = rows;
      const open = rows.filter((row) => !row.effective_until)
        .sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from)));
      const closed = rows.filter((row) => row.effective_until)
        .sort((a, b) => String(b.effective_until).localeCompare(String(a.effective_until)));
      assignmentList.innerHTML = `
        <div class="payroll-assignment-block">
          <h4>Plaza vigente</h4>
          ${open.length ? assignmentTable(open, false) : "<p>Ningún empleado tiene una plaza vigente.</p>"}
          <h4>Historial</h4>
          ${closed.length ? assignmentTable(closed, true) : "<p>No hay asignaciones cerradas.</p>"}
        </div>`;
    };
    const loadAssignments = async () => {
      if (!museum) {
        showAdmin("No se encontró el museo de esta sesión.", true);
        console.error("Asignación de plaza: Finanzas no entregó el museo ya cargado.");
        return;
      }
      try {
        const [people, payrollLines, assignments] = await Promise.all([
          supabaseGet(`/rest/v1/employees?select=id,first_name,last_name,status&museum_id=eq.${encodeURIComponent(museum)}&order=last_name.asc`),
          supabaseGet(`/rest/v1/finance_budget_lines?select=id,name&museum_id=eq.${encodeURIComponent(museum)}&category=eq.${encodeURIComponent("Nómina")}&order=name.asc`),
          supabaseGet(`/rest/v1/employee_budget_assignments?select=employee_id,budget_line_id,effective_from,effective_until&museum_id=eq.${encodeURIComponent(museum)}&order=effective_from.desc`)
        ]);
        if (!Array.isArray(people) || !Array.isArray(payrollLines) || !Array.isArray(assignments)) {
          throw new Error("La respuesta de asignaciones no tiene el formato esperado.");
        }
        directory = people;
        lines = payrollLines;
        const active = people.filter((person) => person.status === "activo");
        employeeChoice.innerHTML = `<option value="">${active.length ? "Seleccione un empleado" : "No hay empleados activos"}</option>`
          + active.map((person) => `<option value="${person.id}">${safeHtml(`${person.first_name} ${person.last_name}`)}</option>`).join("");
        lineChoice.innerHTML = `<option value="">${lines.length ? "Seleccione una plaza" : "No hay plazas de nómina"}</option>`
          + lines.map((line) => `<option value="${line.id}">${safeHtml(line.name)}</option>`).join("");
        renderAssignments(assignments);
      } catch (error) {
        employeeChoice.innerHTML = `<option value="">No se pudieron cargar los empleados</option>`;
        lineChoice.innerHTML = `<option value="">No se pudieron cargar las plazas</option>`;
        assignmentList.innerHTML = "";
        showAdmin(payrollAdminText(error), true);
      }
    };
    assignForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (assigning) return;
      const submit = assignForm.querySelector("[type=submit]");
      const effectiveFromInput = assignForm.querySelector("[data-payroll-assign-from]");
      const effectiveFrom = effectiveFromInput.value;
      if (!employeeChoice.value || !lineChoice.value || !effectiveFrom) {
        showAdmin("Seleccione el empleado, la plaza y la fecha de vigencia.", true);
        return;
      }
      const openRow = assignmentRows.find((row) => row.employee_id === employeeChoice.value && !row.effective_until);
      if (openRow) {
        showAdmin(`Cierre primero la plaza vigente (${lineName(openRow.budget_line_id)}, desde ${payrollDateLabel(openRow.effective_from)}). Una plaza nueva no sustituye la anterior.`, true);
        return;
      }
      const employeeLabel = employeeChoice.selectedOptions[0]?.textContent || "el empleado";
      const lineLabel = lineChoice.selectedOptions[0]?.textContent || "la plaza";
      if (!window.confirm(`Se asignará ${lineLabel} a ${employeeLabel} desde ${payrollDateLabel(effectiveFrom)}. El presupuesto no se modifica. ¿Desea continuar?`)) return;
      assigning = true;
      if (submit) submit.disabled = true;
      try {
        await supabasePost("/rest/v1/rpc/assign_employee_budget_line", {
          p_employee_id: employeeChoice.value,
          p_budget_line_id: lineChoice.value,
          p_effective_from: effectiveFrom
        });
        showAdmin("Plaza asignada. La vigencia quedó registrada.", false);
        effectiveFromInput.value = "";
        await loadAssignments();
        await load();
      } catch (error) {
        showAdmin(payrollAdminText(error), true);
      } finally {
        assigning = false;
        if (submit) submit.disabled = false;
      }
    });
    assignmentList.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-payroll-close]");
      if (!button || closing) return;
      const untilInput = button.parentElement.querySelector("[data-payroll-close-until]");
      const until = untilInput.value;
      if (!until) {
        showAdmin("Indique hasta qué fecha queda vigente la asignación.", true);
        return;
      }
      const name = personName(button.dataset.payrollClose);
      if (!window.confirm(`Se cerrará la plaza vigente de ${name} el ${payrollDateLabel(until)}. El historial se conserva y la nómina ya calculada no se borra. ¿Desea continuar?`)) return;
      closing = true;
      button.disabled = true;
      try {
        await supabasePost("/rest/v1/rpc/close_employee_budget_assignment", {
          p_employee_id: button.dataset.payrollClose,
          p_effective_until: until
        });
        showAdmin("Asignación cerrada. El historial se conserva.", false);
        await loadAssignments();
        await load();
      } catch (error) {
        showAdmin(payrollAdminText(error), true);
        button.disabled = false;
      } finally {
        closing = false;
      }
    });
    loadAssignments();
  }
  load();
}
