(function (root) {
  "use strict";

  const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function toDateKey(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function parseDateKey(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  }

  function startOfWeek(date) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
    next.setDate(next.getDate() - next.getDay());
    return next;
  }

  function addDays(date, amount) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
    next.setDate(next.getDate() + amount);
    return next;
  }

  function viewRange(view, activeDate) {
    const date = new Date(activeDate.getFullYear(), activeDate.getMonth(), activeDate.getDate(), 12, 0, 0);
    if (view === "day") {
      const key = toDateKey(date);
      return { from: key, to: key };
    }
    if (view === "week") {
      const start = startOfWeek(date);
      return { from: toDateKey(start), to: toDateKey(addDays(start, 6)) };
    }
    const from = new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0);
    const to = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12, 0, 0);
    return { from: toDateKey(from), to: toDateKey(to) };
  }

  function shiftSortKey(record) {
    const times = typeof root.resolveUsherTimes === "function"
      ? root.resolveUsherTimes(record)
      : { entrada: record.horaEntrada || record.starts_at || "99:99", salida: record.horaSalida || record.ends_at || "99:99" };
    return `${record.fecha || record.shift_date || ""}|${times?.entrada || "99:99"}|${record.id || ""}`;
  }

  function sortShiftsChronologically(records) {
    return [...records].sort((a, b) => shiftSortKey(a).localeCompare(shiftSortKey(b)));
  }

  function filterShiftsForDate(records, dateKey) {
    return sortShiftsChronologically(records.filter((record) => (record.fecha || record.shift_date) === dateKey));
  }

  function formatSpanishDate(date) {
    return `${dayNames[date.getDay()]}, ${date.getDate()} de ${monthNames[date.getMonth()]} de ${date.getFullYear()}`;
  }

  function formatSpanishMonthTitle(date) {
    return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  }

  function formatSpanishWeekTitle(date) {
    const start = startOfWeek(date);
    const end = addDays(start, 6);
    const sameYear = start.getFullYear() === end.getFullYear();
    const sameMonth = sameYear && start.getMonth() === end.getMonth();

    if (sameMonth) {
      return `${start.getDate()}–${end.getDate()} de ${monthNames[end.getMonth()]} de ${end.getFullYear()}`;
    }
    if (sameYear) {
      return `${start.getDate()} de ${monthNames[start.getMonth()]}–${end.getDate()} de ${monthNames[end.getMonth()]} de ${end.getFullYear()}`;
    }
    return `${start.getDate()} de ${monthNames[start.getMonth()]} de ${start.getFullYear()}–${end.getDate()} de ${monthNames[end.getMonth()]} de ${end.getFullYear()}`;
  }

  function navigateDate(view, activeDate, direction) {
    const date = new Date(activeDate.getFullYear(), activeDate.getMonth(), activeDate.getDate(), 12, 0, 0);
    if (direction === "today") return new Date();
    const amount = direction === "prev" ? -1 : 1;
    if (view === "day") return addDays(date, amount);
    if (view === "week") return addDays(date, amount * 7);
    return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12, 0, 0);
  }

  function normalizeEmployeeStatus(value) {
    if (value == null) return "";
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function isInactiveEmployeeStatus(value) {
    const status = normalizeEmployeeStatus(value);
    return status === "inactivo" || status === "inactive" || status === "terminado" || status === "terminated" || status === "suspended";
  }

  function isActiveEmployeeStatus(value) {
    // Fail-closed: only explicit active labels. null/empty/unknown => false.
    const status = normalizeEmployeeStatus(value);
    return status === "activo" || status === "active";
  }

  function resolveUsherScheduleAccess({
    permissions = [],
    profileRole = null,
    linkedEmployee = null,
    inactiveLinkedUsher = false
  }) {
    const permissionSet = new Set(permissions);
    const statusValue = linkedEmployee?.estado || linkedEmployee?.status;
    // Fail-closed: any linked employee that is not explicitly active blocks, including null/empty/unknown.
    const linkedIsNonActive = Boolean(linkedEmployee) && !isActiveEmployeeStatus(statusValue);
    const inactiveFlag = Boolean(inactiveLinkedUsher) || linkedIsNonActive;

    // Non-active linked employee blocks all calendar access, including RBAC manage/read.all.
    if (inactiveFlag) {
      return {
        canManage: false,
        canReadAll: false,
        canReadOwn: false,
        unlinked: false,
        inactiveBlocked: true,
        linkedEmployeeId: null,
        usesCalendarManage: permissionSet.has("calendar.manage")
      };
    }

    const activeLinked = linkedEmployee && isActiveEmployeeStatus(statusValue) ? linkedEmployee : null;
    const position = String(activeLinked?.posicion || activeLinked?.position || "").trim().toLowerCase();
    const isExecutiveUsher = position === "ujier ejecutivo";
    const isUsher = position === "ujier" || isExecutiveUsher;
    const roleManage = profileRole === "administrador" || profileRole === "ejecutivo";
    const rbacManage = permissionSet.has("usher.schedule.manage") || roleManage;
    const rbacReadAll = permissionSet.has("usher.schedule.read.all") || rbacManage;
    const canManage = rbacManage || Boolean(activeLinked && isExecutiveUsher);
    const canReadAll = rbacReadAll || canManage;
    const canReadOwn = Boolean(activeLinked && isUsher) || canReadAll;
    const unlinked = !activeLinked && !canReadAll;
    return {
      canManage,
      canReadAll,
      canReadOwn,
      unlinked,
      inactiveBlocked: false,
      linkedEmployeeId: activeLinked?.id || null,
      // Explicitly separate from museum event calendar authority.
      usesCalendarManage: permissionSet.has("calendar.manage")
    };
  }

  function mapSecureShiftRecord(row) {
    const horaEntrada = String(row.starts_at || row.horaEntrada || "").slice(0, 5);
    const horaSalida = String(row.ends_at || row.horaSalida || "").slice(0, 5);
    return {
      id: row.id,
      employee_id: row.employee_id,
      ujier: row.employee_name || row.ujier || "",
      fecha: row.shift_date || row.fecha,
      horaEntrada,
      horaSalida,
      horario: row.legacy_horario || "",
      area: row.area || ""
    };
  }

  function assertNetworkIsolation(access, records) {
    if (access.canReadAll) return records;
    if (!access.linkedEmployeeId) return [];
    return records.filter((record) => record.employee_id === access.linkedEmployeeId);
  }

  function upcomingUsherShifts(records, todayKey, limit = 5) {
    const key = String(todayKey || "");
    return sortShiftsChronologically(
      (records || []).filter((record) => String(record.fecha || record.shift_date || "") >= key)
    ).slice(0, Math.max(0, limit));
  }

  function resolvePortalUsherCardModel({
    linkedEmployee = null,
    access = null,
    shifts = [],
    todayKey = null
  } = {}) {
    const statusValue = linkedEmployee?.estado || linkedEmployee?.status;
    const position = String(linkedEmployee?.posicion || linkedEmployee?.position || "").trim().toLowerCase();
    const isExecutiveUsher = position === "ujier ejecutivo";
    const isUsher = position === "ujier" || isExecutiveUsher;
    if (!linkedEmployee || !isUsher || !isActiveEmployeeStatus(statusValue)) {
      return { visible: false };
    }
    if (access?.inactiveBlocked || access?.unlinked) {
      return { visible: false };
    }
    if (!access?.canReadOwn && !access?.canReadAll && !access?.canManage) {
      return { visible: false };
    }

    const upcoming = upcomingUsherShifts(shifts, todayKey, access?.canManage || access?.canReadAll ? 3 : 1);
    if (access?.canManage || isExecutiveUsher) {
      return {
        visible: true,
        mode: "manage",
        title: "Calendario de Ujieres",
        emptyMessage: "No hay turnos próximos",
        ctaLabel: "Ver y administrar turnos",
        showManageControls: true,
        upcoming,
        nextShift: upcoming[0] || null,
        calendarHrefUsesEnvironment: true
      };
    }

    return {
      visible: true,
      mode: "own",
      title: "Mis turnos",
      emptyMessage: "No tienes turnos próximos",
      ctaLabel: "Ver mi calendario",
      showManageControls: false,
      upcoming,
      nextShift: upcoming[0] || null,
      calendarHrefUsesEnvironment: true
    };
  }

  /**
   * Navigation gate for ujieres.html. Prefer serverAccess (usher_schedule_access_state)
   * when present; never treat calendar.manage as usher schedule authority.
   */
  function canOpenUsherScheduleFromNavigation({
    permissions = [],
    hasAdministrativeWorkspace = false,
    linkedEmployee = null,
    serverAccess = null
  } = {}) {
    if (hasAdministrativeWorkspace) {
      return { allowed: true, reason: "admin_workspace", redirectToPortal: false };
    }

    // Server access state is authoritative when available (fail-closed for inactive/unlinked).
    if (serverAccess) {
      if (serverAccess.unlinked || serverAccess.inactive_blocked) {
        return {
          allowed: false,
          reason: serverAccess.unlinked ? "unlinked" : "inactive",
          redirectToPortal: true
        };
      }
      if (serverAccess.can_read_own || serverAccess.can_read_all || serverAccess.can_manage) {
        return { allowed: true, reason: "server_access", redirectToPortal: false };
      }
      return { allowed: false, reason: "server_denied", redirectToPortal: true };
    }

    const permissionSet = new Set(permissions || []);
    if (
      permissionSet.has("usher.schedule.read.own")
      || permissionSet.has("usher.schedule.read.all")
      || permissionSet.has("usher.schedule.manage")
    ) {
      return { allowed: true, reason: "usher_permission", redirectToPortal: false };
    }

    const statusValue = linkedEmployee?.estado || linkedEmployee?.status;
    const position = String(linkedEmployee?.posicion || linkedEmployee?.position || "").trim().toLowerCase();
    const isUsher = position === "ujier" || position === "ujier ejecutivo";
    if (linkedEmployee && isUsher && isActiveEmployeeStatus(statusValue)) {
      return { allowed: true, reason: "linked_active_usher", redirectToPortal: false };
    }

    return { allowed: false, reason: "not_usher", redirectToPortal: true };
  }

  const api = {
    dayNames,
    monthNames,
    toDateKey,
    parseDateKey,
    startOfWeek,
    addDays,
    viewRange,
    sortShiftsChronologically,
    filterShiftsForDate,
    formatSpanishDate,
    formatSpanishMonthTitle,
    formatSpanishWeekTitle,
    navigateDate,
    normalizeEmployeeStatus,
    isInactiveEmployeeStatus,
    isActiveEmployeeStatus,
    resolveUsherScheduleAccess,
    mapSecureShiftRecord,
    assertNetworkIsolation,
    upcomingUsherShifts,
    resolvePortalUsherCardModel,
    canOpenUsherScheduleFromNavigation
  };

  root.UsherScheduleCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
