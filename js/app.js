const appPages = {
  "index.html": {
    title: "Dashboard Principal",
    subtitle: "Bienvenido al sistema administrativo del museo."
  },
  "login.html": {
    title: "Entrar a mi cuenta",
    subtitle: "Acceso administrativo del Museo de la Musica."
  },
  "dashboard.html": {
    title: "Dashboard Principal",
    subtitle: "Bienvenido al sistema administrativo del museo."
  },
  "empleados.html": {
    title: "Empleados",
    subtitle: "Solicitud, adiestramiento, documentos y politicas."
  },
  "mantenimiento.html": {
    title: "Mantenimiento",
    subtitle: "Obras, materiales y ruta digital."
  },
  "ruta-digital.html": {
    title: "Ruta Digital",
    subtitle: "Recorridos, areas y seguimiento operacional."
  },
  "renta-espacios.html": {
    title: "Renta de Espacios",
    subtitle: "Solicitud de areas y tarifas oficiales."
  },
  "administracion.html": {
    title: "Administracion",
    subtitle: "Tareas, NAS, reportes, boletines y finanzas."
  },
  "reglamento.html": {
    title: "Reglamento",
    subtitle: "Normas oficiales, impresion y descarga."
  },
  "documentos.html": {
    title: "Formularios y Papeleria",
    subtitle: "Documentos oficiales y descargas."
  }
};

const navigationGroups = [
  {
    label: "Menu",
    items: [
      { href: "dashboard.html", label: "Dashboard", icon: "🏠" },
      { href: "empleados.html", label: "Empleados", icon: "👥" },
      { href: "mantenimiento.html", label: "Mantenimiento", icon: "🛠️" },
      { href: "ruta-digital.html", label: "Ruta Digital", icon: "🧭" },
      { href: "renta-espacios.html", label: "Renta de Espacios", icon: "🏛️" },
      { href: "documentos.html", label: "Formularios", icon: "📄" },
      { href: "administracion.html", label: "Administracion", icon: "⚙️" },
      { href: "reglamento.html", label: "Reglamento", icon: "📘" },
      { href: "login.html", label: "Mi cuenta", icon: "🔐" }
    ]
  }
];

function getCurrentPage() {
  const page = window.location.pathname.split("/").pop() || "index.html";
  return page === "" ? "index.html" : page;
}

function resolvePageMeta() {
  return appPages[getCurrentPage()] || appPages["dashboard.html"];
}

function renderSidebar() {
  const sidebar = document.querySelector("[data-sidebar]");
  if (!sidebar) return;

  const currentPage = getCurrentPage();
  const groupsMarkup = navigationGroups
    .map((group) => {
      const links = group.items
        .map((item) => {
          const isActive = item.href === currentPage || (currentPage === "index.html" && item.href === "dashboard.html");
          return `
            <li>
              <a class="nav-link${isActive ? " is-active" : ""}" href="${item.href}" aria-current="${isActive ? "page" : "false"}">
                <span class="nav-icon" aria-hidden="true">${item.icon}</span>
                <span>${item.label}</span>
              </a>
            </li>
          `;
        })
        .join("");

      return `
        <nav class="sidebar-section" aria-label="${group.label}">
          <p class="sidebar-section-title">${group.label}</p>
          <ul class="nav-list">${links}</ul>
        </nav>
      `;
    })
    .join("");

  sidebar.innerHTML = `
    <a class="brand" href="dashboard.html" aria-label="Museo de la Musica de Puerto Rico">
      <img class="brand-logo" src="images/logo-horizontal.jpg" alt="Museo de la Musica de Puerto Rico">
      <span class="brand-mark" aria-hidden="true">♫</span>
      <span class="brand-copy">
        <span class="brand-title">Museo de la Musica</span>
        <span class="brand-subtitle">Puerto Rico • Guaynabo</span>
      </span>
    </a>
    ${groupsMarkup}
  `;

  const logo = sidebar.querySelector(".brand-logo");
  const brand = sidebar.querySelector(".brand");
  if (logo && brand) {
    if (logo.complete && logo.naturalWidth > 0) {
      brand.classList.add("has-logo");
    }
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
        <span class="menu-lines" aria-hidden="true"></span>
      </button>
      <div class="header-title">
        <h1>${meta.title}</h1>
        <p>${meta.subtitle}</p>
      </div>
    </div>
    <div class="header-right">
      <a class="button secondary" href="login.html">Entrar a mi cuenta</a>
      <div class="user-pill" aria-label="Usuario actual">
        <span class="user-avatar" aria-hidden="true">GT</span>
        <span class="user-meta">
          <span class="user-name">Guillermo Torres</span>
          <span class="user-role">Administrador</span>
        </span>
      </div>
    </div>
  `;
}

function renderFooter() {
  const footer = document.querySelector("[data-footer]");
  if (!footer) return;

  footer.innerHTML = `
    <span>Museo de la Musica de Puerto Rico</span>
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
    if (message) {
      message.textContent = "Credenciales demo: admin / 123456";
    }
  });
}

function initApp() {
  renderSidebar();
  renderHeader();
  renderFooter();
  bindSidebarToggle();
  bindLoginDemo();
}

document.addEventListener("DOMContentLoaded", initApp);
