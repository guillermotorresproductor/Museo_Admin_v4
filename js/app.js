const appPages = {
  "index.html": { title: "Dashboard", subtitle: "Bienvenido, Guillermo Torres" },
  "dashboard.html": { title: "Dashboard", subtitle: "Bienvenido, Guillermo Torres" },
  "login.html": { title: "Entrar a mi cuenta", subtitle: "Acceso administrativo del Museo de la Música." },
  "empleados.html": { title: "Solicitud de Empleo", subtitle: "Formulario para candidatos." },
  "mantenimiento.html": { title: "Mantenimiento", subtitle: "Operación preventiva y correctiva." },
  "calendario-obras.html": { title: "Calendario", subtitle: "Asignación de empleados, horarios y deberes." },
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
  "documentos.html": { title: "Formularios y Papelería", subtitle: "Stationary, reglamento y formularios oficiales." },
  "recibo-prestamo.html": { title: "Recibo de Préstamo", subtitle: "Formulario digital de artículos de colección mediante préstamo." },
  "boletin.html": { title: "Boletín Board", subtitle: "Publicaciones, anuncios y comunicaciones internas." }
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
      { href: "calendario-obras.html", label: "Calendario", icon: "calendar" },
      { href: "renta-espacios.html", label: "Renta de Espacios", icon: "building" },
      { href: "empleados.html", label: "Solicitud de Empleo", icon: "users" },
      { href: "mantenimiento.html", label: "Mantenimiento", icon: "wrench", activePages: ["solicitud-materiales.html", "ruta-digital.html"] },
      { href: "documentos.html", label: "Formularios y Papelería", icon: "file", activePages: ["recibo-prestamo.html", "reglamento.html"] },
      { href: "administracion.html", label: "Administración", icon: "shield", activePages: ["recursos-humanos.html", "perfil-empleado.html", "notificaciones.html", "reportes.html", "finanzas.html"] },
      { href: "boletin.html", label: "Boletín Board", icon: "megaphone" },
      { href: "login.html", label: "Mi cuenta", icon: "logout" }
    ]
  }
];

const employeeProfiles = {
  "guillermo-torres": {
    avatar: "GT",
    nombre: "Guillermo Torres",
    direccion: "Guaynabo, Puerto Rico",
    telefono: "787-000-0000",
    correo: "guillermotorrespr@gmail.com",
    educacion: "Graduado",
    condicion: "Ninguna registrada",
    posicion: "Administrador",
    horario: "Lunes a viernes, 8:00 AM - 4:00 PM",
    notificaciones: "Recibe notificaciones administrativas, cambios de horario y alertas internas.",
    acceso: "Administrador"
  },
  "juan-perez": {
    avatar: "JP",
    nombre: "Juan Perez",
    direccion: "Guaynabo, Puerto Rico",
    telefono: "787-000-0000",
    correo: "juan.perez@museodelamusica.pr",
    educacion: "Graduado",
    condicion: "Ninguna registrada",
    posicion: "Mantenimiento",
    horario: "Lunes a viernes, 8:00 AM - 4:00 PM",
    notificaciones: "Recibe avisos de ruta digital, materiales y calendario de obras.",
    acceso: "Empleado"
  },
  "dora-ortiz": {
    avatar: "DO",
    nombre: "Dora Ortiz",
    direccion: "Guaynabo, Puerto Rico",
    telefono: "787-000-0000",
    correo: "dora.ortiz@museodelamusica.pr",
    educacion: "Estudiante",
    condicion: "Ninguna registrada",
    posicion: "Mantenimiento",
    horario: "Martes a sábado, 8:00 AM - 4:00 PM",
    notificaciones: "Recibe avisos de inspección, mantenimiento preventivo y tareas asignadas.",
    acceso: "Empleado"
  }
};

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
      `Área solicitada: ${data.get("área")}`,
      `Día del evento: ${data.get("fecha")}`,
      `Hora del evento: ${data.get("hora")}`,
      `Cantidad estimada de invitados: ${data.get("invitados")}`,
      "",
      "Propósito del evento:",
      data.get("propósito"),
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
      `Propósito: ${data.get("propósito")}`,
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

function renderInlineIcons() {
  document.querySelectorAll("[data-icon]").forEach((element) => {
    element.innerHTML = iconSvg(element.dataset.icon);
  });
}

function bindEmployeeProfile() {
  const profileCard = document.querySelector(".employee-profile");
  if (!profileCard) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("empleado") || "guillermo-torres";
  const profile = employeeProfiles[id] || employeeProfiles["guillermo-torres"];

  const avatar = document.querySelector("[data-profile-avatar]");
  const name = document.querySelector("[data-profile-name]");
  const position = document.querySelector("[data-profile-position]");
  const photo = document.querySelector("[data-employee-photo]");
  const photoInput = document.querySelector("[data-employee-photo-input]");
  const photoRemove = document.querySelector("[data-employee-photo-remove]");
  const photoMessage = document.querySelector("[data-employee-photo-message]");
  const storageKey = `museo-admin-employee-photo-${id}`;

  if (avatar) avatar.textContent = profile.avatar;
  if (name) name.textContent = profile.nombre;
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
    if (photoMessage) photoMessage.textContent = "La foto servira como identificación visual del récord del empleado.";
  };

  showPhoto(localStorage.getItem(storageKey));

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
          localStorage.setItem(storageKey, reader.result);
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
      localStorage.removeItem(storageKey);
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
  bindEmployeeProfile();
  bindSidebarToggle();
  bindLoginDemo();
  bindRentalForm();
  bindLoanReceiptForm();
}

document.addEventListener("DOMContentLoaded", initApp);




