const appPages = {
  "index.html": { title: "Dashboard", subtitle: "Bienvenido, Guillermo Torres" },
  "dashboard.html": { title: "Dashboard", subtitle: "Bienvenido, Guillermo Torres" },
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
  "recibo-prestamo.html": { title: "Recibo de Préstamo", subtitle: "Formulario digital de artículos de colección mediante préstamo." },
  "boletin.html": { title: "Boletín Board", subtitle: "Publicaciones, anuncios y comunicaciones internas." },
  "inventario.html": { title: "Inventario de Equipos y Obras de Arte", subtitle: "Registro, consulta y localización de artículos del museo." }
};

const iconPaths = {
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
      { href: "documentos.html", label: "Formularios y Papelería", icon: "file", activePages: ["empleados.html", "recibo-prestamo.html", "reglamento.html"] },
      { href: "administracion.html", label: "Administración", icon: "shield", activePages: ["recursos-humanos.html", "perfil-empleado.html", "notificaciones.html", "reportes.html", "finanzas.html"] },
      { href: "boletin.html", label: "Boletín Board", icon: "megaphone" },
      { href: "inventario.html", label: "Inventario de Equipos y Obras de Arte", icon: "briefcase" },
      { href: "login.html", label: "Mi cuenta", icon: "logout" }
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

const employeeStorageKey = "museo-admin-employee-records";
const notificationStorageKey = "museo-admin-notification-preferences";
const financeStorageKey = "museo-admin-finance-records";
const financeAuditStorageKey = "museo-admin-finance-audit-log";
const rentalStorageKey = "museo-admin-rental-requests";
const rentalSpacesStorageKey = "museo-admin-rental-spaces";
const currentAccessLevel = () => localStorage.getItem("museo-admin-access-level") || "Administrador";
const canManageEmployees = () => ["Administrador", "Ejecutivo"].includes(currentAccessLevel());
const canDeleteEmployees = () => currentAccessLevel() === "Administrador";

function getEmployeeRecords() {
  const stored = JSON.parse(localStorage.getItem(employeeStorageKey) || "null");
  if (Array.isArray(stored) && stored.length) return stored;
  return Object.values(defaultEmployeeProfiles);
}

function saveEmployeeRecords(records) {
  localStorage.setItem(employeeStorageKey, JSON.stringify(records));
}

function getNotificationPreferences() {
  return JSON.parse(localStorage.getItem(notificationStorageKey) || "{}");
}

function saveNotificationPreferences(preferences) {
  localStorage.setItem(notificationStorageKey, JSON.stringify(preferences));
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
  { id: "exp-miscelaneos", type: "expense", category: "Otros Gastos", concept: "Misceláneos", values: [0,955.53,966.33,966.33,966.33,1006.33,966.33,1058.33,966.33,966.33,966.33,1006.33] },
  { id: "exp-contingencia", type: "expense", category: "Otros Gastos", concept: "Contingencia", values: [0,4777.67,4831.67,4831.67,4831.67,5031.67,4831.67,5291.67,4831.67,4831.67,4831.67,5031.67] },
  { id: "exp-reserva", type: "expense", category: "Otros Gastos", concept: "Gastos de representación", values: Array(12).fill(0) },
  { id: "exp-ahorros", type: "expense", category: "Otros Gastos", concept: "Ahorros", values: [0,955.53,966.33,966.33,966.33,1006.33,966.33,1058.33,966.33,966.33,966.33,1006.33] }
];

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
  return appPages[getCurrentPage()] || appPages["dashboard.html"];
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
  header.innerHTML = `
    <div class="header-left">
      <button class="menu-toggle" type="button" aria-label="Abrir navegacion" data-menu-toggle>
        <span class="menu-lines"></span>
      </button>
      <div class="header-title">
        <h1>${meta.title}</h1>
        <p>${meta.subtitle}</p>
      </div>
    </div>
    <div class="header-right">
      <button class="notification-button" type="button" aria-label="Notificaciones">
        ${iconSvg("bell")}
        <span class="notification-badge">3</span>
      </button>
      <a class="account-button" href="login.html">
        ${iconSvg("users")}
        <span>Entrar a mi cuenta</span>
        ${iconSvg("chevron")}
      </a>
    </div>
  `;
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

function bindLoginDemo() {
  const form = document.querySelector("[data-login-form]");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const username = formData.get("username");
    const password = formData.get("password");

    if (username === "admin" && password === "123456") {
      window.location.href = "dashboard.html";
      return;
    }

    const message = document.querySelector("[data-login-message]");
    if (message) message.textContent = "Credenciales demo: admin / 123456";
  });
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
  const currentUser = () => localStorage.getItem("museo-admin-current-user") || "Administrador";
  const canAdjust = () => ["Administrador", "Ejecutivo"].includes(currentAccessLevel());
  const getSpaces = () => JSON.parse(localStorage.getItem(rentalSpacesStorageKey) || "null") || defaultRentalSpaces;
  const saveSpaces = (spaces) => localStorage.setItem(rentalSpacesStorageKey, JSON.stringify(spaces));
  const getRequests = () => JSON.parse(localStorage.getItem(rentalStorageKey) || "[]");
  const saveRequests = (requests) => localStorage.setItem(rentalStorageKey, JSON.stringify(requests));
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

  const syncApprovedRequest = (request) => {
    const calendarRecords = JSON.parse(localStorage.getItem("museo-admin-general-calendar") || "[]");
    if (!calendarRecords.some((item) => item.rentalId === request.id)) {
      calendarRecords.push({
        id: `rental-calendar-${request.id}`,
        rentalId: request.id,
        fecha: request.fecha,
        titulo: `Arrendamiento: ${request.espacio}`,
        descripcion: `${request.tipoActividad} - ${request.nombre}`
      });
      localStorage.setItem("museo-admin-general-calendar", JSON.stringify(calendarRecords));
    }

    const financeRows = JSON.parse(localStorage.getItem(financeStorageKey) || "null") || defaultFinanceRows;
    const rentalRow = financeRows.find((row) => row.id === "ing-salas");
    if (rentalRow) {
      const month = new Date(`${request.fecha}T12:00:00`).getMonth();
      const fiscalIndex = [6,7,8,9,10,11,0,1,2,3,4,5].indexOf(month);
      if (fiscalIndex >= 0) rentalRow.values[fiscalIndex] = Number(rentalRow.values[fiscalIndex] || 0) + Number(request.total || 0);
      localStorage.setItem(financeStorageKey, JSON.stringify(financeRows));
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

  form.addEventListener("submit", (event) => {
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
    const requests = getRequests();
    const space = selectedSpace();
    const calc = currentCalculation();
    const request = {
      id: `rental-${Date.now()}`,
      numeroSolicitud: createSequence("SOL", requests.length),
      numeroRecibo: createSequence("REC", requests.length),
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

    requests.push(request);
    saveRequests(requests);
    if (request.estado === "Aprobada") syncApprovedRequest(request);
    renderHistory();
    form.reset();
    renderSpaceDetail();
    renderCalculation();
    setMessage(`Solicitud ${request.numeroSolicitud} registrada correctamente.`, "success");
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

  configPanel?.addEventListener("change", (event) => {
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
    saveSpaces(spaces);
    populateSpaces();
    renderSpaceDetail();
    renderCalculation();
    setMessage("Configuración del espacio actualizada.", "success");
  });

  populateSpaces();
  renderSpaceDetail();
  renderCalculation();
  renderHistory();
  renderConfig();
}

function bindLoanReceiptForm() {
  const form = document.querySelector("#loan-receipt-form");
  if (!form) return;

  form.addEventListener("submit", (event) => {
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
    const body = [
      "Formulario de Recibo de Artículos de Colección Mediante Préstamo",
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

    const mailto = new URL("mailto:guillermotorrespr@gmail.com");
    mailto.searchParams.set("subject", `Recibo de préstamo - ${data.get("articulo")}`);
    mailto.searchParams.set("body", body);

    if (message) {
      message.textContent = "Formulario validado. Se abrira el correo para enviar la información al administrador.";
      message.className = "form-message success";
    }

    window.location.href = mailto.toString();
  });
}

function bindInventoryModule() {
  const form = document.querySelector("#inventory-form");
  if (!form) return;

  const storageKey = "museo-admin-inventory-records";
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
  let records = JSON.parse(localStorage.getItem(storageKey) || "[]");
  let sortKey = "fecha";
  let sortDirection = "desc";

  const saveRecords = () => localStorage.setItem(storageKey, JSON.stringify(records));
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
      list.innerHTML = `<tr><td colspan="8">No hay artículos registrados.</td></tr>`;
      return;
    }

    list.innerHTML = filteredRecords.map((record) => `
      <tr>
        <td>${escapeHtml(record.nombre)}</td>
        <td>${escapeHtml(record.descripcion)}</td>
        <td>${escapeHtml(record.sello)}</td>
        <td>${escapeHtml(record.ubicacion)}</td>
        <td>${escapeHtml(record.estado)}</td>
        <td>${escapeHtml(record.contacto || "N/A")}</td>
        <td>${escapeHtml(record.fecha)}</td>
        <td>
          <div class="table-actions">
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
    if (submitButton) submitButton.textContent = "Guardar Registro";
    if (cancelButton) cancelButton.hidden = true;
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const id = data.get("id");
    const record = {
      id: id || createId(),
      nombre: data.get("nombre").trim(),
      descripcion: data.get("descripcion").trim(),
      sello: data.get("sello").trim(),
      ubicacion: data.get("ubicacion"),
      estado: data.get("estado"),
      contacto: data.get("contacto").trim(),
      fecha: id ? records.find((item) => item.id === id)?.fecha : new Date().toLocaleDateString("es-PR")
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

    records = id ? records.map((item) => item.id === id ? record : item) : [record, ...records];
    saveRecords();
    resetForm();
    setMessage(id ? "Registro actualizado correctamente." : "Registro guardado correctamente.", "success");
    renderRecords();
  });

  document.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-inventory-edit]");
    const deleteButton = event.target.closest("[data-inventory-delete]");
    const sortButton = event.target.closest("[data-inventory-sort]");

    if (editButton) {
      const record = records.find((item) => item.id === editButton.dataset.inventoryEdit);
      if (!record) return;
      Object.entries(record).forEach(([key, value]) => {
        const field = form.elements[key];
        if (field) field.value = value;
      });
      if (submitButton) submitButton.textContent = "Actualizar Registro";
      if (cancelButton) cancelButton.hidden = false;
      setMessage("Editando registro seleccionado.", "");
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (deleteButton) {
      const record = records.find((item) => item.id === deleteButton.dataset.inventoryDelete);
      if (!record) return;
      if (!confirm(`¿Eliminar el registro "${record.nombre}"?`)) return;
      records = records.filter((item) => item.id !== record.id);
      saveRecords();
      renderRecords();
      setMessage("Registro eliminado.", "success");
    }

    if (sortButton) {
      const nextSort = sortButton.dataset.inventorySort;
      if (sortKey === nextSort) {
        sortDirection = sortDirection === "asc" ? "desc" : "asc";
      } else {
        sortKey = nextSort;
        sortDirection = "asc";
      }
      renderRecords();
    }
  });

  if (cancelButton) {
    cancelButton.addEventListener("click", () => {
      resetForm();
      setMessage("");
    });
  }

  [search, locationFilter, statusFilter].forEach((control) => {
    if (control) control.addEventListener("input", renderRecords);
  });

  populateFilters();
  renderRecords();
}

function bindCalendarModules() {
  const panel = document.querySelector("[data-calendar-module]");
  if (!panel) return;

  const moduleType = panel.dataset.calendarModule;
  const isMaintenance = moduleType === "maintenance";
  const isUshers = moduleType === "ushers";
  const storageKey = isMaintenance
    ? "museo-admin-work-calendar"
    : isUshers
      ? "museo-admin-ushers-calendar"
      : "museo-admin-general-calendar";
  const form = panel.querySelector("[data-calendar-form]");
  const grid = panel.querySelector("[data-calendar-grid]");
  const title = panel.querySelector("[data-calendar-title]");
  const message = panel.querySelector("[data-calendar-message]");
  const submitButton = panel.querySelector("[data-calendar-submit]");
  const cancelButton = panel.querySelector("[data-calendar-cancel]");
  const usherSelect = panel.querySelector("[data-usher-select]");
  const areaSelect = panel.querySelector("[data-area-select]");
  const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  let activeDate = new Date();
  let records = JSON.parse(localStorage.getItem(storageKey) || "[]");

  const saveRecords = () => localStorage.setItem(storageKey, JSON.stringify(records));
  const currentAccessLevel = localStorage.getItem("museo-admin-access-level") || "Administrador";
  const canEdit = () => ["Ejecutivo", "Administrador"].includes(currentAccessLevel);
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

  const describeRecord = (record) => {
    if (isMaintenance) {
      return `Empleado: ${record.empleado}\nTarea: ${record.tarea}\nÁrea: ${record.area || "Sin área"}\nEstado: ${record.estado || "Pendiente"}\nFecha: ${record.fecha}`;
    }
    if (isUshers) {
      return `Ujier: ${record.ujier}\nHorario: ${record.horario}\nÁrea: ${record.area}\nFecha: ${record.fecha}`;
    }
    return `Evento: ${record.titulo}\nDescripción: ${record.descripcion || "Sin descripción"}\nFecha: ${record.fecha}`;
  };

  const setEditableState = () => {
    const allowed = canEdit();
    form.querySelectorAll("input, select, textarea, button").forEach((field) => {
      field.disabled = !allowed;
    });
    form.hidden = !allowed;
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
            : `<strong>${escapeHtml(record.titulo)}</strong><span>${escapeHtml(record.descripcion || "Sin descripción")}</span>`;
        const actions = canEdit()
          ? `<div class="calendar-item-actions"><button type="button" data-calendar-edit="${record.id}">Editar</button><button type="button" data-calendar-delete="${record.id}">Eliminar</button></div>`
          : "";
        return `<article class="calendar-item" data-calendar-view="${record.id}">${body}${actions}</article>`;
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
  };

  form.addEventListener("submit", (event) => {
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
            titulo: data.get("titulo").trim(),
            descripcion: data.get("descripcion").trim()
          };

    const isInvalid = isMaintenance
      ? !record.fecha || !record.empleado || !record.tarea
      : isUshers
        ? !record.fecha || !record.ujier || !record.horario || !record.area
        : !record.fecha || !record.titulo;
    if (isInvalid) {
      setMessage("Complete los campos requeridos antes de guardar.", "error");
      return;
    }

    records = id ? records.map((item) => item.id === id ? record : item) : [...records, record];
    saveRecords();
    activeDate = new Date(`${record.fecha}T12:00:00`);
    resetForm();
    setMessage(id ? "Registro actualizado correctamente." : "Registro guardado correctamente.", "success");
    renderCalendar();
  });

  panel.addEventListener("click", (event) => {
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
    }

    if (editButton) {
      if (!canEdit()) return;
      const record = records.find((item) => item.id === editButton.dataset.calendarEdit);
      if (!record) return;
      Object.entries(record).forEach(([key, value]) => {
        const field = form.elements[key];
        if (field) field.value = value;
      });
      if (submitButton) submitButton.textContent = isMaintenance ? "Actualizar Tarea" : isUshers ? "Actualizar Asignación" : "Actualizar Evento";
      if (cancelButton) cancelButton.hidden = false;
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (deleteButton) {
      if (!canEdit()) return;
      const record = records.find((item) => item.id === deleteButton.dataset.calendarDelete);
      if (!record) return;
      if (!confirm("¿Eliminar este registro del calendario?")) return;
      records = records.filter((item) => item.id !== record.id);
      saveRecords();
      renderCalendar();
      setMessage("Registro eliminado.", "success");
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
  cancelButton?.addEventListener("click", () => {
    resetForm();
    setMessage("");
  });
  populateUshers();
  populateAreas();
  setEditableState();
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

function bindHumanResourcesModule() {
  const module = document.querySelector("[data-hr-module]");
  if (!module) return;

  const directory = module.querySelector("[data-employee-directory]");
  const form = module.querySelector("[data-employee-form]");
  const submitButton = module.querySelector("[data-employee-submit]");
  const cancelButton = module.querySelector("[data-employee-cancel]");
  const message = module.querySelector("[data-employee-message]");
  const photoInput = module.querySelector("[data-employee-photo-picker]");
  let selectedPhoto = "";

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
      const deleteButton = canDeleteEmployees()
        ? `<button type="button" data-employee-delete="${employee.id}">Eliminar</button>`
        : "";
      const adminActions = canManageEmployees()
        ? `
          <button type="button" data-employee-edit="${employee.id}">Editar</button>
          <button type="button" data-employee-reset="${employee.id}">Restablecer contraseña</button>
          <button type="button" data-employee-toggle="${employee.id}">${isInactive ? "Activar" : "Desactivar"}</button>
          ${deleteButton}
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
            <a href="perfil-empleado.html?empleado=${encodeURIComponent(employee.id)}">Ver Perfil</a>
            ${adminActions}
          </span>
        </article>
      `;
    }).join("");
  };

  const resetForm = () => {
    form.reset();
    form.elements.id.value = "";
    selectedPhoto = "";
    if (photoInput) photoInput.value = "";
    if (submitButton) submitButton.textContent = "Crear Empleado";
    if (cancelButton) cancelButton.hidden = true;
  };

  const loadForm = (employee) => {
    Object.entries(employee).forEach(([key, value]) => {
      const field = form.elements[key];
      if (field && key !== "foto") field.value = value || "";
    });
    form.elements.id.value = employee.id;
    selectedPhoto = employee.foto || "";
    if (submitButton) submitButton.textContent = "Actualizar Empleado";
    if (cancelButton) cancelButton.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!canManageEmployees()) {
    form.hidden = true;
  }

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
        setMessage("Fotografía lista para guardar con el empleado.", "success");
      });
      reader.readAsDataURL(file);
    });
  }

  form.addEventListener("submit", (event) => {
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

    if (!employee.nombre || !employee.apellidos || !employee.posicion || !employee.departamento || !employee.correo || !employee.usuario || !employee.passwordTemporal) {
      setMessage("Complete los campos obligatorios antes de crear el empleado.", "error");
      return;
    }

    const records = getEmployeeRecords();
    const nextRecords = existing
      ? records.map((item) => item.id === id ? employee : item)
      : [...records, employee];
    saveEmployeeRecords(nextRecords);
    renderDirectory();
    resetForm();
    setMessage(existing ? "Empleado actualizado correctamente." : "Empleado creado y agregado al directorio.", "success");
  });

  directory.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-employee-edit]");
    const resetButton = event.target.closest("[data-employee-reset]");
    const toggleButton = event.target.closest("[data-employee-toggle]");
    const deleteButton = event.target.closest("[data-employee-delete]");
    const records = getEmployeeRecords();

    if (editButton) {
      const employee = records.find((item) => item.id === editButton.dataset.employeeEdit);
      if (employee) loadForm(employee);
    }

    if (resetButton) {
      const employee = records.find((item) => item.id === resetButton.dataset.employeeReset);
      if (!employee) return;
      const password = prompt("Nueva contraseña temporal:", "Temporal-2026");
      if (!password) return;
      saveEmployeeRecords(records.map((item) => item.id === employee.id ? { ...item, passwordTemporal: password } : item));
      setMessage(`Contraseña temporal restablecida para ${employeeDisplayName(employee)}.`, "success");
    }

    if (toggleButton) {
      const employee = records.find((item) => item.id === toggleButton.dataset.employeeToggle);
      if (!employee) return;
      const estado = employee.estado === "Inactivo" ? "Activo" : "Inactivo";
      saveEmployeeRecords(records.map((item) => item.id === employee.id ? { ...item, estado } : item));
      renderDirectory();
      setMessage(`Empleado ${estado.toLowerCase()} correctamente.`, "success");
    }

    if (deleteButton) {
      if (!canDeleteEmployees()) return;
      const employee = records.find((item) => item.id === deleteButton.dataset.employeeDelete);
      if (!employee || !confirm(`¿Eliminar a ${employeeDisplayName(employee)} del directorio?`)) return;
      saveEmployeeRecords(records.filter((item) => item.id !== employee.id));
      renderDirectory();
      setMessage("Empleado eliminado del directorio.", "success");
    }
  });

  cancelButton?.addEventListener("click", () => {
    resetForm();
    setMessage("");
  });

  renderDirectory();
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
  const canEdit = canManageEmployees();
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
      <span>${enabled ? "Sí" : "No"}</span>
    </label>
  `;

  const render = () => {
    const employees = getEmployeeRecords();
    const preferences = getNotificationPreferences();
    list.innerHTML = employees.map((employee) => {
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
    }).join("");

    setMessage(canEdit
      ? "Configuración lista para integrarse con sensores, ponche electrónico, seguridad y bases de datos."
      : "Su rol permite consultar estas configuraciones, pero no modificarlas."
    );
  };

  module.addEventListener("change", (event) => {
    const toggle = event.target.closest("[data-notification-toggle]");
    if (!toggle || !canEdit) return;

    const preferences = getNotificationPreferences();
    const employeeId = toggle.dataset.employeeId;
    const type = toggle.dataset.notificationType;
    preferences[employeeId] = employeePreferences(preferences, employeeId);
    preferences[employeeId][type] = toggle.checked;
    saveNotificationPreferences(preferences);

    const label = toggle.closest(".switch-control")?.querySelector("span");
    if (label) label.textContent = toggle.checked ? "Sí" : "No";
    setMessage("Preferencia de notificación actualizada.", "success");
  });

  render();
}

function bindFinanceModule() {
  const module = document.querySelector("[data-finance-module]");
  const gate = document.querySelector("[data-finance-gate]");
  if (!module || !gate) return;

  const loginForm = document.querySelector("[data-finance-login]");
  const loginMessage = document.querySelector("[data-finance-login-message]");
  const summary = document.querySelector("[data-finance-summary]");
  const panel = document.querySelector("[data-finance-panel]");
  const tabs = document.querySelectorAll("[data-finance-tab]");
  const allowedUsers = {
    "Guillermo Torres": "museo2026",
    "Alberto Soto": "museo2026",
    "Contable del Museo": "museo2026"
  };
  let activeTab = "resumen";
  let currentUser = "";
  let rows = JSON.parse(localStorage.getItem(financeStorageKey) || "null") || defaultFinanceRows;

  const money = (value) => Number(value || 0).toLocaleString("es-PR", { style: "currency", currency: "USD" });
  const rowTotal = (row) => row.values.reduce((sum, value) => sum + Number(value || 0), 0);
  const rowsByType = (type) => rows.filter((row) => row.type === type);
  const totalByType = (type) => rowsByType(type).reduce((sum, row) => sum + rowTotal(row), 0);
  const monthTotal = (type, monthIndex) => rowsByType(type).reduce((sum, row) => sum + Number(row.values[monthIndex] || 0), 0);
  const saveRows = () => localStorage.setItem(financeStorageKey, JSON.stringify(rows));
  const audit = () => JSON.parse(localStorage.getItem(financeAuditStorageKey) || "[]");
  const saveAudit = (entries) => localStorage.setItem(financeAuditStorageKey, JSON.stringify(entries.slice(-250)));
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

  rows = normalizeRows(rows);
  saveRows();

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
    const net = income - expense;
    const monthlyExpense = expense / financeMonths.length;
    return {
      income,
      expense,
      net,
      budget: Math.max(net, 0),
      monthlyExpense,
      balance: net
    };
  };

  const renderSummary = () => {
    const data = totals();
    const cards = [
      ["Ingresos Totales", data.income, "theme-green"],
      ["Gastos Totales", data.expense, "theme-red"],
      ["Ingresos Netos", data.net, data.net >= 0 ? "theme-teal" : "theme-red"],
      ["Presupuesto Disponible", data.budget, "theme-purple"],
      ["Gasto Mensual Promedio", data.monthlyExpense, "theme-gold"],
      ["Balance del Año", data.balance, data.balance >= 0 ? "theme-blue" : "theme-red"]
    ];
    summary.innerHTML = cards.map(([label, value, theme]) => `
      <article class="finance-kpi ${theme}">
        <span>${label}</span>
        <strong>${money(value)}</strong>
      </article>
    `).join("");
  };

  const renderMonthlySummary = () => `
    <div class="table-wrap">
      <table class="data-table finance-table">
        <thead>
          <tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Ingresos Netos</th></tr>
        </thead>
        <tbody>
          ${financeMonths.map((month, index) => {
            const income = monthTotal("income", index);
            const expense = monthTotal("expense", index);
            return `<tr><td>${month}</td><td>${money(income)}</td><td>${money(expense)}</td><td>${money(income - expense)}</td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

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
              <th>Total Anual</th>
            </tr>
          </thead>
          <tbody>
            ${visibleRows.map((row) => {
              const categoryRow = row.category !== lastCategory ? `<tr class="finance-category-row"><td colspan="14">${row.category}</td></tr>` : "";
              lastCategory = row.category;
              return `${categoryRow}<tr>
                <td><strong>${safeHtml(row.concept)}</strong></td>
                ${row.values.map((value, index) => `
                  <td><input class="finance-cell" type="number" step="0.01" value="${Number(value || 0)}" data-finance-row="${row.id}" data-finance-month="${index}"></td>
                `).join("")}
                <td><strong>${money(rowTotal(row))}</strong></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
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
    <h3>Preparado para Próximas Funciones</h3>
    <div class="finance-config-grid">
      ${["Cálculo automático de nómina", "Aumentos salariales", "Nuevos empleados", "Carga patronal", "Seguro Social", "Plan Médico", "Deducciones", "Presupuestos por departamento", "Presupuesto vs. gasto real", "Flujo de efectivo", "Proyecciones financieras", "Gráficas financieras", "Reportes para Junta de Directores"].map((item) => `<span>${item}</span>`).join("")}
    </div>
  `;

  const renderPanel = () => {
    renderSummary();
    if (activeTab === "resumen") panel.innerHTML = `<p class="page-kicker">Resumen</p><h3>Resumen Mensual</h3>${renderMonthlySummary()}`;
    if (activeTab === "ingresos") panel.innerHTML = renderFinanceTable("Ingresos", (row) => row.type === "income");
    if (activeTab === "gastos") panel.innerHTML = renderFinanceTable("Gastos", (row) => row.type === "expense");
    if (activeTab === "nomina") panel.innerHTML = renderFinanceTable("Nómina", (row) => row.category === "Nómina" || row.category === "Beneficios");
    if (activeTab === "otros") panel.innerHTML = renderFinanceTable("Otros Gastos", (row) => row.category === "Otros Gastos" || row.category === "Gastos Operacionales");
    if (activeTab === "reportes") panel.innerHTML = renderReports();
    if (activeTab === "configuracion") panel.innerHTML = renderConfiguration();
  };

  const openModule = () => {
    gate.hidden = true;
    gate.style.display = "none";
    module.hidden = false;
    module.style.display = "";
    renderPanel();
  };

  const exportCsv = () => {
    const lines = [["Tipo", "Categoría", "Concepto", ...financeMonths, "Total Anual"]];
    rows.forEach((row) => lines.push([row.type, row.category, row.concept, ...row.values, rowTotal(row)]));
    const csv = lines.map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "finanzas-museo.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  loginForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(loginForm);
    const user = data.get("usuario");
    const password = data.get("password");
    if (allowedUsers[user] !== password) {
      loginMessage.textContent = "Credenciales inválidas.";
      loginMessage.className = "form-message error";
      return;
    }
    currentUser = user;
    openModule();
  });

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activeTab = tab.dataset.financeTab;
      tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
      renderPanel();
    });
  });

  panel.addEventListener("change", (event) => {
    const input = event.target.closest("[data-finance-row]");
    if (!input) return;
    const row = rows.find((item) => item.id === input.dataset.financeRow);
    const monthIndex = Number(input.dataset.financeMonth);
    const previousValue = Number(row.values[monthIndex] || 0);
    const nextValue = Number(input.value || 0);
    row.values[monthIndex] = nextValue;
    saveRows();
    addAudit(row, monthIndex, previousValue, nextValue);
    renderPanel();
  });

  document.querySelector("[data-finance-export-excel]")?.addEventListener("click", exportCsv);
  document.querySelector("[data-finance-export-pdf]")?.addEventListener("click", () => window.print());
  document.querySelector("[data-finance-print]")?.addEventListener("click", () => window.print());
}

function bindEmployeeProfile() {
  const profileCard = document.querySelector(".employee-profile");
  if (!profileCard) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("empleado") || "guillermo-torres";
  const profile = getEmployeeById(id);

  const avatar = document.querySelector("[data-profile-avatar]");
  const name = document.querySelector("[data-profile-name]");
  const position = document.querySelector("[data-profile-position]");
  const photo = document.querySelector("[data-employee-photo]");
  const photoInput = document.querySelector("[data-employee-photo-input]");
  const photoRemove = document.querySelector("[data-employee-photo-remove]");
  const photoMessage = document.querySelector("[data-employee-photo-message]");

  if (avatar) avatar.textContent = profile.avatar || employeeInitials(profile);
  if (name) name.textContent = employeeDisplayName(profile);
  if (position) position.textContent = profile.posicion;

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
      if (photoMessage) photoMessage.textContent = "Foto guardada localmente para este perfil.";
      return;
    }

    photo.removeAttribute("src");
    photo.hidden = true;
    avatar.hidden = false;
    if (photoRemove) photoRemove.hidden = true;
    if (photoMessage) photoMessage.textContent = "La foto servirá como identificación visual del récord del empleado.";
  };

  showPhoto(profile.foto || localStorage.getItem(`museo-admin-employee-photo-${profile.id}`));

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
        try {
          const records = getEmployeeRecords().map((employee) => employee.id === profile.id ? { ...employee, foto: reader.result } : employee);
          saveEmployeeRecords(records);
          showPhoto(reader.result);
        } catch (error) {
          showPhoto(reader.result);
          if (photoMessage) photoMessage.textContent = "La foto se puede ver, pero el navegador no permitio guardarla localmente.";
        }
      });
      reader.readAsDataURL(file);
    });
  }

  if (photoRemove) {
    photoRemove.addEventListener("click", () => {
      const records = getEmployeeRecords().map((employee) => employee.id === profile.id ? { ...employee, foto: "" } : employee);
      saveEmployeeRecords(records);
      if (photoInput) photoInput.value = "";
      showPhoto("");
    });
  }
}

function initApp() {
  renderSidebar();
  renderHeader();
  renderFooter();
  renderInlineIcons();
  populateSystemDataSelects();
  bindHumanResourcesModule();
  bindNotificationsModule();
  bindFinanceModule();
  bindEmployeeProfile();
  bindSidebarToggle();
  bindLoginDemo();
  bindRentalForm();
  bindLoanReceiptForm();
  bindInventoryModule();
  bindCalendarModules();
}

document.addEventListener("DOMContentLoaded", initApp);




