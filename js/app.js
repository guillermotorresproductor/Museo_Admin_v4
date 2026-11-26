const appPages = {
  "asistente-ia.html": { title: "Asistente INSTITUVA", subtitle: "Diagnósticos autorizados de solo lectura." },
  "index.html": { title: "Dashboard", subtitle: "Panel principal del sistema." },
  "dashboard.html": { title: "Dashboard", subtitle: "Panel principal del sistema." },
  "login.html": { title: "Entrar a mi cuenta", subtitle: "Acceso administrativo del Museo de la Música." },
  "empleados.html": { title: "Solicitud de Empleo", subtitle: "Formulario para candidatos." },
  "ujieres.html": { title: "Calendario de Ujieres", subtitle: "Calendario mensual de ujieres, horarios y áreas asignadas." },
  "mantenimiento.html": { title: "Mantenimiento", subtitle: "Operación preventiva y correctiva." },
  "calendario.html": { title: "Calendario de Eventos del Museo", subtitle: "Actividades, eventos y compromisos oficiales del Museo." },
  "calendario-obras.html": { title: "Calendario de Obras", subtitle: "Asignación mensual de empleados, tareas y áreas de trabajo." },
  "solicitud-materiales.html": { title: "Solicitud de Materiales", subtitle: "Registro de solicitudes de mantenimiento." },
  "ruta-digital.html": { title: "Ruta Digital de Mantenimiento", subtitle: "Control de recorrido por áreas." },
  "renta-espacios.html": { title: "Renta de Espacios", subtitle: "Solicitud de áreas y tarifas oficiales." },
  "renta-espacio.html": { title: "Renta de Espacios", subtitle: "Ficha, fotografías y condiciones del espacio." },
  "membresias.html": { title: "Membresías", subtitle: "Socios, beneficios, renovaciones y participación." },
  "departamento-museologico.html": { title: "Departamento Museológico", subtitle: "Museología, salas, colecciones y formularios museográficos." },
  "colecciones-museograficas.html": { title: "Colecciones museográficas", subtitle: "Registro, documentación, conservación y gestión de colecciones." },
  "inventario-colecciones.html": { title: "Inventario de Colecciones", subtitle: "Expedientes de piezas y patrimonio museográfico." },
  "ingreso-articulo.html": { title: "Ingreso de artículo", subtitle: "Préstamo temporal o donación permanente hacia el inventario de colecciones." },
  "documento-ingreso.html": { title: "Documento de ingreso", subtitle: "Impresión del expediente desde el snapshot contractual." },
  "horarios.html": { title: "Horarios", subtitle: "Programación semanal del personal." },
  "administracion.html": { title: "Administración", subtitle: "Dirección ejecutiva, recursos humanos, notificaciones, nómina y finanzas." },
  "recursos-humanos.html": { title: "Recursos Humanos", subtitle: "Directorio de empleados del museo." },
  "perfil-empleado.html": { title: "Perfil de Empleado", subtitle: "Información administrativa del empleado." },
  "notificaciones.html": { title: "Notificaciones", subtitle: "Alertas internas del sistema administrativo." },
  "reportes.html": { title: "Nómina", subtitle: "Estado del personal hoy." },
  "finanzas.html": { title: "Finanzas", subtitle: "Acceso restringido pendiente para firewall." },
  "direccion-ejecutiva.html": { title: "Dirección Ejecutiva", subtitle: "Aprobaciones, seguimientos y supervisión operacional (INSTITUVA)." },
  "reglamento.html": { title: "Reglamento del Museo", subtitle: "Normas oficiales, impresión y descarga." },
  "documentos.html": { title: "Formularios y Papelería", subtitle: "Stationary, reglamento, solicitud de empleo y formularios oficiales." },
  "deposito-artes.html": { title: "Depósito de Artes", subtitle: "Logos oficiales, artes y guías de marca del Museo." },
  "recibo-prestamo.html": { title: "Formulario de Préstamo a Colección", subtitle: "Registro de artículos recibidos en préstamo para la colección del museo." },
  "boletin.html": { title: "Boletín Board", subtitle: "Publicaciones, anuncios y comunicaciones internas." },
  "inventario.html": { title: "Inventario de equipos", subtitle: "Registro, consulta y localización de artículos del museo." }
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
      { href: "departamento-museologico.html", label: "Departamento Museológico", icon: "building", activePages: ["colecciones-museograficas.html", "inventario-colecciones.html", "ingreso-articulo.html", "documento-ingreso.html", "recibo-prestamo.html"] },
      { href: "calendario.html", label: "Calendario de Eventos del Museo", icon: "calendar" },
      { href: "renta-espacios.html", label: "Renta de Espacios", icon: "building", activePages: ["renta-espacio.html"] },
      { href: "membresias.html", label: "Membresías", icon: "users" },
      { href: "ujieres.html", label: "Ujieres", icon: "users" },
      { href: "mantenimiento.html", label: "Mantenimiento", icon: "wrench", activePages: ["calendario-obras.html", "solicitud-materiales.html", "ruta-digital.html"] },
      { href: "documentos.html", label: "Formularios y Papelería", icon: "file", activePages: ["deposito-artes.html", "empleados.html", "reglamento.html"] },
      { href: "administracion.html", label: "Administración", icon: "shield", activePages: ["recursos-humanos.html", "perfil-empleado.html", "notificaciones.html", "reportes.html", "finanzas.html", "direccion-ejecutiva.html"] },
      { href: "boletin.html", label: "Boletín Board", icon: "megaphone" },
      { href: "inventario.html", label: appPages["inventario.html"].title, icon: "briefcase" },
      { href: "employee-portal.html", label: "Mi cuenta", icon: "users" }
    ]
  }
];

const moduleShortcutGroups = [
  {
    pages: ["recibo-prestamo.html", "inventario-colecciones.html", "ingreso-articulo.html"],
    backHref: "colecciones-museograficas.html",
    homeLabel: "Inicio",
    links: [
      { href: "departamento-museologico.html", label: "Departamento Museológico", icon: "building" },
      { href: "colecciones-museograficas.html", label: "Colecciones museográficas", icon: "image" }
    ]
  },
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
      { href: "documentos.html", label: "Formularios y Papelería", icon: "file" },
      { href: "deposito-artes.html", label: "Depósito de Artes", icon: "image" },
      { href: "reglamento.html", label: "Reglamento", icon: "book" },
      { href: "empleados.html", label: "Solicitud de Empleo", icon: "users" }
    ]
  },
  {
    pages: ["administracion.html", "recursos-humanos.html", "perfil-empleado.html", "notificaciones.html", "reportes.html", "finanzas.html", "direccion-ejecutiva.html"],
    links: [
      { href: "direccion-ejecutiva.html", label: "Dirección Ejecutiva", icon: "briefcase" },
      { href: "recursos-humanos.html", label: "Recursos Humanos", icon: "users" },
      { href: "notificaciones.html", label: "Notificaciones", icon: "bell" },
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

const demoEmployeeProfiles = {
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
    horario: "Lunes a viernes, 8:00 a. m. – 5:00 p. m.",
    notificaciones: "Recibe notificaciones administrativas, cambios de horario y alertas internas.",
    acceso: "Administrador",
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
    horario: "Lunes a viernes, 8:00 a. m. – 5:00 p. m.",
    notificaciones: "Recibe avisos de ruta digital, materiales y calendario de obras.",
    acceso: "Empleado",
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
    horario: "Martes a sábado, 8:00 a. m. – 5:00 p. m.",
    notificaciones: "Recibe avisos de inspección, mantenimiento preventivo y tareas asignadas.",
    acceso: "Empleado",
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
    fechaContratacion: "2026-07-01",
    estado: "Activo",
    foto: ""
  }
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
const SESSION_IDLE_MS = 15 * 60 * 1000;
let employeeRecords = museoEnvironmentName === "staging"
  ? Object.values(demoEmployeeProfiles).map((employee) => ({ ...employee, source: "demo" }))
  : [];
let currentPermissions = new Set();
let currentPermissionsLoaded = false;
const hasPermission = (permission) => currentPermissions.has(permission);
const hasModuleProfile = () => hasPermission("module_profiles.active");
const profilePageModules = {
  "employee-portal.html": "personal",
  "departamento-museologico.html": "collections", "colecciones-museograficas.html": "collections",
  "inventario-colecciones.html": "collections", "ingreso-articulo.html": "collections", "documento-ingreso.html": "collections", "recibo-prestamo.html": "collections",
  "calendario.html": "calendar", "renta-espacios.html": "rentals", "renta-espacio.html": "rentals", "solicitud-renta.html": "rentals",
  "membresias.html": "memberships", "ujieres.html": "ushers",
  "mantenimiento.html": "maintenance", "calendario-obras.html": "maintenance",
  "solicitud-materiales.html": "maintenance", "ruta-digital.html": "maintenance",
  "documentos.html": "documents", "deposito-artes.html": "documents", "empleados.html": "documents", "reglamento.html": "documents",
  "administracion.html": "administration", "horarios.html": "administration", "recursos-humanos.html": "administration", "perfil-empleado.html": "administration",
  "notificaciones.html": "administration", "reportes.html": "administration", "finanzas.html": "administration", "direccion-ejecutiva.html": "administration",
  "boletin.html": "announcements", "inventario.html": "inventory"
};
function profilePageAllowed(page) {
  const module = profilePageModules[page];
  if (!module || !hasPermission(`modules.${module}.read`)) return false;
  // Entering Administración does not grant access to protected administrative operations.
  const extra = {
    "recursos-humanos.html": () => hasPermission("employees.read.all"),
    "horarios.html": () => hasPermission("schedules.manage"),
    "perfil-empleado.html": () => canManageEmployees() || hasPermission("roles.assign"),
    "notificaciones.html": () => hasPermission("notifications.manage"),
    "finanzas.html": () => hasPermission("finance.read"),
    "reportes.html": () => hasPermission("attendance.today.read") || hasPermission("attendance.history.read"),
    "direccion-ejecutiva.html": () => hasPermission("executive.case.read"),
    "recibo-prestamo.html": () => canWriteCollections(),
    "ingreso-articulo.html": () => canWriteCollections() || canSignCollectionDirector(),
    "documento-ingreso.html": () => canReadCollections()
  };
  return extra[page] ? extra[page]() : true;
}
const canManageEmployees = () => hasPermission("employees.create") || hasPermission("employees.update.basic");
const hasAdministrativeWorkspaceAccess = () =>
  hasPermission("system.configure") || (hasPermission("audit.read") && hasPermission("notifications.manage"));
const canWriteCollections = () => hasAdministrativeWorkspaceAccess() || hasPermission("collections.write");
const canSignCollectionDirector = () => hasPermission("collections.sign.director");
const canReadCollections = () => canWriteCollections() || hasPermission("collections.read");
const canAccessAdministrationHub = () => hasModuleProfile() ? hasPermission("modules.administration.read") : hasAdministrativeWorkspaceAccess();
const postLoginDestination = () => "dashboard.html";
const canAccessPersonalSpace = () => ["profile.read.self", "employees.read.self", "schedules.read.self", "time.clock", "time.read.self"].some(hasPermission);

const EXECUTIVE_MODULE_ACCESS = {
  "usuarios-externos.html": () => hasPermission("users.invite") && hasPermission("roles.assign"),
  "administracion.html": () => canAccessAdministrationHub(),
  "horarios.html": () => hasPermission("schedules.manage"),
  "renta-espacios.html": () => hasPermission("rentals.manage"),
  "renta-espacio.html": () => hasPermission("rentals.manage"),
  // Compatibilidad: si aún no existe memberships.manage en el entorno, usar acceso ejecutivo.
  "membresias.html": () => hasPermission("memberships.manage") || hasAdministrativeWorkspaceAccess()
};

const SENSITIVE_MODULE_ACCESS = {
  "finanzas.html": () => hasPermission("finance.read"),
  "direccion-ejecutiva.html": () => hasPermission("executive.case.read"),
  "reportes.html": () => hasPermission("attendance.today.read") || hasPermission("attendance.history.read")
};

const moduleAccessChecks = {
  "finanzas.html": () => hasPermission("finance.read"),
  "employee-portal.html": () => canAccessPersonalSpace(),
  "departamento-museologico.html": () => hasAdministrativeWorkspaceAccess() || hasPermission("collections.read") || hasPermission("collections.write"),
  "colecciones-museograficas.html": () => hasAdministrativeWorkspaceAccess() || hasPermission("collections.read") || hasPermission("collections.write"),
  "inventario-colecciones.html": () => canReadCollections(),
  "recibo-prestamo.html": () => hasAdministrativeWorkspaceAccess() || hasPermission("collections.write"),
  "ingreso-articulo.html": () => hasAdministrativeWorkspaceAccess() || hasPermission("collections.write") || hasPermission("collections.sign.director"),
  "documento-ingreso.html": () => canReadCollections(),
  "calendario.html": () => hasPermission("calendar.manage") || hasPermission("schedules.read.team"),
  "renta-espacios.html": () => hasPermission("rentals.manage"),
  "membresias.html": () => hasPermission("memberships.manage"),
  "ujieres.html": () => hasPermission("usher.schedule.read.own") || hasPermission("usher.schedule.read.all") || hasPermission("usher.schedule.manage"),
  "mantenimiento.html": () => hasPermission("maintenance.manage") || hasAdministrativeWorkspaceAccess(),
  "calendario-obras.html": () => hasPermission("maintenance.manage") || hasAdministrativeWorkspaceAccess(),
  "solicitud-materiales.html": () => hasPermission("maintenance.manage") || hasAdministrativeWorkspaceAccess(),
  "ruta-digital.html": () => hasPermission("maintenance.manage") || hasAdministrativeWorkspaceAccess(),
  "documentos.html": () => hasAdministrativeWorkspaceAccess(),
  "administracion.html": () => canAccessAdministrationHub(),
  "boletin.html": () => hasPermission("announcements.read") || hasPermission("announcements.publish"),
  "inventario.html": () => hasPermission("inventory.manage")
};

function loginUrlWithReturn(page) {
  const params = new URLSearchParams();
  if (typeof isMuseumProductionHost !== "function" || !isMuseumProductionHost()) {
    params.set("environment", museoEnvironment.name);
  }
  if (page) params.set("next", page);
  const query = params.toString();
  return `login.html${query ? `?${query}` : ""}`;
}

function resolvePostLoginDestination() {
  if (typeof isMuseumProductionHost === "function" && isMuseumProductionHost()) {
    return postLoginDestination();
  }
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
  // Reveal only the replacement denial view; protected modules stay uninitialized.
  document.body.classList.add("app-ready");
  await syncEmployeeCacheFromSupabase().catch(() => null);
  updateCurrentUserFromEmployeeCache();
  // Presentation guard only; the Edge Function independently verifies the same
  // profile against the database on every request, including general questions.
  const allowedAiProfiles = new Set(["administrador_general","director_ejecutivo",
    "gerente_administrativo","gerente_museografica"]);
  const sessionUserId = getSupabaseSession()?.user?.id || "";
  const activeAiEmployee = getEmployeeRecords().find(employee =>
    employee.authUserId === sessionUserId && employee.statusCode === "activo" &&
    allowedAiProfiles.has(employee.accessProfile));
  const canOpenAi = instituvaAiUiEnabled && Boolean(activeAiEmployee);
  if (getCurrentPage() === "asistente-ia.html" && !canOpenAi) {
    showProtectedAccessDenied("Su perfil no autoriza utilizar INSTITUVA AI.");
    return;
  }
  if (getCurrentPage() === "asistente-ia.html" && canOpenAi && typeof bindInstituvaAi === "function") bindInstituvaAi();
  if (canOpenAi && getCurrentPage() !== "asistente-ia.html"
      && document.querySelector(".app-shell") && document.querySelector("[data-header]")) {
    const dockScript=document.createElement("script");
    dockScript.src="js/instituva-ai-dock.js?v=20261126-isolated-role-gate-1";
    document.head.appendChild(dockScript);
  }
  renderHeader();
  renderInlineIcons();
  bindHeaderActions();
  populateSystemDataSelects();
  bindMaterialsRequestModule();
  bindDigitalRouteModule();
  bindHumanResourcesModule();
  bindNotificationsModule();
  bindFinanceModule();
  if (typeof bindExternalAccountants === "function") bindExternalAccountants();
  bindExecutiveDirectionModule();
  bindReportsModule();
  await bindEmployeeProfile();
  bindSidebarToggle();
  bindNotificationMenu();
  // Embedded chat inherits the parent page inactivity policy.
  if (!(getCurrentPage() === "asistente-ia.html" &&
        new URLSearchParams(window.location.search).get("dock") === "1")) {
    bindIdleLogout();
  }
  bindRentalCatalog();
  bindRentalGeneralRules();
  bindRentalSpacePage();
  bindRentalForm();
  bindLoanReceiptForm();
  bindInventoryModule();
  if (typeof bindCollectionsCatalog === "function") await bindCollectionsCatalog();
  if (typeof bindCollectionIntake === "function") bindCollectionIntake();
  if (typeof bindCollectionDocument === "function") bindCollectionDocument();
  bindCalendarModules();
  bindMembershipsModule();
  await bindEmployeePortal();
  filterProfileModuleLinks();
}

document.addEventListener("DOMContentLoaded", initApp);
