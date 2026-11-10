const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const app = fs.readFileSync("js/app.js", "utf8");
const from = app.indexOf("function needsEarlyPunchConfirmation(");
const to = app.indexOf("async function bindEmployeePortal()", from);
assert.ok(from >= 0 && to > from, "The guard must remain scoped to the employee portal");
const context = vm.createContext({ Date, Number });
vm.runInContext(app.slice(from, to), context);
const guard = context.needsEarlyPunchConfirmation;
const now = Date.parse("2026-11-10T13:00:00Z");
const recent = (event_type, ageMinutes) => ({
  event_type, occurred_at: new Date(now - ageMinutes * 60000).toISOString()
});

test("lunch-out warns before 60 minutes, not at or after the limit", () => {
  assert.equal(guard("lunch_out", recent("clock_in", 0), now), true);
  assert.equal(guard("lunch_out", recent("clock_in", 59), now), true);
  assert.equal(guard("lunch_out", recent("clock_in", 60), now), false);
  assert.equal(guard("lunch_out", recent("clock_in", 61), now), false);
});

test("clock-out warns within an hour after lunch-in", () => {
  assert.equal(guard("clock_out", recent("lunch_in", 2), now), true);
  assert.equal(guard("clock_out", recent("lunch_in", 60), now), false);
});

test("does not change normal entrance or lunch return", () => {
  assert.equal(guard("clock_in", null, now), false);
  assert.equal(guard("lunch_in", recent("lunch_out", 3), now), false);
  assert.equal(guard("clock_out", recent("clock_in", 3), now), false);
});

test("invalid recent timestamp fails safe with confirmation", () => {
  assert.equal(guard("lunch_out", { event_type: "clock_in", occurred_at: "bad" }, now), true);
});

test("portal locks submissions and uses a stable action before network calls", () => {
  const portal = app.slice(app.indexOf("async function bindEmployeePortal()"));
  assert.match(portal, /punchInFlight\) return;/);
  assert.match(portal, /punchInFlight = true;/);
  assert.match(portal, /if \(!window\.confirm\(question\)\)/);
  assert.match(portal, /clockSupabaseEmployeeTime\(requestedAction, presence\)/);
  assert.match(portal, /punchInFlight = false;/);
});


function setupPunchClick({ action, previous, confirm = () => true, presenceFactory = async () => ({ method: "geolocation" }) }) {
  const beginning = app.indexOf('  button.addEventListener("click", async () => {', app.indexOf("async function bindEmployeePortal()"));
  const ending = app.indexOf('  document.querySelector("[data-portal-logout]")', beginning);
  assert.ok(beginning > 0 && ending > beginning);
  const button = { dataset: { action }, disabled: false, addEventListener(_name, callback) { this.click = callback; } };
  const message = { textContent: "", className: "" };
  const requests = [];
  let refreshCount = 0;
  let confirmCount = 0;
  const box = vm.createContext({
    button, message, personal: { clock: true },
    latestPunchEvent: previous, punchInFlight: false,
    needsEarlyPunchConfirmation: guard,
    window: { confirm(question) { confirmCount++; return confirm(question); } },
    requestPresence: presenceFactory,
    clockSupabaseEmployeeTime: async (requested, presence) => { requests.push({ requested, presence }); },
    refresh: async () => { refreshCount++; },
  });
  vm.runInContext(app.slice(beginning, ending), box);
  return { button, message, requests, counters: () => ({ confirmCount, refreshCount }) };
}

test("cancelled early lunch-out performs no geolocation or RPC", async () => {
  let presenceCalls = 0;
  const fixture = setupPunchClick({
    action: "lunch_out", previous: recent("clock_in", 2),
    confirm: () => false,
    presenceFactory: async () => { presenceCalls++; return {}; }
  });
  await fixture.button.click();
  assert.equal(fixture.counters().confirmCount, 1);
  assert.equal(presenceCalls, 0);
  assert.equal(fixture.requests.length, 0);
  assert.equal(fixture.counters().refreshCount, 0);
  assert.equal(fixture.button.disabled, false);
});

test("confirmed early clock-out invokes the existing RPC exactly once", async () => {
  const fixture = setupPunchClick({ action: "clock_out", previous: recent("lunch_in", 3) });
  await fixture.button.click();
  assert.equal(fixture.counters().confirmCount, 1);
  assert.deepEqual(fixture.requests.map(x => x.requested), ["clock_out"]);
  assert.equal(fixture.counters().refreshCount, 1);
  assert.equal(fixture.button.disabled, false);
});

test("rapid double click while the first request is pending never sends a second RPC", async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const fixture = setupPunchClick({
    action: "lunch_out", previous: recent("clock_in", 2),
    presenceFactory: () => pending
  });
  const first = fixture.button.click();
  const second = fixture.button.click();
  assert.equal(fixture.button.disabled, true);
  assert.equal(fixture.counters().confirmCount, 1);
  release({ method: "geolocation" });
  await Promise.all([first, second]);
  assert.deepEqual(fixture.requests.map(x => x.requested), ["lunch_out"]);
  assert.equal(fixture.counters().refreshCount, 1);
  assert.equal(fixture.button.disabled, false);
});

test("ordinary clock-in stays direct without extra confirmation", async () => {
  const fixture = setupPunchClick({ action: "clock_in", previous: null });
  await fixture.button.click();
  assert.equal(fixture.counters().confirmCount, 0);
  assert.deepEqual(fixture.requests.map(x => x.requested), ["clock_in"]);
});
