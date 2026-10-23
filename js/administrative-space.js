// Perfil específico del Gerente Administrativo; no modifica los módulos existentes.
async function bindAdministrativeSpace(profile, employee) {
  if (employee?.accessProfile !== "gerente_administrativo") return;
  const root = document.querySelector("[data-employee-portal]");
  root?.classList.add("is-administrative");
  const clock = document.querySelector(".portal-clock-card");
  const executive = document.querySelector("[data-executive-space]");
  const staff = executive?.querySelector('[aria-labelledby="executive-staff-title"]');
  const directory = executive?.querySelector('[aria-labelledby="executive-directory-title"]');
  const calendar = executive?.querySelector('[aria-labelledby="executive-calendar-title"]');
  const leave = document.querySelector("[data-administrative-leave]");
  const welcome = document.querySelector(".portal-welcome");
  if (!clock || !staff || !directory || !calendar || !leave || !welcome) return;
  staff.querySelector("h2").textContent = "Asistencia";
  clock.querySelector(".portal-kicker").textContent = "Ponchar";
  welcome.after(clock, staff, directory, calendar, leave);
  leave.hidden = false;
  document.querySelector("[data-portal-account]")?.closest(".portal-section")?.setAttribute("hidden", "");
  document.querySelector("[data-my-shifts]")?.setAttribute("hidden", "");
  document.querySelector("[data-portal-time-list]")?.closest(".portal-section")?.setAttribute("hidden", "");
  document.querySelector("[data-portal-corrections]")?.setAttribute("hidden", "");
  // Las secciones de administración avanzadas permanecen disponibles en sus módulos originales.
  for (const selector of ["[data-punch-corrections]", "[data-overtime-reviews]", "[data-attendance-alerts]", "[data-portal-notifications]"]) {
    const el = document.querySelector(selector);
    if (el) (el.closest(".portal-section") || el).hidden = true;
  }
  const toolSection = document.querySelector("[data-portal-tools]")?.closest(".portal-section");
  if (toolSection) toolSection.hidden = true;
  const employeesPromise = fetchSupabaseEmployees();
  await Promise.allSettled([
    renderExecutiveAttendance(employeesPromise),
    renderExecutiveDirectory(employeesPromise),
    renderExecutiveCalendar(),
    bindAdministrativeLeave(employee, employeesPromise)
  ]);
}

async function bindAdministrativeLeave(employee, employeesPromise) {
  const form = document.querySelector("[data-admin-leave-form]");
  const list = document.querySelector("[data-admin-leave-list]");
  const message = document.querySelector("[data-admin-leave-message]");
  if (!form || !list || !message) return;
  const employees = await employeesPromise;
  const choice = form.elements.employeeId;
  choice.innerHTML = '<option value="">Seleccione un empleado</option>';
  for (const person of employees.filter(x => x.id)) {
    const option = document.createElement("option");
    option.value = person.id;
    option.textContent = executivePersonName(person);
    choice.append(option);
  }
  if (employee?.id) choice.value = employee.id;
  async function refresh() {
    try {
      const rows = await supabaseGet("/rest/v1/employee_leave_requests?select=id,employee_id,start_date,end_date,leave_type,reason,status,created_at&order=created_at.desc&limit=50");
      const names = new Map(employees.map(x => [String(x.id), executivePersonName(x)]));
      list.replaceChildren();
      const pending = (rows || []).filter(x => x.status === "pending");
      if (!pending.length) { list.textContent = "No hay solicitudes pendientes."; return; }
      for (const request of pending) {
        const article = document.createElement("article");
        article.className = "executive-event";
        const title = document.createElement("strong");
        title.textContent = names.get(String(request.employee_id)) || "Empleado";
        const summary = document.createElement("p");
        summary.textContent = `${request.start_date} al ${request.end_date} · ${request.leave_type} · ${request.reason}`;
        article.append(title, summary);
        for (const [status, label] of [["approved", "Aprobar"], ["rejected", "Rechazar"]]) {
          const button = document.createElement("button");
          button.type = "button"; button.className = "portal-inline-button";
          button.textContent = label;
          button.addEventListener("click", async () => {
            button.disabled = true;
            try {
              await supabasePost("/rest/v1/rpc/review_employee_leave_request", { p_request_id: request.id, p_decision: status });
              message.textContent = "Decisión guardada."; await refresh();
            } catch (err) { message.textContent = err.message || "No se pudo guardar."; }
            finally { button.disabled = false; }
          });
          article.append(button);
        }
        list.append(article);
      }
    } catch (error) {
      list.textContent = "Solicitudes no disponibles: " + (error.message || "error de conexión");
    }
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const start_date = String(data.get("startDate") || "");
    const end_date = String(data.get("endDate") || "");
    if (end_date < start_date) { message.textContent = "La fecha final debe ser igual o posterior a la inicial."; return; }
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/employee_leave_requests`, {
        method: "POST",
        headers: { ...(await supabaseAuthHeaders()), Prefer: "return=representation" },
        body: JSON.stringify({
          employee_id: data.get("employeeId"), start_date, end_date,
          leave_type: data.get("type"), reason: String(data.get("reason")).trim()
        })
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "No se pudo registrar la solicitud.");
      }
      message.textContent = "Solicitud registrada. Pendiente de evaluación.";
      form.reset(); if (employee?.id) choice.value = employee.id;
      await refresh();
    } catch (error) { message.textContent = error.message || "No se pudo registrar la solicitud."; }
    finally { button.disabled = false; }
  });
  await refresh();
}
