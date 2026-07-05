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

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = document.querySelector("[data-rental-message]");
    const requiredFields = Array.from(form.querySelectorAll("[required]"));
    const invalidFields = requiredFields.filter((field) => {
      if (field.type === "checkbox") return !field.checked;
      return !field.value.trim();
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

    const data = new FormData(form);
    const body = [
      "Solicitud de Renta de Espacios",
      "",
      `Nombre del solicitante: ${data.get("nombre")}`,
      `Correo electrónico: ${data.get("correo")}`,
      `Teléfono: ${data.get("telefono")}`,
      `Entidad u organizacion: ${data.get("organizacion")}`,
      `Área solicitada: ${data.get("area")}`,
      `Día del evento: ${data.get("fecha")}`,
      `Hora del evento: ${data.get("hora")}`,
      `Cantidad estimada de invitados: ${data.get("invitados")}`,
      "",
      "Propósito del evento:",
      data.get("proposito"),
      "",
      "El solicitante certifica que leyo y acepta los términos y condiciones para el alquiler de espacios."
    ].join("\n");

    const mailto = new URL("mailto:guillermotorrespr@gmail.com");
    mailto.searchParams.set("subject", `Solicitud de renta de espacios - ${data.get("nombre")}`);
    mailto.searchParams.set("body", body);

    if (message) {
      message.textContent = "Solicitud validada. Se abrira el correo para enviar la solicitud al administrador.";
      message.className = "form-message success";
    }

    window.location.href = mailto.toString();
  });
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
  bindEmployeeProfile();
  bindSidebarToggle();
  bindLoginDemo();
  bindRentalForm();
  bindLoanReceiptForm();
  bindInventoryModule();
  bindCalendarModules();
}

document.addEventListener("DOMContentLoaded", initApp);




