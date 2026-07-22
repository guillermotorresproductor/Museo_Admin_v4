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
  "administracion.html": { title: "Administración", subtitle: "Recursos humanos, notificaciones, reportes y finanzas." },
  "recursos-humanos.html": { title: "Recursos Humanos", subtitle: "Directorio de empleados del museo." },
  "perfil-empleado.html": { title: "Perfil de Empleado", subtitle: "Información administrativa del empleado." },
  "notificaciones.html": { title: "Notificaciones", subtitle: "Alertas internas del sistema administrativo." },
  "reportes.html": { title: "Reportes", subtitle: "Módulo pendiente para programación." },
  "finanzas.html": { title: "Finanzas", subtitle: "Acceso restringido pendiente para firewall." },
  "reglamento.html": { title: "Reglamento del Museo", subtitle: "Normas oficiales, impresión y descarga." },
  "documentos.html": { title: "Formularios y Papelería", subtitle: "Stationary, reglamento, solicitud de empleo y formularios oficiales." },
  "deposito-artes.html": { title: "Depósito de Artes", subtitle: "Logos oficiales, artes y guías de marca del Museo." },
  "recibo-prestamo.html": { title: "Formularios Museográficos", subtitle: "Formularios digitales para artículos de colección y procesos museográficos." },
  "boletin.html": { title: "Boletín Board", subtitle: "Publicaciones, anuncios y comunicaciones internas." },
  "inventario.html": { title: "Inventario de Equipos y Obras de Arte", subtitle: "Registro, consulta y localización de artículos del museo." }
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
      { href: "calendario.html", label: "Calendario de Eventos del Museo", icon: "calendar" },
      { href: "renta-espacios.html", label: "Renta de Espacios", icon: "building" },
      { href: "ujieres.html", label: "Ujieres", icon: "users" },
      { href: "mantenimiento.html", label: "Mantenimiento", icon: "wrench", activePages: ["calendario-obras.html", "solicitud-materiales.html", "ruta-digital.html"] },
      { href: "documentos.html", label: "Formularios y Papelería", icon: "file", activePages: ["deposito-artes.html", "empleados.html", "recibo-prestamo.html", "reglamento.html"] },
      { href: "administracion.html", label: "Administración", icon: "shield", activePages: ["recursos-humanos.html", "perfil-empleado.html", "notificaciones.html", "reportes.html", "finanzas.html"] },
      { href: "boletin.html", label: "Boletín Board", icon: "megaphone" },
      { href: "inventario.html", label: "Inventario de Equipos y Obras de Arte", icon: "briefcase" },
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
    pages: ["documentos.html", "deposito-artes.html", "reglamento.html", "recibo-prestamo.html", "empleados.html"],
    links: [
      { href: "documentos.html", label: "Formularios y Papelería", icon: "file" },
      { href: "deposito-artes.html", label: "Depósito de Artes", icon: "image" },
      { href: "reglamento.html", label: "Reglamento", icon: "book" },
      { href: "recibo-prestamo.html", label: "Formularios Museográficos", icon: "file" },
      { href: "empleados.html", label: "Solicitud de Empleo", icon: "users" }
    ]
  },
  {
    pages: ["administracion.html", "recursos-humanos.html", "perfil-empleado.html", "notificaciones.html", "reportes.html", "finanzas.html"],
    links: [
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

const defaultEmployeeProfiles = {
  "guillermo-torres": {
    id: "guillermo-torres",
    avatar: "GT",
    nombre: "Guillermo",
    apellidos: "Torres",
    nombreCompleto: "Guillermo Torres",
    direccion: "Guaynabo, Puerto Rico",
    telefono: "787-000-0000",
    correo: "guillermotorrespr@gmail.com",
    educacion: "Graduado",
    condicion: "Ninguna registrada",
    posicion: "Administrador",
    departamento: "Administración",
    horario: "Lunes a viernes, 8:00 AM - 4:00 PM",
    notificaciones: "Recibe notificaciones administrativas, cambios de horario y alertas internas.",
    acceso: "Administrador",
    usuario: "gtorres",
    passwordTemporal: "Temporal-2026",
    fechaContratacion: "2026-07-01",
    estado: "Activo",
    foto: ""
  },
  "juan-perez": {
    id: "juan-perez",
    avatar: "JP",
    nombre: "Juan",
    apellidos: "Pérez",
    nombreCompleto: "Juan Pérez",
    direccion: "Guaynabo, Puerto Rico",
    telefono: "787-000-0000",
    correo: "juan.perez@museodelamusica.pr",
    educacion: "Graduado",
    condicion: "Ninguna registrada",
    posicion: "Mantenimiento",
    departamento: "Mantenimiento",
    horario: "Lunes a viernes, 8:00 AM - 4:00 PM",
    notificaciones: "Recibe avisos de ruta digital, materiales y calendario de obras.",
    acceso: "Empleado",
    usuario: "jperez",
    passwordTemporal: "Temporal-2026",
    fechaContratacion: "2026-07-01",
    estado: "Activo",
    foto: ""
  },
  "dora-ortiz": {
    id: "dora-ortiz",
    avatar: "DO",
    nombre: "Dora",
    apellidos: "Ortiz",
    nombreCompleto: "Dora Ortiz",
    direccion: "Guaynabo, Puerto Rico",
    telefono: "787-000-0000",
    correo: "dora.ortiz@museodelamusica.pr",
    educacion: "Estudiante",
    condicion: "Ninguna registrada",
    posicion: "Mantenimiento",
    departamento: "Mantenimiento",
    horario: "Martes a sábado, 8:00 AM - 4:00 PM",
    notificaciones: "Recibe avisos de inspección, mantenimiento preventivo y tareas asignadas.",
    acceso: "Empleado",
    usuario: "dortiz",
    passwordTemporal: "Temporal-2026",
    fechaContratacion: "2026-07-01",
    estado: "Activo",
    foto: ""
  },
  "ana-rivera": {
    id: "ana-rivera",
    avatar: "AR",
    nombre: "Ana",
    apellidos: "Rivera",
    nombreCompleto: "Ana Rivera",
    direccion: "Guaynabo, Puerto Rico",
    telefono: "787-000-0000",
    correo: "ana.rivera@museodelamusica.pr",
    educacion: "Graduado",
    condicion: "Ninguna registrada",
    posicion: "Ujier",
    departamento: "Operaciones",
    horario: "Según calendario de eventos",
    notificaciones: "Recibe asignaciones de ujieres, cambios de horario y áreas asignadas.",
    acceso: "Empleado",
    usuario: "arivera",
    passwordTemporal: "Temporal-2026",
    fechaContratacion: "2026-07-01",
    estado: "Activo",
    foto: ""
  },
  "carlos-mendez": {
    id: "carlos-mendez",
    avatar: "CM",
    nombre: "Carlos",
    apellidos: "Méndez",
    nombreCompleto: "Carlos Méndez",
    direccion: "Guaynabo, Puerto Rico",
    telefono: "787-000-0000",
    correo: "carlos.mendez@museodelamusica.pr",
    educacion: "Estudiante",
    condicion: "Ninguna registrada",
    posicion: "Ujier",
    departamento: "Operaciones",
    horario: "Según calendario de eventos",
    notificaciones: "Recibe asignaciones de ujieres, cambios de horario y áreas asignadas.",
    acceso: "Empleado",
    usuario: "cmendez",
    passwordTemporal: "Temporal-2026",
    fechaContratacion: "2026-07-01",
    estado: "Activo",
    foto: ""
  }
};

const supabaseUrl = museoEnvironment.supabaseUrl;
const supabasePublishableKey = museoEnvironment.supabasePublishableKey;
const supabaseSessionKey = `museo-admin-supabase-session-${museoEnvironment.name}`;
const supabaseSystemRecordsTable = "app_records";
const currentUserKey = "museo-admin-current-user";
const currentUserPhotoKey = "museo-admin-current-user-photo";
const currentAccessLevelKey = "museo-admin-access-level";
const SUPABASE_REFRESH_MARGIN_SECONDS = 60;
let employeeRecords = Object.values(defaultEmployeeProfiles);
let currentPermissions = new Set();
let currentPermissionsLoaded = false;
const hasPermission = (permission) => currentPermissions.has(permission);
const canManageEmployees = () => hasPermission("employees.create") || hasPermission("employees.update.basic");
const hasAdministrativeWorkspaceAccess = () =>
  hasPermission("system.configure") || (hasPermission("audit.read") && hasPermission("notifications.manage"));
const postLoginDestination = () => {
  if (hasAdministrativeWorkspaceAccess()) return "dashboard.html";
  if (hasPermission("employees.read.all") && hasPermission("attendance.corrections.approve")) return "recursos-humanos.html";
  return "employee-portal.html";
};

function enforceAuthenticatedPageAccess() {
  if (!getSupabaseSession()?.access_token || !currentPermissionsLoaded) return false;
  const page = getCurrentPage();
  if (page === "login.html") return false;
  if (hasAdministrativeWorkspaceAccess()) {
    if (page === "employee-portal.html") {
      window.location.replace("dashboard.html");
      return true;
    }
    return false;
  }
  if (page === "employee-portal.html" && postLoginDestination() !== "employee-portal.html") {
    window.location.replace(postLoginDestination());
    return true;
  }
  const allowedPages = new Map([
    ["employee-portal.html", () => true],
    ["recursos-humanos.html", () => hasPermission("employees.read.all")],
    ["finanzas.html", () => hasPermission("finance.read")],
    ["calendario.html", () => hasPermission("calendar.manage") || hasPermission("schedules.read.team")],
    ["renta-espacios.html", () => hasPermission("rentals.manage")],
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
  clearSupabaseSession();
  currentPermissions.clear();
  currentPermissionsLoaded = false;
  localStorage.removeItem(currentUserKey);
  localStorage.removeItem(currentUserPhotoKey);
  localStorage.removeItem(currentAccessLevelKey);
  if (redirect && !window.location.pathname.endsWith("login.html")) {
    const suffix = reason ? `?reason=${encodeURIComponent(reason)}` : "";
    window.location.href = `login.html${suffix}`;
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
  const sessionEmail = getSupabaseSession()?.user?.email || "";
  if (!userName && !sessionEmail) return;
  const normalizedName = String(userName || "").trim().toLowerCase();
  const normalizedEmail = String(sessionEmail || "").trim().toLowerCase();
  const employee = getEmployeeRecords().find((record) =>
    String(record.correo || "").trim().toLowerCase() === normalizedEmail ||
    employeeDisplayName(record).trim().toLowerCase() === normalizedName
  );
  if (!employee) return;
  localStorage.setItem(currentUserKey, employeeDisplayName(employee));
  if (employee.foto) {
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

const defaultRentalSpaces = [
  { id: "ballroom", name: "Ballroom", description: "Espacio principal para actividades de gran formato.", canon: 1000, billing: "por día", capacity: 300, schedule: "8:00 AM - 11:00 PM", setup: "2 horas", breakdown: "2 horas", status: "Disponible", equipment: ["Sonido base", "Aire acondicionado", "Iluminación"] },
  { id: "anfiteatro", name: "Anfiteatro", description: "Área para presentaciones, charlas y eventos institucionales.", canon: 1000, billing: "por día", capacity: 200, schedule: "8:00 AM - 11:00 PM", setup: "2 horas", breakdown: "2 horas", status: "Disponible", equipment: ["Tarima", "Sonido base", "Aire acondicionado"] },
  { id: "mezzanine", name: "Mezzanine", description: "Espacio abierto para actividades culturales y recepciones.", canon: 1000, billing: "por día", capacity: 150, schedule: "8:00 AM - 10:00 PM", setup: "2 horas", breakdown: "1 hora", status: "Disponible", equipment: ["Área abierta", "Aire acondicionado"] },
  { id: "cine-bienvenida", name: "Cine Bienvenida", description: "Espacio audiovisual inmersivo para documentales, conferencias, talleres, lanzamientos, presentaciones educativas, exhibiciones multimedia y experiencias de hasta 180 grados.", canon: 600, billing: "por día", capacity: 80, schedule: "8:00 AM - 10:00 PM", setup: "1 hora", breakdown: "1 hora", status: "Disponible", equipment: ["Pantalla panorámica de hasta 180°", "Sistema profesional de proyección", "Sistema profesional de sonido", "Aire acondicionado", "Butacas para el público"] },
  { id: "salon-adiestramiento", name: "Salón de Adiestramiento (Usos Múltiples)", description: "Salón para talleres, reuniones, seminarios y actividades educativas.", canon: 300, billing: "por día", capacity: 60, schedule: "8:00 AM - 8:00 PM", setup: "1 hora", breakdown: "1 hora", status: "Disponible", equipment: ["Mesas", "Sillas", "Pantalla"] },
  { id: "lobby", name: "Vestíbulo (Lobby)", description: "Área de bienvenida para recepciones y actividades compatibles con la misión del Museo.", canon: 600, billing: "por día", capacity: 100, schedule: "8:00 AM - 10:00 PM", setup: "1 hora", breakdown: "1 hora", status: "Disponible", equipment: ["Área abierta", "Aire acondicionado"] },
  { id: "plazoleta", name: "Plazoleta", description: "Espacio exterior para actividades culturales y comunitarias.", canon: 600, billing: "por día", capacity: 200, schedule: "8:00 AM - 10:00 PM", setup: "2 horas", breakdown: "2 horas", status: "Disponible", equipment: ["Área exterior"] },
  { id: "estacionamiento", name: "Estacionamiento", description: "Área exterior para usos especiales autorizados.", canon: 2500, billing: "por día", capacity: 250, schedule: "8:00 AM - 11:00 PM", setup: "2 horas", breakdown: "2 horas", status: "Disponible", equipment: ["Área vehicular"] },
  { id: "cafeteria", name: "Cafetería (Café/Bar Móvil)", description: "Concesión comercial compatible con la naturaleza del Museo.", canon: 1500, billing: "mensuales", capacity: 0, schedule: "Según contrato", setup: "Según contrato", breakdown: "Según contrato", status: "Disponible", equipment: ["Según contrato"] },
  { id: "gift-shop", name: "Gift Shop", description: "Concesión comercial sujeta a contrato aprobado por el MAG.", canon: 0, billing: "según contrato aprobado por el MAG", capacity: 0, schedule: "Según contrato", setup: "Según contrato", breakdown: "Según contrato", status: "Disponible", equipment: ["Según contrato"] }
];

function iconSvg(name) {
  return `<svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.file}</svg>`;
}

function getCurrentPage() {
  return window.location.pathname.split("/").pop() || "index.html";
}

function resolvePageMeta() {
  const currentPage = getCurrentPage();
  const meta = appPages[currentPage] || appPages["dashboard.html"];
  if (currentPage === "dashboard.html" || currentPage === "index.html") {
    const loggedUser = localStorage.getItem(currentUserKey);
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
        const isActive = link.href === currentPage;
        const attributes = link.type === "back"
          ? 'href="#" data-history-back'
          : `href="${link.href}"`;
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
      return `
        <li>
          <a class="nav-link${isActive ? " is-active" : ""}" href="${item.href}" aria-current="${isActive ? "page" : "false"}">
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
  const accountLabel = loggedUser || "Entrar a mi cuenta";
  const accountVisual = loggedUserPhoto
    ? `<img class="account-photo" src="${loggedUserPhoto}" alt="Foto de ${safeHtml(accountLabel)}">`
    : iconSvg("users");
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
      <a class="account-button" href="login.html">
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
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const invitationAccessToken = hash.get("access_token");
  const invitationType = hash.get("type");

  if (["invite", "recovery"].includes(invitationType) && invitationAccessToken && inviteCard && inviteForm) {
    const expiresIn = Number(hash.get("expires_in") || 3600);
    saveSupabaseSession({
      access_token: invitationAccessToken,
      refresh_token: hash.get("refresh_token") || "",
      expires_in: expiresIn,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      token_type: hash.get("token_type") || "bearer"
    });
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    if (loginCard) loginCard.hidden = true;
    inviteCard.hidden = false;
  } else if (hash.get("error_description")) {
    if (message) {
      message.textContent = hash.get("error_description");
      message.className = "login-help error";
    }
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }

  if (message && reason === "idle") {
    message.textContent = "La sesión se cerró automáticamente por inactividad.";
    message.className = "login-help";
  }
  if (message && reason === "logout") {
    message.textContent = "Sesión cerrada correctamente.";
    message.className = "login-help";
  }

  document.querySelector("[data-recovery-toggle]")?.addEventListener("click", () => {
    recoveryForm.elements.email.value = form.elements.username.value || "";
    loginCard.hidden = true;
    recoveryCard.hidden = false;
  });
  document.querySelector("[data-recovery-cancel]")?.addEventListener("click", () => {
    recoveryCard.hidden = true;
    loginCard.hidden = false;
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
      recoveryMessage.textContent = error.message || "No se pudo solicitar el enlace.";
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
      if (!session?.access_token) throw new Error("El enlace de invitación no es válido o expiró.");
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: "PUT",
        headers: {
          ...supabaseHeaders(),
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ password })
      });
      const user = await response.json();
      if (!response.ok) throw new Error(user.msg || user.message || "No se pudo crear la contraseña.");

      saveSupabaseSession({ ...session, user });
      localStorage.setItem(currentUserKey, user.user_metadata?.full_name || user.email || "Empleado");
      localStorage.setItem(currentAccessLevelKey, "Empleado");
      localStorage.removeItem(currentUserPhotoKey);
      await refreshCurrentPermissions();
      window.location.replace(postLoginDestination());
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
        localStorage.setItem(currentUserKey, profile?.full_name || session.user.email || username);
        localStorage.setItem(currentAccessLevelKey, profile?.role === "administrador" ? "Administrador" : profile?.role === "ejecutivo" ? "Ejecutivo" : "Empleado");
        localStorage.removeItem(currentUserPhotoKey);
        await refreshCurrentPermissions();
        window.location.href = postLoginDestination();
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
  const timeoutMs = 8 * 60 * 1000;
  let timer = null;
  const hasSession = () => Boolean(getSupabaseSession()?.access_token);

  const schedule = () => {
    if (timer) window.clearTimeout(timer);
    if (!hasSession()) return;
    timer = window.setTimeout(() => {
      clearLoginState(true, "idle");
    }, timeoutMs);
  };

  ["click", "keydown", "mousemove", "scroll", "touchstart"].forEach((eventName) => {
    window.addEventListener(eventName, schedule, { passive: true });
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) schedule();
  });

  schedule();
}

function bindRentalForm() {
  const form = document.querySelector("#rental-form");
  if (!form) return;

  const module = document.querySelector("[data-rental-module]");
  const message = document.querySelector("[data-rental-message]");
  const spaceSelect = document.querySelector("[data-rental-space]");
  const spaceDetail = document.querySelector("[data-rental-space-detail]");
  const statusSelect = document.querySelector("[data-rental-status]");
  const historyBody = document.querySelector("[data-rental-history]");
  const configPanel = document.querySelector("[data-rental-config]");
  const cancellation = document.querySelector("[data-rental-cancellation]");
  const money = (value) => Number(value || 0).toLocaleString("es-PR", { style: "currency", currency: "USD" });
  const currentUser = () => localStorage.getItem(currentUserKey) || "Administrador";
  const canAdjust = () => hasPermission("rentals.manage");
  let spaces = defaultRentalSpaces;
  let requests = [];
  const getSpaces = () => spaces;
  const saveSpaces = async (nextSpaces) => {
    const previousSpaces = spaces;
    spaces = nextSpaces;
    try {
      await saveSystemCollection("renta_espacios", "spaces", spaces);
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
  const dateValue = (name) => form.elements[name]?.value;
  const daysBetween = () => {
    const start = new Date(`${dateValue("fecha")}T12:00:00`);
    const end = new Date(`${dateValue("fechaFinal") || dateValue("fecha")}T12:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    return Math.max(1, Math.round((end - start) / 86400000) + 1);
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
    const subtotal = rate * days;
    const tax = 0;
    return { rate, days, subtotal, tax, total: subtotal + tax };
  };
  const setMessage = (text, type = "") => {
    if (!message) return;
    message.textContent = text;
    message.className = `form-message ${type}`.trim();
  };
  const createSequence = (prefix, count) => `${prefix}-${String(count + 1).padStart(4, "0")}`;
  const auditEntry = (estado, comentarios = "") => ({
    usuario: currentUser(),
    fecha: new Date().toLocaleDateString("es-PR"),
    hora: new Date().toLocaleTimeString("es-PR"),
    estado,
    comentarios
  });

  const populateSpaces = () => {
    const spaces = getSpaces();
    if (spaceSelect) {
      spaceSelect.innerHTML = `<option value="">Seleccione un espacio...</option>${spaces.map((space) => (
        `<option value="${space.id}"${space.status !== "Disponible" ? " disabled" : ""}>${space.name} - ${space.canon ? money(space.canon) : space.billing} ${space.canon ? space.billing : ""}</option>`
      )).join("")}`;
    }
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
    spaceDetail.innerHTML = `
      <h3>${safeHtml(space.name)}</h3>
      <p>${safeHtml(space.description)}</p>
      <div class="rental-feature-grid">
        <span><strong>Canon:</strong> ${space.canon ? money(space.canon) : space.billing}</span>
        <span><strong>Capacidad:</strong> ${space.capacity || "Según contrato"}</span>
        <span><strong>Horario:</strong> ${safeHtml(space.schedule)}</span>
        <span><strong>Montaje:</strong> ${safeHtml(space.setup)}</span>
        <span><strong>Desmontaje:</strong> ${safeHtml(space.breakdown)}</span>
        <span><strong>Estado:</strong> ${safeHtml(space.status)}</span>
      </div>
      <p><strong>Equipos incluidos:</strong> ${space.equipment.map(safeHtml).join(", ")}</p>
    `;
  };

  const renderCalculation = () => {
    const calc = currentCalculation();
    document.querySelector("[data-rental-rate]").textContent = money(calc.rate);
    document.querySelector("[data-rental-days]").textContent = calc.days;
    document.querySelector("[data-rental-subtotal]").textContent = money(calc.subtotal);
    document.querySelector("[data-rental-tax]").textContent = money(calc.tax);
    document.querySelector("[data-rental-total]").textContent = money(calc.total);

    if (cancellation && dateValue("fecha")) {
      const daysBefore = Math.ceil((new Date(`${dateValue("fecha")}T12:00:00`) - new Date()) / 86400000);
      const refund = daysBefore >= 30 ? "devolución estimada del 100%" : daysBefore >= 2 ? "el Museo podrá retener hasta un 50%" : "no procede devolución";
      cancellation.textContent = `Según la fecha seleccionada, en caso de cancelación aplicaría: ${refund}.`;
    }
  };

  const hasConflict = () => {
    const spaceId = spaceSelect.value;
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
    if (!historyBody) return;
    const requests = getRequests();
    historyBody.innerHTML = requests.length ? requests.map((request) => `
      <tr>
        <td>${safeHtml(request.numeroSolicitud)}</td>
        <td>${safeHtml(request.nombre)}</td>
        <td>${safeHtml(request.espacio)}</td>
        <td>${safeHtml(request.fecha)}</td>
        <td>${money(request.total)}</td>
        <td>${safeHtml(request.estado)}</td>
      </tr>
    `).join("") : `<tr><td colspan="6">No hay solicitudes registradas.</td></tr>`;
  };

  const renderConfig = () => {
    if (!configPanel) return;
    configPanel.innerHTML = getSpaces().map((space) => `
      <article class="rental-config-card">
        <label><small>Nombre</small><input type="text" value="${safeHtml(space.name)}" data-rental-space-id="${space.id}" data-rental-space-field="name"></label>
        <label><small>Descripción</small><textarea rows="3" data-rental-space-id="${space.id}" data-rental-space-field="description">${safeHtml(space.description)}</textarea></label>
        <label><small>Canon</small><input type="number" min="0" step="0.01" value="${Number(space.canon || 0)}" data-rental-space-id="${space.id}" data-rental-space-field="canon"></label>
        <label><small>Capacidad</small><input type="number" min="0" step="1" value="${Number(space.capacity || 0)}" data-rental-space-id="${space.id}" data-rental-space-field="capacity"></label>
        <label><small>Horarios disponibles</small><input type="text" value="${safeHtml(space.schedule)}" data-rental-space-id="${space.id}" data-rental-space-field="schedule"></label>
        <label><small>Montaje</small><input type="text" value="${safeHtml(space.setup)}" data-rental-space-id="${space.id}" data-rental-space-field="setup"></label>
        <label><small>Desmontaje</small><input type="text" value="${safeHtml(space.breakdown)}" data-rental-space-id="${space.id}" data-rental-space-field="breakdown"></label>
        <label><small>Estado</small><select data-rental-space-id="${space.id}" data-rental-space-field="status"><option${space.status === "Disponible" ? " selected" : ""}>Disponible</option><option${space.status === "No Disponible" ? " selected" : ""}>No Disponible</option></select></label>
        <label><small>Equipos incluidos</small><input type="text" value="${safeHtml(space.equipment.join(", "))}" data-rental-space-id="${space.id}" data-rental-space-field="equipment"></label>
      </article>
    `).join("");
  };

  form.addEventListener("submit", async (event) => {
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

    const data = new FormData(form);
    const currentRequests = getRequests();
    const space = selectedSpace();
    const calc = currentCalculation();
    const request = {
      id: `rental-${Date.now()}`,
      numeroSolicitud: createSequence("SOL", currentRequests.length),
      numeroRecibo: createSequence("REC", currentRequests.length),
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
      precioDia: calc.rate,
      dias: calc.days,
      subtotal: calc.subtotal,
      impuestos: calc.tax,
      total: calc.total,
      estado: data.get("estado"),
      documentos: Array.from(form.querySelectorAll('input[type="file"]')).map((input) => ({
        campo: input.name,
        archivos: Array.from(input.files || []).map((file) => file.name)
      })),
      audit: [auditEntry(data.get("estado"), "Solicitud creada desde el portal administrativo.")]
    };

    try {
      await saveRequests([...currentRequests, request]);
      if (request.estado === "Aprobada") await syncApprovedRequest(request);
      renderHistory();
      form.reset();
      renderSpaceDetail();
      renderCalculation();
      setMessage(`Solicitud ${request.numeroSolicitud} registrada en Supabase.`, "success");
    } catch (error) {
      setMessage(`No se pudo guardar en Supabase: ${error.message}`, "error");
    }
  });

  ["change", "input"].forEach((eventName) => {
    form.addEventListener(eventName, (event) => {
      if (event.target.matches("[data-rental-space]")) renderSpaceDetail();
      renderCalculation();
    });
  });

  statusSelect?.addEventListener("change", () => {
    if (!canAdjust() && statusSelect.value !== "Pendiente") {
      statusSelect.value = "Pendiente";
      setMessage("Solo Administrador o Ejecutivo puede cambiar el estado de una solicitud.", "error");
    }
  });

  document.querySelector("[data-rental-reset]")?.addEventListener("click", () => {
    form.reset();
    renderSpaceDetail();
    renderCalculation();
    setMessage("");
  });

  configPanel?.addEventListener("change", async (event) => {
    const field = event.target.closest("[data-rental-space-field]");
    if (!field || !canAdjust()) return;
    const spaces = getSpaces();
    const space = spaces.find((item) => item.id === field.dataset.rentalSpaceId);
    if (!space) return;
    const key = field.dataset.rentalSpaceField;
    if (key === "canon" || key === "capacity") {
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
      setMessage("Configuración del espacio actualizada en Supabase.", "success");
    } catch (error) {
      setMessage(`No se pudo guardar en Supabase: ${error.message}`, "error");
    }
  });

  const loadRentalData = async () => {
    try {
      spaces = await fetchSystemCollection("renta_espacios", "spaces", defaultRentalSpaces);
      requests = await fetchSystemCollection("renta_espacios", "requests", []);
      setMessage("Datos de renta cargados desde Supabase.", "success");
    } catch (error) {
      setMessage(`No se pudo cargar Renta desde Supabase: ${error.message}`, "error");
    }
    populateSpaces();
    renderSpaceDetail();
    renderCalculation();
    renderHistory();
    renderConfig();
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
    const body = [
      "Formulario de Recibo de Artículos de Colección Mediante Préstamo",
      `Número interno: ${internalNumber}`,
      `Fecha de emisión: ${displayDate(emissionDate)}`,
      "",
      `Prestamista: ${data.get("prestamista")}`,
      `Correo electrónico: ${data.get("correo")}`,
      `Teléfono: ${data.get("telefono")}`,
      `Dirección postal: ${data.get("direccion")}`,
      `Fecha de recibo: ${data.get("fecha")}`,
      "",
      "Articulo",
      `Nombre o titulo: ${data.get("articulo")}`,
      `Categoria: ${data.get("categoria")}`,
      `Descripcion: ${data.get("descripcion")}`,
      `Condicion: ${data.get("condicion")}`,
      `Valor estimado: ${data.get("valor")}`,
      "",
      "Préstamo",
      `Fecha de inicio: ${data.get("inicio")}`,
      `Fecha estimada de devolucion: ${data.get("devolucion")}`,
      `Propósito: ${data.get("proposito")}`,
      "",
      `Observaciones: ${data.get("observaciones") || "N/A"}`,
      "",
      "El prestamista certifica que la información suministrada es correcta."
    ].join("\n");

    const nextReceipts = [...receipts, {
      id: `loan-${Date.now()}`,
      sequence,
      numeroArticulo: internalNumber,
      fechaEmision: emissionDate,
      prestamista: data.get("prestamista"),
      articulo: data.get("articulo"),
      categoria: data.get("categoria")
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

    const mailto = new URL("mailto:guillermotorrespr@gmail.com");
    mailto.searchParams.set("subject", `${internalNumber} - Recibo de préstamo - ${data.get("articulo")}`);
    mailto.searchParams.set("body", body);

    if (message) {
      message.textContent = "Formulario validado. Se abrira el correo para enviar la información al administrador.";
      message.className = "form-message success";
    }

    window.location.href = mailto.toString();
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
      ["Empleados", employees],
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
      if (records.length) {
        saveEmployeeRecords(records);
        renderDirectory();
        setMessage("DIRECTORIO SINCRONIZADO.", "success");
      } else {
        setMessage("DIRECTORIO CONECTADO. AUN NO HAY EMPLEADOS REGISTRADOS.", "success");
      }
    } catch (error) {
      setMessage("NO SE PUDO SINCRONIZAR. SE MUESTRA EL DIRECTORIO LOCAL.", "error");
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
      usuario: data.get("usuario").trim(),
      passwordTemporal: data.get("passwordTemporal").trim(),
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
    if (!currentProfile?.museum_id || !["administrador", "ejecutivo"].includes(currentProfile.role)) {
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

    await fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
      method: "POST",
      headers: {
        ...(await supabaseAuthHeaders()),
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        museum_id: currentProfile.museum_id,
        user_id: currentProfile.id,
        action: "update_finance_record",
        table_name: "finance_records",
        record_id: saved[0]?.id || recordId || null,
        old_value: { amount: Number(previousValue || 0), month: financeMonths[monthIndex], concept: row.concept },
        new_value: { amount: Number(nextValue || 0), month: financeMonths[monthIndex], concept: row.concept }
      })
    }).catch(() => null);

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
  };

  const openModule = async () => {
    gate.hidden = false;
    gate.style.display = "";
    module.hidden = true;
    module.style.display = "none";
    if (loginMessage) {
      loginMessage.textContent = "Conectando Finanzas con Supabase...";
      loginMessage.className = "form-message";
    }

    try {
      await syncFinanceFromSupabase();
      gate.hidden = true;
      gate.style.display = "none";
      module.hidden = false;
      module.style.display = "";
      renderPanel();
    } catch (error) {
      showFinanceGateError(`No se pudo abrir Finanzas desde Supabase: ${error.message || "revise su sesión o conexión"}.`);
    }
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
    showFinanceGateError("Finanzas requiere una sesión activa de Supabase. Entre primero por Mi cuenta.");
  } else if (!hasPermission("finance.read")) {
    showFinanceGateError("Su cuenta no tiene el permiso finance.read para abrir Finanzas.");
  } else {
    openModule();
  }
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
  if (!session?.access_token) { window.location.replace(`login.html?environment=${encodeURIComponent(museoEnvironment.name)}`); return; }
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
function redirectAuthCallbackToLogin() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const callbackType = hash.get("type");
  const hasAccessToken = Boolean(hash.get("access_token"));
  const isPasswordCallback = ["invite", "recovery"].includes(callbackType) && hasAccessToken;
  if (!isPasswordCallback || window.location.pathname.endsWith("login.html")) return false;

  const environment = encodeURIComponent(museoEnvironment.name);
  window.location.replace(`login.html?environment=${environment}${window.location.hash}`);
  return true;
}

async function initApp() {
  if (redirectAuthCallbackToLogin()) return;
  renderSidebar();
  renderHeader();
  renderFooter();
  renderInlineIcons();
  bindHeaderActions();
  await refreshCurrentPermissions().catch(() => currentPermissions.clear());
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
  bindEmployeeProfile();
  bindSidebarToggle();
  bindNotificationMenu();
  bindLoginDemo();
  bindIdleLogout();
  bindRentalForm();
  bindLoanReceiptForm();
  bindInventoryModule();
  bindCalendarModules();
  await bindEmployeePortal();
}

document.addEventListener("DOMContentLoaded", initApp);




