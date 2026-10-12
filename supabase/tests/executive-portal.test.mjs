import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire("C:/Users/guill/AppData/Local/Temp/museo-jsdom/package.json");
const { JSDOM } = require("jsdom");
const app = fs.readFileSync("js/app.js", "utf8");
const html = fs.readFileSync("employee-portal.html", "utf8");
const css = fs.readFileSync("css/main.css", "utf8");
const model = fs.readFileSync("js/finance-model.js", "utf8");
const summary = fs.readFileSync("js/executive-finance-summary.js", "utf8");

function slice(source, start, end) {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

test("attendance collapses shifts, separates no punch from no shift, and omits the director", () => {
  const context = vm.createContext({});
  vm.runInContext(slice(app, "function executiveStaffRows", "async function bindExecutiveEmployeePortal"), context);
  const employees = [
    { id: "director", nombreCompleto: "Ada Directora", accessProfile: "director_ejecutivo", statusCode: "activo", avatar: "AD" },
    { id: "guide", nombreCompleto: "Ana Guía", accessProfile: "coordinadora_experiencia", statusCode: "activo", avatar: "AG", foto: "https://cdn.example/ana.jpg" },
    { id: "desk", nombreCompleto: "Luis Mesa", accessProfile: "asistente_administrativa", statusCode: "activo", avatar: "LM" },
    { id: "former", nombreCompleto: "Old Timer", statusCode: "terminado", avatar: "OT" }
  ];
  const rows = context.executiveStaffRows(employees, [
    { employee_id: "director", status: "NO HA PONCHADO" },
    { employee_id: "guide", status: "JORNADA TERMINADA" },
    { employee_id: "guide", status: "NO HA PONCHADO" },
    { employee_id: "guide", status: "TRABAJANDO" }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(rows.map((row) => [row.employee.id, row.status]))), [
    ["guide", "NO HA PONCHADO"],
    ["desk", "SIN TURNO"]
  ]);
  assert.equal(context.executivePhoneHref("(787) 555-0100"), "tel:7875550100");
  assert.equal(context.executivePhoneHref("javascript:alert(1)"), "");
  assert.equal(context.executivePhotoUrl({ foto: "https://cdn.example/ana.jpg" }), "https://cdn.example/ana.jpg");
  assert.equal(context.executivePhotoUrl({ foto: "javascript:alert(1)" }), "");
  const events = context.executiveUpcomingEvents([
    { event_date: "2026-10-11", start_time: "09:00", title: "Ayer" },
    { event_date: "2026-10-20", start_time: "18:00", title: "Noche", location: "Anfiteatro" },
    { event_date: "2026-10-20", start_time: "10:00", title: "Mañana" }
  ], "2026-10-12");
  assert.deepEqual(events.map((event) => event.title), ["Mañana", "Noche"]);
});

test("the executive screen is isolated and does not punch or invent a finance total", async () => {
  const posts = [];
  const gets = [];
  const geo = [];
  const dom = new JSDOM(html, { url: "http://127.0.0.1/employee-portal.html", runScripts: "outside-only" });
  const { window } = dom;
  const permissions = new Set(["attendance.today.read", "notifications.read.self"]);
  const employee = {
    id: "director",
    nombreCompleto: "Ada Directora",
    accessProfile: "director_ejecutivo",
    statusCode: "activo",
    posicion: "Director Ejecutivo"
  };
  const context = vm.createContext({
    document: window.document,
    documentTitle: "",
    navigator: { geolocation: { getCurrentPosition: () => geo.push("geo") } },
    Date, Intl, Promise, Number, String, Map,
    set documentTitle(value) { window.document.title = value; },
    get document() { return window.document; },
    safeHtml: (value) => String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]),
    employeeDisplayName: (person) => person.nombreCompleto,
    formatPortalDate: () => "lunes, 12 de octubre",
    clearLoginState() {},
    renderPortalTools() {},
    renderPortalNotifications() {},
    hasPermission: (permission) => permissions.has(permission),
    fetchOwnSupabaseNotifications: async () => [],
    fetchSupabaseEmployees: async () => [
      employee,
      { id: "guide", nombreCompleto: "Ana Guía", accessProfile: "coordinadora_experiencia", statusCode: "activo", avatar: "AG", foto: "https://cdn.example/ana.jpg", posicion: "Guía", departamento: "Experiencia", telefono: "(787) 555-0100" },
      { id: "desk", nombreCompleto: "Luis Mesa", accessProfile: "asistente_administrativa", statusCode: "activo", avatar: "LM", posicion: "Asistente" }
    ],
    fetchTodayStaffStatus: async () => [
      { employee_id: "director", status: "NO HA PONCHADO" },
      { employee_id: "guide", status: "JORNADA TERMINADA" },
      { employee_id: "guide", status: "NO HA PONCHADO" }
    ],
    fetchSupabaseCalendarEvents: async (type) => {
      assert.equal(type, "general");
      return [{ event_date: "2026-10-20", start_time: "18:00:00", title: "Concierto", location: "Anfiteatro" }];
    },
    puertoRicoToday: () => "2026-10-12",
    supabaseGet: async (path) => {
      gets.push(path);
      return [{ fiscal_year_start_month: 9 }];
    },
    supabasePost: async (path) => {
      posts.push(path);
      throw new Error("FORBIDDEN");
    },
    fetchActiveFinanceMovements: async () => {
      throw new Error("finance should not load without permission");
    }
  });
  Object.defineProperty(context, "document", { value: window.document, writable: true });
  vm.runInContext(`${model}\n${summary}\n${slice(app, "function safeHtml", "function bindMaterialsRequestModule")}\n${slice(app, "function executiveStaffRows", "function ensureEnvironmentOnLocalAuthCallback")}`, context);
  context.employee = employee;
  context.profile = { museum_id: "museum-a" };
  await context.bindExecutiveEmployeePortal(context.profile, employee);
  assert.match(window.document.title, /Mi Espacio Ejecutivo/);
  assert.equal(window.document.querySelector("[data-executive-space]").hidden, false);
  assert.equal(window.document.querySelector(".portal-clock-card").hidden, true);
  assert.equal(window.document.querySelector("[data-my-shifts]").hidden, true);
  assert.equal(window.document.querySelector("[data-portal-corrections]").hidden, true);
  assert.equal(window.document.querySelector("[data-portal-time-list]").closest(".portal-section").hidden, true);
  assert.equal(window.document.querySelector("[data-portal-account]").closest(".portal-section").hidden, true);
  assert.deepEqual(geo, []);
  assert.deepEqual(posts, []);
  const staff = window.document.querySelector("[data-executive-staff]").textContent;
  assert.match(staff, /Ana Guía/);
  assert.match(staff, /No ha ponchado/);
  assert.match(staff, /Luis Mesa/);
  assert.match(staff, /Sin turno/);
  assert.doesNotMatch(staff, /Ada Directora/);
  assert.match(window.document.querySelector("[data-executive-calendar]").textContent, /Concierto/);
  assert.match(window.document.querySelector("[data-executive-calendar]").textContent, /Anfiteatro/);
  const directory = window.document.querySelector("[data-executive-directory]");
  assert.match(directory.innerHTML, /href="tel:7875550100"/);
  window.document.querySelector("[data-executive-directory-search]").value = "luis";
  window.document.querySelector("[data-executive-directory-search]").dispatchEvent(new window.Event("input"));
  assert.match(directory.textContent, /Luis Mesa/);
  assert.doesNotMatch(directory.textContent, /Ana Guía/);
  const finance = window.document.querySelector("[data-executive-finance-message]").textContent;
  assert.match(finance, /Resumen financiero no disponible/);
  assert.match(finance, /permiso/);
  assert.equal(window.document.querySelector("[data-executive-finance-totals]").hidden, true);
  assert.equal(window.document.querySelector("[data-executive-finance-totals]").textContent, "");
  assert.doesNotMatch(window.document.querySelector("#executive-finance-title").closest("section").textContent, /\$|3333|0\.00/);

  permissions.add("finance.read");
  permissions.add("compensation.read");
  permissions.add("attendance.history.read");
  context.fetchActiveFinanceMovements = async (museumId) => {
    assert.equal(museumId, "museum-a");
    return [{
      id: "move-1",
      occurred_on: "2026-10-04",
      amount: 10,
      finance_budget_lines: { record_type: "expense", category: "Nómina", counts_in_operating_balance: true }
    }, {
      id: "move-2",
      occurred_on: "2026-10-04",
      amount: 25.5,
      finance_budget_lines: { record_type: "income", category: "Ingresos", counts_in_operating_balance: true }
    }];
  };
  context.supabasePost = async (path, body) => {
    posts.push({ path, body });
    return {
      full_month: true,
      from: body.p_from,
      to: body.p_to,
      employees: [{ employee_id: "guide", compensation_type: "hourly", employment_status: "activo", state: "CALCULADA", actual_amount: 100 }]
    };
  };
  await context.renderExecutiveFinance(context.profile, null);
  const totals = window.document.querySelector("[data-executive-finance-totals]");
  assert.equal(totals.hidden, false);
  assert.match(totals.textContent, /Total ingresos/);
  assert.match(totals.textContent, /Total gastos \(incluyendo nómina\)/);
  assert.match(totals.textContent, /Balance neto/);
  assert.equal(posts.length, 2);
  assert.ok(posts.every((call) => call.path === "/rest/v1/rpc/payroll_actual"));
  assert.deepEqual(posts.map((call) => call.body.p_from).sort(), ["2026-09-01", "2026-10-01"]);

  context.supabasePost = async (path, body) => {
    posts.push({ path, body });
    return {
      full_month: true,
      from: body.p_from,
      to: body.p_to,
      employees: [{ employee_id: "guide", compensation_type: "salary", employment_status: "inactivo", state: "CALCULADA", actual_amount: 3333.33 }]
    };
  };
  await context.renderExecutiveFinance(context.profile, { from: { year: 2026, month: 10 }, to: { year: 2026, month: 10 } });
  assert.equal(window.document.querySelector("[data-executive-finance-totals]").hidden, true);
  assert.match(window.document.querySelector("[data-executive-finance-message]").textContent, /Resumen financiero no disponible/);
  assert.doesNotMatch(window.document.querySelector("[data-executive-finance-totals]").textContent, /3333/);
});

test("other profiles keep the personal portal and the executive block stays hidden", () => {
  const executive = slice(app, "async function bindExecutiveEmployeePortal", "async function renderExecutiveAttendance");
  assert.doesNotMatch(executive, /geolocation|clockSupabase|fetchMyCurrentPunchState|fetchOwnSupabaseTimeEntries/);
  assert.match(html, /data-executive-space hidden/);
  assert.match(html, /data-portal-clock-button/);
  assert.match(css, /body:has\(\.employee-portal\.is-executive\)\{overflow-x:hidden\}/);
  assert.doesNotMatch(fs.readFileSync("finanzas.html", "utf8"), /executive-finance-summary/);
  assert.doesNotMatch(fs.readFileSync("recursos-humanos.html", "utf8"), /data-executive-space/);
});
