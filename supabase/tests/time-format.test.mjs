import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  formatAmericanTime,
  presentAmericanClockText,
  displayClock,
  timeValueTo24Hour,
  installAmericanTimeFields
} = require("../../js/time-format.js");

test("clock presentation uses American 12-hour time", () => {
  assert.equal(formatAmericanTime("08:00"), "8:00 AM");
  assert.equal(formatAmericanTime("08:00:00"), "8:00 AM");
  assert.equal(formatAmericanTime("13:00"), "1:00 PM");
  assert.equal(formatAmericanTime("00:00"), "12:00 AM");
  assert.equal(formatAmericanTime("12:00"), "12:00 PM");
  assert.equal(formatAmericanTime("17:00"), "5:00 PM");
  assert.equal(formatAmericanTime("23:59"), "11:59 PM");
  assert.equal(formatAmericanTime("2026-10-28"), "");
  assert.equal(formatAmericanTime("2026-10-28T08:00:00-04:00"), "8:00 AM");
  assert.equal(formatAmericanTime("2026-10-28T13:00:00-04:00"), "1:00 PM");
  assert.equal(formatAmericanTime("2026-10-28T00:00:00-04:00"), "12:00 AM");
  assert.equal(formatAmericanTime("2026-10-28T12:00:00-04:00"), "12:00 PM");
});

test("prose keeps durations and converts only clock text", () => {
  assert.equal(presentAmericanClockText("Lunes a viernes, 8:00 a. m. – 5:00 p. m."), "Lunes a viernes, 8:00 AM – 5:00 PM");
  assert.equal(presentAmericanClockText("6:00 p.m. - 12:00 a.m."), "6:00 PM - 12:00 AM");
  assert.equal(presentAmericanClockText("13:00–17:00"), "1:00 PM–5:00 PM");
  assert.equal(presentAmericanClockText("13:00-17:00"), "1:00 PM-5:00 PM");
  assert.equal(presentAmericanClockText("13:00:00"), "1:00 PM");
  assert.equal(presentAmericanClockText("24 horas consecutivas"), "24 horas consecutivas");
  assert.equal(presentAmericanClockText("Alquiler por hora: $40, con reservación mínima de 2 horas"), "Alquiler por hora: $40, con reservación mínima de 2 horas");
  assert.equal(presentAmericanClockText("2026-10-28T13:00:00-04:00"), "2026-10-28T13:00:00-04:00");
  assert.equal(displayClock("08:00"), "8:00 AM");
  assert.equal(displayClock("6:00 p. m. a 10:00 p. m."), "6:00 PM a 10:00 PM");
});

test("selectors write the original 24-hour value", () => {
  assert.equal(timeValueTo24Hour("8", "00", "AM"), "08:00");
  assert.equal(timeValueTo24Hour("1", "00", "PM"), "13:00");
  assert.equal(timeValueTo24Hour("12", "00", "AM"), "00:00");
  assert.equal(timeValueTo24Hour("12", "00", "PM"), "12:00");
  assert.equal(timeValueTo24Hour("5", "30", "PM"), "17:30");
  assert.equal(timeValueTo24Hour("", "00", "AM"), "");
  assert.equal(timeValueTo24Hour("8", "", "AM"), "");
});

test("shared date formatter changes the time and leaves the date locale", () => {
  const app = fs.readFileSync("js/app.js", "utf8");
  const start = app.indexOf("function formatPortalDate");
  const end = app.indexOf("function renderPortalTimeEntries");
  const context = vm.createContext({ formatAmericanTime, Intl, Date });
  vm.runInContext(app.slice(start, end), context);
  const sample = "2026-10-28T13:00:00-04:00";
  const dateOptions = { weekday: "short", month: "short", day: "numeric" };
  const expectedDate = new Intl.DateTimeFormat("es-PR", { timeZone: "America/Puerto_Rico", ...dateOptions }).format(new Date(sample));
  assert.equal(context.formatPortalDate(sample, dateOptions), expectedDate);
  assert.equal(context.formatPortalDate(sample, { hour: "numeric", minute: "2-digit" }), "1:00 PM");
  assert.match(context.formatPortalDate(sample, { ...dateOptions, hour: "numeric", minute: "2-digit" }), /1:00 PM$/);
  assert.match(app, /hourCycle: "h23"/);
  assert.match(app, /starts_local:data\.get\("startsLocal"\)/);
});

test("time controls show AM/PM and keep the submitted value in 24-hour form", () => {
  const jsdomRequire = createRequire("C:/Users/guill/AppData/Local/Temp/museo-jsdom/package.json");
  const { JSDOM } = jsdomRequire("jsdom");
  const dom = new JSDOM(`<!doctype html><html><body>
    <form>
      <label class="field">Entrada<input type="time" name="startsLocal" value="08:00" required></label>
      <label class="field">Propuesta<input type="datetime-local" name="proposedAt" value="2026-10-28T13:05" required></label>
    </form>
  </body></html>`);
  const { document } = dom.window;
  installAmericanTimeFields(document);
  const form = document.querySelector("form");
  const time = form.elements.startsLocal;
  const stamp = form.elements.proposedAt;
  assert.equal(time.value, "08:00");
  assert.equal(form.querySelector("[data-us-time-part=hour]").value, "8");
  assert.equal(form.querySelector("[data-us-time-part=minute]").value, "00");
  assert.equal(form.querySelector("[data-us-time-part=period]").value, "AM");
  form.querySelectorAll("[data-us-time-part=hour]")[0].value = "1";
  form.querySelectorAll("[data-us-time-part=minute]")[0].value = "00";
  form.querySelectorAll("[data-us-time-part=period]")[0].value = "PM";
  form.querySelector("[data-us-time-part=hour]").dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  assert.equal(time.value, "13:00");
  assert.equal(new dom.window.FormData(form).get("startsLocal"), "13:00");
  time.value = "00:30";
  assert.equal(form.querySelector("[data-us-time-part=hour]").value, "12");
  assert.equal(form.querySelector("[data-us-time-part=minute]").value, "30");
  assert.equal(form.querySelector("[data-us-time-part=period]").value, "AM");
  assert.equal(stamp.value, "2026-10-28T13:05");
  const face = stamp.closest(".us-time-host");
  assert.equal(face.querySelector("[data-us-time-part=hour]").value, "1");
  assert.equal(face.querySelector("[data-us-time-part=minute]").value, "05");
  assert.equal(face.querySelector("[data-us-time-part=period]").value, "PM");
  assert.equal(face.querySelector("input[type=date]").value, "2026-10-28");
  face.querySelector("[data-us-time-part=hour]").value = "8";
  face.querySelector("[data-us-time-part=period]").value = "AM";
  face.querySelector("[data-us-time-part=period]").dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  assert.equal(stamp.value, "2026-10-28T08:05");
  assert.equal(new dom.window.FormData(form).get("proposedAt"), "2026-10-28T08:05");
});
