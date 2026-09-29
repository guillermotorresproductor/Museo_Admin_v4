import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync("supabase/migrations/202609290002_compensation_history_rpc.sql", "utf8");
const page = fs.readFileSync("js/app.js", "utf8");
const service = fs.readFileSync("js/services/supabase.js", "utf8");
const directory = fs.readFileSync("recursos-humanos.html", "utf8");
const profile = fs.readFileSync("perfil-empleado.html", "utf8");
const payroll = fs.readFileSync("supabase/migrations/202609290001_payroll_actual.sql", "utf8");

test("the screen reads and saves compensation through the history RPCs", () => {
  assert.match(service, /\/rest\/v1\/rpc\/get_employee_compensation/);
  assert.match(service, /\/rest\/v1\/rpc\/save_employee_compensation/);
  assert.match(page, /standard_hours_week: hoursRaw/);
  assert.match(directory, /name="standardHoursWeek"/);
  assert.match(profile, /name="standardHoursWeek"/);
  assert.match(migration, /create or replace function public.get_employee_compensation/);
  assert.match(migration, /create or replace function public.save_employee_compensation/);
});

test("a repeated effective date is rejected and hours are inherited", () => {
  assert.match(migration, /Ya existe una compensación para esa fecha de vigencia/);
  assert.match(migration, /nullif\(previous->>'standard_hours_week', ''\)::numeric/);
  assert.doesNotMatch(migration, /on conflict \(employee_id\) do update set compensation_type/i);
});

test("the old sensitive save no longer writes compensation", () => {
  const body = migration.slice(migration.indexOf("function public.save_employee_sensitive_details"));
  assert.match(body, /employee_emergency_contacts/);
  assert.doesNotMatch(body, /insert into public\.employee_compensation/);
  assert.match(body, /'compensation_updated', false/);
});

test("normal users keep select under RLS and lose truncate", () => {
  assert.match(migration, /revoke all on public\.employee_compensation from public, anon, authenticated/);
  assert.match(migration, /grant select on public\.employee_compensation to authenticated/);
  assert.match(migration, /COMPENSATION_HISTORY_IMMUTABLE/);
  assert.match(migration, /revoke all on function public\.resolve_employee_compensation/);
});

test("payroll actual is unchanged by the compensation correction", () => {
  assert.match(payroll, /remaining := 2400/);
  assert.doesNotMatch(payroll, /update public\.finance_records/);
});
