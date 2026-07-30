const appPages = {
  "index.html": { title: "Dashboard", subtitle: "Panel principal del sistema." },
  "dashboard.html": { title: "Dashboard", subtitle: "Panel principal del sistema." },
  "login.html": { title: "Entrar a mi cuenta", subtitle: "Acceso administrativo del Museo de la Música." },
  "empleados.html": { title: "Solicitud de Empleo", subtitle: "Formulario para candidatos." },
  "ujieres.html": { title: "Ujieres", subtitle: "Calendario mensual de ujieres, horarios y áreas asignadas." },
  "mantenimiento.html": { title: "Mantenimiento", subtitle: "Operación preventiva y correctiva." },
  "calendario.html": { title: "Calendario de Eventos del Museo", subtitle: "Actividades, eventos y compromisos oficiales del Museo." },
  "calendario-obras.html": { title: "Calendario de Obras", subtitle: "Asignación mensual de empleados, tareas y áreas de trabajo." },
  "solicitud-materiales.html": { title: "Solicitud de Materiales", subtitle: "Registro de solicitudes de mantenimiento." },
  "ruta-digital.html": { title: "Ruta Digital de Mantenimiento", subtitle: "Control de recorrido por áreas." },
  "renta-espacios.html": { title: "Renta de Espacios", subtitle: "Solicitud de áreas y tarifas oficiales." },
  "renta-espacio.html": { title: "Renta de Espacios", subtitle: "Ficha, fotografías y condiciones del espacio." },
  "membresias.html": { title: "Membresías", subtitle: "Socios, beneficios, renovaciones y participación." },
  "departamento-museologico.html": { title: "Departamento Museológico", subtitle: "Museología, salas, colecciones y formularios museográficos." },
  "administracion.html": { title: "Administración", subtitle: "Dirección ejecutiva, recursos humanos, notificaciones, reportes y finanzas." },
  "recursos-humanos.html": { title: "Recursos Humanos", subtitle: "Directorio de empleados del museo." },
  "perfil-empleado.html": { title: "Perfil de Empleado", subtitle: "Información administrativa del empleado." },
  "notificaciones.html": { title: "Notificaciones", subtitle: "Alertas internas del sistema administrativo." },
  "reportes.html": { title: "Reportes", subtitle: "Módulo pendiente para programación." },
  "finanzas.html": { title: "Finanzas", subtitle: "Acceso restringido pendiente para firewall." },
  "direccion-ejecutiva.html": { title: "Dirección Ejecutiva", subtitle: "Aprobaciones, seguimientos y supervisión operacional (INSTITUVA)." },
  "reglamento.html": { title: "Reglamento del Museo", subtitle: "Normas oficiales, impresión y descarga." },
  "documentos.html": { title: "Formularios y papelería", subtitle: "Documentos, papelería institucional y más." },
  "deposito-artes.html": { title: "Depósito de Artes", subtitle: "Logos oficiales, artes y guías de marca del Museo." },
  "recibo-prestamo.html": { title: "Formularios Museográficos", subtitle: "Formularios digitales para artículos de colección y procesos museográficos." },
  "boletin.html": { title: "Boletín institucional", subtitle: "Publicaciones, anuncios y comunicaciones." },
  "inventario.html": { title: "Inventario de equipos", subtitle: "Registro, consulta y localización de equipos." }
};

const iconPaths = {
  arrowLeft: '<path d="M19 12H5"></path><path d="m12 19-7-7 7-7"></path>',
  dashboard: '<path d="M3 10.5 12 3l9 7.5"></path><path d="M5 10v10h5v-6h4v6h5V10"></path>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.6 2.6-3-3 2.6-2.6Z"></path>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M3 12h18"></path>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="2"></rect><path d="M8 2v4"></path><path d="M16 2v4"></path><path d="M3 10h18"></path><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path><path d="M8 18h.01"></path><path d="M12 18h.01"></path>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M13.7 21a2 2 0 0 1-3.4 0"></path>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><path d="M14 2v6h6"></path><path d="M8 13h8"></path><path d="M8 17h6"></path>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"></path><path d="M9 12l2 2 4-4"></path>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3Z"></path><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"></path>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="M16 17l5-5-5-5"></path><path d="M21 12H9"></path>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><path d="m9 14 2 2 4-4"></path>',
  building: '<path d="M3 21h18"></path><path d="M5 21V8l7-5 7 5v13"></path><path d="M9 21v-6h6v6"></path>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15Z"></path>',
  chart: '<path d="M3 3v18h18"></path><path d="M8 17V9"></path><path d="M13 17V5"></path><path d="M18 17v-6"></path>',
  dollar: '<path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"></path>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"></path>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M7 10l5 5 5-5"></path><path d="M12 15V3"></path>',
  chevron: '<path d="m6 9 6 6 6-6"></path>'
};

const navigationGroups = [
  {
    label: "Menu",
    items: [
      { href: "dashboard.html", label: "Dashboard", icon: "dashboard" },
      { href: "departamento-museologico.html", label: "Departamento Museológico", icon: "building", activePages: ["recibo-prestamo.html"] },
      { href: "calendario.html", label: "Calendario de Eventos del Museo", icon: "calendar" },
      { href: "renta-espacios.html", label: "Renta de Espacios", icon: "building", activePages: ["renta-espacio.html"] },
      { href: "membresias.html", label: "Membresías", icon: "users" },
      { href: "ujieres.html", label: "Ujieres", icon: "users" },
      { href: "mantenimiento.html", label: "Mantenimiento", icon: "wrench", activePages: ["calendario-obras.html", "solicitud-materiales.html", "ruta-digital.html"] },
      { href: "documentos.html", label: "Formularios y papelería", icon: "file", activePages: ["deposito-artes.html", "empleados.html", "reglamento.html"] },
      { href: "administracion.html", label: "Administración", icon: "shield", activePages: ["recursos-humanos.html", "perfil-empleado.html", "notificaciones.html", "reportes.html", "finanzas.html", "direccion-ejecutiva.html"] },
      { href: "boletin.html", label: "Boletín institucional", icon: "megaphone" },
      { href: "inventario.html", label: "Inventario de equipos", icon: "briefcase" },
      { href: "login.html", label: "Mi cuenta", icon: "logout" }
    ]
  }
];

const moduleShortcutGroups = [
  {
    pages: ["mantenimiento.html", "calendario-obras.html", "solicitud-materiales.html", "ruta-digital.html"],
    links: [
      { href: "calendario-obras.html", label: "Calendario de Obras", icon: "calendar" },
      { href: "solicitud-materiales.html", label: "Solicitud de Materiales", icon: "briefcase" },
      { href: "ruta-digital.html", label: "Ruta Digital", icon: "clipboard" }
    ]
  },
  {
    pages: ["documentos.html", "deposito-artes.html", "reglamento.html", "empleados.html"],
    links: [
      { href: "documentos.html", label: "Formularios y papelería", icon: "file" },
      { href: "deposito-artes.html", label: "Depósito de Artes", icon: "image" },
      { href: "reglamento.html", label: "Reglamento", icon: "book" },
      { href: "empleados.html", label: "Solicitud de Empleo", icon: "users" }
    ]
  },
  {
    pages: ["departamento-museologico.html", "recibo-prestamo.html"],
    links: [
      { href: "departamento-museologico.html", label: "Departamento Museológico", icon: "building" },
      { href: "recibo-prestamo.html", label: "Formularios Museográficos", icon: "file" }
    ]
  },
  {
    pages: ["administracion.html", "recursos-humanos.html", "perfil-empleado.html", "notificaciones.html", "reportes.html", "finanzas.html", "direccion-ejecutiva.html"],
    links: [
      { href: "direccion-ejecutiva.html", label: "Dirección Ejecutiva", icon: "briefcase" },
      { href: "recursos-humanos.html", label: "Recursos Humanos", icon: "users" },
      { href: "notificaciones.html", label: "Notificaciones", icon: "bell" },
      { href: "reportes.html", label: "Reportes", icon: "chart" },
      { href: "finanzas.html", label: "Finanzas", icon: "dollar" }
    ]
  }
];

const officialMuseumAreas = [
  "Estacionamiento",
  "Baños externos",
  "Salón Multiuso",
  "Plazoleta y Entrada de Museo",
  "Lobby",
  "Mezzanine Raíces",
  "Cine Bienvenida",
  "Sala Clásica",
  "Pasillo Instrumentos",
  "Sala Bailable",
  "Baños del Museo",
  "Escalera a segundo piso",
  "Sala Romántica",
  "Pasillo Alternativo",
  "Sala Urbana",
  "Almacén",
  "Sala Experimental Guaynabo",
  "Área Itinerante con Foyer frente a los elevadores",
  "Ball Room",
  "Escaleras de salida"
];

const officialActivityClassifications = [
  "Actividades culturales o educativas",
  "Exhibiciones temporeras",
  "Presentaciones artísticas",
  "Actividades cívicas",
  "Conferencias y talleres",
  "Actividades institucionales",
  "Actividades Gubernamentales",
  "Concesiones comerciales compatibles con la naturaleza del Museo",
  "Colaboraciones con entidades públicas o privadas"
];

const activityClassificationThemes = {
  "Actividades culturales o educativas": "theme-green",
  "Exhibiciones temporeras": "theme-purple",
  "Presentaciones artísticas": "theme-gold",
  "Actividades cívicas": "theme-blue",
  "Conferencias y talleres": "theme-teal",
  "Actividades institucionales": "theme-red",
  "Actividades Gubernamentales": "theme-government",
  "Concesiones comerciales compatibles con la naturaleza del Museo": "theme-orange",
  "Colaboraciones con entidades públicas o privadas": "theme-slate"
};

const supabaseUrl = museoEnvironment.supabaseUrl;
const supabasePublishableKey = museoEnvironment.supabasePublishableKey;
const supabaseSessionKey = `museo-admin-supabase-session-${museoEnvironment.name}`;
const supabaseSystemRecordsTable = "app_records";
const supabaseRentalDocumentsBucket = "rental-documents";
const currentUserKey = "museo-admin-current-user";
const currentUserPhotoKey = "museo-admin-current-user-photo";
const currentAccessLevelKey = "museo-admin-access-level";
const currentAccessLevel = () => localStorage.getItem(currentAccessLevelKey) || "Empleado";
const SUPABASE_REFRESH_MARGIN_SECONDS = 60;
const SESSION_IDLE_MS = 5 * 60 * 1000;
let employeeRecords = [];
let currentPermissions = new Set();
let currentPermissionsLoaded = false;
const hasPermission = (permission) => currentPermissions.has(permission);
const canManageEmployees = () => hasPermission("employees.create") || hasPermission("employees.update.basic");
const hasAdministrativeWorkspaceAccess = () =>
  hasPermission("system.configure") || (hasPermission("audit.read") && hasPermission("notifications.manage"));
const canAccessAdministrationHub = () => hasAdministrativeWorkspaceAccess();
const postLoginDestination = () => {
  if (hasAdministrativeWorkspaceAccess()) return "dashboard.html";
  if (hasPermission("employees.read.all") && hasPermission("attendance.corrections.approve")) return "recursos-humanos.html";
  return "employee-portal.html";
};

const EXECUTIVE_MODULE_ACCESS = {
  "administracion.html": () => canAccessAdministrationHub(),
  "renta-espacios.html": () => hasPermission("rentals.manage"),
  "renta-espacio.html": () => hasPermission("rentals.manage"),
  // Compatibilidad: si aún no existe memberships.manage en el entorno, usar acceso ejecutivo.
  "membresias.html": () => hasPermission("memberships.manage") || hasAdministrativeWorkspaceAccess()
};

const SENSITIVE_MODULE_ACCESS = {
  "finanzas.html": () => hasPermission("finance.read"),
  "direccion-ejecutiva.html": () => hasPermission("executive.case.read"),
  // Compatibilidad: Reportes usa reports.read o, si no está desplegado, autoridad de administrador.
  "reportes.html": () => hasPermission("reports.read") || hasPermission("system.configure")
};

function localAwarePageUrl(page) {
  const isLocal = typeof isLocalMuseoHost === "function" && isLocalMuseoHost();
  return isLocal ? String(page || "").replace(/\.html$/, "") : page;
}

function loginUrlWithReturn(page, reason = "") {
  const params = new URLSearchParams();
  params.set("environment", museoEnvironment.name);
  if (page) params.set("next", page);
  if (reason) params.set("reason", reason);
  return `${localAwarePageUrl("login.html")}?${params.toString()}`;
}

function resolvePostLoginDestination() {
  const next = new URLSearchParams(window.location.search).get("next");
  if (next && !next.includes("..") && !next.includes("://")) {
    return next.endsWith(".html") ? next : `${next}.html`;
  }
  return postLoginDestination();
}

function showProtectedAccessDenied(message) {
  const main = document.querySelector(".page-content");
  if (!main) return;
  main.innerHTML = `
    <section class="card panel">
      <span class="module-icon theme-red" data-icon="shield"></span>
      <h3>Acceso denegado</h3>
      <p>${safeHtml(message || "No tiene autorización para abrir este módulo.")}</p>
      <a class="button secondary" href="dashboard.html">Volver al dashboard</a>
    </section>
  `;
  if (typeof renderInlineIcons === "function") renderInlineIcons();
}

async function recordSecurityAuditEvent(action, moduleId, result, details = {}) {
  if (!getSupabaseSession()?.access_token || typeof supabasePost !== "function") return null;
  try {
    return await supabasePost("/rest/v1/rpc/record_security_audit_event", {
      p_action: action,
      p_module: moduleId,
      p_result: result,
      p_details: details && typeof details === "object" ? details : {}
    });
  } catch {
    return null;
  }
}

function enforceAuthenticatedPageAccess() {
  const page = getCurrentPage();
  if (page === "login.html" || page === "dashboard.html" || page === "index.html") return false;

  const session = getSupabaseSession()?.access_token;
  const executiveChecker = EXECUTIVE_MODULE_ACCESS[page];
  const sensitiveChecker = SENSITIVE_MODULE_ACCESS[page];
  const protectedChecker = executiveChecker || sensitiveChecker;

  if (page === "employee-portal.html") {
    if (!session) {
      window.location.replace(loginUrlWithReturn(page));
      return true;
    }
    if (!currentPermissionsLoaded) return false;
    if (hasAdministrativeWorkspaceAccess()) {
      window.location.replace("dashboard.html");
      return true;
    }
    if (postLoginDestination() !== "employee-portal.html") {
      window.location.replace(postLoginDestination());
      return true;
    }
    return false;
  }

  if (protectedChecker) {
    if (!session) {
      window.location.replace(loginUrlWithReturn(page));
      return true;
    }
    if (!currentPermissionsLoaded) return false;
    if (!protectedChecker()) {
      const moduleId = page.replace(/\.html$/, "");
      void recordSecurityAuditEvent("MODULE_ACCESS_DENIED", moduleId, "denied", {
        reason: "missing_permission"
      });
      showProtectedAccessDenied("No tiene autorización para abrir este módulo.");
      return true;
    }
    return false;
  }

  if (!session || !currentPermissionsLoaded) return false;

  if (hasAdministrativeWorkspaceAccess()) return false;

  const allowedPages = new Map([
    ["recursos-humanos.html", () => hasPermission("employees.read.all")],
    ["calendario.html", () => hasPermission("calendar.manage") || hasPermission("schedules.read.team")],
    ["inventario.html", () => hasPermission("inventory.manage")]
  ]);
  if (allowedPages.get(page)?.()) return false;
  window.location.replace("employee-portal.html");
  return true;
}

async function refreshCurrentPermissions() {
  if (!getSupabaseSession()?.access_token) {
    currentPermissions.clear();
    currentPermissionsLoaded = false;
    return;
  }
  currentPermissions = new Set(await fetchCurrentSupabasePermissions());
  currentPermissionsLoaded = true;
}
function getSupabaseSession() {
  return JSON.parse(localStorage.getItem(supabaseSessionKey) || "null");
}

function saveSupabaseSession(session) {
  localStorage.setItem(supabaseSessionKey, JSON.stringify(session));
}

function clearSupabaseSession() {
  localStorage.removeItem(supabaseSessionKey);
}

function clearLoginState(redirect = true, reason = "") {
  clearAllSensitiveModuleUnlocks();
  clearPasswordSetupPending();
  clearSupabaseSession();
  currentPermissions.clear();
  currentPermissionsLoaded = false;
  localStorage.removeItem(currentUserKey);
  localStorage.removeItem(currentUserPhotoKey);
  localStorage.removeItem(currentAccessLevelKey);
  if (redirect && !isLoginPage()) {
    window.location.href = loginUrlWithReturn("", reason);
  }
}

function supabaseHeaders(requireAuth = false) {
  const session = getSupabaseSession();
  const headers = {
    apikey: supabasePublishableKey,
    "Content-Type": "application/json"
  };
  if (requireAuth) {
    if (!session?.access_token) throw new Error("Debe entrar a su cuenta antes de consultar Supabase.");
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}

async function refreshSupabaseSession() {
  const session = getSupabaseSession();
  if (!session?.refresh_token) return null;

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify({ refresh_token: session.refresh_token })
  });
  const data = await response.json();
  if (!response.ok) {
    clearSupabaseSession();
    throw new Error("La sesión de Supabase expiró. Entre nuevamente por Mi cuenta.");
  }
  saveSupabaseSession(data);
  return data;
}

async function supabaseAuthHeaders() {
  let session = getSupabaseSession();
  const expiresAt = Number(session?.expires_at || 0);
  const expiresSoon = expiresAt && Date.now() / 1000 > expiresAt - SUPABASE_REFRESH_MARGIN_SECONDS;

  if (!session?.access_token || expiresSoon) {
    session = await refreshSupabaseSession();
  }

  if (!session?.access_token) throw new Error("Debe entrar a su cuenta antes de consultar Supabase.");
  return {
    ...supabaseHeaders(),
    Authorization: `Bearer ${session.access_token}`
  };
}

async function signInWithSupabase(email, password) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.msg || "No se pudo entrar a Supabase.");
  saveSupabaseSession(data);
  return data;
}

const sensitiveUnlockMemory = new Map();

function sensitiveModuleStorageKey(moduleId) {
  return `museo-sensitive-unlock-${museoEnvironment.name}-${moduleId}`;
}

function writeSensitiveModuleUnlock(moduleId) {
  sensitiveUnlockMemory.set(moduleId, {
    unlockedAt: Date.now(),
    userId: getSupabaseSession()?.user?.id || null
  });
}

function clearSensitiveModuleUnlock(moduleId) {
  sensitiveUnlockMemory.delete(moduleId);
  try {
    sessionStorage.removeItem(sensitiveModuleStorageKey(moduleId));
  } catch {
    /* ignore storage failures */
  }
}

function clearAllSensitiveModuleUnlocks() {
  sensitiveUnlockMemory.clear();
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(`museo-sensitive-unlock-${museoEnvironment.name}-`))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
    /* ignore storage failures */
  }
}

function isSensitiveModuleUnlocked(moduleId) {
  const unlock = sensitiveUnlockMemory.get(moduleId);
  const session = getSupabaseSession();
  if (!unlock || !session?.access_token) return false;
  if (unlock.userId && session.user?.id && unlock.userId !== session.user.id) return false;
  return true;
}

function bindSensitiveModuleGate({
  moduleId,
  permission,
  gate,
  content,
  loginForm,
  loginMessage,
  loginFallbackLink,
  onUnlock
}) {
  if (!gate || !content) return { init() {} };

  let reinforcedOpen = false;

  const lockModule = ({ auditLoss = false } = {}) => {
    const wasOpen = reinforcedOpen || isSensitiveModuleUnlocked(moduleId);
    clearSensitiveModuleUnlock(moduleId);
    reinforcedOpen = false;
    gate.hidden = false;
    gate.style.display = "";
    content.hidden = true;
    content.style.display = "none";
    if (auditLoss && wasOpen) {
      void recordSecurityAuditEvent("SENSITIVE_AUTH_LOST", moduleId, "revoked", {
        reason: "tab_or_navigation"
      });
    }
  };

  const showGate = (message, { showForm = true, error = false } = {}) => {
    lockModule();
    if (loginForm) loginForm.hidden = !showForm;
    if (loginFallbackLink) loginFallbackLink.hidden = Boolean(showForm);
    if (loginMessage) {
      loginMessage.textContent = message || "";
      loginMessage.className = error ? "form-message error" : "form-message";
    }
  };

  const revealContent = async () => {
    gate.hidden = true;
    gate.style.display = "none";
    content.hidden = false;
    content.style.display = "";
    writeSensitiveModuleUnlock(moduleId);
    reinforcedOpen = true;
    if (onUnlock) await onUnlock();
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && reinforcedOpen) {
      showGate("", { showForm: true });
      void recordSecurityAuditEvent("SENSITIVE_AUTH_LOST", moduleId, "revoked", {
        reason: "visibilitychange"
      });
    }
  });

  window.addEventListener("pagehide", () => {
    if (reinforcedOpen) {
      clearSensitiveModuleUnlock(moduleId);
      reinforcedOpen = false;
    }
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const activeEmail = String(getSupabaseSession()?.user?.email || "").trim().toLowerCase();
    if (loginMessage) {
      loginMessage.textContent = "Verificando acceso...";
      loginMessage.className = "form-message";
    }
    try {
      if (activeEmail && email.toLowerCase() !== activeEmail) {
        throw new Error("Debe confirmar el correo de la sesión activa.");
      }
      await signInWithSupabase(email, password);
      await refreshCurrentPermissions();
      if (!hasPermission(permission)) {
        void recordSecurityAuditEvent("SENSITIVE_REAUTH_DENIED", moduleId, "denied", {
          reason: "missing_permission",
          permission
        });
        throw new Error("Su cuenta no tiene el permiso necesario para este módulo.");
      }
      void recordSecurityAuditEvent("SENSITIVE_REAUTH_SUCCESS", moduleId, "allowed", { permission });
      void recordSecurityAuditEvent("SENSITIVE_MODULE_ENTER", moduleId, "allowed", { permission });
      await revealContent();
    } catch (error) {
      const deniedByPermission = String(error.message || "").includes("permiso necesario");
      if (!deniedByPermission) {
        void recordSecurityAuditEvent("SENSITIVE_REAUTH_FAILED", moduleId, "denied", {
          reason: "invalid_credentials"
        });
      }
      showGate(error.message || "No se pudo verificar el acceso.", { showForm: true, error: true });
    }
  });

  const init = () => {
    clearSensitiveModuleUnlock(moduleId);
    lockModule();
    if (!getSupabaseSession()?.access_token) {
      showGate("Entre primero por Mi cuenta.", { showForm: false });
      if (loginFallbackLink) {
        loginFallbackLink.hidden = false;
        loginFallbackLink.href = loginUrlWithReturn(getCurrentPage());
      }
      return;
    }
    if (!hasPermission(permission)) {
      void recordSecurityAuditEvent("MODULE_ACCESS_DENIED", moduleId, "denied", {
        reason: "missing_permission",
        permission
      });
      showGate("Su cuenta no tiene el permiso necesario para abrir este módulo.", { showForm: false, error: true });
      if (loginFallbackLink) {
        loginFallbackLink.hidden = false;
        loginFallbackLink.href = loginUrlWithReturn(getCurrentPage());
      }
      return;
    }
    const emailField = loginForm?.querySelector('[name="email"]');
    const sessionEmail = getSupabaseSession()?.user?.email;
    if (emailField && sessionEmail) emailField.value = sessionEmail;
    showGate("", { showForm: true });
  };

  return { init, showGate };
}

async function fetchSupabaseProfile() {
  const session = getSupabaseSession();
  if (!session?.user?.id) return null;
const data = await supabaseGet(`/rest/v1/profiles?select=*&id=eq.${encodeURIComponent(session.user.id)}&limit=1`);
  return data[0] || null;
}

async function currentMuseumContext() {
  const profile = await fetchSupabaseProfile();
  if (!profile?.museum_id) throw new Error("No se encontró el museo asociado a esta cuenta.");
  return profile;
}

function explainSystemRecordsError(error, action = "usar") {
  const message = String(error?.message || error || "");
  const lower = message.toLowerCase();
  if (lower.includes("app_records") || lower.includes("schema cache") || lower.includes("relation")) {
    return "El sistema central todavía no está listo para guardar esta información. Avise a Administración.";
  }
  if (lower.includes("jwt") || lower.includes("token") || lower.includes("sesión") || lower.includes("session")) {
    return "Para enviar esta solicitud, primero entre por Mi cuenta y vuelva a intentar.";
  }
  if (lower.includes("permission") || lower.includes("policy") || lower.includes("row-level") || lower.includes("rls")) {
    return "Su cuenta no tiene permiso para guardar esta información. Avise a Administración.";
  }
  return `No se pudo ${action} la información. Avise a Administración si el problema continúa.`;
}

async function fetchSystemCollection(module, recordKey, fallback = []) {
  const session = getSupabaseSession();
  if (!session?.access_token) throw new Error("Para ver esta información, primero entre por Mi cuenta.");
  const profile = await currentMuseumContext();
  const response = await fetch(`${supabaseUrl}/rest/v1/${supabaseSystemRecordsTable}?select=payload&museum_id=eq.${encodeURIComponent(profile.museum_id)}&module=eq.${encodeURIComponent(module)}&record_key=eq.${encodeURIComponent(recordKey)}&limit=1`, {
    headers: await supabaseAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(explainSystemRecordsError(data, "cargar"));
  if (!data.length) return fallback;
  return data[0].payload || fallback;
}

async function saveSystemCollection(module, recordKey, payload) {
  const session = getSupabaseSession();
  if (!session?.access_token) throw new Error("Para enviar esta solicitud, primero entre por Mi cuenta y vuelva a intentar.");
  const profile = await currentMuseumContext();
  const body = {
    museum_id: profile.museum_id,
    module,
    record_key: recordKey,
    payload,
    created_by: profile.id,
    updated_by: profile.id,
    updated_at: new Date().toISOString()
  };
  const response = await fetch(`${supabaseUrl}/rest/v1/${supabaseSystemRecordsTable}?on_conflict=museum_id,module,record_key`, {
    method: "POST",
    headers: {
      ...(await supabaseAuthHeaders()),
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(explainSystemRecordsError(data, "guardar"));
  }
}

function safeStorageFileName(fileName = "documento") {
  return String(fileName)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "documento";
}

async function uploadRentalDocuments(requestId, fileInputs) {
  const profile = await currentMuseumContext();
  const files = fileInputs.flatMap((input) => (
    Array.from(input.files || []).map((file) => ({ field: input.name, file }))
  ));
  if (!files.length) return [];

  const allowedTypes = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "image/webp"
  ]);
  const maximumSize = 15 * 1024 * 1024;
  files.forEach(({ file }) => {
    if (!allowedTypes.has(file.type)) {
      throw new Error(`El archivo ${file.name} no tiene un formato permitido.`);
    }
    if (file.size > maximumSize) {
      throw new Error(`El archivo ${file.name} excede el máximo de 15 MB.`);
    }
  });

  const uploaded = [];
  try {
    for (const { field, file } of files) {
      const uniquePart = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const path = `${profile.museum_id}/${requestId}/${uniquePart}-${safeStorageFileName(file.name)}`;
      const response = await fetch(
        `${supabaseUrl}/storage/v1/object/${supabaseRentalDocumentsBucket}/${path.split("/").map(encodeURIComponent).join("/")}`,
        {
          method: "POST",
          headers: {
            ...(await supabaseAuthHeaders()),
            "Content-Type": file.type,
            "x-upsert": "false"
          },
          body: file
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `No se pudo guardar ${file.name} en el expediente digital.`);
      }
      uploaded.push({
        campo: field,
        nombre: file.name,
        tipo: file.type,
        tamano: file.size,
        bucket: supabaseRentalDocumentsBucket,
        ruta: path,
        cargadoEn: new Date().toISOString(),
        cargadoPorId: profile.id
      });
    }
    return uploaded;
  } catch (error) {
    if (uploaded.length) {
      await deleteRentalDocuments(uploaded.map((document) => document.ruta)).catch(() => {});
    }
    throw error;
  }
}

async function deleteRentalDocuments(paths = []) {
  if (!paths.length) return;
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${supabaseRentalDocumentsBucket}`, {
    method: "DELETE",
    headers: await supabaseAuthHeaders(),
    body: JSON.stringify({ prefixes: paths })
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "No se pudieron retirar los documentos incompletos.");
  }
}

async function createRentalDocumentDownloadUrl(path, expiresIn = 300) {
  if (!["Administrador", "Ejecutivo"].includes(currentAccessLevel())) {
    throw new Error("Solo Administradores y Ejecutivos pueden abrir documentos de renta.");
  }
  const encodedPath = String(path).split("/").map(encodeURIComponent).join("/");
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/sign/${supabaseRentalDocumentsBucket}/${encodedPath}`,
    {
      method: "POST",
      headers: await supabaseAuthHeaders(),
      body: JSON.stringify({ expiresIn })
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.signedURL) {
    throw new Error(data.message || "No se pudo crear el enlace privado del documento.");
  }
  return `${supabaseUrl}/storage/v1${data.signedURL}`;
}

function getEmployeeRecords() {
  return employeeRecords;
}

function saveEmployeeRecords(records) {
  employeeRecords = Array.isArray(records) ? records : [];
}

async function syncEmployeeCacheFromSupabase() {
  const session = getSupabaseSession();
  if (!session?.access_token) return false;
  const records = await fetchSupabaseEmployees();
  saveEmployeeRecords(records);
  return true;
}

function getEmployeeById(id) {
  return getEmployeeRecords().find((employee) => employee.id === id) || getEmployeeRecords()[0];
}

function buildEmployeeId(nombre, apellidos) {
  const base = `${nombre}-${apellidos}`.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const records = getEmployeeRecords();
  let id = base || `empleado-${Date.now()}`;
  let index = 2;
  while (records.some((employee) => employee.id === id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  return id;
}

function employeeInitials(employee) {
  const source = `${employee.nombre || ""} ${employee.apellidos || ""}`.trim() || employee.nombreCompleto || "Empleado";
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function employeeDisplayName(employee) {
  return employee.nombreCompleto || `${employee.nombre || ""} ${employee.apellidos || ""}`.trim();
}

function updateCurrentUserFromEmployeeCache() {
  const userName = localStorage.getItem(currentUserKey);
  const sessionUser = getSupabaseSession()?.user;
  const sessionEmail = sessionUser?.email || "";
  if (!userName && !sessionEmail) return;
  const normalizedName = String(userName || "").trim().toLowerCase();
  const normalizedEmail = String(sessionEmail || "").trim().toLowerCase();
  const employee = getEmployeeRecords().find((record) =>
    String(record.correo || "").trim().toLowerCase() === normalizedEmail ||
    employeeDisplayName(record).trim().toLowerCase() === normalizedName
  );
  const storedName = String(userName || "").trim();
  const metadataName = String(sessionUser?.user_metadata?.full_name || "").trim();
  const displayName = employee
    ? employeeDisplayName(employee)
    : metadataName || (!storedName.includes("@") ? storedName : "") || "Usuario institucional";
  localStorage.setItem(currentUserKey, displayName);
  if (employee?.foto) {
    localStorage.setItem(currentUserPhotoKey, employee.foto);
  } else {
    localStorage.removeItem(currentUserPhotoKey);
  }
}

const financeMonths = ["Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio"];
const defaultFinanceRows = [
  { id: "ing-aportacion", type: "income", category: "Ingresos", concept: "Aportación Municipal", values: [100000,0,0,0,0,0,0,0,0,0,0,0] },
  { id: "ing-adultos", type: "income", category: "Entradas al Museo", concept: "Entradas Adultos", values: [0,0,26000,26000,26000,26000,26000,26000,26000,26000,26000,26000] },
  { id: "ing-ninos", type: "income", category: "Entradas al Museo", concept: "Entradas Niños", values: [0,0,8666.67,8666.67,8666.67,8666.67,8666.67,8666.67,8666.67,8666.67,8666.67,8666.67] },
  { id: "ing-tabletas", type: "income", category: "Entradas al Museo", concept: "Alquiler de Tabletas", values: [0,0,433.33,433.33,433.33,433.33,433.33,433.33,433.33,433.33,433.33,433.33] },
  { id: "ing-auspicios", type: "income", category: "Ingresos", concept: "Auspicios", values: [0,0,30000,0,30000,30000,0,30000,30000,0,0,30000] },
  { id: "ing-membresias", type: "income", category: "Ingresos", concept: "Membresías", values: [0,0,250,250,250,250,250,250,250,250,250,250] },
  { id: "ing-salas", type: "income", category: "Ingresos", concept: "Alquiler de Salas", values: [0,0,0,1700,1700,1700,1700,1700,1700,1700,1700,1700] },
  { id: "ing-actividades", type: "income", category: "Ingresos", concept: "Actividades", values: [0,0,1000,1000,1000,1000,1000,1000,1000,1000,1000,1000] },
  { id: "ing-tienda", type: "income", category: "Ingresos", concept: "Tienda", values: [0,0,750,750,750,750,750,750,750,750,750,750] },
  { id: "ing-restaurante", type: "income", category: "Ingresos", concept: "Restaurante", values: [0,0,6000,6000,6000,6000,6000,6000,6000,6000,6000,6000] },
  { id: "ing-galas", type: "income", category: "Ingresos", concept: "Galas de Recaudación", values: [0,0,0,0,0,0,0,0,0,0,0,20000] },
  { id: "ing-donaciones", type: "income", category: "Ingresos", concept: "Donaciones", values: Array(12).fill(0) },
  { id: "ing-otros", type: "income", category: "Ingresos", concept: "Otros Ingresos", values: Array(12).fill(0) },
  { id: "exp-director", type: "expense", category: "Nómina", concept: "Director", values: Array(12).fill(4000) },
  { id: "exp-admin", type: "expense", category: "Nómina", concept: "Artegrafiko", values: Array(12).fill(3000) },
  { id: "exp-asistente-ejecutivo-1", type: "expense", category: "Nómina", concept: "Asistente Ejecutivo 1", values: Array(12).fill(0) },
  { id: "exp-asistente-ejecutivo-2", type: "expense", category: "Nómina", concept: "Asistente Ejecutivo 2", values: Array(12).fill(0) },
  { id: "exp-asistente-ejecutivo-3", type: "expense", category: "Nómina", concept: "Asistente Ejecutivo 3", values: Array(12).fill(0) },
  { id: "exp-produccion", type: "expense", category: "Nómina", concept: "Asistente de producción 1", values: Array(12).fill(2166.67) },
  { id: "exp-produccion-2", type: "expense", category: "Nómina", concept: "Asistente de producción 2", values: Array(12).fill(0) },
  { id: "exp-produccion-3", type: "expense", category: "Nómina", concept: "Asistente de producción 3", values: Array(12).fill(0) },
  { id: "exp-mantenimiento", type: "expense", category: "Nómina", concept: "Personal de Mantenimiento 1", values: [0,1200,1200,1200,1200,1200,1200,1200,1200,1200,1200,1200] },
  { id: "exp-mantenimiento-2", type: "expense", category: "Nómina", concept: "Personal de Mantenimiento 2", values: Array(12).fill(0) },
  { id: "exp-mantenimiento-3", type: "expense", category: "Nómina", concept: "Personal de Mantenimiento 3", values: Array(12).fill(0) },
  { id: "exp-ujieres", type: "expense", category: "Nómina", concept: "Ujier Ejecutivo", values: [0,10240,10240,10240,10240,10240,10240,10240,10240,10240,10240,10240] },
  { id: "exp-ujier-regular-1", type: "expense", category: "Nómina", concept: "Ujier Regular 1", values: Array(12).fill(0) },
  { id: "exp-ujier-regular-2", type: "expense", category: "Nómina", concept: "Ujier Regular 2", values: Array(12).fill(0) },
  { id: "exp-ujier-regular-3", type: "expense", category: "Nómina", concept: "Ujier Regular 3", values: Array(12).fill(0) },
  { id: "exp-ujier-regular-4", type: "expense", category: "Nómina", concept: "Ujier Regular 4", values: Array(12).fill(0) },
  { id: "exp-ujier-regular-5", type: "expense", category: "Nómina", concept: "Ujier Regular 5", values: Array(12).fill(0) },
  { id: "exp-ujier-regular-6", type: "expense", category: "Nómina", concept: "Ujier Regular 6", values: Array(12).fill(0) },
  { id: "exp-ujier-regular-7", type: "expense", category: "Nómina", concept: "Ujier Regular 7", values: Array(12).fill(0) },
  { id: "exp-ujier-regular-8", type: "expense", category: "Nómina", concept: "Ujier Regular 8", values: Array(12).fill(0) },
  { id: "exp-ujier-regular-9", type: "expense", category: "Nómina", concept: "Ujier Regular 9", values: Array(12).fill(0) },
  { id: "exp-ujier-regular-10", type: "expense", category: "Nómina", concept: "Ujier Regular 10", values: Array(12).fill(0) },
  { id: "exp-guias", type: "expense", category: "Nómina", concept: "Guías", values: [0,500,500,500,500,500,500,500,500,500,500,500] },
  { id: "exp-seguridad", type: "expense", category: "Nómina", concept: "Seguridad", values: [0,0,3520,3520,3520,3520,3520,3520,3520,3520,3520,3520] },
  { id: "exp-beneficios", type: "expense", category: "Beneficios", concept: "Seguro Social", values: Array(12).fill(1050) },
  { id: "exp-desempleo", type: "expense", category: "Beneficios", concept: "Desempleo", values: Array(12).fill(0) },
  { id: "exp-vacaciones", type: "expense", category: "Beneficios", concept: "Vacaciones", values: Array(12).fill(0) },
  { id: "exp-bono", type: "expense", category: "Beneficios", concept: "Bono de Navidad", values: Array(12).fill(0) },
  { id: "exp-electricidad", type: "expense", category: "Gastos Operacionales", concept: "Electricidad", values: Array(12).fill(10000) },
  { id: "exp-agua", type: "expense", category: "Gastos Operacionales", concept: "Agua", values: Array(12).fill(500) },
  { id: "exp-internet", type: "expense", category: "Gastos Operacionales", concept: "Internet / Telefonía", values: Array(12).fill(250) },
  { id: "exp-uniformes", type: "expense", category: "Gastos Operacionales", concept: "Uniformes", values: [0,2100,0,0,0,0,0,2100,0,0,0,0] },
  { id: "exp-gastos-produccion", type: "expense", category: "Gastos Operacionales", concept: "Gastos de Producción", values: Array(12).fill(0) },
  { id: "exp-materiales", type: "expense", category: "Gastos Operacionales", concept: "Materiales de producción", values: [0,1000,200,200,200,200,200,200,200,200,200,200] },
  { id: "exp-limpieza", type: "expense", category: "Gastos Operacionales", concept: "Materiales de limpieza", values: [0,1650,1650,1650,1650,1650,1650,1650,1650,1650,1650,1650] },
  { id: "exp-oficina", type: "expense", category: "Gastos Operacionales", concept: "Materiales de oficina", values: [0,1000,200,200,200,200,200,200,200,200,200,200] },
  { id: "exp-publicidad", type: "expense", category: "Gastos Operacionales", concept: "Publicidad", values: Array(12).fill(5000) },
  { id: "exp-reparaciones", type: "expense", category: "Gastos Operacionales", concept: "Reparaciones", values: [0,0,0,0,0,2000,0,0,0,0,0,2000] },
  { id: "exp-seguros", type: "expense", category: "Gastos Operacionales", concept: "Seguros", values: Array(12).fill(1400) },
  { id: "exp-miscelaneos", type: "expense", category: "Otros Gastos", concept: "Misceláneos", values: [0,1500,1500,1500,1500,1500,1500,1500,1500,1500,1500,1500] },
  { id: "exp-reserva", type: "expense", category: "Otros Gastos", concept: "Gastos de representación", values: [0,3000,3000,3000,3000,3000,3000,3000,3000,3000,3000,3000] }
];

const excludedFinanceConcepts = new Set(["Contingencia", "Ahorros"]);

const rentalGeneralRules = [
  "Toda solicitud requiere la aprobación previa del Municipio Autónomo de Guaynabo y se formalizará mediante el documento correspondiente.",
  "La actividad deberá ser compatible con los fines culturales, educativos e institucionales del Museo. No se permiten actividades político-partidistas.",
  "El solicitante deberá presentar identificación con fotografía o, para una entidad jurídica, la resolución corporativa correspondiente.",
  "Se requiere una póliza de responsabilidad pública vigente, con relevo de responsabilidad a favor del Municipio y el Municipio como asegurado adicional, salvo que se autorice una cubierta mediante un programa del MAG.",
  "El pago deberá realizarse antes de la actividad en la Oficina de Recaudaciones del MAG y la evidencia del pago deberá presentarse antes del uso del espacio.",
  "El montaje, la decoración, la escenografía y la instalación o remoción de equipos deberán informarse en la solicitud y coordinarse previamente con la Administración.",
  "No se permite alterar, perforar o afectar paredes, pisos, techos, pintura, superficies ni elementos permanentes del Museo.",
  "El área deberá entregarse en condiciones adecuadas de orden y limpieza. El usuario responderá por los daños ocasionados a las facilidades, equipos o propiedad del Museo.",
  "El solicitante será responsable por la conducta, la seguridad y el cumplimiento de las normas por parte de invitados, empleados, suplidores y contratistas.",
  "El MAG podrá revocar, suspender o modificar una autorización para proteger el interés público, la seguridad, las facilidades o la operación del Museo."
];

const defaultRentalSpaces = [
  {
    id: "ballroom",
    slug: "salon-lito-pena",
    name: "Salón Lito Peña",
    regulatoryName: "Ballroom",
    description: "Espacio exclusivo, elegante y versátil para conferencias, galas, eventos corporativos, actividades culturales y eventos de formato mediano. La renta incluye el foyer frente a los elevadores, ideal para recepción, registro, cóctel, mesas altas o barra de bienvenida.",
    canon: 1000,
    deposit: 500,
    billing: "por evento",
    area: "2,596 pies²",
    capacity: 100,
    capacityLabel: "100 personas en conferencia / 80 con mesas",
    schedule: "6:00 p.m. - 12:00 a.m.",
    setup: "Según horario coordinado con la Administración",
    breakdown: "12:00 a.m. - 1:00 a.m.",
    status: "Disponible",
    equipment: ["Sonido básico", "Iluminación básica", "Aire acondicionado", "Foyer o área de cóctel"],
    idealFor: ["Galas y bodas", "Conferencias", "Eventos corporativos", "Actividades culturales"],
    requirements: ["Proveedores y detalles del montaje con un mínimo de dos semanas de anticipación", "Aprobación previa para catering, DJ, sonido adicional, tarima y equipo audiovisual", "Decoración previamente ensamblada", "No se permite confeti, humo ni chispas frías"],
    images: [
      "assets/rentals/salon-lito-pena-03.webp",
      "assets/rentals/salon-lito-pena-01.webp",
      "assets/rentals/salon-lito-pena-02.webp",
      "assets/rentals/salon-lito-pena-foyer-01.webp",
      "assets/rentals/salon-lito-pena-foyer-02.webp",
      "assets/rentals/salon-lito-pena-foyer-03.webp"
    ]
  },
  {
    id: "mezzanine",
    slug: "mezzanine-raices",
    name: "Mezzanine Raíces",
    regulatoryName: "Mezzanine",
    description: "Espacio interior amplio y contemporáneo en el primer nivel, integrado a la experiencia cultural del Museo. Su distribución abierta permite conferencias, presentaciones artísticas, exhibiciones temporeras, recepciones y lanzamientos de productos.",
    canon: 1000,
    deposit: 500,
    billing: "por evento",
    area: "3,131 pies²",
    capacity: 150,
    capacityLabel: "Sujeta al plano de montaje aprobado",
    schedule: "Según disponibilidad y autorización del Museo",
    setup: "Coordinado previamente con la Administración",
    breakdown: "Coordinado previamente con la Administración",
    status: "Disponible",
    equipment: ["Área abierta", "Aire acondicionado", "Podio disponible sujeto a coordinación"],
    idealFor: ["Conferencias", "Presentaciones culturales", "Exhibiciones temporeras", "Lanzamientos de productos"],
    requirements: ["El montaje debe proteger las vitrinas, obras y elementos museográficos", "Los pasillos, salidas y accesos deberán permanecer despejados"],
    images: [
      "assets/rentals/mezzanine-raices-01.webp",
      "assets/rentals/mezzanine-raices-02.webp",
      "assets/rentals/mezzanine-raices-03.webp"
    ]
  },
  {
    id: "cine-bienvenida",
    slug: "cine-180",
    name: "Cine 180°",
    regulatoryName: "Espacio audiovisual del Museo",
    description: "Sala audiovisual inmersiva con pantalla panorámica curva para documentales, conferencias, talleres, lanzamientos, presentaciones educativas y experiencias multimedia.",
    canon: 600,
    deposit: 300,
    billing: "por evento",
    area: "Configuración fija",
    capacity: 24,
    capacityLabel: "24 butacas",
    schedule: "Según disponibilidad y autorización del Museo",
    setup: "1 hora, coordinada previamente",
    breakdown: "1 hora",
    status: "Disponible",
    equipment: ["Pantalla panorámica de hasta 180°", "Sistema profesional de proyección", "Sistema profesional de sonido", "Aire acondicionado", "Butacas fijas"],
    idealFor: ["Presentaciones culturales", "Presentaciones de productos", "Conferencias", "Proyecciones educativas"],
    requirements: ["Todo contenido audiovisual deberá entregarse con anticipación para prueba técnica", "La operación de los sistemas estará a cargo de personal autorizado"],
    images: [
      "assets/rentals/cine-180-presentacion-producto.webp",
      "assets/rentals/cine-180-presentacion-cultural.webp",
      "assets/rentals/cine-180-conferenciante.webp"
    ]
  },
  {
    id: "lobby",
    slug: "el-lobby",
    name: "El Lobby",
    regulatoryName: "Vestíbulo (Lobby)",
    description: "Vestíbulo principal del Museo, diseñado para recepciones, registros, cócteles y actividades de bienvenida compatibles con la misión institucional.",
    canon: 600,
    deposit: 300,
    billing: "por evento",
    area: "1,300 pies²",
    capacity: 100,
    capacityLabel: "Sujeta al plano de montaje aprobado",
    schedule: "Según disponibilidad y autorización del Museo",
    setup: "Coordinado previamente con la Administración",
    breakdown: "1 hora",
    status: "Disponible",
    equipment: ["Área abierta", "Aire acondicionado", "Mostradores de recepción"],
    idealFor: ["Recepciones", "Registro de invitados", "Cócteles", "Actividades institucionales"],
    requirements: ["Deberán mantenerse despejadas las entradas, salidas, escaleras y rutas de circulación", "La actividad no podrá interferir con la operación regular sin autorización"],
    images: [
      "assets/rentals/el-lobby-coctel-nocturno.webp",
      "assets/rentals/el-lobby-recepcion-formal.webp",
      "assets/rentals/el-lobby-registro-bienvenida.webp"
    ]
  },
  {
    id: "plazoleta",
    slug: "terraza-de-la-musica",
    name: "La Terraza de la Música",
    regulatoryName: "Plazoleta",
    description: "Espacio exterior contiguo al anfiteatro, ideal para cafés culturales, música en vivo, encuentros sociales y actividades comunitarias.",
    canon: 600,
    deposit: 300,
    billing: "por evento",
    area: "1,158 pies²",
    capacity: 200,
    capacityLabel: "Sujeta al plano de montaje aprobado",
    schedule: "Según disponibilidad y autorización del Museo",
    setup: "Coordinado previamente con la Administración",
    breakdown: "Coordinado previamente con la Administración",
    status: "Disponible",
    equipment: ["Área exterior parcialmente cubierta"],
    idealFor: ["Café cultural", "Música en vivo", "Recepciones", "Actividades comunitarias"],
    requirements: ["El plan deberá considerar condiciones del tiempo y seguridad de equipos", "Tarimas, sonido, iluminación y mobiliario requieren aprobación previa"],
    images: [
      "assets/rentals/la-terraza-cafe-vista-frontal.webp",
      "assets/rentals/la-terraza-cafe-vista-amplia.webp",
      "assets/rentals/la-terraza-cafe-vista-inversa.webp"
    ]
  },
  {
    id: "salon-adiestramiento",
    slug: "salon-multiuso",
    name: "Salón Multiuso",
    regulatoryName: "Salón de Adiestramiento (Usos Múltiples)",
    description: "Salón flexible para actividades educativas, ensayos, talleres, clases, reuniones, conferencias y presentaciones compatibles con los fines del Museo.",
    canon: 300,
    deposit: 50,
    billing: "evento completo · $40 por hora",
    hourlyRate: 40,
    minimumHours: 2,
    fullEventHours: 8,
    area: "Configuración flexible",
    capacity: 60,
    capacityLabel: "60 personas, sujeto al plano de montaje aprobado",
    schedule: "8:00 a. m. - 10:00 p. m.",
    setup: "1 hora, coordinada previamente",
    breakdown: "1 hora",
    status: "Disponible",
    equipment: ["No incluye equipos"],
    idealFor: ["Talleres y clases", "Ensayos", "Reuniones", "Presentaciones de productos"],
    requirements: [
      "Evento completo: $300 por un máximo de 8 horas",
      "La fianza para bloquear la fecha del evento completo es de $50",
      "Alquiler por hora: $40, con reservación mínima de 2 horas y costo mínimo de $80",
      "En el alquiler por horas no aplica fianza",
      "La distribución deberá conservar rutas de salida y circulación",
      "Equipos especiales, mobiliario y sonido requieren coordinación y aprobación previa"
    ],
    images: [
      "assets/rentals/salon-multiuso-ensayo-orquesta.webp",
      "assets/rentals/salon-multiuso-presentacion-productos.webp",
      "assets/rentals/salon-multiuso-clase-de-baile.webp"
    ]
  },
  {
    id: "anfiteatro",
    slug: "anfiteatro-andy-montanez",
    name: "Anfiteatro Andy Montañez",
    regulatoryName: "Anfiteatro",
    description: "Anfiteatro techado al aire libre para conciertos, presentaciones artísticas, actividades culturales, charlas y eventos institucionales. Incluye un camerino privado para el artista con baño y un camerino comunal para músicos y bailarines.",
    canon: 1000,
    deposit: 500,
    billing: "por evento",
    area: "Anfiteatro techado al aire libre",
    capacity: 120,
    capacityLabel: "120 personas aproximadamente",
    schedule: "Según disponibilidad y autorización del Museo",
    setup: "Coordinado previamente con la Administración",
    breakdown: "Coordinado previamente con la Administración",
    status: "Disponible",
    equipment: ["Tarima fija", "Camerino privado con baño", "Camerino comunal para músicos y bailarines", "Infraestructura para producción sujeta a evaluación técnica"],
    idealFor: ["Conciertos", "Presentaciones artísticas", "Charlas", "Actividades institucionales"],
    requirements: ["Luces, sonido, instrumentos y producción técnica requieren coordinación y aprobación previa", "La capacidad y los accesos de seguridad no podrán alterarse"],
    images: [
      "assets/rentals/anfiteatro-concierto-vista-general.webp",
      "assets/rentals/anfiteatro-concierto-desde-tarima.webp",
      "assets/rentals/anfiteatro-camerino-privado.webp",
      "assets/rentals/anfiteatro-camerino-privado-bano.webp",
      "assets/rentals/anfiteatro-camerino-comunal.webp"
    ]
  },
  {
    id: "estacionamiento",
    slug: "estacionamiento",
    name: "Estacionamiento",
    regulatoryName: "Estacionamiento",
    description: "Área exterior de gran escala disponible para eventos masivos, festivales, ferias y actividades autorizadas compatibles con las operaciones y fines del Museo.",
    canon: 2500,
    deposit: 500,
    billing: "por evento",
    area: "Área exterior del Museo",
    capacity: 0,
    capacityLabel: "Según plan operacional, de seguridad y emergencias aprobado",
    schedule: "Según disponibilidad y autorización del Museo",
    setup: "Según plan de producción aprobado",
    breakdown: "Según plan de producción aprobado",
    status: "Disponible",
    equipment: ["Área exterior; producción, tarima, sonido, iluminación y kioscos no incluidos"],
    idealFor: ["Eventos masivos", "Festivales", "Ferias", "Conciertos exteriores"],
    requirements: ["Requiere plan operacional, técnico, de seguridad, emergencias, tránsito, accesos y manejo de desperdicios", "Tarimas, kioscos, generadores, sonido e iluminación requieren aprobación previa"],
    images: [
      "assets/rentals/estacionamiento-evento-vista-aerea-general.webp",
      "assets/rentals/estacionamiento-evento-vista-aerea-cercana.webp",
      "assets/rentals/estacionamiento-evento-vista-baja.webp"
    ]
  }
];

function iconSvg(name) {
  return `<svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.file}</svg>`;
}

function getCurrentPage() {
  const segment = window.location.pathname.split("/").pop() || "index.html";
  return segment.includes(".") ? segment : `${segment}.html`;
}

function isLoginPage() {
  return getCurrentPage() === "login.html";
}

const passwordSetupPendingKey = `museo-password-setup-pending-${museoEnvironment.name}`;

function getAuthCallbackParams() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  const read = (key) => hash.get(key) || query.get(key);
  return {
    access_token: read("access_token"),
    refresh_token: read("refresh_token"),
    type: read("type"),
    token_hash: read("token_hash"),
    code: read("code"),
    error_description: read("error_description"),
    expires_in: read("expires_in"),
    token_type: read("token_type")
  };
}

function isPasswordSetupCallback(params = getAuthCallbackParams()) {
  if (params.error_description) return true;
  if (!["invite", "recovery"].includes(params.type || "")) return false;
  return Boolean(params.access_token || params.token_hash || params.code);
}

function markPasswordSetupPending() {
  sessionStorage.setItem(passwordSetupPendingKey, "1");
}

function clearPasswordSetupPending() {
  sessionStorage.removeItem(passwordSetupPendingKey);
}

function isPasswordSetupPending() {
  return sessionStorage.getItem(passwordSetupPendingKey) === "1";
}

function resolvePageMeta() {
  const currentPage = getCurrentPage();
  const meta = appPages[currentPage] || appPages["dashboard.html"];
  if (currentPage === "dashboard.html" || currentPage === "index.html") {
    const storedUser = localStorage.getItem(currentUserKey) || "";
    const loggedUser = storedUser && !storedUser.includes("@")
      ? storedUser
      : getSupabaseSession()?.access_token
        ? "Usuario institucional"
        : "";
    return {
      ...meta,
      subtitle: loggedUser ? `Bienvenido, ${loggedUser}` : "Panel principal del sistema."
    };
  }
  return meta;
}

function resolveShortcutGroup(page = getCurrentPage()) {
  return moduleShortcutGroups.find((group) => group.pages.includes(page));
}

function renderPageShortcuts() {
  const currentPage = getCurrentPage();
  const basePages = ["index.html", "dashboard.html", "login.html"];
  const group = resolveShortcutGroup(currentPage);
  const utilityLinks = basePages.includes(currentPage)
    ? []
    : [
        { type: "back", label: "Atrás", icon: "arrowLeft" },
        { href: "dashboard.html", label: "Home", icon: "dashboard" }
      ];
  const groupLinks = group?.links || [];
  const links = [...utilityLinks, ...groupLinks];

  if (!links.length) return "";

  return `
    <nav class="page-shortcuts" aria-label="Accesos rápidos de la página">
      ${links.map((link) => {
        const href = link.instituvaPath && typeof instituvaAppUrl === "function"
          ? instituvaAppUrl(link.instituvaPath)
          : link.href;
        const isActive = href === currentPage || link.href === currentPage;
        const attributes = link.type === "back"
          ? 'href="#" data-history-back'
          : `href="${href}"`;
        return `
          <a class="page-shortcut${isActive ? " is-active" : ""}" ${attributes} aria-current="${isActive ? "page" : "false"}">
            ${iconSvg(link.icon)}
            <span>${safeHtml(link.label)}</span>
          </a>
        `;
      }).join("")}
    </nav>
  `;
}

function renderSidebar() {
  const sidebar = document.querySelector("[data-sidebar]");
  if (!sidebar) return;

  const currentPage = getCurrentPage();
  const groupsMarkup = navigationGroups.map((group) => {
    const links = group.items.map((item) => {
      const isActive = item.href === currentPage || (item.activePages || []).includes(currentPage) || (currentPage === "index.html" && item.href === "dashboard.html");
      const href = item.href === "login.html" ? loginUrlWithReturn("") : item.href;
      return `
        <li>
          <a class="nav-link${isActive ? " is-active" : ""}" href="${href}" aria-current="${isActive ? "page" : "false"}">
            <span class="nav-icon">${iconSvg(item.icon)}</span>
            <span>${item.label}</span>
          </a>
        </li>
      `;
    }).join("");

    return `
      <nav class="sidebar-section" aria-label="${group.label}">
        <p class="sidebar-section-title">${group.label}</p>
        <ul class="nav-list">${links}</ul>
      </nav>
    `;
  }).join("");

  sidebar.innerHTML = `
    <a class="brand" href="dashboard.html" aria-label="Museo de la Música de Puerto Rico">
      <img class="brand-logo" src="images/logo-horizontal.jpg" alt="Museo de la Música de Puerto Rico">
      <span class="brand-mark">${iconSvg("file")}</span>
      <span class="brand-copy">
        <span class="brand-title">Museo de la Música</span>
        <span class="brand-subtitle">Puerto Rico - Guaynabo</span>
      </span>
    </a>
    ${groupsMarkup}
  `;

  const logo = sidebar.querySelector(".brand-logo");
  const brand = sidebar.querySelector(".brand");
  if (logo && brand) {
    if (logo.complete && logo.naturalWidth > 0) brand.classList.add("has-logo");
    logo.addEventListener("load", () => brand.classList.add("has-logo"));
    logo.addEventListener("error", () => brand.classList.remove("has-logo"));
  }
}

function renderHeader() {
  const header = document.querySelector("[data-header]");
  if (!header) return;

  const meta = resolvePageMeta();
  const loggedUser = localStorage.getItem(currentUserKey);
  const loggedUserPhoto = localStorage.getItem(currentUserPhotoKey);
  const accountLabel = loggedUser && !loggedUser.includes("@") ? loggedUser : "Usuario institucional";
  const accountInitials = accountLabel
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "UI";
  const accountVisual = loggedUserPhoto
    ? `<img class="account-photo" src="${loggedUserPhoto}" alt="Foto de ${safeHtml(accountLabel)}">`
    : `<span class="account-initials" aria-hidden="true">${safeHtml(accountInitials)}</span>`;
  const environmentBadge = museoEnvironment.name === "staging"
    ? `<span class="environment-badge" aria-label="Entorno de pruebas">STAGING</span>`
    : "";
  const accountControl = loggedUser
    ? `
      <div class="account-menu-wrap">
        <button class="account-button is-logged-in" type="button" data-account-menu-button aria-expanded="false">
          ${accountVisual}
          <span>${safeHtml(accountLabel)}</span>
          ${iconSvg("chevron")}
        </button>
        <div class="account-menu" data-account-menu hidden>
          <a href="perfil-empleado.html">Mi perfil</a>
          <button type="button" data-logout-button>Cerrar sesión</button>
        </div>
      </div>
    `
    : `
      <a class="account-button" href="${loginUrlWithReturn("")}">
        ${iconSvg("users")}
        <span>${safeHtml(accountLabel)}</span>
        ${iconSvg("chevron")}
      </a>
    `;
  header.innerHTML = `
    <div class="header-left">
      <button class="menu-toggle" type="button" aria-label="Abrir navegacion" data-menu-toggle>
        <span class="menu-lines"></span>
      </button>
      <div class="header-title">
        <h1>${meta.title}</h1>
        <p>${meta.subtitle}</p>
        ${renderPageShortcuts()}
      </div>
    </div>
    <div class="header-right">
      ${environmentBadge}
      <button class="notification-button" type="button" aria-label="Notificaciones" data-notification-menu-button aria-expanded="false">
        ${iconSvg("bell")}
        <span class="notification-badge">3</span>
      </button>
      <div class="notification-menu" data-notification-menu hidden>
        <p class="page-kicker">Notificaciones</p>
        <h3>Alertas del Sistema</h3>
        <a href="notificaciones.html">
          <strong>Temperatura y humedad</strong>
          <span>Revise las alertas ambientales de exhibiciones.</span>
        </a>
        <a href="calendario.html">
          <strong>Calendario de eventos</strong>
          <span>Hay actividades administrativas pendientes de revisión.</span>
        </a>
        <a href="recursos-humanos.html">
          <strong>Recursos Humanos</strong>
          <span>Verifique asistencia, perfiles y accesos del personal.</span>
        </a>
      </div>
      ${accountControl}
    </div>
  `;
}

function bindHeaderActions() {
  document.querySelector("[data-history-back]")?.addEventListener("click", (event) => {
    event.preventDefault();
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = "dashboard.html";
  });

  const accountButton = document.querySelector("[data-account-menu-button]");
  const accountMenu = document.querySelector("[data-account-menu]");
  if (accountButton && accountMenu) {
    accountButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const nextState = !accountMenu.hidden;
      accountMenu.hidden = nextState;
      accountButton.setAttribute("aria-expanded", String(!nextState));
    });

    document.addEventListener("click", (event) => {
      if (accountMenu.hidden) return;
      if (accountMenu.contains(event.target) || accountButton.contains(event.target)) return;
      accountMenu.hidden = true;
      accountButton.setAttribute("aria-expanded", "false");
    });
  }

  document.querySelector("[data-logout-button]")?.addEventListener("click", () => {
    clearLoginState(true, "logout");
  });
}

function renderFooter() {
  const footer = document.querySelector("[data-footer]");
  if (!footer) return;

  footer.innerHTML = `
    <span>© 2025 Museo de la Música de Puerto Rico. Todos los derechos reservados.</span>
    <span>Sistema Administrativo v4.0</span>
  `;
}

function bindSidebarToggle() {
  const toggle = document.querySelector("[data-menu-toggle]");
  const backdrop = document.querySelector("[data-sidebar-backdrop]");

  if (toggle) {
    toggle.addEventListener("click", () => {
      document.body.classList.toggle("sidebar-open");
    });
  }

  if (backdrop) {
    backdrop.addEventListener("click", () => {
      document.body.classList.remove("sidebar-open");
    });
  }

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.body.classList.remove("sidebar-open");
    });
  });
}

function bindNotificationMenu() {
  const button = document.querySelector("[data-notification-menu-button]");
  const menu = document.querySelector("[data-notification-menu]");
  if (!button || !menu) return;

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const nextState = !menu.hidden;
    menu.hidden = nextState;
    button.setAttribute("aria-expanded", String(!nextState));
  });

  document.addEventListener("click", (event) => {
    if (menu.hidden) return;
    if (menu.contains(event.target) || button.contains(event.target)) return;
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  });
}

function bindLoginDemo() {
  const form = document.querySelector("[data-login-form]");
  if (!form) return;

  const loginCard = document.querySelector("[data-login-card]");
  const message = document.querySelector("[data-login-message]");
  const inviteCard = document.querySelector("[data-invite-acceptance]");
  const inviteForm = document.querySelector("[data-invite-password-form]");
  const inviteMessage = document.querySelector("[data-invite-password-message]");
  const recoveryCard = document.querySelector("[data-recovery-card]");
  const recoveryForm = document.querySelector("[data-recovery-form]");
  const recoveryMessage = document.querySelector("[data-recovery-message]");
  const reason = new URLSearchParams(window.location.search).get("reason");
  const callback = getAuthCallbackParams();

  const showPasswordSetup = () => {
    if (loginCard) loginCard.hidden = true;
    if (recoveryCard) recoveryCard.hidden = true;
    if (inviteCard) inviteCard.hidden = false;
    markPasswordSetupPending();
  };

  const cleanCallbackUrl = () => {
    const clean = new URL(window.location.href);
    ["access_token", "refresh_token", "token_hash", "code", "type", "expires_in", "token_type", "error_description", "error", "error_code"].forEach((key) => {
      clean.searchParams.delete(key);
    });
    window.history.replaceState(null, "", `${clean.pathname}${clean.search}`);
  };

  const applyRecoverySession = (sessionLike) => {
    const accessToken = sessionLike?.access_token || sessionLike?.accessToken;
    if (!accessToken) throw new Error("El enlace de recuperación no devolvió una sesión válida.");
    const expiresIn = Number(sessionLike.expires_in || callback.expires_in || 3600);
    saveSupabaseSession({
      access_token: accessToken,
      refresh_token: sessionLike.refresh_token || callback.refresh_token || "",
      expires_in: expiresIn,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      token_type: sessionLike.token_type || callback.token_type || "bearer",
      user: sessionLike.user || null
    });
    showPasswordSetup();
    cleanCallbackUrl();
  };

  if (callback.error_description) {
    if (message) {
      message.textContent = callback.error_description;
      message.className = "login-help error";
    }
    clearPasswordSetupPending();
    cleanCallbackUrl();
  } else if (["invite", "recovery"].includes(callback.type || "") && callback.access_token && inviteCard && inviteForm) {
    try {
      applyRecoverySession({
        access_token: callback.access_token,
        refresh_token: callback.refresh_token,
        expires_in: callback.expires_in,
        token_type: callback.token_type
      });
    } catch (error) {
      if (message) {
        message.textContent = error.message || "No se pudo abrir el enlace de recuperación.";
        message.className = "login-help error";
      }
    }
  } else if (["invite", "recovery"].includes(callback.type || "") && callback.token_hash && inviteCard && inviteForm) {
    if (inviteMessage) {
      inviteMessage.textContent = "Validando enlace seguro...";
      inviteMessage.className = "login-help";
    }
    showPasswordSetup();
    verifySupabaseEmailToken({ token_hash: callback.token_hash, type: callback.type })
      .then((data) => {
        applyRecoverySession(data);
        if (inviteMessage) {
          inviteMessage.textContent = "Enlace validado. Establezca su nueva contraseña.";
          inviteMessage.className = "login-help success";
        }
      })
      .catch((error) => {
        clearPasswordSetupPending();
        if (loginCard) loginCard.hidden = false;
        if (inviteCard) inviteCard.hidden = true;
        if (message) {
          message.textContent = error.message || "El enlace de recuperación no es válido o expiró.";
          message.className = "login-help error";
        }
        cleanCallbackUrl();
      });
  } else if (isPasswordSetupPending() && getSupabaseSession()?.access_token && inviteCard) {
    showPasswordSetup();
  } else if (isPasswordSetupPending() && !getSupabaseSession()?.access_token) {
    // Enlace consumido/expirado o sesión temporal perdida: no dejar al usuario atrapado.
    clearPasswordSetupPending();
    if (inviteCard) inviteCard.hidden = true;
    if (loginCard) loginCard.hidden = false;
    if (message) {
      message.textContent = "El enlace de recuperación expiró o ya no es válido. Solicite uno nuevo o entre con su contraseña.";
      message.className = "login-help error";
    }
  }

  if (message && reason === "idle") {
    message.textContent = "La sesión se cerró automáticamente por inactividad.";
    message.className = "login-help";
  }
  if (message && reason === "logout") {
    message.textContent = "Sesión cerrada correctamente.";
    message.className = "login-help";
  }

  const returnToLoginAccess = () => {
    clearPasswordSetupPending();
    clearSupabaseSession();
    currentPermissions.clear();
    currentPermissionsLoaded = false;
    if (inviteCard) inviteCard.hidden = true;
    if (recoveryCard) recoveryCard.hidden = true;
    if (loginCard) loginCard.hidden = false;
    if (inviteForm) inviteForm.reset();
    if (inviteMessage) {
      inviteMessage.textContent = "El enlace seguro será validado antes de guardar la contraseña.";
      inviteMessage.className = "login-help";
    }
    if (message) {
      message.textContent = "Acceso preparado para usuarios del Museo.";
      message.className = "login-help";
    }
  };

  document.querySelector("[data-recovery-toggle]")?.addEventListener("click", () => {
    recoveryForm.elements.email.value = form.elements.username.value || "";
    loginCard.hidden = true;
    recoveryCard.hidden = false;
  });
  document.querySelector("[data-recovery-cancel]")?.addEventListener("click", () => {
    recoveryCard.hidden = true;
    loginCard.hidden = false;
  });
  document.querySelector("[data-password-setup-cancel]")?.addEventListener("click", () => {
    returnToLoginAccess();
  });
  recoveryForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = recoveryForm.querySelector('button[type="submit"]');
    button.disabled = true;
    recoveryMessage.textContent = "Solicitando enlace seguro...";
    recoveryMessage.className = "login-help";
    try {
      await requestSupabasePasswordRecovery(String(new FormData(recoveryForm).get("email") || "").trim());
      recoveryMessage.textContent = "Si el correo está registrado, recibirá un enlace para crear una nueva contraseña.";
      recoveryMessage.className = "login-help success";
    } catch (error) {
      const raw = String(error.message || "");
      const rateLimited = /rate limit|over_email_send_rate_limit/i.test(raw);
      recoveryMessage.textContent = rateLimited
        ? "Se enviaron demasiados correos en poco tiempo. Espere unos minutos o use el último enlace recibido. También puede volver al acceso e entrar con su contraseña actual."
        : (raw || "No se pudo solicitar el enlace.");
      recoveryMessage.className = "login-help error";
    } finally { button.disabled = false; }
  });

  inviteForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(inviteForm);
    const password = String(formData.get("password") || "");
    const confirmation = String(formData.get("passwordConfirmation") || "");
    const strongPassword = password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password);

    if (!strongPassword) {
      if (inviteMessage) {
        inviteMessage.textContent = "La contraseña debe tener 12 caracteres o más, con mayúscula, minúscula, número y símbolo.";
        inviteMessage.className = "login-help error";
      }
      return;
    }
    if (password !== confirmation) {
      if (inviteMessage) {
        inviteMessage.textContent = "Las contraseñas no coinciden.";
        inviteMessage.className = "login-help error";
      }
      return;
    }

    const submitButton = inviteForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    if (inviteMessage) {
      inviteMessage.textContent = "Activando la cuenta...";
      inviteMessage.className = "login-help";
    }

    try {
      const session = getSupabaseSession();
      if (!session?.access_token) throw new Error("El enlace de recuperación no es válido o expiró. Solicite uno nuevo.");
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: "PUT",
        headers: {
          ...supabaseHeaders(),
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ password })
      });
      const user = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(user.error_description || user.msg || user.message || user.error || "No se pudo guardar la contraseña.");
      }

      saveSupabaseSession({ ...session, user });
      localStorage.setItem(currentUserKey, user.user_metadata?.full_name || "Usuario institucional");
      const profile = await fetchSupabaseProfile().catch(() => null);
      localStorage.setItem(
        currentAccessLevelKey,
        profile?.role === "administrador" ? "Administrador" : profile?.role === "ejecutivo" ? "Ejecutivo" : "Empleado"
      );
      localStorage.removeItem(currentUserPhotoKey);
      clearPasswordSetupPending();
      await refreshCurrentPermissions();
      window.location.replace(resolvePostLoginDestination());
    } catch (error) {
      if (inviteMessage) {
        inviteMessage.textContent = error.message || "No se pudo activar la cuenta.";
        inviteMessage.className = "login-help error";
      }
      if (submitButton) submitButton.disabled = false;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const username = formData.get("username");
    const password = formData.get("password");

    if (username.includes("@")) {
      try {
        if (message) {
          message.textContent = "Verificando acceso...";
          message.className = "login-help";
        }
        const session = await signInWithSupabase(username, password);
        const profile = await fetchSupabaseProfile();
        localStorage.setItem(
          currentUserKey,
          profile?.full_name || session.user?.user_metadata?.full_name || "Usuario institucional"
        );
        localStorage.setItem(currentAccessLevelKey, profile?.role === "administrador" ? "Administrador" : profile?.role === "ejecutivo" ? "Ejecutivo" : "Empleado");
        localStorage.removeItem(currentUserPhotoKey);
        await refreshCurrentPermissions();
        window.location.href = resolvePostLoginDestination();
        return;
      } catch (error) {
        clearLoginState(false);
        if (message) {
          message.textContent = "No se pudo entrar. Verifique el correo electrónico y la contraseña asignados por Administración.";
          message.className = "login-help error";
        }
        return;
      }
    }

    if (message) {
      message.textContent = "Use el correo electrónico y la contraseña asignados por Administración.";
      message.className = "login-help error";
    }
  });
}
function bindIdleLogout() {
  let timer = null;
  const hasSession = () => Boolean(getSupabaseSession()?.access_token);

  const schedule = () => {
    if (timer) window.clearTimeout(timer);
    if (!hasSession()) return;
    timer = window.setTimeout(async () => {
      clearAllSensitiveModuleUnlocks();
      await recordSecurityAuditEvent("SESSION_IDLE_LOGOUT", "session", "closed", {
        idle_ms: SESSION_IDLE_MS
      });
      clearLoginState(true, "idle");
    }, SESSION_IDLE_MS);
  };

  ["click", "keydown", "mousemove", "scroll", "touchstart"].forEach((eventName) => {
    window.addEventListener(eventName, schedule, { passive: true });
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) schedule();
  });

  schedule();
}

function rentalMoney(value) {
  return Number(value || 0).toLocaleString("es-PR", { style: "currency", currency: "USD" });
}

function rentalSpaceCard(space) {
  const cover = space.images?.[0] || "";
  const displayName = space.slug === "salon-lito-pena"
    ? "Salón<br>Lito Peña"
    : safeHtml(space.name);
  return `
    <article class="rental-space-card">
      <a class="rental-space-card-image" href="renta-espacio.html?espacio=${encodeURIComponent(space.slug)}">
        <img src="${safeHtml(cover)}" alt="${safeHtml(space.name)}" loading="lazy">
      </a>
      <div class="rental-space-card-body">
        <div class="rental-space-card-heading">
          <div>
            <p class="rental-regulatory-name">${safeHtml(space.regulatoryName)}</p>
            <h3>${displayName}</h3>
          </div>
          <span class="rental-status-badge">${safeHtml(space.status)}</span>
        </div>
        <p>${safeHtml(space.description)}</p>
        <div class="rental-card-facts">
          <span><strong>${rentalMoney(space.canon)}</strong> ${safeHtml(space.billing)}</span>
          <span>${space.slug === "salon-multiuso"
            ? `<strong>${rentalMoney(space.deposit)}</strong> fianza solo evento completo`
            : `<strong>${rentalMoney(space.deposit)}</strong> fianza`}</span>
          <span><strong>${safeHtml(space.area)}</strong></span>
        </div>
        <a class="button rental-card-button" href="renta-espacio.html?espacio=${encodeURIComponent(space.slug)}">Ver espacio y solicitar</a>
      </div>
    </article>
  `;
}

function bindRentalCatalog() {
  const catalog = document.querySelector("[data-rental-catalog]");
  if (!catalog) return;
  catalog.innerHTML = defaultRentalSpaces.map(rentalSpaceCard).join("");
}

function bindRentalGeneralRules() {
  document.querySelectorAll("[data-rental-general-rules]").forEach((list) => {
    list.innerHTML = rentalGeneralRules.map((rule) => `<li>${safeHtml(rule)}</li>`).join("");
  });
}

function bindRentalSpacePage() {
  const detail = document.querySelector("[data-rental-public-detail]");
  if (!detail) return;

  const params = new URLSearchParams(window.location.search);
  const requestedSlug = params.get("espacio");
  const space = defaultRentalSpaces.find((item) => item.slug === requestedSlug) || defaultRentalSpaces[0];
  const displayName = space.slug === "salon-lito-pena"
    ? "Salón<br>Lito Peña"
    : safeHtml(space.name);
  const pageTitle = document.querySelector("[data-rental-public-title]");
  const pageSubtitle = document.querySelector("[data-rental-public-subtitle]");
  if (pageTitle) pageTitle.textContent = space.name;
  if (pageSubtitle) pageSubtitle.textContent = space.regulatoryName;
  document.title = `${space.name} | Renta de Espacios`;
  const priceDescription = space.slug === "salon-multiuso"
    ? `${rentalMoney(space.canon)} evento completo (hasta ${space.fullEventHours} horas) · ${rentalMoney(space.hourlyRate)} por hora (mínimo ${space.minimumHours} horas)`
    : `${rentalMoney(space.canon)} ${safeHtml(space.billing)}`;
  const depositDescription = space.slug === "salon-multiuso"
    ? `${rentalMoney(space.deposit)} solo para evento completo · No aplica por horas`
    : rentalMoney(space.deposit);

  const listMarkup = (items) => items.map((item) => `<li>${safeHtml(item)}</li>`).join("");
  detail.innerHTML = `
    <section class="rental-detail-hero">
      <div class="rental-detail-main-image">
        <img src="${safeHtml(space.images[0])}" alt="${safeHtml(space.name)}" data-rental-main-image>
      </div>
      <div class="rental-detail-copy" data-rental-space-slug="${safeHtml(space.slug)}">
        <p class="page-kicker">${safeHtml(space.regulatoryName)}</p>
        <h2>${displayName}</h2>
        <p>${safeHtml(space.description)}</p>
        <div class="rental-price-block">
          <div><span>Canon</span><strong>${priceDescription}</strong></div>
          <div><span>Fianza reembolsable</span><strong>${depositDescription}</strong></div>
        </div>
        <a class="button submit-button" href="solicitud-renta.html?espacio=${encodeURIComponent(space.id)}">Solicitar este espacio</a>
      </div>
    </section>

    <div class="rental-thumbnail-grid" aria-label="Galería de ${safeHtml(space.name)}">
      ${space.images.map((image, index) => `
        <button type="button" class="${index === 0 ? "is-active" : ""}" data-rental-thumbnail="${safeHtml(image)}" aria-label="Ver fotografía ${index + 1}">
          <img src="${safeHtml(image)}" alt="" loading="lazy">
        </button>
      `).join("")}
    </div>

    <section class="rental-detail-facts">
      <div><span>Área</span><strong>${safeHtml(space.area)}</strong></div>
      <div><span>Capacidad</span><strong>${safeHtml(space.capacityLabel)}</strong></div>
      <div><span>Horario</span><strong>${safeHtml(space.schedule)}</strong></div>
      <div><span>Montaje</span><strong>${safeHtml(space.setup)}</strong></div>
      <div><span>Desmontaje</span><strong>${safeHtml(space.breakdown)}</strong></div>
    </section>

    <section class="rental-detail-columns">
      <article>
        <h3>Ideal para</h3>
        <ul>${listMarkup(space.idealFor || [])}</ul>
      </article>
      <article>
        <h3>Incluye</h3>
        <ul>${listMarkup(space.equipment || [])}</ul>
      </article>
    </section>
  `;

  detail.addEventListener("click", (event) => {
    const thumbnail = event.target.closest("[data-rental-thumbnail]");
    if (!thumbnail) return;
    const mainImage = detail.querySelector("[data-rental-main-image]");
    if (mainImage) mainImage.src = thumbnail.dataset.rentalThumbnail;
    detail.querySelectorAll("[data-rental-thumbnail]").forEach((button) => {
      button.classList.toggle("is-active", button === thumbnail);
    });
  });
}

async function callInstitutionalDataBridge(body) {
  const response = await fetch(`${supabaseUrl}/functions/v1/institutional-data-bridge`, {
    method: "POST",
    headers: await supabaseAuthHeaders(),
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.message || result?.error || "El puente Instituva rechazó la operación.");
  }
  return result;
}

async function callRentalApprovalControl(functionName, payload) {
  if (typeof isInstitutionalDataBackendEnabled === "function" && isInstitutionalDataBackendEnabled()) {
    return callInstitutionalDataBridge({ kind: "rpc", name: functionName, payload });
  }
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: await supabaseAuthHeaders(),
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.message || "Supabase rechazó la operación de aprobación.");
  }
  return result;
}

function bindRentalForm() {
  const form = document.querySelector("#rental-form");
  const adminPanel = document.querySelector("[data-rental-admin]");
  if (!form && !adminPanel) return;

  const message = document.querySelector("[data-rental-message]");
  const adminMessage = document.querySelector("[data-rental-admin-message]");
  const requestTitle = document.querySelector("[data-rental-request-title]");
  const spaceSelect = document.querySelector("[data-rental-space]");
  const spaceDetail = document.querySelector("[data-rental-space-detail]");
  const historyBody = document.querySelector("[data-rental-history]");
  const configPanel = document.querySelector("[data-rental-config]");
  const cancellation = document.querySelector("[data-rental-cancellation]");
  const money = (value) => Number(value || 0).toLocaleString("es-PR", { style: "currency", currency: "USD" });
  const currentUser = () => localStorage.getItem(currentUserKey) || "Administrador";
  const canAdjust = () => (typeof hasPermission === "function"
    ? hasPermission("rentals.manage")
    : (Boolean(getSupabaseSession()?.access_token) && ["Administrador", "Ejecutivo"].includes(currentAccessLevel())));
  const isAuthorizedAdmin = canAdjust();
  const canCreateInternalProduction = () => Boolean(getSupabaseSession()?.access_token) && currentAccessLevel() === "Administrador";
  const internalProductionControl = document.querySelector("[data-rental-internal-control]");
  const internalProductionButton = document.querySelector("[data-rental-internal]");
  const internalProductionStatus = document.querySelector("[data-rental-internal-status]");
  const municipalPaymentSection = document.querySelector("[data-rental-municipal-payment]");
  const municipalReceiptField = document.querySelector("[data-rental-municipal-receipt]");
  const municipalPaymentStatus = document.querySelector("[data-rental-payment-status]");
  const municipalPaymentValidationDate = document.querySelector("[data-rental-payment-validation-date]");
  const municipalPaymentRegisteredBy = document.querySelector("[data-rental-payment-registered-by]");
  const submitButton = form?.querySelector('button[type="submit"]');
  let isInternalProduction = false;
  if (adminPanel) adminPanel.hidden = !isAuthorizedAdmin;
  if (adminPanel && !isAuthorizedAdmin && !form) return;
  const normalizeRentalSpaces = (storedSpaces) => {
    const records = Array.isArray(storedSpaces) ? storedSpaces : [];
    return defaultRentalSpaces.map((defaultSpace) => {
      const storedSpace = records.find((item) => item?.id === defaultSpace.id);
      const mergedSpace = storedSpace ? { ...defaultSpace, ...storedSpace } : { ...defaultSpace };
      if (defaultSpace.id !== "salon-adiestramiento") return mergedSpace;
      return {
        ...mergedSpace,
        canon: 300,
        deposit: 50,
        billing: "evento completo · $40 por hora",
        hourlyRate: 40,
        minimumHours: 2,
        fullEventHours: 8,
        capacity: 60,
        capacityLabel: "60 personas, sujeto al plano de montaje aprobado",
        schedule: "8:00 a. m. - 10:00 p. m.",
        equipment: ["No incluye equipos"],
        requirements: [
          "Evento completo: $300 por un máximo de 8 horas",
          "La fianza para bloquear la fecha del evento completo es de $50",
          "Alquiler por hora: $40, con reservación mínima de 2 horas y costo mínimo de $80",
          "En el alquiler por horas no aplica fianza",
          "La distribución deberá conservar rutas de salida y circulación",
          "Equipos especiales, mobiliario y sonido requieren coordinación y aprobación previa"
        ]
      };
    });
  };
  let spaces = normalizeRentalSpaces(defaultRentalSpaces);
  let requests = [];
  const getSpaces = () => spaces;
  const saveSpaces = async (nextSpaces) => {
    const previousSpaces = spaces;
    spaces = nextSpaces;
    try {
      await saveSystemCollection("renta_espacios", "spaces_v2", spaces);
    } catch (error) {
      spaces = previousSpaces;
      throw error;
    }
  };
  const getRequests = () => requests;
  const saveRequests = async (nextRequests) => {
    const previousRequests = requests;
    requests = nextRequests;
    try {
      await saveSystemCollection("renta_espacios", "requests", requests);
    } catch (error) {
      requests = previousRequests;
      throw error;
    }
  };
  const selectedSpace = () => getSpaces().find((space) => space.id === spaceSelect?.value);
  const dateValue = (name) => form?.elements[name]?.value;
  const daysBetween = () => {
    const start = new Date(`${dateValue("fecha")}T12:00:00`);
    const end = new Date(`${dateValue("fechaFinal") || dateValue("fecha")}T12:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    return Math.max(1, Math.round((end - start) / 86400000) + 1);
  };
  const hoursBetween = () => {
    const startValue = dateValue("horaInicio");
    const endValue = dateValue("horaFinal");
    if (!startValue || !endValue) return 0;
    const [startHour, startMinute] = startValue.split(":").map(Number);
    const [endHour, endMinute] = endValue.split(":").map(Number);
    return Math.max(0, ((endHour * 60 + endMinute) - (startHour * 60 + startMinute)) / 60);
  };
  const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
  const requestRange = (request) => ({
    start: new Date(`${request.fecha}T${request.horaInicio || "00:00"}`),
    end: new Date(`${request.fechaFinal || request.fecha}T${request.horaFinal || "23:59"}`)
  });
  const currentCalculation = () => {
    const space = selectedSpace();
    const days = daysBetween();
    const rate = space?.canon || 0;
    const pricingMode = form?.elements.modalidadTarifa?.value || "evento";
    const hours = hoursBetween();
    const isHourlyMultiuse = space?.slug === "salon-multiuso" && pricingMode === "horas";
    const authorizedInternalProduction = isInternalProduction && canCreateInternalProduction();
    const standardRate = isHourlyMultiuse ? Number(space.hourlyRate || 0) : rate;
    const unitRate = authorizedInternalProduction ? 0 : standardRate;
    const deposit = authorizedInternalProduction || isHourlyMultiuse ? 0 : Number(space?.deposit || 0);
    const subtotal = authorizedInternalProduction ? 0 : (isHourlyMultiuse ? standardRate * hours : rate);
    const tax = 0;
    return {
      rate: unitRate,
      days,
      hours,
      pricingMode,
      isHourlyMultiuse,
      isInternalProduction: authorizedInternalProduction,
      deposit,
      subtotal,
      tax,
      total: subtotal + deposit + tax
    };
  };
  const setMessage = (text, type = "") => {
    if (!message) return;
    message.textContent = text;
    message.className = `form-message ${type}`.trim();
  };
  const setAdminMessage = (text, type = "") => {
    if (!adminMessage) return;
    adminMessage.textContent = text;
    adminMessage.className = `form-message ${type}`.trim();
  };
  const createSequence = (prefix, count) => `${prefix}-${String(count + 1).padStart(4, "0")}`;
  const auditEntry = (estado, comentarios = "") => ({
    usuario: currentUser(),
    fecha: new Date().toLocaleDateString("es-PR"),
    hora: new Date().toLocaleTimeString("es-PR"),
    estado,
    comentarios
  });

  const updateMunicipalPayment = () => {
    if (municipalPaymentSection) municipalPaymentSection.hidden = !isAuthorizedAdmin;
    if (!isAuthorizedAdmin) return;

    const hasReceipt = Boolean(String(municipalReceiptField?.value || "").trim());
    const isExempt = isInternalProduction && canCreateInternalProduction();
    if (municipalPaymentStatus) {
      municipalPaymentStatus.textContent = isExempt
        ? "Exento · Producción interna"
        : (hasReceipt ? "Recibo registrado" : "Pendiente");
      municipalPaymentStatus.classList.toggle("is-validated", hasReceipt || isExempt);
    }
    if (municipalPaymentValidationDate) {
      municipalPaymentValidationDate.value = hasReceipt && !isExempt
        ? new Date().toLocaleString("es-PR")
        : "";
    }
    if (municipalPaymentRegisteredBy) {
      municipalPaymentRegisteredBy.value = hasReceipt && !isExempt ? currentUser() : "";
    }
  };

  const populateSpaces = () => {
    const spaces = getSpaces();
    if (spaceSelect) {
      spaceSelect.innerHTML = `<option value="">Seleccione un espacio...</option>${spaces.map((space) => (
        `<option value="${space.id}"${space.status !== "Disponible" ? " disabled" : ""}>${space.name} - ${space.canon ? money(space.canon) : space.billing} ${space.canon ? space.billing : ""}</option>`
      )).join("")}`;
    }
  };

  const updateRequestTitle = () => {
    if (!requestTitle) return;
    const space = selectedSpace();
    requestTitle.textContent = space ? `Solicitud de Renta de ${space.name}` : "Solicitud de Renta";
    document.title = space ? `Solicitud de Renta de ${space.name} | Museo de la Música` : "Solicitud de Renta | Museo de la Música";
  };

  const renderSpaceDetail = () => {
    const space = selectedSpace();
    if (!spaceDetail) return;
    if (!space) {
      spaceDetail.hidden = true;
      spaceDetail.innerHTML = "";
      return;
    }
    spaceDetail.hidden = false;
    const multiusePricing = space.slug === "salon-multiuso" ? `
      <div class="field rental-pricing-mode">
        <label for="rental-pricing-mode">Modalidad de alquiler</label>
        <select id="rental-pricing-mode" name="modalidadTarifa" required>
          <option value="evento">Evento completo — ${money(space.canon)}, máximo ${space.fullEventHours} horas</option>
          <option value="horas">Por horas — ${money(space.hourlyRate)} por hora, mínimo ${space.minimumHours} horas</option>
        </select>
      </div>
    ` : "";
    spaceDetail.innerHTML = `
      <h3>${safeHtml(space.name)}</h3>
      <p>${safeHtml(space.description)}</p>
      <div class="rental-feature-grid">
        <span><strong>Canon:</strong> ${space.slug === "salon-multiuso"
          ? `${money(space.canon)} evento completo / ${money(space.hourlyRate)} por hora`
          : (space.canon ? `${money(space.canon)} ${space.billing}` : space.billing)}</span>
        <span><strong>Fianza:</strong> ${space.slug === "salon-multiuso"
          ? `${money(space.deposit)} para evento completo · No aplica por horas`
          : money(space.deposit)}</span>
        <span><strong>Área:</strong> ${safeHtml(space.area || "Según configuración")}</span>
        <span><strong>Capacidad:</strong> ${safeHtml(space.capacityLabel || "Según montaje aprobado")}</span>
        <span><strong>Horario:</strong> ${safeHtml(space.schedule)}</span>
        <span><strong>Montaje:</strong> ${safeHtml(space.setup)}</span>
        <span><strong>Desmontaje:</strong> ${safeHtml(space.breakdown)}</span>
        <span><strong>Estado:</strong> ${safeHtml(space.status)}</span>
      </div>
      <p><strong>Equipos incluidos:</strong> ${space.equipment.map(safeHtml).join(", ")}</p>
      <p><strong>Requisitos particulares:</strong> ${(space.requirements || []).map(safeHtml).join(" · ")}</p>
      ${multiusePricing}
      <a class="rental-detail-link" href="renta-espacio.html?espacio=${encodeURIComponent(space.slug)}">Ver fotografías y ficha completa</a>
    `;
  };

  const renderCalculation = () => {
    const calc = currentCalculation();
    const rateLabel = document.querySelector("[data-rental-rate-label]");
    const durationLabel = document.querySelector("[data-rental-duration-label]");
    if (rateLabel) rateLabel.textContent = calc.isHourlyMultiuse ? "Tarifa por hora" : "Precio por evento";
    if (durationLabel) durationLabel.textContent = calc.isHourlyMultiuse ? "Cantidad de horas" : "Cantidad de días";
    const values = {
      "[data-rental-rate]": money(calc.rate),
      "[data-rental-days]": calc.isHourlyMultiuse ? calc.hours.toLocaleString("es-PR", { maximumFractionDigits: 2 }) : calc.days,
      "[data-rental-deposit]": money(calc.deposit),
      "[data-rental-subtotal]": money(calc.subtotal),
      "[data-rental-tax]": money(calc.tax),
      "[data-rental-total]": money(calc.total)
    };
    Object.entries(values).forEach(([selector, value]) => {
      const node = document.querySelector(selector);
      if (node) node.textContent = value;
    });
    if (internalProductionButton) {
      internalProductionButton.classList.toggle("is-active", calc.isInternalProduction);
      internalProductionButton.setAttribute("aria-pressed", String(calc.isInternalProduction));
    }
    if (internalProductionStatus) {
      internalProductionStatus.hidden = !calc.isInternalProduction;
    }

    if (cancellation && dateValue("fecha")) {
      const daysBefore = Math.ceil((new Date(`${dateValue("fecha")}T12:00:00`) - new Date()) / 86400000);
      const refund = daysBefore >= 30 ? "el Museo podrá autorizar la devolución total" : daysBefore >= 2 ? "el Museo podrá retener hasta un 50%" : "no procede devolución";
      cancellation.textContent = `Según la fecha seleccionada, en caso de cancelación aplicaría: ${refund}.`;
    }
  };

  const hasConflict = () => {
    const spaceId = spaceSelect?.value;
    if (!spaceId || !dateValue("fecha") || !dateValue("horaInicio") || !dateValue("horaFinal")) return null;
    const current = {
      fecha: dateValue("fecha"),
      fechaFinal: dateValue("fechaFinal") || dateValue("fecha"),
      horaInicio: dateValue("horaInicio"),
      horaFinal: dateValue("horaFinal")
    };
    const currentRange = requestRange(current);
    return getRequests().find((request) => {
      if (request.espacioId !== spaceId || ["Rechazada", "Cancelada"].includes(request.estado)) return false;
      const range = requestRange(request);
      return overlaps(currentRange.start, currentRange.end, range.start, range.end);
    });
  };

  const syncApprovedRequest = async (request) => {
    const calendarRecords = await fetchSystemCollection("calendario_general", "records", []);
    if (!calendarRecords.some((item) => item.rentalId === request.id)) {
      calendarRecords.push({
        id: `rental-calendar-${request.id}`,
        rentalId: request.id,
        fecha: request.fecha,
        titulo: `Arrendamiento: ${request.espacio}`,
        descripcion: `${request.tipoActividad} - ${request.nombre}`
      });
      await saveSystemCollection("calendario_general", "records", calendarRecords);
    }

  };

  const renderHistory = () => {
    if (!historyBody || !isAuthorizedAdmin) return;
    const requests = getRequests();
    const administrators = getEmployeeRecords()
      .filter((employee) => employee.acceso === "Administrador" && employee.estado !== "Inactivo")
      .map((employee) => ({ id: employee.id, name: employeeDisplayName(employee) }))
      .filter((employee) => employee.name);
    const approverOptions = (request) => `
      <option value="">Seleccione...</option>
      ${administrators.map((administrator) => `
        <option value="${safeHtml(administrator.id)}"${request.aprobadoPorId === administrator.id ? " selected" : ""}>${safeHtml(administrator.name)}</option>
      `).join("")}
    `;
    historyBody.innerHTML = requests.length ? requests.map((request) => `
      <tr>
        <td>${safeHtml(request.numeroSolicitud)}</td>
        <td>${safeHtml(request.nombre)}</td>
        <td>${safeHtml(request.espacio)}</td>
        <td>${safeHtml(request.fecha)}</td>
        <td>${money(request.total)}</td>
        <td><input type="text" value="${safeHtml(request.numeroRecibo || "")}" data-rental-receipt="${safeHtml(request.id)}" placeholder="Recibo MAG" aria-label="Número de recibo del Municipio de Guaynabo"></td>
        <td><input class="rental-approval-checkbox" type="checkbox" data-rental-approval="${safeHtml(request.id)}"${request.estado === "Aprobada" ? " checked" : ""} aria-label="Marcar ${safeHtml(request.numeroSolicitud)} como aprobada"></td>
        <td><select class="rental-approved-by" data-rental-approved-by="${safeHtml(request.id)}" aria-label="Aprobado por">${approverOptions(request)}</select></td>
        <td>${safeHtml(request.estado)}</td>
      </tr>
    `).join("") : `<tr><td colspan="9">No hay solicitudes registradas.</td></tr>`;
  };

  const renderConfig = () => {
    if (!configPanel) return;
    configPanel.innerHTML = getSpaces().map((space) => `
      <article class="rental-config-card">
        <label><small>Nombre</small><input type="text" value="${safeHtml(space.name)}" data-rental-space-id="${space.id}" data-rental-space-field="name"></label>
        <label><small>Descripción</small><textarea rows="3" data-rental-space-id="${space.id}" data-rental-space-field="description">${safeHtml(space.description)}</textarea></label>
        <label><small>Canon</small><input type="number" min="0" step="0.01" value="${Number(space.canon || 0)}" data-rental-space-id="${space.id}" data-rental-space-field="canon"></label>
        <label><small>Fianza</small><input type="number" min="0" step="0.01" value="${Number(space.deposit || 0)}" data-rental-space-id="${space.id}" data-rental-space-field="deposit"></label>
        <label><small>Capacidad</small><input type="number" min="0" step="1" value="${Number(space.capacity || 0)}" data-rental-space-id="${space.id}" data-rental-space-field="capacity"></label>
        <label><small>Horarios disponibles</small><input type="text" value="${safeHtml(space.schedule)}" data-rental-space-id="${space.id}" data-rental-space-field="schedule"></label>
        <label><small>Montaje</small><input type="text" value="${safeHtml(space.setup)}" data-rental-space-id="${space.id}" data-rental-space-field="setup"></label>
        <label><small>Desmontaje</small><input type="text" value="${safeHtml(space.breakdown)}" data-rental-space-id="${space.id}" data-rental-space-field="breakdown"></label>
        <label><small>Estado</small><select data-rental-space-id="${space.id}" data-rental-space-field="status"><option${space.status === "Disponible" ? " selected" : ""}>Disponible</option><option${space.status === "No Disponible" ? " selected" : ""}>No Disponible</option></select></label>
        <label><small>Equipos incluidos</small><input type="text" value="${safeHtml(space.equipment.join(", "))}" data-rental-space-id="${space.id}" data-rental-space-field="equipment"></label>
      </article>
    `).join("");
  };

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const requiredFields = Array.from(form.querySelectorAll("[required]"));
    const invalidFields = requiredFields.filter((field) => {
      if (field.type === "checkbox") return !field.checked;
      if (field.type === "file") return !field.files || !field.files.length;
      return !String(field.value || "").trim();
    });

    const email = form.querySelector("#rental-email");
    if (email && email.value && !email.checkValidity()) invalidFields.push(email);

    if (invalidFields.length > 0) {
      invalidFields[0].focus();
      if (message) {
        message.textContent = "Complete todos los campos requeridos correctamente y acepte los términos antes de enviar.";
        message.className = "form-message error";
      }
      return;
    }

    const conflict = hasConflict();
    if (conflict) {
      setMessage(`El espacio ya está reservado para esa fecha y horario por la solicitud ${conflict.numeroSolicitud}.`, "error");
      return;
    }

    const selected = selectedSpace();
    const calculation = currentCalculation();
    if (selected?.slug === "salon-multiuso") {
      const start = dateValue("horaInicio");
      const end = dateValue("horaFinal");
      if (dateValue("fechaFinal") !== dateValue("fecha")) {
        setMessage("El alquiler del Salón Multiuso debe registrarse para una sola fecha.", "error");
        return;
      }
      if (start < "08:00" || end > "22:00") {
        setMessage("El Salón Multiuso está disponible de 8:00 a. m. a 10:00 p. m.", "error");
        return;
      }
      if (calculation.hours <= 0) {
        setMessage("La hora de finalización debe ser posterior a la hora de inicio.", "error");
        return;
      }
      if (calculation.pricingMode === "horas" && calculation.hours < selected.minimumHours) {
        setMessage(`El alquiler por horas requiere un mínimo de ${selected.minimumHours} horas.`, "error");
        return;
      }
      if (calculation.pricingMode === "evento" && calculation.hours > selected.fullEventHours) {
        setMessage(`La tarifa de evento completo cubre un máximo de ${selected.fullEventHours} horas.`, "error");
        return;
      }
    }

    const data = new FormData(form);
    const currentRequests = getRequests();
    const space = selectedSpace();
    const calc = currentCalculation();
    const municipalReceipt = isAuthorizedAdmin && !calc.isInternalProduction
      ? String(data.get("numeroReciboMunicipal") || "").trim()
      : "";
    const requestId = `rental-${Date.now()}`;
    let uploadedDocuments = [];
    if (submitButton) submitButton.disabled = true;
    setMessage("Guardando documentos en el expediente digital privado...", "");
    try {
      uploadedDocuments = await uploadRentalDocuments(
        requestId,
        Array.from(form.querySelectorAll('input[type="file"]'))
      );
    } catch (error) {
      if (submitButton) submitButton.disabled = false;
      setMessage(`No se pudo completar el expediente digital: ${error.message}`, "error");
      return;
    }

    const request = {
      id: requestId,
      numeroSolicitud: createSequence("SOL", currentRequests.length),
      numeroRecibo: municipalReceipt,
      reciboValidadoEn: municipalReceipt ? new Date().toISOString() : "",
      reciboRegistradoPorId: municipalReceipt ? (getSupabaseSession()?.user?.id || "") : "",
      reciboRegistradoPor: municipalReceipt ? currentUser() : "",
      nombre: data.get("nombre"),
      organizacion: data.get("organizacion"),
      contacto: data.get("contacto"),
      correo: data.get("correo"),
      telefono: data.get("telefono"),
      direccion: data.get("direccion"),
      fecha: data.get("fecha"),
      fechaFinal: data.get("fechaFinal"),
      horaInicio: data.get("horaInicio"),
      horaFinal: data.get("horaFinal"),
      asistentes: data.get("asistentes"),
      tipoActividad: data.get("tipoActividad"),
      espacioId: space.id,
      espacio: space.name,
      descripcion: data.get("descripcion"),
      modalidadTarifa: calc.pricingMode,
      produccionInterna: calc.isInternalProduction,
      horas: calc.hours,
      precioDia: calc.rate,
      fianza: calc.deposit,
      dias: calc.days,
      subtotal: calc.subtotal,
      impuestos: calc.tax,
      total: calc.total,
      estado: "Pendiente",
      aprobadoPorId: "",
      aprobadoPor: "",
      documentos: uploadedDocuments,
      audit: [auditEntry(
        "Pendiente",
        calc.isInternalProduction
          ? "Solicitud creada como Producción Interna del Museo por un Administrador. Canon y fianza exentos."
          : "Solicitud creada desde el formulario de renta."
      )]
    };

    try {
      await saveRequests([...currentRequests, request]);
      renderHistory();
      form.reset();
      isInternalProduction = false;
      updateMunicipalPayment();
      renderSpaceDetail();
      renderCalculation();
      updateRequestTitle();
      if (submitButton) submitButton.disabled = false;
      setMessage(`Solicitud ${request.numeroSolicitud} registrada en Supabase.`, "success");
    } catch (error) {
      await deleteRentalDocuments(uploadedDocuments.map((document) => document.ruta)).catch(() => {});
      if (submitButton) submitButton.disabled = false;
      setMessage(`No se pudo guardar en Supabase: ${error.message}`, "error");
    }
  });

  ["change", "input"].forEach((eventName) => {
    form?.addEventListener(eventName, (event) => {
      if (event.target.matches("[data-rental-space]")) {
        renderSpaceDetail();
        updateRequestTitle();
      }
      renderCalculation();
    });
  });

  document.querySelector("[data-rental-print]")?.addEventListener("click", () => {
    window.print();
  });

  if (internalProductionControl) {
    internalProductionControl.hidden = !canCreateInternalProduction();
  }
  if (municipalPaymentSection) {
    municipalPaymentSection.hidden = !isAuthorizedAdmin;
  }
  municipalReceiptField?.addEventListener("input", updateMunicipalPayment);
  updateMunicipalPayment();
  internalProductionButton?.addEventListener("click", () => {
    if (!canCreateInternalProduction()) {
      isInternalProduction = false;
      if (internalProductionControl) internalProductionControl.hidden = true;
      setMessage("Esta función está disponible únicamente para Administradores autenticados.", "error");
      renderCalculation();
      return;
    }
    isInternalProduction = !isInternalProduction;
    updateMunicipalPayment();
    renderCalculation();
    setMessage(
      isInternalProduction
        ? "Producción interna activada: el contrato conservará toda la información con canon y fianza en $0."
        : "Producción interna desactivada: se restauraron los cargos regulares.",
      "success"
    );
  });

  document.querySelector("[data-rental-reset]")?.addEventListener("click", () => {
    form?.reset();
    isInternalProduction = false;
    updateMunicipalPayment();
    renderSpaceDetail();
    renderCalculation();
    updateRequestTitle();
    setMessage("");
  });

  historyBody?.addEventListener("change", async (event) => {
    if (!isAuthorizedAdmin) return;
    const approval = event.target.closest("[data-rental-approval]");
    const approverField = event.target.closest("[data-rental-approved-by]");
    const receiptField = event.target.closest("[data-rental-receipt]");
    const requestId = approval?.dataset.rentalApproval || approverField?.dataset.rentalApprovedBy || receiptField?.dataset.rentalReceipt;
    if (!requestId) return;
    const request = getRequests().find((item) => item.id === requestId);
    if (!request) return;
    const row = event.target.closest("tr");
    const selectedApprover = row?.querySelector("[data-rental-approved-by]")?.value || "";
    const administrator = getEmployeeRecords().find((employee) => employee.id === selectedApprover && employee.acceso === "Administrador");

    if (approval?.checked && !administrator) {
      approval.checked = false;
      setAdminMessage("Seleccione primero el administrador que aprueba la solicitud.", "error");
      return;
    }
    if (approval?.checked && !request.produccionInterna && !String(request.numeroRecibo || "").trim()) {
      approval.checked = false;
      setAdminMessage("Ingrese primero el número de recibo emitido por el Municipio de Guaynabo.", "error");
      return;
    }

    if (receiptField) {
      const nextReceipt = receiptField.value.trim();
      try {
        await callRentalApprovalControl("record_rental_municipal_receipt", {
          p_request_key: request.id,
          p_receipt_number: nextReceipt || null,
          p_internal_production: Boolean(request.produccionInterna)
        });
      } catch (error) {
        await callRentalApprovalControl("log_rental_blocked_event", {
          p_request_key: request.id,
          p_action: String(error.message || "").toLowerCase().includes("already assigned")
            ? "rental.receipt.duplicate"
            : "rental.control.failed"
        }).catch(() => null);
        renderHistory();
        setAdminMessage(`No se pudo registrar el recibo: ${error.message}`, "error");
        return;
      }
      request.numeroRecibo = nextReceipt;
      request.audit = [...(request.audit || []), auditEntry(
        request.estado,
        request.numeroRecibo
          ? `Recibo del Municipio de Guaynabo registrado: ${request.numeroRecibo}.`
          : "Número de recibo municipal eliminado."
      )];
    } else if (approval) {
      try {
        await callRentalApprovalControl("set_rental_approval", {
          p_request_key: request.id,
          p_approved: Boolean(approval.checked),
          p_internal_production: Boolean(request.produccionInterna)
        });
      } catch (error) {
        await callRentalApprovalControl("log_rental_blocked_event", {
          p_request_key: request.id,
          p_action: String(error.message || "").toLowerCase().includes("receipt")
            ? "rental.approval.blocked_missing_receipt"
            : "rental.control.failed"
        }).catch(() => null);
        approval.checked = request.estado === "Aprobada";
        setAdminMessage(`Supabase rechazó la aprobación: ${error.message}`, "error");
        return;
      }
      request.estado = approval.checked ? "Aprobada" : "Pendiente";
      request.aprobadoPorId = approval.checked ? administrator.id : "";
      request.aprobadoPor = approval.checked ? employeeDisplayName(administrator) : "";
      request.audit = [...(request.audit || []), auditEntry(
        request.estado,
        approval.checked ? `Aprobada por ${request.aprobadoPor}.` : "Aprobación retirada."
      )];
    } else {
      request.aprobadoPorId = administrator?.id || "";
      request.aprobadoPor = administrator ? employeeDisplayName(administrator) : "";
    }

    try {
      await saveRequests([...getRequests()]);
      if (request.estado === "Aprobada") await syncApprovedRequest(request);
      renderHistory();
      setAdminMessage(`Solicitud ${request.numeroSolicitud} actualizada.`, "success");
    } catch (error) {
      renderHistory();
      setAdminMessage(`No se pudo actualizar la solicitud: ${error.message}`, "error");
    }
  });

  configPanel?.addEventListener("change", async (event) => {
    const field = event.target.closest("[data-rental-space-field]");
    if (!field || !canAdjust()) return;
    const spaces = getSpaces();
    const space = spaces.find((item) => item.id === field.dataset.rentalSpaceId);
    if (!space) return;
    const key = field.dataset.rentalSpaceField;
    if (key === "canon" || key === "deposit" || key === "capacity") {
      space[key] = Number(field.value || 0);
    } else if (key === "equipment") {
      space[key] = field.value.split(",").map((item) => item.trim()).filter(Boolean);
    } else {
      space[key] = field.value;
    }
    try {
      await saveSpaces(spaces);
      populateSpaces();
      renderSpaceDetail();
      renderCalculation();
      setAdminMessage("Configuración del espacio actualizada en Supabase.", "success");
    } catch (error) {
      setAdminMessage(`No se pudo guardar en Supabase: ${error.message}`, "error");
    }
  });

  const loadRentalData = async () => {
    if (isAuthorizedAdmin) {
      try {
        await syncEmployeeCacheFromSupabase();
      } catch (error) {
        setAdminMessage(`No se pudo cargar la lista de administradores: ${error.message}`, "error");
      }
    }
    try {
      spaces = normalizeRentalSpaces(await fetchSystemCollection("renta_espacios", "spaces_v2", defaultRentalSpaces));
      requests = await fetchSystemCollection("renta_espacios", "requests", []);
    } catch (error) {
      setMessage(`No se pudo cargar Renta desde Supabase: ${error.message}`, "error");
      setAdminMessage(`No se pudo cargar Renta desde Supabase: ${error.message}`, "error");
    }
    populateSpaces();
    renderSpaceDetail();
    renderCalculation();
    renderHistory();
    renderConfig();

    const requestedSpace = new URLSearchParams(window.location.search).get("espacio");
    if (requestedSpace && spaceSelect && getSpaces().some((space) => space.id === requestedSpace)) {
      spaceSelect.value = requestedSpace;
      renderSpaceDetail();
      renderCalculation();
    }
    updateRequestTitle();
  };

  loadRentalData();
}

function bindLoanReceiptForm() {
  const form = document.querySelector("#loan-receipt-form");
  if (!form) return;

  const articleNumber = document.querySelector("[data-loan-article-number]");
  const articleDate = document.querySelector("[data-loan-article-date]");
  let receipts = [];
  const today = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };
  const displayDate = (date) => {
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
  };
  const nextSequence = () => receipts.reduce((highest, receipt) => Math.max(highest, Number(receipt.sequence || 0)), 0) + 1;
  const formatArticleNumber = (sequence) => `Artículo ${String(sequence).padStart(5, "0")}`;
  const saveReceipts = async () => saveSystemCollection("recibos_prestamo", "receipts", receipts);
  const refreshMeta = () => {
    if (articleNumber) articleNumber.textContent = formatArticleNumber(nextSequence());
    if (articleDate) articleDate.textContent = displayDate(today());
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.querySelector("[data-loan-message]");
    const requiredFields = Array.from(form.querySelectorAll("[required]"));
    const invalidFields = requiredFields.filter((field) => {
      if (field.type === "checkbox") return !field.checked;
      return !field.value.trim();
    });

    const email = form.querySelector("#loan-email");
    if (email && email.value && !email.checkValidity()) invalidFields.push(email);

    if (invalidFields.length > 0) {
      invalidFields[0].focus();
      if (message) {
        message.textContent = "Complete todos los campos requeridos correctamente antes de enviar.";
        message.className = "form-message error";
      }
      return;
    }

    const data = new FormData(form);
    const sequence = nextSequence();
    const internalNumber = formatArticleNumber(sequence);
    const emissionDate = today();

    const nextReceipts = [...receipts, {
      id: `loan-${Date.now()}`,
      sequence,
      numeroArticulo: internalNumber,
      fechaEmision: emissionDate,
      prestamista: data.get("prestamista"),
      correo: data.get("correo"),
      telefono: data.get("telefono"),
      direccion: data.get("direccion"),
      fechaRecibo: data.get("fecha"),
      articulo: data.get("articulo"),
      categoria: data.get("categoria"),
      descripcion: data.get("descripcion"),
      condicion: data.get("condicion"),
      valorEstimado: data.get("valor"),
      fechaInicio: data.get("inicio"),
      fechaDevolucionEstimada: data.get("devolucion"),
      proposito: data.get("proposito"),
      observaciones: data.get("observaciones") || "",
      certificacionAceptada: true
    }];

    try {
      const previousReceipts = receipts;
      receipts = nextReceipts;
      try {
        await saveReceipts();
      } catch (error) {
        receipts = previousReceipts;
        throw error;
      }
      refreshMeta();
    } catch (error) {
      if (message) {
        message.textContent = `No se pudo guardar en Supabase: ${error.message}`;
        message.className = "form-message error";
      }
      return;
    }

    if (message) {
      message.textContent = "Formulario validado y registrado correctamente en el sistema central.";
      message.className = "form-message success";
    }
  });

  const loadReceipts = async () => {
    try {
      receipts = await fetchSystemCollection("recibos_prestamo", "receipts", []);
    } catch (error) {
      const message = document.querySelector("[data-loan-message]");
      if (message) {
        message.textContent = `No se pudo cargar Recibos desde Supabase: ${error.message}`;
        message.className = "form-message error";
      }
    }
    refreshMeta();
  };

  loadReceipts();
}

function bindInventoryModule() {
  const form = document.querySelector("#inventory-form");
  if (!form) return;

  const entryPanel = document.querySelector("[data-inventory-entry-panel]");
  const typeButtons = document.querySelectorAll("[data-inventory-type]");
  const typeField = document.querySelector("#inventory-type");
  const formTitle = document.querySelector("[data-inventory-form-title]");
  const artworkFields = document.querySelector("[data-artwork-fields]");
  const list = document.querySelector("[data-inventory-list]");
  const message = document.querySelector("[data-inventory-message]");
  const search = document.querySelector("[data-inventory-search]");
  const locationFilter = document.querySelector("[data-inventory-filter-location]");
  const statusFilter = document.querySelector("[data-inventory-filter-status]");
  const total = document.querySelector("[data-inventory-total]");
  const submitButton = document.querySelector("[data-inventory-submit]");
  const cancelButton = document.querySelector("[data-inventory-cancel]");
  const idField = document.querySelector("#inventory-id");
  const locations = Array.from(document.querySelectorAll("#inventory-location option")).map((option) => option.value).filter(Boolean);
  const statuses = Array.from(document.querySelectorAll("#inventory-status option")).map((option) => option.value).filter(Boolean);
  let records = [];
  let sortKey = "fecha";
  let sortDirection = "desc";

  const canEditInventory = () => hasPermission("inventory.manage");
  const saveRecords = async () => saveSystemCollection("inventario", "records", records);
  const normalize = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
  const createId = () => {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `inventory-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const artworkFieldControls = () => Array.from(artworkFields?.querySelectorAll("input, select, textarea") || []);

  const setInventoryType = (type) => {
    const isArtwork = type === "Obra de Arte";
    if (typeField) typeField.value = type;
    if (formTitle) formTitle.textContent = isArtwork ? "Registro de Obra de Arte" : "Registro de Equipos";
    if (artworkFields) artworkFields.hidden = !isArtwork;
    artworkFieldControls().forEach((field) => {
      field.disabled = !isArtwork;
    });
    typeButtons.forEach((button) => {
      const active = button.dataset.inventoryType === type;
      button.classList.toggle("is-active", active);
      button.classList.toggle("submit-button", active);
      button.classList.toggle("secondary", !active);
    });
  };

  const setMessage = (text, type = "") => {
    if (!message) return;
    message.textContent = text;
    message.className = `form-message ${type}`.trim();
  };

  const populateFilters = () => {
    if (locationFilter && locationFilter.options.length === 1) {
      locations.forEach((location) => locationFilter.add(new Option(location, location)));
    }
    if (statusFilter && statusFilter.options.length === 1) {
      statuses.forEach((status) => statusFilter.add(new Option(status, status)));
    }
  };

  const getFilteredRecords = () => {
    const term = normalize(search?.value);
    const selectedLocation = locationFilter?.value || "";
    const selectedStatus = statusFilter?.value || "";

    return records
      .filter((record) => {
        const matchesSearch = !term || [
          record.tipo,
          record.nombre,
          record.descripcion,
          record.sello,
          record.ubicacion,
          record.estado,
          record.contacto
        ].some((value) => normalize(value).includes(term));

        return matchesSearch &&
          (!selectedLocation || record.ubicacion === selectedLocation) &&
          (!selectedStatus || record.estado === selectedStatus);
      })
      .sort((a, b) => {
        const first = normalize(a[sortKey]);
        const second = normalize(b[sortKey]);
        const result = first.localeCompare(second);
        return sortDirection === "asc" ? result : -result;
      });
  };

  const renderRecords = () => {
    if (total) total.textContent = records.length;
    if (!list) return;

    const filteredRecords = getFilteredRecords();
    if (filteredRecords.length === 0) {
      list.innerHTML = `<tr><td colspan="9">No hay artículos registrados.</td></tr>`;
      return;
    }

    list.innerHTML = filteredRecords.map((record) => `
      <tr>
        <td>${escapeHtml(record.tipo || "Equipo")}</td>
        <td>${escapeHtml(record.nombre)}</td>
        <td>${escapeHtml(record.descripcion)}</td>
        <td>${escapeHtml(record.sello)}</td>
        <td>${escapeHtml(record.ubicacion)}</td>
        <td>${escapeHtml(record.estado)}</td>
        <td>${escapeHtml(record.contacto || "N/A")}</td>
        <td>${escapeHtml(record.fecha)}</td>
        <td>
          <div class="table-actions"${canEditInventory() ? "" : " hidden"}>
            <button type="button" data-inventory-edit="${record.id}">Editar</button>
            <button type="button" data-inventory-delete="${record.id}">Eliminar</button>
          </div>
        </td>
      </tr>
    `).join("");
  };

  const resetForm = () => {
    form.reset();
    if (idField) idField.value = "";
    setInventoryType(typeField?.value || "Equipo");
    if (submitButton) submitButton.textContent = "Guardar Registro";
    if (cancelButton) cancelButton.hidden = true;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canEditInventory()) {
      setMessage("Solo Ejecutivos y Administradores pueden crear o editar inventario.", "error");
      return;
    }
    const data = new FormData(form);
    const id = data.get("id");
    const tipo = data.get("tipo") || "Equipo";
    const record = {
      id: id || createId(),
      tipo,
      nombre: data.get("nombre").trim(),
      descripcion: data.get("descripcion").trim(),
      sello: data.get("sello").trim(),
      ubicacion: data.get("ubicacion"),
      estado: data.get("estado"),
      contacto: data.get("contacto").trim(),
      fecha: id ? records.find((item) => item.id === id)?.fecha : new Date().toLocaleDateString("es-PR"),
      prestamista: data.get("prestamista")?.trim() || "",
      correo: data.get("correo")?.trim() || "",
      telefono: data.get("telefono")?.trim() || "",
      fechaRecibo: data.get("fechaRecibo") || "",
      direccion: data.get("direccion")?.trim() || "",
      categoria: data.get("categoria") || "",
      valor: data.get("valor")?.trim() || "",
      inicio: data.get("inicio") || "",
      devolucion: data.get("devolucion") || "",
      proposito: data.get("proposito")?.trim() || "",
      observaciones: data.get("observaciones")?.trim() || ""
    };

    if (!record.nombre || !record.descripcion || !record.sello || !record.ubicacion || !record.estado) {
      setMessage("Complete todos los campos requeridos antes de guardar.", "error");
      return;
    }

    const duplicate = records.some((item) => normalize(item.sello) === normalize(record.sello) && item.id !== id);
    if (duplicate) {
      setMessage("El número de sello ya existe. Use un número único.", "error");
      return;
    }

    const nextRecords = id ? records.map((item) => item.id === id ? record : item) : [record, ...records];
    const previousRecords = records;
    try {
      records = nextRecords;
      await saveRecords();
      resetForm();
      setMessage(id ? "Registro actualizado en Supabase." : "Registro guardado en Supabase.", "success");
      renderRecords();
    } catch (error) {
      records = previousRecords;
      setMessage(`No se pudo guardar en Supabase: ${error.message}`, "error");
    }
  });

  document.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-inventory-edit]");
    const deleteButton = event.target.closest("[data-inventory-delete]");
    const sortButton = event.target.closest("[data-inventory-sort]");

    if (editButton) {
      if (!canEditInventory()) return;
      const record = records.find((item) => item.id === editButton.dataset.inventoryEdit);
      if (!record) return;
      setInventoryType(record.tipo || "Equipo");
      Object.entries(record).forEach(([key, value]) => {
        const field = form.elements[key];
        if (field) field.value = value;
      });
      if (submitButton) submitButton.textContent = "Actualizar Registro";
      if (cancelButton) cancelButton.hidden = false;
      setMessage("Editando registro seleccionado.", "");
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    }

  });

  if (cancelButton) {
    cancelButton.addEventListener("click", () => {
      resetForm();
      setMessage("");
    });
  }

  typeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      resetForm();
      setInventoryType(button.dataset.inventoryType);
      setMessage("");
    });
  });

  [search, locationFilter, statusFilter].forEach((control) => {
    if (control) control.addEventListener("input", renderRecords);
  });

  if (!canEditInventory() && entryPanel) {
    entryPanel.hidden = true;
  }
  const loadInventoryRecords = async () => {
    try {
      records = await fetchSystemCollection("inventario", "records", []);
      setMessage("Inventario cargado desde Supabase.", "success");
    } catch (error) {
      setMessage(`No se pudo cargar Inventario desde Supabase: ${error.message}`, "error");
    }
    setInventoryType("Equipo");
    populateFilters();
    renderRecords();
  };

  loadInventoryRecords();
}

function bindCalendarModules() {
  const panel = document.querySelector("[data-calendar-module]");
  if (!panel) return;

  const moduleType = panel.dataset.calendarModule;
  const isMaintenance = moduleType === "maintenance";
  const isUshers = moduleType === "ushers";
  const isGeneral = moduleType === "general";
  const moduleKey = isMaintenance
    ? "calendario_obras"
    : isUshers
      ? "calendario_ujieres"
      : "calendario_general";
  const form = panel.querySelector("[data-calendar-form]");
  const grid = panel.querySelector("[data-calendar-grid]");
  const title = panel.querySelector("[data-calendar-title]");
  const message = panel.querySelector("[data-calendar-message]");
  const submitButton = panel.querySelector("[data-calendar-submit]");
  const cancelButton = panel.querySelector("[data-calendar-cancel]");
  const newButton = panel.querySelector("[data-calendar-new]");
  const usherSelect = panel.querySelector("[data-usher-select]");
  const areaSelect = panel.querySelector("[data-area-select]");
  const employeeSelect = panel.querySelector("[data-employee-select]");
  const classificationSelect = panel.querySelector("[data-activity-classification-select]");
  const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  let activeDate = new Date();
  let records = [];

  const saveRecords = async () => saveSystemCollection(moduleKey, "records", records);
  const canEdit = () => hasPermission("calendar.manage");
  const createId = () => {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `calendar-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };
  const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
  const setMessage = (text, type = "") => {
    if (!message) return;
    message.textContent = text;
    message.className = `form-message ${type}`.trim();
  };
  const monthValue = () => `${activeDate.getFullYear()}-${String(activeDate.getMonth() + 1).padStart(2, "0")}`;
  const moduleTitle = () => {
    if (isMaintenance) return "Calendario de Obras";
    if (isUshers) return "Calendario de Ujieres";
    return "Calendario de Eventos del Museo";
  };

  const populateUshers = () => {
    if (!usherSelect) return;
    const ushers = getEmployeeRecords().filter((employee) => employee.posicion === "Ujier" && employee.estado !== "Inactivo");
    const options = ushers.map((employee) => {
      const name = employeeDisplayName(employee);
      return `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
    }).join("");
    usherSelect.innerHTML = `<option value="">Seleccione un ujier...</option>${options}`;
  };

  const populateAreas = () => {
    if (!areaSelect) return;
    const options = officialMuseumAreas.map((area) => `<option value="${escapeHtml(area)}">${escapeHtml(area)}</option>`).join("");
    areaSelect.innerHTML = `<option value="">Seleccione un área...</option>${options}`;
  };

  const populateEmployees = () => {
    if (!employeeSelect) return;
    const employees = getEmployeeRecords().filter((employee) => employee.estado !== "Inactivo");
    const options = employees.map((employee) => {
      const name = employeeDisplayName(employee);
      return `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
    }).join("");
    employeeSelect.innerHTML = `<option value="">Seleccione un empleado...</option>${options}`;
  };

  const populateClassifications = () => {
    if (!classificationSelect) return;
    const options = officialActivityClassifications.map((classification) => `<option value="${escapeHtml(classification)}">${escapeHtml(classification)}</option>`).join("");
    classificationSelect.innerHTML = `<option value="">Seleccione una clasificación...</option>${options}`;
  };

  const describeRecord = (record) => {
    if (isMaintenance) {
      return `Empleado: ${record.empleado}\nTarea: ${record.tarea}\nÁrea: ${record.area || "Sin área"}\nEstado: ${record.estado || "Pendiente"}\nFecha: ${record.fecha}`;
    }
    if (isUshers) {
      return `Ujier: ${record.ujier}\nHorario: ${record.horario}\nÁrea: ${record.area}\nFecha: ${record.fecha}`;
    }
    return `Evento: ${record.titulo}\nClasificación: ${record.clasificacion || "Sin clasificación"}\nÁrea: ${record.area || "Sin área"}\nCreado por: ${record.empleado || "Sin empleado"}\nDescripción: ${record.descripcion || "Sin descripción"}\nFecha: ${record.fecha}`;
  };

  const setEditableState = () => {
    const allowed = canEdit();
    form.querySelectorAll("input, select, textarea, button").forEach((field) => {
      field.disabled = !allowed;
    });
    if (isGeneral) {
      form.hidden = true;
      if (newButton) newButton.hidden = !allowed;
    } else if (isUshers) {
      form.hidden = true;
      if (newButton) newButton.hidden = !allowed;
    } else {
      form.hidden = !allowed;
    }
    panel.classList.toggle("is-readonly", !allowed);
    renderCalendar();
  };

  const renderCalendar = () => {
    if (!grid) return;
    const year = activeDate.getFullYear();
    const month = activeDate.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const currentMonth = monthValue();
    if (title) title.textContent = `${moduleTitle()} - ${monthNames[month]} ${year}`;

    const emptyCells = Array.from({ length: firstDay }, () => `<div class="calendar-day is-empty"></div>`).join("");
    const dayCells = Array.from({ length: days }, (_, index) => {
      const day = index + 1;
      const date = `${currentMonth}-${String(day).padStart(2, "0")}`;
      const dayRecords = records.filter((record) => record.fecha === date);
      const items = dayRecords.map((record) => {
        const body = isMaintenance
          ? `<strong>${escapeHtml(record.empleado)}</strong><span>${escapeHtml(record.tarea)}</span><small>${escapeHtml(record.area || "Sin área")} · ${escapeHtml(record.estado || "Pendiente")}</small>`
          : isUshers
            ? `<strong>${escapeHtml(record.ujier)}</strong><span>${escapeHtml(record.horario)}</span><small>${escapeHtml(record.area)}</small>`
            : `<strong>${escapeHtml(record.titulo)}</strong><span>${escapeHtml(record.clasificacion || "Sin clasificación")}</span><small>${escapeHtml(record.area || "Sin área")}</small>`;
        const theme = isGeneral ? activityClassificationThemes[record.clasificacion] || "theme-slate" : "";
        const actions = canEdit()
          ? `<div class="calendar-item-actions"><button type="button" data-calendar-edit="${record.id}">Editar</button><button type="button" data-calendar-delete="${record.id}">Eliminar</button></div>`
          : "";
        return `<article class="calendar-item ${theme}" data-calendar-view="${record.id}">${body}${actions}</article>`;
      }).join("");

      return `
        <div class="calendar-day" data-calendar-date="${date}">
          <div class="calendar-day-number">${day}</div>
          ${items}
        </div>
      `;
    }).join("");

    grid.innerHTML = `
      <div class="calendar-weekdays">
        <span>Dom</span><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span>
      </div>
      <div class="calendar-days">${emptyCells}${dayCells}</div>
    `;
  };

  const resetForm = () => {
    form.reset();
    form.elements.id.value = "";
    if (submitButton) submitButton.textContent = isMaintenance ? "Guardar Tarea" : isUshers ? "Guardar Asignación" : "Guardar Evento";
    if (cancelButton) cancelButton.hidden = true;
    if (isGeneral || isUshers) form.hidden = true;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canEdit()) {
      setMessage("Este rol no tiene permiso para editar el calendario.", "error");
      return;
    }

    const data = new FormData(form);
    const id = data.get("id");
    const record = isMaintenance
      ? {
          id: id || createId(),
          fecha: data.get("fecha"),
          empleado: data.get("empleado").trim(),
          tarea: data.get("tarea").trim(),
          area: data.get("area").trim(),
          estado: data.get("estado")
        }
      : isUshers
        ? {
            id: id || createId(),
            fecha: data.get("fecha"),
            ujier: data.get("ujier"),
            horario: data.get("horario").trim(),
            area: data.get("area")
          }
        : {
            id: id || createId(),
            fecha: data.get("fecha"),
            empleado: data.get("empleado"),
            titulo: data.get("titulo").trim(),
            clasificacion: data.get("clasificacion"),
            area: data.get("area"),
            descripcion: data.get("descripcion").trim()
          };

    const isInvalid = isMaintenance
      ? !record.fecha || !record.empleado || !record.tarea
      : isUshers
        ? !record.fecha || !record.ujier || !record.horario || !record.area
        : !record.fecha || !record.empleado || !record.titulo || !record.clasificacion || !record.area;
    if (isInvalid) {
      setMessage("Complete los campos requeridos antes de guardar.", "error");
      return;
    }

    const nextRecords = id ? records.map((item) => item.id === id ? record : item) : [...records, record];
    const previousRecords = records;
    try {
      records = nextRecords;
      await saveRecords();
      activeDate = new Date(`${record.fecha}T12:00:00`);
      resetForm();
      setMessage(id ? "Registro actualizado en Supabase." : "Registro guardado en Supabase.", "success");
      renderCalendar();
    } catch (error) {
      records = previousRecords;
      setMessage(`No se pudo guardar en Supabase: ${error.message}`, "error");
    }
  });

  panel.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-calendar-edit]");
    const deleteButton = event.target.closest("[data-calendar-delete]");
    const viewItem = event.target.closest("[data-calendar-view]");
    const dayCell = event.target.closest("[data-calendar-date]");

    if (viewItem && !editButton && !deleteButton) {
      const record = records.find((item) => item.id === viewItem.dataset.calendarView);
      if (record) alert(describeRecord(record));
      return;
    }

    if (dayCell && canEdit()) {
      form.elements.fecha.value = dayCell.dataset.calendarDate;
      if ((isGeneral || isUshers) && !form.hidden) form.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (editButton) {
      if (!canEdit()) return;
      const record = records.find((item) => item.id === editButton.dataset.calendarEdit);
      if (!record) return;
      if (isGeneral || isUshers) form.hidden = false;
      Object.entries(record).forEach(([key, value]) => {
        const field = form.elements[key];
        if (field) field.value = value;
      });
      if (submitButton) submitButton.textContent = isMaintenance ? "Actualizar Tarea" : isUshers ? "Actualizar Asignación" : "Actualizar Evento";
      if (cancelButton) cancelButton.hidden = false;
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    }

  });

  panel.querySelector("[data-calendar-prev]")?.addEventListener("click", () => {
    activeDate = new Date(activeDate.getFullYear(), activeDate.getMonth() - 1, 1);
    renderCalendar();
  });
  panel.querySelector("[data-calendar-next]")?.addEventListener("click", () => {
    activeDate = new Date(activeDate.getFullYear(), activeDate.getMonth() + 1, 1);
    renderCalendar();
  });
  newButton?.addEventListener("click", () => {
    if (!canEdit()) {
      form.hidden = true;
      setMessage(isUshers ? "Solo Ejecutivos y Administradores pueden crear entradas." : "Solo Ejecutivos y Administradores pueden crear eventos.", "error");
      return;
    }
    form.hidden = false;
    setMessage("");
    if (!form.elements.fecha.value) form.elements.fecha.value = new Date().toISOString().slice(0, 10);
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  cancelButton?.addEventListener("click", () => {
    resetForm();
    setMessage("");
  });
  const loadCalendarRecords = async () => {
    try {
      records = await fetchSystemCollection(moduleKey, "records", []);
      setMessage("Calendario cargado desde Supabase.", "success");
    } catch (error) {
      setMessage(`No se pudo cargar este calendario desde Supabase: ${error.message}`, "error");
    }
    populateUshers();
    populateAreas();
    populateEmployees();
    populateClassifications();
    setEditableState();
  };

  loadCalendarRecords();
}

function renderInlineIcons() {
  document.querySelectorAll("[data-icon]").forEach((element) => {
    element.innerHTML = iconSvg(element.dataset.icon);
  });
}

function safeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function bindMaterialsRequestModule() {
  const module = document.querySelector("[data-materials-module]");
  if (!module) return;

  const form = module.querySelector("[data-materials-form]");
  const orderNumber = module.querySelector("[data-material-order-number]");
  const orderDate = module.querySelector("[data-material-order-date]");
  const message = module.querySelector("[data-materials-message]");
  const log = document.querySelector("[data-materials-log]");
  let requests = [];

  const today = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };
  const displayDate = (date) => {
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
  };
  const nextSequence = () => requests.reduce((highest, request) => Math.max(highest, Number(request.sequence || 0)), 0) + 1;
  const formatOrder = (sequence) => `Pedido ${String(sequence).padStart(5, "0")}`;
  const saveRequests = async () => saveSystemCollection("solicitud_materiales", "requests", requests);
  const setMessage = (text, type = "") => {
    if (!message) return;
    message.textContent = text;
    message.className = `form-message ${type}`.trim();
  };
  const friendlyMaterialsError = (error, action = "procesar") => {
    const text = String(error?.message || "");
    if (text.includes("Mi cuenta")) return text;
    if (text.includes("Administración")) return text;
    return `No se pudo ${action} la solicitud en este momento. Avise a Administración.`;
  };
  const refreshMeta = () => {
    if (orderNumber) orderNumber.textContent = formatOrder(nextSequence());
    if (orderDate) orderDate.textContent = displayDate(today());
  };
  const renderLog = () => {
    if (!log) return;
    if (!requests.length) {
      log.innerHTML = '<p class="empty-state">Todavía no hay solicitudes registradas.</p>';
      return;
    }

    log.innerHTML = requests.slice().reverse().map((request) => `
      <article class="request-log-item">
        <div>
          <strong>${safeHtml(request.order)}</strong>
          <span>${safeHtml(displayDate(request.date))}</span>
        </div>
        <p><strong>Empleado:</strong> ${safeHtml(request.employee)}</p>
        <p><strong>Materiales:</strong> ${safeHtml(request.materials.join(", "))}</p>
        ${request.other ? `<p><strong>Otros:</strong> ${safeHtml(request.other)}</p>` : ""}
      </article>
    `).join("");
  };

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!getSupabaseSession()?.access_token) {
      setMessage("Para enviar una solicitud de materiales, primero entre por Mi cuenta.", "error");
      return;
    }
    const data = new FormData(form);
    const employee = String(data.get("empleado") || "").trim();
    const materials = data.getAll("materiales").map((item) => String(item).trim()).filter(Boolean);
    const other = String(data.get("otros") || "").trim();

    if (!employee) {
      setMessage("Seleccione el empleado que está haciendo la solicitud.", "error");
      return;
    }
    if (!materials.length && !other) {
      setMessage("Seleccione al menos un material o escriba una necesidad en Otros.", "error");
      return;
    }

    const sequence = nextSequence();
    const request = {
      id: `material-${Date.now()}`,
      sequence,
      order: formatOrder(sequence),
      date: today(),
      employee,
      materials,
      other
    };

    try {
      const previousRequests = requests;
      requests = [...requests, request];
      try {
        await saveRequests();
      } catch (error) {
        requests = previousRequests;
        throw error;
      }
      form.reset();
      refreshMeta();
      renderLog();
      setMessage(`${request.order} enviado correctamente.`, "success");
    } catch (error) {
      setMessage(friendlyMaterialsError(error, "enviar"), "error");
    }
  });

  const loadMaterialRequests = async () => {
    try {
      requests = await fetchSystemCollection("solicitud_materiales", "requests", []);
      setMessage("Solicitudes cargadas correctamente.", "success");
    } catch (error) {
      setMessage(friendlyMaterialsError(error, "cargar"), "error");
    }
    refreshMeta();
    renderLog();
  };

  loadMaterialRequests();
}

function bindAttendanceScheduleAdmin(module, employeeMap) {
  const region = module.querySelector("[data-schedule-admin]");
  if (!region || (!hasPermission("time.read.all") && !hasPermission("schedules.manage"))) return;
  region.hidden = false;
  const form = region.querySelector("[data-schedule-rule-form]");
  const exceptionForm = region.querySelector("[data-schedule-exception-form]");
  const list = region.querySelector("[data-schedule-rule-list]");
  const upcomingList = region.querySelector("[data-schedule-upcoming-list]");
  const message = region.querySelector("[data-schedule-message]");
  const canManage = hasPermission("schedules.manage");
  form.hidden = !canManage; exceptionForm.hidden = !canManage;
  const employeeOptions = '<option value="">Seleccione un empleado</option>' + [...employeeMap.values()].map((employee) => `<option value="${safeHtml(employee.id)}">${safeHtml(employeeDisplayName(employee))}</option>`).join("");
  form.elements.employeeId.innerHTML = employeeOptions; exceptionForm.elements.employeeId.innerHTML = employeeOptions;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Puerto_Rico" }).format(new Date());
  form.elements.effectiveFrom.value = today; exceptionForm.elements.exceptionDate.value = today;
  const dayNames = { 1: "Lun", 2: "Mar", 3: "Mie", 4: "Jue", 5: "Vie", 6: "Sab", 7: "Dom" };
  let activeRules = [];
  const showMessage = (text, type = "") => { message.textContent = text; message.className = `form-message ${type}`.trim(); };
  const resetEdit = () => { form.reset(); form.elements.effectiveFrom.value=today; form.elements.startsLocal.value="08:00"; form.elements.endsLocal.value="16:00"; form.elements.lunchMinutes.value="60"; form.elements.supersedesRuleId.value=""; region.querySelector("[data-schedule-submit]").textContent="Crear regla recurrente"; region.querySelector("[data-schedule-cancel-edit]").hidden=true; };
  const refreshRuleOptions = () => { const employeeId=exceptionForm.elements.employeeId.value; exceptionForm.elements.ruleId.innerHTML='<option value="">Seleccione una regla</option>'+activeRules.filter(r=>!employeeId||r.employee_id===employeeId).map(r=>`<option value="${safeHtml(r.id)}">${safeHtml((r.weekdays||[]).map(d=>dayNames[d]).join(", "))} · ${safeHtml(String(r.starts_local).slice(0,5))}-${safeHtml(String(r.ends_local).slice(0,5))}</option>`).join(""); };
  const load = async () => {
    try {
      const [rules, shifts] = await Promise.all([fetchSupabaseScheduleRules(), fetchSupabaseUpcomingShifts(30)]); activeRules=rules; refreshRuleOptions();
      list.innerHTML = rules.length ? rules.map((rule) => { const employee=employeeMap.get(rule.employee_id); const days=(rule.weekdays||[]).map(d=>dayNames[d]).join(", "); const until=rule.effective_until?` hasta ${rule.effective_until}`:" sin fecha final"; return `<article class="schedule-rule-item" data-rule-id="${safeHtml(rule.id)}"><div><strong>${safeHtml(employee?employeeDisplayName(employee):"Empleado")}</strong><span>${safeHtml(days)} · ${safeHtml(String(rule.starts_local).slice(0,5))}-${safeHtml(String(rule.ends_local).slice(0,5))}</span><small>Desde ${safeHtml(rule.effective_from)}${safeHtml(until)} · ${safeHtml(rule.shift_type)} · v${Number(rule.version_no||1)}</small></div>${canManage?`<div class="schedule-rule-actions"><button class="button secondary" type="button" data-edit-rule="${safeHtml(rule.id)}">Editar</button><button class="button secondary" type="button" data-deactivate-rule="${safeHtml(rule.id)}">Desactivar</button></div>`:'<span class="attendance-status is-complete">Activa</span>'}</article>`; }).join(""):'<p>No hay reglas recurrentes configuradas.</p>';
      upcomingList.innerHTML=shifts.length?shifts.map(shift=>{const employee=employeeMap.get(shift.employee_id);return `<article class="schedule-upcoming-item"><strong>${safeHtml(employee?employeeDisplayName(employee):"Empleado")}</strong><span>${formatPortalDate(shift.starts_at,{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})} - ${formatPortalDate(shift.ends_at,{hour:"numeric",minute:"2-digit"})}</span><small>${safeHtml(shift.shift_type)}</small></article>`;}).join(""):'<p>No hay turnos futuros.</p>';
    } catch(error){showMessage(providerNeutralMessage(error,"No se pudo cargar la programacion."),"error");}
  };
  exceptionForm.elements.employeeId.addEventListener("change",refreshRuleOptions);
  exceptionForm.elements.exceptionType.addEventListener("change",()=>{const needsTime=exceptionForm.elements.exceptionType.value!=="cancelled";exceptionForm.elements.startsLocal.required=needsTime;exceptionForm.elements.endsLocal.required=needsTime;});
  region.querySelector("[data-schedule-cancel-edit]").addEventListener("click",resetEdit);
  list.addEventListener("click",async(event)=>{const edit=event.target.closest("[data-edit-rule]");const deactivate=event.target.closest("[data-deactivate-rule]");if(edit){const rule=activeRules.find(r=>r.id===edit.dataset.editRule);if(!rule)return;form.elements.employeeId.value=rule.employee_id;form.elements.employeeId.disabled=true;form.elements.startsLocal.value=String(rule.starts_local).slice(0,5);form.elements.endsLocal.value=String(rule.ends_local).slice(0,5);form.elements.lunchMinutes.value=rule.expected_lunch_minutes??"";form.elements.effectiveFrom.value=rule.effective_from;form.elements.effectiveUntil.value=rule.effective_until||"";form.elements.shiftType.value=rule.shift_type;form.elements.supersedesRuleId.value=rule.id;form.querySelectorAll('[name="weekday"]').forEach(box=>box.checked=(rule.weekdays||[]).includes(Number(box.value)));region.querySelector("[data-schedule-submit]").textContent="Guardar nueva version";region.querySelector("[data-schedule-cancel-edit]").hidden=false;form.scrollIntoView({behavior:"smooth",block:"center"});}if(deactivate){const reason=window.prompt("Motivo para desactivar esta regla:");if(!reason)return;try{await deactivateSupabaseScheduleRule(deactivate.dataset.deactivateRule,reason);showMessage("Regla desactivada. Los turnos historicos se conservaron.","success");await load();}catch(error){showMessage(error.message||"No se pudo desactivar.","error");}}});
  form.addEventListener("submit",async(event)=>{event.preventDefault();const data=new FormData(form);const weekdays=data.getAll("weekday").map(Number);if(!weekdays.length){showMessage("Seleccione al menos un dia.","error");return;}const button=region.querySelector("[data-schedule-submit]");button.disabled=true;try{const employeeId=form.elements.employeeId.value;const result=await createSupabaseScheduleRule({employee_id:employeeId,weekdays,starts_local:data.get("startsLocal"),ends_local:data.get("endsLocal"),expected_lunch_minutes:data.get("lunchMinutes"),effective_from:data.get("effectiveFrom"),effective_until:data.get("effectiveUntil"),shift_type:data.get("shiftType"),timezone:"America/Puerto_Rico",supersedes_rule_id:data.get("supersedesRuleId")});showMessage(`Regla guardada. ${Number(result.generated_shifts||0)} turnos nuevos.`,"success");form.elements.employeeId.disabled=false;resetEdit();await load();}catch(error){showMessage(error.message||"No se pudo guardar la regla.","error");}finally{button.disabled=false;}});
  exceptionForm.addEventListener("submit",async(event)=>{event.preventDefault();const data=new FormData(exceptionForm);const button=exceptionForm.querySelector('button[type="submit"]');button.disabled=true;try{await createSupabaseScheduleException({employee_id:data.get("employeeId"),rule_id:data.get("ruleId"),exception_date:data.get("exceptionDate"),exception_type:data.get("exceptionType"),starts_local:data.get("startsLocal"),ends_local:data.get("endsLocal"),shift_type:"regular",reason:data.get("reason")});showMessage("Excepcion guardada sin eliminar historial.","success");exceptionForm.reset();exceptionForm.elements.exceptionDate.value=today;await load();}catch(error){showMessage(error.message||"No se pudo guardar la excepcion.","error");}finally{button.disabled=false;}});
  load();
}

function providerNeutralMessage(error, fallback) {
  return String(error?.message || fallback || "No se pudo completar la operación.")
    .replace(/Supabase Authentication/gi, "el servicio de identidad")
    .replace(/Supabase/gi, "el servicio");
}

function bindAttendanceCorrectionReview(module, employeeMap) {
  const region = module.querySelector("[data-attendance-corrections]");
  if (!region || !hasPermission("attendance.corrections.approve")) return;
  region.hidden = false;
  const list = region.querySelector("[data-attendance-correction-list]");
  const message = region.querySelector("[data-attendance-correction-message]");
  const refreshButton = region.querySelector("[data-corrections-refresh]");
  const labels = { clock_in: "Entrada", lunch_out: "Salida a almuerzo", lunch_in: "Regreso de almuerzo", clock_out: "Salida final" };
  const setMessage = (text, type = "") => { message.textContent = text; message.className = `form-message ${type}`.trim(); };
  const load = async () => {
    refreshButton.disabled = true;
    try {
      const requests = await fetchSupabasePendingCorrections();
      list.innerHTML = requests.length ? requests.map((request) => {
        const employee = employeeMap.get(request.employee_id);
        return `<article class="attendance-correction-item" data-correction-id="${safeHtml(request.id)}"><div><strong>${safeHtml(employee ? employeeDisplayName(employee) : "Empleado")}</strong><span>${safeHtml(labels[request.requested_event_type] || request.requested_event_type)} · ${formatPortalDate(request.requested_occurred_at, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span><small>${safeHtml(request.reason)}</small><small>Solicitada ${formatPortalDate(request.requested_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</small></div><div class="attendance-correction-actions"><button class="button" type="button" data-correction-decision="approved">Aprobar</button><button class="button secondary" type="button" data-correction-decision="rejected">Rechazar</button></div></article>`;
      }).join("") : "<p>No hay solicitudes pendientes.</p>";
      setMessage(requests.length ? `${requests.length} solicitud${requests.length === 1 ? "" : "es"} pendiente${requests.length === 1 ? "" : "s"}.` : "Bandeja al dia.", "success");
    } catch (error) { setMessage(providerNeutralMessage(error, "No se pudieron cargar las solicitudes."), "error"); }
    finally { refreshButton.disabled = false; }
  };
  list.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-correction-decision]");
    if (!button) return;
    const requestId = button.closest("[data-correction-id]")?.dataset.correctionId;
    const decision = button.dataset.correctionDecision;
    const reason = window.prompt(decision === "approved" ? "Motivo de aprobacion:" : "Motivo del rechazo:");
    if (!requestId || !reason) return;
    button.disabled = true;
    try {
      await decideSupabaseAttendanceCorrection(requestId, decision, reason);
      setMessage(decision === "approved" ? "Correccion aprobada y registrada sin alterar el original." : "Solicitud rechazada y conservada en el historial.", "success");
      await load();
    } catch (error) { setMessage(providerNeutralMessage(error, "No se pudo registrar la decision."), "error"); }
    finally { button.disabled = false; }
  });
  refreshButton.addEventListener("click", load);
  load();
}

function bindHrAttendanceView() {
  const module = document.querySelector("[data-attendance-module]");
  if (!module || !hasPermission("time.read.all")) return;
  module.hidden = true;
  const directorySection = document.querySelector("[data-employee-directory-section]");
  const directory = document.querySelector("[data-employee-directory]");
  const createButton = document.querySelector("[data-employee-create]");
  const closeButton = module.querySelector("[data-attendance-close]");
  const form = module.querySelector("[data-attendance-filters]");
  const employeeSelect = module.querySelector("[data-attendance-employee]");
  const summary = module.querySelector("[data-attendance-summary]");
  const body = module.querySelector("[data-attendance-body]");
  const message = module.querySelector("[data-attendance-message]");
  const refreshButton = module.querySelector("[data-attendance-refresh]");
  const employeeMap = new Map(getEmployeeRecords().map((employee) => [employee.id, employee]));
  bindAttendanceScheduleAdmin(module, employeeMap);
  bindAttendanceCorrectionReview(module, employeeMap);
  const today = new Date();
  const localDate = (date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Puerto_Rico" }).format(date);
  form.elements.to.value = localDate(today);
  form.elements.from.value = localDate(new Date(today.getFullYear(), today.getMonth(), 1));
  employeeSelect.innerHTML = '<option value="">Todos los empleados</option>' + getEmployeeRecords().map((employee) => `<option value="${safeHtml(employee.id)}">${safeHtml(employeeDisplayName(employee))}</option>`).join("");

  const formatTime = (value) => value ? formatPortalDate(value, { hour: "numeric", minute: "2-digit" }) : "Pendiente";
  const formatDate = (value) => formatPortalDate(value, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  const durationHours = (entry) => entry.clock_out ? Math.max(0, (new Date(entry.clock_out) - new Date(entry.clock_in)) / 3600000) : 0;
  const setMessage = (text, type = "") => { message.textContent = text; message.className = `form-message ${type}`.trim(); };

  const render = (entries) => {
    const completed = entries.filter((entry) => entry.clock_out);
    const open = entries.length - completed.length;
    const totalHours = completed.reduce((total, entry) => total + durationHours(entry), 0);
    const employees = new Set(entries.map((entry) => entry.employee_id)).size;
    summary.innerHTML = [
      ["Registros", entries.length],
      ["Empleados con actividad", employees],
      ["Horas completadas", totalHours.toLocaleString("es-PR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
      ["Ponches abiertos", open]
    ].map(([label, value]) => `<article><span>${label}</span><strong>${value}</strong></article>`).join("");
    if (!entries.length) {
      body.innerHTML = '<tr><td colspan="6">No hay registros para los filtros seleccionados.</td></tr>';
      return;
    }
    body.innerHTML = entries.map((entry) => {
      const employee = employeeMap.get(entry.employee_id);
      const name = employee ? employeeDisplayName(employee) : "Empleado no disponible";
      const duration = entry.clock_out ? `${durationHours(entry).toLocaleString("es-PR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h` : "En curso";
      return `<tr><td><strong>${safeHtml(name)}</strong></td><td>${formatDate(entry.clock_in)}</td><td>${formatTime(entry.clock_in)}</td><td>${formatTime(entry.clock_out)}</td><td>${duration}</td><td><span class="attendance-status ${entry.clock_out ? "is-complete" : "is-open"}">${entry.clock_out ? "Completado" : "Activo"}</span></td></tr>`;
    }).join("");
  };

  const load = async () => {
    const data = new FormData(form);
    const from = String(data.get("from") || "");
    const to = String(data.get("to") || "");
    if (from && to && from > to) { setMessage("La fecha inicial no puede ser posterior a la fecha final.", "error"); return; }
    setMessage("CONSULTANDO ASISTENCIA...");
    refreshButton.disabled = true;
    try {
      const entries = await fetchSupabaseAttendance({ from, to, employeeId: String(data.get("employeeId") || "") });
      render(entries);
      setMessage("ASISTENCIA ACTUALIZADA.", "success");
    } catch (error) {
      body.innerHTML = '<tr><td colspan="6">No se pudo cargar la asistencia.</td></tr>';
      setMessage(providerNeutralMessage(error, "No se pudo consultar la asistencia."), "error");
    } finally { refreshButton.disabled = false; }
  };
  form.addEventListener("submit", (event) => { event.preventDefault(); load(); });
  refreshButton.addEventListener("click", load);
  directory?.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-open-attendance]");
    if (!trigger) return;
    const employeeId = trigger.dataset.openAttendance;
    directorySection.hidden = true;
    if (createButton) createButton.hidden = true;
    module.hidden = false;
    employeeSelect.value = employeeId;
    module.querySelectorAll('[name="employeeId"]').forEach((select) => { if ([...select.options].some((option) => option.value === employeeId)) select.value = employeeId; });
    load();
    module.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  closeButton?.addEventListener("click", () => {
    module.hidden = true;
    directorySection.hidden = false;
    if (createButton) createButton.hidden = false;
    directorySection.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function bindHumanResourcesModule() {
  const module = document.querySelector("[data-hr-module]");
  if (!module) return;

  const directory = module.querySelector("[data-employee-directory]");
  const form = module.querySelector("[data-employee-form]");
  const createButton = module.querySelector("[data-employee-create]");
  const submitButton = module.querySelector("[data-employee-submit]");
  const cancelButton = module.querySelector("[data-employee-cancel]");
  const closeButton = module.querySelector("[data-employee-close]");
  const message = module.querySelector("[data-employee-message]");
  const photoInput = module.querySelector("[data-employee-photo-picker]");
  const photoTrigger = module.querySelector("[data-employee-photo-trigger]");
  const photoStatus = module.querySelector("[data-employee-photo-status]");
  let selectedPhoto = "";
  let supabaseProfile = null;
  const canReadSensitiveEmployeeData = () => hasPermission("compensation.read") && hasPermission("emergency_contact.read");
  const canManageSensitiveEmployeeData = () => hasPermission("compensation.manage") && hasPermission("emergency_contact.manage");
  module.querySelectorAll("[data-compensation-section], [data-emergency-section]").forEach((section) => { section.hidden = !canReadSensitiveEmployeeData(); });

  const updateMonthlyEquivalent = () => {
    const rate = Number(form.elements.hourlyRate?.value || 0), hours = Number(form.elements.standardHoursWeek?.value || 0), salary = Number(form.elements.salaryAmount?.value || 0), period = form.elements.salaryPeriod?.value;
    const factors = { weekly: 52 / 12, biweekly: 26 / 12, semimonthly: 2, monthly: 1, annual: 1 / 12 };
    const value = form.elements.compensationType?.value === "hourly" ? rate * hours * 52 / 12 : salary * (factors[period] || 0);
    if (form.elements.monthlyEquivalent) form.elements.monthlyEquivalent.value = value ? value.toLocaleString("es-PR", { style: "currency", currency: "USD" }) : "";
  };
  ["compensationType","hourlyRate","standardHoursWeek","salaryAmount","salaryPeriod"].forEach((name) => form.elements[name]?.addEventListener("input", updateMonthlyEquivalent));

  const sensitiveEmployeePayload = (data) => ({
    compensation: { compensation_type:data.get("compensationType"),hourly_rate:data.get("hourlyRate"),salary_amount:data.get("salaryAmount"),salary_period:data.get("salaryPeriod"),pay_frequency:data.get("payFrequency"),standard_hours_week:data.get("standardHoursWeek"),overtime_eligible:data.get("overtimeEligible"),bonus_type:data.get("bonusType"),bonus_amount:data.get("bonusAmount"),bonus_percent:data.get("bonusPercent"),other_description:data.get("compensationOther"),effective_from:data.get("compensationEffectiveFrom") },
    emergencyContact: { full_name:data.get("emergencyName"),relationship:data.get("emergencyRelationship"),primary_phone:data.get("emergencyPrimaryPhone"),alternate_phone:data.get("emergencyAlternatePhone"),email:data.get("emergencyEmail"),notes:data.get("emergencyNotes") }
  });

  const loadSensitiveEmployeeData = async (employeeId) => {
    if (!canReadSensitiveEmployeeData() || !employeeId) return;
    const { compensation:c, emergencyContact:e } = await fetchSupabaseEmployeeSensitiveDetails(employeeId);
    const values={compensationType:c?.compensation_type||"unconfigured",hourlyRate:c?.hourly_rate??"",salaryAmount:c?.salary_amount??"",salaryPeriod:c?.salary_period||"",payFrequency:c?.pay_frequency||"",standardHoursWeek:c?.standard_hours_week??"",overtimeEligible:String(c?.overtime_eligible??true),bonusType:c?.bonus_type||"none",bonusAmount:c?.bonus_amount??"",bonusPercent:c?.bonus_percent??"",compensationOther:c?.other_description||"",compensationEffectiveFrom:c?.effective_from||"",emergencyName:e?.full_name||"",emergencyRelationship:e?.relationship||"",emergencyPrimaryPhone:e?.primary_phone||"",emergencyAlternatePhone:e?.alternate_phone||"",emergencyEmail:e?.email||"",emergencyNotes:e?.notes||""};
    Object.entries(values).forEach(([name,value])=>{if(form.elements[name])form.elements[name].value=value;}); updateMonthlyEquivalent();
  };

  const setMessage = (text, type = "") => {
    if (!message) return;
    message.textContent = text;
    message.className = `form-message ${type}`.trim();
  };

  const renderPhoto = (employee) => {
    if (employee.foto) {
      return `<img class="employee-row-photo" src="${employee.foto}" alt="Foto de ${safeHtml(employeeDisplayName(employee))}">`;
    }
    return `<span class="employee-avatar">${safeHtml(employeeInitials(employee))}</span>`;
  };

  const renderDirectory = () => {
    const records = getEmployeeRecords();
    if (!records.length) {
      directory.innerHTML = `
        <p class="employee-directory-empty">
          No hay empleados registrados para mostrar.
        </p>
      `;
      return;
    }
    directory.innerHTML = records.map((employee) => {
      const isInactive = employee.estado === "Inactivo";
      const profileLink = canManageEmployees()
        ? `<a href="perfil-empleado.html?empleado=${encodeURIComponent(employee.id)}">Ver Perfil</a>`
        : "";
      const attendanceAction = hasPermission("time.read.all") ? `<button type="button" data-open-attendance="${employee.id}">Registro de asistencia</button>` : "";
      const adminActions = canManageEmployees()
        ? `
          <button type="button" data-employee-edit="${employee.id}">Editar</button>
          <button type="button" data-employee-reset="${employee.id}" hidden aria-hidden="true">Restablecer contraseña</button>
          <button type="button" data-employee-toggle="${employee.id}">${isInactive ? "Activar" : "Desactivar"}</button>
        `
        : "";

      return `
        <article class="employee-row${isInactive ? " is-inactive" : ""}">
          ${renderPhoto(employee)}
          <span class="employee-info">
            <strong>${safeHtml(employeeDisplayName(employee))}</strong>
            <span>${safeHtml(employee.posicion)} · ${safeHtml(employee.departamento || "Sin departamento")} · ${safeHtml(employee.estado || "Activo")}</span>
          </span>
          <span class="employee-actions">
            ${profileLink}
            ${attendanceAction}
            ${adminActions}
          </span>
        </article>
      `;
    }).join("");
  };

  const syncDirectoryFromSupabase = async () => {
    const session = getSupabaseSession();
    if (!session?.access_token) {
      setMessage("DIRECTORIO EN MODO LOCAL. ENTRE A SU CUENTA PARA SINCRONIZAR.");
      return;
    }

    try {
      setMessage("SINCRONIZANDO DIRECTORIO DE EMPLEADOS...");
      supabaseProfile = await fetchSupabaseProfile();
      const records = await fetchSupabaseEmployees();
      saveEmployeeRecords(records);
      renderDirectory();
      setMessage(
        records.length
          ? `DIRECTORIO SINCRONIZADO. ${records.length} EMPLEADO${records.length === 1 ? "" : "S"}.`
          : "DIRECTORIO CONECTADO. AUN NO HAY EMPLEADOS REGISTRADOS.",
        "success"
      );
    } catch (error) {
      saveEmployeeRecords([]);
      renderDirectory();
      setMessage("NO SE PUDO SINCRONIZAR EL DIRECTORIO. NO SE MOSTRARAN EMPLEADOS DE EJEMPLO.", "error");
    }
  };

  const resetForm = () => {
    form.reset();
    form.elements.id.value = "";
    selectedPhoto = "";
    if (photoInput) photoInput.value = "";
    if (photoStatus) photoStatus.textContent = "Ninguna fotografía seleccionada.";
    if (submitButton) submitButton.textContent = "Crear Empleado";
    if (cancelButton) cancelButton.hidden = true;
    updateMonthlyEquivalent();
  };

  const showForm = () => {
    form.hidden = false;
    if (createButton) {
      createButton.hidden = true;
      createButton.setAttribute("aria-expanded", "true");
    }
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const hideForm = () => {
    form.hidden = true;
    if (createButton) {
      createButton.hidden = !canManageEmployees();
      createButton.setAttribute("aria-expanded", "false");
    }
  };

  const loadForm = async (employee) => {
    showForm();
    Object.entries(employee).forEach(([key, value]) => {
      const field = form.elements[key];
      if (field && key !== "foto") field.value = value || "";
    });
    form.elements.id.value = employee.id;
    selectedPhoto = employee.foto || "";
    if (photoStatus) photoStatus.textContent = selectedPhoto ? "Fotografía existente cargada." : "Ninguna fotografía seleccionada.";
    if (submitButton) submitButton.textContent = "Actualizar Empleado";
    if (cancelButton) cancelButton.hidden = false;
    await loadSensitiveEmployeeData(employee.id).catch(() => setMessage("No se pudieron cargar los datos sensibles del empleado.", "error"));
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  form.hidden = true;
  if (createButton) createButton.hidden = !canManageEmployees();

  createButton?.addEventListener("click", () => {
    resetForm();
    setMessage("");
    showForm();
  });

  photoTrigger?.addEventListener("click", () => {
    photoInput?.click();
  });

  if (photoInput) {
    photoInput.addEventListener("change", () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setMessage("Seleccione un archivo de imagen válido.", "error");
        photoInput.value = "";
        return;
      }
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        selectedPhoto = reader.result;
        if (photoStatus) photoStatus.textContent = `Fotografía seleccionada: ${file.name}`;
        setMessage("Fotografía lista para guardar con el empleado.", "success");
      });
      reader.readAsDataURL(file);
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canManageEmployees()) {
      setMessage("Su rol no tiene permiso para crear o editar empleados.", "error");
      return;
    }

    const data = new FormData(form);
    const id = data.get("id") || buildEmployeeId(data.get("nombre"), data.get("apellidos"));
    const existing = getEmployeeRecords().find((employee) => employee.id === id);
    const employee = {
      id,
      avatar: existing?.avatar || employeeInitials({ nombre: data.get("nombre"), apellidos: data.get("apellidos") }),
      nombre: data.get("nombre").trim(),
      apellidos: data.get("apellidos").trim(),
      nombreCompleto: `${data.get("nombre").trim()} ${data.get("apellidos").trim()}`,
      foto: selectedPhoto || existing?.foto || "",
      posicion: data.get("posicion").trim(),
      departamento: data.get("departamento").trim(),
      correo: data.get("correo").trim(),
      telefono: data.get("telefono").trim(),
      direccion: data.get("direccion").trim(),
      fechaContratacion: data.get("fechaContratacion"),
      horario: data.get("horario").trim(),
      educacion: data.get("educacion"),
      condicion: data.get("condicion").trim(),
      acceso: data.get("acceso"),
      estado: data.get("estado"),
      notificaciones: data.get("notificaciones").trim()
    };

    if (!employee.nombre || !employee.apellidos || !employee.posicion || !employee.departamento || !employee.correo) {
      setMessage("Complete los campos obligatorios antes de crear el empleado.", "error");
      return;
    }

    const records = getEmployeeRecords();
    const nextRecords = existing
      ? records.map((item) => item.id === id ? employee : item)
      : [...records, employee];

    const session = getSupabaseSession();
    if (session?.access_token) {
      try {
        if (!supabaseProfile) supabaseProfile = await fetchSupabaseProfile();
        if (!supabaseProfile?.museum_id) throw new Error("No se encontró el museo asociado al perfil.");
        const savedEmployee = await saveSupabaseEmployee(employee, supabaseProfile.museum_id, id);
        const savedEmployeeId = savedEmployee[0]?.id || id;
        if (canManageSensitiveEmployeeData()) { const sensitive = sensitiveEmployeePayload(data); await saveSupabaseEmployeeSensitiveDetails(savedEmployeeId, sensitive.compensation, sensitive.emergencyContact); }

        const syncedRecords = await fetchSupabaseEmployees();
        saveEmployeeRecords(syncedRecords);
        renderDirectory();
        resetForm();
        hideForm();
        setMessage(existing ? "EMPLEADO ACTUALIZADO." : "EMPLEADO CREADO Y AGREGADO AL DIRECTORIO.", "success");
        return;
      } catch (error) {
        setMessage(`${providerNeutralMessage(error, "No se pudo guardar el empleado.")} No se guardó una copia local para evitar datos distintos entre computadoras.`, "error");
        return;
      }
    }

    setMessage("ENTRE A SU CUENTA ANTES DE CREAR O EDITAR EMPLEADOS. NO SE GUARDO UNA COPIA LOCAL.", "error");
  });

  directory.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-employee-edit]");
    const resetButton = event.target.closest("[data-employee-reset]");
    const toggleButton = event.target.closest("[data-employee-toggle]");
    const records = getEmployeeRecords();

    if (editButton) {
      const employee = records.find((item) => item.id === editButton.dataset.employeeEdit);
      if (employee) await loadForm(employee);
    }

    if (resetButton) {
      const employee = records.find((item) => item.id === resetButton.dataset.employeeReset);
      if (!employee) return;
      setMessage("EL RESTABLECIMIENTO DE CONTRASEÑA DEBE HACERSE DESDE EL SERVICIO SEGURO DE IDENTIDAD.", "error");
    }

    if (toggleButton) {
      const employee = records.find((item) => item.id === toggleButton.dataset.employeeToggle);
      if (!employee) return;
      const estado = employee.estado === "Inactivo" ? "Activo" : "Inactivo";
      const session = getSupabaseSession();
      if (!session?.access_token || employee.source !== "supabase") {
        setMessage("ENTRE A SU CUENTA ANTES DE ACTIVAR O DESACTIVAR EMPLEADOS.", "error");
        return;
      }
      try {
        await updateSupabaseEmployeeStatus(employee.id, estado);

      } catch (error) {
        setMessage(providerNeutralMessage(error, "No se pudo actualizar el empleado."), "error");
        return;
      }
      saveEmployeeRecords(records.map((item) => item.id === employee.id ? { ...item, estado } : item));
      renderDirectory();
      setMessage(`Empleado ${estado.toLowerCase()} correctamente.`, "success");
    }

  });

  cancelButton?.addEventListener("click", () => {
    resetForm();
    hideForm();
    setMessage("");
  });

  closeButton?.addEventListener("click", () => {
    resetForm();
    hideForm();
    setMessage("");
  });

  renderDirectory();
  syncDirectoryFromSupabase();
  bindHrAttendanceView();
}

function populateSystemDataSelects() {
  document.querySelectorAll("[data-employee-select]").forEach((select) => {
    const filter = select.dataset.employeeFilter;
    const employees = getEmployeeRecords().filter((employee) => {
      if (employee.estado === "Inactivo") return false;
      if (!filter) return true;
      return employee.posicion === filter || employee.departamento === filter;
    });
    const options = employees.map((employee) => {
      const name = employeeDisplayName(employee);
      return `<option value="${safeHtml(name)}">${safeHtml(name)}</option>`;
    }).join("");
    select.innerHTML = `<option value="">Seleccione un empleado...</option>${options}`;
  });

  document.querySelectorAll("[data-area-select]").forEach((select) => {
    const options = officialMuseumAreas.map((area) => `<option value="${safeHtml(area)}">${safeHtml(area)}</option>`).join("");
    select.innerHTML = `<option value="">Seleccione un área...</option>${options}`;
  });
}

function bindNotificationsModule() {
  const module = document.querySelector("[data-notifications-module]");
  if (!module) return;

  const list = module.querySelector("[data-notifications-list]");
  const message = module.querySelector("[data-notifications-message]");
  const canEdit = hasPermission("notifications.manage");
  let preferences = {};
  const notificationTypes = [
    { key: "temperatura", label: "Temp./Humedad", source: "Sensores ambientales" },
    { key: "movimiento", label: "Movimiento", source: "Sensores de movimiento" },
    { key: "ponche", label: "Ponche", source: "Sistema de ponche electrónico" },
    { key: "seguridad", label: "Seguridad", source: "Sistema de seguridad" },
    { key: "actividades", label: "Actividades", source: "Banco de información del museo" }
  ];

  const setMessage = (text, type = "") => {
    if (!message) return;
    message.textContent = text;
    message.className = `form-message ${type}`.trim();
  };

  const employeePreferences = (preferences, employeeId) => {
    return preferences[employeeId] || {
      temperatura: true,
      movimiento: true,
      ponche: true,
      seguridad: true,
      actividades: true
    };
  };

  const renderToggle = (employee, type, enabled) => `
    <label class="switch-control" title="${safeHtml(type.source)}">
      <input type="checkbox" data-notification-toggle data-employee-id="${safeHtml(employee.id)}" data-notification-type="${safeHtml(type.key)}"${enabled ? " checked" : ""}${canEdit ? "" : " disabled"}>
      <span class="notification-status ${enabled ? "is-on" : "is-off"}" aria-label="${enabled ? "Activo" : "Inactivo"}"></span>
    </label>
  `;

  const validNotificationRecipients = () => getEmployeeRecords().filter((employee) =>
    employee.source === "supabase" && employee.estado !== "Inactivo"
  );

  const render = () => {
    const employees = validNotificationRecipients();
    list.innerHTML = employees.length ? employees.map((employee) => {
      const prefs = employeePreferences(preferences, employee.id);
      return `
        <tr>
          <td>
            <strong>${safeHtml(employeeDisplayName(employee))}</strong>
            <span class="table-subtext">${safeHtml(employee.posicion || "Empleado")} · ${safeHtml(employee.departamento || "Sin departamento")}</span>
          </td>
          <td>${safeHtml(employee.acceso || "Empleado")}</td>
          ${notificationTypes.map((type) => `<td>${renderToggle(employee, type, Boolean(prefs[type.key]))}</td>`).join("")}
        </tr>
      `;
    }).join("") : `<tr><td colspan="7">No hay empleados activos de Supabase disponibles para configurar.</td></tr>`;

    setMessage(canEdit
      ? "Preferencias cargadas desde Supabase y listas para futuras integraciones."
      : "Su rol permite consultar estas configuraciones, pero no modificarlas."
    , "success");
  };

  module.addEventListener("change", async (event) => {
    const toggle = event.target.closest("[data-notification-toggle]");
    if (!toggle || !canEdit) return;

    const employeeId = toggle.dataset.employeeId;
    const type = toggle.dataset.notificationType;
    const employee = validNotificationRecipients().find((record) => record.id === employeeId);
    const notificationType = notificationTypes.find((record) => record.key === type);
    if (!employee || !notificationType) {
      toggle.checked = Boolean(employeePreferences(preferences, employeeId)[type]);
      setMessage("Solo se pueden guardar preferencias para empleados activos sincronizados desde Supabase.", "error");
      return;
    }
    preferences[employeeId] = employeePreferences(preferences, employeeId);
    preferences[employeeId][type] = toggle.checked;
    try {
      await saveSystemCollection("notificaciones", "preferences", preferences);
    } catch (error) {
      setMessage(`No se pudo guardar en Supabase: ${error.message}`, "error");
      return;
    }

    const label = toggle.closest(".switch-control")?.querySelector(".notification-status");
    if (label) {
      label.classList.toggle("is-on", toggle.checked);
      label.classList.toggle("is-off", !toggle.checked);
      label.setAttribute("aria-label", toggle.checked ? "Activo" : "Inactivo");
    }
    setMessage("Preferencia de notificación actualizada en Supabase.", "success");
  });

  const loadPreferences = async () => {
    try {
      preferences = await fetchSystemCollection("notificaciones", "preferences", {});
    } catch (error) {
      setMessage(`No se pudo cargar Notificaciones desde Supabase: ${error.message}`, "error");
    }
    render();
  };

  loadPreferences();
}

function bindFinanceModule() {
  const module = document.querySelector("[data-finance-module]");
  const gate = document.querySelector("[data-finance-gate]");
  if (!module || !gate) return;

  const loginForm = document.querySelector("[data-finance-login]");
  const loginMessage = document.querySelector("[data-finance-login-message]");
  const loginFallback = document.querySelector("[data-finance-login-fallback]");
  const summary = document.querySelector("[data-finance-summary]");
  const panel = document.querySelector("[data-finance-panel]");
  const syncStatuses = document.querySelectorAll("[data-finance-sync-status]");
  const tabs = document.querySelectorAll("[data-finance-tab]");
  document.querySelector('[data-finance-tab="otros"]')?.remove();

  gate.hidden = false;
  gate.style.display = "";
  module.hidden = true;
  module.style.display = "none";
  if (summary) summary.innerHTML = "";
  if (panel) panel.innerHTML = "";


  let activeTab = "resumen";
  let currentUser = "";
  let currentProfile = null;
  const financeYear = 2026;
  let rows = [];
  let auditEntries = [];
  const quickBooksCategories = [
    "Boletería",
    "Renta de Espacios",
    "Membresías",
    "Gift Shop",
    "Donaciones",
    "Actividades Especiales",
    "Otros Ingresos"
  ];
  const quickBooksExpenseCategories = [
    "Nómina",
    "Mantenimiento",
    "Servicios Profesionales",
    "Mercadeo",
    "Utilidades",
    "Seguridad",
    "Limpieza",
    "Materiales",
    "Otros Gastos"
  ];
  const quickBooksDemoTransactions = [
    {
      tipo: "Ingreso",
      fecha: "2026-07-01",
      numero: "QB-DEMO-0001",
      categoria: "Boletería",
      descripcion: "Entradas generales del museo",
      cliente: "Visitantes del museo",
      metodo: "Tarjeta",
      subtotal: 420,
      ivu: 48.3,
      total: 468.3,
      fuente: "Boletería"
    },
    {
      tipo: "Ingreso",
      fecha: "2026-07-02",
      numero: "QB-DEMO-0002",
      categoria: "Renta de Espacios",
      descripcion: "Reserva de salón para actividad privada",
      cliente: "Cliente institucional",
      metodo: "Transferencia",
      subtotal: 1000,
      ivu: 0,
      total: 1000,
      fuente: "Renta de Espacios"
    },
    {
      tipo: "Ingreso",
      fecha: "2026-07-03",
      numero: "QB-DEMO-0003",
      categoria: "Donaciones",
      descripcion: "Donativo individual para programación cultural",
      cliente: "Donante",
      metodo: "Cheque",
      subtotal: 250,
      ivu: 0,
      total: 250,
      fuente: "Donaciones"
    },
    {
      tipo: "Ingreso",
      fecha: "2026-07-04",
      numero: "QB-DEMO-0004",
      categoria: "Gift Shop",
      descripcion: "Venta de artículos promocionales",
      cliente: "Visitantes del museo",
      metodo: "Efectivo",
      subtotal: 180,
      ivu: 20.7,
      total: 200.7,
      fuente: "Gift Shop"
    },
    {
      tipo: "Gasto",
      fecha: "2026-07-05",
      numero: "QB-DEMO-0005",
      categoria: "Nómina",
      descripcion: "Pago de nómina administrativa",
      cliente: "Museo de la Música",
      metodo: "Transferencia",
      subtotal: 1200,
      ivu: 0,
      total: 1200,
      fuente: "Finanzas"
    },
    {
      tipo: "Gasto",
      fecha: "2026-07-06",
      numero: "QB-DEMO-0006",
      categoria: "Utilidades",
      descripcion: "Pago de electricidad",
      cliente: "Proveedor de servicio",
      metodo: "ACH",
      subtotal: 650,
      ivu: 0,
      total: 650,
      fuente: "Finanzas"
    }
  ];

  const money = (value) => Number(value || 0).toLocaleString("es-PR", { style: "currency", currency: "USD" });
  const syncTime = () => new Date().toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" });
  const setSyncStatus = (state, title, detail) => {
    syncStatuses.forEach((status) => {
      const wideClass = status.classList.contains("finance-sync-status-wide") ? " finance-sync-status-wide" : "";
      status.className = `finance-sync-status${wideClass} is-${state}`;
      const titleNode = status.querySelector("[data-finance-sync-title]");
      const detailNode = status.querySelector("[data-finance-sync-detail]");
      if (titleNode) titleNode.textContent = title;
      if (detailNode) detailNode.textContent = detail;
    });
  };
  const rowTotal = (row) => row.values.reduce((sum, value) => sum + Number(value || 0), 0);
  const rowsByType = (type) => rows.filter((row) => row.type === type);
  const totalByType = (type) => rowsByType(type).reduce((sum, row) => sum + rowTotal(row), 0);
  const audit = () => auditEntries;
  const saveAudit = (entries) => {
    auditEntries = entries.slice(-250);
  };
  const normalizeRows = (storedRows) => {
    const storedById = new Map(storedRows.map((row) => [row.id, row]));
    const normalized = defaultFinanceRows.map((defaultRow) => {
      const row = storedById.get(defaultRow.id);
      return {
        ...defaultRow,
        values: row && Array.isArray(row.values) && row.values.length === 12 ? row.values : defaultRow.values
      };
    });
    const defaultIds = new Set(defaultFinanceRows.map((row) => row.id));
    storedRows.forEach((row) => {
      if (!defaultIds.has(row.id)) normalized.push(row);
    });
    return normalized;
  };

  rows = normalizeRows(defaultFinanceRows);

  const buildFinanceRecordPayload = (row, monthIndex, amount, museumId) => ({
    museum_id: museumId,
    record_type: row.type,
    category: row.category,
    concept: row.concept,
    month: financeMonths[monthIndex],
    year: financeYear,
    amount: Number(amount || 0)
  });

  const rowsFromFinanceRecords = (records) => {
    const normalized = normalizeRows(defaultFinanceRows.map((row) => ({ ...row, values: Array(12).fill(0) })));
    const rowKey = (row) => `${row.type}::${row.category}::${row.concept}`;
    const rowsByKey = new Map(normalized.map((row) => [rowKey(row), row]));

    records.forEach((record) => {
      if (excludedFinanceConcepts.has(record.concept)) return;
      const type = record.record_type;
      const key = `${type}::${record.category}::${record.concept}`;
      const monthIndex = financeMonths.indexOf(record.month);
      if (monthIndex < 0) return;
      if (!rowsByKey.has(key)) {
        const id = `${type}-${record.category}-${record.concept}`.toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        const newRow = { id, type, category: record.category, concept: record.concept, values: Array(12).fill(0) };
        rowsByKey.set(key, newRow);
        normalized.push(newRow);
      }
      rowsByKey.get(key).values[monthIndex] = Number(record.amount || 0);
    });

    return normalized;
  };

  const enforceApprovedFinanceRows = () => {
    const approvedIds = new Set(["exp-miscelaneos", "exp-reserva"]);
    defaultFinanceRows
      .filter((defaultRow) => approvedIds.has(defaultRow.id))
      .forEach((defaultRow) => {
        const row = rows.find((item) => item.id === defaultRow.id);
        if (!row) return;
        row.values = [...defaultRow.values];
      });
  };

  const syncApprovedFinanceRowsToSupabase = async (records) => {
    const approvedIds = new Set(["exp-miscelaneos", "exp-reserva"]);
    const approvedRows = defaultFinanceRows.filter((row) => approvedIds.has(row.id));
    for (const row of approvedRows) {
      for (let monthIndex = 0; monthIndex < financeMonths.length; monthIndex += 1) {
        const desiredValue = Number(row.values[monthIndex] || 0);
        const existing = records.find((record) =>
          record.record_type === row.type &&
          record.category === row.category &&
          record.concept === row.concept &&
          record.month === financeMonths[monthIndex] &&
          Number(record.year) === financeYear
        );
        const currentValue = Number(existing?.amount || 0);
        if (currentValue !== desiredValue) {
          await saveFinanceCellToSupabase(row, monthIndex, currentValue, desiredValue);
        }
      }
    }
  };

  const seedFinanceRecords = async (profile) => {
    const payload = rows.flatMap((row) =>
      row.values.map((value, monthIndex) => buildFinanceRecordPayload(row, monthIndex, value, profile.museum_id))
    );
    const response = await fetch(`${supabaseUrl}/rest/v1/finance_records`, {
      method: "POST",
      headers: {
        ...(await supabaseAuthHeaders()),
        Prefer: "return=minimal"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || "No se pudo crear la plantilla financiera en Supabase.");
    }
  };

  const syncFinanceFromSupabase = async () => {
    setSyncStatus("checking", "Verificando Supabase", "Confirmando sesión y permisos.");
    const session = getSupabaseSession();
    if (!session?.access_token) {
      setSyncStatus("error", "Sin conexión a Supabase", "Entre por Mi cuenta para cargar Finanzas.");
      throw new Error("No hay sesión activa de Supabase.");
    }
    currentProfile = await fetchSupabaseProfile();
    if (!currentProfile?.museum_id || !hasPermission("finance.read")) {
      setSyncStatus("error", "Acceso no autorizado", "Su usuario no tiene permisos financieros.");
      throw new Error("Su cuenta no tiene permiso para administrar Finanzas.");
    }

    currentUser = currentProfile.full_name || localStorage.getItem(currentUserKey) || "Usuario";
    setSyncStatus("checking", "Leyendo Supabase", `Usuario: ${currentUser}`);
    const response = await fetch(`${supabaseUrl}/rest/v1/finance_records?select=*&museum_id=eq.${encodeURIComponent(currentProfile.museum_id)}&year=eq.${financeYear}&order=created_at.asc`, {
      headers: await supabaseAuthHeaders()
    });
    const records = await response.json();
    if (!response.ok) {
      setSyncStatus("error", "Error de Supabase", records.message || "No se pudo leer Finanzas.");
      throw new Error(records.message || "No se pudo leer Finanzas desde Supabase.");
    }

    if (!records.length) {
      await seedFinanceRecords(currentProfile);
      rows = normalizeRows(rows);
      setSyncStatus("connected", "Conectado a Supabase", `Plantilla financiera creada · ${syncTime()} · ${currentUser}`);
      return true;
    }

    rows = rowsFromFinanceRecords(records);
    enforceApprovedFinanceRows();
    await syncApprovedFinanceRowsToSupabase(records);
    setSyncStatus("connected", "Conectado a Supabase", `Datos cargados · ${syncTime()} · ${currentUser}`);
    return true;
  };

  const saveFinanceCellToSupabase = async (row, monthIndex, previousValue, nextValue) => {
    const session = getSupabaseSession();
    if (!session?.access_token) throw new Error("No hay sesión activa de Supabase. Entre nuevamente por Mi cuenta.");
    if (!currentProfile?.museum_id) {
      currentProfile = await fetchSupabaseProfile();
    }
    if (!currentProfile?.museum_id) throw new Error("No se encontró el museo asociado a su perfil.");

    const query = [
      `museum_id=eq.${encodeURIComponent(currentProfile.museum_id)}`,
      `record_type=eq.${encodeURIComponent(row.type)}`,
      `category=eq.${encodeURIComponent(row.category)}`,
      `concept=eq.${encodeURIComponent(row.concept)}`,
      `month=eq.${encodeURIComponent(financeMonths[monthIndex])}`,
      `year=eq.${financeYear}`
    ].join("&");

    const existingResponse = await fetch(`${supabaseUrl}/rest/v1/finance_records?select=id&${query}&limit=1`, {
      headers: await supabaseAuthHeaders()
    });
    const existing = await existingResponse.json();
    if (!existingResponse.ok) throw new Error(existing.message || "No se pudo localizar el registro financiero.");

    const payload = buildFinanceRecordPayload(row, monthIndex, nextValue, currentProfile.museum_id);
    const recordId = existing[0]?.id;
    const saveResponse = await fetch(recordId
      ? `${supabaseUrl}/rest/v1/finance_records?id=eq.${encodeURIComponent(recordId)}`
      : `${supabaseUrl}/rest/v1/finance_records`, {
      method: recordId ? "PATCH" : "POST",
      headers: {
        ...(await supabaseAuthHeaders()),
        Prefer: "return=representation"
      },
      body: JSON.stringify(payload)
    });
    const saved = await saveResponse.json();
    if (!saveResponse.ok) throw new Error(saved.message || "No se pudo guardar el cambio financiero.");

    await recordSecurityAuditEvent("UPDATE_FINANCE_RECORD", "finance", "success", {
      record_id: saved[0]?.id || recordId || null,
      concept: row.concept,
      month: financeMonths[monthIndex],
      previous_amount: Number(previousValue || 0),
      next_amount: Number(nextValue || 0)
    });

    setSyncStatus("connected", "Guardado en Supabase", `Última confirmación: ${syncTime()} · ${currentUser}`);
    return true;
  };

  const addAudit = (row, monthIndex, previousValue, nextValue) => {
    const entries = audit();
    entries.push({
      usuario: currentUser,
      fecha: new Date().toLocaleDateString("es-PR"),
      hora: new Date().toLocaleTimeString("es-PR"),
      concepto: row.concept,
      mes: financeMonths[monthIndex],
      anterior: Number(previousValue || 0),
      nuevo: Number(nextValue || 0)
    });
    saveAudit(entries);
  };

  const totals = () => {
    const income = totalByType("income");
    const expense = totalByType("expense");
    return {
      income,
      expense,
      net: income - expense
    };
  };

  const renderSummary = () => {
    const data = totals();
    const cards = [
      ["Total de Ingresos", data.income, "theme-green"],
      ["Total de Gastos", data.expense, "theme-red"],
      ["Balance Neto", data.net, data.net >= 0 ? "theme-teal" : "theme-red"]
    ];
    summary.innerHTML = cards.map(([label, value, theme]) => `
      <article class="finance-kpi ${theme}">
        <span>${label}</span>
        <strong>${money(value)}</strong>
      </article>
    `).join("");
  };

  const renderNetSummary = () => {
    const data = totals();
    return `
      <div class="table-wrap">
        <table class="data-table finance-table">
          <thead>
            <tr><th>Resumen</th><th>Valor</th></tr>
          </thead>
          <tbody>
            <tr><td>Total de Ingresos</td><td>${money(data.income)}</td></tr>
            <tr><td>Total de Gastos</td><td>${money(data.expense)}</td></tr>
            <tr><td><strong>Balance Neto</strong></td><td><strong>${money(data.net)}</strong></td></tr>
          </tbody>
        </table>
      </div>
    `;
  };

  const renderFinanceTable = (title, filter) => {
    const visibleRows = rows.filter(filter);
    let lastCategory = "";
    return `
      <p class="page-kicker">${title}</p>
      <h3>${title}</h3>
      <div class="table-wrap">
        <table class="data-table finance-table">
          <thead>
            <tr>
              <th>Concepto</th>
              ${financeMonths.map((month) => `<th>${month}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${visibleRows.map((row) => {
              const categoryRow = row.category !== lastCategory ? `<tr class="finance-category-row"><td colspan="13">${row.category}</td></tr>` : "";
              lastCategory = row.category;
              return `${categoryRow}<tr>
                <td><strong>${safeHtml(row.concept)}</strong></td>
                ${row.values.map((value, index) => `
                  <td><input class="finance-cell" type="number" step="0.01" value="${Number(value || 0)}" data-finance-row="${row.id}" data-finance-month="${index}"></td>
                `).join("")}
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  };

  const renderExpenseSummaryTable = () => {
    return renderFinanceTable("Gastos", (row) =>
      row.type === "expense" && ["Gastos Operacionales", "Otros Gastos"].includes(row.category)
    );
  };

  const renderReports = () => {
    const entries = audit().slice().reverse();
    return `
      <p class="page-kicker">Reportes</p>
      <h3>Bitácora de Cambios</h3>
      <p>Todo cambio financiero queda registrado con usuario, fecha, hora, valor anterior y valor nuevo.</p>
      <div class="table-wrap section-stack">
        <table class="data-table">
          <thead><tr><th>Usuario</th><th>Fecha</th><th>Hora</th><th>Concepto</th><th>Mes</th><th>Anterior</th><th>Nuevo</th></tr></thead>
          <tbody>
            ${entries.length ? entries.map((entry) => `
              <tr><td>${safeHtml(entry.usuario)}</td><td>${entry.fecha}</td><td>${entry.hora}</td><td>${safeHtml(entry.concepto)}</td><td>${entry.mes}</td><td>${money(entry.anterior)}</td><td>${money(entry.nuevo)}</td></tr>
            `).join("") : `<tr><td colspan="7">Todavía no hay cambios registrados.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  };

  const renderConfiguration = () => `
    <p class="page-kicker">Configuración</p>
    <h3>Regla Financiera Activa</h3>
    <p>El módulo Finanzas solo calcula Total de Ingresos menos Total de Gastos para presentar el Balance Neto.</p>
    <div class="finance-config-grid">
      ${["Total de Ingresos", "Total de Gastos", "Balance Neto", "Supabase como base operacional", "Exportación contable para QuickBooks"].map((item) => `<span>${item}</span>`).join("")}
    </div>
  `;

  const renderPanel = () => {
    renderSummary();
    if (activeTab === "resumen") panel.innerHTML = `<p class="page-kicker">Resumen</p><h3>Balance Neto</h3>${renderNetSummary()}`;
    if (activeTab === "ingresos") panel.innerHTML = renderFinanceTable("Ingresos", (row) => row.type === "income");
    if (activeTab === "gastos") panel.innerHTML = renderExpenseSummaryTable();
    if (activeTab === "nomina") panel.innerHTML = renderFinanceTable("Nómina", (row) => row.category === "Nómina" || row.category === "Beneficios");
    if (activeTab === "reportes") panel.innerHTML = renderReports();
    if (activeTab === "configuracion") panel.innerHTML = renderConfiguration();
  };

  const showFinanceGateError = (text) => {
    gate.hidden = false;
    gate.style.display = "";
    module.hidden = true;
    module.style.display = "none";
    if (summary) summary.innerHTML = "";
    if (panel) panel.innerHTML = "";
    if (loginMessage) {
      loginMessage.textContent = text;
      loginMessage.className = "form-message error";
    }
    if (loginFallback) {
      loginFallback.hidden = false;
      loginFallback.href = loginUrlWithReturn("finanzas.html");
    }
  };

  const loadFinancePanel = async () => {
    await syncFinanceFromSupabase();
    renderPanel();
  };

  const quickBooksHeaders = [
    "Tipo",
    "Fecha",
    "Número de transacción",
    "Categoría",
    "Descripción",
    "Cliente / visitante",
    "Método de pago",
    "Subtotal",
    "IVU",
    "Total",
    "Fuente de ingreso"
  ];

  const escapeCsvValue = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const toCsv = (headers, records) => [
    headers.map(escapeCsvValue).join(","),
    ...records.map((record) => headers.map((header) => escapeCsvValue(record[header])).join(","))
  ].join("\n");

  const downloadExportFile = (filename, content, type = "text/csv;charset=utf-8") => {
    const blob = new Blob([`\uFEFF${content}`], { type });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const monthDate = (monthIndex) => {
    const fiscalMonthNumber = ((monthIndex + 6) % 12) + 1;
    const year = monthIndex < 6 ? financeYear : financeYear + 1;
    return `${year}-${String(fiscalMonthNumber).padStart(2, "0")}-01`;
  };

  const accountingCategoryForConcept = (concept = "") => {
    const text = concept.toLowerCase();
    if (text.includes("entrada") || text.includes("tableta")) return "Boletería";
    if (text.includes("sala") || text.includes("renta") || text.includes("alquiler")) return "Renta de Espacios";
    if (text.includes("membres")) return "Membresías";
    if (text.includes("tienda") || text.includes("gift")) return "Gift Shop";
    if (text.includes("donaci")) return "Donaciones";
    if (text.includes("actividad") || text.includes("gala") || text.includes("auspicio")) return "Actividades Especiales";
    return "Otros Ingresos";
  };

  const expenseCategoryForConcept = (row) => {
    const concept = row.concept.toLowerCase();
    const category = row.category.toLowerCase();
    if (category.includes("nómina") || category.includes("beneficio")) return "Nómina";
    if (concept.includes("mantenimiento") || concept.includes("reparacion")) return "Mantenimiento";
    if (concept.includes("artegrafiko") || concept.includes("director") || concept.includes("asistente")) return "Servicios Profesionales";
    if (concept.includes("publicidad")) return "Mercadeo";
    if (concept.includes("electricidad") || concept.includes("agua") || concept.includes("internet") || concept.includes("telefonía")) return "Utilidades";
    if (concept.includes("seguridad")) return "Seguridad";
    if (concept.includes("limpieza")) return "Limpieza";
    if (concept.includes("material") || concept.includes("uniforme")) return "Materiales";
    return "Otros Gastos";
  };

  const customerForCategory = (category) => ({
    "Boletería": "Visitantes del museo",
    "Renta de Espacios": "Cliente institucional",
    "Membresías": "Miembro del museo",
    "Gift Shop": "Visitantes del museo",
    "Donaciones": "Donante",
    "Actividades Especiales": "Participantes / auspiciadores",
    "Otros Ingresos": "Museo de la Música"
  })[category] || "Museo de la Música";

  const buildQuickBooksTransactions = () => {
    const transactions = [];
    rows.forEach((row) => {
      row.values.forEach((value, monthIndex) => {
        const total = Number(value || 0);
        if (total <= 0) return;
        const isIncome = row.type === "income";
        const category = isIncome ? accountingCategoryForConcept(row.concept) : expenseCategoryForConcept(row);
        transactions.push({
          "Tipo": isIncome ? "Ingreso" : "Gasto",
          "Fecha": monthDate(monthIndex),
          "Número de transacción": `FIN-${financeYear}-${String(transactions.length + 1).padStart(5, "0")}`,
          "Categoría": isIncome
            ? (quickBooksCategories.includes(category) ? category : "Otros Ingresos")
            : (quickBooksExpenseCategories.includes(category) ? category : "Otros Gastos"),
          "Descripción": row.concept,
          "Cliente / visitante": isIncome ? customerForCategory(category) : "Museo de la Música",
          "Método de pago": "Por reconciliar",
          "Subtotal": total.toFixed(2),
          "IVU": "0.00",
          "Total": total.toFixed(2),
          "Fuente de ingreso": isIncome ? row.category : ""
        });
      });
    });

    if (transactions.length) return transactions;

    return quickBooksDemoTransactions.map((transaction) => ({
      "Tipo": transaction.tipo,
      "Fecha": transaction.fecha,
      "Número de transacción": transaction.numero,
      "Categoría": transaction.categoria,
      "Descripción": transaction.descripcion,
      "Cliente / visitante": transaction.cliente,
      "Método de pago": transaction.metodo,
      "Subtotal": transaction.subtotal.toFixed(2),
      "IVU": transaction.ivu.toFixed(2),
      "Total": transaction.total.toFixed(2),
      "Fuente de ingreso": transaction.fuente
    }));
  };

  const summarizeQuickBooksRecords = (records, groupKey) => {
    const grouped = new Map();
    records.forEach((record) => {
      const key = record[groupKey] || "Sin clasificar";
      const current = grouped.get(key) || { key, income: 0, expense: 0, net: 0 };
      const amount = Number(record.Total || 0);
      if (record.Tipo === "Ingreso") {
        current.income += amount;
      } else {
        current.expense += amount;
      }
      current.net = current.income - current.expense;
      grouped.set(key, current);
    });
    return [...grouped.values()].map((item) => ({
      [groupKey]: item.key,
      "Total de Ingresos": item.income.toFixed(2),
      "Total de Gastos": item.expense.toFixed(2),
      "Balance Neto": item.net.toFixed(2)
    }));
  };

  const exportQuickBooks = (type) => {
    const records = buildQuickBooksTransactions();
    if (type === "daily") {
      const headers = ["Fecha", "Total de Ingresos", "Total de Gastos", "Balance Neto"];
      downloadExportFile("quickbooks-resumen-diario.csv", toCsv(headers, summarizeQuickBooksRecords(records, "Fecha")));
      return;
    }
    if (type === "category") {
      const headers = ["Categoría", "Total de Ingresos", "Total de Gastos", "Balance Neto"];
      downloadExportFile("quickbooks-categoria-contable.csv", toCsv(headers, summarizeQuickBooksRecords(records, "Categoría")));
      return;
    }
    if (type === "excel") {
      downloadExportFile("quickbooks-exportacion.xls", toCsv(quickBooksHeaders, records), "application/vnd.ms-excel;charset=utf-8");
      return;
    }
    downloadExportFile("quickbooks-exportacion.csv", toCsv(quickBooksHeaders, records));
  };

  const exportCsv = () => {
    const lines = [["Tipo", "Categoría", "Concepto", ...financeMonths]];
    rows.forEach((row) => lines.push([row.type, row.category, row.concept, ...row.values]));
    const csv = lines.map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "finanzas-museo.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };



  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activeTab = tab.dataset.financeTab;
      tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
      renderPanel();
    });
  });

  panel.addEventListener("change", async (event) => {
    const input = event.target.closest("[data-finance-row]");
    if (!input) return;
    const row = rows.find((item) => item.id === input.dataset.financeRow);
    const monthIndex = Number(input.dataset.financeMonth);
    if (!row || Number.isNaN(monthIndex)) return;
    const previousValue = Number(row.values[monthIndex] || 0);
    const nextValue = Number(input.value || 0);
    input.disabled = true;
    setSyncStatus("checking", "Guardando en Supabase", `${row.concept} · ${financeMonths[monthIndex]}`);
    try {
      const savedInSupabase = await saveFinanceCellToSupabase(row, monthIndex, previousValue, nextValue);
      if (!savedInSupabase) throw new Error("Supabase no confirmó el guardado.");
      row.values[monthIndex] = nextValue;
      addAudit(row, monthIndex, previousValue, nextValue);
      renderPanel();
    } catch (error) {
      input.value = previousValue;
      input.disabled = false;
      setSyncStatus("error", "Cambio no guardado", "Supabase no confirmó la operación.");
      panel.insertAdjacentHTML("afterbegin", `<p class="form-message error">El cambio no se guardó. Supabase no confirmó la operación: ${safeHtml(error.message || "revise su sesión o conexión")}.</p>`);
    }
  });

  document.querySelector("[data-finance-export-excel]")?.addEventListener("click", exportCsv);
  document.querySelector("[data-finance-export-pdf]")?.addEventListener("click", () => window.print());
  document.querySelector("[data-finance-print]")?.addEventListener("click", () => window.print());
  document.querySelectorAll("[data-qb-export]").forEach((button) => {
    button.addEventListener("click", () => exportQuickBooks(button.dataset.qbExport));
  });

  if (!getSupabaseSession()?.access_token) {
    showFinanceGateError("Finanzas requiere una sesión activa. Entre por Mi cuenta para continuar.");
  } else if (!hasPermission("finance.read")) {
    showFinanceGateError("Su cuenta no tiene el permiso necesario para abrir Finanzas.");
  } else {
    const sensitiveGate = bindSensitiveModuleGate({
      moduleId: "finance",
      permission: "finance.read",
      gate,
      content: module,
      loginForm,
      loginMessage,
      loginFallbackLink: loginFallback,
      async onUnlock() {
        try {
          await loadFinancePanel();
        } catch (error) {
          clearSensitiveModuleUnlock("finance");
          sensitiveGate.showGate(
            `No se pudo abrir Finanzas: ${error.message || "revise su sesión o conexión"}.`,
            { showForm: true, error: true }
          );
        }
      }
    });
    sensitiveGate.init();
  }
}

function bindExecutiveDirectionModule() {
  const gate = document.querySelector("[data-executive-gate]");
  const module = document.querySelector("[data-executive-module]");
  const message = document.querySelector("[data-executive-message]");
  const caseList = document.querySelector("[data-executive-cases]");
  const detail = document.querySelector("[data-executive-detail]");
  const refreshButton = document.querySelector("[data-executive-refresh]");
  if (!gate || !module || !caseList || !detail) return;

  const statusLabels = {
    draft: "Borrador",
    in_review: "En revisión",
    ready_for_approval: "Para aprobar",
    returned: "Devuelto",
    approved: "Aprobado",
    rejected: "Rechazado",
    cancelled: "Cancelado",
    in_municipal_process: "En trámite municipal",
    completed: "Completado"
  };
  const priorityLabels = {
    normal: "Normal",
    high: "Alta",
    urgent: "Urgente",
    critical: "Crítica"
  };
  const areaLabels = {
    administration: "Administración",
    collections: "Colecciones",
    communications: "Comunicaciones",
    finance: "Finanzas",
    human_resources: "Recursos Humanos",
    memberships: "Membresías",
    operations: "Operaciones",
    spaces: "Renta de espacios",
    system_health: "Soporte técnico"
  };
  const filters = { area: "", type: "", status: "", priority: "", date: "", urgent: false, resolved: false };
  let snapshot = { cases: [], decisions: [], permissions: {} };
  let selectedId = "";

  const setMessage = (text, type = "") => {
    if (!message) return;
    message.textContent = text || "";
    message.className = `form-message executive-system-message${type ? ` ${type}` : ""}`;
  };
  const isOverdue = (item) => Boolean(
    item.dueAt &&
    new Date(item.dueAt).getTime() < Date.now() &&
    !["approved", "rejected", "cancelled", "completed"].includes(item.status)
  );
  const formatDate = (value) => {
    if (!value) return "Sin fecha";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? "Sin fecha"
      : new Intl.DateTimeFormat("es-PR", { dateStyle: "medium" }).format(parsed);
  };
  const visibleCases = () => snapshot.cases.filter((item) => (
    (!filters.area || item.area === filters.area) &&
    (!filters.type || item.caseTypeCode === filters.type) &&
    (!filters.status || item.status === filters.status) &&
    (!filters.priority || item.priority === filters.priority) &&
    (!filters.date || String(item.createdAt || "").slice(0, 10) === filters.date) &&
    (!filters.urgent || ["urgent", "critical"].includes(item.priority) || isOverdue(item)) &&
    (!filters.resolved || ["approved", "rejected", "completed"].includes(item.status))
  ));

  const renderCounts = () => {
    const counts = {
      in_review: snapshot.cases.filter((item) => item.status === "in_review").length,
      ready_for_approval: snapshot.cases.filter((item) => item.status === "ready_for_approval").length,
      returned: snapshot.cases.filter((item) => item.status === "returned").length,
      urgent: snapshot.cases.filter((item) => ["urgent", "critical"].includes(item.priority) || isOverdue(item)).length,
      resolved: snapshot.cases.filter((item) => ["approved", "rejected", "completed"].includes(item.status)).length
    };
    Object.entries(counts).forEach(([name, value]) => {
      const target = document.querySelector(`[data-executive-count="${name}"]`);
      if (target) target.textContent = String(value);
    });
  };

  const populateFilter = (name, entries) => {
    const select = document.querySelector(`[data-executive-filter="${name}"]`);
    if (!select) return;
    const firstOption = select.options[0]?.outerHTML || "<option value=\"\">Todos</option>";
    select.innerHTML = firstOption + entries
      .map(([value, label]) => `<option value="${safeHtml(value)}">${safeHtml(label)}</option>`)
      .join("");
    select.value = filters[name] || "";
  };

  const renderFilters = () => {
    const areas = [...new Set(snapshot.cases.map((item) => item.area).filter(Boolean))]
      .map((value) => [value, areaLabels[value] || value]);
    const types = [...new Map(snapshot.cases
      .filter((item) => item.caseTypeCode)
      .map((item) => [item.caseTypeCode, item.caseTypeLabel || item.caseTypeCode])).entries()];
    populateFilter("area", areas);
    populateFilter("type", types);
  };

  const renderDetail = () => {
    const selected = snapshot.cases.find((item) => item.id === selectedId);
    if (!selected) {
      detail.innerHTML = '<div class="executive-empty-state">Seleccione un asunto para revisar su detalle.</div>';
      return;
    }
    const decisions = snapshot.decisions.filter((item) => item.executiveCaseId === selected.id);
    const canReview = Boolean(snapshot.permissions?.review);
    const canDecide = Boolean(snapshot.permissions?.decide);
    const actions = [
      canReview && selected.status === "in_review"
        ? '<button type="button" data-executive-action="ready">Marcar listo para aprobación</button>'
        : "",
      selected.status === "returned"
        ? '<button type="button" data-executive-action="resubmit">Reenviar a revisión</button>'
        : "",
      canDecide && selected.status === "ready_for_approval"
        ? '<button class="approve" type="button" data-executive-action="approve">Aprobar</button><button type="button" data-executive-action="return">Devolver</button><button class="reject" type="button" data-executive-action="reject">Rechazar</button>'
        : ""
    ].join("");
    detail.innerHTML = `
      <div class="executive-detail-heading">
        <div>
          <span>${safeHtml(selected.caseTypeLabel || selected.caseTypeCode || "Asunto")}</span>
          <h3>${safeHtml(selected.title || "Asunto sin título")}</h3>
        </div>
        <strong class="executive-status status-${safeHtml(selected.status || "")}">
          ${safeHtml(isOverdue(selected) ? "Vencido" : (statusLabels[selected.status] || selected.status))}
        </strong>
      </div>
      <p class="executive-detail-summary">${safeHtml(selected.summary || "No se registró una descripción adicional.")}</p>
      <dl class="executive-detail-facts">
        <div><dt>Solicitante</dt><dd>${safeHtml(selected.requestedByName || "Solicitante autorizado")}</dd></div>
        <div><dt>Área</dt><dd>${safeHtml(areaLabels[selected.area] || selected.area || "Administración")}</dd></div>
        <div><dt>Prioridad</dt><dd>${safeHtml(priorityLabels[selected.priority] || selected.priority || "Normal")}</dd></div>
        <div><dt>Creado</dt><dd>${safeHtml(formatDate(selected.createdAt))}</dd></div>
        <div><dt>Vencimiento</dt><dd>${safeHtml(selected.dueAt ? formatDate(selected.dueAt) : "Sin vencimiento")}</dd></div>
        <div><dt>Referencia</dt><dd>${safeHtml(selected.sourceResourceType || "expediente")}${selected.sourceResourceId ? ` · ${safeHtml(selected.sourceResourceId)}` : ""}</dd></div>
      </dl>
      <section class="executive-evidence">
        <h4>Expediente de origen</h4>
        <p>Los documentos, recibos municipales, cantidades y evidencia permanecen en su módulo correspondiente. Esta bandeja conserva la referencia oficial.</p>
      </section>
      <section class="executive-decision-history">
        <h4>Historial de decisiones</h4>
        ${decisions.length ? `
          <ol>${decisions.map((decision) => `
            <li>
              <strong>${safeHtml(decision.action === "approve" ? "Aprobado" : decision.action === "reject" ? "Rechazado" : "Devuelto")}</strong>
              <span>${safeHtml(decision.actorName || "Autoridad autorizada")} · ${safeHtml(formatDate(decision.createdAt))}</span>
              ${decision.reason ? `<p>${safeHtml(decision.reason)}</p>` : ""}
            </li>
          `).join("")}</ol>
        ` : "<p>Todavía no hay decisiones registradas.</p>"}
      </section>
      ${actions ? `<div class="executive-detail-actions">${actions}</div>` : ""}
    `;
  };

  const renderCases = () => {
    const rows = visibleCases();
    if (!rows.length) {
      caseList.innerHTML = '<div class="executive-empty-state">No hay asuntos para los filtros seleccionados.</div>';
      renderDetail();
      return;
    }
    if (!rows.some((item) => item.id === selectedId)) selectedId = rows[0].id;
    caseList.innerHTML = rows.map((item) => `
      <button class="executive-case-row${item.id === selectedId ? " is-selected" : ""}" type="button" data-executive-case="${safeHtml(item.id)}">
        <span class="executive-priority priority-${safeHtml(item.priority || "normal")}"></span>
        <span class="executive-case-copy">
          <small>${safeHtml(item.caseTypeLabel || item.caseTypeCode || "Asunto")} · ${safeHtml(areaLabels[item.area] || item.area || "Administración")}</small>
          <strong>${safeHtml(item.title || "Asunto sin título")}</strong>
          <em>${safeHtml(item.summary || "Sin resumen adicional")}</em>
        </span>
        <span class="executive-status status-${safeHtml(item.status || "")}">
          ${safeHtml(isOverdue(item) ? "Vencido" : (statusLabels[item.status] || item.status))}
        </span>
      </button>
    `).join("");
    renderDetail();
  };

  const render = () => {
    renderCounts();
    renderFilters();
    renderCases();
  };

  const loadExecutiveDirection = async () => {
    refreshButton?.setAttribute("disabled", "disabled");
    setMessage("Actualizando la bandeja…");
    try {
      const result = await callInstitutionalDataBridge({ kind: "executive_snapshot" });
      snapshot = {
        cases: Array.isArray(result?.cases) ? result.cases : [],
        decisions: Array.isArray(result?.decisions) ? result.decisions : [],
        permissions: result?.permissions || {}
      };
      render();
      setMessage(`Bandeja sincronizada. ${snapshot.cases.length} asunto${snapshot.cases.length === 1 ? "" : "s"}.`, "success");
    } catch (error) {
      setMessage(`No se pudo cargar Dirección Ejecutiva: ${error.message || "revise su conexión"}.`, "error");
      caseList.innerHTML = '<div class="executive-empty-state">La bandeja no está disponible en este momento.</div>';
    } finally {
      refreshButton?.removeAttribute("disabled");
    }
  };

  const runExecutiveAction = async (action) => {
    const selected = snapshot.cases.find((item) => item.id === selectedId);
    if (!selected) return;
    let reason = null;
    if (action === "return" || action === "reject") {
      reason = window.prompt(action === "reject" ? "Indique el motivo del rechazo:" : "Indique las correcciones requeridas:");
      if (!reason?.trim()) return;
    } else if (action === "approve") {
      const confirmed = window.confirm(`¿Confirma la aprobación de “${selected.title}”?`);
      if (!confirmed) return;
    }
    detail.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    setMessage("Registrando la decisión…");
    try {
      await callInstitutionalDataBridge({
        kind: "executive_action",
        caseId: selected.id,
        action,
        reason: reason?.trim() || null
      });
      await loadExecutiveDirection();
      setMessage("La decisión se registró correctamente.", "success");
    } catch (error) {
      setMessage(`No se pudo registrar la acción: ${error.message || "revise sus permisos"}.`, "error");
      renderDetail();
    }
  };

  refreshButton?.addEventListener("click", () => void loadExecutiveDirection());
  document.querySelectorAll("[data-executive-filter]").forEach((control) => {
    control.addEventListener("change", () => {
      filters[control.dataset.executiveFilter] = control.value;
      filters.urgent = false;
      filters.resolved = false;
      renderCases();
    });
  });
  document.querySelectorAll("[data-executive-summary]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.executiveSummary;
      filters.status = ["in_review", "ready_for_approval", "returned"].includes(target) ? target : "";
      filters.urgent = target === "urgent";
      filters.resolved = target === "resolved";
      const statusSelect = document.querySelector('[data-executive-filter="status"]');
      if (statusSelect) statusSelect.value = filters.status;
      renderCases();
    });
  });
  caseList.addEventListener("click", (event) => {
    const row = event.target.closest("[data-executive-case]");
    if (!row) return;
    selectedId = row.dataset.executiveCase;
    renderCases();
  });
  detail.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-executive-action]");
    if (actionButton) void runExecutiveAction(actionButton.dataset.executiveAction);
  });

  // La protección de ruta ya exige sesión activa y executive.case.read.
  // No se solicita una segunda contraseña dentro del mismo sitio.
  gate.hidden = true;
  gate.style.display = "none";
  module.hidden = false;
  module.style.display = "";
  void recordSecurityAuditEvent(
    "SENSITIVE_MODULE_ENTER",
    "executive_direction",
    "allowed",
    { permission: "executive.case.read", authentication: "active_session" }
  );
  void loadExecutiveDirection();
}

function bindReportsModule() {
  const gate = document.querySelector("[data-reports-gate]");
  const module = document.querySelector("[data-reports-module]");
  const loginForm = document.querySelector("[data-reports-login]");
  const loginMessage = document.querySelector("[data-reports-login-message]");
  const loginFallback = document.querySelector("[data-reports-login-fallback]");
  if (!gate || !module) return;

  const reportsPermission = hasPermission("reports.read") ? "reports.read" : "system.configure";
  bindSensitiveModuleGate({
    moduleId: "reports",
    permission: reportsPermission,
    gate,
    content: module,
    loginForm,
    loginMessage,
    loginFallbackLink: loginFallback
  }).init();
}

function bindEmployeeProfile() {
  const profileCard = document.querySelector(".employee-profile");
  if (!profileCard) return;

  if (!canManageEmployees()) {
    profileCard.innerHTML = `
      <div class="module-placeholder">
        <span class="module-icon theme-red" data-icon="shield"></span>
        <h3>Acceso restringido</h3>
        <p>El perfil administrativo de empleados solo está disponible para usuarios Ejecutivos y Administradores.</p>
        <a class="button secondary" href="dashboard.html">Volver al dashboard</a>
      </div>
    `;
    renderInlineIcons();
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const id = params.get("empleado") || "guillermo-torres";
  let profile = getEmployeeById(id);
  if (!profile) {
    profileCard.innerHTML = `
      <div class="module-placeholder">
        <span class="module-icon theme-blue" data-icon="users"></span>
        <h3>Empleado no disponible</h3>
        <p>El directorio no devolvió un expediente para este empleado.</p>
        <a class="button" href="recursos-humanos.html">Volver al directorio</a>
      </div>
    `;
    renderInlineIcons();
    return;
  }
  let pendingPhoto = profile.foto || "";

  const avatar = document.querySelector("[data-profile-avatar]");
  const name = document.querySelector("[data-profile-name]");
  const position = document.querySelector("[data-profile-position]");
  const photo = document.querySelector("[data-employee-photo]");
  const photoInput = document.querySelector("[data-employee-photo-input]");
  const photoRemove = document.querySelector("[data-employee-photo-remove]");
  const photoMessage = document.querySelector("[data-employee-photo-message]");
  const saveButton = document.querySelector("[data-profile-save]");
  const inviteButton = document.querySelector("[data-profile-invite]");
  const profileMessage = document.querySelector("[data-profile-message]");

  const setProfileMessage = (text, type = "") => {
    if (!profileMessage) return;
    profileMessage.textContent = text;
    profileMessage.className = `form-message ${type}`.trim();
  };

  const updateInviteButton = () => {
    if (!inviteButton) return;
    const canInvite = hasPermission("users.invite") && profile.source === "supabase";
    inviteButton.hidden = !canInvite;
    inviteButton.disabled = Boolean(profile.authUserId);
    inviteButton.textContent = profile.authUserId ? "Acceso vinculado" : "Enviar invitación";
  };

  if (avatar) avatar.textContent = profile.avatar || employeeInitials(profile);
  if (name) name.textContent = employeeDisplayName(profile);
  if (position) position.textContent = profile.posicion;
  updateInviteButton();

  document.querySelectorAll("[data-profile-field]").forEach((field) => {
    const value = profile[field.dataset.profileField] || "";
    field.value = value;
  });

  const showPhoto = (photoData) => {
    if (!photo || !avatar) return;
    if (photoData) {
      photo.src = photoData;
      photo.hidden = false;
      avatar.hidden = true;
      if (photoRemove) photoRemove.hidden = false;
      if (photoMessage) photoMessage.textContent = "Foto lista para guardar con el perfil.";
      return;
    }

    photo.removeAttribute("src");
    photo.hidden = true;
    avatar.hidden = false;
    if (photoRemove) photoRemove.hidden = true;
    if (photoMessage) photoMessage.textContent = "La foto servirá como identificación visual del récord del empleado.";
  };

  showPhoto(profile.foto || "");

  if (photoInput) {
    photoInput.addEventListener("change", () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        if (photoMessage) photoMessage.textContent = "Seleccione un archivo de imagen valido.";
        photoInput.value = "";
        return;
      }

      const reader = new FileReader();
      reader.addEventListener("load", () => {
        pendingPhoto = reader.result;
        showPhoto(pendingPhoto);
        setProfileMessage("Fotografía lista. Presione Guardar cambios para conservarla.", "success");
      });
      reader.readAsDataURL(file);
    });
  }

  if (photoRemove) {
    photoRemove.addEventListener("click", () => {
      pendingPhoto = "";
      if (photoInput) photoInput.value = "";
      showPhoto("");
      setProfileMessage("Fotografía removida. Presione Guardar cambios para conservar el cambio.", "success");
    });
  }

  inviteButton?.addEventListener("click", async () => {
    if (profile.authUserId) return;
    if (!window.confirm(`Se enviará una invitación al correo del expediente de ${employeeDisplayName(profile)}. ¿Desea continuar?`)) return;

    inviteButton.disabled = true;
    setProfileMessage("Enviando invitación segura...", "success");
    try {
      const result = await inviteSupabaseEmployee(profile.id);
      profile = { ...profile, authUserId: result.user_id };
      updateInviteButton();
      setProfileMessage("Invitación enviada e identidad vinculada correctamente.", "success");
    } catch (error) {
      updateInviteButton();
      setProfileMessage(`No se pudo enviar la invitación: ${error.message}`, "error");
    }
  });

  saveButton?.addEventListener("click", async () => {
    const updatedProfile = { ...profile, foto: pendingPhoto };
    document.querySelectorAll("[data-profile-field]").forEach((field) => {
      updatedProfile[field.dataset.profileField] = field.value;
    });
    updatedProfile.nombreCompleto = `${updatedProfile.nombre || ""} ${updatedProfile.apellidos || ""}`.trim();
    updatedProfile.avatar = employeeInitials(updatedProfile);

    const session = getSupabaseSession();
    if (session?.access_token && profile.source === "supabase") {
      try {
        const supabaseProfile = await fetchSupabaseProfile();
        await updateSupabaseEmployee(profile.id, updatedProfile, supabaseProfile.museum_id);

        const records = getEmployeeRecords();
        saveEmployeeRecords(records.map((employee) => employee.id === profile.id ? updatedProfile : employee));
        profile = updatedProfile;
        updateCurrentUserFromEmployeeCache();
        renderHeader();
        renderInlineIcons();
        bindHeaderActions();
        bindNotificationMenu();
        if (avatar) avatar.textContent = profile.avatar;
        if (name) name.textContent = employeeDisplayName(profile);
        if (position) position.textContent = profile.posicion;
        setProfileMessage("Perfil guardado en Supabase.", "success");
        return;
      } catch (error) {
        setProfileMessage(`No se pudo guardar en Supabase: ${error.message}. No se guardó una copia local.`, "error");
        return;
      }
    }

    setProfileMessage("Entre a Supabase antes de guardar cambios del perfil. No se guardó una copia local.", "error");
  });
}

const officialMembershipPlans = [
  {
    code: "pequenos-melomanos",
    name: "Pequeños Melómanos",
    audience: "Niños hasta 12 años",
    price: 20,
    siblingPrice: 15,
    billingPeriod: "annual",
    benefits: [
      "Invitaciones a actividades especiales para niños.",
      "Participación en talleres musicales interactivos.",
      "Acceso a experiencias educativas diseñadas para jóvenes amantes de la música.",
      "Certificado anual como Amigo del Museo."
    ]
  },
  {
    code: "comunidad-especial",
    name: "Estudiantes, Maestros, Diversidad Funcional y Seniors (60+)",
    audience: "Requiere identificación válida",
    price: 25,
    billingPeriod: "annual",
    benefits: ["Entrada gratuita e ilimitada durante un año para un individuo."]
  },
  {
    code: "individual",
    name: "Membresía Individual",
    audience: "Un adulto",
    price: 50,
    billingPeriod: "annual",
    benefits: ["Entrada gratuita e ilimitada durante un año para un adulto."]
  },
  {
    code: "cortesia-anual",
    name: "Membresía de Cortesía",
    audience: "Otorgada por la Administración por un año",
    price: 0,
    billingPeriod: "annual",
    benefits: [
      "Entrada gratuita e ilimitada durante un año para un individuo.",
      "No requiere aportación económica.",
      "Emisión sujeta a autorización administrativa."
    ]
  },
  {
    code: "familiar",
    name: "Membresía Familiar",
    audience: "Dos adultos y hasta tres niños menores de edad",
    price: 100,
    billingPeriod: "annual",
    benefits: [
      "Entrada gratuita e ilimitada para dos adultos y hasta tres niños menores de edad.",
      "Acceso a actividades familiares especiales.",
      "Participación en programas educativos para toda la familia."
    ]
  },
  {
    code: "amigo-musica",
    name: "Amigo de la Música",
    audience: "Familia y hasta cuatro invitados por visita",
    price: 250,
    billingPeriod: "annual",
    benefits: [
      "Entrada para una familia y hasta cuatro invitados por visita.",
      "Publicación anual o catálogo digital del Museo.",
      "Recorrido guiado exclusivo una vez al año.",
      "Invitación a encuentros especiales con artistas, músicos, historiadores e investigadores."
    ]
  },
  {
    code: "colaborador-cultural",
    name: "Colaborador Cultural",
    audience: "Dos familias y hasta cuatro invitados por visita",
    price: 500,
    billingPeriod: "annual",
    benefits: [
      "Entrada para dos familias y hasta cuatro invitados por visita.",
      "Cinco pases de cortesía para invitados.",
      "Publicación anual del Museo.",
      "Recorrido guiado privado anual.",
      "Invitación a actividades especiales de apoyo institucional."
    ]
  },
  {
    code: "socio-ejecutivo",
    name: "Socio Ejecutivo",
    audience: "Tres familias",
    price: 1000,
    billingPeriod: "annual",
    benefits: [
      "Entrada para tres familias durante un año.",
      "Diez pases de cortesía para invitados.",
      "Publicaciones especiales y material educativo exclusivo.",
      "Reconocimiento en el Informe Anual del Museo.",
      "Recorrido privado anual con personal directivo.",
      "Invitación a actividades VIP y eventos protocolares."
    ]
  },
  {
    code: "socio-fundador",
    name: "Socio Fundador",
    audience: "Disponible únicamente durante el período inaugural",
    price: 1000,
    billingPeriod: "one_time",
    benefits: [
      "Todos los beneficios de la Membresía Ejecutiva.",
      "Reconocimiento permanente como Socio Fundador.",
      "Inclusión del nombre en el Muro de Fundadores.",
      "Certificado oficial numerado e insignia exclusiva.",
      "Invitación especial a la ceremonia inaugural.",
      "Acceso preferencial durante el primer año de operaciones.",
      "Fotografía oficial, reconocimiento en el archivo histórico y reunión anual con la dirección."
    ]
  },
  {
    code: "fundador-distinguido",
    name: "Fundador Distinguido",
    audience: "Círculo de Fundadores",
    price: 2500,
    billingPeriod: "one_time",
    benefits: [
      "Todos los beneficios del Socio Fundador.",
      "Reconocimiento especial destacado en el Muro de Fundadores.",
      "Invitación para dos personas a todas las actividades inaugurales.",
      "Reconocimiento en publicaciones oficiales relacionadas con la apertura."
    ]
  },
  {
    code: "fundador-patron",
    name: "Fundador Patrón",
    audience: "Círculo de Fundadores",
    price: 5000,
    billingPeriod: "one_time",
    benefits: [
      "Todos los beneficios del Fundador Distinguido.",
      "Reconocimiento preferencial en el Muro de Fundadores.",
      "Invitación VIP a eventos especiales y actividades protocolares.",
      "Oportunidad de auspiciar un programa educativo o actividad cultural específica."
    ]
  },
  {
    code: "patrocinador",
    name: "Patrocinador",
    audience: "Empresa, fundación u organización",
    price: 2500,
    billingPeriod: "annual",
    benefits: ["Veinticinco pases de cortesía.", "Tres Membresías Familiares."]
  },
  {
    code: "corporativo",
    name: "Corporativo",
    audience: "Empresa, fundación u organización",
    price: 5000,
    billingPeriod: "annual",
    benefits: ["Cincuenta pases de cortesía.", "Seis Membresías Familiares."]
  },
  {
    code: "benefactor",
    name: "Benefactor",
    audience: "Empresa, fundación u organización",
    price: 10000,
    billingPeriod: "annual",
    benefits: [
      "Cien pases de cortesía.",
      "Diez Membresías Familiares.",
      "Reconocimiento especial en comunicados de prensa relacionados con la aportación."
    ]
  },
  {
    code: "mecenas-musical",
    name: "Círculo de Mecenas Musicales",
    audience: "Individuos, empresas y fundaciones",
    price: 25000,
    billingPeriod: "annual_from",
    benefits: [
      "Reconocimiento permanente dentro del Museo.",
      "Acceso VIP a eventos especiales.",
      "Encuentros privados con artistas, músicos e invitados especiales.",
      "Oportunidades de auspicio de exhibiciones, galerías, programas educativos y proyectos de investigación.",
      "Reconocimiento destacado en publicaciones institucionales y actividades oficiales."
    ]
  }
];

const generalMembershipBenefits = [
  "Entrada gratuita e ilimitada al Museo durante un año.",
  "Credencial oficial de Socio del Museo de la Música de Puerto Rico.",
  "Boletín digital con noticias, actividades y eventos especiales.",
  "Invitaciones a inauguraciones de exhibiciones y nuevas experiencias museográficas.",
  "Acceso preferencial a conferencias, conversatorios, presentaciones musicales y actividades educativas.",
  "Descuentos en talleres, cursos, programas educativos, tienda oficial y alquiler de espacios.",
  "Invitación a la Fiesta Anual de Socios y Amigos del Museo.",
  "Oportunidad de participar en actividades exclusivas para miembros."
];

function bindMembershipsModule() {
  const module = document.querySelector("[data-memberships-module]");
  if (!module) return;

  const list = module.querySelector("[data-membership-list]");
  const message = module.querySelector("[data-membership-message]");
  const dialog = document.querySelector("[data-membership-dialog]");
  const form = document.querySelector("[data-membership-form]");
  const attendanceDialog = document.querySelector("[data-membership-attendance-dialog]");
  const attendanceForm = document.querySelector("[data-membership-attendance-form]");
  const planSelect = form?.querySelector("[data-membership-plan-select]");
  const search = module.querySelector("[data-membership-search]");
  let members = [];
  let attendanceRecords = [];
  let profile = null;

  const money = (value) => Number(value || 0).toLocaleString("es-PR", {
    style: "currency",
    currency: "USD"
  });
  const setMessage = (text, type = "") => {
    if (!message) return;
    message.textContent = text;
    message.className = `form-message${type ? ` ${type}` : ""}`;
  };
  const periodLabel = (period) => ({
    annual: "anuales",
    one_time: "aportación única",
    annual_from: "anuales, desde"
  }[period] || "anuales");
  const planByCode = (code) => officialMembershipPlans.find((plan) => plan.code === code);
  const memberName = (member) => `${member.first_name || ""} ${member.last_name || ""}`.trim();
  const normalizeInterests = (value) => Array.isArray(value)
    ? value
    : String(value || "").split(",").map((item) => item.trim()).filter(Boolean);

  const membershipHeaders = async () => ({
    ...(await supabaseAuthHeaders()),
    Prefer: "return=representation"
  });

  const requireAuthorizedProfile = async () => {
    if (!hasPermission("memberships.manage") && !hasAdministrativeWorkspaceAccess()) {
      throw new Error("Su cuenta no tiene autorización para Membresías.");
    }
    profile = await currentMuseumContext();
    if (!profile?.museum_id || String(profile.status || "active") !== "active") {
      throw new Error("Su relación institucional no está activa para este museo.");
    }
    return profile;
  };

  const fetchMembers = async () => {
    await requireAuthorizedProfile();
    if (typeof isInstitutionalDataBackendEnabled === "function" && isInstitutionalDataBackendEnabled()) {
      const snapshot = await callInstitutionalDataBridge({ kind: "membership_list" });
      members = Array.isArray(snapshot?.members) ? snapshot.members : [];
      attendanceRecords = Array.isArray(snapshot?.attendance) ? snapshot.attendance : [];
      return;
    }
    const response = await fetch(
      `${supabaseUrl}/rest/v1/museum_members?select=*&museum_id=eq.${encodeURIComponent(profile.museum_id)}&order=last_name.asc,first_name.asc`,
      { headers: await membershipHeaders() }
    );
    const data = await response.json();
    if (!response.ok) {
      if (String(data.message || "").includes("museum_members")) {
        throw new Error("Falta instalar la base protegida de Membresías en Supabase.");
      }
      throw new Error(data.message || "No se pudieron cargar los socios.");
    }
    members = data;
    const attendanceResponse = await fetch(
      `${supabaseUrl}/rest/v1/membership_attendance?select=*&museum_id=eq.${encodeURIComponent(profile.museum_id)}&order=attended_at.desc`,
      { headers: await membershipHeaders() }
    );
    const attendanceData = await attendanceResponse.json();
    if (!attendanceResponse.ok) throw new Error(attendanceData.message || "No se pudo cargar la asistencia.");
    attendanceRecords = attendanceData;
  };

  const saveAudit = async (memberId, action, details = {}) => {
    const response = await fetch(`${supabaseUrl}/rest/v1/membership_audit_logs`, {
      method: "POST",
      headers: await membershipHeaders(),
      body: JSON.stringify({
        museum_id: profile.museum_id,
        member_id: memberId,
        action,
        details,
        performed_by: profile.id
      })
    });
    if (!response.ok) throw new Error("El socio se guardó, pero no se pudo completar la auditoría.");
  };

  const statusClass = (status) => ({
    Activo: "is-active",
    Pendiente: "is-pending",
    Vencido: "is-expired",
    Inactivo: "is-inactive"
  }[status] || "is-inactive");

  const renderStats = () => {
    const today = new Date();
    const inThirtyDays = new Date(today);
    inThirtyDays.setDate(inThirtyDays.getDate() + 30);
    const active = members.filter((member) => member.status === "Activo").length;
    const expiring = members.filter((member) => {
      if (member.status !== "Activo" || !member.expiration_date) return false;
      const expiration = new Date(`${member.expiration_date}T12:00:00`);
      return expiration >= today && expiration <= inThirtyDays;
    }).length;
    const pending = members.filter((member) => member.status === "Pendiente" || member.status === "Vencido").length;
    const revenue = members.reduce((sum, member) => sum + Number(member.amount_paid || 0), 0);
    const values = { active, expiring, pending, revenue: money(revenue) };
    Object.entries(values).forEach(([key, value]) => {
      const target = module.querySelector(`[data-membership-stat="${key}"]`);
      if (target) target.textContent = value;
    });
  };

  const renderMembers = () => {
    if (!list) return;
    const query = String(search?.value || "").trim().toLowerCase();
    const filtered = members.filter((member) => [
      memberName(member),
      member.email,
      member.member_number,
      planByCode(member.plan_code)?.name
    ].some((value) => String(value || "").toLowerCase().includes(query)));
    list.innerHTML = filtered.length ? filtered.map((member) => {
      const plan = planByCode(member.plan_code);
      const communication = member.email_consent || member.sms_consent
        ? [member.email_consent ? "Correo" : "", member.sms_consent ? "SMS" : ""].filter(Boolean).join(" / ")
        : "No autorizado";
      return `
        <tr>
          <td>
            <strong>${safeHtml(memberName(member))}</strong>
            <small>${safeHtml(member.member_number || "")}<br>${safeHtml(member.email || "")}</small>
          </td>
          <td>${safeHtml(plan?.name || member.plan_code)}</td>
          <td>
            <small>Inicio: ${safeHtml(member.start_date || "-")}<br>Vence: ${safeHtml(member.expiration_date || "No aplica")}</small>
          </td>
          <td><span class="membership-status ${statusClass(member.status)}">${safeHtml(member.status)}</span></td>
          <td>${safeHtml(communication)}</td>
          <td>
            <div class="membership-row-actions">
              <button class="table-action" type="button" data-membership-edit="${member.id}">Editar</button>
              <button class="table-action" type="button" data-membership-attendance="${member.id}">Asistencia</button>
            </div>
          </td>
        </tr>
      `;
    }).join("") : '<tr><td colspan="6">No se encontraron socios.</td></tr>';
    renderStats();
    renderInsights();
  };

  const renderPlans = () => {
    const grid = module.querySelector('[data-membership-view="plans"]');
    if (!grid) return;
    grid.innerHTML = officialMembershipPlans.map((plan) => `
      <article class="card membership-plan-card">
        <p class="page-kicker">${safeHtml(plan.audience)}</p>
        <h3>${safeHtml(plan.name)}</h3>
        <p class="membership-price">
          ${plan.billingPeriod === "annual_from" ? "Desde " : ""}${money(plan.price)}
          <small>${periodLabel(plan.billingPeriod)}</small>
        </p>
        ${plan.siblingPrice ? `<p class="membership-special-price">${money(plan.siblingPrice)} por cada hermano adicional</p>` : ""}
        <ul>
          ${plan.benefits.map((benefit) => `<li>${safeHtml(benefit)}</li>`).join("")}
        </ul>
      </article>
    `).join("") + `
      <article class="card membership-plan-card membership-general-benefits">
        <p class="page-kicker">Todos los socios</p>
        <h3>Beneficios generales</h3>
        <ul>${generalMembershipBenefits.map((benefit) => `<li>${safeHtml(benefit)}</li>`).join("")}</ul>
      </article>
    `;
  };

  const renderInsights = () => {
    const target = module.querySelector("[data-membership-insights]");
    if (!target) return;
    const interestCounts = new Map();
    members.filter((member) => member.analytics_consent).forEach((member) => {
      normalizeInterests(member.interests).forEach((interest) => {
        const key = interest.toLocaleLowerCase("es");
        interestCounts.set(key, { label: interest, count: (interestCounts.get(key)?.count || 0) + 1 });
      });
    });
    const interests = [...interestCounts.values()].sort((a, b) => b.count - a.count);
    const emailCount = members.filter((member) => member.email_consent).length;
    const smsCount = members.filter((member) => member.sms_consent).length;
    const analyticsCount = members.filter((member) => member.analytics_consent).length;
    const eligibleMemberIds = new Set(members.filter((member) => member.analytics_consent).map((member) => member.id));
    const categoryCounts = new Map();
    attendanceRecords.filter((record) => eligibleMemberIds.has(record.member_id)).forEach((record) => {
      const category = record.event_category || "Otro";
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    });
    const attendanceCategories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);
    target.innerHTML = `
      <article>
        <span>Autorizan correo</span>
        <strong>${emailCount}</strong>
      </article>
      <article>
        <span>Autorizan SMS</span>
        <strong>${smsCount}</strong>
      </article>
      <article>
        <span>Autorizan análisis</span>
        <strong>${analyticsCount}</strong>
      </article>
      <article>
        <span>Asistencias autorizadas</span>
        <strong>${attendanceRecords.filter((record) => eligibleMemberIds.has(record.member_id)).length}</strong>
      </article>
      <article class="membership-interest-summary">
        <span>Intereses principales</span>
        <div>${interests.length
          ? interests.slice(0, 12).map((item) => `<span>${safeHtml(item.label)} <strong>${item.count}</strong></span>`).join("")
          : "<small>No hay intereses autorizados registrados.</small>"
        }</div>
      </article>
      <article class="membership-interest-summary">
        <span>Asistencia por tipo de actividad</span>
        <div>${attendanceCategories.length
          ? attendanceCategories.map(([label, count]) => `<span>${safeHtml(label)} <strong>${count}</strong></span>`).join("")
          : "<small>No hay asistencias autorizadas registradas.</small>"
        }</div>
      </article>
    `;
  };

  const defaultStartDate = () => new Date().toISOString().slice(0, 10);
  const suggestedExpiration = (startDate, planCode) => {
    const plan = planByCode(planCode);
    if (!startDate || plan?.billingPeriod === "one_time") return "";
    const date = new Date(`${startDate}T12:00:00`);
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().slice(0, 10);
  };
  const generatedMemberNumber = () => {
    const year = new Date().getFullYear();
    const sequence = String(members.length + 1).padStart(4, "0");
    return `MMPR-${year}-${sequence}`;
  };

  const openForm = (member = null) => {
    if (!form || !dialog) return;
    form.reset();
    form.elements.id.value = member?.id || "";
    form.elements.first_name.value = member?.first_name || "";
    form.elements.last_name.value = member?.last_name || "";
    form.elements.email.value = member?.email || "";
    form.elements.phone.value = member?.phone || "";
    form.elements.organization_name.value = member?.organization_name || "";
    form.elements.plan_code.value = member?.plan_code || "individual";
    form.elements.member_number.value = member?.member_number || generatedMemberNumber();
    form.elements.start_date.value = member?.start_date || defaultStartDate();
    form.elements.expiration_date.value = member?.expiration_date || suggestedExpiration(form.elements.start_date.value, form.elements.plan_code.value);
    form.elements.status.value = member?.status || "Pendiente";
    form.elements.amount_paid.value = member?.amount_paid ?? planByCode(form.elements.plan_code.value)?.price ?? 0;
    form.elements.municipal_receipt_number.value = member?.municipal_receipt_number || "";
    form.elements.interests.value = normalizeInterests(member?.interests).join(", ");
    form.elements.notes.value = member?.notes || "";
    form.elements.email_consent.checked = Boolean(member?.email_consent);
    form.elements.sms_consent.checked = Boolean(member?.sms_consent);
    form.elements.analytics_consent.checked = Boolean(member?.analytics_consent);
    const title = form.querySelector("[data-membership-form-title]");
    if (title) title.textContent = member ? "Editar socio" : "Nuevo socio";
    dialog.showModal();
  };

  const exportMembers = () => {
    const headers = ["Número", "Nombre", "Apellidos", "Correo", "Teléfono", "Membresía", "Estado", "Inicio", "Vencimiento", "Recibo Municipio de Guaynabo", "Autoriza correo", "Autoriza SMS", "Intereses"];
    const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = members.filter((member) => member.email_consent || member.sms_consent).map((member) => [
      member.member_number,
      member.first_name,
      member.last_name,
      member.email,
      member.phone,
      planByCode(member.plan_code)?.name || member.plan_code,
      member.status,
      member.start_date,
      member.expiration_date,
      member.municipal_receipt_number,
      member.email_consent ? "Sí" : "No",
      member.sms_consent ? "Sí" : "No",
      normalizeInterests(member.interests).join("; ")
    ]);
    const csv = [headers, ...rows].map((row) => row.map(quote).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `socios-museo-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  planSelect.innerHTML = officialMembershipPlans.map((plan) =>
    `<option value="${plan.code}">${safeHtml(plan.name)} - ${money(plan.price)}</option>`
  ).join("");
  renderPlans();

  module.querySelectorAll("[data-membership-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      module.querySelectorAll("[data-membership-tab]").forEach((tab) => tab.classList.toggle("is-active", tab === button));
      module.querySelectorAll("[data-membership-view]").forEach((view) => {
        view.hidden = view.dataset.membershipView !== button.dataset.membershipTab;
      });
    });
  });
  module.querySelector("[data-membership-new]")?.addEventListener("click", () => openForm());
  module.querySelector("[data-membership-export]")?.addEventListener("click", exportMembers);
  document.querySelectorAll("[data-membership-close]").forEach((button) => {
    button.addEventListener("click", () => dialog?.close());
  });
  search?.addEventListener("input", renderMembers);
  list?.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-membership-edit]");
    if (editButton) {
      openForm(members.find((member) => member.id === editButton.dataset.membershipEdit));
      return;
    }
    const attendanceButton = event.target.closest("[data-membership-attendance]");
    if (!attendanceButton || !attendanceForm || !attendanceDialog) return;
    const member = members.find((item) => item.id === attendanceButton.dataset.membershipAttendance);
    attendanceForm.reset();
    attendanceForm.elements.member_id.value = member.id;
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    attendanceForm.elements.attended_at.value = now.toISOString().slice(0, 16);
    const label = attendanceDialog.querySelector("[data-membership-attendance-member]");
    if (label) label.textContent = memberName(member);
    attendanceDialog.showModal();
  });
  document.querySelectorAll("[data-membership-attendance-close]").forEach((button) => {
    button.addEventListener("click", () => attendanceDialog?.close());
  });
  form?.elements.plan_code.addEventListener("change", () => {
    const plan = planByCode(form.elements.plan_code.value);
    form.elements.amount_paid.value = plan?.price || 0;
    form.elements.expiration_date.value = suggestedExpiration(form.elements.start_date.value, plan?.code);
  });
  form?.elements.start_date.addEventListener("change", () => {
    form.elements.expiration_date.value = suggestedExpiration(form.elements.start_date.value, form.elements.plan_code.value);
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const id = String(data.get("id") || "");
    const planCode = String(data.get("plan_code") || "");
    const status = String(data.get("status") || "Pendiente");
    const municipalReceiptNumber = String(data.get("municipal_receipt_number") || "").trim();
    if (status === "Activo" && planCode !== "cortesia-anual" && !municipalReceiptNumber) {
      setMessage("Para activar la membresía, ingrese el número de recibo emitido por el Municipio de Guaynabo.", "error");
      form.elements.municipal_receipt_number.focus();
      return;
    }
    const payload = {
      museum_id: profile.museum_id,
      member_number: String(data.get("member_number") || generatedMemberNumber()).trim(),
      first_name: String(data.get("first_name") || "").trim(),
      last_name: String(data.get("last_name") || "").trim(),
      email: String(data.get("email") || "").trim() || null,
      phone: String(data.get("phone") || "").trim() || null,
      organization_name: String(data.get("organization_name") || "").trim() || null,
      plan_code: planCode,
      status,
      start_date: String(data.get("start_date") || ""),
      expiration_date: String(data.get("expiration_date") || "") || null,
      amount_paid: Number(data.get("amount_paid") || 0),
      municipal_receipt_number: municipalReceiptNumber || null,
      interests: normalizeInterests(data.get("interests")),
      notes: String(data.get("notes") || "").trim() || null,
      email_consent: data.get("email_consent") === "on",
      sms_consent: data.get("sms_consent") === "on",
      analytics_consent: data.get("analytics_consent") === "on",
      consent_updated_at: new Date().toISOString(),
      updated_by: profile.id,
      updated_at: new Date().toISOString()
    };
    if (!id) payload.created_by = profile.id;
    try {
      if (typeof isInstitutionalDataBackendEnabled === "function" && isInstitutionalDataBackendEnabled()) {
        const bridgePayload = { ...payload };
        delete bridgePayload.museum_id;
        if (id) bridgePayload.id = id;
        const savedMember = await callInstitutionalDataBridge({
          kind: "membership_upsert",
          payload: bridgePayload
        }).then((rows) => (Array.isArray(rows) ? rows[0] : rows));
        await saveAudit(savedMember.id, id ? "member_updated" : "member_created", {
          plan_code: savedMember.plan_code,
          status: savedMember.status,
          municipal_receipt_number: savedMember.municipal_receipt_number
        });
        dialog.close();
        await fetchMembers();
        renderMembers();
        setMessage(id ? "Expediente actualizado en Instituva." : "Socio registrado en Instituva.", "success");
        return;
      }
      const response = await fetch(
        `${supabaseUrl}/rest/v1/museum_members${id ? `?id=eq.${encodeURIComponent(id)}` : ""}`,
        {
          method: id ? "PATCH" : "POST",
          headers: await membershipHeaders(),
          body: JSON.stringify(payload)
        }
      );
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.message || "No se pudo guardar el socio.");
      const savedMember = saved[0];
      await saveAudit(savedMember.id, id ? "member_updated" : "member_created", {
        plan_code: savedMember.plan_code,
        status: savedMember.status,
        municipal_receipt_number: savedMember.municipal_receipt_number
      });
      dialog.close();
      await fetchMembers();
      renderMembers();
      setMessage(id ? "Expediente actualizado en Supabase." : "Socio registrado en Supabase.", "success");
    } catch (error) {
      setMessage(error.message, "error");
    }
  });

  attendanceForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(attendanceForm);
    const memberId = String(data.get("member_id") || "");
    const member = members.find((item) => item.id === memberId);
    if (!member) return;
    if (!member.analytics_consent) {
      setMessage("El socio no ha autorizado el uso de su asistencia para análisis institucional.", "error");
      return;
    }
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/membership_attendance`, {
        method: "POST",
        headers: await membershipHeaders(),
        body: JSON.stringify({
          museum_id: profile.museum_id,
          member_id: memberId,
          event_name: String(data.get("event_name") || "").trim(),
          event_category: String(data.get("event_category") || ""),
          attended_at: new Date(String(data.get("attended_at") || "")).toISOString(),
          recorded_by: profile.id
        })
      });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.message || "No se pudo registrar la asistencia.");
      await saveAudit(memberId, "attendance_recorded", {
        event_name: String(data.get("event_name") || "").trim(),
        event_category: String(data.get("event_category") || "")
      });
      attendanceDialog.close();
      await fetchMembers();
      renderMembers();
      setMessage("Asistencia registrada en Supabase.", "success");
    } catch (error) {
      setMessage(error.message, "error");
    }
  });

  const initialize = async () => {
    if (!getSupabaseSession()?.access_token) {
      list.innerHTML = '<tr><td colspan="6">Entre por Mi cuenta para consultar Membresías.</td></tr>';
      module.querySelector("[data-membership-new]").disabled = true;
      module.querySelector("[data-membership-export]").disabled = true;
      setMessage("Este módulo contiene información protegida y requiere una sesión administrativa.", "error");
      return;
    }
    try {
      await fetchMembers();
      renderMembers();
      setMessage("Información de socios cargada desde Supabase.", "success");
    } catch (error) {
      list.innerHTML = `<tr><td colspan="6">${safeHtml(error.message)}</td></tr>`;
      module.querySelector("[data-membership-new]").disabled = true;
      module.querySelector("[data-membership-export]").disabled = true;
      setMessage(error.message, "error");
    }
  };

  initialize();
}

function formatPortalDate(value, options) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-PR", { timeZone: "America/Puerto_Rico", ...options }).format(new Date(value));
}

function renderPortalTimeEntries(entries) {
  const list = document.querySelector("[data-portal-time-list]");
  if (!list) return;
  if (!entries.length) {
    list.innerHTML = '<p class="portal-empty">Todavía no hay ponches registrados.</p>';
    return;
  }
  list.innerHTML = entries.map((entry) => `
    <article class="portal-entry">
      <div><strong>${formatPortalDate(entry.clock_in, { weekday: "short", month: "short", day: "numeric" })}</strong><span>${formatPortalDate(entry.clock_in, { hour: "numeric", minute: "2-digit" })} – ${entry.clock_out ? formatPortalDate(entry.clock_out, { hour: "numeric", minute: "2-digit" }) : "En curso"}</span></div>
      <span class="portal-entry-status ${entry.clock_out ? "" : "is-open"}">${entry.clock_out ? "Completado" : "Activo"}</span>
    </article>`).join("");
}

function renderPortalNotifications(notifications) {
  const list = document.querySelector("[data-portal-notifications]");
  if (!list) return;
  if (!notifications.length) {
    list.innerHTML = '<p class="portal-empty">No tienes notificaciones nuevas.</p>';
    return;
  }
  list.innerHTML = notifications.map((item) => `<article class="portal-notification"><strong>${escapeHtml(item.title || "Aviso")}</strong><p>${escapeHtml(item.message || "")}</p><small>${formatPortalDate(item.created_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</small></article>`).join("");
}

function renderPortalTools() {
  const tools = [
    { permission: "employees.read.all", href: "recursos-humanos.html", icon: "users", label: "Equipo" },
    { permission: "finance.read", href: "finanzas.html", icon: "dollar", label: "Finanzas" },
    { permission: "schedules.read.team", href: "calendario.html", icon: "calendar", label: "Calendario del equipo" },
    { permission: "calendar.manage", href: "calendario.html", icon: "calendar", label: "Eventos" },
    { permission: "rentals.manage", href: "renta-espacios.html", icon: "building", label: "Renta de espacios" },
    { permission: "inventory.manage", href: "inventario.html", icon: "briefcase", label: "Inventario" }
  ];
  const available = tools.filter((tool, index, all) => hasPermission(tool.permission) && all.findIndex((candidate) => candidate.href === tool.href) === index);
  const region = document.querySelector("[data-portal-tools]");
  if (!region) return;
  if (!available.length) { region.closest(".portal-section").hidden = true; return; }
  region.innerHTML = available.map((tool) => `<a class="portal-tool" href="${tool.href}"><span class="portal-tool-icon">${iconSvg(tool.icon)}</span><span>${tool.label}</span></a>`).join("");
}

function bindPortalAttendanceCorrections() {
  const region = document.querySelector("[data-portal-corrections]");
  if (!region) return Promise.resolve();
  if (!hasPermission("attendance.corrections.request")) { region.hidden = true; return Promise.resolve(); }
  const form = region.querySelector("[data-correction-form]");
  const toggle = region.querySelector("[data-correction-toggle]");
  const cancel = region.querySelector("[data-correction-cancel]");
  const list = region.querySelector("[data-correction-list]");
  const message = region.querySelector("[data-correction-message]");
  const shiftSelect = form.elements.shiftId;
  const labels = { clock_in: "Entrada", lunch_out: "Salida a almuerzo", lunch_in: "Regreso de almuerzo", clock_out: "Salida final" };
  let events = [];
  const setMessage = (text, type = "") => { message.textContent = text; message.className = `portal-message ${type}`.trim(); };
  const renderRequests = (requests) => {
    const statusLabels = { pending: "Pendiente", approved: "Aprobada", rejected: "Rechazada", partially_approved: "Aprobada parcialmente", cancelled_by_requester: "Cancelada" };
    list.innerHTML = requests.length ? requests.map((request) => `<article class="portal-correction-item"><strong>${safeHtml(labels[request.requested_event_type] || request.requested_event_type)}</strong><span>${formatPortalDate(request.requested_occurred_at, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span><small>${safeHtml(request.reason)}</small><span class="portal-entry-status ${request.status === "pending" ? "is-open" : ""}">${safeHtml(statusLabels[request.status] || request.status)}</span>${request.decision_reason ? `<small>Decision: ${safeHtml(request.decision_reason)}</small>` : ""}</article>`).join("") : '<p class="portal-empty">No has solicitado correcciones.</p>';
  };
  const load = async () => {
    const [shifts, attendanceEvents, requests] = await Promise.all([fetchOwnSupabaseCorrectionShifts(45), fetchOwnSupabaseAttendanceEvents(100), fetchOwnSupabaseCorrectionRequests()]);
    events = attendanceEvents;
    shiftSelect.innerHTML = '<option value="">Seleccione un turno</option>' + shifts.map((shift) => `<option value="${safeHtml(shift.id)}">${formatPortalDate(shift.starts_at, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} - ${formatPortalDate(shift.ends_at, { hour: "numeric", minute: "2-digit" })}</option>`).join("");
    renderRequests(requests);
  };
  toggle.addEventListener("click", () => { form.hidden = false; toggle.hidden = true; });
  cancel.addEventListener("click", () => { form.hidden = true; toggle.hidden = false; form.reset(); setMessage("El registro original no sera modificado."); });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const shiftId = String(data.get("shiftId") || "");
    const eventType = String(data.get("eventType") || "");
    const original = events.find((item) => item.shift_id === shiftId && item.event_type === eventType && !item.correction_request_id);
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await requestSupabaseAttendanceCorrection({ shift_id: shiftId, original_event_id: original?.id || null, event_type: eventType, proposed_occurred_at: new Date(String(data.get("proposedAt"))).toISOString(), reason: String(data.get("reason") || "") });
      form.reset(); form.hidden = true; toggle.hidden = false;
      setMessage("Solicitud enviada al supervisor. El registro original no fue modificado.", "success");
      await load();
    } catch (error) { setMessage(error.message || "No se pudo enviar la solicitud.", "error"); }
    finally { submit.disabled = false; }
  });
  return load().catch((error) => { setMessage(error.message || "No se pudieron cargar las correcciones.", "error"); });
}

async function bindEmployeePortal() {
  if (!document.querySelector("[data-employee-portal]")) return;
  const session = getSupabaseSession();
  if (!session?.access_token) { window.location.replace(loginUrlWithReturn("employee-portal.html")); return; }
  const profile = await fetchSupabaseProfile();
  const employee = getEmployeeRecords().find((record) => record.authUserId === session.user?.id);
  document.querySelector("[data-portal-name]").textContent = employee ? employeeDisplayName(employee) : (profile?.full_name || session.user?.email || "Usuario");
  document.querySelector("[data-portal-role]").textContent = employee?.posicion || (hasPermission("attendance.corrections.approve") ? "Recursos Humanos" : "Usuario autorizado");
  document.querySelector("[data-portal-schedule]").textContent = employee?.horario || "Sin jornada de empleado vinculada";
  if (!employee) {
    document.querySelector(".portal-clock-card")?.setAttribute("hidden", "");
    document.querySelector("[data-portal-time-list]")?.closest(".portal-section")?.setAttribute("hidden", "");
    document.querySelector("[data-portal-corrections]")?.setAttribute("hidden", "");
  }
  document.querySelector("[data-portal-date]").textContent = formatPortalDate(new Date(), { weekday: "long", month: "long", day: "numeric" });
  const button = document.querySelector("[data-portal-clock-button]");
  const status = document.querySelector("[data-portal-clock-status]");
  const message = document.querySelector("[data-portal-message]");
  const actionLabels = {
    clock_in: "Registrar entrada",
    lunch_out: "Salida a almuerzo",
    lunch_in: "Regreso de almuerzo",
    clock_out: "Registrar salida"
  };
  const nextAction = (events) => {
    const latest = events[0]?.event_type;
    return latest === "clock_in" ? "lunch_out" : latest === "lunch_out" ? "lunch_in" : latest === "lunch_in" ? "clock_out" : "clock_in";
  };
  const requestPresence = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("Este dispositivo no permite validar la ubicacion.")); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ method: "geolocation", latitude: coords.latitude, longitude: coords.longitude, accuracy_meters: coords.accuracy }),
      () => reject(new Error("Debe permitir la ubicacion para confirmar que esta en el Museo.")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });
  const refresh = async () => {
    const [entries, events] = await Promise.all([fetchOwnSupabaseTimeEntries(7), fetchOwnSupabaseAttendanceEvents(28)]);
    renderPortalTimeEntries(entries);
    const action = nextAction(events);
    button.dataset.action = action;
    button.textContent = actionLabels[action];
    button.classList.toggle("is-clocked-in", action !== "clock_in");
    const latest = events[0];
    status.textContent = latest && action !== "clock_in" ? `Ultimo registro: ${formatPortalDate(latest.occurred_at, { hour: "numeric", minute: "2-digit" })}` : "Fuera de turno";
  };
  button.addEventListener("click", async () => {
    button.disabled = true;
    message.textContent = "Validando presencia fisica...";
    try {
      const presence = await requestPresence();
      await clockSupabaseEmployeeTime(button.dataset.action, presence);
      await refresh();
      message.textContent = "Ponche registrado correctamente.";
      message.className = "portal-message success";
    } catch (error) {
      message.textContent = error.message || "No se pudo registrar el ponche.";
      message.className = "portal-message error";
    } finally { button.disabled = false; }
  });
  document.querySelector("[data-portal-logout]")?.addEventListener("click", () => clearLoginState(true, "logout"));
  renderPortalTools();
  await Promise.all([refresh(), fetchOwnSupabaseNotifications(5).then(renderPortalNotifications), bindPortalAttendanceCorrections()]).catch((error) => { message.textContent = error.message || "No se pudo cargar la información personal."; message.className = "portal-message error"; });
}
function ensureEnvironmentOnLocalAuthCallback() {
  const params = getAuthCallbackParams();
  if (!isPasswordSetupCallback(params)) return false;
  const url = new URL(window.location.href);
  if (url.searchParams.get("environment")) return false;
  if (typeof isLocalMuseoHost === "function" && !isLocalMuseoHost()) return false;
  // En local, los enlaces de recovery suelen caer sin ?environment=; staging es el flujo de prueba.
  url.searchParams.set("environment", "staging");
  window.location.replace(`${url.pathname}${url.search}${url.hash}`);
  return true;
}

function redirectAuthCallbackToLogin() {
  const params = getAuthCallbackParams();
  if (!isPasswordSetupCallback(params)) return false;
  if (isLoginPage()) return false;

  const next = new URL(passwordRecoveryRedirectUrl(), window.location.origin);
  ["type", "access_token", "refresh_token", "token_hash", "code", "expires_in", "token_type", "error_description"].forEach((key) => {
    if (params[key]) next.searchParams.set(key, params[key]);
  });
  // Preserve hash tokens when present (Supabase implicit recovery).
  if (window.location.hash && window.location.hash.includes("access_token")) {
    next.hash = window.location.hash;
  }
  markPasswordSetupPending();
  window.location.replace(`${next.pathname}${next.search}${next.hash}`);
  return true;
}

function bindInstituvaAppLinks() {
  if (typeof instituvaAppUrl !== "function") return;
  document.querySelectorAll("[data-instituva-app-path]").forEach((element) => {
    const path = element.getAttribute("data-instituva-app-path");
    if (!path) return;
    const url = instituvaAppUrl(path);
    element.setAttribute("href", url);
    element.setAttribute("rel", "noopener noreferrer");
    element.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const href = element.getAttribute("href");
      if (!href || href === "#") {
        event.preventDefault();
        window.location.assign(url);
      }
    });
  });
}

async function initApp() {
  if (ensureEnvironmentOnLocalAuthCallback()) return;
  if (redirectAuthCallbackToLogin()) return;
  // Recovery/invite must stay on login until the password is saved.
  if (!isLoginPage() && isPasswordSetupPending()) {
    window.location.replace(passwordRecoveryRedirectUrl());
    return;
  }
  bindInstituvaAppLinks();
  renderSidebar();
  renderHeader();
  renderFooter();
  renderInlineIcons();
  bindHeaderActions();
  if (isLoginPage()) {
    bindLoginDemo();
    bindSidebarToggle();
    return;
  }
  await refreshCurrentPermissions().catch(() => {
    currentPermissions.clear();
    currentPermissionsLoaded = Boolean(getSupabaseSession()?.access_token);
  });
  if (enforceAuthenticatedPageAccess()) return;
  await syncEmployeeCacheFromSupabase().catch(() => null);
  updateCurrentUserFromEmployeeCache();
  renderHeader();
  renderInlineIcons();
  bindHeaderActions();
  populateSystemDataSelects();
  bindMaterialsRequestModule();
  bindHumanResourcesModule();
  bindNotificationsModule();
  bindFinanceModule();
  bindExecutiveDirectionModule();
  bindReportsModule();
  bindEmployeeProfile();
  bindSidebarToggle();
  bindNotificationMenu();
  bindIdleLogout();
  bindRentalCatalog();
  bindRentalGeneralRules();
  bindRentalSpacePage();
  bindRentalForm();
  bindLoanReceiptForm();
  bindInventoryModule();
  bindCalendarModules();
  bindMembershipsModule();
  await bindEmployeePortal();
}

document.addEventListener("DOMContentLoaded", initApp);
