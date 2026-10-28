import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("../../js/time-format.js");
const { hour, scheduleRangeLabel } = require("../../js/horarios.js");

test("schedule cells show American time and keep 24-hour storage", () => {
  assert.equal(hour("08:00"), "08:00");
  assert.equal(hour("17:00:00"), "17:00");
  assert.equal(hour("2026-10-28T13:00:00-04:00"), "13:00");
  assert.equal(scheduleRangeLabel("08:00", "17:00"), "8:00 AM – 5:00 PM");
  assert.equal(scheduleRangeLabel("08:00", "17:00", " (borrador)"), "8:00 AM – 5:00 PM (borrador)");
  assert.equal(scheduleRangeLabel("18:00", "01:00"), "6:00 PM – 1:00 AM");
  const page = fs.readFileSync("horarios.html", "utf8");
  const source = fs.readFileSync("js/horarios.js", "utf8");
  assert.match(page, /js\/time-format\.js/);
  assert.match(page, /data-clock-storage="24"/);
  assert.match(source, /editor\.elements\.startsLocal\.value = draft\?\.start \|\| hour\(/);
  assert.match(source, /start: item\.dayOff \? null : item\.start/);
});

test("week, draft, and print cells use 12-hour text while the editor keeps 24-hour values", async () => {
  const jsdomRequire = createRequire("C:/Users/guill/AppData/Local/Temp/museo-jsdom/package.json");
  const { JSDOM } = jsdomRequire("jsdom");
  const dom = new JSDOM(`<!doctype html><html><body>
    <section data-horarios-module>
      <input type="date" data-week-date>
      <select data-department-filter><option value="">Todos</option></select>
      <select data-position-filter><option value="">Todas</option></select>
      <p data-print-week></p>
      <p data-schedule-status></p>
      <table><thead data-schedule-head></thead><tbody data-schedule-body></tbody></table>
      <button type="button" data-print>Imprimir</button>
      <button type="button" data-prev-week></button>
      <button type="button" data-next-week></button>
      <button type="button" data-refresh></button>
      <button type="button" data-edit-schedule>Editar horario</button>
      <button type="button" data-save-schedule>Guardar horario</button>
      <button type="button" data-cancel-schedule>Cancelar horario</button>
      <form data-editor hidden>
        <h3 data-editor-title></h3>
        <input type="hidden" name="employeeId">
        <input type="hidden" name="shiftDate">
        <input type="hidden" name="shiftId">
        <input type="hidden" name="expectedUpdatedAt">
        <input type="hidden" name="baseline">
        <input type="time" name="startsLocal" data-clock-storage="24" required>
        <input type="time" name="endsLocal" data-clock-storage="24" required>
        <input type="number" name="lunchMinutes" value="60">
        <input type="text" name="reason">
        <button type="submit">Guardar horario</button>
        <button type="button" data-day-off></button>
        <button type="button" data-close-editor></button>
      </form>
    </section>
  </body></html>`, { url: "http://127.0.0.1:8765/horarios.html", runScripts: "dangerously" });
  const { window } = dom;
  const load = (source) => {
    const script = window.document.createElement("script");
    script.textContent = source;
    window.document.body.append(script);
  };
  const saved = [];
  const addDays = (date, count) => {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + count);
    return [next.getFullYear(), String(next.getMonth() + 1).padStart(2, "0"), String(next.getDate()).padStart(2, "0")].join("-");
  };
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.hasPermission = () => true;
  window.confirm = () => false;
  window.print = () => { window.printed = true; };
  window.fetchSupabaseEmployees = async () => [{ id: "emp-1", nombre: "Ana", apellidos: "Ruiz", posicion: "Guía", departamento: "Educación", status: "active" }];
  window.listEmployeeShifts = async (_id, from) => ({
    self: false,
    days: [
      { shift_date: from, shifts: [{ id: "shift-1", status: "scheduled", local_start: "08:00", local_end: "17:00", expected_lunch_minutes: 60, updated_at: "2026-10-26T16:00:00Z" }] },
      { shift_date: addDays(from, 3), shifts: [{ id: "shift-2", status: "completed", local_start: "09:00", local_end: "13:00" }] },
      { shift_date: addDays(from, 4), shifts: [{ id: "shift-3", status: "scheduled", local_start: "18:00", local_end: "01:00", crosses_midnight: true, updated_at: "2026-10-26T16:00:00Z" }] }
    ]
  });
  window.getScheduleWeekDraft = async (week) => ({
    id: "draft-1",
    revision: 2,
    items: [{ employeeId: "emp-1", date: addDays(week, 1), dayOff: false, start: "08:00", end: "17:00", lunch: 60, reason: "ajuste", baseline: "none" }]
  });
  const published = [];
  const cancelled = [];
  window.saveScheduleWeekDraft = async (_week, items) => { saved.push(items); return { id: "draft-1", revision: 3 }; };
  window.publishScheduleWeek = async (id, revision) => { published.push({ id, revision }); return { count: 1 }; };
  window.cancelEmployeeShift = async (id, updatedAt, reason) => { cancelled.push({ id, updatedAt, reason }); return { status: "cancelled" }; };
  window.discardScheduleWeekDraft = async () => ({});
  load(fs.readFileSync("js/time-format.js", "utf8"));
  load(fs.readFileSync("js/horarios.js", "utf8"));
  window.document.body.classList.add("app-ready");
  const cell = async (date) => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const button = window.document.querySelector(`[data-date="${date}"]`);
      if (button) return button;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`missing cell ${date}`);
  };
  const week = window.document.querySelector("[data-week-date]");
  for (let attempt = 0; attempt < 40 && !week.value; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
  const monday = week.value;
  assert.equal((await cell(monday)).textContent, "8:00 AM – 5:00 PM");
  assert.equal((await cell(addDays(monday, 1))).textContent, "8:00 AM – 5:00 PM (borrador)");
  assert.equal((await cell(addDays(monday, 3))).textContent, "9:00 AM – 1:00 PM (cerrado)");
  assert.equal((await cell(addDays(monday, 4))).textContent, "6:00 PM – 1:00 AM (+1)");
  assert.match(window.document.querySelector("[data-print-week]").textContent, /^Semana /);
  window.document.querySelector("[data-print]").click();
  assert.equal(window.printed, true);
  assert.equal(window.document.querySelector(`[data-date="${monday}"]`).textContent, "8:00 AM – 5:00 PM");
  window.document.querySelector(`[data-date="${monday}"]`).click();
  const editor = window.document.querySelector("[data-editor]");
  assert.equal(editor.elements.startsLocal.value, "08:00");
  assert.equal(editor.elements.endsLocal.value, "17:00");
  assert.equal(editor.elements.startsLocal.type, "time");
  assert.equal(editor.querySelector(".us-time-face"), null);
  editor.elements.endsLocal.value = "16:00";
  editor.elements.reason.value = "ajuste de salida";
  editor.requestSubmit();
  for (let attempt = 0; attempt < 40 && !published.length; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
  const mondayItem = saved[0].find((item) => item.date === monday);
  assert.equal(mondayItem.start, "08:00");
  assert.equal(mondayItem.end, "16:00");
  const tuesdayItem = saved[0].find((item) => item.date === addDays(monday, 1));
  assert.equal(tuesdayItem.start, "08:00");
  assert.equal(tuesdayItem.end, "17:00");
  assert.deepEqual(published[0], { id: "draft-1", revision: 3 });
  assert.equal((await cell(monday)).textContent, "8:00 AM – 5:00 PM");
  window.document.querySelector(`[data-date="${monday}"]`).click();
  window.document.querySelector("[data-editor]").elements.reason.value = "retiro del turno";
  window.confirm = () => true;
  window.document.querySelector("[data-cancel-schedule]").click();
  for (let attempt = 0; attempt < 40 && !cancelled.length; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(cancelled[0].id, "shift-1");
  assert.equal(cancelled[0].reason, "retiro del turno");
  assert.equal(saved.length, 1);
});
