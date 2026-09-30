import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync("supabase/migrations/202609300003_finance_documents.sql", "utf8");
const storageGuard = fs.readFileSync("supabase/migrations/202609300004_finance_documents_storage_guard.sql", "utf8");
const spec = fs.readFileSync("supabase/tests/finance-documents.sql", "utf8");
const storageSpec = fs.readFileSync("supabase/tests/finance-documents-storage.sql", "utf8");

test("documents stay apart from budget, payroll, movements, and quickbooks", () => {
  assert.match(migration, /create table public\.finance_documents/);
  assert.doesNotMatch(migration, /update public\.finance_records/);
  assert.doesNotMatch(migration, /insert into public\.finance_records/);
  assert.doesNotMatch(migration, /delete from public\.finance_records/);
  assert.doesNotMatch(migration, /update public\.finance_budget_lines/);
  assert.doesNotMatch(migration, /insert into public\.finance_budget_lines/);
  assert.doesNotMatch(migration, /alter table public\.finance_movements/);
  assert.doesNotMatch(migration, /insert into public\.finance_movements/);
  assert.doesNotMatch(migration, /payroll_actual/);
  assert.doesNotMatch(migration, /employee_budget_assignments/);
  assert.doesNotMatch(migration, /quickbooks/i);
  assert.doesNotMatch(migration, /processing_failed/);
  assert.doesNotMatch(migration, /'processing'/);
});

test("exact duplicates are blocked only while the earlier document is active", () => {
  assert.match(migration, /original_sha256 ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(
    migration,
    /create unique index finance_documents_active_sha256_uidx[\s\S]*where status in \('pending_review', 'confirmed'\)/
  );
});

test("the bucket is private and the client cannot write it", () => {
  assert.match(migration, /'finance-documents',\s*\n\s*'finance-documents',\s*\n\s*false,\s*\n\s*15728640/);
  assert.match(migration, /finance_documents_storage_no_insert/);
  assert.match(migration, /finance_documents_storage_no_update/);
  assert.match(migration, /finance_documents_storage_no_delete/);
  assert.doesNotMatch(migration, /grant insert on public\.finance_documents to authenticated/);
  assert.doesNotMatch(migration, /for insert to authenticated[\s\S]*bucket_id = 'finance-documents'/);
});

test("the staging spec rolls back and checks the approved boundaries", () => {
  assert.match(spec, /rollback;/);
  assert.match(spec, /SAME_MUSEUM_READ/);
  assert.match(spec, /CROSS_MUSEUM_READ/);
  assert.match(spec, /MISSING_PERMISSION_READ/);
  assert.match(spec, /MODULE_BOUNDARY_READ/);
  assert.match(spec, /CLIENT_INSERT/);
  assert.match(spec, /CLIENT_UPDATE/);
  assert.match(spec, /CLIENT_DELETE/);
  assert.match(spec, /ANON_READ/);
  assert.match(spec, /FINANCE_RECORDS_TOUCHED/);
  assert.match(spec, /BUDGET_LINES_TOUCHED/);
  assert.match(spec, /ASSIGNMENTS_TOUCHED/);
  assert.match(spec, /PAYROLL_TOUCHED/);
  assert.match(spec, /MOVEMENT_CONTRACT_TOUCHED/);
  assert.match(spec, /REAL_MOVEMENTS_TOUCHED/);
  assert.match(spec, /BUDGET_LINE_NOT_INVOICE_ELIGIBLE|a7/);
});

test("storage reads require the document row and referenced originals stay immutable", () => {
  assert.match(storageGuard, /document\.original_path = name/);
  assert.match(storageGuard, /document\.derived_path = name/);
  assert.match(storageGuard, /public\.current_user_museum_id\(\)/);
  assert.match(storageGuard, /ORIGINAL_OBJECT_IMMUTABLE/);
  assert.doesNotMatch(storageGuard, /finance_documents_guard/);
  assert.doesNotMatch(storageGuard, /function storage\.protect_delete/);
  assert.doesNotMatch(storageGuard, /finance_records/);
  assert.doesNotMatch(storageGuard, /finance_budget_lines/);
  assert.doesNotMatch(storageGuard, /finance_movements/);
  assert.doesNotMatch(storageGuard, /payroll_actual/);
  assert.match(storageSpec, /LINKED_ORIGINAL_READ/);
  assert.match(storageSpec, /ORPHAN_STILL_VISIBLE/);
  assert.match(storageSpec, /UNLINKED_DERIVED_VISIBLE/);
  assert.match(storageSpec, /LINKED_DERIVED_READ/);
  assert.match(storageSpec, /ORPHAN_NOT_REMOVED/);
  assert.match(storageSpec, /DERIVED_NOT_REPLACEABLE/);
  assert.match(storageSpec, /rollback;/);
});
