'use strict';
async function supabaseGet(path) {
    const response = await fetch(`${supabaseUrl}${path}`, {
        headers: await supabaseAuthHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Error consultando Supabase.");
    }

    return data;
    }


    async function supabasePost(path, body) {
    const response = await fetch(`${supabaseUrl}${path}`, {
        method: "POST",
        headers: await supabaseAuthHeaders(),
        body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Error consultando Supabase.");
    }

    return data;
}

function employeeFromSupabase(row) {
  return {
    id: row.id,
    authUserId: row.auth_user_id || "",
    avatar: employeeInitials({ nombre: row.first_name, apellidos: row.last_name }),
    nombre: row.first_name || "",
    apellidos: row.last_name || "",
    nombreCompleto: `${row.first_name || ""} ${row.last_name || ""}`.trim(),
    foto: row.photo_url || "",
    posicion: row.position || "",
    departamento: row.department || "",
    correo: row.email || "",
    telefono: row.phone || "",
    direccion: row.address || "",
    fechaContratacion: row.hire_date || "",
    horario: row.work_schedule || "",
    educacion: row.education_level || "",
    condicion: row.medical_condition || "",
    usuario: row.email || "",
    passwordTemporal: "",
    acceso: row.access_level ? row.access_level.charAt(0).toUpperCase() + row.access_level.slice(1) : "Empleado",
    estado: row.status === "inactivo" ? "Inactivo" : "Activo",
    notificaciones: "",
    source: "supabase"
  };
}

function employeeToSupabasePayload(employee, museumId) {
  return {
    museum_id: museumId,
    first_name: employee.nombre,
    last_name: employee.apellidos,
    photo_url: employee.foto && !employee.foto.startsWith("data:") ? employee.foto : null,
    position: employee.posicion,
    department: employee.departamento,
    email: employee.correo,
    phone: employee.telefono || null,
    address: employee.direccion || null,
    hire_date: employee.fechaContratacion || null,
    work_schedule: employee.horario || null,
    education_level: employee.educacion || null,
    status: employee.estado === "Inactivo" ? "inactivo" : "activo"
  };
}

async function fetchSupabaseEmployees() {
  const data = await supabaseGet("/rest/v1/employees?select=id,auth_user_id,first_name,last_name,photo_url,position,department,email,phone,address,hire_date,work_schedule,education_level,status,created_at&order=created_at.asc");
  return data.map(employeeFromSupabase);
}
async function saveSupabaseEmployee(employee, museumId, id) {
  const payload = employeeToSupabasePayload(employee, museumId);
  const isSupabaseId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const path = isSupabaseId
    ? `/rest/v1/employees?id=eq.${encodeURIComponent(id)}`
    : "/rest/v1/employees";
  const response = await fetch(`${supabaseUrl}${path}`, {
    method: isSupabaseId ? "PATCH" : "POST",
    headers: {
      ...(await supabaseAuthHeaders()),
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });
  const saved = await response.json();
  if (!response.ok) throw new Error(saved.message || "No se pudo guardar el empleado en Supabase.");
  return saved;
}

async function updateSupabaseEmployee(id, employee, museumId) {
  const payload = employeeToSupabasePayload(employee, museumId);
  const response = await fetch(`${supabaseUrl}/rest/v1/employees?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: await supabaseAuthHeaders(),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || "No se pudo actualizar Supabase.");
  }
}
async function updateSupabaseEmployeeStatus(id, status) {
  const response = await fetch(`${supabaseUrl}/functions/v1/set-employee-status`, {
    method: "POST",
    headers: await supabaseAuthHeaders(),
    body: JSON.stringify({ employee_id: id, status: status === "Inactivo" ? "inactivo" : "activo" })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo actualizar el estado en Supabase.");
  }
}

async function fetchCurrentSupabasePermissions() {
  const data = await supabasePost("/rest/v1/rpc/current_user_permissions", {});
  return Array.isArray(data) ? data.map((item) => typeof item === "string" ? item : item.code).filter(Boolean) : [];
}

async function inviteSupabaseEmployee(employeeId) {
  const response = await fetch(`${supabaseUrl}/functions/v1/invite-employee`, {
    method: "POST",
    headers: await supabaseAuthHeaders(),
    body: JSON.stringify({ employee_id: employeeId })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo enviar la invitación.");
  return data;
}

async function fetchOwnSupabaseTimeEntries(limit = 7) {
  const safeLimit = Math.min(Math.max(Number(limit) || 7, 1), 30);
  return supabaseGet(`/rest/v1/employee_time_entries?select=id,clock_in,clock_out,source,sync_status&order=clock_in.desc&limit=${safeLimit}`);
}

async function fetchOwnSupabaseAttendanceEvents(limit = 28) {
  const safeLimit = Math.min(Math.max(Number(limit) || 28, 1), 100);
  return supabaseGet(`/rest/v1/attendance_events?select=id,shift_id,event_type,occurred_at,classification,supersedes_event_id,correction_request_id&order=occurred_at.desc&limit=${safeLimit}`);
}

async function clockSupabaseEmployeeTime(action, presence = {}) {
  const response = await fetch(`${supabaseUrl}/functions/v1/clock-employee-time`, {
    method: "POST",
    headers: await supabaseAuthHeaders(),
    body: JSON.stringify({ action, presence })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "No se pudo registrar el ponche.");
    error.code = data.code || "ATTENDANCE_ERROR";
    throw error;
  }
  return data;
}

async function requestSupabasePasswordRecovery(email) {
  const redirectTo = `${window.location.origin}${window.location.pathname}?environment=${encodeURIComponent(museoEnvironment.name)}`;
  const response = await fetch(`${supabaseUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify({ email })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error_description || data.msg || "No se pudo solicitar la recuperación.");
  }
}

async function fetchOwnSupabaseCorrectionShifts(days = 45) {
  const safeDays = Math.min(Math.max(Number(days) || 45, 1), 180);
  const from = encodeURIComponent(new Date(Date.now() - safeDays * 86400000).toISOString());
  const to = encodeURIComponent(new Date(Date.now() + 86400000).toISOString());
  return supabaseGet(`/rest/v1/employee_shifts?select=id,starts_at,ends_at,shift_type,status&starts_at=gte.${from}&starts_at=lte.${to}&order=starts_at.desc&limit=200`);
}

async function fetchOwnSupabaseCorrectionRequests() {
  return supabaseGet("/rest/v1/attendance_correction_requests?select=id,shift_id,original_event_id,requested_event_type,requested_occurred_at,reason,status,requested_at,decided_at,decision_reason,corrected_event_id&order=requested_at.desc&limit=100");
}

async function fetchSupabasePendingCorrections() {
  return supabaseGet("/rest/v1/attendance_correction_requests?select=id,employee_id,shift_id,original_event_id,requested_event_type,requested_occurred_at,reason,status,requested_by,requested_at&status=eq.pending&order=requested_at.asc&limit=200");
}

async function manageSupabaseAttendanceCorrection(action, payload = {}) {
  const response = await fetch(`${supabaseUrl}/functions/v1/manage-attendance-corrections`, {
    method: "POST",
    headers: await supabaseAuthHeaders(),
    body: JSON.stringify({ action, ...payload })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo procesar la correccion de asistencia.");
  return data;
}

async function requestSupabaseAttendanceCorrection(payload) {
  return manageSupabaseAttendanceCorrection("request", payload);
}

async function decideSupabaseAttendanceCorrection(requestId, decision, reason) {
  return manageSupabaseAttendanceCorrection("decide", { request_id: requestId, decision, reason });
}

async function fetchOwnSupabaseNotifications(limit = 5) {
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 20);
  return supabaseGet(`/rest/v1/employee_notifications?select=id,title,message,category,read_at,created_at&order=created_at.desc&limit=${safeLimit}`);
}

async function fetchSupabaseAttendance({ from, to, employeeId } = {}) {
  const filters = ["select=id,employee_id,clock_in,clock_out,source,sync_status"];
  if (from) filters.push(`clock_in=gte.${encodeURIComponent(new Date(`${from}T00:00:00-04:00`).toISOString())}`);
  if (to) filters.push(`clock_in=lte.${encodeURIComponent(new Date(`${to}T23:59:59-04:00`).toISOString())}`);
  if (employeeId) filters.push(`employee_id=eq.${encodeURIComponent(employeeId)}`);
  filters.push("order=clock_in.desc");
  filters.push("limit=500");
  return supabaseGet(`/rest/v1/employee_time_entries?${filters.join("&")}`);
}

async function fetchSupabaseScheduleRules() {
  return supabaseGet("/rest/v1/attendance_schedule_rules?select=id,employee_id,weekdays,starts_local,ends_local,effective_from,effective_until,shift_type,expected_lunch_minutes,timezone,active,version_no,supersedes_rule_id&active=eq.true&order=effective_from.desc");
}

async function manageSupabaseSchedule(action, payload = {}) {
  const response = await fetch(`${supabaseUrl}/functions/v1/manage-attendance-schedules`, { method: "POST", headers: await supabaseAuthHeaders(), body: JSON.stringify({ action, ...payload }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo administrar el horario.");
  return data;
}

async function createSupabaseScheduleRule(rule) { return manageSupabaseSchedule(rule.supersedes_rule_id ? "revise_rule" : "create_rule", { rule }); }
async function deactivateSupabaseScheduleRule(ruleId, reason) { return manageSupabaseSchedule("deactivate_rule", { rule_id: ruleId, reason }); }
async function createSupabaseScheduleException(exception) { return manageSupabaseSchedule("create_exception", { exception }); }
async function fetchSupabaseUpcomingShifts(limit = 30) {
  const now = encodeURIComponent(new Date().toISOString());
  return supabaseGet(`/rest/v1/employee_shifts?select=id,employee_id,starts_at,ends_at,shift_type,status,schedule_rule_id&starts_at=gte.${now}&status=eq.scheduled&order=starts_at.asc&limit=${Math.min(Math.max(Number(limit)||30,1),100)}`);
}

async function fetchSupabaseEmployeeSensitiveDetails(employeeId) {
  const id = encodeURIComponent(employeeId);
  const [compensation, emergencyContacts] = await Promise.all([
    supabaseGet(`/rest/v1/employee_compensation?select=*&employee_id=eq.${id}&limit=1`),
    supabaseGet(`/rest/v1/employee_emergency_contacts?select=*&employee_id=eq.${id}&limit=1`)
  ]);
  return { compensation: compensation[0] || null, emergencyContact: emergencyContacts[0] || null };
}

async function saveSupabaseEmployeeSensitiveDetails(employeeId, compensation, emergencyContact) {
  return supabasePost("/rest/v1/rpc/save_employee_sensitive_details", {
    target_employee_id: employeeId,
    compensation,
    emergency_contact: emergencyContact
  });
}
