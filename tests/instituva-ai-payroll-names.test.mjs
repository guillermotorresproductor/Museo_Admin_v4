// Regression guard for the payroll employee-name parser.
// Run: node --test tests/instituva-ai-payroll-names.test.mjs
// No network, Supabase access, mutations or real employee records.
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(
  new URL('../supabase/functions/instituva-ai-assistant/index.ts', import.meta.url),
  'utf8',
);
const namePattern = String.raw`/^[\p{L}\p{M}.' -]+$/u`;
const wordPattern = String.raw`/\s+/`;

test('payroll route retains Unicode name and whitespace checks', () => {
  assert.ok(source.includes(namePattern), 'Unicode name regex changed');
  assert.ok(source.includes(wordPattern), 'word splitting regex changed');
});

test('employee names: valid and invalid inputs', () => {
  const valid = /^[\p{L}\p{M}.' -]+$/u;
  for (const name of ['Roberto Díaz', 'José Carlos Ortiz', 'Ana María', "O'Neill García"]) {
    assert.equal(valid.test(name), true, name);
  }
  for (const name of ['Robert123', 'Empleado; DROP', '', 'Ana\tMaría']) {
    assert.equal(valid.test(name), false, name);
  }
});

test('single name versus first and last names', () => {
  const words = (name) => name.trim().split(/\s+/).length;
  assert.equal(words('Roberto'), 1);
  assert.equal(words('Roberto Díaz'), 2);
  assert.equal(words('José  Carlos Ortiz'), 3);
});
