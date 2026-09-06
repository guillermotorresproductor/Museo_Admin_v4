'use strict';
async function supabaseGet(path) {
    const response = await fetch(`${supabaseUrl}${path}`, {
        headers: await supabaseAuthHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "No se pudo consultar el servicio de datos.");
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
        throw new Error(data.message || "No se pudo consultar el servicio de datos.");
    }

    return data;
}

function employeeFromSupabase(row) {
  return {
    id: row.id,
    authUserId: row.profile_id || "",
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
  const data = await supabaseGet("/rest/v1/employees?select=id,profile_id,first_name,last_name,photo_url,position,department,email,phone,address,hire_date,work_schedule,education_level,status,created_at&order=created_at.asc");
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
  if (!response.ok) throw new Error(saved.message || "No se pudo guardar el empleado.");
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
    throw new Error(data.message || "No se pudo actualizar el empleado.");
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
    throw new Error(data.error || "No se pudo actualizar el estado del empleado.");
  }
}

async function fetchCurrentSupabasePermissions() {
  const data = await supabasePost("/rest/v1/rpc/current_user_permissions", {});
  return Array.isArray(data) ? data.map((item) => typeof item === "string" ? item : item.code).filter(Boolean) : [];
}

const employeeInvitationMessages = Object.freeze({
  invite_failed: "No se envió una invitación en esta operación. Revise los requisitos con Administración.",
  invite_sent_link_pending: "La invitación fue enviada, pero la vinculación está pendiente. Puede repararla sin reenviar el correo.",
  invite_sent_linked: "Invitación enviada y vinculación completada. El destinatario puede activar su cuenta.",
  invite_status_unknown: "No se pudo confirmar el envío. Verifique o repare la vinculación sin reenviar el correo."
});
async function inviteSupabaseEmployee(employeeId, action = "invite", requestId = crypto.randomUUID()) {
  let response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/invite-employee`, {
      method: "POST", headers: await supabaseAuthHeaders(),
      body: JSON.stringify({ employee_id: employeeId, action, request_id: requestId })
    });
  } catch {
    return { code: "invite_status_unknown", stage: "verification", message: employeeInvitationMessages.invite_status_unknown };
  }
  const data = await response.json().catch(() => ({}));
  const code = Object.hasOwn(employeeInvitationMessages, data.code) ? data.code : "invite_status_unknown";
  const stages = ["authorization", "validation", "send", "link", "audit", "complete", "verification", "resend", "cooldown"];
  return { code, stage: stages.includes(data.stage) ? data.stage : "verification", message: data.stage === "cooldown" ? "Espere un minuto antes de enviar otro correo." : code === "invite_sent_linked" && data.stage === "resend" ? "Invitación reenviada y vinculación verificada." : employeeInvitationMessages[code] };
}

async function callEmployeeAccessFunction(functionName, body) {
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: await supabaseAuthHeaders(),
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo completar la operación de acceso.");
  return data;
}

async function resendSupabaseEmployeeInvitation(employeeId, requestId = crypto.randomUUID()) {
  return inviteSupabaseEmployee(employeeId, "resend", requestId);
}

async function fetchSupabaseEmployeeAccess(employeeId) {
  return callEmployeeAccessFunction("employee-access", { employee_id: employeeId, action: "status" });
}

async function requestSupabaseEmployeeRecovery(employeeId) {
  return callEmployeeAccessFunction("employee-access", { employee_id: employeeId, action: "recovery", request_id: crypto.randomUUID() });
}

async function deactivateSupabaseEmployeeAccess(employeeId) {
  return callEmployeeAccessFunction("deactivate-user-access", { employee_id: employeeId, confirmed: true, request_id: crypto.randomUUID() });
}

async function reactivateSupabaseEmployeeAccess(employeeId) {
  return callEmployeeAccessFunction("employee-access", { employee_id: employeeId, action: "reactivate", confirmed: true, request_id: crypto.randomUUID() });
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

function passwordRecoveryRedirectUrl() {
  const redirect = new URL("login.html", window.location.href);
  if (typeof isMuseumProductionHost !== "function" || !isMuseumProductionHost()) {
    redirect.searchParams.set("environment", museoEnvironment.name);
  }
  return redirect.href;
}

async function requestSupabasePasswordRecovery(email) {
  const redirectTo = passwordRecoveryRedirectUrl();
  const response = await fetch(`${supabaseUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify({ email })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw passwordSetupError("request_failed");
  }
}

async function verifySupabaseEmailToken({ token_hash, type }) {
  const response = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify({ token_hash, type })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw passwordSetupError("invalid_link");
  }
  return data;
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

const supabaseInventoryPhotosBucket = "inventory-photos";

function inventoryServiceError(data, fallback) {
  const message = String(data?.message || data?.error || fallback || "No se pudo completar la operación.");
  const lower = message.toLowerCase();
  if (data?.code === "23505" || lower.includes("duplicate key")) {
    return new Error("El número de sello o la serie ya existe en este museo.");
  }
  if (data?.code === "40001" || lower.includes("another user")) {
    const error = new Error("Otra persona modificó este equipo. Recargue el listado antes de intentar nuevamente.");
    error.code = "INVENTORY_CONFLICT";
    return error;
  }
  if (data?.code === "42501" || lower.includes("authorized") || lower.includes("permission")) {
    return new Error("Su cuenta no tiene permiso para administrar Inventario.");
  }
  return new Error(message);
}

async function inventoryRpc(functionName, body) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: await supabaseAuthHeaders(),
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw inventoryServiceError(data, "No se pudo guardar el equipo.");
  return data;
}

async function fetchSupabaseInventoryItems({ includeArchived = false } = {}) {
  const archivedFilter = includeArchived ? "" : "&archived_at=is.null";
  return supabaseGet(`/rest/v1/inventory_items?select=*&order=updated_at.desc${archivedFilter}`);
}

async function createSupabaseInventoryItem(item) {
  return inventoryRpc("inventory_create", { p_item: item });
}

async function updateSupabaseInventoryItem(id, expectedVersion, item) {
  return inventoryRpc("inventory_update", {
    p_id: id,
    p_expected_version: expectedVersion,
    p_item: item
  });
}

async function archiveSupabaseInventoryItem(id, expectedVersion) {
  return inventoryRpc("inventory_archive", { p_id: id, p_expected_version: expectedVersion });
}

function inventoryPhotoPath(item) {
  return `${item.museum_id}/${item.id}/main.webp`;
}

async function uploadSupabaseInventoryPhoto(item, webpBlob) {
  const path = inventoryPhotoPath(item);
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${supabaseInventoryPhotosBucket}/${path}`, {
    method: "POST",
    headers: {
      ...(await supabaseAuthHeaders()),
      "Content-Type": "image/webp",
      "x-upsert": "true"
    },
    body: webpBlob
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw inventoryServiceError(data, "No se pudo guardar la fotografía.");
  try {
    return await inventoryRpc("inventory_set_photo", { p_id: item.id, p_expected_version: item.version });
  } catch (error) {
    // Una creación fallida no debe dejar un objeto sin referencia en la base de datos.
    if (!item.photo_path) await deleteSupabaseInventoryPhoto(path).catch(() => {});
    throw error;
  }
}

async function deleteSupabaseInventoryPhoto(path) {
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${supabaseInventoryPhotosBucket}/${path}`, {
    method: "DELETE",
    headers: await supabaseAuthHeaders()
  });
  if (!response.ok && response.status !== 404) {
    const data = await response.json().catch(() => ({}));
    throw inventoryServiceError(data, "No se pudo limpiar la fotografía incompleta.");
  }
}

async function signSupabaseInventoryPhoto(path, expiresIn = 900) {
  if (!path) return "";
  const response = await fetch(`${supabaseUrl}/storage/v1/object/sign/${supabaseInventoryPhotosBucket}/${path}`, {
    method: "POST",
    headers: await supabaseAuthHeaders(),
    body: JSON.stringify({ expiresIn })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw inventoryServiceError(data, "No se pudo mostrar la fotografía.");
  const signedPath = data.signedURL || data.signedUrl || data.signed_url;
  return signedPath ? `${supabaseUrl}/storage/v1${signedPath.startsWith("/") ? "" : "/"}${signedPath}` : "";
}

async function fetchSupabaseCalendarEvents(calendarType = "general") {
  return supabaseGet(`/rest/v1/calendar_events?select=id,calendar_type,title,classification,description,event_date,start_time,end_time,location,assigned_employee_id,status,created_at,updated_at&calendar_type=eq.${encodeURIComponent(calendarType)}&archived_at=is.null&order=event_date.asc,created_at.asc`);
}

async function saveSupabaseCalendarEvent(event, id = "") {
  const profile = await currentMuseumContext();
  const isUpdate = Boolean(id);
  const payload = {
    ...event,
    museum_id: profile.museum_id,
    updated_by: profile.id,
    updated_at: new Date().toISOString()
  };
  if (!isUpdate) payload.created_by = profile.id;
  const response = await fetch(`${supabaseUrl}/rest/v1/calendar_events${isUpdate ? `?id=eq.${encodeURIComponent(id)}` : ""}`, {
    method: isUpdate ? "PATCH" : "POST",
    headers: { ...(await supabaseAuthHeaders()), Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ([]));
  if (!response.ok) throw new Error(data.message || "No se pudo guardar el evento.");
  return data[0] || null;
}

async function archiveSupabaseCalendarEvent(id) {
  const profile = await currentMuseumContext();
  const response = await fetch(`${supabaseUrl}/rest/v1/calendar_events?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...(await supabaseAuthHeaders()), Prefer: "return=minimal" },
    body: JSON.stringify({ archived_at: new Date().toISOString(), updated_by: profile.id, updated_at: new Date().toISOString() })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "No se pudo archivar el evento.");
  }
}

async function fetchSupabaseMaintenanceTasks(recordType) {
  return supabaseGet(`/rest/v1/maintenance_tasks?select=id,employee_id,area,task,task_date,status,observations,record_type,details,created_at,updated_at&record_type=eq.${encodeURIComponent(recordType)}&archived_at=is.null&order=task_date.asc,created_at.asc`);
}

async function saveSupabaseMaintenanceTask(task, id = "") {
  const profile = await currentMuseumContext();
  const isUpdate = Boolean(id);
  const payload = { ...task, museum_id: profile.museum_id, updated_by: profile.id, updated_at: new Date().toISOString() };
  if (!isUpdate) payload.created_by = profile.id;
  const response = await fetch(`${supabaseUrl}/rest/v1/maintenance_tasks${isUpdate ? `?id=eq.${encodeURIComponent(id)}` : ""}`, {
    method: isUpdate ? "PATCH" : "POST",
    headers: { ...(await supabaseAuthHeaders()), Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ([]));
  if (!response.ok) throw new Error(data.message || "No se pudo guardar el registro de mantenimiento.");
  return data[0] || null;
}

async function archiveSupabaseMaintenanceTask(id) {
  const profile = await currentMuseumContext();
  const response = await fetch(`${supabaseUrl}/rest/v1/maintenance_tasks?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...(await supabaseAuthHeaders()), Prefer: "return=minimal" },
    body: JSON.stringify({ archived_at: new Date().toISOString(), updated_by: profile.id, updated_at: new Date().toISOString() })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "No se pudo archivar el registro de mantenimiento.");
  }
}

const passwordSetupMessages = Object.freeze({
  invalid_link: "El enlace no es válido, expiró o ya fue utilizado. Solicite uno nuevo.",
  invalid_profile: "No se pudo validar la vinculación del perfil. Contacte a Administración.",
  invalid_employee: "No se pudo validar la vinculación del empleado y museo. Contacte a Administración.",
  invalid_role: "No se pudo validar la vinculación del rol. Contacte a Administración.",
  unconfirmed: "El correo no está confirmado. Solicite un enlace válido.",
  wrong_account: "La sesión no corresponde a la cuenta del enlace.",
  verifier_missing: "Abra el enlace en el navegador que inició la solicitud o solicite uno nuevo.",
  request_failed: "No se pudo completar la solicitud. Inténtelo más tarde.",
  acceptance_failed: "No se pudo completar la activación. Solicite un enlace válido o contacte a Administración."
});
function passwordSetupError(code) {
  const safeCode = Object.hasOwn(passwordSetupMessages, code) ? code : "acceptance_failed";
  const error = new Error(passwordSetupMessages[safeCode]);
  error.code = safeCode;
  return error;
}
function safePasswordSetupMessage(error) {
  return Object.hasOwn(passwordSetupMessages, error?.code) ? passwordSetupMessages[error.code] : passwordSetupMessages.acceptance_failed;
}
function clearPasswordSetupVerifier() {
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  localStorage.removeItem(`sb-${ref}-auth-token-code-verifier`);
}
async function passwordSetupRequest(path, session, options = {}) {
  let response;
  try {
    response = await fetch(`${supabaseUrl}${path}`, {
      ...options, headers: { ...supabaseHeaders(), Authorization: `Bearer ${session.access_token}` }
    });
  } catch { throw passwordSetupError("acceptance_failed"); }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = passwordSetupError(response.status === 401 ? "invalid_link" : "acceptance_failed");
    if (response.status === 404 && data.code === "PGRST205") {
      if (path.startsWith("/rest/v1/roles?")) error.code = "roles_unavailable";
      if (path.startsWith("/rest/v1/user_roles?")) error.code = "assignments_unavailable";
    }
    throw error;
  }
  return response.status === 204 ? {} : response.json().catch(() => { throw passwordSetupError("acceptance_failed"); });
}
async function exchangeSupabasePasswordSetupCode(code) {
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  const stored = localStorage.getItem(`sb-${ref}-auth-token-code-verifier`);
  clearPasswordSetupVerifier();
  let verifier = stored;
  try { verifier = JSON.parse(stored); } catch { /* Raw SDK storage is also accepted. */ }
  if (typeof verifier !== "string" || !verifier) throw passwordSetupError("verifier_missing");
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=pkce`, {
      method: "POST", headers: supabaseHeaders(),
      body: JSON.stringify({ auth_code: code, code_verifier: verifier.split("/")[0] })
    });
    if (!response.ok) throw passwordSetupError("invalid_link");
    return await response.json();
  } catch { throw passwordSetupError("invalid_link"); }
  finally { verifier = null; code = null; }
}
async function validateSupabasePasswordSetupSession(session, type) {
  if (!session?.access_token) throw passwordSetupError("invalid_link");
  const user = await passwordSetupRequest("/auth/v1/user", session);
  if (!user.id || !user.email_confirmed_at) throw passwordSetupError("unconfirmed");
  if (type === "invite" && !user.invited_at) throw passwordSetupError("invalid_link");
  if (session.user?.id && session.user.id !== user.id) throw passwordSetupError("wrong_account");
  const profiles = await passwordSetupRequest(`/rest/v1/profiles?select=id,museum_id,email,role,status&id=eq.${encodeURIComponent(user.id)}&limit=2`, session);
  const profile = profiles[0];
  if (profiles.length !== 1 || profile.id !== user.id || !profile.museum_id || !["active", "activo"].includes(String(profile.status).toLowerCase()) ||
      String(profile.email).toLowerCase() !== String(user.email).toLowerCase()) throw passwordSetupError("invalid_profile");
  if (type === "invite" || user.invited_at) {
    const employees = await passwordSetupRequest(`/rest/v1/employees?select=id,museum_id,email,profile_id&profile_id=eq.${encodeURIComponent(user.id)}&limit=2`, session);
    if (employees.length !== 1 || employees[0].profile_id !== user.id || employees[0].museum_id !== profile.museum_id ||
        String(employees[0].email).toLowerCase() !== String(user.email).toLowerCase()) throw passwordSetupError("invalid_employee");
    let usesLegacyRbac = false;
    try {
      const roles = await passwordSetupRequest("/rest/v1/roles?select=id&code=eq.empleado", session);
      if (roles.length !== 1) throw passwordSetupError("invalid_role");
    } catch (error) {
      if (error.code !== "roles_unavailable") throw error;
      try {
        await passwordSetupRequest("/rest/v1/user_roles?select=user_id&limit=0", session);
      } catch (probeError) {
        if (probeError.code !== "assignments_unavailable") throw probeError;
        usesLegacyRbac = true;
      }
      if (!usesLegacyRbac || profile.role !== "empleado") throw passwordSetupError("invalid_role");
    }
    if (!usesLegacyRbac) {
      const roles = await passwordSetupRequest(`/rest/v1/user_roles?select=museum_id,valid_until,roles!inner(code)&user_id=eq.${encodeURIComponent(user.id)}&museum_id=eq.${encodeURIComponent(profile.museum_id)}&roles.code=eq.empleado`, session);
      if (!roles.some(role => role.museum_id === profile.museum_id && role.roles?.code === "empleado" &&
          (!role.valid_until || Date.parse(role.valid_until) > Date.now()))) throw passwordSetupError("invalid_role");
    }
  }
  return { access_token: session.access_token, refresh_token: session.refresh_token,
    user: { id: user.id }, setup_type: type || (user.invited_at ? "invite" : "recovery") };
}
async function updateSupabaseSetupPassword(session, password) {
  const validated = await validateSupabasePasswordSetupSession(session, session.setup_type);
  try {
    const user = await passwordSetupRequest("/auth/v1/user", validated, { method: "PUT", body: JSON.stringify({ password }) });
    if (user.id !== validated.user.id) throw passwordSetupError("wrong_account");
    return { id: user.id };
  } finally {
    validated.access_token = null; validated.refresh_token = null; validated.user = null; password = null;
  }
}
async function closeSupabasePasswordSetupSession(session) {
  await passwordSetupRequest("/auth/v1/logout?scope=local", session, { method: "POST" });
}
