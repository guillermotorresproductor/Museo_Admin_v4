(function () {
  "use strict";

  const catalog = window.RentalSpaces;
  const form = document.querySelector("#rental-form");
  if (!catalog || !form) return;

  const message = document.querySelector("[data-rental-message]");
  const historyBody = document.querySelector("[data-rental-history]");
  const configPanel = document.querySelector("[data-rental-config]");
  const adminPanel = document.querySelector("[data-rental-admin]");
  const spaceSelect = form.querySelector("[data-rental-space]");
  const availability = form.querySelector("[data-rental-availability]");
  const catalogGrid = document.querySelector("[data-rental-catalog]");
  const canManage = () => ["Administrador", "Ejecutivo"].includes(currentAccessLevel());
  const blockingStates = new Set(["En evaluación", "Aprobada"]);
  const statuses = ["Pendiente", "En evaluación", "Aprobada", "Requiere información adicional", "Rechazada", "Cancelada", "Completada"];
  let requests = [];
  let spaces = catalog.allSpaces.map((space) => ({ ...space }));

  const setMessage = (text, type = "") => {
    if (!message) return;
    message.textContent = text;
    message.className = `form-message ${type}`.trim();
  };
  const auditEntry = (action, from = null, to = null) => ({
    action, from, to, user: localStorage.getItem(currentUserKey) || "Usuario", at: new Date().toISOString()
  });
  const createId = () => window.crypto?.randomUUID?.() || `rental-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const findSpace = (id) => spaces.find((space) => space.id === id) || catalog.byId(id);
  const parseDateTime = (date, time) => new Date(`${date}T${time}:00`);
  const requestRange = (request) => ({ start: parseDateTime(request.fecha, request.horaInicio), end: parseDateTime(request.fechaFinal, request.horaFinal) });
  const overlaps = (first, second) => first.start < second.end && second.start < first.end;
  const currentRange = () => ({
    start: parseDateTime(form.elements.fecha.value, form.elements.horaInicio.value),
    end: parseDateTime(form.elements.fechaFinal.value, form.elements.horaFinal.value)
  });
  const conflictForCurrentSelection = () => {
    if (!spaceSelect.value || !form.elements.fecha.value || !form.elements.fechaFinal.value || !form.elements.horaInicio.value || !form.elements.horaFinal.value) return null;
    const selectedRange = currentRange();
    if (Number.isNaN(selectedRange.start.getTime()) || Number.isNaN(selectedRange.end.getTime())) return null;
    return requests.find((request) => request.espacioId === spaceSelect.value && blockingStates.has(request.estado) && overlaps(selectedRange, requestRange(request))) || null;
  };
  const calculatePrice = () => {
    const space = findSpace(spaceSelect.value);
    if (!space || !form.elements.fecha.value || !form.elements.fechaFinal.value) return { rate: 0, units: 0, label: "Días", total: 0 };
    const startDay = new Date(`${form.elements.fecha.value}T12:00:00`);
    const endDay = new Date(`${form.elements.fechaFinal.value}T12:00:00`);
    const days = Math.max(1, Math.round((endDay - startDay) / 86400000) + 1);
    if (space.hourlyRate && days === 1 && form.elements.horaInicio.value && form.elements.horaFinal.value) {
      const hours = Math.max(space.minimumHours, (parseDateTime(form.elements.fechaFinal.value, form.elements.horaFinal.value) - parseDateTime(form.elements.fecha.value, form.elements.horaInicio.value)) / 3600000);
      const total = Math.min(space.canon, Math.max(space.minimumHours * space.hourlyRate, Math.ceil(hours * 2) / 2 * space.hourlyRate));
      return { rate: space.hourlyRate, units: Math.ceil(hours * 2) / 2, label: "Horas", total };
    }
    return { rate: space.canon, units: days, label: "Días", total: space.canon * days };
  };

  function installImageFallbacks(root = document) {
    root.querySelectorAll(".rental-image img").forEach((image) => {
      const figure = image.closest(".rental-image");
      const reveal = () => figure?.classList.add("has-image");
      const fallback = () => figure?.classList.remove("has-image");
      image.addEventListener("load", reveal, { once: true });
      image.addEventListener("error", fallback, { once: true });
      if (image.complete) image.naturalWidth ? reveal() : fallback();
    });
  }

  function renderCatalog() {
    catalogGrid.innerHTML = catalog.publicSpaces.map((space) => `
      <article class="rental-catalog-card">
        ${catalog.imageMarkup(space.images[0], "rental-card-image")}
        <div class="rental-catalog-copy">
          <h3>${catalog.escape(space.name)}</h3>
          <p class="rental-price">${catalog.escape(space.priceSummary)}</p>
          <p>${catalog.escape(space.capacitySummary)}</p>
          <a class="button secondary" href="detalle-espacio.html?id=${encodeURIComponent(space.id)}">Ver espacio</a>
        </div>
      </article>
    `).join("");
    installImageFallbacks(catalogGrid);
  }

  function populateSpaceSelect() {
    spaceSelect.innerHTML = `<option value="">Seleccione un espacio...</option>${catalog.publicSpaces.map((canonical) => {
      const space = findSpace(canonical.id);
      return `<option value="${space.id}"${space.status === "No Disponible" ? " disabled" : ""}>${catalog.escape(space.name)} · ${catalog.escape(space.priceSummary)}</option>`;
    }).join("")}`;
  }

  function renderCalculation() {
    const calculation = calculatePrice();
    document.querySelector("[data-rental-rate]").textContent = catalog.money(calculation.rate);
    document.querySelector("[data-rental-unit-label]").textContent = calculation.label;
    document.querySelector("[data-rental-units]").textContent = calculation.units || 0;
    document.querySelector("[data-rental-total]").textContent = catalog.money(calculation.total);
  }

  function validateSchedule(showErrors = false) {
    const startDate = form.elements.fecha;
    const endDate = form.elements.fechaFinal;
    const startTime = form.elements.horaInicio;
    const endTime = form.elements.horaFinal;
    [startDate, endDate, startTime, endTime].forEach((field) => field.setCustomValidity(""));
    if (startDate.value && endDate.value && endDate.value < startDate.value) endDate.setCustomValidity("La fecha final no puede ser anterior a la inicial.");
    if (startTime.value && endTime.value && endTime.value <= startTime.value) endTime.setCustomValidity("La hora final debe ser posterior a la hora inicial.");
    form.querySelectorAll("[data-field-error]").forEach((element) => { element.textContent = ""; });
    if (showErrors) {
      [startDate, endDate, startTime, endTime].forEach((field) => {
        const error = form.querySelector(`[data-field-error="${field.name}"]`);
        if (error) error.textContent = field.validationMessage;
      });
    }
    const conflict = conflictForCurrentSelection();
    if (availability) {
      availability.textContent = conflict ? `No disponible: coincide con ${conflict.numeroSolicitud}.` : "Sin conflicto detectado para el espacio y horario seleccionados.";
      availability.className = `rental-availability ${conflict ? "is-unavailable" : "is-available"}`;
    }
    return !conflict && form.checkValidity();
  }

  async function syncCalendar(request) {
    const calendarRecords = await fetchSystemCollection("calendario_general", "records", []);
    const withoutCurrent = calendarRecords.filter((item) => item.rentalId !== request.id);
    if (request.estado === "Aprobada") {
      withoutCurrent.push({
        id: `rental-calendar-${request.id}`, rentalId: request.id, fecha: request.fecha,
        fechaFinal: request.fechaFinal, horaInicio: request.horaInicio, horaFinal: request.horaFinal,
        titulo: `Arrendamiento: ${request.espacio}`, descripcion: `${request.tipoActividad} · ${request.nombre}`
      });
    }
    await saveSystemCollection("calendario_general", "records", withoutCurrent);
  }

  async function persistRequests(nextRequests) {
    await saveSystemCollection("renta_espacios", "requests", nextRequests);
    requests = nextRequests;
  }

  function renderHistory() {
    if (!historyBody) return;
    historyBody.innerHTML = requests.length ? requests.map((request) => `
      <tr>
        <td>${catalog.escape(request.numeroSolicitud)}</td><td>${catalog.escape(request.nombre)}</td><td>${catalog.escape(request.espacio)}</td>
        <td>${catalog.escape(request.fecha)}<br><small>${catalog.escape(request.horaInicio)}–${catalog.escape(request.horaFinal)}</small></td>
        <td>${catalog.money(request.total)}</td>
        <td><label class="sr-only" for="status-${request.id}">Estado de ${catalog.escape(request.numeroSolicitud)}</label><select id="status-${request.id}" data-rental-request-status="${request.id}">${statuses.map((status) => `<option${request.estado === status ? " selected" : ""}>${status}</option>`).join("")}</select></td>
      </tr>
    `).join("") : `<tr><td colspan="6">No hay solicitudes registradas.</td></tr>`;
  }

  function renderConfig() {
    if (!configPanel) return;
    configPanel.innerHTML = spaces.map((space) => `
      <article class="rental-config-card">
        <div><strong>${catalog.escape(space.name)}</strong><small>${space.public === false ? "Acceso administrativo" : "Catálogo público"}</small></div>
        <label>Canon<input type="number" min="0" step="0.01" value="${Number(space.canon || 0)}" data-rental-space-id="${space.id}" data-rental-space-field="canon"></label>
        <label>Disponibilidad<select data-rental-space-id="${space.id}" data-rental-space-field="status"><option${space.status !== "No Disponible" ? " selected" : ""}>Disponible</option><option${space.status === "No Disponible" ? " selected" : ""}>No Disponible</option></select></label>
        ${space.public === false ? `<p>Consultar con Administración</p>` : ""}
      </article>
    `).join("");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateSchedule(true)) {
      const firstInvalid = form.querySelector(":invalid");
      firstInvalid?.focus();
      setMessage(conflictForCurrentSelection() ? "El espacio no está disponible en ese horario." : "Revise los campos señalados antes de enviar.", "error");
      return;
    }
    const data = new FormData(form);
    const space = findSpace(data.get("espacio"));
    const calculation = calculatePrice();
    const request = {
      id: createId(), numeroSolicitud: `SOL-${String(requests.length + 1).padStart(4, "0")}`,
      nombre: String(data.get("nombre")).trim(), organizacion: String(data.get("organizacion") || "").trim(), contacto: String(data.get("contacto")).trim(),
      correo: String(data.get("correo")).trim(), telefono: String(data.get("telefono")).trim(), direccion: String(data.get("direccion")).trim(),
      fecha: data.get("fecha"), fechaFinal: data.get("fechaFinal"), horaInicio: data.get("horaInicio"), horaFinal: data.get("horaFinal"), asistentes: Number(data.get("asistentes")),
      tipoActividad: data.get("tipoActividad"), espacioId: space.id, espacio: space.name, descripcion: String(data.get("descripcion")).trim(),
      total: calculation.total, estado: "Pendiente", documentosPendientes: true,
      audit: [auditEntry("Solicitud creada", null, "Pendiente")]
    };
    try {
      await persistRequests([...requests, request]);
      renderHistory();
      form.reset();
      renderCalculation();
      availability.textContent = "Seleccione espacio, fechas y horas para verificar disponibilidad.";
      availability.className = "rental-availability";
      setMessage(`Solicitud ${request.numeroSolicitud} guardada como Pendiente. Los documentos deben entregarse a Administración hasta que el almacenamiento seguro esté disponible.`, "success");
    } catch (error) {
      setMessage(`No se pudo guardar: ${error.message}`, "error");
    }
  });

  form.addEventListener("input", () => { validateSchedule(false); renderCalculation(); });
  form.addEventListener("change", () => { validateSchedule(false); renderCalculation(); });
  document.querySelector("[data-rental-reset]")?.addEventListener("click", () => {
    form.reset(); validateSchedule(false); renderCalculation(); setMessage("");
  });

  historyBody?.addEventListener("change", async (event) => {
    const field = event.target.closest("[data-rental-request-status]");
    if (!field || !canManage()) return;
    const request = requests.find((item) => item.id === field.dataset.rentalRequestStatus);
    if (!request || request.estado === field.value) return;
    const previous = request.estado;
    const next = { ...request, estado: field.value, audit: [...(request.audit || []), auditEntry("Estado actualizado", previous, field.value)] };
    const nextRequests = requests.map((item) => item.id === next.id ? next : item);
    try {
      await syncCalendar(next);
      await persistRequests(nextRequests);
      renderHistory();
      setMessage(`Solicitud ${next.numeroSolicitud} actualizada a ${next.estado}.`, "success");
    } catch (error) {
      field.value = previous;
      setMessage(`No se pudo actualizar el estado: ${error.message}`, "error");
    }
  });

  configPanel?.addEventListener("change", async (event) => {
    const field = event.target.closest("[data-rental-space-field]");
    if (!field || !canManage()) return;
    const nextSpaces = spaces.map((space) => space.id === field.dataset.rentalSpaceId ? { ...space, [field.dataset.rentalSpaceField]: field.dataset.rentalSpaceField === "canon" ? Number(field.value) : field.value } : space);
    try {
      await saveSystemCollection("renta_espacios", "spaces", nextSpaces.map(({ images, ...space }) => space));
      spaces = nextSpaces; populateSpaceSelect(); renderCatalog(); setMessage("Configuración actualizada en Supabase.", "success");
    } catch (error) { setMessage(`No se pudo actualizar la configuración: ${error.message}`, "error"); }
  });

  async function load() {
    renderCatalog();
    if (adminPanel) adminPanel.hidden = !canManage();
    try {
      const [storedSpaces, storedRequests] = await Promise.all([
        fetchSystemCollection("renta_espacios", "spaces", []), fetchSystemCollection("renta_espacios", "requests", [])
      ]);
      if (Array.isArray(storedSpaces)) {
        spaces = catalog.allSpaces.map((canonical) => ({ ...canonical, ...(storedSpaces.find((item) => item.id === canonical.id) || {}), images: canonical.images }));
      }
      requests = Array.isArray(storedRequests) ? storedRequests : [];
    } catch (error) { setMessage(error.message, "error"); }
    populateSpaceSelect(); renderHistory(); renderConfig(); renderCalculation();
    const requestedSpace = new URLSearchParams(window.location.search).get("space");
    if (requestedSpace && catalog.publicSpaces.some((space) => space.id === requestedSpace)) {
      spaceSelect.value = requestedSpace;
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      spaceSelect.focus({ preventScroll: true });
    }
  }

  load();
})();
