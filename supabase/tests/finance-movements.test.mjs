import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync("supabase/migrations/202609300001_finance_movements.sql", "utf8");

test("movements stay apart from the budget, payroll, and invoices", () => {
  assert.match(migration, /create table public\.finance_movements/);
  assert.doesNotMatch(migration, /finance_documents/);
  assert.doesNotMatch(migration, /supersedes_movement_id/);
  assert.doesNotMatch(migration, /update public\.finance_records/);
  assert.doesNotMatch(migration, /insert into public\.finance_records/);
  assert.doesNotMatch(migration, /delete from public\.finance_records/);
  assert.doesNotMatch(migration, /payroll_actual/);
  assert.doesNotMatch(migration, /employee_budget_assignments/);
  assert.doesNotMatch(migration, /quickbooks/i);
});

test("void does not add a second idempotency column", () => {
  assert.match(migration, /void_finance_movement\(\s*p_movement_id uuid,\s*p_void_reason text\s*\)/);
  assert.doesNotMatch(migration, /void_idempotency_key/);
  assert.match(migration, /finance_movements_museum_idempotency_key unique \(museum_id, idempotency_key\)/);
});

test("a correction is one audit event inside the movement transaction", () => {
  assert.match(migration, /finance_movement_correct/);
  assert.match(migration, /voided_movement_id/);
  assert.match(migration, /ALREADY_VOIDED/);
  assert.match(migration, /IDEMPOTENCY_CONFLICT/);
});
