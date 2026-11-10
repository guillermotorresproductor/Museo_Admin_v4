const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const app = fs.readFileSync("js/app.js", "utf8");
const html = fs.readFileSync("employee-portal.html", "utf8");
const guardStart = app.indexOf("function needsEarlyPunchConfirmation(");
const portalEnd = app.indexOf("function ensureEnvironmentOnLocalAuthCallback()", guardStart);
assert.ok(guardStart > 0 && portalEnd > guardStart);
const executable = app.slice(guardStart, portalEnd);
const sleep = () => new Promise(resolve => setTimeout(resolve, 0));

async function fixture(initialEvent, confirmationChoice = true) {
  const dom = new JSDOM(html, { url: "https://example.test/employee-portal.html" });
  const { window } = dom;
  const { document } = window;
  let events = initialEvent ? [initialEvent] : [];
  let confirmationCount = 0;
  let locationCount = 0;
  let submissionCount = 0;
  let releaseSubmission = null;
  let blockSubmission = false;
  const employee = { id: "employee-001", nombreCompleto: "Empleado de prueba", correo: "test@example.test", posicion: "Guía", accessProfile: "guia" };
  const context = vm.createContext({
    document, window,
    navigator: { geolocation: { getCurrentPosition(onSuccess) {
      locationCount++;
      onSuccess({ coords: { latitude: 18.4, longitude: -66.1, accuracy: 10 } });
    } } },
    Date, Number, Intl, Promise, String,
    getSupabaseSession: () => ({ access_token: "synthetic-test-token", user: {} }),
    fetchSupabaseProfile: async () => ({ full_name: "Empleado de prueba" }),
    fetchOwnSupabaseEmployee: async () => employee,
    employeeDisplayName: e => e.nombreCompleto,
    hasPermission: permission => ["time.clock", "time.read.self"].includes(permission),
    bindMyAssignedShifts: () => {},
    bindAttendanceOperationalAlerts: () => {},
    bindPunchCorrections: () => {},
    bindOvertimeReviews: () => {},
    renderPortalTools: () => {},
    bindPortalAttendanceCorrections: async () => {},
    bindEmployeeLeaveRequests: async () => {},
    fetchOwnSupabaseTimeEntries: async () => [],
    fetchMyCurrentPunchState: async () => ({ events, historical_open: [] }),
    renderPortalTimeEntries: () => {},
    formatPortalDate: () => "9:00 AM",
    fetchOwnSupabaseNotifications: async () => [],
    renderPortalNotifications: () => {},
    clearLoginState: () => {},
    clockSupabaseEmployeeTime: async (action) => {
      submissionCount++;
      if (blockSubmission) await new Promise(resolve => { releaseSubmission = resolve; });
      events = [...events, { event_type: action, occurred_at: new Date().toISOString() }];
    }
  });
  window.confirm = () => { confirmationCount++; return confirmationChoice; };
  vm.runInContext(executable, context);
  await context.bindEmployeePortal();
  return {
    button: document.querySelector("[data-portal-clock-button]"),
    message: document.querySelector("[data-portal-message]"),
    counts: () => ({ confirmationCount, locationCount, submissionCount }),
    block: () => { blockSubmission = true; },
    release: () => { if (!releaseSubmission) throw new Error("No pending submission"); releaseSubmission(); },
    flush: sleep,
    dom
  };
}
const event = type => ({ event_type: type, occurred_at: new Date(Date.now() - 2 * 60000).toISOString() });

test("browser DOM: cancel early lunch-out without writing attendance", async () => {
  const f = await fixture(event("clock_in"), false);
  assert.equal(f.button.dataset.action, "lunch_out");
  f.button.click();
  await f.flush();
  assert.deepEqual(f.counts(), { confirmationCount: 1, locationCount: 0, submissionCount: 0 });
  assert.match(f.message.textContent, /cancelado/i);
  f.dom.window.close();
});

test("browser DOM: rapid double click after clock-in creates only one lunch-out", async () => {
  const f = await fixture(event("clock_in"), true);
  f.block();
  f.button.click();
  f.button.click();
  await f.flush();
  assert.deepEqual(f.counts(), { confirmationCount: 1, locationCount: 1, submissionCount: 1 });
  f.release();
  await f.flush();
  assert.equal(f.button.dataset.action, "lunch_in");
  f.dom.window.close();
});

test("browser DOM: rapid double click after lunch-in creates only one clock-out", async () => {
  const f = await fixture(event("lunch_in"), true);
  f.block();
  f.button.click();
  f.button.click();
  await f.flush();
  assert.deepEqual(f.counts(), { confirmationCount: 1, locationCount: 1, submissionCount: 1 });
  f.release();
  await f.flush();
  assert.equal(f.button.textContent, "Jornada completada");
  f.dom.window.close();
});

test("browser DOM: no warning on first entry and script cache version updated", async () => {
  const f = await fixture(null);
  assert.equal(f.button.dataset.action, "clock_in");
  f.button.click();
  await f.flush();
  assert.deepEqual(f.counts(), { confirmationCount: 0, locationCount: 1, submissionCount: 1 });
  assert.match(html, /js\/app\.js\?v=(?:portal-punch-confirm|leave-self-service)-20261110/);
  f.dom.window.close();
});
