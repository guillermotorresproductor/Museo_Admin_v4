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
    return `${start.getDate()}–${end.getDate()} de ${monthNames[end.getMonth()]} de ${end.getFullYear()}`;
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
    return String(value || "")
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

  function resolveUsherScheduleAccess({
    permissions = [],
    profileRole = null,
    linkedEmployee = null,
    inactiveLinkedUsher = false
  }) {
    const permissionSet = new Set(permissions);
    const statusValue = linkedEmployee?.estado || linkedEmployee?.status || "";
    const linkedIsInactive = Boolean(linkedEmployee) && isInactiveEmployeeStatus(statusValue);
    const inactiveFlag = Boolean(inactiveLinkedUsher) || linkedIsInactive;
    const activeLinked = linkedEmployee && !linkedIsInactive ? linkedEmployee : null;
    const position = String(activeLinked?.posicion || activeLinked?.position || "").trim().toLowerCase();
    const isExecutiveUsher = position === "ujier ejecutivo";
    const isUsher = position === "ujier" || isExecutiveUsher;
    const roleManage = profileRole === "administrador" || profileRole === "ejecutivo";
    const rbacManage = permissionSet.has("usher.schedule.manage") || roleManage;
    const rbacReadAll = permissionSet.has("usher.schedule.read.all") || rbacManage;
    // Cargo privileges require an active linked usher; inactive never elevates.
    const canManage = rbacManage || Boolean(activeLinked && isExecutiveUsher);
    const canReadAll = rbacReadAll || canManage;
    const canReadOwn = Boolean(activeLinked && isUsher) || canReadAll;
    const unlinked = !activeLinked && !inactiveFlag && !canReadAll;
    const inactiveBlocked = !activeLinked && inactiveFlag && !canReadAll && !canManage;
    return {
      canManage,
      canReadAll,
      canReadOwn,
      unlinked,
      inactiveBlocked,
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
    resolveUsherScheduleAccess,
    mapSecureShiftRecord,
    assertNetworkIsolation
  };

  root.UsherScheduleCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
