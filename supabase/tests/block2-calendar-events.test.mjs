import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../../js/app.js", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("../../js/services/supabase.js", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../../calendario.html", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../migrations/202609030009_calendar_event_classification.sql", import.meta.url), "utf8");

test("Calendario de Eventos usa el modelo real y archivo lógico", () => {
  assert.match(service, /rest\/v1\/calendar_events/);
  assert.match(service, /archived_at=is\.null/);
  assert.match(service, /archiveSupabaseCalendarEvent/);
  assert.match(app, /fetchSupabaseCalendarEvents\("general"\)/);
  assert.match(app, /saveSupabaseCalendarEvent/);
  assert.match(app, /Evento archivado en Supabase/);
  assert.match(service, /classification/);
  assert.match(migration, /add column if not exists classification text/);
  assert.match(page, /js\/services\/supabase\.js\?v=block2-calendar-20260903/);
  assert.match(page, /js\/app\.js\?v=block2-calendar-20260903/);
});
