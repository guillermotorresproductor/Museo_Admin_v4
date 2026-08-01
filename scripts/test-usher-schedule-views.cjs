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

test("week title formats same month, cross-month, and cross-year ranges", () => {
  assert.strictEqual(
    core.formatSpanishWeekTitle(new Date(2026, 7, 5, 12, 0, 0)),
    "2–8 de agosto de 2026"
  );
  assert.strictEqual(
    core.formatSpanishWeekTitle(new Date(2026, 6, 29, 12, 0, 0)),
    "26 de julio–1 de agosto de 2026"
  );
  assert.strictEqual(
    core.formatSpanishWeekTitle(new Date(2026, 11, 30, 12, 0, 0)),
    "27 de diciembre de 2026–2 de enero de 2027"
  );
});

test("week shift cards keep full schedule labels and admin actions", () => {
  assert.match(appJs, /usher-shift-card/);
  assert.match(appJs, /usher-shift-name/);
  assert.match(appJs, /usher-shift-time/);
  assert.match(appJs, /usher-shift-area/);
  assert.match(appJs, /data-calendar-edit/);
  assert.match(appJs, /data-calendar-delete/);
  assert.match(appJs, /formatUsherScheduleDisplay\(record\)/);
  assert.doesNotMatch(appJs, /usher-shift-time[\s\S]{0,80}\.\.\./);
});

test("weekly schedule layout is responsive without page-wide overflow", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "css", "main.css"), "utf8");
  assert.match(css, /\.usher-week-scroll/);
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /grid-template-columns:\s*repeat\(7,\s*minmax\(168px,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*900px\)[\s\S]*\.usher-week-grid\s*\{[\s\S]*grid-template-columns:\s*1fr;/);
  assert.match(css, /\.usher-shift-time[\s\S]*font-variant-numeric:\s*tabular-nums/);
  assert.match(css, /word-break:\s*normal/);
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
    assert.strictEqual(access.inactiveBlocked, false);
  }
});

test("administrator without linked employee keeps role access", () => {
  const access = core.resolveUsherScheduleAccess({
    permissions: ["usher.schedule.read.all", "usher.schedule.manage"],
    profileRole: "administrador",
    linkedEmployee: null,
    inactiveLinkedUsher: false
  });
  assert.strictEqual(access.canManage, true);
  assert.strictEqual(access.canReadAll, true);
  assert.strictEqual(access.unlinked, false);
  assert.strictEqual(access.inactiveBlocked, false);
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

test("null empty and unknown status are not active", () => {
  assert.strictEqual(core.isActiveEmployeeStatus(null), false);
  assert.strictEqual(core.isActiveEmployeeStatus(undefined), false);
  assert.strictEqual(core.isActiveEmployeeStatus(""), false);
  assert.strictEqual(core.isActiveEmployeeStatus("   "), false);
  assert.strictEqual(core.isActiveEmployeeStatus("desconocido"), false);
  assert.strictEqual(core.isActiveEmployeeStatus("pending"), false);
  assert.strictEqual(core.isActiveEmployeeStatus("activo"), true);
  assert.strictEqual(core.isActiveEmployeeStatus("Active"), true);
  assert.strictEqual(core.isActiveEmployeeStatus("inactivo"), false);
  assert.strictEqual(core.isActiveEmployeeStatus("terminado"), false);
  assert.match(migrationSql, /Fail-closed: only explicit active labels/);
  assert.match(migrationSql, /normalize_usher_label\(raw\) in \('activo', 'active'\)/);
  assert.doesNotMatch(
    migrationSql,
    /normalize_usher_label\(coalesce\(nullif\(trim\(both from coalesce\(raw, ''\)\), ''\), 'activo'\)\)/
  );
});

test("inactive or non-active linked status blocked even with read.all and manage", () => {
  for (const estado of [null, "", "   ", "desconocido", "inactivo", "terminado"]) {
    const access = core.resolveUsherScheduleAccess({
      permissions: ["usher.schedule.read.all", "usher.schedule.manage"],
      profileRole: "administrador",
      linkedEmployee: { id: "e-nonactive", posicion: "Administrador", estado }
    });
    assert.strictEqual(access.inactiveBlocked, true, String(estado));
    assert.strictEqual(access.canManage, false, String(estado));
    assert.strictEqual(access.canReadAll, false, String(estado));
    assert.strictEqual(access.canReadOwn, false, String(estado));
  }
});

test("explicitly active linked status is not blocked", () => {
  for (const estado of ["activo", "active", "Activo", "ACTIVE"]) {
    const access = core.resolveUsherScheduleAccess({
      permissions: ["usher.schedule.read.all", "usher.schedule.manage"],
      profileRole: "administrador",
      linkedEmployee: { id: "e-active", posicion: "Administrador", estado }
    });
    assert.strictEqual(access.inactiveBlocked, false, estado);
    assert.strictEqual(access.canManage, true, estado);
    assert.strictEqual(access.canReadAll, true, estado);
  }
});

test("inactive flag without linked employee blocks even RBAC", () => {
  const access = core.resolveUsherScheduleAccess({
    permissions: ["usher.schedule.manage", "usher.schedule.read.all"],
    profileRole: "ejecutivo",
    linkedEmployee: null,
    inactiveLinkedUsher: true
  });
  assert.strictEqual(access.inactiveBlocked, true);
  assert.strictEqual(access.canManage, false);
  assert.strictEqual(access.canReadAll, false);
});

test("inactive linked usher ejecutivo loses cargo privileges", () => {
  const access = core.resolveUsherScheduleAccess({
    permissions: [],
    linkedEmployee: { id: "e4", posicion: "Ujier ejecutivo", status: "inactivo" }
  });
  assert.strictEqual(access.canManage, false);
  assert.strictEqual(access.canReadOwn, false);
  assert.strictEqual(access.inactiveBlocked, true);
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

test("migration inactive detection is cargo-agnostic and prevails", () => {
  assert.match(migrationSql, /current_linked_nonactive_employee_id/);
  assert.match(migrationSql, /not public\.employee_status_is_active\(e\.status\)/);
  assert.match(migrationSql, /linked_employee_blocks_usher_schedule/);
  assert.match(migrationSql, /Non-active linked employee/);
  assert.match(migrationSql, /drop function if exists public\.current_linked_inactive_employee_id\(\);/);
  assert.match(migrationSql, /drop function if exists public\.current_linked_inactive_usher_employee_id\(\);/);
  assert.doesNotMatch(migrationSql, /create or replace function public\.current_linked_inactive_employee_id/);
  assert.doesNotMatch(migrationSql, /create or replace function public\.current_linked_inactive_usher_employee_id/);
  assert.match(migrationSql, /and not public\.linked_employee_blocks_usher_schedule\(\)/);
});

test("migration exposes client RPCs including protected importer", () => {
  assert.match(migrationSql, /grant execute on function public\.usher_schedule_access_state\(\) to authenticated;/i);
  assert.match(migrationSql, /grant execute on function public\.list_usher_shifts\(date, date\) to authenticated;/i);
  assert.match(migrationSql, /grant execute on function public\.upsert_usher_shift\(uuid, uuid, date, time, time, text\) to authenticated;/i);
  assert.match(migrationSql, /grant execute on function public\.delete_usher_shift\(uuid\) to authenticated;/i);
  assert.match(migrationSql, /grant execute on function public\.import_legacy_usher_shifts\(\) to authenticated;/i);
  assert.doesNotMatch(migrationSql, /grant execute on function public\.import_legacy_usher_shifts\(\) to (anon|public)/i);
  assert.doesNotMatch(migrationSql, /grant execute on function public\.write_usher_shift_audit/i);
  assert.doesNotMatch(migrationSql, /grant execute on function public\.parse_usher_legacy_time_token/i);
  assert.doesNotMatch(migrationSql, /grant execute on function public\.current_linked_usher_employee/i);
  assert.doesNotMatch(migrationSql, /grant execute on function public\.can_manage_usher_schedule/i);
  assert.doesNotMatch(migrationSql, /grant execute on function public\.linked_employee_blocks_usher_schedule/i);
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

test("migration constraints checked by table and name", () => {
  assert.match(migrationSql, /c\.conname = 'employees_id_museum_key'/);
  assert.match(migrationSql, /rel\.relname = 'employees'/);
  assert.match(migrationSql, /c\.conname = 'usher_shifts_employee_museum_fk'/);
  assert.match(migrationSql, /rel\.relname = 'usher_shifts'/);
  assert.match(migrationSql, /join pg_class rel on rel\.oid = c\.conrelid/);
});

test("migration importer audits each successful insert and stays idempotent", () => {
  assert.match(migrationSql, /ambiguous/);
  assert.match(migrationSql, /parse_usher_legacy_time_token/);
  assert.match(migrationSql, /has_permission\('system\.configure'\)/);
  assert.match(migrationSql, /write_usher_shift_audit\(mid, saved\.id, 'create'/);
  assert.match(migrationSql, /returning \* into saved/);
  assert.match(migrationSql, /Successful inserts were audited as create/);
  assert.match(migrationSql, /where not exists/);
  assert.match(migrationSql, /source.*legacy_import|'legacy_import'/);
});

test("importer requires authenticated with system.configure; PUBLIC and anon revoked", () => {
  assert.match(migrationSql, /revoke all on function %s from public, anon, authenticated/);
  assert.match(migrationSql, /'import_legacy_usher_shifts'/);
  assert.match(migrationSql, /grant execute on function public\.import_legacy_usher_shifts\(\) to authenticated;/);
  assert.ok(
    migrationSql.indexOf("revoke all on function %s from public, anon, authenticated")
      < migrationSql.indexOf("grant execute on function public.import_legacy_usher_shifts() to authenticated;")
  );
});

test("migration SECURITY DEFINER helpers use empty search_path", () => {
  assert.match(migrationSql, /security definer\s*\nset search_path = ''/i);
});

test("migration does not return full employees row to clients", () => {
  assert.match(migrationSql, /drop function if exists public\.current_linked_usher_employee\(\);/);
  assert.match(migrationSql, /current_linked_usher_employee_id\(\)/);
});

const portalHtml = fs.readFileSync(path.join(__dirname, "..", "employee-portal.html"), "utf8");
const ujieresHtml = fs.readFileSync(path.join(__dirname, "..", "ujieres.html"), "utf8");
const supabaseJs = fs.readFileSync(path.join(__dirname, "..", "js", "services", "supabase.js"), "utf8");

test("active ujier portal card shows Mis turnos and own summary only", () => {
  const ownShift = {
    id: "s1",
    employee_id: "u1",
    fecha: "2026-08-02",
    horaEntrada: "09:00",
    horaSalida: "13:00",
    area: "Sala 1",
    ujier: "Ana"
  };
  const otherShift = {
    id: "s2",
    employee_id: "u2",
    fecha: "2026-08-01",
    horaEntrada: "08:00",
    horaSalida: "12:00",
    area: "Lobby",
    ujier: "Luis"
  };
  const access = {
    canReadOwn: true,
    canReadAll: false,
    canManage: false,
    linkedEmployeeId: "u1",
    unlinked: false,
    inactiveBlocked: false
  };
  const filtered = core.assertNetworkIsolation(access, [ownShift, otherShift]);
  const model = core.resolvePortalUsherCardModel({
    linkedEmployee: { id: "u1", posicion: "Ujier", estado: "Activo" },
    access,
    shifts: filtered,
    todayKey: "2026-08-01"
  });
  assert.strictEqual(model.visible, true);
  assert.strictEqual(model.title, "Mis turnos");
  assert.strictEqual(model.ctaLabel, "Ver mi calendario");
  assert.strictEqual(model.showManageControls, false);
  assert.strictEqual(model.mode, "own");
  assert.strictEqual(model.upcoming.length, 1);
  assert.strictEqual(model.upcoming[0].id, "s1");
  assert.strictEqual(model.nextShift.id, "s1");
  assert.strictEqual(model.emptyMessage, "No tienes turnos próximos");
});

test("active ujier does not receive management controls in portal card model", () => {
  const model = core.resolvePortalUsherCardModel({
    linkedEmployee: { id: "u1", posicion: "Ujier", estado: "Activo" },
    access: { canReadOwn: true, canManage: false, canReadAll: false },
    shifts: [],
    todayKey: "2026-08-01"
  });
  assert.strictEqual(model.showManageControls, false);
  assert.match(appJs, /newButton\.hidden = !allowed/);
  assert.match(appJs, /is-readonly/);
});

test("active ujier ejecutivo portal card shows team calendar CTA", () => {
  const model = core.resolvePortalUsherCardModel({
    linkedEmployee: { id: "e1", posicion: "Ujier ejecutivo", estado: "Activo" },
    access: {
      canReadOwn: true,
      canReadAll: true,
      canManage: true,
      linkedEmployeeId: "e1",
      unlinked: false,
      inactiveBlocked: false
    },
    shifts: [
      { id: "a", employee_id: "e1", fecha: "2026-08-02", horaEntrada: "09:00", horaSalida: "12:00" },
      { id: "b", employee_id: "u2", fecha: "2026-08-03", horaEntrada: "10:00", horaSalida: "14:00" },
      { id: "c", employee_id: "u3", fecha: "2026-08-04", horaEntrada: "11:00", horaSalida: "15:00" },
      { id: "d", employee_id: "u4", fecha: "2026-08-05", horaEntrada: "12:00", horaSalida: "16:00" }
    ],
    todayKey: "2026-08-01"
  });
  assert.strictEqual(model.visible, true);
  assert.strictEqual(model.title, "Calendario de Ujieres");
  assert.strictEqual(model.ctaLabel, "Ver y administrar turnos");
  assert.strictEqual(model.showManageControls, true);
  assert.strictEqual(model.mode, "manage");
  assert.strictEqual(model.upcoming.length, 3);
  assert.strictEqual(model.emptyMessage, "No hay turnos próximos");
});

test("non-usher and inactive or terminated employees do not see portal usher card", () => {
  const access = { canReadOwn: true, canManage: false, canReadAll: false };
  assert.strictEqual(
    core.resolvePortalUsherCardModel({
      linkedEmployee: { id: "x", posicion: "Recepcionista", estado: "Activo" },
      access,
      shifts: [],
      todayKey: "2026-08-01"
    }).visible,
    false
  );
  assert.strictEqual(
    core.resolvePortalUsherCardModel({
      linkedEmployee: { id: "x", posicion: "Ujier", estado: "Inactivo" },
      access,
      shifts: [],
      todayKey: "2026-08-01"
    }).visible,
    false
  );
  assert.strictEqual(
    core.resolvePortalUsherCardModel({
      linkedEmployee: { id: "x", posicion: "Ujier ejecutivo", estado: "Terminado" },
      access: { canManage: true, canReadAll: true },
      shifts: [],
      todayKey: "2026-08-01"
    }).visible,
    false
  );
});

test("unlinked account does not receive portal usher shifts", () => {
  const model = core.resolvePortalUsherCardModel({
    linkedEmployee: { id: "u1", posicion: "Ujier", estado: "Activo" },
    access: { canReadOwn: false, canManage: false, canReadAll: false, unlinked: true },
    shifts: [{ id: "s1", employee_id: "u1", fecha: "2026-08-02" }],
    todayKey: "2026-08-01"
  });
  assert.strictEqual(model.visible, false);
  assert.match(appJs, /access\.unlinked/);
  assert.match(appJs, /inactiveBlocked/);
});

test("portal usher CTA preserves environment=staging via museoPageUrl", () => {
  assert.match(portalHtml, /data-portal-usher-card/);
  assert.match(portalHtml, /data-portal-usher-cta/);
  assert.match(appJs, /bindPortalUsherCard/);
  assert.match(appJs, /museoPageUrl\("ujieres\.html"\)/);
  assert.match(appJs, /cta\.href = typeof museoPageUrl === "function" \? museoPageUrl\("ujieres\.html"\)/);
});

test("ujieres calendar exposes return link to employee portal for ushers", () => {
  assert.match(ujieresHtml, /data-usher-portal-back/);
  assert.match(ujieresHtml, /Volver a Mi jornada/);
  assert.match(appJs, /data-usher-portal-back/);
  assert.match(appJs, /museoPageUrl\("employee-portal\.html"\)/);
  assert.match(appJs, /!hasAdministrativeWorkspaceAccess\(\)/);
});

test("portal usher card reuses secure RPCs and never app_records", () => {
  assert.match(appJs, /fetchUsherScheduleAccessState/);
  assert.match(appJs, /listUsherShifts/);
  assert.match(supabaseJs, /rpc\/usher_schedule_access_state/);
  assert.match(supabaseJs, /rpc\/list_usher_shifts/);
  const portalBind = appJs.slice(appJs.indexOf("async function bindPortalUsherCard"), appJs.indexOf("function renderPortalTools"));
  assert.doesNotMatch(portalBind, /app_records/);
  assert.match(portalBind, /listUsherShifts/);
  assert.match(portalBind, /fetchUsherScheduleAccessState/);
});

test("general calendar remains separate from usher schedule permissions", () => {
  assert.match(appJs, /calendario\.html/);
  assert.doesNotMatch(
    appJs.slice(appJs.indexOf("const canOpenUsherCalendarPage"), appJs.indexOf("const postLoginDestination")),
    /calendar\.manage/
  );
  assert.doesNotMatch(
    String(core.canOpenUsherScheduleFromNavigation({
      permissions: ["calendar.manage"],
      linkedEmployee: { id: "e1", posicion: "Ujier ejecutivo", estado: "Activo" }
    }).reason),
    /calendar/
  );
  const calendarOnly = core.canOpenUsherScheduleFromNavigation({
    permissions: ["calendar.manage"],
    linkedEmployee: null,
    serverAccess: null
  });
  assert.strictEqual(calendarOnly.allowed, false);
  assert.match(migrationSql, /has_permission\('usher\.schedule\.manage'\)/);
  assert.doesNotMatch(
    migrationSql.slice(
      migrationSql.indexOf("create or replace function public.can_manage_usher_schedule"),
      migrationSql.indexOf("create or replace function public.usher_schedule_access_state")
    ),
    /calendar\.manage/
  );
});

test("portal CTA opens ujieres.html and navigation gate awaits access state", () => {
  assert.match(appJs, /museoPageUrl\("ujieres\.html"\)/);
  assert.match(appJs, /async function enforceAuthenticatedPageAccess/);
  assert.match(appJs, /await enforceAuthenticatedPageAccess\(\)/);
  assert.match(appJs, /resolveUsherScheduleNavigationDecision/);
  assert.match(appJs, /page === "ujieres\.html"/);
  assert.ok(
    appJs.indexOf("await syncEmployeeCacheFromSupabase()")
      < appJs.indexOf("await enforceAuthenticatedPageAccess()")
  );
});

test("ujier ejecutivo is not redirected away from ujieres.html", () => {
  const decision = core.canOpenUsherScheduleFromNavigation({
    permissions: [],
    linkedEmployee: { id: "e1", posicion: "Ujier ejecutivo", estado: "Activo" },
    serverAccess: {
      can_read_own: true,
      can_read_all: true,
      can_manage: true,
      unlinked: false,
      inactive_blocked: false
    }
  });
  assert.strictEqual(decision.allowed, true);
  assert.strictEqual(decision.redirectToPortal, false);
});

test("regular ujier is not redirected away from ujieres.html", () => {
  const decision = core.canOpenUsherScheduleFromNavigation({
    permissions: [],
    linkedEmployee: { id: "u1", posicion: "Ujier", estado: "Activo" },
    serverAccess: {
      can_read_own: true,
      can_read_all: false,
      can_manage: false,
      unlinked: false,
      inactive_blocked: false
    }
  });
  assert.strictEqual(decision.allowed, true);
  assert.strictEqual(decision.redirectToPortal, false);
  assert.strictEqual(decision.reason, "server_access");
});

test("non-usher remains blocked from ujieres navigation", () => {
  const decision = core.canOpenUsherScheduleFromNavigation({
    permissions: [],
    linkedEmployee: { id: "r1", posicion: "Recepcionista", estado: "Activo" },
    serverAccess: {
      can_read_own: false,
      can_read_all: false,
      can_manage: false,
      unlinked: false,
      inactive_blocked: false
    }
  });
  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.redirectToPortal, true);
});

test("unlinked account is blocked from ujieres navigation", () => {
  const decision = core.canOpenUsherScheduleFromNavigation({
    permissions: [],
    linkedEmployee: null,
    serverAccess: {
      can_read_own: false,
      can_read_all: false,
      can_manage: false,
      unlinked: true,
      inactive_blocked: false
    }
  });
  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.reason, "unlinked");
});

test("inactive or terminated linked usher is blocked from ujieres navigation", () => {
  for (const status of ["Inactivo", "Terminado"]) {
    const byServer = core.canOpenUsherScheduleFromNavigation({
      permissions: ["usher.schedule.manage"],
      linkedEmployee: { id: "u1", posicion: "Ujier ejecutivo", estado: status },
      serverAccess: {
        inactive_blocked: true,
        unlinked: false,
        can_manage: false,
        can_read_own: false,
        can_read_all: false
      }
    });
    assert.strictEqual(byServer.allowed, false, status);
    assert.strictEqual(byServer.reason, "inactive", status);

    const byLinkedOnly = core.canOpenUsherScheduleFromNavigation({
      permissions: [],
      linkedEmployee: { id: "u1", posicion: "Ujier ejecutivo", estado: status },
      serverAccess: null
    });
    assert.strictEqual(byLinkedOnly.allowed, false, status);
  }
});

test("administrator keeps ujieres navigation access", () => {
  const decision = core.canOpenUsherScheduleFromNavigation({
    permissions: [],
    hasAdministrativeWorkspace: true,
    linkedEmployee: null,
    serverAccess: null
  });
  assert.strictEqual(decision.allowed, true);
  assert.strictEqual(decision.reason, "admin_workspace");
  assert.match(appJs, /if \(hasAdministrativeWorkspaceAccess\(\)\) return false;/);
});

test("usher navigation exception does not create portal redirect loop", () => {
  assert.match(appJs, /Controlled exception: active linked Ujier/);
  assert.doesNotMatch(
    appJs.slice(
      appJs.indexOf('if (page === "ujieres.html")'),
      appJs.indexOf('const allowedPages = new Map([')
    ),
    /allowedPages\.get\(page\)/
  );
  const allowed = core.canOpenUsherScheduleFromNavigation({
    permissions: [],
    linkedEmployee: { id: "e1", posicion: "Ujier ejecutivo", estado: "Activo" },
    serverAccess: { can_manage: true, can_read_all: true, can_read_own: true, unlinked: false, inactive_blocked: false }
  });
  assert.strictEqual(allowed.redirectToPortal, false);
});

test("environment staging is preserved on portal and usher calendar links", () => {
  assert.match(appJs, /museoPageUrl\("ujieres\.html"\)/);
  assert.match(appJs, /museoPageUrl\("employee-portal\.html"\)/);
  assert.match(portalHtml, /usher-nav-fix-20260731/);
  assert.match(ujieresHtml, /usher-nav-fix-20260731/);
  assert.match(appJs, /ensureActiveEnvironmentInAddressBar/);
  assert.match(appJs, /preserveActiveEnvironmentOnInternalLinks/);
});

test("ujier ejecutivo does not gain Calendario General via usher navigation", () => {
  const toolsSlice = appJs.slice(appJs.indexOf("function renderPortalTools"), appJs.indexOf("function bindPortalAttendanceCorrections"));
  assert.doesNotMatch(toolsSlice, /usher\.schedule/);
  assert.match(toolsSlice, /calendar\.manage/);
  const nav = core.canOpenUsherScheduleFromNavigation({
    permissions: [],
    linkedEmployee: { id: "e1", posicion: "Ujier ejecutivo", estado: "Activo" },
    serverAccess: { can_manage: true, can_read_all: true, can_read_own: true, unlinked: false, inactive_blocked: false }
  });
  assert.strictEqual(nav.allowed, true);
  assert.strictEqual(
    core.canOpenUsherScheduleFromNavigation({
      permissions: [],
      linkedEmployee: { id: "e1", posicion: "Ujier ejecutivo", estado: "Activo" },
      serverAccess: null
    }).allowed,
    true
  );
  assert.match(appJs, /\["calendario\.html", \(\) => hasPermission\("calendar\.manage"\) \|\| hasPermission\("schedules\.read\.team"\)\]/);
});

test("RLS and RPC remain the authority for usher schedule page access", () => {
  assert.match(appJs, /fetchUsherScheduleAccessState/);
  assert.match(appJs, /usher_schedule_access_state|serverAccess/);
  assert.match(appJs, /canOpenUsherScheduleFromNavigation/);
  assert.strictEqual(
    core.canOpenUsherScheduleFromNavigation({
      permissions: ["usher.schedule.manage"],
      linkedEmployee: { id: "u1", posicion: "Ujier", estado: "Activo" },
      serverAccess: { inactive_blocked: true, unlinked: false, can_manage: false, can_read_own: false, can_read_all: false }
    }).allowed,
    false
  );
});

console.log("All usher schedule view/access checks passed.");
