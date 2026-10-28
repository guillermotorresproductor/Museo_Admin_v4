/* Horarios semanales. El borrador no toca employee_shifts; publicar usa una sola transacción. */
(function () {
  "use strict";
  function hour(value) {
    if (!value) return "";
    const text = String(value);
    if (text.includes("T") && (/Z$/.test(text) || /[+-][0-9]{2}:?[0-9]{2}$/.test(text))) {
      const parsed = new Date(text);
      if (!Number.isNaN(parsed.getTime())) return new Intl.DateTimeFormat("en-GB", { timeZone: "America/Puerto_Rico", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(parsed);
    }
    const match = text.match(/T(\d\d):(\d\d)/);
    return match ? `${match[1]}:${match[2]}` : text.slice(0, 5);
  }
  function scheduleRangeLabel(start, end, suffix = "") {
    const show = (value) => {
      const raw = hour(value);
      if (!raw) return "";
      const formatted = typeof displayClock === "function" ? displayClock(raw) : "";
      return formatted || raw;
    };
    return `${show(start)} – ${show(end)}${suffix}`;
  }
  if (typeof module === "object" && module.exports) module.exports = { hour, scheduleRangeLabel };
  const root = typeof document === "undefined" ? null : document.querySelector("[data-horarios-module]");
  if (!root) return;
  const $ = (selector) => root.querySelector(selector);
  const status = $("[data-schedule-status]");
  const body = $("[data-schedule-body]");
  const head = $("[data-schedule-head]");
  const editor = $("[data-editor]");
  const dateInput = $("[data-week-date]");
  const departmentFilter = $("[data-department-filter]");
  const positionFilter = $("[data-position-filter]");
  const printWeek = $("[data-print-week]");
  let employees = [];
  let days = [];
  let weekStart = "";
  let editable = false;
  let busy = false;
  let dirty = false;
  let baselineStale = false;
  let serverDraft = null;
  const drafts = new Map();
  const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const addDays = (date, count) => {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + count);
    return [next.getFullYear(), String(next.getMonth() + 1).padStart(2, "0"), String(next.getDate()).padStart(2, "0")].join("-");
  };
  const monday = (date) => addDays(date, -((new Date(`${date}T12:00:00`).getDay() + 6) % 7));
  const label = (date) => new Date(`${date}T12:00:00`).toLocaleDateString("es-PR", { weekday: "short", day: "numeric", month: "short" });
  const nameOf = (employee) => `${employee.nombre || employee.first_name || ""} ${employee.apellidos || employee.last_name || ""}`.trim();
  const positionOf = (employee) => employee.posicion || employee.position || "";
  const departmentOf = (employee) => employee.departamento || employee.department || "";
  const msg = (text, bad = false) => { status.textContent = text; status.className = `form-message${bad ? " error" : ""}`; };
  const clock = (value) => Number(String(value).slice(0, 2)) * 60 + Number(String(value).slice(3, 5));
  const span = (start, end) => { let minutes = clock(end) - clock(start); if (minutes < 0) minutes += 1440; return minutes; };
  const minutes = (shift) => {
    if (!shift || shift.status === "cancelled" || shift.status === "day_off") return 0;
    const start = shift.starts_at || shift.starts_local || shift.local_start;
    const end = shift.ends_at || shift.ends_local || shift.local_end;
    if (!start || !end) return 0;
    if (/T/.test(start) && /T/.test(end)) return Math.max(0, (new Date(end) - new Date(start)) / 60000 - Number(shift.expected_lunch_minutes || 0));
    return Math.max(0, span(String(start).slice(0, 5), String(end).slice(0, 5)) - Number(shift.expected_lunch_minutes || 0));
  };
  const display = (shift) => `${scheduleRangeLabel(shift.local_start || shift.starts_local || shift.starts_at, shift.local_end || shift.ends_local || shift.ends_at)}${shift.crosses_midnight ? " (+1)" : ""}`;
  const scheduledOf = (day) => (day?.shifts || []).filter((shift) => shift.status === "scheduled");
  const completedOf = (day) => (day?.shifts || []).filter((shift) => shift.status === "completed");
  const baselineOf = (day) => {
    const scheduled = scheduledOf(day);
    if (completedOf(day).length) return { baseline: "completed", expectedShiftId: "", expectedUpdatedAt: "" };
    if (scheduled.length > 1) return { baseline: "multiple", expectedShiftId: "", expectedUpdatedAt: "" };
    if (scheduled.length === 1) return { baseline: "scheduled", expectedShiftId: scheduled[0].id || "", expectedUpdatedAt: scheduled[0].updated_at || "" };
    if (day?.day_off) return { baseline: "day_off", expectedShiftId: "", expectedUpdatedAt: "" };
    return { baseline: "none", expectedShiftId: "", expectedUpdatedAt: "" };
  };
  const sameInstant = (left, right) => {
    if (!left && !right) return true;
    const a = Date.parse(left);
    const b = Date.parse(right);
    if (Number.isNaN(a) || Number.isNaN(b)) return String(left || "") === String(right || "");
    return a === b;
  };
  const explain = (error) => {
    const code = String(error?.message || error || "");
    if (/Could not find the function|schema cache|PGRST202/i.test(code)) return "La base todavía no tiene instalada la publicación de horarios. No se escribió ningún turno oficial.";
    const messages = [
      ["SHIFT_SELF_FORBIDDEN", "No puede modificar su propio turno."],
      ["WEEKLY_SCHEDULE_LIMIT", "La semana pasaría de 40 horas ordinarias. Hace falta una autorización excepcional en el motivo."],
      ["INVALID_HOURS", "La jornada neta debe ser de 1 minuto a 8 horas."],
      ["SHIFT_LOCKED", "Ese turno ya comenzó, ya pasó o tiene asistencia."],
      ["COMPLETED_SHIFT_LOCKED", "Ese turno ya está completado."],
      ["SHIFT_CONFLICT", "Otro cambio modificó el turno. Actualice la semana antes de guardar."],
      ["DRAFT_CONFLICT", "El borrador cambió en otra sesión. Actualice la semana."],
      ["MISSING_BASELINE_SNAPSHOT", "Apareció un turno oficial después de guardar el borrador. Actualice la semana."],
      ["SHIFT_OVERLAP", "Ese horario se solapa con otro turno del empleado."],
      ["MULTIPLE_SHIFTS_REQUIRE_MANUAL_REVIEW", "Ese día tiene varios turnos. Edítelo desde Recursos Humanos."],
      ["REASON_REQUIRED", "Indique un motivo de al menos 3 caracteres."],
      ["EMPLOYEE_NOT_ACTIVE", "El empleado no está activo en este museo."],
      ["FORBIDDEN", "No tiene permiso para administrar horarios."],
      ["INVALID_BATCH", "No hay cambios para publicar."]
    ];
    const known = messages.find(([item]) => code.includes(item));
    return known ? known[1] : (code || "No se pudo completar la operación.");
  };
  const draftNet = (draft) => draft?.dayOff ? 0 : Math.max(0, span(draft.start, draft.end) - Number(draft.lunch || 0));
  const officialNet = (employee, date, ignoredId) => scheduledOf(employee._week?.[date]).reduce((sum, shift) => sum + (shift.id !== ignoredId ? minutes(shift) : 0), 0);
  const weekNet = (employee, date, next) => days.reduce((sum, day) => {
    if (day === date) return sum + next;
    const draft = drafts.get(`${employee.id}|${day}`);
    if (draft) return sum + draftNet(draft);
    return sum + officialNet(employee, day);
  }, 0);

  function draw() {
    const visible = employees.filter((employee) => (!departmentFilter.value || departmentOf(employee) === departmentFilter.value) && (!positionFilter.value || positionOf(employee) === positionFilter.value));
    head.innerHTML = `<tr><th>Empleado / posición</th>${days.map((day) => `<th>${safe(label(day))}</th>`).join("")}<th>Total</th></tr>`;
    body.innerHTML = visible.map((employee) => {
      const cells = days.map((day) => {
        const item = employee._week?.[day];
        const draft = drafts.get(`${employee.id}|${day}`);
        const scheduled = scheduledOf(item);
        const completed = completedOf(item);
        const line = employee._failed ? "ERROR" : draft ? (draft.dayOff ? "LIBRE (borrador)" : scheduleRangeLabel(draft.start, draft.end, " (borrador)")) : item?.day_off ? "LIBRE" : scheduled.length ? scheduled.map(display).join(" / ") : completed.length ? `${completed.map(display).join(" / ")} (cerrado)` : "—";
        return `<td><button class="schedule-cell${draft ? " is-draft" : ""}" type="button" data-id="${safe(employee.id)}" data-date="${day}" ${editable ? "" : "disabled"}>${safe(line)}</button></td>`;
      }).join("");
      const total = days.reduce((sum, day) => {
        const draft = drafts.get(`${employee.id}|${day}`);
        return sum + (draft ? draftNet(draft) : officialNet(employee, day));
      }, 0) / 60;
      const meta = [positionOf(employee), departmentOf(employee)].filter(Boolean).join(" · ");
      return `<tr><th>${safe(nameOf(employee))}<small style="display:block">${safe(meta)}</small></th>${cells}<td class="schedule-total">${total.toFixed(1)} h</td></tr>`;
    }).join("") || `<tr><td colspan="9">No hay empleados en esta selección.</td></tr>`;
    if (printWeek) printWeek.textContent = `Semana ${days[0] || ""} a ${days[6] || ""}`;
  }

  function fillFilters() {
    const options = (select, values) => {
      const current = select.value;
      select.innerHTML = `<option value="">${select === departmentFilter ? "Todos" : "Todas"}</option>` + values.map((value) => `<option value="${safe(value)}">${safe(value)}</option>`).join("");
      if ([...select.options].some((option) => option.value === current)) select.value = current;
    };
    options(departmentFilter, [...new Set(employees.map(departmentOf).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")));
    options(positionFilter, [...new Set(employees.map(positionOf).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")));
  }

  function applyServerDraft(payload) {
    drafts.clear();
    baselineStale = false;
    serverDraft = payload?.id ? { id: payload.id, revision: payload.revision } : null;
    for (const item of payload?.items || []) {
      const employee = employees.find((person) => person.id === item.employeeId);
      const base = baselineOf(employee?._week?.[item.date]);
      const serverBaseline = item.baseline || "none";
      const matches = serverBaseline === base.baseline && (serverBaseline !== "scheduled" || (String(item.sourceShiftId || "") === String(base.expectedShiftId) && sameInstant(item.sourceUpdatedAt, base.expectedUpdatedAt)));
      if (!matches || base.baseline === "completed" || base.baseline === "multiple") baselineStale = true;
      drafts.set(`${item.employeeId}|${item.date}`, {
        employeeId: item.employeeId,
        date: item.date,
        dayOff: Boolean(item.dayOff),
        start: item.start || "",
        end: item.end || "",
        lunch: Number(item.lunch ?? 0),
        reason: item.reason || "",
        baseline: base.baseline,
        expectedShiftId: base.expectedShiftId,
        expectedUpdatedAt: base.expectedUpdatedAt
      });
    }
  }

  async function load() {
    editor.hidden = true;
    weekStart = monday(dateInput.value || new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 10));
    dateInput.value = weekStart;
    days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
    msg("Consultando turnos...");
    try {
      const [results, draftResult] = await Promise.all([
        Promise.all(employees.map((employee) => listEmployeeShifts(employee.id, days[0], days[6]).then((value) => ({ employee, value })).catch((error) => ({ employee, error })))),
        getScheduleWeekDraft(weekStart).then((value) => ({ value })).catch((error) => ({ error }))
      ]);
      let failures = 0;
      for (const { employee, value, error } of results) {
        employee._week = {};
        if (error) { failures += 1; employee._failed = true; continue; }
        employee._failed = false;
        employee._self = Boolean(value?.self);
        for (const day of value?.days || []) employee._week[day.shift_date] = day;
      }
      if (draftResult.error) {
        serverDraft = null;
        drafts.clear();
        draw();
        msg(`${explain(draftResult.error)} Los turnos oficiales sí se consultaron.`, true);
        return;
      }
      applyServerDraft(draftResult.value);
      dirty = false;
      draw();
      const draftNote = serverDraft ? ` Borrador guardado, revisión ${serverDraft.revision}.` : "";
      const staleNote = baselineStale ? " Hay turnos oficiales más nuevos: guarde el borrador otra vez antes de publicar." : "";
      msg(failures ? `No se pudieron consultar ${failures} empleados. No asumir que sus turnos están vacíos.` : `Semana ${days[0]} a ${days[6]} · ${employees.length} empleados.${draftNote}${staleNote}`, Boolean(failures || baselineStale));
    } catch (error) {
      msg(`Error consultando horarios: ${explain(error)}`, true);
    }
  }

  function remember(employeeId, date, draft) {
    drafts.set(`${employeeId}|${date}`, draft);
    dirty = true;
    editor.hidden = true;
    draw();
  }

  async function persist() {
    const items = [...drafts.values()].filter((item) => days.includes(item.date)).map((item) => ({
      employeeId: item.employeeId,
      date: item.date,
      dayOff: Boolean(item.dayOff),
      start: item.dayOff ? null : item.start,
      end: item.dayOff ? null : item.end,
      lunch: item.dayOff ? null : item.lunch,
      reason: item.reason || "",
      baseline: item.baseline || "unknown",
      expectedShiftId: item.expectedShiftId || "",
      expectedUpdatedAt: item.expectedUpdatedAt || ""
    }));
    const saved = await saveScheduleWeekDraft(weekStart, items, serverDraft?.id || null, serverDraft ? serverDraft.revision : null);
    serverDraft = { id: saved.id, revision: saved.revision };
    dirty = false;
    baselineStale = false;
    return saved;
  }

  async function run(task) {
    if (busy) return;
    busy = true;
    try { await task(); } finally { busy = false; }
  }

  function abandon() {
    return !dirty || window.confirm("Hay cambios del borrador sin guardar. ¿Continuar y descartarlos de esta pantalla?");
  }

  async function start() {
    try {
      if (typeof hasPermission !== "function" || !hasPermission("schedules.manage")) {
        root.innerHTML = "<h2>Acceso restringido</h2><p>No tiene autorización para administrar horarios.</p>";
        return;
      }
      editable = true;
      employees = (await fetchSupabaseEmployees()).filter((employee) => !["inactive", "inactivo"].includes(String(employee.statusCode || employee.status || employee.estado || "").toLowerCase()));
      fillFilters();
      dateInput.value = monday(new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 10));
      await load();
    } catch (error) {
      msg(`No fue posible abrir Horarios: ${explain(error)}`, true);
    }
  }

  body.addEventListener("click", (event) => {
    const button = event.target.closest("[data-id]");
    if (!button || !editable) return;
    const employee = employees.find((person) => person.id === button.dataset.id);
    if (!employee) return;
    if (employee._failed) { msg("No se puede editar: falló la consulta del empleado.", true); return; }
    if (employee._self) { msg("No puede modificar su propio turno.", true); return; }
    const day = employee._week?.[button.dataset.date];
    const base = baselineOf(day);
    if (base.baseline === "completed") { msg("Este turno ya está completado.", true); return; }
    if (base.baseline === "multiple") { msg("Hay varios turnos este día. Edítelos desde Recursos Humanos.", true); return; }
    const scheduled = scheduledOf(day)[0];
    const draft = drafts.get(`${employee.id}|${button.dataset.date}`);
    editor.reset();
    editor.elements.employeeId.value = employee.id;
    editor.elements.shiftDate.value = button.dataset.date;
    editor.elements.shiftId.value = base.expectedShiftId;
    editor.elements.expectedUpdatedAt.value = base.expectedUpdatedAt;
    editor.elements.baseline.value = base.baseline;
    editor.elements.startsLocal.value = draft?.start || hour(scheduled?.local_start || scheduled?.starts_local || scheduled?.starts_at) || "08:00";
    editor.elements.endsLocal.value = draft?.end || hour(scheduled?.local_end || scheduled?.ends_local || scheduled?.ends_at) || "17:00";
    editor.elements.lunchMinutes.value = draft && !draft.dayOff ? draft.lunch : (scheduled?.expected_lunch_minutes ?? 60);
    editor.elements.reason.value = draft?.reason || "";
    $("[data-editor-title]").textContent = `${nameOf(employee)} · ${button.dataset.date}`;
    editor.hidden = false;
    editor.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  editor.addEventListener("submit", (event) => {
    event.preventDefault();
    const fields = editor.elements;
    try {
      const start = fields.startsLocal.value;
      const end = fields.endsLocal.value;
      const lunch = Number(fields.lunchMinutes.value);
      const length = span(start, end);
      if (start === end || !Number.isInteger(lunch) || lunch < 0 || lunch >= length) throw Error("El almuerzo debe ser menor que la duración del turno.");
      const net = length - lunch;
      if (net > 480) throw Error("Este turno supera 8 horas ordinarias netas.");
      const employee = employees.find((person) => person.id === fields.employeeId.value);
      if (!employee || employee._failed || employee._self) throw Error("No autorizado o datos incompletos.");
      if (fields.baseline.value === "scheduled" && fields.reason.value.trim().length < 3) throw Error("Indique un motivo de al menos 3 caracteres.");
      if (weekNet(employee, fields.shiftDate.value, net) > 2400) throw Error("El borrador superaría 40 horas semanales.");
      remember(employee.id, fields.shiftDate.value, {
        employeeId: employee.id, date: fields.shiftDate.value, dayOff: false, start, end, lunch, reason: fields.reason.value.trim(),
        baseline: fields.baseline.value, expectedShiftId: fields.shiftId.value, expectedUpdatedAt: fields.expectedUpdatedAt.value
      });
      msg(`Añadido al borrador (${(net / 60).toFixed(1)} h netas). Aún no está guardado en el servidor.`);
    } catch (error) {
      msg(`No se añadió: ${error.message || error}`, true);
    }
  });

  $("[data-day-off]").addEventListener("click", () => {
    const fields = editor.elements;
    const reason = fields.reason.value.trim();
    if (reason.length < 3) { msg("Indique un motivo de al menos 3 caracteres para el día libre.", true); return; }
    const employee = employees.find((person) => person.id === fields.employeeId.value);
    if (!employee || employee._self || employee._failed) { msg("No autorizado o datos incompletos.", true); return; }
    remember(employee.id, fields.shiftDate.value, {
      employeeId: employee.id, date: fields.shiftDate.value, dayOff: true, reason,
      baseline: fields.baseline.value, expectedShiftId: fields.shiftId.value, expectedUpdatedAt: fields.expectedUpdatedAt.value
    });
    msg("Día libre añadido al borrador. Aún no está guardado en el servidor.");
  });

  $("[data-save-draft]").addEventListener("click", () => run(async () => {
    try {
      const saved = await persist();
      msg(`Borrador guardado. Revisión ${saved.revision}. Los turnos oficiales no cambiaron.`);
    } catch (error) { msg(explain(error), true); }
  }));

  $("[data-publish-week]").addEventListener("click", () => run(async () => {
    const warning = baselineStale ? " Algunos turnos oficiales cambiaron desde el último guardado." : "";
    if (!window.confirm(`¿Publicar esta semana?${warning} Los turnos oficiales se actualizarán en una sola operación y cada empleado verá solo los suyos en Mi Espacio.`)) return;
    try {
      if (dirty || baselineStale || !serverDraft) await persist();
      if (!serverDraft?.id) throw Error("No hay cambios para publicar.");
      const published = await publishScheduleWeek(serverDraft.id, serverDraft.revision);
      serverDraft = null;
      drafts.clear();
      dirty = false;
      await load();
      msg(`Semana publicada (${published.count} asignaciones). Ya es visible en Mi Espacio.`);
    } catch (error) { msg(explain(error), true); }
  }));

  $("[data-clear-draft]").addEventListener("click", () => run(async () => {
    if (drafts.size && !window.confirm("¿Descartar el borrador sin publicar?")) return;
    try {
      if (serverDraft?.id) await discardScheduleWeekDraft(serverDraft.id, serverDraft.revision);
      drafts.clear();
      serverDraft = null;
      dirty = false;
      baselineStale = false;
      draw();
      msg("Borrador descartado. Los turnos oficiales no cambiaron.");
    } catch (error) { msg(explain(error), true); }
  }));

  $("[data-close-editor]").addEventListener("click", () => { editor.hidden = true; });
  $("[data-export-draft]").addEventListener("click", () => {
    const data = { format: "instituva-horarios-draft", version: 2, createdAt: new Date().toISOString(), items: [...drafts.values()] };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "horarios-borrador.json";
    link.click();
    URL.revokeObjectURL(url);
    msg("Borrador exportado. No se publicó.");
  });
  $("[data-import-draft]").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 1000000) throw Error("Archivo demasiado grande");
      const data = JSON.parse(await file.text());
      if (data.format !== "instituva-horarios-draft" || ![1, 2].includes(data.version) || !Array.isArray(data.items) || data.items.length > 500) throw Error("Formato inválido");
      const incoming = new Map();
      for (const item of data.items) {
        if (!employees.some((employee) => employee.id === item.employeeId) || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(item.date)) throw Error("Datos no válidos");
        if (!item.dayOff && (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(item.start) || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(item.end) || !Number.isInteger(item.lunch))) throw Error("Datos no válidos");
        if (!item.dayOff && (item.start === item.end || item.lunch < 0 || item.lunch >= span(item.start, item.end) || span(item.start, item.end) - item.lunch > 480)) throw Error("Turno fuera del límite diario");
        const employee = employees.find((person) => person.id === item.employeeId);
        const base = days.includes(item.date) ? baselineOf(employee?._week?.[item.date]) : { baseline: "unknown", expectedShiftId: "", expectedUpdatedAt: "" };
        if (base.baseline === "completed" || base.baseline === "multiple") throw Error("El archivo pisa un turno cerrado o múltiple.");
        incoming.set(`${item.employeeId}|${item.date}`, { ...item, dayOff: Boolean(item.dayOff), reason: String(item.reason || ""), ...base });
      }
      const totals = new Map();
      for (const item of incoming.values()) {
        if (item.dayOff) continue;
        const key = `${item.employeeId}|${monday(item.date)}`;
        totals.set(key, (totals.get(key) || 0) + span(item.start, item.end) - item.lunch);
      }
      if ([...totals.values()].some((value) => value > 2400)) throw Error("El borrador contiene más de 40 horas semanales");
      drafts.clear();
      for (const [key, value] of incoming) drafts.set(key, value);
      dirty = true;
      draw();
      msg("Borrador importado en esta pantalla. Guárdelo para conservarlo. No se publicó.");
    } catch (error) { msg(`Error al importar: ${error.message}`, true); }
  });

  const move = (count) => {
    if (!abandon()) return;
    dateInput.value = addDays(weekStart, count);
    dirty = false;
    load();
  };
  $("[data-prev-week]").addEventListener("click", () => move(-7));
  $("[data-next-week]").addEventListener("click", () => move(7));
  $("[data-refresh]").addEventListener("click", () => { if (abandon()) { dirty = false; load(); } });
  dateInput.addEventListener("change", () => { if (!abandon()) { dateInput.value = weekStart; return; } dirty = false; load(); });
  departmentFilter.addEventListener("change", draw);
  positionFilter.addEventListener("change", draw);
  $("[data-print]").addEventListener("click", () => window.print());
  if (document.body.classList.contains("app-ready")) start();
  else {
    const observer = new MutationObserver(() => {
      if (!document.body.classList.contains("app-ready")) return;
      observer.disconnect();
      start();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
})();
