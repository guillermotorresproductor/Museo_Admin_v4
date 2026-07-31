const assert = require("assert");
const fs = require("fs");
const path = require("path");
const core = require("../js/usher-schedule-core.js");

function test(name, fn) {
  fn();
  console.log(`PASS ${name}`);
}

const migrationPath = path.join(__dirname, "..", "supabase", "migrations", "202607310001_usher_schedule_shifts.sql");
const migrationSql = fs.readFileSync(migrationPath, "utf8");
const appJs = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

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
    permissions: [],
    linkedEmployee: { id: "e1", posicion: "Ujier ejecutivo", estado: "Activo" }
  });
  assert.strictEqual(access.canReadAll, true);
  assert.strictEqual(access.canManage, true);
  assert.strictEqual(access.usesCalendarManage, false);
});

test("regular ujier only own and no manage", () => {
  const access = core.resolveUsherScheduleAccess({
    permissions: [],
    linkedEmployee: { id: "e2", posicion: "Ujier", estado: "Activo" }
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

test("ujier cannot see other employee shifts via client isolation", () => {
  const access = core.resolveUsherScheduleAccess({
    linkedEmployee: { id: "own", posicion: "Ujier", estado: "activo" }
  });
  const isolated = core.assertNetworkIsolation(access, [
    { id: "1", employee_id: "own" },
    { id: "2", employee_id: "peer" }
  ]);
  assert.deepStrictEqual(isolated.map((item) => item.id), ["1"]);
});

test("unlinked account receives no data", () => {
  const access = core.resolveUsherScheduleAccess({
    permissions: [],
    linkedEmployee: null
  });
  assert.strictEqual(access.unlinked, true);
  assert.deepStrictEqual(core.assertNetworkIsolation(access, [{ id: "a", employee_id: "x" }]), []);
});

test("inactive employee blocked including casing and spaces", () => {
  for (const estado of ["inactivo", "Inactivo", " INACTIVO ", "terminado"]) {
    assert.strictEqual(core.isInactiveEmployeeStatus(estado), true);
  }
  const access = core.resolveUsherScheduleAccess({
    permissions: [],
    linkedEmployee: { id: "e-inactive", posicion: "Ujier ejecutivo", estado: " Inactivo " }
  });
  assert.strictEqual(access.inactiveBlocked, true);
  assert.strictEqual(access.canManage, false);
  assert.strictEqual(access.canReadAll, false);
  assert.strictEqual(access.canReadOwn, false);
  assert.strictEqual(access.linkedEmployeeId, null);
});

test("inactive flag without linked employee blocks", () => {
  const access = core.resolveUsherScheduleAccess({
    permissions: [],
    linkedEmployee: null,
    inactiveLinkedUsher: true
  });
  assert.strictEqual(access.inactiveBlocked, true);
  assert.strictEqual(access.canManage, false);
});

test("inactive linked usher does not keep RBAC-less cargo privileges", () => {
  const access = core.resolveUsherScheduleAccess({
    permissions: ["usher.schedule.read.own"],
    linkedEmployee: { id: "e4", posicion: "Ujier ejecutivo", status: "inactivo" }
  });
  assert.strictEqual(access.canManage, false);
  assert.strictEqual(access.canReadOwn, false);
  assert.strictEqual(access.inactiveBlocked, true);
});

test("administrator still manages when inactive usher link exists via role", () => {
  const access = core.resolveUsherScheduleAccess({
    permissions: ["usher.schedule.manage", "usher.schedule.read.all"],
    profileRole: "administrador",
    linkedEmployee: null,
    inactiveLinkedUsher: true
  });
  assert.strictEqual(access.canManage, true);
  assert.strictEqual(access.inactiveBlocked, false);
});

test("calendar.manage does not imply usher manage", () => {
  const access = core.resolveUsherScheduleAccess({
    permissions: ["calendar.manage"],
    linkedEmployee: { id: "e3", posicion: "Ujier", estado: "Activo" }
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

test("SESSION_IDLE_MS remains five minutes", () => {
  assert.match(appJs, /const SESSION_IDLE_MS = 5 \* 60 \* 1000;/);
});

test("migration normalizes inactive status comparisons", () => {
  assert.match(migrationSql, /employee_status_is_inactive/);
  assert.match(migrationSql, /employee_status_is_active/);
  assert.doesNotMatch(migrationSql, /status <> 'inactivo'/);
  assert.doesNotMatch(migrationSql, /status = 'inactivo'/);
});

test("migration exposes only client RPCs to authenticated", () => {
  assert.match(migrationSql, /grant execute on function public\.usher_schedule_access_state\(\) to authenticated;/i);
  assert.match(migrationSql, /grant execute on function public\.list_usher_shifts\(date, date\) to authenticated;/i);
  assert.match(migrationSql, /grant execute on function public\.upsert_usher_shift\(uuid, uuid, date, time, time, text\) to authenticated;/i);
  assert.match(migrationSql, /grant execute on function public\.delete_usher_shift\(uuid\) to authenticated;/i);
  assert.doesNotMatch(migrationSql, /grant execute on function public\.write_usher_shift_audit/i);
  assert.doesNotMatch(migrationSql, /grant execute on function public\.current_linked_usher_employee/i);
  assert.doesNotMatch(migrationSql, /grant execute on function public\.import_legacy_usher_shifts/i);
  assert.doesNotMatch(migrationSql, /grant execute on function public\.can_manage_usher_schedule/i);
});

test("migration revokes direct mutations on usher_shifts", () => {
  assert.match(migrationSql, /revoke all on table public\.usher_shifts from public, anon, authenticated;/i);
  assert.match(migrationSql, /grant select on table public\.usher_shifts to authenticated;/i);
  assert.doesNotMatch(migrationSql, /grant select, insert, update, delete on table public\.usher_shifts/i);
  assert.match(migrationSql, /drop policy if exists usher_shifts_insert/i);
  assert.match(migrationSql, /drop policy if exists usher_shifts_update/i);
  assert.match(migrationSql, /drop policy if exists usher_shifts_delete/i);
});

test("migration joins employees by id and museum_id", () => {
  assert.match(migrationSql, /e\.id = s\.employee_id\s*\n\s*and e\.museum_id = s\.museum_id/i);
  assert.match(migrationSql, /usher_shifts_employee_museum_fk/);
  assert.match(migrationSql, /usher_shifts_exact_duplicate_uidx/);
});

test("migration importer is idempotent and reports ambiguity", () => {
  assert.match(migrationSql, /ambiguous/);
  assert.match(migrationSql, /parse_usher_legacy_time_token/);
  assert.match(migrationSql, /has_permission\('system\.configure'\)/);
  assert.match(migrationSql, /Historical app_records JSON was not modified/);
  assert.match(migrationSql, /where not exists/);
});

test("migration SECURITY DEFINER helpers use empty search_path", () => {
  assert.match(migrationSql, /security definer\s*\nset search_path = ''/i);
  assert.match(migrationSql, /revoke all on function %s from public, anon, authenticated/i);
});

test("migration does not return full employees row to clients", () => {
  assert.match(migrationSql, /drop function if exists public\.current_linked_usher_employee\(\);/);
  assert.match(migrationSql, /current_linked_usher_employee_id\(\)/);
});

console.log("All usher schedule view/access checks passed.");
