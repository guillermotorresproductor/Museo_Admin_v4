"use strict";
// Leave requests only. Attendance, payroll and schedules are outside this module.
async function bindEmployeeLeaveRequests(employee) {
  const region = document.querySelector("[data-administrative-leave]");
  if (!region || !employee?.id || region.dataset.leaveBound === "1") return;
  region.dataset.leaveBound = "1";
  region.hidden = false;
  const reviewer = ["gerente_administrativo", "director_ejecutivo", "administrador_general"].includes(employee.accessProfile);
  const form = region.querySelector("[data-admin-leave-form]");
  const list = region.querySelector("[data-admin-leave-list]");
  const message = region.querySelector("[data-admin-leave-message]");
  if (!form || !list || !message) return;
  const employeeField = form.elements.employeeId;
  employeeField.replaceChildren();
  const option = document.createElement("option");
  option.value = employee.id;
  option.textContent = employeeDisplayName(employee);
  employeeField.append(option);
  employeeField.value = employee.id;
  employeeField.disabled = true;
  const heading = region.querySelector("[data-admin-leave-heading]");
  if (heading) heading.textContent = "Mis solicitudes de días libres";
  const reviewersHeading = region.querySelector("[data-admin-leave-review-heading]");
  if (reviewersHeading) reviewersHeading.hidden = !reviewer;
  let busy = false;
  const say = (text, type = "") => {
    message.textContent = text;
    message.className = `portal-message ${type}`.trim();
  };
  const types = { personal: "Personal", vacaciones: "Vacaciones", enfermedad: "Enfermedad", otro: "Otro" };
  const statuses = { pending: "Pendiente", approved: "Aprobada", rejected: "Rechazada" };
  const names = new Map();
  if (reviewer) {
    try {
      const employees = await fetchSupabaseEmployees();
      for (const person of employees || []) names.set(String(person.id), employeeDisplayName(person));
    } catch { /* Review list still works without employee names. */ }
  }
  const row = (request, isOwn) => {
    const article = document.createElement("article");
    article.className = "executive-event";
    const title = document.createElement("strong");
    title.textContent = isOwn ? "Mi solicitud" : (names.get(String(request.employee_id)) || "Empleado");
    const detail = document.createElement("p");
    detail.textContent = `${request.start_date} al ${request.end_date} · ${types[request.leave_type] || request.leave_type} · ${statuses[request.status] || request.status}`;
    const reason = document.createElement("p");
    reason.textContent = request.reason || "";
    article.append(title, detail, reason);
    if (reviewer && !isOwn && request.status === "pending") {
      for (const [decision, label] of [["approved", "Aprobar"], ["rejected", "Rechazar"]]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "portal-inline-button";
        button.textContent = label;
        button.addEventListener("click", async () => {
          if (busy || !window.confirm(`¿${label} esta solicitud de días libres?`)) return;
          busy = true;
          button.disabled = true;
          try {
            await supabasePost("/rest/v1/rpc/review_employee_leave_request", { p_request_id: request.id, p_decision: decision });
            say("Decisión registrada.", "success");
            await refresh();
          } catch (error) { say(error.message || "No se pudo guardar la decisión.", "error"); }
          finally { busy = false; button.disabled = false; }
        });
        article.append(button);
      }
    }
    return article;
  };
  async function refresh() {
    try {
      const records = await supabaseGet("/rest/v1/employee_leave_requests?select=id,employee_id,requested_by,start_date,end_date,leave_type,reason,status,created_at&order=created_at.desc&limit=200");
      list.replaceChildren();
      const own = (records || []).filter(record => String(record.employee_id) === String(employee.id));
      const ownTitle = document.createElement("h3");
      ownTitle.textContent = "Mis solicitudes";
      list.append(ownTitle);
      if (!own.length) {
        const empty = document.createElement("p");
        empty.textContent = "No has solicitado días libres.";
        list.append(empty);
      } else own.forEach(request => list.append(row(request, true)));
      if (reviewer) {
        const reviewTitle = document.createElement("h3");
        reviewTitle.textContent = "Solicitudes pendientes de aprobación";
        list.append(reviewTitle);
        const pending = (records || []).filter(record => record.status === "pending" && String(record.employee_id) !== String(employee.id));
        if (!pending.length) {
          const empty = document.createElement("p");
          empty.textContent = "No hay solicitudes pendientes.";
          list.append(empty);
        } else pending.forEach(request => list.append(row(request, false)));
      }
    } catch (error) {
      list.textContent = "No fue posible cargar las solicitudes: " + (error.message || "error de conexión");
    }
  }
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    const values = new FormData(form);
    const start_date = String(values.get("startDate") || "");
    const end_date = String(values.get("endDate") || "");
    const reason = String(values.get("reason") || "").trim();
    if (!start_date || !end_date || end_date < start_date || reason.length < 5) {
      say("Verifica las fechas y escribe un motivo de al menos cinco caracteres.", "error");
      return;
    }
    busy = true;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/employee_leave_requests`, {
        method: "POST",
        headers: { ...(await supabaseAuthHeaders()), Prefer: "return=representation" },
        body: JSON.stringify({ employee_id: employee.id, start_date, end_date, leave_type: values.get("type"), reason })
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "No se pudo registrar la solicitud.");
      }
      say("Solicitud enviada y pendiente de evaluación.", "success");
      form.reset();
      employeeField.value = employee.id;
      await refresh();
    } catch (error) { say(error.message || "No se pudo registrar la solicitud.", "error"); }
    finally { busy = false; submit.disabled = false; }
  });
  await refresh();
}
