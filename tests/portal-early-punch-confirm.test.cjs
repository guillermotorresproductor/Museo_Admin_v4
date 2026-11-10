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
