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

const voidContract = fs.readFileSync(
  "supabase/migrations/202609300002_finance_movement_void_completed.sql",
  "utf8"
);

test("a different void reason is rejected without a new column", () => {
  assert.doesNotMatch(migration, /VOID_ALREADY_COMPLETED/);
  assert.match(voidContract, /void_finance_movement\(\s*p_movement_id uuid,\s*p_void_reason text\s*\)/);
  assert.match(voidContract, /existing\.void_reason = reason/);
  assert.match(voidContract, /VOID_ALREADY_COMPLETED/);
  assert.match(voidContract, /for update/);
  assert.doesNotMatch(voidContract, /void_idempotency_key/);
  assert.doesNotMatch(voidContract, /alter table/);
  assert.doesNotMatch(voidContract, /finance_records/);
  assert.doesNotMatch(voidContract, /payroll_actual/);
  assert.doesNotMatch(voidContract, /employee_budget_assignments/);
  assert.doesNotMatch(voidContract, /finance_documents/);
  assert.doesNotMatch(voidContract, /quickbooks/i);
  assert.doesNotMatch(voidContract, /post_finance_movement/);
  assert.doesNotMatch(voidContract, /correct_finance_movement/);
});
