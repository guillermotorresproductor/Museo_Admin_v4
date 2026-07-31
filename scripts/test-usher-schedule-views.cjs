const assert = require("assert");
const core = require("../js/usher-schedule-core.js");

function test(name, fn) {
  fn();
  console.log(`PASS ${name}`);
}

test("month/week/day ranges preserve selected date anchors", () => {
  const date = new Date(2026, 6, 15, 12, 0, 0);
  assert.deepStrictEqual(core.viewRange("day", date), { from: "2026-07-15", to: "2026-07-15" });
  assert.deepStrictEqual(core.viewRange("week", date), { from: "2026-07-12", to: "2026-07-18" });
  assert.deepStrictEqual(core.viewRange("month", date), { from: "2026-07-01", to: "2026-07-31" });
});

test("navigation previous / today / next", () => {
  const date = new Date(2026, 6, 15, 12, 0, 0);
  assert.strictEqual(core.toDateKey(core.navigateDate("day", date, "prev")), "2026-07-14");
  assert.strictEqual(core.toDateKey(core.navigateDate("week", date, "next")), "2026-07-22");
  assert.strictEqual(core.toDateKey(core.navigateDate("month", date, "prev")), "2026-06-01");
  const today = core.navigateDate("month", date, "today");
  assert.ok(today instanceof Date);
});

test("chronological sort by entry time", () => {
  const sorted = core.sortShiftsChronologically([
    { id: "2", fecha: "2026-07-15", horaEntrada: "12:00", horaSalida: "16:00" },
    { id: "1", fecha: "2026-07-15", horaEntrada: "08:00", horaSalida: "12:00" }
  ]);
  assert.strictEqual(sorted[0].id, "1");
  assert.strictEqual(sorted[1].id, "2");
});

test("administrator and executive can manage all", () => {
  for (const role of ["administrador", "ejecutivo"]) {
    const access = core.resolveUsherScheduleAccess({
      permissions: ["usher.schedule.read.all", "usher.schedule.manage"],
      profileRole: role
    });
    assert.strictEqual(access.canReadAll, true);
    assert.strictEqual(access.canManage, true);
  }
});

test("usher ejecutivo can manage all without calendar.manage", () => {
  const access = core.resolveUsherScheduleAccess({
    permissions: ["usher.schedule.read.own"],
    linkedEmployee: { id: "e1", posicion: "Ujier ejecutivo" }
  });
  assert.strictEqual(access.canReadAll, true);
  assert.strictEqual(access.canManage, true);
  assert.strictEqual(access.usesCalendarManage, false);
});

test("regular ujier only own and no manage", () => {
  const access = core.resolveUsherScheduleAccess({
    permissions: ["usher.schedule.read.own"],
    linkedEmployee: { id: "e2", posicion: "Ujier" }
  });
  assert.strictEqual(access.canReadAll, false);
  assert.strictEqual(access.canManage, false);
  assert.strictEqual(access.canReadOwn, true);
  const isolated = core.assertNetworkIsolation(access, [
    { id: "a", employee_id: "e2" },
    { id: "b", employee_id: "other" }
  ]);
  assert.deepStrictEqual(isolated.map((item) => item.id), ["a"]);
});

test("unlinked account receives no data", () => {
  const access = core.resolveUsherScheduleAccess({
    permissions: ["usher.schedule.read.own"],
    linkedEmployee: null
  });
  assert.strictEqual(access.unlinked, true);
  assert.deepStrictEqual(core.assertNetworkIsolation(access, [{ id: "a", employee_id: "x" }]), []);
});

test("inactive employee blocked", () => {
  const access = core.resolveUsherScheduleAccess({
    permissions: [],
    linkedEmployee: null,
    inactiveLinkedUsher: true
  });
  assert.strictEqual(access.inactiveBlocked, true);
  assert.strictEqual(access.canManage, false);
});

test("calendar.manage does not imply usher manage", () => {
  const access = core.resolveUsherScheduleAccess({
    permissions: ["calendar.manage"],
    linkedEmployee: { id: "e3", posicion: "Ujier" }
  });
  assert.strictEqual(access.canManage, false);
  assert.strictEqual(access.usesCalendarManage, true);
});

test("secure record mapping keeps employee_id", () => {
  const mapped = core.mapSecureShiftRecord({
    id: "s1",
    employee_id: "emp-1",
    employee_name: "Ana Pérez",
    shift_date: "2026-07-15",
    starts_at: "08:00:00",
    ends_at: "12:00:00",
    area: "El Lobby"
  });
  assert.strictEqual(mapped.employee_id, "emp-1");
  assert.strictEqual(mapped.horaEntrada, "08:00");
  assert.strictEqual(mapped.ujier, "Ana Pérez");
});

console.log("All usher schedule view/access checks passed.");
