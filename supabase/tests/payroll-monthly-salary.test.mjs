import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync("supabase/migrations/202610120001_payroll_monthly_salary.sql", "utf8");
const prior = fs.readFileSync("supabase/migrations/202609290001_payroll_actual.sql", "utf8");
const page = fs.readFileSync("js/payroll-actual.js", "utf8");

test("hourly pay stays minutes times the hourly rate", () => {
  assert.match(migration, /round\(d\.payable_minutes \* d\.hourly_rate \/ 60\.0, 2\)/);
  assert.match(prior, /round\(d\.payable_minutes \* d\.hourly_rate \/ 60\.0, 2\)/);
  assert.doesNotMatch(migration, /salary_amount\s*\//);
  assert.doesNotMatch(migration, /salary_amount\s*\*/);
});

test("monthly salary is recognized without a proration formula", () => {
  assert.match(migration, /SALARY_CONFIGURATION_INCOMPLETE/);
  assert.match(migration, /SALARY_PERIOD_UNSUPPORTED/);
  assert.match(migration, /SALARY_CHANGE_UNDEFINED/);
  assert.match(migration, /SALARY_HIRE_DATE_PARTIAL/);
  assert.match(migration, /comp->>'salary_period' <> 'monthly'/);
  assert.doesNotMatch(migration, /update public\.finance_records/);
  assert.doesNotMatch(migration, /update public\.employee_compensation/);
});

test("the payroll screen names the salary errors", () => {
  for (const code of [
    "SALARY_CONFIGURATION_INCOMPLETE",
    "SALARY_PERIOD_UNSUPPORTED",
    "SALARY_CHANGE_UNDEFINED",
    "SALARY_HIRE_DATE_PARTIAL"
  ]) {
    assert.match(page, new RegExp(code));
  }
});
