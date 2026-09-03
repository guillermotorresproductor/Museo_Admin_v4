import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const config = read("js/config.js");
const app = read("js/app.js");
const service = read("js/services/supabase.js");
const css = read("css/main.css");
const index = read("index.html");
const login = read("login.html");

test("mmdpr.org queda bloqueado a Producción y demo.instituva.com a Staging", () => {
  assert.match(config, /"mmdpr\.org": "production"/);
  assert.match(config, /"www\.mmdpr\.org": "production"/);
  assert.match(config, /"demo\.instituva\.com": "staging"/);
  assert.match(config, /const museoEnvironmentName = hostEnvironment \|\|/);
});

test("la raíz redirige al login sin renderizar el Dashboard", () => {
  assert.match(index, /window\.location\.replace\("login\.html"\)/);
  assert.match(index, /<body aria-hidden="true">/);
});

test("el login inicial contiene solo la identidad y controles privados", () => {
  assert.match(login, /<body class="login-page">/);
  assert.match(login, /assets\/brand\/mmpr-logo-login\.webp/);
  assert.match(login, /type="email"/);
  assert.match(login, />Entrar</);
  assert.match(login, />Olvidé mi contraseña</);
  assert.doesNotMatch(login, /data-notification-menu-button/);
  assert.match(css, /body:not\(\.login-page\):not\(\.app-ready\)/);
  assert.match(css, /\.login-page \.sidebar[\s\S]*display: none !important/);
});

test("las páginas privadas se revelan solo después de validar permisos", () => {
  const permissionCheck = app.indexOf("await refreshCurrentPermissions()");
  const reveal = app.indexOf('document.body.classList.add("app-ready")');
  assert.ok(permissionCheck >= 0 && reveal > permissionCheck);
  assert.doesNotMatch(app, /page === "login\.html" \|\| page === "dashboard\.html"/);
  assert.match(app, /const postLoginDestination = \(\) => "dashboard\.html"/);
});

test("mmdpr.org no agrega environment al login ni a recuperación", () => {
  assert.match(app, /isMuseumProductionHost/);
  assert.match(service, /isMuseumProductionHost/);
});

test("las rutas sin extensión se normalizan y mmdpr abre el Dashboard", () => {
  assert.match(app, /if \(segment\.includes\("\."\)\) return segment;/);
  assert.match(app, /return `\$\{segment\}\.html`;/);
  assert.match(app, /isMuseumProductionHost\(\)\) \{\s*return postLoginDestination\(\);/);
});
